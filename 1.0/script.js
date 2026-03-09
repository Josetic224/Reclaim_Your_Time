const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvv1HPLpH6DTsNELs6EJOGCw0cSSLXM7HAVA-s5sgHIA7o8ECaBkWadCcMTo7C4UtyacmG3NWbjM_P/pub?gid=1474645731&single=true&output=csv';
const FINE_AMOUNT = 500;
const PASS_POINTS = 10;
const START_DATE = new Date("2026-01-26T00:00:00");
const MASTER_WARRIORS = [
    "Oluwaseun Ope",
    "Wealth",
    "Damotu Nanighe Major",
    "Noel Uba",
    "Osayande Divine",
    "Akande Mary Ayobami",
    "Urowayinor Joan",
    "Jacob Success Ekpe"
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
    const diff = now - START_DATE;
    const day = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const dayDisplay = document.getElementById('current-day-display');
    dayDisplay.innerText = day < 1 ? "PRE-MISSION" : `DAY ${day > 30 ? '30' : day} // 30`;

    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    const msLeft = tomorrow - now;
    const h = String(Math.floor((msLeft / 3600000) % 24)).padStart(2, '0');
    const m = String(Math.floor((msLeft / 60000) % 60)).padStart(2, '0');
    const s = String(Math.floor((msLeft / 1000) % 60)).padStart(2, '0');
    document.getElementById('countdown').innerText = `SYNC IN: ${h}:${m}:${s}`;
}

async function fetchAndAggregateData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(row => row.trim() !== '');
        const summary = {};

        // 1. Initialize with Master List
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

                // Calculate which mission day it was when this was submitted
                const submitDiff = timestamp - START_DATE;
                const dayOfSubmission = Math.max(0, Math.ceil(submitDiff / (1000 * 60 * 60 * 24)));

                const dayText = cols[2] ? cols[2].trim() : "";
                const dayMatch = dayText.match(/\d+/);
                const dayNum = dayMatch ? parseInt(dayMatch[0]) : 0;

                // VALIDATION: Strict midnight lock. No grace period.
                // A log is only valid if it was submitted ON the day it reports for.
                if (dayOfSubmission > dayNum) continue;

                // Case-insensitive name matching with the master list
                const matchedName = MASTER_WARRIORS.find(mw => mw.toLowerCase() === name.toLowerCase());
                if (!matchedName) continue;

                const hours = parseFloat(cols[3].replace(/[^0-9.]/g, '')) || 0;

                // AUTO-CALCULATE: Pass if <= 2 hrs. This fixes issues with empty columns in the sheet.
                const isPass = hours <= 2.0 && hours > 0;

                // Stop duplicate logs from adding points multiple times
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
                    summary[matchedName].dailyDetails.push(`Day ${dayNum}: Over Screen Limit (₦${FINE_AMOUNT})`);
                }
            }
        }

        // Add fines for missing days
        Object.values(summary).forEach(user => {
            user.missedDaysCount = 0;
            for (let d = 1; d <= currentMissionDay; d++) {
                if (!user.loggedDays.has(d)) {
                    user.totalFines += FINE_AMOUNT;
                    user.missedDaysCount = (user.missedDaysCount || 0) + 1;
                    user.dailyDetails.push(`Day ${d}: Missing Mission Log (₦${FINE_AMOUNT})`);
                    // If they missed the most recent day, mark as failed for the "FINED" tag
                    if (d === currentMissionDay) user.lastDayFailed = true;
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

    // 1. Core Data
    const totalEntries = user.history.length;
    const fails = user.history.filter(h => h > 2).length;
    const failRate = fails / totalEntries;
    const latestEntry = user.history[user.history.length - 1]; // Their very last submission

    let rank = "VANGUARD";
    let rankClass = "rank-vanguard";
    let message = "Excellent discipline, Warrior. The mission is on track.";

    // 2. Logic Chain
    if (failRate > 0.5) {
        // High failure rate, check for recovery
        if (latestEntry <= 2) {
            rank = "RECOVERING";
            rankClass = "rank-recovery";
            message = "Redemption initiated. You are fighting the addiction. Don't stop now.";
        } else {
            rank = "RENEGADE";
            rankClass = "rank-fallen";
            message = "WARNING: You are losing the battle. Your screen has claimed you.";
        }
    } else if (failRate > 0) {
        rank = "STRUGGLING";
        rankClass = "rank-neutral";
        message = "Your focus is flickering. Re-engage immediately.";
    }

    // 3. Inject Gamified Header
    const oldStatus = document.getElementById('dynamic-status');
    if (oldStatus) oldStatus.remove();

    const statusHTML = `
        <div id="dynamic-status">
            <h2 id="modal-name" class="neon-text-glitch">${user.name} // ANALYSIS</h2>
            <div class="status-container">
                <div class="status-text-group">
                    <span class="status-label">CURRENT STANDING</span>
                    <span class="status-rank ${rankClass}">${rank}</span>
                    <p class="mission-critique">"${message}"</p>
                </div>
            </div>
            <div class="fine-breakdown">
                <div class="fine-summary-row">
                    <span class="fine-stat">MISSED LOGS: <strong>${user.missedDaysCount}</strong></span>
                    <span class="fine-stat">TOTAL FINES: <strong class="rank-fallen">₦${user.totalFines.toLocaleString()}</strong></span>
                </div>
                <ul class="fine-list">
                    ${user.dailyDetails.map(d => `<li>${d}</li>`).join('')}
                </ul>
            </div>
        </div>
    `;

    document.querySelector('.chart-container').insertAdjacentHTML('beforebegin', statusHTML);

    // 4. Render Chart with Dynamic Color
    const ctx = document.getElementById('usageChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    // Line color changes based on status
    let lineColor = '#00ff95'; // Default Green
    if (rank === "RENEGADE") lineColor = '#ff003c'; // Red
    if (rank === "RECOVERING") lineColor = '#00d4ff'; // Blue

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: user.history.map((_, i) => `D${i + 1}`),
            datasets: [{
                label: 'HOURS SPENT',
                data: user.history,
                borderColor: lineColor,
                backgroundColor: `${lineColor}1A`, // 10% opacity version of line color
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#111' }, ticks: { color: '#555' } },
                x: { grid: { display: false }, ticks: { color: '#555' } }
            }
        }
    });
}

function render(users) {
    const container = document.getElementById('leaderboard');
    container.innerHTML = '';

    users.forEach((user, index) => {
        const dayLabel = user.entries === 1 ? 'DAY' : 'DAYS';
        const card = document.createElement('div');
        card.className = 'participant-card';
        card.innerHTML = `
            <div class="rank">#${index + 1}</div>
            <div class="info">
                <span class="name">${user.name}</span>
                <div class="usage-row">
                    <span class="stat-item">TOTAL: <strong>${user.cumulativeHours.toFixed(1)}H</strong></span>
                    <span class="stat-item">LOGS: <strong>${user.entries} ${dayLabel}</strong></span>
                </div>
                <button class="view-stats-btn">VIEW ANALYSIS</button>
            </div>
            <div class="score-zone">
                <span class="score-value">${user.totalPoints}</span>
                <span class="score-label">POINTS</span>
            </div>
        `;
        card.querySelector('.view-stats-btn').onclick = () => showStats(user);
        container.appendChild(card);
    });

    // Add Admin access link if not exists
    if (!document.getElementById('admin-link')) {
        const adminLink = document.createElement('a');
        adminLink.id = 'admin-link';
        adminLink.href = 'admin.html';
        adminLink.innerText = 'MISSION OVERSIGHT (ADMIN)';
        adminLink.style.cssText = 'display: block; font-size: 0.55rem; color: #555; margin: 40px auto 20px; text-decoration: none; font-family: var(--font-header); width: fit-content; text-align: center; opacity: 0.6; transition: 0.3s;';
        adminLink.onmouseover = () => adminLink.style.opacity = '1';
        adminLink.onmouseout = () => adminLink.style.opacity = '0.6';
        document.body.appendChild(adminLink);
    }
}

function setupSearch(users) {
    document.getElementById('search-bar').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        render(users.filter(u => u.name.toLowerCase().includes(term)));
    });
}