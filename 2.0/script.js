const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSZMxs4g73KYW8z9eGfL5EA0mlxD77qMrf0JwdDV8covIi7419uqlcrdTiAvMqv41o-wWzaKvRJ7hU-/pub?output=csv';
const FINE_AMOUNT = 500;
const PASS_POINTS = 10;
const START_DATE = new Date("2026-03-14T00:00:00");
const MASTER_WARRIORS = [
    "Obianife Eunice oghale",
    "Noel Uba",
    "Asibe",
    "Osayande Divine",
    "King David"
];
let chartInstance = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    updateHUD();
    setInterval(updateHUD, 1000);
    const users = await fetchAndAggregateData();
    render(users);
    setupSearch(users);

    document.getElementById('close-modal').onclick = () => {
        document.getElementById('stats-modal').style.display = 'none';
    };
}

function updateHUD() {
    const now = new Date();
    const END_DATE = new Date("2026-04-13T00:00:00"); // 30 days after March 14

    const diff = now - START_DATE;
    const day = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const dayDisplay = document.getElementById('current-day-display');
    dayDisplay.innerText = day < 1 ? "PRE-MISSION" : `DAY ${day > 30 ? '30' : day} // 30`;

    if (now >= END_DATE) {
        document.getElementById('countdown').innerText = `SYNC: MISSION COMPLETE`;
        return;
    }

    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    // If starting date is in future, count down to that instead
    const msLeft = now < START_DATE ? START_DATE - now : tomorrow - now;

    const h = String(Math.floor((msLeft / 3600000) % 24)).padStart(2, '0');
    const m = String(Math.floor((msLeft / 60000) % 60)).padStart(2, '0');
    const s = String(Math.floor((msLeft / 1000) % 60)).padStart(2, '0');

    document.getElementById('countdown').innerText = now < START_DATE ? `O-SYNC: ${day * -1}D ${h}:${m}:${s}` : `SYNC IN: ${h}:${m}:${s}`;
}

function parseTimeString(val) {
    if (!val) return 0;
    const s = val.toString().toLowerCase().trim();
    if (s.includes(':')) {
        const parts = s.split(':');
        return (parseFloat(parts[0]) || 0) + ((parseFloat(parts[1]) || 0) / 60);
    }
    const hrMatch = s.match(/([0-9.]+)\s*(h|hr|hrs|hour|hours)/);
    const minMatch = s.match(/([0-9.]+)\s*(m|min|mins|minute|minutes)/);
    if (hrMatch || minMatch) {
        let h = hrMatch ? parseFloat(hrMatch[1]) : 0;
        let m = minMatch ? parseFloat(minMatch[1]) : 0;
        return h + (m / 60);
    }
    return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

async function fetchAndAggregateData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(row => row.trim() !== '');
        const summary = {};

        MASTER_WARRIORS.forEach(name => {
            summary[name] = {
                name, totalPoints: 0, cumulativeHours: 0, totalFines: 0,
                entries: 0, history: [], loggedDays: new Set(),
                dailyDetails: [], lastDayFailed: false
            };
        });

        const now = new Date();
        const diff = now - START_DATE;
        const currentMissionDay = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols[0] && cols[1]) {
                const timestamp = new Date(cols[0]);
                const name = cols[1].replace(/"/g, '').trim();

                const submitDiff = timestamp - START_DATE;
                const dayOfSubmission = Math.max(0, Math.ceil(submitDiff / (1000 * 60 * 60 * 24)));

                const dayText = cols[2] ? cols[2].trim() : "";
                const dayMatch = dayText.match(/\d+/);
                const dayNum = dayMatch ? parseInt(dayMatch[0]) : 0;

                if (dayOfSubmission > dayNum) continue;

                const matchedName = MASTER_WARRIORS.find(mw => mw.toLowerCase() === name.toLowerCase());
                if (!matchedName) continue;

                const hours = parseTimeString(cols[3]);
                const isPass = hours <= 2.0 && hours > 0;

                if (summary[matchedName].loggedDays.has(dayNum)) continue;

                summary[matchedName].totalPoints += isPass ? PASS_POINTS : 0;
                summary[matchedName].cumulativeHours += hours;
                summary[matchedName].entries += 1;
                summary[matchedName].history.push(hours);
                summary[matchedName].loggedDays.add(dayNum);

                if (dayNum === currentMissionDay) {
                    summary[matchedName].lastDayFailed = !isPass;
                }

                if (!isPass) {
                    summary[matchedName].totalFines += FINE_AMOUNT;
                    summary[matchedName].dailyDetails.push(`Day ${dayNum}: M-PROTOCOL VIOLATION (₦${FINE_AMOUNT})`);
                }
            }
        }

        // Add fines for missing past days
        // Only count a day as "missed" if they haven't logged it AND that full day is ALREADY OVER.
        // E.g., if today is Day 3, we only check if they missed Day 1 or Day 2.
        // We do not fine a person for "missing" the current day since they might enter data later today.
        const pastCompletedDays = Math.max(0, currentMissionDay - 1);

        Object.values(summary).forEach(user => {
            user.missedDaysCount = 0;
            for (let d = 1; d <= pastCompletedDays; d++) {
                if (!user.loggedDays.has(d)) {
                    user.totalFines += FINE_AMOUNT;
                    user.missedDaysCount += 1;
                    user.dailyDetails.push(`Day ${d}: MISSING LOG FILE (₦${FINE_AMOUNT})`);

                    if (d === pastCompletedDays) user.lastDayFailed = true;
                }
            }
        });

        return Object.values(summary).sort((a, b) =>
            b.totalPoints - a.totalPoints ||
            b.entries - a.entries ||
            a.cumulativeHours - b.cumulativeHours
        );
    } catch (e) { return []; }
}

function showStats(user) {
    const modal = document.getElementById('stats-modal');
    modal.style.display = 'flex';

    const totalEntries = user.history.length;
    const fails = user.history.filter(h => h > 2).length;
    const failRate = totalEntries ? (fails / totalEntries) : 0;
    const latestEntry = user.history[totalEntries - 1] || 0;

    let rank = "APEX VANGUARD";
    let rankColor = "text-cyan";
    let statusClass = "vanguard";
    let message = "SYNAPSE CLEAR. EXCELLENT DISCIPLINE DETECTED.";

    if (failRate > 0.5) {
        if (latestEntry <= 2 && latestEntry > 0) {
            rank = "RECOVERING PROTOCOL";
            rankColor = "text-yellow";
            statusClass = "recovery";
            message = "CORRECTION APPLIED. AVOIDING SYSTEM FAILURE.";
        } else {
            rank = "SYSTEM OVERRIDE";
            rankColor = "text-red";
            statusClass = "fallen";
            message = "CRITICAL WARNING: SCREEN ADDICTION IMMINENT.";
        }
    } else if (failRate > 0) {
        rank = "DEGRADED SIGNAL";
        rankColor = "text-magenta";
        message = "FOCUS FLUCTUATING. REBOOT IMMEDIATELY.";
    }

    const injectBox = document.getElementById('modal-content-inject');
    injectBox.innerHTML = `
        <h2 class="modal-title ${rankColor}">${user.name} // DIAGNOSTICS</h2>
        <div class="status-card ${statusClass}">
            <div style="font-family: var(--font-header); font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">THREAT LEVEL</div>
            <div style="font-size: 1.2rem; margin-bottom: 10px; font-weight: 700;" class="${rankColor}">${rank}</div>
            <p style="font-size: 0.85rem; opacity: 0.8;">[ ${message} ]</p>
            <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                <span style="font-family: var(--font-header); font-size: 0.8rem; margin-right: 15px;">MISSED LOGS: <span class="text-yellow">${user.missedDaysCount}</span></span>
                <span style="font-family: var(--font-header); font-size: 0.8rem;">TOTAL PENALTY: <span class="text-red">₦${user.totalFines.toLocaleString()}</span></span>
            </div>
        </div>
        
        <div style="max-height: 150px; overflow-y: auto; margin-bottom: 10px;">
            <ul class="fine-list">
                ${user.dailyDetails.map(d => `<li><span>SYSTEM ALERT:</span> <span class="text-red">${d}</span></li>`).join('')}
                ${user.dailyDetails.length === 0 ? '<li>NO VIOLATIONS DETECTED.</li>' : ''}
            </ul>
        </div>
    `;

    const ctx = document.getElementById('usageChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    let lineColor = '#00f3ff';
    if (rank === "SYSTEM OVERRIDE") lineColor = '#fb7185';
    else if (rank === "RECOVERING PROTOCOL") lineColor = '#facc15';
    else if (rank === "DEGRADED SIGNAL") lineColor = '#ff00e5';

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: user.history.map((_, i) => `LOG ${i + 1}`),
            datasets: [{
                label: 'HOURS DETECTED',
                data: user.history,
                borderColor: lineColor,
                backgroundColor: `${lineColor}33`,
                borderWidth: 3,
                pointBackgroundColor: '#03040a',
                pointBorderColor: lineColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Ubuntu Mono, monospace' } } },
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { family: 'Orbitron, sans-serif' } } }
            }
        }
    });

    setTimeout(() => document.getElementById('stats-modal').style.opacity = '1', 10);
}

function render(users) {
    const container = document.getElementById('leaderboard');
    container.innerHTML = '';

    users.forEach((user, index) => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = `
            <div class="rank-badge text-cyan">0${index + 1}</div>
            <div class="card-name">${user.name}</div>
            
            <div class="card-stats-row">
                <div class="stat-pill">
                    <span style="font-size: 0.65rem; color: var(--text-muted);">TIME SPENT</span>
                    <span class="stat-val text-yellow">${user.cumulativeHours.toFixed(1)}H</span>
                </div>
                <div class="stat-pill">
                    <span style="font-size: 0.65rem; color: var(--text-muted);">UPLOADS</span>
                    <span class="stat-val text-magenta">${user.entries}</span>
                </div>
            </div>

            <button class="action-btn">VIEW ANALYSIS</button>
            
            <div class="points-display">
                <span class="pts-label">EXPERIENCE POINTS</span>
                <span class="pts-val">${user.totalPoints}</span>
            </div>
        `;

        card.querySelector('.action-btn').onclick = () => showStats(user);
        container.appendChild(card);
    });
}

function setupSearch(users) {
    document.getElementById('search-bar').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        render(users.filter(u => u.name.toLowerCase().includes(term)));
    });
}
