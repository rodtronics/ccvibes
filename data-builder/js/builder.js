let variantUid = 1;
let notes = { problems: '', solutions: '' };
const state = createScenario();
const fileState = { scenarios: [], selectedId: '', lastSavedState: null, loaded: false };
let serverOnline = false;
const HUB_FILE = 'scenarios.json';

document.addEventListener('DOMContentLoaded', () => {
  wireMetaInputs();
  wireNotes();
  renderScenarioConditions();
  renderScenarioReveals();
  renderVariants();
  refreshOutputs();
  initFileControls();
  checkServerStatus();
  wireKeyboardShortcuts();
  wireHubEvents();
});

function createScenario() {
  return {
    id: '',
    name: '',
    description: '',
    branchId: 'street',
    icon: '',
    tags: '',
    visibleIf: [],
    unlockIf: [],
    reveals: { onReveal: [], onUnlock: [] },
    variants: [createVariant()]
  };
}

function createVariant() {
  return {
    uid: variantUid++,
    variantId: '',
    name: '',
    description: '',
    repeatable: false,
    maxConcurrentRuns: '',
    visibleIf: [],
    unlockIf: [],
    requirements: {
      staff: [{ roleId: 'player', count: 1, starsMin: 0, required: true, bonus: '' }],
      items: [],
      buildings: []
    },
    inputs: { resources: [], items: [] },
    durationMs: 10000,
    xp: 5,
    cooldownMs: 0,
    resolution: createResolution('weighted_outcomes'),
    modifiersText: ''
  };
}

function createResolution(type) {
  const res = {
    type,
    outputs: { resources: [], items: [] },
    credDelta: { min: '', max: '' },
    heatDelta: { min: '', max: '' },
    effects: [],
    outcomes: []
  };

  if (type === 'weighted_outcomes') {
    res.outcomes = [createOutcome('success', 70), createOutcome('caught', 30)];
  }

  return res;
}

function createOutcome(id = 'outcome', weight = 50) {
  return {
    id,
    weight,
    outputs: { resources: [], items: [] },
    credDelta: { min: '', max: '' },
    heatDelta: { min: '', max: '' },
    jailMs: '',
    effects: []
  };
}

function defaultCondition() {
  return {
    type: 'resourceGte',
    resourceId: '',
    itemId: '',
    roleId: '',
    scenarioId: '',
    key: '',
    value: 0,
    bool: true
  };
}

function defaultEffect() {
  return {
    type: 'revealScenario',
    scenarioId: '',
    branchId: '',
    resourceId: '',
    roleId: '',
    tabId: '',
    key: '',
    value: '',
    text: '',
    kind: ''
  };
}

function wireMetaInputs() {
  const mapping = {
    scenarioId: 'id',
    scenarioName: 'name',
    scenarioDescription: 'description',
    branchId: 'branchId',
    icon: 'icon',
    tags: 'tags'
  };

  Object.entries(mapping).forEach(([inputId, field]) => {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', (ev) => {
      state[field] = ev.target.value;
      refreshOutputs();
    });
  });
}

function wireNotes() {
  const problems = document.getElementById('problemsNote');
  const solutions = document.getElementById('solutionsNote');
  if (problems) {
    problems.addEventListener('input', (ev) => {
      notes.problems = ev.target.value;
      renderSummary();
    });
  }
  if (solutions) {
    solutions.addEventListener('input', (ev) => {
      notes.solutions = ev.target.value;
      renderSummary();
    });
  }
}

function refreshOutputs() {
  renderJson();
  renderSummary();
  renderDataTree();
  updateSaveIndicator();
  syncHubStatus();
}

function initFileControls() {
  renderScenarioSelect();
  setFileStatus('Connect to the local builder server to enable save/load.', 'muted');
  if (!isServerContext()) return;
  refreshFileData();
}

async function checkServerStatus() {
  if (!isServerContext()) {
    serverOnline = false;
    updateServerIndicator();
    return;
  }

  try {
    const res = await fetch('/api/health');
    serverOnline = res.ok;
  } catch (err) {
    serverOnline = false;
  }
  updateServerIndicator();
}

function updateServerIndicator() {
  const statusEl = document.getElementById('serverStatus');
  if (!statusEl) return;

  if (serverOnline) {
    statusEl.textContent = '● Online';
    statusEl.style.color = '#34d399';
  } else {
    statusEl.textContent = '● Offline';
    statusEl.style.color = '#f87171';
  }
}

function updateSaveIndicator() {
  const indicator = document.getElementById('saveIndicator');
  if (!indicator) return;

  const hasChanges = checkForUnsavedChanges();
  if (hasChanges) {
    indicator.textContent = '● Unsaved changes';
    indicator.style.color = '#fbbf24';
    indicator.style.display = 'inline';
  } else {
    indicator.style.display = 'none';
  }
}

function checkForUnsavedChanges() {
  if (!state.id) return false;

  if (fileState.lastSavedState && state.id === fileState.selectedId) {
    const current = JSON.stringify(buildScenarioJson());
    const saved = JSON.stringify(fileState.lastSavedState);
    return current !== saved;
  }

  return true;
}

function buildDraftActivitiesPayload() {
  if (!fileState.loaded) return null;
  if (!Array.isArray(fileState.scenarios)) return null;
  const scenario = buildScenarioJson();
  if (!scenario.id) return null;

  const existingIndex = fileState.scenarios.findIndex((act) => act.id === scenario.id);
  const nextActivities = fileState.scenarios.slice();
  if (existingIndex >= 0) nextActivities[existingIndex] = scenario;
  else nextActivities.push(scenario);
  return nextActivities;
}

function syncHubStatus() {
  const hub = window.CcvibesHubStorage;
  if (!hub) return;

  const dirty = checkForUnsavedChanges();
  const modifiedCount = dirty ? 1 : 0;
  hub.setStatus(HUB_FILE, { dirty, modifiedCount, updatedAt: Date.now() });

  if (!dirty) {
    hub.clearDraft(HUB_FILE);
    return;
  }

  const draft = buildDraftActivitiesPayload();
  if (draft) hub.setDraft(HUB_FILE, draft);
}

function wireHubEvents() {
  const hub = window.CcvibesHubStorage;
  if (!hub) return;

  async function handleExternalSave() {
    await refreshFileData();

    const currentId = state.id;
    if (currentId) {
      const found = fileState.scenarios.find((act) => act.id === currentId);
      if (found) {
        fileState.selectedId = currentId;
        fileState.lastSavedState = JSON.parse(JSON.stringify(found));
      }
    }

    updateSaveIndicator();
    syncHubStatus();
    setFileStatus('Saved externally. Reloaded file cache.', 'success');
  }

  window.addEventListener('storage', (e) => {
    if (e.key === hub.savedKey(HUB_FILE)) {
      void handleExternalSave();
    }
  });
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveScenarioToFile();
    }
    // Ctrl+N or Cmd+N: New
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      startNewScenario();
    }
    // Ctrl+D or Cmd+D: Duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      duplicateScenario();
    }
  });
}

function isServerContext() {
  return location.protocol === 'http:' || location.protocol === 'https:';
}

function setFileStatus(message, kind) {
  const el = document.getElementById('fileStatus');
  if (!el) return;
  el.textContent = message;

  if (kind === 'error') el.style.color = '#f87171';
  else if (kind === 'success') el.style.color = '#34d399';
  else el.style.color = '';
}

function renderScenarioSelect(selectedId = '') {
  const select = document.getElementById('scenarioSelect');
  if (!select) return;

  const current = selectedId || fileState.selectedId || select.value;
  const variants = [
    { value: '', label: 'Select a scenario' },
    ...fileState.scenarios
      .slice()
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
      .map((scenario) => ({
        value: scenario.id || '',
        label: `${scenario.id || 'untitled'}${scenario.name ? ` - ${scenario.name}` : ''}`
      }))
  ];

  select.innerHTML = variants
    .map(opt => `<option value="${safe(opt.value)}">${safe(opt.label)}</option>`)
    .join('');
  select.value = current;
  fileState.selectedId = select.value;
}

function loadActivityById(scenarioId) {
  if (!scenarioId) return;
  if ((state.id || '').trim() === scenarioId) return;

  const select = document.getElementById('scenarioSelect');
  if (select) select.value = scenarioId;
  loadSelectedScenario();
}

function renderDataTree(filterText = '') {
  const container = document.getElementById('dataTree');
  if (!container) return;

  let scenarios = getWorkingActivities();
  if (!scenarios.length) {
    container.innerHTML = '<div class="tree-empty">No scenario data loaded.</div>';
    return;
  }

  // Apply filter
  if (filterText) {
    const search = filterText.toLowerCase();
    scenarios = scenarios.filter(act => {
      const matchId = (act.id || '').toLowerCase().includes(search);
      const matchName = (act.name || '').toLowerCase().includes(search);
      const matchBranch = (act.branchId || '').toLowerCase().includes(search);
      return matchId || matchName || matchBranch;
    });
  }

  if (!scenarios.length) {
    container.innerHTML = '<div class="tree-empty">No scenarios match the filter.</div>';
    return;
  }

  const grouped = groupActivitiesByBranch(scenarios);
  const branchBlocks = grouped.map(({ branchId, scenarios: branchScenarios }) => {
    const items = branchScenarios.map(renderScenarioTreeItem).join('');
    return `
      <div class="tree-group">
        <div class="tree-branch">${safe(branchId)}</div>
        <div class="tree-list">${items}</div>
      </div>
    `;
  });

  container.innerHTML = branchBlocks.join('');
}

function filterDataTree(text) {
  renderDataTree(text);
}

function getWorkingActivities() {
  const list = Array.isArray(fileState.scenarios) ? fileState.scenarios.slice() : [];
  const draft = getDraftScenario();
  if (draft) {
    const idx = list.findIndex((act) => act.id === draft.id);
    if (idx >= 0) list[idx] = draft;
    else list.push(draft);
  }
  return list;
}

function getDraftScenario() {
  const id = (state.id || '').trim();
  if (!id) return null;
  return buildScenarioJson();
}

function groupActivitiesByBranch(scenarios) {
  const map = new Map();
  scenarios.forEach((scenario) => {
    const branchId = scenario.branchId || 'unassigned';
    if (!map.has(branchId)) map.set(branchId, []);
    map.get(branchId).push(scenario);
  });

  return Array.from(map.entries())
    .map(([branchId, list]) => ({
      branchId,
      scenarios: list.slice().sort((a, b) => (a.id || '').localeCompare(b.id || ''))
    }))
    .sort((a, b) => a.branchId.localeCompare(b.branchId));
}

function renderScenarioTreeItem(scenario) {
  const scenarioId = scenario.id || 'untitled';
  const name = scenario.name || '';
  const isSelected = (state.id || '').trim() === scenarioId;
  const visibleCount = (scenario.visibleIf || []).length;
  const unlockCount = (scenario.unlockIf || []).length;

  const badges = renderGateBadges(visibleCount, unlockCount);
  const conditions = [
    formatConditionList('visible', scenario.visibleIf),
    formatConditionList('unlock', scenario.unlockIf)
  ].filter(Boolean);
  const conditionLine = conditions.length ? `<div class="tree-meta">${safe(conditions.join(' | '))}</div>` : '';

  const links = formatEffectLinks(scenario);
  const linkLine = links ? `<div class="tree-meta">${safe(links)}</div>` : '';

  const variants = (scenario.variants || []).map(renderOptionTreeItem).join('');
  const optionsLine = variants ? `<div class="tree-variants">${variants}</div>` : '';

  return `
    <div class="tree-scenario ${isSelected ? 'selected' : ''}">
      <div class="tree-row">
        <button class="tree-link" onclick="loadActivityById('${safe(scenarioId)}')">${safe(scenarioId)}</button>
        ${name ? `<span class="muted">${safe(name)}</span>` : ''}
        ${badges}
      </div>
      ${conditionLine}
      ${linkLine}
      ${optionsLine}
    </div>
  `;
}

function renderOptionTreeItem(variant) {
  const variantId = variant.id || 'variant';
  const name = variant.name || '';
  const visibleCount = (variant.visibleIf || []).length;
  const unlockCount = (variant.unlockIf || []).length;
  const badges = renderGateBadges(visibleCount, unlockCount);

  const conditions = [
    formatConditionList('visible', variant.visibleIf),
    formatConditionList('unlock', variant.unlockIf)
  ].filter(Boolean);
  const conditionLine = conditions.length ? `<div class="tree-meta">${safe(conditions.join(' | '))}</div>` : '';

  return `
    <div class="tree-variant">
      <div class="tree-row">
        <span>${safe(variantId)}</span>
        ${name ? `<span class="muted">${safe(name)}</span>` : ''}
        ${badges}
      </div>
      ${conditionLine}
    </div>
  `;
}

function renderGateBadges(visibleCount, unlockCount) {
  const badges = [];
  if (visibleCount) badges.push(`<span class="tree-badge">V:${visibleCount}</span>`);
  if (unlockCount) badges.push(`<span class="tree-badge">U:${unlockCount}</span>`);
  return badges.join('');
}

function formatConditionList(label, list) {
  if (!list || !list.length) return '';
  const formatted = summarizeList(list.map(formatCondition), 3);
  if (!formatted) return '';
  return `${label}: ${formatted}`;
}

function formatCondition(cond) {
  if (!cond || !cond.type) return 'unknown';
  if (cond.type === 'resourceGte') {
    return `resourceGte:${cond.resourceId || 'resource'}>=${formatValue(cond.value)}`;
  }
  if (cond.type === 'itemGte') {
    return `itemGte:${cond.itemId || 'item'}>=${formatValue(cond.value)}`;
  }
  if (cond.type === 'flagIs') {
    const value = cond.value !== undefined ? cond.value : cond.bool;
    return `flagIs:${cond.key || 'flag'}=${value === undefined ? 'true' : value}`;
  }
  if (cond.type === 'roleRevealed') {
    return `roleRevealed:${cond.roleId || 'role'}`;
  }
  if (cond.type === 'scenarioRevealed') {
    return `activityRevealed:${cond.scenarioId || 'scenario'}`;
  }
  return cond.type;
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '?';
  return value;
}

function summarizeList(items, limit = 3) {
  const cleaned = items.filter(Boolean);
  if (!cleaned.length) return '';
  if (cleaned.length <= limit) return cleaned.join(', ');
  return `${cleaned.slice(0, limit).join(', ')} +${cleaned.length - limit}`;
}

function formatEffectLinks(scenario) {
  const links = collectActivityEffectLinks(scenario);
  const parts = [];
  if (links.reveals.length) parts.push(`reveals: ${summarizeList(links.reveals, 3)}`);
  if (links.unlocks.length) parts.push(`unlocks: ${summarizeList(links.unlocks, 3)}`);
  return parts.join(' | ');
}

function collectActivityEffectLinks(scenario) {
  const reveals = new Set();
  const unlocks = new Set();

  const addEffect = (effect) => {
    if (!effect || !effect.type) return;
    if (effect.type === 'revealScenario' && effect.scenarioId) reveals.add(effect.scenarioId);
    if (effect.type === 'unlockScenario' && effect.scenarioId) unlocks.add(effect.scenarioId);
  };

  (scenario.reveals?.onReveal || []).forEach(addEffect);
  (scenario.reveals?.onUnlock || []).forEach(addEffect);

  (scenario.variants || []).forEach((variant) => {
    const resolution = variant.resolution || {};
    (resolution.effects || []).forEach(addEffect);
    (resolution.outcomes || []).forEach((outcome) => {
      (outcome.effects || []).forEach(addEffect);
    });
  });

  return {
    reveals: Array.from(reveals).sort(),
    unlocks: Array.from(unlocks).sort()
  };
}

async function refreshFileData() {
  if (!isServerContext()) {
    setFileStatus('Open this page from the builder server to use save/load.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/data/scenarios.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Expected an array of scenarios');

    fileState.scenarios = data;
    fileState.loaded = true;
    renderScenarioSelect();
    renderDataTree();
    setFileStatus(`Loaded ${data.length} scenarios.`, 'success');
    syncHubStatus();
  } catch (err) {
    setFileStatus(`Failed to load scenarios.json: ${err.message}`, 'error');
  }
}

function loadSelectedScenario() {
  const select = document.getElementById('scenarioSelect');
  if (!select) return;
  const selectedId = select.value;
  if (!selectedId) {
    setFileStatus('Pick an scenario to load.', 'error');
    return;
  }

  const scenario = fileState.scenarios.find((scn) => scn.id === selectedId);
  if (!scenario) {
    setFileStatus('Scenario not found in file cache.', 'error');
    return;
  }

  applyScenarioData(scenario);
  fileState.selectedId = selectedId;
  fileState.lastSavedState = JSON.parse(JSON.stringify(scenario));
  setFileStatus(`Loaded ${selectedId}.`, 'success');
}

function startNewScenario() {
  clearBuilder();
  fileState.selectedId = '';
  fileState.lastSavedState = null;
  renderScenarioSelect();
  setFileStatus('New scenario started.', 'success');
}

async function saveScenarioToFile() {
  if (!isServerContext()) {
    setFileStatus('Open this page from the builder server to use save/load.', 'error');
    return;
  }

  const scenario = buildScenarioJson();
  if (!scenario.id) {
    setFileStatus('Scenario ID is required before saving.', 'error');
    return;
  }

  // Validate before saving
  const validation = validateActivity(scenario);
  if (!validation.valid) {
    setFileStatus(`Validation failed: ${validation.errors.join(', ')}`, 'error');
    return;
  }

  const existingIndex = fileState.scenarios.findIndex((act) => act.id === scenario.id);
  const nextActivities = fileState.scenarios.slice();
  if (existingIndex >= 0) nextActivities[existingIndex] = scenario;
  else nextActivities.push(scenario);

  try {
    const res = await fetch('/api/data/scenarios.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextActivities)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    fileState.scenarios = nextActivities;
    fileState.selectedId = scenario.id;
    fileState.lastSavedState = JSON.parse(JSON.stringify(scenario));
    renderScenarioSelect(scenario.id);
    renderDataTree();
    updateSaveIndicator();
    syncHubStatus();
    window.CcvibesHubStorage?.broadcastSaved(HUB_FILE);
    setFileStatus(existingIndex >= 0 ? `Updated ${scenario.id}.` : `Saved ${scenario.id}.`, 'success');
  } catch (err) {
    setFileStatus(`Failed to save scenarios.json: ${err.message}`, 'error');
  }
}

function validateActivity(scenario) {
  const errors = [];

  if (!scenario.id || !scenario.id.trim()) {
    errors.push('Scenario ID is required');
  }

  if (!scenario.name || !scenario.name.trim()) {
    errors.push('Scenario name is required');
  }

  // Check for duplicate variant IDs
  const variantIds = new Set();
  scenario.variants.forEach((opt, idx) => {
    if (!opt.id || !opt.id.trim()) {
      errors.push(`Variant ${idx + 1} has no ID`);
    } else if (variantIds.has(opt.id)) {
      errors.push(`Duplicate variant ID: ${opt.id}`);
    } else {
      variantIds.add(opt.id);
    }

    // Check staff requirements
    if (!opt.requirements.staff.length) {
      errors.push(`Variant ${opt.id || idx + 1} has no staff requirements`);
    }

    // Check weighted outcomes sum
    if (opt.resolution.type === 'weighted_outcomes') {
      const totalWeight = opt.resolution.outcomes.reduce((sum, out) => sum + (out.weight || 0), 0);
      if (totalWeight === 0) {
        errors.push(`Variant ${opt.id || idx + 1} has outcomes with zero total weight`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function duplicateScenario() {
  if (!state.id) {
    setFileStatus('Load an scenario first before duplicating.', 'error');
    return;
  }

  const currentId = state.id;
  const baseName = currentId.replace(/_copy\d*$/, '');

  // Find next available copy number
  let copyNum = 1;
  let newId = `${baseName}_copy`;
  while (fileState.scenarios.some(act => act.id === newId)) {
    copyNum++;
    newId = `${baseName}_copy${copyNum}`;
  }

  state.id = newId;
  state.name = `${state.name} (copy)`;
  fileState.selectedId = '';
  fileState.lastSavedState = null;

  // Update variant IDs to match new scenario ID
  state.variants.forEach((variant, idx) => {
    const oldVariantId = variant.variantId || '';
    if (oldVariantId.startsWith(currentId)) {
      variant.variantId = oldVariantId.replace(currentId, newId);
    } else {
      variant.variantId = `${newId}_variant_${idx + 1}`;
    }
  });

  document.getElementById('scenarioId').value = state.id;
  document.getElementById('scenarioName').value = state.name;

  renderVariants();
  refreshOutputs();
  renderScenarioSelect();
  setFileStatus(`Duplicated as ${newId}. Remember to save!`, 'success');
}

function safe(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderScenarioConditions() {
  const visible = document.getElementById('scenarioVisibleIf');
  const unlock = document.getElementById('scenarioUnlockIf');
  if (visible) visible.innerHTML = renderConditionList(state.visibleIf, 'scenario|visibleIf');
  if (unlock) unlock.innerHTML = renderConditionList(state.unlockIf, 'scenario|unlockIf');
}

function renderScenarioReveals() {
  const onReveal = document.getElementById('scenarioOnReveal');
  const onUnlock = document.getElementById('scenarioOnUnlock');
  if (onReveal) onReveal.innerHTML = renderEffectList(state.reveals.onReveal, 'scenario|onReveal');
  if (onUnlock) onUnlock.innerHTML = renderEffectList(state.reveals.onUnlock, 'scenario|onUnlock');
}

function renderVariants() {
  const container = document.getElementById('variantsList');
  if (!container) return;
  container.innerHTML = state.variants.map((variant, idx) => renderVariantCard(opt, idx)).join('');
  refreshOutputs();
}

function renderVariantCard(variant, idx) {
  return `
    <div class="variant-card">
      <div class="variant-head">
        <div class="flex">
          <div class="badge">Variant ${idx + 1}</div>
          <div class="muted">${variant.variantId || 'no id yet'}</div>
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Repeatable?</label>
          <input type="checkbox" ${variant.repeatable ? 'checked' : ''} onchange="updateVariantField(${variant.uid}, 'repeatable', this.checked)">
          <button class="ghost small" onclick="removeVariant(${variant.uid})">remove</button>
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <label>Variant ID</label>
          <input type="text" value="${safe(variant.variantId)}" placeholder="shoplifting_grab" oninput="updateVariantField(${variant.uid}, 'variantId', this.value)">
        </div>
        <div>
          <label>Name</label>
          <input type="text" value="${safe(variant.name)}" placeholder="grab and go" oninput="updateVariantField(${variant.uid}, 'name', this.value)">
        </div>
        <div>
          <label>Description</label>
          <textarea oninput="updateVariantField(${variant.uid}, 'description', this.value)" placeholder="what is the vibe?">${safe(variant.description)}</textarea>
        </div>
        <div class="input-grid">
          <label>Duration (ms)</label>
          <input type="number" value="${safe(variant.durationMs)}" oninput="updateVariantField(${variant.uid}, 'durationMs', parseInt(this.value, 10) || 0)">
          <label>XP on Complete</label>
          <input type="number" value="${safe(variant.xp)}" oninput="updateVariantField(${variant.uid}, 'xp', parseInt(this.value, 10) || 0)">
          <label>Cooldown (ms)</label>
          <input type="number" value="${safe(variant.cooldownMs)}" oninput="updateVariantField(${variant.uid}, 'cooldownMs', parseInt(this.value, 10) || 0)">
          <label>Max Concurrent Runs (optional)</label>
          <input type="number" value="${safe(variant.maxConcurrentRuns)}" oninput="updateVariantField(${variant.uid}, 'maxConcurrentRuns', this.value)">
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <div class="subheader">
            <span>Visible If</span>
            <button class="ghost small" onclick="addCondition('variant|${variant.uid}|visibleIf')">+ condition</button>
          </div>
          ${renderConditionList(variant.visibleIf, 'variant|' + variant.uid + '|visibleIf')}
        </div>
        <div>
          <div class="subheader">
            <span>Unlock If</span>
            <button class="ghost small" onclick="addCondition('variant|${variant.uid}|unlockIf')">+ condition</button>
          </div>
          ${renderConditionList(variant.unlockIf, 'variant|' + variant.uid + '|unlockIf')}
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <div class="subheader">
            <span>Staff Requirements</span>
            <button class="ghost small" onclick="addStaffRequirement(${variant.uid})">+ staff</button>
          </div>
          ${renderStaffRequirements(variant)}
        </div>
        <div>
          <div class="subheader">
            <span>Inputs & Costs</span>
            <span class="muted" style="font-size:0.85rem">resources + items consumed</span>
          </div>
          <div>
            <div class="muted" style="margin-bottom:6px">Resources</div>
            ${renderKvList(variant.inputs.resources, 'in-res|' + variant.uid, 'amount')}
            <button class="ghost small" onclick="addKvEntry('in-res|${variant.uid}')">+ resource cost</button>
          </div>
          <div style="margin-top:10px">
            <div class="muted" style="margin-bottom:6px">Items</div>
            ${renderKvList(variant.inputs.items, 'in-items|' + variant.uid, 'amount', 'itemId')}
            <button class="ghost small" onclick="addKvEntry('in-items|${variant.uid}')">+ item cost</button>
          </div>
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <div class="subheader">
            <span>Other Requirements</span>
            <button class="ghost small" onclick="addRequirementItem(${variant.uid}, 'items')">+ item</button>
          </div>
          ${renderRequirementItems(variant)}
        </div>
        <div>
          <div class="subheader">
            <span>Buildings (optional)</span>
            <button class="ghost small" onclick="addRequirementItem(${variant.uid}, 'buildings')">+ building</button>
          </div>
          ${renderRequirementBuildings(variant)}
        </div>
      </div>

      <div class="input-grid">
        <div class="subheader">
          <span>Resolution</span>
          <div class="flex">
            <label class="muted" style="margin:0">Type</label>
            <select onchange="setResolutionType(${variant.uid}, this.value)">
              <option value="deterministic" ${variant.resolution.type === 'deterministic' ? 'selected' : ''}>deterministic</option>
              <option value="ranged_outputs" ${variant.resolution.type === 'ranged_outputs' ? 'selected' : ''}>ranged_outputs</option>
              <option value="weighted_outcomes" ${variant.resolution.type === 'weighted_outcomes' ? 'selected' : ''}>weighted_outcomes</option>
            </select>
          </div>
        </div>
        ${renderResolution(variant)}
      </div>

      <div class="input-grid">
        <label>Modifiers (raw JSON array, optional)</label>
        <textarea placeholder='[{\"type\":\"staffStars\",\"roleId\":\"thief\",\"applyPerStar\":{\"outcomeWeightAdjustment\":{\"caught\":-5}}}]' oninput="updateVariantField(${variant.uid}, 'modifiersText', this.value)">${safe(variant.modifiersText)}</textarea>
      </div>
    </div>
  `;
}
function renderStaffRequirements(variant) {
  if (!variant.requirements.staff.length) {
    return `<div class="pill hint">No staff requirements yet.</div>`;
  }

  return variant.requirements.staff.map((req, idx) => `
    <div class="pill">
      <div class="pill-row">
        <input type="text" value="${safe(req.roleId)}" placeholder="roleId" oninput="updateStaffRequirement(${variant.uid}, ${idx}, 'roleId', this.value)">
        <input type="number" value="${safe(req.count)}" placeholder="count" oninput="updateStaffRequirement(${variant.uid}, ${idx}, 'count', parseInt(this.value, 10) || 0)">
        <input type="number" value="${safe(req.starsMin)}" placeholder="starsMin" oninput="updateStaffRequirement(${variant.uid}, ${idx}, 'starsMin', parseInt(this.value, 10) || 0)">
        <label class="muted" style="margin:0">Required?</label>
        <input type="checkbox" ${req.required !== false ? 'checked' : ''} onchange="updateStaffRequirement(${variant.uid}, ${idx}, 'required', this.checked)">
        <button class="ghost small" onclick="removeStaffRequirement(${variant.uid}, ${idx})">remove</button>
      </div>
      <div style="margin-top:8px">
        <label>Bonus / note (optional)</label>
        <input type="text" value="${safe(req.bonus)}" placeholder="+5 cred, cleaner lowers heat" oninput="updateStaffRequirement(${variant.uid}, ${idx}, 'bonus', this.value)">
      </div>
    </div>
  `).join('');
}

function renderRequirementItems(variant) {
  if (!variant.requirements.items.length) {
    return `<div class="pill hint">No item requirements.</div>`;
  }

  return variant.requirements.items.map((it, idx) => `
    <div class="pill pill-row">
      <input type="text" value="${safe(it.itemId)}" placeholder="itemId" oninput="updateRequirementItem(${variant.uid}, ${idx}, 'items', 'itemId', this.value)">
      <input type="number" value="${safe(it.count)}" placeholder="count" oninput="updateRequirementItem(${variant.uid}, ${idx}, 'items', 'count', parseInt(this.value, 10) || 0)">
      <button class="ghost small" onclick="removeRequirementItem(${variant.uid}, ${idx}, 'items')">remove</button>
    </div>
  `).join('');
}

function renderRequirementBuildings(variant) {
  if (!variant.requirements.buildings.length) {
    return `<div class="pill hint">No building requirements.</div>`;
  }

  return variant.requirements.buildings.map((bld, idx) => `
    <div class="pill pill-row">
      <input type="text" value="${safe(bld.buildingId)}" placeholder="buildingId" oninput="updateRequirementItem(${variant.uid}, ${idx}, 'buildings', 'buildingId', this.value)">
      <input type="number" value="${safe(bld.count)}" placeholder="count" oninput="updateRequirementItem(${variant.uid}, ${idx}, 'buildings', 'count', parseInt(this.value, 10) || 0)">
      <button class="ghost small" onclick="removeRequirementItem(${variant.uid}, ${idx}, 'buildings')">remove</button>
    </div>
  `).join('');
}

function renderResolution(variant) {
  const res = variant.resolution;

  if (res.type === 'weighted_outcomes') {
    const outcomes = res.outcomes.map((outcome, idx) => renderOutcome(variant, outcome, idx)).join('');
    return `
      <div class="stacked">
        ${outcomes}
        <button class="ghost small" onclick="addOutcome(${variant.uid})">+ outcome</button>
      </div>
    `;
  }

  return `
    <div class="input-grid two-col">
      <div>
        <div class="muted" style="margin-bottom:6px">Outputs: Resources</div>
        ${renderKvList(res.outputs.resources, 'out-res|' + variant.uid, 'range')}
        <button class="ghost small" onclick="addKvEntry('out-res|${variant.uid}')">+ resource</button>
      </div>
      <div>
        <div class="muted" style="margin-bottom:6px">Outputs: Items</div>
        ${renderKvList(res.outputs.items, 'out-items|' + variant.uid, 'amount', 'itemId')}
        <button class="ghost small" onclick="addKvEntry('out-items|${variant.uid}')">+ item</button>
      </div>
    </div>
    <div class="input-grid two-col">
      <div>
        <label>Heat Delta (min / max)</label>
        <div class="pill-row">
          <input type="number" value="${safe(res.heatDelta.min)}" placeholder="min" oninput="updateResolutionDelta(${variant.uid}, 'heat', 'min', this.value)">
          <input type="number" value="${safe(res.heatDelta.max)}" placeholder="max" oninput="updateResolutionDelta(${variant.uid}, 'heat', 'max', this.value)">
        </div>
      </div>
      <div>
        <label>Cred Delta (min / max)</label>
        <div class="pill-row">
          <input type="number" value="${safe(res.credDelta.min)}" placeholder="min" oninput="updateResolutionDelta(${variant.uid}, 'cred', 'min', this.value)">
          <input type="number" value="${safe(res.credDelta.max)}" placeholder="max" oninput="updateResolutionDelta(${variant.uid}, 'cred', 'max', this.value)">
        </div>
      </div>
    </div>
    <div>
      <div class="subheader">
        <span>Effects on resolve</span>
        <button class="ghost small" onclick="addEffect('variant|${variant.uid}|resolution')">+ effect</button>
      </div>
      ${renderEffectList(res.effects, 'variant|' + variant.uid + '|resolution')}
    </div>
  `;
}

function renderOutcome(variant, outcome, idx) {
  return `
    <div class="pill">
      <div class="pill-row" style="justify-content: space-between;">
        <div class="flex">
          <label class="muted" style="margin:0">Outcome ID</label>
          <input type="text" value="${safe(outcome.id)}" oninput="updateOutcome(${variant.uid}, ${idx}, 'id', this.value)">
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Weight</label>
          <input type="number" value="${safe(outcome.weight)}" oninput="updateOutcome(${variant.uid}, ${idx}, 'weight', parseInt(this.value, 10) || 0)" style="width:90px">
          <button class="ghost small" onclick="removeOutcome(${variant.uid}, ${idx})">remove</button>
        </div>
      </div>

      <div class="input-grid two-col" style="margin-top:8px">
        <div>
          <div class="muted" style="margin-bottom:6px">Resource Outputs</div>
          ${renderKvList(outcome.outputs.resources, 'outcome-res|' + variant.uid + '|' + idx, 'range')}
          <button class="ghost small" onclick="addKvEntry('outcome-res|${variant.uid}|${idx}')">+ resource</button>
        </div>
        <div>
          <div class="muted" style="margin-bottom:6px">Item Outputs</div>
          ${renderKvList(outcome.outputs.items, 'outcome-items|' + variant.uid + '|' + idx, 'amount', 'itemId')}
          <button class="ghost small" onclick="addKvEntry('outcome-items|${variant.uid}|${idx}')">+ item</button>
        </div>
      </div>

      <div class="input-grid three-col">
        <div>
          <label>Heat Delta (min/max)</label>
          <div class="pill-row">
            <input type="number" value="${safe(outcome.heatDelta.min)}" placeholder="min" oninput="updateOutcomeDelta(${variant.uid}, ${idx}, 'heat', 'min', this.value)">
            <input type="number" value="${safe(outcome.heatDelta.max)}" placeholder="max" oninput="updateOutcomeDelta(${variant.uid}, ${idx}, 'heat', 'max', this.value)">
          </div>
        </div>
        <div>
          <label>Cred Delta (min/max)</label>
          <div class="pill-row">
            <input type="number" value="${safe(outcome.credDelta.min)}" placeholder="min" oninput="updateOutcomeDelta(${variant.uid}, ${idx}, 'cred', 'min', this.value)">
            <input type="number" value="${safe(outcome.credDelta.max)}" placeholder="max" oninput="updateOutcomeDelta(${variant.uid}, ${idx}, 'cred', 'max', this.value)">
          </div>
        </div>
        <div>
          <label>Jail Duration (ms)</label>
          <input type="number" value="${safe(outcome.jailMs)}" placeholder="0 = none" oninput="updateOutcome(${variant.uid}, ${idx}, 'jailMs', this.value)">
        </div>
      </div>

      <div>
        <div class="subheader">
          <span>Outcome Effects</span>
          <button class="ghost small" onclick="addEffect('outcome|${variant.uid}|${idx}')">+ effect</button>
        </div>
        ${renderEffectList(outcome.effects, 'outcome|' + variant.uid + '|' + idx)}
      </div>
    </div>
  `;
}
function renderConditionList(list, scope) {
  if (!list || !list.length) {
    return `<div class="pill hint">No conditions.</div>`;
  }

  return list.map((cond, idx) => `
    <div class="pill">
      <div class="pill-row">
        <select onchange="updateCondition('${scope}', ${idx}, 'type', this.value); reRenderConditionScope('${scope}');">
          ${renderConditionOptions(cond.type)}
        </select>
        <button class="ghost small" onclick="removeCondition('${scope}', ${idx})">remove</button>
      </div>
      <div style="margin-top:8px">${renderConditionFields(cond, scope, idx)}</div>
    </div>
  `).join('');
}

function renderConditionOptions(current) {
  const types = [
    'resourceGte',
    'itemGte',
    'flagIs',
    'roleRevealed',
    'scenarioRevealed'
  ];
  return types.map(t => `<option value="${t}" ${current === t ? 'selected' : ''}>${t}</option>`).join('');
}

function renderConditionFields(cond, scope, idx) {
  switch (cond.type) {
    case 'resourceGte':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(cond.resourceId)}" placeholder="resourceId" oninput="updateCondition('${scope}', ${idx}, 'resourceId', this.value)">
          <input type="number" value="${safe(cond.value)}" placeholder="value" oninput="updateCondition('${scope}', ${idx}, 'value', parseInt(this.value, 10) || 0)">
        </div>
      `;
    case 'itemGte':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(cond.itemId)}" placeholder="itemId" oninput="updateCondition('${scope}', ${idx}, 'itemId', this.value)">
          <input type="number" value="${safe(cond.value)}" placeholder="count" oninput="updateCondition('${scope}', ${idx}, 'value', parseInt(this.value, 10) || 0)">
        </div>
      `;
    case 'flagIs':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(cond.key)}" placeholder="flag key" oninput="updateCondition('${scope}', ${idx}, 'key', this.value)">
          <select onchange="updateCondition('${scope}', ${idx}, 'bool', this.value === 'true')">
            <option value="true" ${cond.bool ? 'selected' : ''}>true</option>
            <option value="false" ${cond.bool === false ? 'selected' : ''}>false</option>
          </select>
        </div>
      `;
    case 'roleRevealed':
      return `<input type="text" value="${safe(cond.roleId)}" placeholder="roleId" oninput="updateCondition('${scope}', ${idx}, 'roleId', this.value)">`;
    case 'scenarioRevealed':
      return `<input type="text" value="${safe(cond.scenarioId)}" placeholder="scenarioId" oninput="updateCondition('${scope}', ${idx}, 'scenarioId', this.value)">`;
    default:
      return '<div class="hint">Unknown condition</div>';
  }
}

function renderEffectList(list, scope) {
  if (!list || !list.length) {
    return `<div class="pill hint">No effects.</div>`;
  }

  return list.map((fx, idx) => `
    <div class="pill">
      <div class="pill-row">
        <select onchange="updateEffect('${scope}', ${idx}, 'type', this.value); reRenderEffects('${scope}');">
          ${renderEffectOptions(fx.type)}
        </select>
        <button class="ghost small" onclick="removeEffect('${scope}', ${idx})">remove</button>
      </div>
      <div style="margin-top:8px">${renderEffectFields(fx, scope, idx)}</div>
    </div>
  `).join('');
}

function renderEffectOptions(current) {
  const types = [
    'revealBranch',
    'revealScenario',
    'revealResource',
    'revealRole',
    'revealTab',
    'unlockScenario',
    'setFlag',
    'incFlagCounter',
    'logMessage'
  ];
  return types.map(t => `<option value="${t}" ${current === t ? 'selected' : ''}>${t}</option>`).join('');
}

function renderEffectFields(effect, scope, idx) {
  switch (effect.type) {
    case 'revealBranch':
      return `<input type="text" value="${safe(effect.branchId)}" placeholder="branchId" oninput="updateEffect('${scope}', ${idx}, 'branchId', this.value)">`;
    case 'revealScenario':
      return `<input type="text" value="${safe(effect.scenarioId)}" placeholder="scenarioId" oninput="updateEffect('${scope}', ${idx}, 'scenarioId', this.value)">`;
    case 'revealResource':
      return `<input type="text" value="${safe(effect.resourceId)}" placeholder="resourceId" oninput="updateEffect('${scope}', ${idx}, 'resourceId', this.value)">`;
    case 'revealRole':
      return `<input type="text" value="${safe(effect.roleId)}" placeholder="roleId" oninput="updateEffect('${scope}', ${idx}, 'roleId', this.value)">`;
    case 'revealTab':
      return `<input type="text" value="${safe(effect.tabId)}" placeholder="tabId" oninput="updateEffect('${scope}', ${idx}, 'tabId', this.value)">`;
    case 'unlockScenario':
      return `<input type="text" value="${safe(effect.scenarioId)}" placeholder="scenarioId" oninput="updateEffect('${scope}', ${idx}, 'scenarioId', this.value)">`;
    case 'setFlag':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(effect.key)}" placeholder="flag key" oninput="updateEffect('${scope}', ${idx}, 'key', this.value)">
          <input type="text" value="${safe(effect.value)}" placeholder="value" oninput="updateEffect('${scope}', ${idx}, 'value', this.value)">
        </div>
      `;
    case 'incFlagCounter':
      return `<input type="text" value="${safe(effect.key)}" placeholder="flag key" oninput="updateEffect('${scope}', ${idx}, 'key', this.value)">`;
    case 'logMessage':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(effect.text || effect.message)}" placeholder="message" oninput="updateEffect('${scope}', ${idx}, 'text', this.value)">
          <select onchange="updateEffect('${scope}', ${idx}, 'kind', this.value)">
            ${renderLogKindOptions(effect.kind)}
          </select>
        </div>
      `;
    default:
      return '<div class="hint">Unknown effect</div>';
  }
}

function renderLogKindOptions(current) {
  const kinds = ['info', 'success', 'warning', 'error'];
  return kinds.map(k => `<option value="${k}" ${current === k ? 'selected' : ''}>${k}</option>`).join('');
}

function renderKvList(list, scope, mode = 'amount', keyLabel = 'resourceId') {
  if (!list || !list.length) {
    return `<div class="pill hint">None set.</div>`;
  }

  return list.map((entry, idx) => {
    if (mode === 'range') {
      return `
        <div class="pill-row">
          <input type="text" value="${safe(entry.id)}" placeholder="${keyLabel}" oninput="updateKvEntry('${scope}', ${idx}, 'id', this.value)">
          <input type="number" value="${safe(entry.min)}" placeholder="min" oninput="updateKvEntry('${scope}', ${idx}, 'min', this.value)">
          <input type="number" value="${safe(entry.max)}" placeholder="max" oninput="updateKvEntry('${scope}', ${idx}, 'max', this.value)">
          <button class="ghost small" onclick="removeKvEntry('${scope}', ${idx})">x</button>
        </div>
      `;
    }

    return `
      <div class="pill-row">
        <input type="text" value="${safe(entry.id || entry.itemId)}" placeholder="${keyLabel}" oninput="updateKvEntry('${scope}', ${idx}, 'id', this.value)">
        <input type="number" value="${safe(entry.amount || entry.count)}" placeholder="amount" oninput="updateKvEntry('${scope}', ${idx}, 'amount', this.value)">
        <button class="ghost small" onclick="removeKvEntry('${scope}', ${idx})">x</button>
      </div>
    `;
  }).join('');
}

function updateVariantField(uid, field, value) {
  const variant = findVariant(uid);
  if (!variant) return;

  if (field === 'repeatable') {
    variant.repeatable = value;
  } else if (field === 'modifiersText') {
    variant.modifiersText = value;
  } else if (field === 'maxConcurrentRuns') {
    variant.maxConcurrentRuns = value;
  } else {
    variant[field] = value;
  }

  refreshOutputs();
}

function setResolutionType(uid, type) {
  const variant = findVariant(uid);
  if (!variant) return;
  variant.resolution = createResolution(type);
  renderVariants();
}

function addVariant() {
  state.variants.push(createVariant());
  renderVariants();
}

function removeVariant(uid) {
  if (state.variants.length === 1) return;
  state.variants = state.variants.filter(o => o.uid !== uid);
  renderVariants();
}

function addCondition(scope) {
  const target = getConditionTarget(scope);
  if (!target) return;
  target.list.push(defaultCondition());
  reRenderConditionScope(scope);
  refreshOutputs();
}

function removeCondition(scope, idx) {
  const target = getConditionTarget(scope);
  if (!target) return;
  target.list.splice(idx, 1);
  reRenderConditionScope(scope);
  refreshOutputs();
}

function updateCondition(scope, idx, field, value) {
  const target = getConditionTarget(scope);
  if (!target || !target.list[idx]) return;

  if (field === 'type') {
    target.list[idx] = { ...defaultCondition(), type: value };
  } else {
    target.list[idx][field] = value;
  }
  refreshOutputs();
}

function reRenderConditionScope(scope) {
  if (scope.startsWith('scenario|')) {
    renderScenarioConditions();
  } else if (scope.startsWith('variant|')) {
    renderVariants();
  }
}

function addEffect(scope) {
  const target = getEffectTarget(scope);
  if (!target) return;
  target.list.push(defaultEffect());
  reRenderEffects(scope);
  refreshOutputs();
}

function removeEffect(scope, idx) {
  const target = getEffectTarget(scope);
  if (!target) return;
  target.list.splice(idx, 1);
  reRenderEffects(scope);
  refreshOutputs();
}

function updateEffect(scope, idx, field, value) {
  const target = getEffectTarget(scope);
  if (!target || !target.list[idx]) return;

  if (field === 'type') {
    target.list[idx] = { ...defaultEffect(), type: value };
  } else {
    target.list[idx][field] = value;
  }
  refreshOutputs();
}

function reRenderEffects(scope) {
  if (scope.startsWith('scenario|')) {
    renderScenarioReveals();
  } else {
    renderVariants();
  }
}

function addStaffRequirement(uid) {
  const variant = findVariant(uid);
  if (!variant) return;
  variant.requirements.staff.push({ roleId: 'player', count: 1, starsMin: 0, required: true, bonus: '' });
  renderVariants();
}

function updateStaffRequirement(uid, idx, field, value) {
  const variant = findVariant(uid);
  if (!variant || !variant.requirements.staff[idx]) return;
  variant.requirements.staff[idx][field] = value;
  refreshOutputs();
}

function removeStaffRequirement(uid, idx) {
  const variant = findVariant(uid);
  if (!variant || variant.requirements.staff.length <= 1) return;
  variant.requirements.staff.splice(idx, 1);
  renderVariants();
}

function addRequirementItem(uid, field) {
  const variant = findVariant(uid);
  if (!variant) return;
  variant.requirements[field].push({ [`${field === 'items' ? 'item' : 'building'}Id`]: '', count: 1 });
  renderVariants();
}

function updateRequirementItem(uid, idx, field, prop, value) {
  const variant = findVariant(uid);
  if (!variant || !variant.requirements[field][idx]) return;
  variant.requirements[field][idx][prop] = value;
  refreshOutputs();
}

function removeRequirementItem(uid, idx, field) {
  const variant = findVariant(uid);
  if (!variant) return;
  variant.requirements[field].splice(idx, 1);
  renderVariants();
}
function getKvTarget(scope) {
  const parts = scope.split('|');
  const kind = parts[0];
  const uid = parseInt(parts[1], 10);
  const variant = findVariant(uid);
  if (!variant) return null;

  if (kind === 'in-res') return { list: variant.inputs.resources, mode: 'amount' };
  if (kind === 'in-items') return { list: variant.inputs.items, mode: 'amount', keyLabel: 'itemId' };
  if (kind === 'out-res') return { list: variant.resolution.outputs.resources, mode: 'range' };
  if (kind === 'out-items') return { list: variant.resolution.outputs.items, mode: 'amount', keyLabel: 'itemId' };

  if (kind === 'outcome-res') {
    const outcomeIdx = parseInt(parts[2], 10);
    return { list: variant.resolution.outcomes[outcomeIdx].outputs.resources, mode: 'range' };
  }
  if (kind === 'outcome-items') {
    const outcomeIdx = parseInt(parts[2], 10);
    return { list: variant.resolution.outcomes[outcomeIdx].outputs.items, mode: 'amount', keyLabel: 'itemId' };
  }

  return null;
}

function addKvEntry(scope) {
  const target = getKvTarget(scope);
  if (!target) return;
  const entry = target.mode === 'range' ? { id: '', min: '', max: '' } : { id: '', amount: '' };
  target.list.push(entry);
  renderVariants();
}

function removeKvEntry(scope, idx) {
  const target = getKvTarget(scope);
  if (!target) return;
  target.list.splice(idx, 1);
  renderVariants();
}

function updateKvEntry(scope, idx, field, value) {
  const target = getKvTarget(scope);
  if (!target || !target.list[idx]) return;
  if (field === 'amount' || field === 'min' || field === 'max') {
    target.list[idx][field] = value;
  } else if (field === 'id') {
    target.list[idx].id = value;
    if (target.keyLabel === 'itemId') target.list[idx].itemId = value;
  }
  refreshOutputs();
}

function updateResolutionDelta(uid, type, field, value) {
  const variant = findVariant(uid);
  if (!variant) return;
  const target = type === 'heat' ? variant.resolution.heatDelta : variant.resolution.credDelta;
  target[field] = value;
  refreshOutputs();
}

function addOutcome(uid) {
  const variant = findVariant(uid);
  if (!variant) return;
  variant.resolution.outcomes.push(createOutcome(`outcome_${variant.resolution.outcomes.length + 1}`, 10));
  renderVariants();
}

function removeOutcome(uid, idx) {
  const variant = findVariant(uid);
  if (!variant || variant.resolution.outcomes.length <= 1) return;
  variant.resolution.outcomes.splice(idx, 1);
  renderVariants();
}

function updateOutcome(uid, idx, field, value) {
  const variant = findVariant(uid);
  if (!variant || !variant.resolution.outcomes[idx]) return;
  variant.resolution.outcomes[idx][field] = value;
  refreshOutputs();
}

function updateOutcomeDelta(uid, idx, type, field, value) {
  const variant = findVariant(uid);
  if (!variant || !variant.resolution.outcomes[idx]) return;
  const target = type === 'heat' ? variant.resolution.outcomes[idx].heatDelta : variant.resolution.outcomes[idx].credDelta;
  target[field] = value;
  refreshOutputs();
}

function findVariant(uid) {
  return state.variants.find(o => o.uid === uid);
}

function getConditionTarget(scope) {
  const parts = scope.split('|');
  if (parts[0] === 'scenario') {
    return { list: state[parts[1]] };
  }
  if (parts[0] === 'variant') {
    const variant = findVariant(parseInt(parts[1], 10));
    if (!variant) return null;
    return { list: variant[parts[2]] };
  }
  return null;
}

function getEffectTarget(scope) {
  const parts = scope.split('|');
  if (parts[0] === 'scenario') {
    return { list: state.reveals[parts[1]] };
  }
  if (parts[0] === 'variant') {
    const variant = findVariant(parseInt(parts[1], 10));
    if (!variant) return null;
    return { list: variant.resolution.effects };
  }
  if (parts[0] === 'outcome') {
    const variant = findVariant(parseInt(parts[1], 10));
    const idx = parseInt(parts[2], 10);
    if (!variant || !variant.resolution.outcomes[idx]) return null;
    return { list: variant.resolution.outcomes[idx].effects };
  }
  return null;
}

function renderJson() {
  const pre = document.getElementById('jsonOutput');
  if (!pre) return;
  const data = buildScenarioJson();
  pre.textContent = JSON.stringify(data, null, 2);
}

function buildScenarioJson() {
  const tags = parseTags(state.tags);
  const scenarioId = state.id || 'untitled_activity';

  const scenario = {
    id: scenarioId,
    branchId: state.branchId || 'street',
    name: state.name || 'untitled',
    description: state.description || '',
    meta: { tags, icon: state.icon || '' },
    visibleIf: state.visibleIf.map(normalizeCondition),
    unlockIf: state.unlockIf.map(normalizeCondition),
    reveals: {
      onReveal: state.reveals.onReveal.map(normalizeEffect),
      onUnlock: state.reveals.onUnlock.map(normalizeEffect)
    },
    variants: state.variants.map((variant, idx) => normalizeVariant(variant, scenarioId, idx))
  };

  return scenario;
}

function normalizeVariant(opt, scenarioId, idx) {
  const variantId = opt.variantId || `${scenarioId}_variant_${idx + 1}`;
  const modifiers = parseModifiers(opt.modifiersText);
  const data = {
    id: variantId,
    name: opt.name || `variant_${idx + 1}`,
    description: opt.description || '',
    visibleIf: opt.visibleIf.map(normalizeCondition),
    unlockIf: opt.unlockIf.map(normalizeCondition),
    requirements: {
      staff: opt.requirements.staff.map(s => cleanObject({
        roleId: s.roleId || 'player',
        count: numberOrDefault(s.count, 1),
        starsMin: numberOrDefault(s.starsMin, 0),
        required: s.required !== false,
        bonus: s.bonus || undefined
      })),
      items: opt.requirements.items.map(i => cleanObject({
        itemId: i.itemId || '',
        count: numberOrDefault(i.count, 1)
      })),
      buildings: opt.requirements.buildings.map(b => cleanObject({
        buildingId: b.buildingId || '',
        count: numberOrDefault(b.count, 1)
      }))
    },
    inputs: {
      resources: kvToObject(opt.inputs.resources, 'amount'),
      items: kvToObject(opt.inputs.items, 'amount')
    },
    durationMs: numberOrDefault(opt.durationMs, 10000),
    xpRewards: { onComplete: numberOrDefault(opt.xp, 0) },
    resolution: buildResolution(opt.resolution),
    modifiers: modifiers,
    cooldownMs: numberOrDefault(opt.cooldownMs, 0)
  };

  if (opt.repeatable) data.repeatable = true;
  if (opt.maxConcurrentRuns) data.maxConcurrentRuns = Number(opt.maxConcurrentRuns);

  return data;
}

function buildResolution(res) {
  if (res.type === 'weighted_outcomes') {
    return {
      type: 'weighted_outcomes',
      outcomes: res.outcomes.map(out => {
        const effectList = (out.effects || []).map(normalizeEffect);
        const built = {
          id: out.id || 'outcome',
          weight: numberOrDefault(out.weight, 0),
          outputs: {
            resources: kvToObject(out.outputs.resources, 'range'),
            items: kvToObject(out.outputs.items, 'amount')
          },
          heatDelta: rangeValue(out.heatDelta.min, out.heatDelta.max, 0),
          effects: effectList
        };

        const cred = rangeValue(out.credDelta.min, out.credDelta.max);
        if (cred !== null) built.credDelta = cred;

        if (out.jailMs) built.jail = { durationMs: Number(out.jailMs) };
        return built;
      })
    };
  }

  const resolution = {
    type: res.type,
    outputs: {
      resources: kvToObject(res.outputs.resources, 'range'),
      items: kvToObject(res.outputs.items, 'amount')
    },
    heatDelta: rangeValue(res.heatDelta.min, res.heatDelta.max, 0),
    effects: (res.effects || []).map(normalizeEffect)
  };

  const cred = rangeValue(res.credDelta.min, res.credDelta.max);
  if (cred !== null) resolution.credDelta = cred;

  return resolution;
}

function normalizeCondition(cond) {
  switch (cond.type) {
    case 'resourceGte':
      return { type: 'resourceGte', resourceId: cond.resourceId || '', value: numberOrDefault(cond.value, 0) };
    case 'itemGte':
      return { type: 'itemGte', itemId: cond.itemId || '', value: numberOrDefault(cond.value, 0) };
    case 'flagIs':
      return { type: 'flagIs', key: cond.key || '', value: cond.bool !== undefined ? cond.bool : !!cond.value };
    case 'roleRevealed':
      return { type: 'roleRevealed', roleId: cond.roleId || '' };
    case 'scenarioRevealed':
      return { type: 'scenarioRevealed', scenarioId: cond.scenarioId || '' };
    case 'staffStarsGte':
      return { type: 'staffStarsGte', roleId: cond.roleId || '', value: numberOrDefault(cond.value, 0) };
    case 'scenarioCompletedGte':
      return { type: 'scenarioCompletedGte', scenarioId: cond.scenarioId || '', value: numberOrDefault(cond.value, 0) };
    default:
      return { type: cond.type || 'unknown' };
  }
}

function normalizeEffect(effect) {
  const base = { type: effect.type };
  switch (effect.type) {
    case 'revealBranch':
      return { ...base, branchId: effect.branchId || '' };
    case 'revealScenario':
      return { ...base, scenarioId: effect.scenarioId || '' };
    case 'revealResource':
      return { ...base, resourceId: effect.resourceId || '' };
    case 'revealRole':
      return { ...base, roleId: effect.roleId || '' };
    case 'revealTab':
      return { ...base, tabId: effect.tabId || '' };
    case 'unlockScenario':
      return { ...base, scenarioId: effect.scenarioId || '' };
    case 'setFlag':
      return { ...base, key: effect.key || '', value: effect.value || '' };
    case 'incFlagCounter':
      return { ...base, key: effect.key || '' };
    case 'logMessage':
      return cleanObject({ ...base, text: effect.text || effect.message || '', kind: effect.kind || undefined });
    default:
      return base;
  }
}

function kvToObject(list, mode) {
  const out = {};
  (list || []).forEach(entry => {
    const id = (entry.id || entry.itemId || '').trim();
    if (!id) return;

    if (mode === 'range') {
      const min = entry.min !== '' && entry.min !== null ? Number(entry.min) : null;
      const max = entry.max !== '' && entry.max !== null ? Number(entry.max) : null;

      if (min !== null && max !== null) {
        out[id] = min === max ? min : { min, max };
      } else if (min !== null) {
        out[id] = min;
      }
    } else {
      const amount = entry.amount !== '' && entry.amount !== null ? Number(entry.amount || entry.count) : null;
      if (amount !== null) out[id] = amount;
    }
  });
  return out;
}

function rangeValue(min, max, defaultValue = null) {
  const hasMin = min !== '' && min !== null && min !== undefined;
  const hasMax = max !== '' && max !== null && max !== undefined;
  if (hasMin && hasMax) {
    const minNum = Number(min);
    const maxNum = Number(max);
    if (minNum === maxNum) return minNum;
    return { min: minNum, max: maxNum };
  }
  if (hasMin) return Number(min);
  if (hasMax) return Number(max);
  return defaultValue;
}

function parseTags(text) {
  if (!text) return [];
  return text.split(',').map(t => t.trim()).filter(Boolean);
}

function parseModifiers(text) {
  if (!text || !text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function numberOrDefault(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanObject(obj) {
  const cleaned = {};
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined && val !== '' && val !== null) cleaned[key] = val;
  });
  return cleaned;
}

function copyJSON() {
  const text = document.getElementById('jsonOutput').textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('JSON copied to clipboard');
  }).catch(() => {
    alert('Could not copy. Select the JSON and copy manually.');
  });
}

function clearBuilder() {
  variantUid = 1;
  const fresh = createScenario();
  Object.keys(state).forEach(k => state[k] = fresh[k]);
  state.variants = fresh.variants;
  notes = { problems: '', solutions: '' };

  document.getElementById('scenarioId').value = '';
  document.getElementById('scenarioName').value = '';
  document.getElementById('scenarioDescription').value = '';
  document.getElementById('branchId').value = 'street';
  document.getElementById('icon').value = '';
  document.getElementById('tags').value = '';
  document.getElementById('problemsNote').value = '';
  document.getElementById('solutionsNote').value = '';

  renderScenarioConditions();
  renderScenarioReveals();
  renderVariants();
  refreshOutputs();
}

function applyScenarioData(scenario) {
  variantUid = 1;
  const meta = scenario.meta || {};
  const tags = Array.isArray(meta.tags) ? meta.tags.join(', ') : '';

  state.id = scenario.id || '';
  state.name = scenario.name || '';
  state.description = scenario.description || '';
  state.branchId = scenario.branchId || 'street';
  state.icon = meta.icon || '';
  state.tags = tags;
  state.visibleIf = cloneJson(scenario.visibleIf || []);
  state.unlockIf = cloneJson(scenario.unlockIf || []);
  state.reveals = {
    onReveal: cloneJson(scenario.reveals?.onReveal || []),
    onUnlock: cloneJson(scenario.reveals?.onUnlock || [])
  };

  const variants = (scenario.variants || scenario.variants || []).map(inflateVariant);
  state.variants = variants.length ? variants : [createVariant()];

  notes = { problems: '', solutions: '' };

  syncMetaInputs();
  renderScenarioConditions();
  renderScenarioReveals();
  renderVariants();
  refreshOutputs();
}

function syncMetaInputs() {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  setValue('scenarioId', state.id);
  setValue('scenarioName', state.name);
  setValue('scenarioDescription', state.description);
  setValue('branchId', state.branchId);
  setValue('icon', state.icon);
  setValue('tags', state.tags);
  setValue('problemsNote', notes.problems);
  setValue('solutionsNote', notes.solutions);
}

function inflateVariant(opt) {
  const variant = createVariant();
  const reqs = opt.requirements || {};

  variant.variantId = opt.id || '';
  variant.name = opt.name || '';
  variant.description = opt.description || '';
  variant.repeatable = !!opt.repeatable;
  variant.maxConcurrentRuns = opt.maxConcurrentRuns ?? '';
  variant.visibleIf = cloneJson(opt.visibleIf || []);
  variant.unlockIf = cloneJson(opt.unlockIf || []);
  variant.requirements = {
    staff: inflateStaffRequirements(reqs.staff),
    items: inflateRequirementList(reqs.items, 'itemId'),
    buildings: inflateRequirementList(reqs.buildings, 'buildingId')
  };
  variant.inputs = {
    resources: kvListFromObject(opt.inputs?.resources, 'amount'),
    items: kvListFromObject(opt.inputs?.items, 'amount', 'itemId')
  };
  variant.durationMs = numberOrDefault(opt.durationMs, 10000);
  variant.xp = numberOrDefault(opt.xpRewards?.onComplete ?? opt.xpReward ?? opt.xp, 0);
  variant.cooldownMs = numberOrDefault(opt.cooldownMs, 0);
  variant.resolution = inflateResolution(opt.resolution);
  variant.modifiersText = Array.isArray(opt.modifiers) && opt.modifiers.length
    ? JSON.stringify(opt.modifiers, null, 2)
    : '';

  return variant;
}

function inflateStaffRequirements(list) {
  const staff = (list || []).map((req) => ({
    roleId: req.roleId || 'player',
    count: numberOrDefault(req.count, 1),
    starsMin: numberOrDefault(req.starsMin, 0),
    required: req.required !== false,
    bonus: req.bonus || ''
  }));

  return staff.length ? staff : [{ roleId: 'player', count: 1, starsMin: 0, required: true, bonus: '' }];
}

function inflateRequirementList(list, key) {
  return (list || []).map((entry) => ({
    [key]: entry[key] || '',
    count: numberOrDefault(entry.count, 1)
  }));
}

function inflateResolution(resolution) {
  if (!resolution || !resolution.type) return createResolution('weighted_outcomes');

  if (resolution.type === 'weighted_outcomes') {
    const base = createResolution('weighted_outcomes');
    if (Array.isArray(resolution.outcomes) && resolution.outcomes.length) {
      base.outcomes = resolution.outcomes.map((outcome) => {
        const heat = toRangeFields(outcome.heatDelta);
        const cred = toRangeFields(outcome.credDelta);
        return {
          id: outcome.id || 'outcome',
          weight: numberOrDefault(outcome.weight, 0),
          outputs: {
            resources: kvListFromObject(outcome.outputs?.resources, 'range'),
            items: kvListFromObject(outcome.outputs?.items, 'amount', 'itemId')
          },
          heatDelta: { min: heat.min, max: heat.max },
          credDelta: { min: cred.min, max: cred.max },
          jailMs: outcome.jail?.durationMs ? Number(outcome.jail.durationMs) : '',
          effects: cloneJson(outcome.effects || [])
        };
      });
    }
    return base;
  }

  const base = createResolution(resolution.type);
  const heat = toRangeFields(resolution.heatDelta);
  const cred = toRangeFields(resolution.credDelta);
  base.outputs = {
    resources: kvListFromObject(resolution.outputs?.resources, 'range'),
    items: kvListFromObject(resolution.outputs?.items, 'amount', 'itemId')
  };
  base.heatDelta = { min: heat.min, max: heat.max };
  base.credDelta = { min: cred.min, max: cred.max };
  base.effects = cloneJson(resolution.effects || []);
  return base;
}

function kvListFromObject(obj, mode, keyLabel) {
  if (!obj) return [];
  return Object.entries(obj).map(([id, value]) => {
    if (mode === 'range') {
      const range = toRangeFields(value);
      return { id, min: range.min, max: range.max };
    }

    const amount = typeof value === 'object' ? (value.amount ?? value.count ?? '') : value;
    const entry = { id, amount };
    if (keyLabel === 'itemId') entry.itemId = id;
    return entry;
  });
}

function toRangeFields(value) {
  if (value === undefined || value === null || value === '') return { min: '', max: '' };
  if (typeof value === 'object') {
    return { min: value.min ?? '', max: value.max ?? '' };
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return { min: '', max: '' };
  return { min: num, max: num };
}

function cloneJson(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function renderSummary() {
  const container = document.getElementById('relianceList');
  if (!container) return;

  const items = [];
  items.push({
    title: 'Activity',
    text: `${state.name || 'untitled'} (${state.id || 'id pending'}) - branch: ${state.branchId || 'street'}`
  });

  if (state.visibleIf.length || state.unlockIf.length) {
    items.push({
      title: 'Gates',
      text: `Visible: ${state.visibleIf.length || 0} | Unlock: ${state.unlockIf.length || 0}`
    });
  }

  state.variants.forEach(opt => {
    items.push({
      title: `Variant ${opt.name || opt.variantId || 'untitled'}`,
      text: describeOption(opt)
    });
  });

  if (notes.problems || notes.solutions) {
    items.push({
      title: 'Iteration notes',
      text: `${notes.problems ? 'Problems: ' + notes.problems : ''} ${notes.solutions ? 'Solutions: ' + notes.solutions : ''}`.trim()
    });
  }

  if (!items.length) {
    container.innerHTML = `<div class="item muted">Add data to see relationships.</div>`;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="item">
      <div class="subheader" style="margin-bottom:4px">
        <span>${safe(item.title)}</span>
      </div>
      <div>${safe(item.text)}</div>
    </div>
  `).join('');
}

function describeOption(opt) {
  const gates = `vis ${opt.visibleIf.length || 0} / unlock ${opt.unlockIf.length || 0}`;
  const staff = opt.requirements.staff.map(s => `${s.count || 1}x ${s.roleId || 'role'}(${s.starsMin || 0}*${s.required === false ? ' optional' : ''})`).join(', ') || 'no staff reqs';
  const costs = summarizeCosts(opt.inputs);
  const outputs = summarizeResolution(opt.resolution);
  return `${gates} | staff: ${staff} | costs: ${costs} | resolution: ${outputs}`;
}

function summarizeCosts(inputs) {
  const res = Object.entries(kvToObject(inputs.resources, 'amount')).map(([k, v]) => `${k}:${v}`).join(', ');
  const items = Object.entries(kvToObject(inputs.items, 'amount')).map(([k, v]) => `${k}:${v}`).join(', ');
  const parts = [];
  if (res) parts.push(res);
  if (items) parts.push(`items(${items})`);
  return parts.join(' | ') || 'none';
}

function summarizeResolution(res) {
  if (res.type === 'weighted_outcomes') {
    return `${res.outcomes.length} outcomes`;
  }
  const outputs = kvToObject(res.outputs.resources, 'range');
  const items = kvToObject(res.outputs.items, 'amount');
  const outStr = [
    ...Object.entries(outputs).map(([k, v]) => `${k}:${formatRange(v)}`),
    ...Object.entries(items).map(([k, v]) => `${k}:${v}`)
  ].join(', ');
  return `${res.type}${outStr ? ' | ' + outStr : ''}`;
}

function formatRange(val) {
  if (val && typeof val === 'object') {
    if (val.min !== undefined && val.max !== undefined) return `${val.min}-${val.max}`;
    if (val.min !== undefined) return `${val.min}+`;
    if (val.max !== undefined) return `${val.max}`;
  }
  return val;
}
