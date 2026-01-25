const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvv1HPLpH6DTsNELs6EJOGCw0cSSLXM7HAVA-s5sgHIA7o8ECaBkWadCcMTo7C4UtyacmG3NWbjM_P/pub?gid=1474645731&single=true&output=csv';
const FINE_AMOUNT = 500;
const START_DATE = new Date("2026-01-26T00:00:00");

const ACCESS_KEY = "ADMIN123"; // Change this to your preferred secret key

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

        const participants = new Set();
        const dailyLogs = {}; // { dayNumber: { name: { status: 'PASS'/'FAIL' } } }

        // Process rows
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols[1]) {
                const name = cols[1].replace(/"/g, '').trim();
                const dayText = cols[2] ? cols[2].trim() : "";
                const dayMatch = dayText.match(/\d+/);
                const dayNum = dayMatch ? parseInt(dayMatch[0]) : null;
                const status = cols[7] ? cols[7].trim().toUpperCase() : "FAIL";
                const isPass = status.includes("PASS");

                participants.add(name);

                if (dayNum) {
                    if (!dailyLogs[dayNum]) dailyLogs[dayNum] = {};
                    dailyLogs[dayNum][name] = isPass ? 'PASS' : 'FAIL';
                }
            }
        }

        return {
            participants: Array.from(participants),
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

    for (let d = 1; d <= maxDayToShow; d++) {
        const daySection = document.createElement('div');
        daySection.className = 'day-section';

        const missedParticipants = [];

        participants.forEach(name => {
            const log = dailyLogs[d] ? dailyLogs[d][name] : null;
            if (!log) {
                missedParticipants.push({ name, reason: 'NO LOG' });
                totalFinePool += FINE_AMOUNT;
            } else if (log === 'FAIL') {
                missedParticipants.push({ name, reason: 'FAILED' });
                totalFinePool += FINE_AMOUNT;
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
                        <div class="missed-card">
                            <span class="missed-name">${p.name}</span>
                            <span class="missed-reason">${p.reason}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        container.appendChild(daySection);
    }

    totalFinesText.innerText = `₦${totalFinePool.toLocaleString()}`;
}
