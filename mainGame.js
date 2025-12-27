const STORAGE_KEY = 'crimeCommitterState_v1';
const STATE_VERSION = 1;
const TICK_MS = 1000;

const game = {
    data: {
        crimes: [],
        crew: null,
        tech: null
    },
    index: {
        crimeUnlockers: {},
        roleUnlockers: {},
        nodesById: {},
        researchById: {}
    },
    state: null,
    tickHandle: null
};

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    initGame();
    setupActionHandlers();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.tab);
            if (target) {
                target.classList.add('active');
            }
        });
    });
}

function setupActionHandlers() {
    document.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const action = button.dataset.action;
        const id = button.dataset.id;

        if (action === 'start-crime') {
            startCrime(id);
        }

        if (action === 'start-research') {
            startResearch(id);
        }

        if (action === 'hire-role') {
            hireRole(id);
        }
    });
}

async function initGame() {
    try {
        game.data = await loadData();
        game.index = buildIndex(game.data.tech);
        game.state = loadState(game.data);
        resolveOfflineOps();
        renderAll();
        startTicker();
    } catch (error) {
        console.error('Failed to init game data', error);
        showLoadError();
    }
}

async function loadData() {
    const [crimesData, crewData, techData] = await Promise.all([
        fetchJson('data/crimes.json'),
        fetchJson('data/crew.json'),
        fetchJson('data/tech.json')
    ]);

    return {
        crimes: Array.isArray(crimesData.crimes) ? crimesData.crimes : [],
        crew: crewData || { roles: [], roster: [] },
        tech: techData || { nodes: [], researchOps: [] }
    };
}

async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${path}`);
    }
    return response.json();
}

function buildIndex(techData) {
    const crimeUnlockers = {};
    const roleUnlockers = {};
    const nodesById = {};
    const researchById = {};

    const nodes = Array.isArray(techData.nodes) ? techData.nodes : [];
    nodes.forEach(node => {
        if (!node || !node.id) {
            return;
        }
        nodesById[node.id] = node;

        if (node.unlocks && Array.isArray(node.unlocks.crimes)) {
            node.unlocks.crimes.forEach(crimeId => {
                crimeUnlockers[crimeId] = crimeUnlockers[crimeId] || [];
                crimeUnlockers[crimeId].push(node.id);
            });
        }

        if (node.unlocks && Array.isArray(node.unlocks.roles)) {
            node.unlocks.roles.forEach(roleId => {
                roleUnlockers[roleId] = roleUnlockers[roleId] || [];
                roleUnlockers[roleId].push(node.id);
            });
        }
    });

    const researchOps = Array.isArray(techData.researchOps) ? techData.researchOps : [];
    researchOps.forEach(op => {
        if (op && op.id) {
            researchById[op.id] = op;
        }
    });

    return { crimeUnlockers, roleUnlockers, nodesById, researchById };
}

function loadState(data) {
    let state = null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            state = JSON.parse(raw);
        } catch (error) {
            console.warn('Failed to parse saved state, resetting.', error);
            state = null;
        }
    }

    if (!state || state.version !== STATE_VERSION) {
        state = createDefaultState(data);
    }

    state = normalizeState(state, data);
    return state;
}

function createDefaultState(data) {
    const roster = [createPlayer()];
    const seedRoster = Array.isArray(data.crew.roster) ? data.crew.roster : [];
    seedRoster.forEach(member => {
        roster.push(normalizeCrewMember(member, data.crew.roles));
    });

    return {
        version: STATE_VERSION,
        resources: {
            cash: 0,
            heat: 0
        },
        inventory: {},
        roster,
        activeOps: [],
        unlockedNodes: [],
        completedOps: [],
        log: []
    };
}

function normalizeState(state, data) {
    state.version = STATE_VERSION;
    state.resources = state.resources || { cash: 0, heat: 0 };
    state.resources.cash = Number(state.resources.cash) || 0;
    state.resources.heat = Number(state.resources.heat) || 0;
    state.inventory = state.inventory || {};
    state.roster = Array.isArray(state.roster) ? state.roster : [];
    state.activeOps = Array.isArray(state.activeOps) ? state.activeOps : [];
    state.unlockedNodes = Array.isArray(state.unlockedNodes) ? state.unlockedNodes : [];
    state.completedOps = Array.isArray(state.completedOps) ? state.completedOps : [];
    state.log = Array.isArray(state.log) ? state.log : [];

    if (!state.roster.find(member => member.id === 'player')) {
        state.roster.unshift(createPlayer());
    }

    state.roster = state.roster.map(member => normalizeCrewMember(member, data.crew.roles));
    refreshCrewStatus();

    return state;
}

function createPlayer() {
    return {
        id: 'player',
        name: 'You',
        role: 'player',
        speedMultiplier: 1,
        riskTolerance: 1,
        status: 'idle'
    };
}

function normalizeCrewMember(member, roles) {
    if (!member || typeof member !== 'object') {
        return createPlayer();
    }

    const normalized = { ...member };
    normalized.id = normalized.id || createId('crew');
    normalized.name = normalized.name || 'Henchman';
    normalized.role = normalized.role || 'goon';
    normalized.status = normalized.status || 'idle';

    if (!Number.isFinite(normalized.speedMultiplier)) {
        const role = getRoleById(normalized.role, roles);
        normalized.speedMultiplier = role && Number.isFinite(role.baseSpeed) ? role.baseSpeed : 1;
    }

    if (!Number.isFinite(normalized.riskTolerance)) {
        const role = getRoleById(normalized.role, roles);
        normalized.riskTolerance = role && Number.isFinite(role.riskTolerance) ? role.riskTolerance : 1;
    }

    return normalized;
}

function refreshCrewStatus() {
    if (!game.state) {
        return;
    }

    game.state.roster.forEach(member => {
        if (member.id !== 'player') {
            member.status = 'idle';
        } else if (!member.status) {
            member.status = 'idle';
        }
    });

    game.state.activeOps.forEach(op => {
        const member = game.state.roster.find(entry => entry.id === op.assignedTo);
        if (member) {
            member.status = 'busy';
            member.activeOpId = op.id;
        }
    });
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game.state));
}

function resolveOfflineOps() {
    const now = Date.now();
    const completed = [];

    game.state.activeOps.forEach(op => {
        if (op.finishTime <= now) {
            completed.push(op);
        }
    });

    if (completed.length === 0) {
        return;
    }

    completed.forEach(op => completeOperation(op));
    game.state.activeOps = game.state.activeOps.filter(op => !completed.find(done => done.id === op.id));
    refreshCrewStatus();
    saveState();
}

function startTicker() {
    if (game.tickHandle) {
        clearInterval(game.tickHandle);
    }

    game.tickHandle = setInterval(() => {
        const didComplete = processCompletedOps();
        renderStats();
        renderActiveOps();
        if (didComplete) {
            renderAll();
        }
    }, TICK_MS);
}

function processCompletedOps() {
    const now = Date.now();
    const remaining = [];
    let didComplete = false;

    game.state.activeOps.forEach(op => {
        if (op.finishTime <= now) {
            completeOperation(op);
            didComplete = true;
        } else {
            remaining.push(op);
        }
    });

    if (didComplete) {
        game.state.activeOps = remaining;
        refreshCrewStatus();
        saveState();
    }

    return didComplete;
}

function startCrime(crimeId) {
    const crime = game.data.crimes.find(entry => entry.id === crimeId);
    if (!crime) {
        return;
    }

    if (!isCrimeUnlocked(crime)) {
        addLog(`Locked crime: ${crime.name}`, 'warn');
        renderLog();
        return;
    }

    if (!canRepeat('crime', crime)) {
        addLog(`One-off already completed: ${crime.name}`, 'warn');
        renderLog();
        return;
    }

    if (!canAfford(crime.costs)) {
        addLog(`Not enough resources for ${crime.name}`, 'warn');
        renderLog();
        return;
    }

    const worker = findAvailableWorker(crime.requiresRole);
    if (!worker) {
        addLog(`No available crew for ${crime.name}`, 'warn');
        renderLog();
        return;
    }

    applyCosts(crime.costs);
    const durationMs = computeDurationMs(crime.durationMinutes, worker.speedMultiplier);
    const op = createOperation('crime', crime, worker, durationMs);

    game.state.activeOps.push(op);
    worker.status = 'busy';
    worker.activeOpId = op.id;

    addLog(`Started: ${crime.name}`, 'info');
    saveState();
    renderAll();
}

function startResearch(opId) {
    const op = game.index.researchById[opId];
    if (!op) {
        return;
    }

    if (!canRepeat('research', op)) {
        addLog(`Research already completed: ${op.name}`, 'warn');
        renderLog();
        return;
    }

    if (!canAfford(op.costs)) {
        addLog(`Not enough resources for ${op.name}`, 'warn');
        renderLog();
        return;
    }

    const worker = findAvailableWorker(null);
    if (!worker) {
        addLog(`No available crew for ${op.name}`, 'warn');
        renderLog();
        return;
    }

    applyCosts(op.costs);
    const durationMs = computeDurationMs(op.durationMinutes, worker.speedMultiplier);
    const operation = createOperation('research', op, worker, durationMs);

    game.state.activeOps.push(operation);
    worker.status = 'busy';
    worker.activeOpId = operation.id;

    addLog(`Research started: ${op.name}`, 'info');
    saveState();
    renderAll();
}

function hireRole(roleId) {
    const role = getRoleById(roleId, game.data.crew.roles);
    if (!role) {
        return;
    }

    if (!isRoleUnlocked(role)) {
        addLog(`Role locked: ${role.name}`, 'warn');
        renderLog();
        return;
    }

    const cost = role.hireCost || { cash: 0 };
    if (!canAfford(cost)) {
        addLog(`Not enough cash to hire ${role.name}`, 'warn');
        renderLog();
        return;
    }

    applyCosts(cost);

    const count = game.state.roster.filter(member => member.role === roleId).length;
    const name = `${role.name} #${count + 1}`;
    const member = {
        id: createId(roleId),
        name,
        role: roleId,
        speedMultiplier: Number.isFinite(role.baseSpeed) ? role.baseSpeed : 1,
        riskTolerance: Number.isFinite(role.riskTolerance) ? role.riskTolerance : 1,
        status: 'idle'
    };

    game.state.roster.push(member);
    addLog(`Hired: ${name}`, 'info');
    saveState();
    renderAll();
}

function completeOperation(op) {
    const worker = game.state.roster.find(member => member.id === op.assignedTo);
    if (worker) {
        worker.status = 'idle';
        worker.activeOpId = null;
    }

    if (op.kind === 'crime') {
        const crime = game.data.crimes.find(entry => entry.id === op.sourceId);
        if (!crime) {
            return;
        }

        applyRewards(crime.rewards);
        if (Number.isFinite(crime.heat)) {
            addResource('heat', crime.heat);
        }

        if (crime.repeatable === false) {
            markCompleted('crime', crime.id);
        }

        addLog(`Completed: ${crime.name}`, 'success');
        return;
    }

    if (op.kind === 'research') {
        const research = game.index.researchById[op.sourceId];
        if (!research) {
            return;
        }

        applyRewards(research.rewards);
        if (research.repeatable === false) {
            markCompleted('research', research.id);
        }

        addLog(`Research complete: ${research.name}`, 'success');
    }
}

function createOperation(kind, source, worker, durationMs) {
    const now = Date.now();
    return {
        id: createId(kind),
        kind,
        sourceId: source.id,
        name: source.name,
        startedAt: now,
        finishTime: now + durationMs,
        assignedTo: worker.id
    };
}

function computeDurationMs(durationMinutes, speedMultiplier) {
    const minutes = Number.isFinite(durationMinutes) ? durationMinutes : 1;
    const speed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
    return Math.max(5, Math.round((minutes * 60 * 1000) / speed));
}

function findAvailableWorker(requiredRole) {
    const roster = game.state.roster;
    const available = roster.filter(member => member.status !== 'busy');

    if (requiredRole) {
        return available.find(member => member.role === requiredRole) || null;
    }

    const player = available.find(member => member.id === 'player');
    if (player) {
        return player;
    }

    return available[0] || null;
}

function canAfford(costs) {
    if (!costs) {
        return true;
    }

    return Object.entries(costs).every(([key, value]) => {
        if (!Number.isFinite(value)) {
            return true;
        }
        return getResourceAmount(key) >= value;
    });
}

function applyCosts(costs) {
    if (!costs) {
        return;
    }

    Object.entries(costs).forEach(([key, value]) => {
        if (!Number.isFinite(value)) {
            return;
        }
        addResource(key, -value);
    });
}

function applyRewards(rewards) {
    if (!rewards) {
        return;
    }

    Object.entries(rewards).forEach(([key, value]) => {
        if (key === 'unlockNodes' && Array.isArray(value)) {
            unlockNodes(value);
            return;
        }

        if (key === 'items' && value && typeof value === 'object') {
            Object.entries(value).forEach(([itemId, amount]) => {
                if (Number.isFinite(amount)) {
                    addResource(itemId, amount);
                }
            });
            return;
        }

        if (Number.isFinite(value)) {
            addResource(key, value);
        }
    });
}

function addResource(key, amount) {
    if (key === 'cash' || key === 'heat') {
        game.state.resources[key] = (game.state.resources[key] || 0) + amount;
        return;
    }

    game.state.inventory[key] = (game.state.inventory[key] || 0) + amount;
    if (game.state.inventory[key] <= 0) {
        delete game.state.inventory[key];
    }
}

function getResourceAmount(key) {
    if (key === 'cash' || key === 'heat') {
        return game.state.resources[key] || 0;
    }

    return game.state.inventory[key] || 0;
}

function unlockNodes(nodeIds) {
    const unlocked = game.state.unlockedNodes;
    nodeIds.forEach(nodeId => {
        if (!unlocked.includes(nodeId)) {
            unlocked.push(nodeId);
            const node = game.index.nodesById[nodeId];
            if (node) {
                addLog(`Unlocked: ${node.name}`, 'success');
            }
        }
    });
}

function markCompleted(kind, id) {
    const key = `${kind}:${id}`;
    if (!game.state.completedOps.includes(key)) {
        game.state.completedOps.push(key);
    }
}

function canRepeat(kind, op) {
    if (op.repeatable === false) {
        const key = `${kind}:${op.id}`;
        return !game.state.completedOps.includes(key);
    }

    return true;
}

function isCrimeUnlocked(crime) {
    const unlockers = game.index.crimeUnlockers[crime.id] || [];
    if (unlockers.length === 0) {
        return true;
    }

    return unlockers.some(nodeId => game.state.unlockedNodes.includes(nodeId));
}

function isRoleUnlocked(role) {
    if (!role.unlock || role.unlock.type === 'start') {
        return true;
    }

    if (role.unlock.type === 'tech') {
        return game.state.unlockedNodes.includes(role.unlock.id);
    }

    return false;
}

function getRoleById(roleId, roles) {
    const list = Array.isArray(roles) ? roles : [];
    return list.find(role => role.id === roleId) || null;
}

function addLog(text, kind) {
    game.state.log.push({
        id: createId('log'),
        time: Date.now(),
        text,
        kind: kind || 'info'
    });

    if (game.state.log.length > 200) {
        game.state.log = game.state.log.slice(-200);
    }
}

function renderAll() {
    renderStats();
    renderCrimes();
    renderActiveOps();
    renderRoster();
    renderRoles();
    renderResearchOps();
    renderTechNodes();
    renderEconomy();
    renderInventory();
    renderLog();
}

function renderStats() {
    const cash = document.getElementById('stat-cash');
    const heat = document.getElementById('stat-heat');
    const active = document.getElementById('stat-active');
    const time = document.getElementById('stat-time');

    if (cash) {
        cash.textContent = formatNumber(game.state.resources.cash);
    }
    if (heat) {
        heat.textContent = formatNumber(game.state.resources.heat);
    }
    if (active) {
        active.textContent = String(game.state.activeOps.length);
    }
    if (time) {
        time.textContent = formatClock(new Date());
    }
}

function renderCrimes() {
    const containers = document.querySelectorAll('[data-list="crimes"]');
    containers.forEach(container => {
        container.innerHTML = '';

        if (game.data.crimes.length === 0) {
            container.textContent = 'No crimes available.';
            return;
        }

        game.data.crimes.forEach(crime => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = crime.name;

            const meta = document.createElement('div');
            meta.className = 'row-meta';

            const parts = [];
            parts.push(crime.tier ? crime.tier.toUpperCase() : 'MISC');
            parts.push(`${formatNumber(crime.durationMinutes)}m`);
            parts.push(`$${formatNumber(crime.rewards && crime.rewards.cash ? crime.rewards.cash : 0)}`);
            parts.push(`Heat ${formatNumber(crime.heat || 0)}`);
            if (crime.requiresRole) {
                parts.push(`Role ${crime.requiresRole}`);
            } else {
                parts.push('Solo or crew');
            }
            if (crime.repeatable === false) {
                parts.push('ONE-OFF');
            }

            if (crime.costs && Object.keys(crime.costs).length > 0) {
                parts.push(`Cost ${formatCosts(crime.costs)}`);
            }

            const unlocked = isCrimeUnlocked(crime);
            if (!unlocked) {
                const reason = getCrimeUnlockLabel(crime);
                parts.push(`Locked: ${reason}`);
            }

            meta.textContent = parts.join(' | ');

            main.appendChild(title);
            main.appendChild(meta);

            if (crime.story) {
                const story = document.createElement('div');
                story.className = 'row-story';
                story.textContent = crime.story;
                main.appendChild(story);
            }

            const actions = document.createElement('div');
            const button = document.createElement('button');
            button.className = 'action';
            button.dataset.action = 'start-crime';
            button.dataset.id = crime.id;
            button.textContent = 'Start';

            const canStart = unlocked && canRepeat('crime', crime) && hasAvailableWorker(crime.requiresRole);
            button.disabled = !canStart;

            actions.appendChild(button);

            row.appendChild(main);
            row.appendChild(actions);
            container.appendChild(row);
        });
    });
}

function renderActiveOps() {
    const containers = document.querySelectorAll('[data-list="active-ops"]');
    containers.forEach(container => {
        container.innerHTML = '';

        if (game.state.activeOps.length === 0) {
            container.textContent = 'No active operations.';
            return;
        }

        const now = Date.now();
        game.state.activeOps.forEach(op => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = op.name;

            const assigned = game.state.roster.find(member => member.id === op.assignedTo);
            const assignedName = assigned ? assigned.name : 'Unknown';

            const remainingMs = Math.max(0, op.finishTime - now);
            const totalMs = Math.max(1, op.finishTime - op.startedAt);
            const progress = Math.min(1, Math.max(0, 1 - remainingMs / totalMs));

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            meta.textContent = `Assigned: ${assignedName} | Remaining: ${formatDuration(remainingMs)}`;

            const bar = document.createElement('div');
            bar.className = 'row-bar';
            bar.textContent = buildBar(progress, 12);

            main.appendChild(title);
            main.appendChild(meta);
            main.appendChild(bar);

            row.appendChild(main);
            container.appendChild(row);
        });
    });
}

function renderRoster() {
    const containers = document.querySelectorAll('[data-list="henchmen"]');
    containers.forEach(container => {
        container.innerHTML = '';

        if (game.state.roster.length === 0) {
            container.textContent = 'No crew available.';
            return;
        }

        game.state.roster.forEach(member => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = `${member.name} (${member.role})`;

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            meta.textContent = `Status ${member.status} | Speed ${member.speedMultiplier}x | Risk ${member.riskTolerance}x`;

            main.appendChild(title);
            main.appendChild(meta);

            row.appendChild(main);
            container.appendChild(row);
        });
    });
}

function renderRoles() {
    const containers = document.querySelectorAll('[data-list="recruitment"]');
    containers.forEach(container => {
        container.innerHTML = '';

        const roles = Array.isArray(game.data.crew.roles) ? game.data.crew.roles : [];
        if (roles.length === 0) {
            container.textContent = 'No roles available.';
            return;
        }

        roles.forEach(role => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = role.name;

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            const hire = role.hireCost && Number.isFinite(role.hireCost.cash) ? `$${role.hireCost.cash}` : '$0';
            const unlockLabel = role.unlock && role.unlock.label ? role.unlock.label : 'Available';
            meta.textContent = `${role.summary || 'Crew specialist.'} | Hire ${hire} | Speed ${role.baseSpeed}x | Unlock: ${unlockLabel}`;

            main.appendChild(title);
            main.appendChild(meta);

            const actions = document.createElement('div');
            const button = document.createElement('button');
            button.className = 'action';
            button.dataset.action = 'hire-role';
            button.dataset.id = role.id;
            button.textContent = 'Hire';

            const canHire = isRoleUnlocked(role) && canAfford(role.hireCost || { cash: 0 });
            button.disabled = !canHire;

            actions.appendChild(button);

            row.appendChild(main);
            row.appendChild(actions);
            container.appendChild(row);
        });
    });
}

function renderResearchOps() {
    const containers = document.querySelectorAll('[data-list="research-ops"]');
    containers.forEach(container => {
        container.innerHTML = '';

        const ops = Array.isArray(game.data.tech.researchOps) ? game.data.tech.researchOps : [];
        if (ops.length === 0) {
            container.textContent = 'No research available.';
            return;
        }

        ops.forEach(op => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = op.name;

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            const costLabel = formatCosts(op.costs);
            meta.textContent = `${formatNumber(op.durationMinutes)}m | Cost ${costLabel}`;

            const story = document.createElement('div');
            story.className = 'row-story';
            story.textContent = op.story || '';

            main.appendChild(title);
            main.appendChild(meta);
            if (op.story) {
                main.appendChild(story);
            }

            const actions = document.createElement('div');
            const button = document.createElement('button');
            button.className = 'action';
            button.dataset.action = 'start-research';
            button.dataset.id = op.id;
            button.textContent = 'Run';

            const canStart = canRepeat('research', op) && canAfford(op.costs) && hasAvailableWorker(null);
            button.disabled = !canStart;

            actions.appendChild(button);

            row.appendChild(main);
            row.appendChild(actions);
            container.appendChild(row);
        });
    });
}

function renderTechNodes() {
    const containers = document.querySelectorAll('[data-list="tech-nodes"]');
    containers.forEach(container => {
        container.innerHTML = '';

        const nodes = Array.isArray(game.data.tech.nodes) ? game.data.tech.nodes : [];
        if (nodes.length === 0) {
            container.textContent = 'No tech nodes found.';
            return;
        }

        nodes.forEach(node => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            const unlocked = game.state.unlockedNodes.includes(node.id);
            title.textContent = `${unlocked ? '[x]' : '[ ]'} ${node.name}`;

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            const requires = node.requires && node.requires.length
                ? node.requires.map(id => getNodeName(id)).join(', ')
                : 'none';
            const unlocks = formatUnlocks(node.unlocks);
            meta.textContent = `Requires: ${requires} | Unlocks: ${unlocks}`;

            const story = document.createElement('div');
            story.className = 'row-story';
            story.textContent = node.story || '';

            main.appendChild(title);
            main.appendChild(meta);
            if (node.story) {
                main.appendChild(story);
            }

            row.appendChild(main);
            container.appendChild(row);
        });
    });
}

function renderEconomy() {
    const containers = document.querySelectorAll('[data-list="economy"]');
    containers.forEach(container => {
        container.innerHTML = '';

        const entries = [];
        entries.push({ label: 'Cash', value: `$${formatNumber(game.state.resources.cash)}` });
        entries.push({ label: 'Heat', value: formatNumber(game.state.resources.heat) });
        const crewCount = game.state.roster.filter(member => member.id !== 'player').length;
        const idleCount = game.state.roster.filter(member => member.status !== 'busy').length;
        entries.push({ label: 'Crew', value: `${crewCount} (${idleCount} idle)` });
        entries.push({ label: 'Active Ops', value: String(game.state.activeOps.length) });
        entries.push({ label: 'Unlocked Nodes', value: String(game.state.unlockedNodes.length) });

        entries.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = entry.label;

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            meta.textContent = entry.value;

            main.appendChild(title);
            main.appendChild(meta);
            row.appendChild(main);
            container.appendChild(row);
        });
    });
}

function renderInventory() {
    const containers = document.querySelectorAll('[data-list="inventory"]');
    containers.forEach(container => {
        container.innerHTML = '';

        const items = Object.entries(game.state.inventory);
        if (items.length === 0) {
            container.textContent = 'Inventory empty.';
            return;
        }

        items.forEach(([itemId, amount]) => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = itemId.replace(/_/g, ' ');

            const meta = document.createElement('div');
            meta.className = 'row-meta';
            meta.textContent = `x${formatNumber(amount)}`;

            main.appendChild(title);
            main.appendChild(meta);
            row.appendChild(main);
            container.appendChild(row);
        });
    });
}

function renderLog() {
    const containers = document.querySelectorAll('[data-list="log-entries"]');
    containers.forEach(container => {
        container.innerHTML = '';

        if (game.state.log.length === 0) {
            container.textContent = 'No events yet.';
            return;
        }

        const limit = Number(container.dataset.limit) || game.state.log.length;
        const entries = game.state.log.slice(-limit).reverse();

        entries.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'list-row';

            const main = document.createElement('div');
            main.className = 'row-main';

            const title = document.createElement('div');
            title.className = 'row-title';
            title.textContent = `[${formatClock(new Date(entry.time))}] ${entry.text}`;

            main.appendChild(title);
            row.appendChild(main);
            container.appendChild(row);
        });
    });
}

function showLoadError() {
    const containers = document.querySelectorAll('[data-list]');
    containers.forEach(container => {
        container.textContent = 'Failed to load game data.';
    });
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatClock(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-US');
}

function buildBar(progress, length) {
    const clamped = Math.max(0, Math.min(1, progress));
    const filled = Math.round(clamped * length);
    const empty = Math.max(0, length - filled);
    return `[${'='.repeat(filled)}${'-'.repeat(empty)}]`;
}

function hasAvailableWorker(requiredRole) {
    return Boolean(findAvailableWorker(requiredRole));
}

function getCrimeUnlockLabel(crime) {
    const unlockers = game.index.crimeUnlockers[crime.id] || [];
    if (unlockers.length === 0) {
        return 'unknown';
    }

    return unlockers.map(id => getNodeName(id)).join(', ');
}

function getNodeName(nodeId) {
    const node = game.index.nodesById[nodeId];
    return node ? node.name : nodeId;
}

function formatUnlocks(unlocks) {
    if (!unlocks) {
        return 'none';
    }

    const parts = [];
    if (Array.isArray(unlocks.crimes) && unlocks.crimes.length) {
        const crimeNames = unlocks.crimes.map(id => getCrimeName(id));
        parts.push(`crimes: ${crimeNames.join(', ')}`);
    }
    if (Array.isArray(unlocks.roles) && unlocks.roles.length) {
        const roleNames = unlocks.roles.map(id => getRoleName(id));
        parts.push(`roles: ${roleNames.join(', ')}`);
    }

    return parts.length ? parts.join(' | ') : 'none';
}

function getCrimeName(crimeId) {
    const crime = game.data.crimes.find(entry => entry.id === crimeId);
    return crime ? crime.name : crimeId;
}

function getRoleName(roleId) {
    const role = getRoleById(roleId, game.data.crew.roles);
    return role ? role.name : roleId;
}

function formatCosts(costs) {
    if (!costs) {
        return 'free';
    }

    const parts = [];
    Object.entries(costs).forEach(([key, value]) => {
        if (!Number.isFinite(value)) {
            return;
        }
        if (key === 'cash') {
            parts.push(`$${formatNumber(value)}`);
            return;
        }
        parts.push(`${formatNumber(value)} ${key}`);
    });

    return parts.length ? parts.join(', ') : 'free';
}

function createId(prefix) {
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix || 'id'}_${Date.now()}_${random}`;
}
