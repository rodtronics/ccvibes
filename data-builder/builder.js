let optionUid = 1;
let notes = { problems: '', solutions: '' };
const state = createActivity();
const fileState = { activities: [], selectedId: '' };

document.addEventListener('DOMContentLoaded', () => {
  wireMetaInputs();
  wireNotes();
  renderActivityConditions();
  renderActivityReveals();
  renderOptions();
  refreshOutputs();
  initFileControls();
});

function createActivity() {
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
    options: [createOption()]
  };
}

function createOption() {
  return {
    uid: optionUid++,
    optionId: '',
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
    activityId: '',
    key: '',
    value: 0,
    bool: true
  };
}

function defaultEffect() {
  return {
    type: 'revealActivity',
    activityId: '',
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
    activityId: 'id',
    activityName: 'name',
    activityDescription: 'description',
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
}

function initFileControls() {
  renderActivitySelect();
  setFileStatus('Connect to the local builder server to enable save/load.', 'muted');
  if (!isServerContext()) return;
  refreshFileData();
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

function renderActivitySelect(selectedId = '') {
  const select = document.getElementById('activitySelect');
  if (!select) return;

  const current = selectedId || fileState.selectedId || select.value;
  const options = [
    { value: '', label: 'Select an activity' },
    ...fileState.activities
      .slice()
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
      .map((activity) => ({
        value: activity.id || '',
        label: `${activity.id || 'untitled'}${activity.name ? ` - ${activity.name}` : ''}`
      }))
  ];

  select.innerHTML = options
    .map(opt => `<option value="${safe(opt.value)}">${safe(opt.label)}</option>`)
    .join('');
  select.value = current;
  fileState.selectedId = select.value;
}

async function refreshFileData() {
  if (!isServerContext()) {
    setFileStatus('Open this page from the builder server to use save/load.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/data/activities.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Expected an array of activities');

    fileState.activities = data;
    renderActivitySelect();
    setFileStatus(`Loaded ${data.length} activities.`, 'success');
  } catch (err) {
    setFileStatus(`Failed to load activities.json: ${err.message}`, 'error');
  }
}

function loadSelectedActivity() {
  const select = document.getElementById('activitySelect');
  if (!select) return;
  const selectedId = select.value;
  if (!selectedId) {
    setFileStatus('Pick an activity to load.', 'error');
    return;
  }

  const activity = fileState.activities.find((act) => act.id === selectedId);
  if (!activity) {
    setFileStatus('Activity not found in file cache.', 'error');
    return;
  }

  applyActivityData(activity);
  fileState.selectedId = selectedId;
  setFileStatus(`Loaded ${selectedId}.`, 'success');
}

function startNewActivity() {
  clearBuilder();
  fileState.selectedId = '';
  renderActivitySelect();
  setFileStatus('New activity started.', 'success');
}

async function saveActivityToFile() {
  if (!isServerContext()) {
    setFileStatus('Open this page from the builder server to use save/load.', 'error');
    return;
  }

  const activity = buildActivityJson();
  if (!activity.id) {
    setFileStatus('Activity ID is required before saving.', 'error');
    return;
  }

  const existingIndex = fileState.activities.findIndex((act) => act.id === activity.id);
  const nextActivities = fileState.activities.slice();
  if (existingIndex >= 0) nextActivities[existingIndex] = activity;
  else nextActivities.push(activity);

  try {
    const res = await fetch('/api/data/activities.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextActivities)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    fileState.activities = nextActivities;
    renderActivitySelect(activity.id);
    setFileStatus(existingIndex >= 0 ? `Updated ${activity.id}.` : `Saved ${activity.id}.`, 'success');
  } catch (err) {
    setFileStatus(`Failed to save activities.json: ${err.message}`, 'error');
  }
}

function safe(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderActivityConditions() {
  const visible = document.getElementById('activityVisibleIf');
  const unlock = document.getElementById('activityUnlockIf');
  if (visible) visible.innerHTML = renderConditionList(state.visibleIf, 'activity|visibleIf');
  if (unlock) unlock.innerHTML = renderConditionList(state.unlockIf, 'activity|unlockIf');
}

function renderActivityReveals() {
  const onReveal = document.getElementById('activityOnReveal');
  const onUnlock = document.getElementById('activityOnUnlock');
  if (onReveal) onReveal.innerHTML = renderEffectList(state.reveals.onReveal, 'activity|onReveal');
  if (onUnlock) onUnlock.innerHTML = renderEffectList(state.reveals.onUnlock, 'activity|onUnlock');
}

function renderOptions() {
  const container = document.getElementById('optionsList');
  if (!container) return;
  container.innerHTML = state.options.map((opt, idx) => renderOptionCard(opt, idx)).join('');
  refreshOutputs();
}

function renderOptionCard(option, idx) {
  return `
    <div class="option-card">
      <div class="option-head">
        <div class="flex">
          <div class="badge">Option ${idx + 1}</div>
          <div class="muted">${option.optionId || 'no id yet'}</div>
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Repeatable?</label>
          <input type="checkbox" ${option.repeatable ? 'checked' : ''} onchange="updateOptionField(${option.uid}, 'repeatable', this.checked)">
          <button class="ghost small" onclick="removeOption(${option.uid})">remove</button>
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <label>Option ID</label>
          <input type="text" value="${safe(option.optionId)}" placeholder="shoplifting_grab" oninput="updateOptionField(${option.uid}, 'optionId', this.value)">
        </div>
        <div>
          <label>Name</label>
          <input type="text" value="${safe(option.name)}" placeholder="grab and go" oninput="updateOptionField(${option.uid}, 'name', this.value)">
        </div>
        <div>
          <label>Description</label>
          <textarea oninput="updateOptionField(${option.uid}, 'description', this.value)" placeholder="what is the vibe?">${safe(option.description)}</textarea>
        </div>
        <div class="input-grid">
          <label>Duration (ms)</label>
          <input type="number" value="${safe(option.durationMs)}" oninput="updateOptionField(${option.uid}, 'durationMs', parseInt(this.value, 10) || 0)">
          <label>XP on Complete</label>
          <input type="number" value="${safe(option.xp)}" oninput="updateOptionField(${option.uid}, 'xp', parseInt(this.value, 10) || 0)">
          <label>Cooldown (ms)</label>
          <input type="number" value="${safe(option.cooldownMs)}" oninput="updateOptionField(${option.uid}, 'cooldownMs', parseInt(this.value, 10) || 0)">
          <label>Max Concurrent Runs (optional)</label>
          <input type="number" value="${safe(option.maxConcurrentRuns)}" oninput="updateOptionField(${option.uid}, 'maxConcurrentRuns', this.value)">
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <div class="subheader">
            <span>Visible If</span>
            <button class="ghost small" onclick="addCondition('option|${option.uid}|visibleIf')">+ condition</button>
          </div>
          ${renderConditionList(option.visibleIf, 'option|' + option.uid + '|visibleIf')}
        </div>
        <div>
          <div class="subheader">
            <span>Unlock If</span>
            <button class="ghost small" onclick="addCondition('option|${option.uid}|unlockIf')">+ condition</button>
          </div>
          ${renderConditionList(option.unlockIf, 'option|' + option.uid + '|unlockIf')}
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <div class="subheader">
            <span>Staff Requirements</span>
            <button class="ghost small" onclick="addStaffRequirement(${option.uid})">+ staff</button>
          </div>
          ${renderStaffRequirements(option)}
        </div>
        <div>
          <div class="subheader">
            <span>Inputs & Costs</span>
            <span class="muted" style="font-size:0.85rem">resources + items consumed</span>
          </div>
          <div>
            <div class="muted" style="margin-bottom:6px">Resources</div>
            ${renderKvList(option.inputs.resources, 'in-res|' + option.uid, 'amount')}
            <button class="ghost small" onclick="addKvEntry('in-res|${option.uid}')">+ resource cost</button>
          </div>
          <div style="margin-top:10px">
            <div class="muted" style="margin-bottom:6px">Items</div>
            ${renderKvList(option.inputs.items, 'in-items|' + option.uid, 'amount', 'itemId')}
            <button class="ghost small" onclick="addKvEntry('in-items|${option.uid}')">+ item cost</button>
          </div>
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <div class="subheader">
            <span>Other Requirements</span>
            <button class="ghost small" onclick="addRequirementItem(${option.uid}, 'items')">+ item</button>
          </div>
          ${renderRequirementItems(option)}
        </div>
        <div>
          <div class="subheader">
            <span>Buildings (optional)</span>
            <button class="ghost small" onclick="addRequirementItem(${option.uid}, 'buildings')">+ building</button>
          </div>
          ${renderRequirementBuildings(option)}
        </div>
      </div>

      <div class="input-grid">
        <div class="subheader">
          <span>Resolution</span>
          <div class="flex">
            <label class="muted" style="margin:0">Type</label>
            <select onchange="setResolutionType(${option.uid}, this.value)">
              <option value="deterministic" ${option.resolution.type === 'deterministic' ? 'selected' : ''}>deterministic</option>
              <option value="ranged_outputs" ${option.resolution.type === 'ranged_outputs' ? 'selected' : ''}>ranged_outputs</option>
              <option value="weighted_outcomes" ${option.resolution.type === 'weighted_outcomes' ? 'selected' : ''}>weighted_outcomes</option>
            </select>
          </div>
        </div>
        ${renderResolution(option)}
      </div>

      <div class="input-grid">
        <label>Modifiers (raw JSON array, optional)</label>
        <textarea placeholder='[{\"type\":\"staffStars\",\"roleId\":\"thief\",\"applyPerStar\":{\"outcomeWeightAdjustment\":{\"caught\":-5}}}]' oninput="updateOptionField(${option.uid}, 'modifiersText', this.value)">${safe(option.modifiersText)}</textarea>
      </div>
    </div>
  `;
}
function renderStaffRequirements(option) {
  if (!option.requirements.staff.length) {
    return `<div class="pill hint">No staff requirements yet.</div>`;
  }

  return option.requirements.staff.map((req, idx) => `
    <div class="pill">
      <div class="pill-row">
        <input type="text" value="${safe(req.roleId)}" placeholder="roleId" oninput="updateStaffRequirement(${option.uid}, ${idx}, 'roleId', this.value)">
        <input type="number" value="${safe(req.count)}" placeholder="count" oninput="updateStaffRequirement(${option.uid}, ${idx}, 'count', parseInt(this.value, 10) || 0)">
        <input type="number" value="${safe(req.starsMin)}" placeholder="starsMin" oninput="updateStaffRequirement(${option.uid}, ${idx}, 'starsMin', parseInt(this.value, 10) || 0)">
        <label class="muted" style="margin:0">Required?</label>
        <input type="checkbox" ${req.required !== false ? 'checked' : ''} onchange="updateStaffRequirement(${option.uid}, ${idx}, 'required', this.checked)">
        <button class="ghost small" onclick="removeStaffRequirement(${option.uid}, ${idx})">remove</button>
      </div>
      <div style="margin-top:8px">
        <label>Bonus / note (optional)</label>
        <input type="text" value="${safe(req.bonus)}" placeholder="+5 cred, cleaner lowers heat" oninput="updateStaffRequirement(${option.uid}, ${idx}, 'bonus', this.value)">
      </div>
    </div>
  `).join('');
}

function renderRequirementItems(option) {
  if (!option.requirements.items.length) {
    return `<div class="pill hint">No item requirements.</div>`;
  }

  return option.requirements.items.map((it, idx) => `
    <div class="pill pill-row">
      <input type="text" value="${safe(it.itemId)}" placeholder="itemId" oninput="updateRequirementItem(${option.uid}, ${idx}, 'items', 'itemId', this.value)">
      <input type="number" value="${safe(it.count)}" placeholder="count" oninput="updateRequirementItem(${option.uid}, ${idx}, 'items', 'count', parseInt(this.value, 10) || 0)">
      <button class="ghost small" onclick="removeRequirementItem(${option.uid}, ${idx}, 'items')">remove</button>
    </div>
  `).join('');
}

function renderRequirementBuildings(option) {
  if (!option.requirements.buildings.length) {
    return `<div class="pill hint">No building requirements.</div>`;
  }

  return option.requirements.buildings.map((bld, idx) => `
    <div class="pill pill-row">
      <input type="text" value="${safe(bld.buildingId)}" placeholder="buildingId" oninput="updateRequirementItem(${option.uid}, ${idx}, 'buildings', 'buildingId', this.value)">
      <input type="number" value="${safe(bld.count)}" placeholder="count" oninput="updateRequirementItem(${option.uid}, ${idx}, 'buildings', 'count', parseInt(this.value, 10) || 0)">
      <button class="ghost small" onclick="removeRequirementItem(${option.uid}, ${idx}, 'buildings')">remove</button>
    </div>
  `).join('');
}

function renderResolution(option) {
  const res = option.resolution;

  if (res.type === 'weighted_outcomes') {
    const outcomes = res.outcomes.map((outcome, idx) => renderOutcome(option, outcome, idx)).join('');
    return `
      <div class="stacked">
        ${outcomes}
        <button class="ghost small" onclick="addOutcome(${option.uid})">+ outcome</button>
      </div>
    `;
  }

  return `
    <div class="input-grid two-col">
      <div>
        <div class="muted" style="margin-bottom:6px">Outputs: Resources</div>
        ${renderKvList(res.outputs.resources, 'out-res|' + option.uid, 'range')}
        <button class="ghost small" onclick="addKvEntry('out-res|${option.uid}')">+ resource</button>
      </div>
      <div>
        <div class="muted" style="margin-bottom:6px">Outputs: Items</div>
        ${renderKvList(res.outputs.items, 'out-items|' + option.uid, 'amount', 'itemId')}
        <button class="ghost small" onclick="addKvEntry('out-items|${option.uid}')">+ item</button>
      </div>
    </div>
    <div class="input-grid two-col">
      <div>
        <label>Heat Delta (min / max)</label>
        <div class="pill-row">
          <input type="number" value="${safe(res.heatDelta.min)}" placeholder="min" oninput="updateResolutionDelta(${option.uid}, 'heat', 'min', this.value)">
          <input type="number" value="${safe(res.heatDelta.max)}" placeholder="max" oninput="updateResolutionDelta(${option.uid}, 'heat', 'max', this.value)">
        </div>
      </div>
      <div>
        <label>Cred Delta (min / max)</label>
        <div class="pill-row">
          <input type="number" value="${safe(res.credDelta.min)}" placeholder="min" oninput="updateResolutionDelta(${option.uid}, 'cred', 'min', this.value)">
          <input type="number" value="${safe(res.credDelta.max)}" placeholder="max" oninput="updateResolutionDelta(${option.uid}, 'cred', 'max', this.value)">
        </div>
      </div>
    </div>
    <div>
      <div class="subheader">
        <span>Effects on resolve</span>
        <button class="ghost small" onclick="addEffect('option|${option.uid}|resolution')">+ effect</button>
      </div>
      ${renderEffectList(res.effects, 'option|' + option.uid + '|resolution')}
    </div>
  `;
}

function renderOutcome(option, outcome, idx) {
  return `
    <div class="pill">
      <div class="pill-row" style="justify-content: space-between;">
        <div class="flex">
          <label class="muted" style="margin:0">Outcome ID</label>
          <input type="text" value="${safe(outcome.id)}" oninput="updateOutcome(${option.uid}, ${idx}, 'id', this.value)">
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Weight</label>
          <input type="number" value="${safe(outcome.weight)}" oninput="updateOutcome(${option.uid}, ${idx}, 'weight', parseInt(this.value, 10) || 0)" style="width:90px">
          <button class="ghost small" onclick="removeOutcome(${option.uid}, ${idx})">remove</button>
        </div>
      </div>

      <div class="input-grid two-col" style="margin-top:8px">
        <div>
          <div class="muted" style="margin-bottom:6px">Resource Outputs</div>
          ${renderKvList(outcome.outputs.resources, 'outcome-res|' + option.uid + '|' + idx, 'range')}
          <button class="ghost small" onclick="addKvEntry('outcome-res|${option.uid}|${idx}')">+ resource</button>
        </div>
        <div>
          <div class="muted" style="margin-bottom:6px">Item Outputs</div>
          ${renderKvList(outcome.outputs.items, 'outcome-items|' + option.uid + '|' + idx, 'amount', 'itemId')}
          <button class="ghost small" onclick="addKvEntry('outcome-items|${option.uid}|${idx}')">+ item</button>
        </div>
      </div>

      <div class="input-grid three-col">
        <div>
          <label>Heat Delta (min/max)</label>
          <div class="pill-row">
            <input type="number" value="${safe(outcome.heatDelta.min)}" placeholder="min" oninput="updateOutcomeDelta(${option.uid}, ${idx}, 'heat', 'min', this.value)">
            <input type="number" value="${safe(outcome.heatDelta.max)}" placeholder="max" oninput="updateOutcomeDelta(${option.uid}, ${idx}, 'heat', 'max', this.value)">
          </div>
        </div>
        <div>
          <label>Cred Delta (min/max)</label>
          <div class="pill-row">
            <input type="number" value="${safe(outcome.credDelta.min)}" placeholder="min" oninput="updateOutcomeDelta(${option.uid}, ${idx}, 'cred', 'min', this.value)">
            <input type="number" value="${safe(outcome.credDelta.max)}" placeholder="max" oninput="updateOutcomeDelta(${option.uid}, ${idx}, 'cred', 'max', this.value)">
          </div>
        </div>
        <div>
          <label>Jail Duration (ms)</label>
          <input type="number" value="${safe(outcome.jailMs)}" placeholder="0 = none" oninput="updateOutcome(${option.uid}, ${idx}, 'jailMs', this.value)">
        </div>
      </div>

      <div>
        <div class="subheader">
          <span>Outcome Effects</span>
          <button class="ghost small" onclick="addEffect('outcome|${option.uid}|${idx}')">+ effect</button>
        </div>
        ${renderEffectList(outcome.effects, 'outcome|' + option.uid + '|' + idx)}
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
    'activityRevealed'
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
    case 'activityRevealed':
      return `<input type="text" value="${safe(cond.activityId)}" placeholder="activityId" oninput="updateCondition('${scope}', ${idx}, 'activityId', this.value)">`;
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
    'revealActivity',
    'revealResource',
    'revealRole',
    'revealTab',
    'unlockActivity',
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
    case 'revealActivity':
      return `<input type="text" value="${safe(effect.activityId)}" placeholder="activityId" oninput="updateEffect('${scope}', ${idx}, 'activityId', this.value)">`;
    case 'revealResource':
      return `<input type="text" value="${safe(effect.resourceId)}" placeholder="resourceId" oninput="updateEffect('${scope}', ${idx}, 'resourceId', this.value)">`;
    case 'revealRole':
      return `<input type="text" value="${safe(effect.roleId)}" placeholder="roleId" oninput="updateEffect('${scope}', ${idx}, 'roleId', this.value)">`;
    case 'revealTab':
      return `<input type="text" value="${safe(effect.tabId)}" placeholder="tabId" oninput="updateEffect('${scope}', ${idx}, 'tabId', this.value)">`;
    case 'unlockActivity':
      return `<input type="text" value="${safe(effect.activityId)}" placeholder="activityId" oninput="updateEffect('${scope}', ${idx}, 'activityId', this.value)">`;
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

function updateOptionField(uid, field, value) {
  const option = findOption(uid);
  if (!option) return;

  if (field === 'repeatable') {
    option.repeatable = value;
  } else if (field === 'modifiersText') {
    option.modifiersText = value;
  } else if (field === 'maxConcurrentRuns') {
    option.maxConcurrentRuns = value;
  } else {
    option[field] = value;
  }

  refreshOutputs();
}

function setResolutionType(uid, type) {
  const option = findOption(uid);
  if (!option) return;
  option.resolution = createResolution(type);
  renderOptions();
}

function addOption() {
  state.options.push(createOption());
  renderOptions();
}

function removeOption(uid) {
  if (state.options.length === 1) return;
  state.options = state.options.filter(o => o.uid !== uid);
  renderOptions();
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
  if (scope.startsWith('activity|')) {
    renderActivityConditions();
  } else if (scope.startsWith('option|')) {
    renderOptions();
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
  if (scope.startsWith('activity|')) {
    renderActivityReveals();
  } else {
    renderOptions();
  }
}

function addStaffRequirement(uid) {
  const option = findOption(uid);
  if (!option) return;
  option.requirements.staff.push({ roleId: 'player', count: 1, starsMin: 0, required: true, bonus: '' });
  renderOptions();
}

function updateStaffRequirement(uid, idx, field, value) {
  const option = findOption(uid);
  if (!option || !option.requirements.staff[idx]) return;
  option.requirements.staff[idx][field] = value;
  refreshOutputs();
}

function removeStaffRequirement(uid, idx) {
  const option = findOption(uid);
  if (!option || option.requirements.staff.length <= 1) return;
  option.requirements.staff.splice(idx, 1);
  renderOptions();
}

function addRequirementItem(uid, field) {
  const option = findOption(uid);
  if (!option) return;
  option.requirements[field].push({ [`${field === 'items' ? 'item' : 'building'}Id`]: '', count: 1 });
  renderOptions();
}

function updateRequirementItem(uid, idx, field, prop, value) {
  const option = findOption(uid);
  if (!option || !option.requirements[field][idx]) return;
  option.requirements[field][idx][prop] = value;
  refreshOutputs();
}

function removeRequirementItem(uid, idx, field) {
  const option = findOption(uid);
  if (!option) return;
  option.requirements[field].splice(idx, 1);
  renderOptions();
}
function getKvTarget(scope) {
  const parts = scope.split('|');
  const kind = parts[0];
  const uid = parseInt(parts[1], 10);
  const option = findOption(uid);
  if (!option) return null;

  if (kind === 'in-res') return { list: option.inputs.resources, mode: 'amount' };
  if (kind === 'in-items') return { list: option.inputs.items, mode: 'amount', keyLabel: 'itemId' };
  if (kind === 'out-res') return { list: option.resolution.outputs.resources, mode: 'range' };
  if (kind === 'out-items') return { list: option.resolution.outputs.items, mode: 'amount', keyLabel: 'itemId' };

  if (kind === 'outcome-res') {
    const outcomeIdx = parseInt(parts[2], 10);
    return { list: option.resolution.outcomes[outcomeIdx].outputs.resources, mode: 'range' };
  }
  if (kind === 'outcome-items') {
    const outcomeIdx = parseInt(parts[2], 10);
    return { list: option.resolution.outcomes[outcomeIdx].outputs.items, mode: 'amount', keyLabel: 'itemId' };
  }

  return null;
}

function addKvEntry(scope) {
  const target = getKvTarget(scope);
  if (!target) return;
  const entry = target.mode === 'range' ? { id: '', min: '', max: '' } : { id: '', amount: '' };
  target.list.push(entry);
  renderOptions();
}

function removeKvEntry(scope, idx) {
  const target = getKvTarget(scope);
  if (!target) return;
  target.list.splice(idx, 1);
  renderOptions();
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
  const option = findOption(uid);
  if (!option) return;
  const target = type === 'heat' ? option.resolution.heatDelta : option.resolution.credDelta;
  target[field] = value;
  refreshOutputs();
}

function addOutcome(uid) {
  const option = findOption(uid);
  if (!option) return;
  option.resolution.outcomes.push(createOutcome(`outcome_${option.resolution.outcomes.length + 1}`, 10));
  renderOptions();
}

function removeOutcome(uid, idx) {
  const option = findOption(uid);
  if (!option || option.resolution.outcomes.length <= 1) return;
  option.resolution.outcomes.splice(idx, 1);
  renderOptions();
}

function updateOutcome(uid, idx, field, value) {
  const option = findOption(uid);
  if (!option || !option.resolution.outcomes[idx]) return;
  option.resolution.outcomes[idx][field] = value;
  refreshOutputs();
}

function updateOutcomeDelta(uid, idx, type, field, value) {
  const option = findOption(uid);
  if (!option || !option.resolution.outcomes[idx]) return;
  const target = type === 'heat' ? option.resolution.outcomes[idx].heatDelta : option.resolution.outcomes[idx].credDelta;
  target[field] = value;
  refreshOutputs();
}

function findOption(uid) {
  return state.options.find(o => o.uid === uid);
}

function getConditionTarget(scope) {
  const parts = scope.split('|');
  if (parts[0] === 'activity') {
    return { list: state[parts[1]] };
  }
  if (parts[0] === 'option') {
    const option = findOption(parseInt(parts[1], 10));
    if (!option) return null;
    return { list: option[parts[2]] };
  }
  return null;
}

function getEffectTarget(scope) {
  const parts = scope.split('|');
  if (parts[0] === 'activity') {
    return { list: state.reveals[parts[1]] };
  }
  if (parts[0] === 'option') {
    const option = findOption(parseInt(parts[1], 10));
    if (!option) return null;
    return { list: option.resolution.effects };
  }
  if (parts[0] === 'outcome') {
    const option = findOption(parseInt(parts[1], 10));
    const idx = parseInt(parts[2], 10);
    if (!option || !option.resolution.outcomes[idx]) return null;
    return { list: option.resolution.outcomes[idx].effects };
  }
  return null;
}

function renderJson() {
  const pre = document.getElementById('jsonOutput');
  if (!pre) return;
  const data = buildActivityJson();
  pre.textContent = JSON.stringify(data, null, 2);
}

function buildActivityJson() {
  const tags = parseTags(state.tags);
  const activityId = state.id || 'untitled_activity';

  const activity = {
    id: activityId,
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
    options: state.options.map((opt, idx) => normalizeOption(opt, activityId, idx))
  };

  return activity;
}

function normalizeOption(opt, activityId, idx) {
  const optionId = opt.optionId || `${activityId}_option_${idx + 1}`;
  const modifiers = parseModifiers(opt.modifiersText);
  const data = {
    id: optionId,
    name: opt.name || `option_${idx + 1}`,
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
    case 'activityRevealed':
      return { type: 'activityRevealed', activityId: cond.activityId || '' };
    case 'staffStarsGte':
      return { type: 'staffStarsGte', roleId: cond.roleId || '', value: numberOrDefault(cond.value, 0) };
    case 'activityCompletedGte':
      return { type: 'activityCompletedGte', activityId: cond.activityId || '', value: numberOrDefault(cond.value, 0) };
    default:
      return { type: cond.type || 'unknown' };
  }
}

function normalizeEffect(effect) {
  const base = { type: effect.type };
  switch (effect.type) {
    case 'revealBranch':
      return { ...base, branchId: effect.branchId || '' };
    case 'revealActivity':
      return { ...base, activityId: effect.activityId || '' };
    case 'revealResource':
      return { ...base, resourceId: effect.resourceId || '' };
    case 'revealRole':
      return { ...base, roleId: effect.roleId || '' };
    case 'revealTab':
      return { ...base, tabId: effect.tabId || '' };
    case 'unlockActivity':
      return { ...base, activityId: effect.activityId || '' };
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
  optionUid = 1;
  const fresh = createActivity();
  Object.keys(state).forEach(k => state[k] = fresh[k]);
  state.options = fresh.options;
  notes = { problems: '', solutions: '' };

  document.getElementById('activityId').value = '';
  document.getElementById('activityName').value = '';
  document.getElementById('activityDescription').value = '';
  document.getElementById('branchId').value = 'street';
  document.getElementById('icon').value = '';
  document.getElementById('tags').value = '';
  document.getElementById('problemsNote').value = '';
  document.getElementById('solutionsNote').value = '';

  renderActivityConditions();
  renderActivityReveals();
  renderOptions();
  refreshOutputs();
}

function applyActivityData(activity) {
  optionUid = 1;
  const meta = activity.meta || {};
  const tags = Array.isArray(meta.tags) ? meta.tags.join(', ') : '';

  state.id = activity.id || '';
  state.name = activity.name || '';
  state.description = activity.description || '';
  state.branchId = activity.branchId || 'street';
  state.icon = meta.icon || '';
  state.tags = tags;
  state.visibleIf = cloneJson(activity.visibleIf || []);
  state.unlockIf = cloneJson(activity.unlockIf || []);
  state.reveals = {
    onReveal: cloneJson(activity.reveals?.onReveal || []),
    onUnlock: cloneJson(activity.reveals?.onUnlock || [])
  };

  const options = (activity.options || []).map(inflateOption);
  state.options = options.length ? options : [createOption()];

  notes = { problems: '', solutions: '' };

  syncMetaInputs();
  renderActivityConditions();
  renderActivityReveals();
  renderOptions();
  refreshOutputs();
}

function syncMetaInputs() {
  const setValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };

  setValue('activityId', state.id);
  setValue('activityName', state.name);
  setValue('activityDescription', state.description);
  setValue('branchId', state.branchId);
  setValue('icon', state.icon);
  setValue('tags', state.tags);
  setValue('problemsNote', notes.problems);
  setValue('solutionsNote', notes.solutions);
}

function inflateOption(opt) {
  const option = createOption();
  const reqs = opt.requirements || {};

  option.optionId = opt.id || '';
  option.name = opt.name || '';
  option.description = opt.description || '';
  option.repeatable = !!opt.repeatable;
  option.maxConcurrentRuns = opt.maxConcurrentRuns ?? '';
  option.visibleIf = cloneJson(opt.visibleIf || []);
  option.unlockIf = cloneJson(opt.unlockIf || []);
  option.requirements = {
    staff: inflateStaffRequirements(reqs.staff),
    items: inflateRequirementList(reqs.items, 'itemId'),
    buildings: inflateRequirementList(reqs.buildings, 'buildingId')
  };
  option.inputs = {
    resources: kvListFromObject(opt.inputs?.resources, 'amount'),
    items: kvListFromObject(opt.inputs?.items, 'amount', 'itemId')
  };
  option.durationMs = numberOrDefault(opt.durationMs, 10000);
  option.xp = numberOrDefault(opt.xpRewards?.onComplete ?? opt.xpReward ?? opt.xp, 0);
  option.cooldownMs = numberOrDefault(opt.cooldownMs, 0);
  option.resolution = inflateResolution(opt.resolution);
  option.modifiersText = Array.isArray(opt.modifiers) && opt.modifiers.length
    ? JSON.stringify(opt.modifiers, null, 2)
    : '';

  return option;
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

  state.options.forEach(opt => {
    items.push({
      title: `Option ${opt.name || opt.optionId || 'untitled'}`,
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

