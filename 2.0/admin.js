const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSZMxs4g73KYW8z9eGfL5EA0mlxD77qMrf0JwdDV8covIi7419uqlcrdTiAvMqv41o-wWzaKvRJ7hU-/pub?output=csv';
const FINE_AMOUNT = 500;
const START_DATE = new Date("2026-03-14T00:00:00");

const MASTER_WARRIORS = [
    "Obianife Eunice oghale",
    "Noel Uba",
    "Asibe",
    "Osayande Divine",
    "King David"
];

const ACCESS_KEY = "ADMIN123";

function getPaidFines() {
    const paid = localStorage.getItem('paid_fines');
    return paid ? JSON.parse(paid) : {};
}

function toggleFinePaid(day, name) {
    const paid = getPaidFines();
    const key = `day${day}_${name}`;
    paid[key] = !paid[key];
    localStorage.setItem('paid_fines', JSON.stringify(paid));
    location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('auth-btn');
    const passInput = document.getElementById('admin-pass');
    const overlay = document.getElementById('access-overlay');
    const dashboard = document.getElementById('admin-dashboard');
    const errorMsg = document.getElementById('auth-error');

    authBtn.onclick = () => {
        if (passInput.value === ACCESS_KEY) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                dashboard.style.display = 'block';
                dashboard.style.animation = 'fadeIn 0.5s forwards';
                initAdmin();
            }, 300);
        } else {
            errorMsg.style.display = 'block';
            passInput.value = '';
        }
    };

    if (passInput) {
        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') authBtn.click();
        });
    }
});

async function initAdmin() {
    const data = await fetchRawData();
    renderAdmin(data);
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

async function fetchRawData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(row => row.trim() !== '');

        const participants = MASTER_WARRIORS;
        const dailyLogs = {};

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols[0] && cols[1]) {
                const timestamp = new Date(cols[0]);
                const name = cols[1].replace(/"/g, '').trim();

                const submitDiff = timestamp - START_DATE;
                const dayOfSubmission = Math.max(0, Math.ceil(submitDiff / (1000 * 60 * 60 * 24)));

                const dayText = cols[2] ? cols[2].trim() : "";
                const dayMatch = dayText.match(/\d+/);
                const dayNum = dayMatch ? parseInt(dayMatch[0]) : null;

                if (dayOfSubmission > dayNum) continue;

                const matchedName = MASTER_WARRIORS.find(mw => mw.toLowerCase() === name.toLowerCase());
                if (!matchedName) continue;

                const hours = parseTimeString(cols[3]);
                const isPass = hours <= 2.0 && hours > 0;

                if (dayNum) {
                    if (!dailyLogs[dayNum]) dailyLogs[dayNum] = {};
                    dailyLogs[dayNum][matchedName] = isPass ? 'PASS' : 'FAIL';
                }
            }
        }

        return {
            participants: MASTER_WARRIORS,
            dailyLogs,
            totalRows: rows.length - 1
        };
    } catch (e) {
        console.error(e);
        return { participants: [], dailyLogs: {}, totalRows: 0 };
    }
}

function renderAdmin(data) {
    const container = document.getElementById('admin-content');
    const totalWarriorsText = document.getElementById('total-warriors');
    const totalFinesText = document.getElementById('admin-total-fines');

    container.innerHTML = '';

    const { participants, dailyLogs } = data;
    totalWarriorsText.innerText = participants.length;

    const now = new Date();
    const diff = now - START_DATE;
    const currentMissionDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1; // If it's the 14th, diff is ~0, floor is 0 + 1 = day 1.

    // We only show days that have FULLY passed (yesterday and beyond) so nobody gets fined halfway through today.
    const pastCompletedDays = Math.max(0, currentMissionDay - 1);
    const loggedDays = Object.keys(dailyLogs).map(Number);
    const maxDayToShow = loggedDays.length > 0 ? Math.max(...loggedDays, pastCompletedDays) : pastCompletedDays;

    let totalFinePool = 0;

    if (maxDayToShow < 1) {
        container.innerHTML = '<div class="loading">MISSION OR LOGS HAVE NOT STARTED YET</div>';
        return;
    }

    const paidFines = getPaidFines();

    for (let d = 1; d <= maxDayToShow; d++) {
        const daySection = document.createElement('div');
        daySection.className = 'glass-card';

        const missedParticipants = [];

        participants.forEach(name => {
            const log = dailyLogs[d] ? dailyLogs[d][name] : null;
            const isPaid = paidFines[`day${d}_${name}`];

            if (!log || log === 'FAIL') {
                const reason = !log ? 'MISSING LOG DATA' : 'PROTOCOL VIOLATED (>2 HRS)';
                missedParticipants.push({ name, reason, isPaid });
                if (!isPaid) totalFinePool += FINE_AMOUNT;
            }
        });

        if (missedParticipants.length === 0) {
            daySection.innerHTML = `
                <div class="day-title-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(74, 222, 128, 0.2); padding-bottom: 15px; margin-bottom: 10px;">
                    <span style="font-family: var(--font-header); font-size: 1.5rem; color: var(--text-main);">DAY ${d}</span>
                    <span class="neon-badge" style="background: rgba(74, 222, 128, 0.1); color: var(--green); border-color: var(--green);">ALL CLEAR // NO INFRINGEMENTS</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 20px;">ENTITIES PERFORMED WITHIN EXPECTED PARAMETERS.</p>
            `;
        } else {
            daySection.innerHTML = `
                <div class="day-title-row" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(251, 113, 133, 0.2); padding-bottom: 15px;">
                    <span style="font-family: var(--font-header); font-size: 1.5rem; color: var(--text-main);">DAY ${d}</span>
                    <span class="timer-badge" style="background: rgba(251, 113, 133, 0.1); color: var(--red); border-color: var(--red);">${missedParticipants.length} INFRACTIONS SPOTTED</span>
                </div>
                <div class="missed-grid">
                    ${missedParticipants.map(p => `
                        <div class="missed-item ${p.isPaid ? 'paid' : ''}" onclick="toggleFinePaid(${d}, '${p.name}')">
                            <div class="missed-info">
                                <span class="missed-name">${p.name}</span>
                                <span class="missed-reason">${p.reason}</span>
                            </div>
                            <span class="settle-badge">${p.isPaid ? 'RESOLVED' : 'FINES OPEN'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.appendChild(daySection);
    }

    totalFinesText.innerText = `₦${totalFinePool.toLocaleString()}`;
}
