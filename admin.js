const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvv1HPLpH6DTsNELs6EJOGCw0cSSLXM7HAVA-s5sgHIA7o8ECaBkWadCcMTo7C4UtyacmG3NWbjM_P/pub?gid=1474645731&single=true&output=csv';
const FINE_AMOUNT = 500;
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

const ACCESS_KEY = "ADMIN123"; // Change this to your preferred secret key

function getPaidFines() {
    const paid = localStorage.getItem('paid_fines');
    return paid ? JSON.parse(paid) : {};
}

function toggleFinePaid(day, name) {
    const paid = getPaidFines();
    const key = `day${day}_${name}`;
    paid[key] = !paid[key];
    localStorage.setItem('paid_fines', JSON.stringify(paid));
    location.reload(); // Refresh to update totals
}


document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('auth-btn');
    const passInput = document.getElementById('admin-pass');
    const overlay = document.getElementById('access-overlay');
    const content = document.getElementById('admin-content');
    const errorMsg = document.getElementById('auth-error');

    authBtn.onclick = () => {
        if (passInput.value === ACCESS_KEY) {
            overlay.style.display = 'none';
            content.style.display = 'block';
            document.getElementById('admin-summary').style.display = 'flex';
            initAdmin();
        } else {
            errorMsg.style.display = 'block';
            passInput.value = '';
        }
    };

    passInput.onkeydown = (e) => {
        if (e.key === 'Enter') authBtn.click();
    };
});

async function initAdmin() {
    const data = await fetchRawData();
    renderAdmin(data);
}

async function fetchRawData() {
    try {
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();
        const rows = csvText.split('\n').filter(row => row.trim() !== '');

        const participants = MASTER_WARRIORS; // Source of truth
        const dailyLogs = {}; // { dayNumber: { name: { status: 'PASS'/'FAIL' } } }

        // Process rows
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols[0] && cols[1]) {
                const timestamp = new Date(cols[0]);
                const name = cols[1].replace(/"/g, '').trim();

                // 1. Calculate mission day at submission time
                const submitDiff = timestamp - START_DATE;
                const dayOfSubmission = Math.max(0, Math.ceil(submitDiff / (1000 * 60 * 60 * 24)));

                const dayText = cols[2] ? cols[2].trim() : "";
                const dayMatch = dayText.match(/\d+/);
                const dayNum = dayMatch ? parseInt(dayMatch[0]) : null;

                // 2. Strict Midnight Lock
                if (dayOfSubmission > dayNum) continue;

                // 3. Case-insensitive name matching
                const matchedName = MASTER_WARRIORS.find(mw => mw.toLowerCase() === name.toLowerCase());
                if (!matchedName) continue;

                const hours = parseFloat(cols[3].replace(/[^0-9.]/g, '')) || 0;

                // 4. Auto-calculate status (fixed for empty columns)
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

    // Determine current day of mission
    const now = new Date();
    const diff = now - START_DATE;
    const currentMissionDay = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));

    // We only show days that have passed or are current
    const loggedDays = Object.keys(dailyLogs).map(Number);
    const maxDayToShow = loggedDays.length > 0 ? Math.max(...loggedDays, currentMissionDay) : currentMissionDay;

    let totalFinePool = 0;

    if (maxDayToShow < 1) {
        container.innerHTML = '<div class="loading-state">MISSION HAS NOT STARTED YET</div>';
        return;
    }

    const paidFines = getPaidFines();

    for (let d = 1; d <= maxDayToShow; d++) {
        const daySection = document.createElement('div');
        daySection.className = 'day-section';

        const missedParticipants = [];

        participants.forEach(name => {
            const log = dailyLogs[d] ? dailyLogs[d][name] : null;
            const isPaid = paidFines[`day${d}_${name}`];

            if (!log || log === 'FAIL') {
                const reason = !log ? 'NO LOG' : 'FAILED';
                missedParticipants.push({ name, reason, isPaid });
                if (!isPaid) totalFinePool += FINE_AMOUNT;
            }
        });

        if (missedParticipants.length === 0) {
            daySection.innerHTML = `
                <div class="day-header">
                    <span>DAY ${d}</span>
                    <span style="color: var(--neon-green); font-size: 0.7rem;">ALL CLEAR</span>
                </div>
                <p style="font-size: 0.7rem; color: #555; text-align: center;">NO CASUALTIES RECORDED</p>
            `;
        } else {
            daySection.innerHTML = `
                <div class="day-header">
                    <span>DAY ${d}</span>
                    <span style="color: var(--neon-red); font-size: 0.7rem;">${missedParticipants.length} CASUALTIES</span>
                </div>
                <div class="missed-list">
                    ${missedParticipants.map(p => `
                        <div class="missed-card ${p.isPaid ? 'paid-card' : ''}" onclick="toggleFinePaid(${d}, '${p.name}')" style="cursor: pointer;">
                            <div style="display: flex; flex-direction: column;">
                                <span class="missed-name">${p.name}</span>
                                <span class="missed-reason">${p.reason}</span>
                            </div>
                            <span class="settle-badge">${p.isPaid ? 'PAID ✅' : 'SETTLE'}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.appendChild(daySection);
    }

    totalFinesText.innerText = `₦${totalFinePool.toLocaleString()}`;
}
