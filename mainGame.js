document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadCrimes();
    loadCrew();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

async function loadCrimes() {
    const crimeList = document.getElementById('crime-list');
    if (!crimeList) {
        return;
    }

    crimeList.textContent = 'Loading crimes...';

    try {
        const response = await fetch('data/crimes.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        renderCrimes(data.crimes || []);
    } catch (error) {
        console.error('Failed to load crimes.json', error);
        crimeList.textContent = 'Failed to load crimes.';
    }
}

function renderCrimes(crimes) {
    const crimeList = document.getElementById('crime-list');
    crimeList.innerHTML = '';

    if (!Array.isArray(crimes) || crimes.length === 0) {
        crimeList.textContent = 'No crimes available.';
        return;
    }

    const list = document.createElement('ul');

    crimes.forEach(crime => {
        const item = document.createElement('li');
        const duration = Number.isFinite(crime.durationMinutes)
            ? `${crime.durationMinutes}m`
            : 'n/a';
        const cash = crime && crime.rewards ? crime.rewards.cash : null;
        const cashLabel = typeof cash === 'number' ? `$${cash}` : '$0';
        const heatLabel = Number.isFinite(crime.heat) ? `Heat ${crime.heat}` : 'Heat ?';
        const roleLabel = crime.requiresRole ? `Requires ${crime.requiresRole}` : 'Solo or crew';
        const tierLabel = crime.tier ? crime.tier : 'misc';

        item.textContent = `${crime.name} (${tierLabel}) - ${duration} - ${cashLabel} - ${heatLabel} - ${roleLabel}`;
        list.appendChild(item);
    });

    crimeList.appendChild(list);
}

async function loadCrew() {
    const rosterList = document.getElementById('henchmen-list');
    const recruitmentList = document.getElementById('recruitment-list');

    if (rosterList) {
        rosterList.textContent = 'Loading crew...';
    }
    if (recruitmentList) {
        recruitmentList.textContent = 'Loading roles...';
    }

    try {
        const response = await fetch('data/crew.json', { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        renderRoster(data.roster || []);
        renderRoles(data.roles || []);
    } catch (error) {
        console.error('Failed to load crew.json', error);
        if (rosterList) {
            rosterList.textContent = 'Failed to load crew.';
        }
        if (recruitmentList) {
            recruitmentList.textContent = 'Failed to load roles.';
        }
    }
}

function renderRoster(roster) {
    const rosterList = document.getElementById('henchmen-list');
    if (!rosterList) {
        return;
    }

    rosterList.innerHTML = '';

    if (!Array.isArray(roster) || roster.length === 0) {
        rosterList.textContent = 'No henchmen hired.';
        return;
    }

    const list = document.createElement('ul');

    roster.forEach(member => {
        const item = document.createElement('li');
        const roleLabel = member.role ? member.role : 'crew';
        const speedLabel = Number.isFinite(member.speedMultiplier)
            ? `Speed ${member.speedMultiplier}x`
            : 'Speed ?';
        const riskLabel = Number.isFinite(member.riskTolerance)
            ? `Risk ${member.riskTolerance}x`
            : 'Risk ?';
        const statusLabel = member.status ? member.status : 'active';

        item.textContent = `${member.name} (${roleLabel}) - ${statusLabel} - ${speedLabel} - ${riskLabel}`;
        list.appendChild(item);
    });

    rosterList.appendChild(list);
}

function renderRoles(roles) {
    const recruitmentList = document.getElementById('recruitment-list');
    if (!recruitmentList) {
        return;
    }

    recruitmentList.innerHTML = '';

    if (!Array.isArray(roles) || roles.length === 0) {
        recruitmentList.textContent = 'No roles available.';
        return;
    }

    const list = document.createElement('ul');

    roles.forEach(role => {
        const item = document.createElement('li');
        const summary = role.summary ? role.summary : 'Crew specialist.';
        const hireCost = role.hireCost && typeof role.hireCost.cash === 'number'
            ? `Hire $${role.hireCost.cash}`
            : 'Hire n/a';
        const speedLabel = Number.isFinite(role.baseSpeed)
            ? `Speed ${role.baseSpeed}x`
            : 'Speed ?';
        const riskLabel = Number.isFinite(role.riskTolerance)
            ? `Risk ${role.riskTolerance}x`
            : 'Risk ?';
        const unlockLabel = role.unlock && role.unlock.label
            ? `Unlock: ${role.unlock.label}`
            : 'Available';

        item.textContent = `${role.name} - ${summary} - ${hireCost} - ${speedLabel} - ${riskLabel} - ${unlockLabel}`;
        list.appendChild(item);
    });

    recruitmentList.appendChild(list);
}
