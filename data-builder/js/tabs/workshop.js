import { store, on, emit } from '../state.js';
import { safe, cloneJson, kvToObject, formatRange } from '../utils.js';
import { renderResourceOptions } from '../components/resource-picker.js';
import { renderRoleOptions } from '../components/role-picker.js';
import {
  createActivity, createOption, createResolution, createOutcome,
  defaultCondition, defaultEffect, resetOptionUid,
  buildActivityJson, inflateOption, validateActivity
} from '../models.js';
import { saveFile } from '../data-io.js';

let container = null;
let editorState = createActivity();
let notes = { problems: '', solutions: '' };
let lastSavedState = null;

// Expose handlers globally for inline onclick (pragmatic approach)
const W = {};
window._ws = W;

export function init(el) {
  container = el;
  on('activity-selected', loadActivity);
  on('data-loaded', () => {
    if (store.selectedActivityId) loadActivity(store.selectedActivityId);
  });
  render();
}

export function activate() {
  render();
}

export function deactivate() {}

// ── Load / Save ──

function loadActivity(activityId) {
  const activity = store.activityMap.get(activityId);
  if (!activity) {
    render();
    return;
  }

  resetOptionUid();
  const meta = activity.meta || {};
  const tags = Array.isArray(meta.tags) ? meta.tags.join(', ') : '';

  editorState.id = activity.id || '';
  editorState.name = activity.name || '';
  editorState.description = activity.description || '';
  editorState.branchId = activity.branchId || 'street';
  editorState.icon = meta.icon || '';
  editorState.tags = tags;
  editorState.visibleIf = cloneJson(activity.visibleIf || []);
  editorState.unlockIf = cloneJson(activity.unlockIf || []);
  editorState.reveals = {
    onReveal: cloneJson(activity.reveals?.onReveal || []),
    onUnlock: cloneJson(activity.reveals?.onUnlock || [])
  };

  const options = (activity.options || []).map(inflateOption);
  editorState.options = options.length ? options : [createOption()];
  notes = { problems: '', solutions: '' };
  lastSavedState = JSON.stringify(buildActivityJson(editorState));

  store.selectedActivityId = activityId;
  render();
}

W.saveActivity = async function() {
  const activity = buildActivityJson(editorState);
  if (!activity.id) {
    showToast('Activity ID is required.', 'error');
    return;
  }

  const validation = validateActivity(activity);
  if (!validation.valid) {
    showToast(`Validation: ${validation.errors.join(', ')}`, 'error');
    return;
  }

  // Update store
  const idx = store.activities.findIndex(a => a.id === activity.id);
  if (idx >= 0) store.activities[idx] = activity;
  else store.activities.push(activity);
  store.activityMap.set(activity.id, activity);

  try {
    await saveFile('activities');
    lastSavedState = JSON.stringify(activity);
    showToast(`Saved ${activity.id}`, 'success');
    emit('activity-changed', activity.id);
    render();
  } catch (err) {
    showToast(`Failed to save: ${err.message}`, 'error');
  }
};

W.newActivity = function() {
  resetOptionUid();
  editorState = createActivity();
  notes = { problems: '', solutions: '' };
  lastSavedState = null;
  store.selectedActivityId = null;
  emit('activity-selected', null);
  render();
};

// ── Field updates ──

W.updateMeta = function(field, value) {
  editorState[field] = value;
  refreshJson();
};

W.updateOptionField = function(uid, field, value) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  if (field === 'repeatable') opt.repeatable = value;
  else if (field === 'modifiersText') opt.modifiersText = value;
  else if (field === 'maxConcurrentRuns') opt.maxConcurrentRuns = value;
  else opt[field] = value;
  refreshJson();
};

W.addOption = function() {
  editorState.options.push(createOption());
  render();
};

W.removeOption = function(uid) {
  if (editorState.options.length === 1) return;
  editorState.options = editorState.options.filter(o => o.uid !== uid);
  render();
};

W.setResolutionType = function(uid, type) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  opt.resolution = createResolution(type);
  render();
};

// Condition handlers
W.addCondition = function(scope) {
  const target = getConditionTarget(scope);
  if (!target) return;
  target.push(defaultCondition());
  render();
};

W.removeCondition = function(scope, idx) {
  const target = getConditionTarget(scope);
  if (!target) return;
  target.splice(idx, 1);
  render();
};

W.updateCondition = function(scope, idx, field, value) {
  const target = getConditionTarget(scope);
  if (!target || !target[idx]) return;
  if (field === 'type') {
    target[idx] = { ...defaultCondition(), type: value };
  } else {
    target[idx][field] = value;
  }
  refreshJson();
};

// Effect handlers
W.addEffect = function(scope) {
  const target = getEffectTarget(scope);
  if (!target) return;
  target.push(defaultEffect());
  render();
};

W.removeEffect = function(scope, idx) {
  const target = getEffectTarget(scope);
  if (!target) return;
  target.splice(idx, 1);
  render();
};

W.updateEffect = function(scope, idx, field, value) {
  const target = getEffectTarget(scope);
  if (!target || !target[idx]) return;
  if (field === 'type') {
    target[idx] = { ...defaultEffect(), type: value };
  } else {
    target[idx][field] = value;
  }
  refreshJson();
};

// Staff handlers
W.addStaff = function(uid) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  opt.requirements.staff.push({ roleId: 'player', count: 1, starsMin: 0, required: true, bonus: '' });
  render();
};

W.updateStaff = function(uid, idx, field, value) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt || !opt.requirements.staff[idx]) return;
  opt.requirements.staff[idx][field] = value;
  refreshJson();
};

W.removeStaff = function(uid, idx) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt || opt.requirements.staff.length <= 1) return;
  opt.requirements.staff.splice(idx, 1);
  render();
};

// KV (resource input/output) handlers
W.addKv = function(scope) {
  const target = getKvTarget(scope);
  if (!target) return;
  const entry = target.mode === 'range' ? { id: '', min: '', max: '' } : { id: '', amount: '' };
  target.list.push(entry);
  render();
};

W.removeKv = function(scope, idx) {
  const target = getKvTarget(scope);
  if (!target) return;
  target.list.splice(idx, 1);
  render();
};

W.updateKv = function(scope, idx, field, value) {
  const target = getKvTarget(scope);
  if (!target || !target.list[idx]) return;
  if (field === 'amount' || field === 'min' || field === 'max') {
    target.list[idx][field] = value;
  } else if (field === 'id') {
    target.list[idx].id = value;
    if (target.keyLabel === 'itemId') target.list[idx].itemId = value;
  }
  refreshJson();
};

W.updateResDelta = function(uid, type, field, value) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  const target = type === 'heat' ? opt.resolution.heatDelta : opt.resolution.credDelta;
  target[field] = value;
  refreshJson();
};

// Outcome handlers
W.addOutcome = function(uid) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  opt.resolution.outcomes.push(createOutcome(`outcome_${opt.resolution.outcomes.length + 1}`, 10));
  render();
};

W.removeOutcome = function(uid, idx) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt || opt.resolution.outcomes.length <= 1) return;
  opt.resolution.outcomes.splice(idx, 1);
  render();
};

W.updateOutcome = function(uid, idx, field, value) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt || !opt.resolution.outcomes[idx]) return;
  opt.resolution.outcomes[idx][field] = value;
  refreshJson();
};

W.updateOutcomeDelta = function(uid, idx, type, field, value) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt || !opt.resolution.outcomes[idx]) return;
  const target = type === 'heat' ? opt.resolution.outcomes[idx].heatDelta : opt.resolution.outcomes[idx].credDelta;
  target[field] = value;
  refreshJson();
};

// Requirement items
W.addReqItem = function(uid, field) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  opt.requirements[field].push({ [`${field === 'items' ? 'item' : 'building'}Id`]: '', count: 1 });
  render();
};

W.updateReqItem = function(uid, idx, field, prop, value) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt || !opt.requirements[field][idx]) return;
  opt.requirements[field][idx][prop] = value;
  refreshJson();
};

W.removeReqItem = function(uid, idx, field) {
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return;
  opt.requirements[field].splice(idx, 1);
  render();
};

W.toggleJson = function() {
  const el = document.getElementById('ws-json-panel');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

W.copyJson = function() {
  const pre = document.getElementById('ws-json-output');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => showToast('JSON copied', 'success'));
};

// ── Scope resolvers ──

function getConditionTarget(scope) {
  const parts = scope.split('|');
  if (parts[0] === 'activity') return editorState[parts[1]];
  if (parts[0] === 'option') {
    const opt = editorState.options.find(o => o.uid === parseInt(parts[1], 10));
    return opt ? opt[parts[2]] : null;
  }
  return null;
}

function getEffectTarget(scope) {
  const parts = scope.split('|');
  if (parts[0] === 'activity') return editorState.reveals[parts[1]];
  if (parts[0] === 'option') {
    const opt = editorState.options.find(o => o.uid === parseInt(parts[1], 10));
    return opt ? opt.resolution.effects : null;
  }
  if (parts[0] === 'outcome') {
    const opt = editorState.options.find(o => o.uid === parseInt(parts[1], 10));
    const idx = parseInt(parts[2], 10);
    return opt?.resolution.outcomes[idx]?.effects || null;
  }
  return null;
}

function getKvTarget(scope) {
  const parts = scope.split('|');
  const kind = parts[0];
  const uid = parseInt(parts[1], 10);
  const opt = editorState.options.find(o => o.uid === uid);
  if (!opt) return null;

  if (kind === 'in-res') return { list: opt.inputs.resources, mode: 'amount' };
  if (kind === 'in-items') return { list: opt.inputs.items, mode: 'amount', keyLabel: 'itemId' };
  if (kind === 'out-res') return { list: opt.resolution.outputs.resources, mode: 'range' };
  if (kind === 'out-items') return { list: opt.resolution.outputs.items, mode: 'amount', keyLabel: 'itemId' };
  if (kind === 'outcome-res') {
    const oidx = parseInt(parts[2], 10);
    return { list: opt.resolution.outcomes[oidx].outputs.resources, mode: 'range' };
  }
  if (kind === 'outcome-items') {
    const oidx = parseInt(parts[2], 10);
    return { list: opt.resolution.outcomes[oidx].outputs.items, mode: 'amount', keyLabel: 'itemId' };
  }
  return null;
}

// ── Rendering ──

function refreshJson() {
  const pre = document.getElementById('ws-json-output');
  if (pre) pre.textContent = JSON.stringify(buildActivityJson(editorState), null, 2);
  emit('activity-changed', editorState.id);
}

function render() {
  if (!container) return;

  if (!editorState.id && !store.selectedActivityId) {
    container.innerHTML = `
      <div class="tab-panel__content">
        <div class="ws-empty">
          <h3>No activity selected</h3>
          <p>Select an activity from the sidebar, or create a new one.</p>
          <button onclick="_ws.newActivity()" style="margin-top:16px">+ New Activity</button>
        </div>
      </div>
    `;
    return;
  }

  const s = editorState;
  const json = buildActivityJson(s);
  const optCount = s.options.length;
  const condCount = s.visibleIf.length + s.unlockIf.length;
  const revealCount = s.reveals.onReveal.length + s.reveals.onUnlock.length;

  container.innerHTML = `
    <div class="section-nav">
      <button class="section-nav__btn" onclick="document.getElementById('ws-identity').scrollIntoView({behavior:'smooth'})">Identity</button>
      <button class="section-nav__btn" onclick="document.getElementById('ws-placement').scrollIntoView({behavior:'smooth'})">Placement</button>
      <button class="section-nav__btn" onclick="document.getElementById('ws-options').scrollIntoView({behavior:'smooth'})">Options</button>
      <button class="section-nav__btn" onclick="document.getElementById('ws-balance').scrollIntoView({behavior:'smooth'})">Balance</button>
      <span style="flex:1"></span>
      <span class="muted" style="font-size:0.8rem">${safe(s.id || 'new')}</span>
      <button class="small" onclick="_ws.saveActivity()">Save (Ctrl+S)</button>
      <button class="ghost small" onclick="_ws.toggleJson()">JSON</button>
      <button class="ghost small" onclick="_ws.copyJson()">Copy</button>
    </div>

    <div class="tab-panel__content">
      <div class="workshop-sections">

        <!-- Identity -->
        <div id="ws-identity" class="ws-section">
          <div class="ws-section__title">
            <span>Identity</span>
            <div class="ws-summary-chip">
              <span class="ws-chip">${optCount} option${optCount !== 1 ? 's' : ''}</span>
              ${condCount ? `<span class="ws-chip">${condCount} condition${condCount !== 1 ? 's' : ''}</span>` : ''}
              ${revealCount ? `<span class="ws-chip">${revealCount} reveal${revealCount !== 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
          <div class="input-grid two-col">
            <div>
              <label>Activity ID</label>
              <input type="text" value="${safe(s.id)}" oninput="_ws.updateMeta('id', this.value)">
            </div>
            <div>
              <label>Name</label>
              <input type="text" value="${safe(s.name)}" oninput="_ws.updateMeta('name', this.value)">
            </div>
          </div>
          <div class="input-grid two-col" style="margin-top:12px">
            <div>
              <label>Branch</label>
              <select oninput="_ws.updateMeta('branchId', this.value)">
                ${store.branches.map(b => `<option value="${safe(b.id)}" ${s.branchId === b.id ? 'selected' : ''}>${safe(b.name || b.id)}</option>`).join('')}
              </select>
            </div>
            <div class="input-grid two-col">
              <div>
                <label>Icon</label>
                <input type="text" value="${safe(s.icon)}" oninput="_ws.updateMeta('icon', this.value)" placeholder="emoji">
              </div>
              <div>
                <label>Tags</label>
                <input type="text" value="${safe(s.tags)}" oninput="_ws.updateMeta('tags', this.value)" placeholder="starter, risky">
              </div>
            </div>
          </div>
          <div style="margin-top:12px">
            <label>Description</label>
            <textarea oninput="_ws.updateMeta('description', this.value)" placeholder="what is this activity about?">${safe(s.description)}</textarea>
          </div>
        </div>

        <!-- Placement -->
        <div id="ws-placement" class="ws-section">
          <div class="ws-section__title">Placement & Progression</div>
          <div class="ws-placement">
            <div>
              <div class="subheader">
                <span>Visible If</span>
                <button class="ghost small" onclick="_ws.addCondition('activity|visibleIf')">+ condition</button>
              </div>
              ${renderConditionList(s.visibleIf, 'activity|visibleIf')}
            </div>
            <div>
              <div class="subheader">
                <span>Unlock If</span>
                <button class="ghost small" onclick="_ws.addCondition('activity|unlockIf')">+ condition</button>
              </div>
              ${renderConditionList(s.unlockIf, 'activity|unlockIf')}
            </div>
          </div>
          <div class="ws-placement" style="margin-top:14px">
            <div>
              <div class="subheader">
                <span>On Reveal (effects)</span>
                <button class="ghost small" onclick="_ws.addEffect('activity|onReveal')">+ effect</button>
              </div>
              ${renderEffectList(s.reveals.onReveal, 'activity|onReveal')}
            </div>
            <div>
              <div class="subheader">
                <span>On Unlock (effects)</span>
                <button class="ghost small" onclick="_ws.addEffect('activity|onUnlock')">+ effect</button>
              </div>
              ${renderEffectList(s.reveals.onUnlock, 'activity|onUnlock')}
            </div>
          </div>
          ${renderNeighborhood()}
        </div>

        <!-- Options -->
        <div id="ws-options" class="ws-section">
          <div class="ws-section__title">
            <span>Options</span>
            <button class="ghost small" onclick="_ws.addOption()">+ option</button>
          </div>
          <div class="ws-options-list">
            ${s.options.map((opt, idx) => renderOptionCard(opt, idx)).join('')}
          </div>
        </div>

        <!-- Balance Preview -->
        <div id="ws-balance" class="ws-section">
          <div class="ws-section__title">Balance Preview</div>
          ${renderBalancePreview()}
        </div>

        <!-- JSON Output (hidden by default) -->
        <div id="ws-json-panel" class="ws-section ws-json-toggle" style="display:none">
          <div class="ws-section__title">
            <span>JSON Output</span>
          </div>
          <div class="json-output">
            <pre id="ws-json-output">${safe(JSON.stringify(json, null, 2))}</pre>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Sub-renderers ──

function renderConditionList(list, scope) {
  if (!list || !list.length) return `<div class="pill hint">No conditions.</div>`;

  return list.map((cond, idx) => `
    <div class="pill">
      <div class="pill-row">
        <select onchange="_ws.updateCondition('${scope}', ${idx}, 'type', this.value)">
          ${renderConditionOptions(cond.type)}
        </select>
        <button class="ghost small" onclick="_ws.removeCondition('${scope}', ${idx})">remove</button>
      </div>
      <div style="margin-top:8px">${renderConditionFields(cond, scope, idx)}</div>
    </div>
  `).join('');
}

function renderConditionOptions(current) {
  const types = ['resourceGte', 'itemGte', 'flagIs', 'roleRevealed', 'activityRevealed', 'staffStarsGte', 'activityCompletedGte'];
  return types.map(t => `<option value="${t}" ${current === t ? 'selected' : ''}>${t}</option>`).join('');
}

function renderConditionFields(cond, scope, idx) {
  switch (cond.type) {
    case 'resourceGte':
      return `
        <div class="pill-row">
          <select onchange="_ws.updateCondition('${scope}', ${idx}, 'resourceId', this.value)">${renderResourceOptions(cond.resourceId)}</select>
          <input type="number" value="${safe(cond.value)}" placeholder="value" style="width:80px" oninput="_ws.updateCondition('${scope}', ${idx}, 'value', parseInt(this.value,10)||0)">
        </div>`;
    case 'itemGte':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(cond.itemId)}" placeholder="itemId" oninput="_ws.updateCondition('${scope}', ${idx}, 'itemId', this.value)">
          <input type="number" value="${safe(cond.value)}" placeholder="count" oninput="_ws.updateCondition('${scope}', ${idx}, 'value', parseInt(this.value,10)||0)">
        </div>`;
    case 'flagIs':
      return `
        <div class="pill-row">
          <input type="text" value="${safe(cond.key)}" placeholder="flag key" oninput="_ws.updateCondition('${scope}', ${idx}, 'key', this.value)">
          <select onchange="_ws.updateCondition('${scope}', ${idx}, 'bool', this.value==='true')">
            <option value="true" ${cond.bool ? 'selected' : ''}>true</option>
            <option value="false" ${cond.bool === false ? 'selected' : ''}>false</option>
          </select>
        </div>`;
    case 'roleRevealed':
      return `<select onchange="_ws.updateCondition('${scope}', ${idx}, 'roleId', this.value)">${renderRoleOptions(cond.roleId)}</select>`;
    case 'activityRevealed':
      return `<select onchange="_ws.updateCondition('${scope}', ${idx}, 'activityId', this.value)">
        <option value="">-- activity --</option>
        ${store.activities.map(a => `<option value="${safe(a.id)}" ${a.id === cond.activityId ? 'selected' : ''}>${safe(a.id)}</option>`).join('')}
      </select>`;
    case 'staffStarsGte':
      return `
        <div class="pill-row">
          <select onchange="_ws.updateCondition('${scope}', ${idx}, 'roleId', this.value)">${renderRoleOptions(cond.roleId)}</select>
          <input type="number" value="${safe(cond.value)}" placeholder="stars" style="width:80px" oninput="_ws.updateCondition('${scope}', ${idx}, 'value', parseInt(this.value,10)||0)">
        </div>`;
    case 'activityCompletedGte':
      return `
        <div class="pill-row">
          <select onchange="_ws.updateCondition('${scope}', ${idx}, 'activityId', this.value)">
            <option value="">-- activity --</option>
            ${store.activities.map(a => `<option value="${safe(a.id)}" ${a.id === cond.activityId ? 'selected' : ''}>${safe(a.id)}</option>`).join('')}
          </select>
          <input type="number" value="${safe(cond.value)}" placeholder="count" style="width:80px" oninput="_ws.updateCondition('${scope}', ${idx}, 'value', parseInt(this.value,10)||0)">
        </div>`;
    default:
      return '<div class="hint">Unknown condition</div>';
  }
}

function renderEffectList(list, scope) {
  if (!list || !list.length) return `<div class="pill hint">No effects.</div>`;

  return list.map((fx, idx) => `
    <div class="pill">
      <div class="pill-row">
        <select onchange="_ws.updateEffect('${scope}', ${idx}, 'type', this.value)">
          ${renderEffectOptions(fx.type)}
        </select>
        <button class="ghost small" onclick="_ws.removeEffect('${scope}', ${idx})">remove</button>
      </div>
      <div style="margin-top:8px">${renderEffectFields(fx, scope, idx)}</div>
    </div>
  `).join('');
}

function renderEffectOptions(current) {
  const types = ['revealBranch', 'revealActivity', 'revealResource', 'revealRole', 'revealTab', 'unlockActivity', 'setFlag', 'incFlagCounter', 'logMessage'];
  return types.map(t => `<option value="${t}" ${current === t ? 'selected' : ''}>${t}</option>`).join('');
}

function renderEffectFields(fx, scope, idx) {
  switch (fx.type) {
    case 'revealBranch':
      return `<select onchange="_ws.updateEffect('${scope}', ${idx}, 'branchId', this.value)">
        <option value="">-- branch --</option>
        ${store.branches.map(b => `<option value="${safe(b.id)}" ${b.id === fx.branchId ? 'selected' : ''}>${safe(b.name || b.id)}</option>`).join('')}
      </select>`;
    case 'revealActivity':
    case 'unlockActivity':
      return `<select onchange="_ws.updateEffect('${scope}', ${idx}, 'activityId', this.value)">
        <option value="">-- activity --</option>
        ${store.activities.map(a => `<option value="${safe(a.id)}" ${a.id === fx.activityId ? 'selected' : ''}>${safe(a.id)}</option>`).join('')}
      </select>`;
    case 'revealResource':
      return `<select onchange="_ws.updateEffect('${scope}', ${idx}, 'resourceId', this.value)">${renderResourceOptions(fx.resourceId)}</select>`;
    case 'revealRole':
      return `<select onchange="_ws.updateEffect('${scope}', ${idx}, 'roleId', this.value)">${renderRoleOptions(fx.roleId)}</select>`;
    case 'revealTab':
      return `<input type="text" value="${safe(fx.tabId)}" placeholder="tabId" oninput="_ws.updateEffect('${scope}', ${idx}, 'tabId', this.value)">`;
    case 'setFlag':
      return `<div class="pill-row">
        <input type="text" value="${safe(fx.key)}" placeholder="flag key" oninput="_ws.updateEffect('${scope}', ${idx}, 'key', this.value)">
        <input type="text" value="${safe(fx.value)}" placeholder="value" oninput="_ws.updateEffect('${scope}', ${idx}, 'value', this.value)">
      </div>`;
    case 'incFlagCounter':
      return `<input type="text" value="${safe(fx.key)}" placeholder="flag key" oninput="_ws.updateEffect('${scope}', ${idx}, 'key', this.value)">`;
    case 'logMessage':
      return `<div class="pill-row">
        <input type="text" value="${safe(fx.text || fx.message)}" placeholder="message" oninput="_ws.updateEffect('${scope}', ${idx}, 'text', this.value)">
        <select onchange="_ws.updateEffect('${scope}', ${idx}, 'kind', this.value)">
          ${['info', 'success', 'warning', 'error'].map(k => `<option value="${k}" ${fx.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
        </select>
      </div>`;
    default:
      return '<div class="hint">Unknown effect</div>';
  }
}

function renderOptionCard(option, idx) {
  const uid = option.uid;
  return `
    <div class="option-card">
      <div class="option-head">
        <div class="flex">
          <div class="badge">Option ${idx + 1}</div>
          <div class="muted">${safe(option.optionId || 'no id yet')}</div>
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Repeatable?</label>
          <input type="checkbox" ${option.repeatable ? 'checked' : ''} onchange="_ws.updateOptionField(${uid}, 'repeatable', this.checked)">
          <button class="ghost small" onclick="_ws.removeOption(${uid})">remove</button>
        </div>
      </div>

      <div class="input-grid two-col">
        <div>
          <label>Option ID</label>
          <input type="text" value="${safe(option.optionId)}" placeholder="shoplifting_grab" oninput="_ws.updateOptionField(${uid}, 'optionId', this.value)">
        </div>
        <div>
          <label>Name</label>
          <input type="text" value="${safe(option.name)}" placeholder="grab and go" oninput="_ws.updateOptionField(${uid}, 'name', this.value)">
        </div>
        <div>
          <label>Description</label>
          <textarea oninput="_ws.updateOptionField(${uid}, 'description', this.value)">${safe(option.description)}</textarea>
        </div>
        <div class="input-grid">
          <label>Duration (ms)</label>
          <input type="number" value="${safe(option.durationMs)}" oninput="_ws.updateOptionField(${uid}, 'durationMs', parseInt(this.value,10)||0)">
          <label>XP on Complete</label>
          <input type="number" value="${safe(option.xp)}" oninput="_ws.updateOptionField(${uid}, 'xp', parseInt(this.value,10)||0)">
          <label>Cooldown (ms)</label>
          <input type="number" value="${safe(option.cooldownMs)}" oninput="_ws.updateOptionField(${uid}, 'cooldownMs', parseInt(this.value,10)||0)">
          <label>Max Concurrent Runs</label>
          <input type="number" value="${safe(option.maxConcurrentRuns)}" oninput="_ws.updateOptionField(${uid}, 'maxConcurrentRuns', this.value)">
        </div>
      </div>

      <div class="input-grid two-col" style="margin-top:12px">
        <div>
          <div class="subheader"><span>Visible If</span><button class="ghost small" onclick="_ws.addCondition('option|${uid}|visibleIf')">+ condition</button></div>
          ${renderConditionList(option.visibleIf, `option|${uid}|visibleIf`)}
        </div>
        <div>
          <div class="subheader"><span>Unlock If</span><button class="ghost small" onclick="_ws.addCondition('option|${uid}|unlockIf')">+ condition</button></div>
          ${renderConditionList(option.unlockIf, `option|${uid}|unlockIf`)}
        </div>
      </div>

      <div class="input-grid two-col" style="margin-top:12px">
        <div>
          <div class="subheader"><span>Staff Requirements</span><button class="ghost small" onclick="_ws.addStaff(${uid})">+ staff</button></div>
          ${renderStaffRequirements(option)}
        </div>
        <div>
          <div class="subheader"><span>Inputs & Costs</span></div>
          <div>
            <div class="muted" style="margin-bottom:6px">Resources</div>
            ${renderKvList(option.inputs.resources, `in-res|${uid}`, 'amount')}
            <button class="ghost small" onclick="_ws.addKv('in-res|${uid}')">+ resource cost</button>
          </div>
          <div style="margin-top:10px">
            <div class="muted" style="margin-bottom:6px">Items</div>
            ${renderKvList(option.inputs.items, `in-items|${uid}`, 'amount', 'itemId')}
            <button class="ghost small" onclick="_ws.addKv('in-items|${uid}')">+ item cost</button>
          </div>
        </div>
      </div>

      <div style="margin-top:12px">
        <div class="subheader">
          <span>Resolution</span>
          <div class="flex">
            <label class="muted" style="margin:0">Type</label>
            <select onchange="_ws.setResolutionType(${uid}, this.value)">
              <option value="deterministic" ${option.resolution.type === 'deterministic' ? 'selected' : ''}>deterministic</option>
              <option value="ranged_outputs" ${option.resolution.type === 'ranged_outputs' ? 'selected' : ''}>ranged_outputs</option>
              <option value="weighted_outcomes" ${option.resolution.type === 'weighted_outcomes' ? 'selected' : ''}>weighted_outcomes</option>
            </select>
          </div>
        </div>
        ${renderResolution(option)}
      </div>

      <div style="margin-top:12px">
        <label>Modifiers (raw JSON array)</label>
        <textarea placeholder='[{"type":"staffStars","roleId":"thief","applyPerStar":{"outcomeWeightAdjustment":{"caught":-5}}}]' oninput="_ws.updateOptionField(${uid}, 'modifiersText', this.value)">${safe(option.modifiersText)}</textarea>
      </div>
    </div>
  `;
}

function renderStaffRequirements(option) {
  if (!option.requirements.staff.length) return `<div class="pill hint">No staff requirements.</div>`;

  return option.requirements.staff.map((req, idx) => `
    <div class="pill">
      <div class="pill-row">
        <select onchange="_ws.updateStaff(${option.uid}, ${idx}, 'roleId', this.value)">${renderRoleOptions(req.roleId)}</select>
        <input type="number" value="${safe(req.count)}" placeholder="count" style="width:60px" oninput="_ws.updateStaff(${option.uid}, ${idx}, 'count', parseInt(this.value,10)||0)">
        <input type="number" value="${safe(req.starsMin)}" placeholder="stars" style="width:60px" oninput="_ws.updateStaff(${option.uid}, ${idx}, 'starsMin', parseInt(this.value,10)||0)">
        <label class="muted" style="margin:0">Req?</label>
        <input type="checkbox" ${req.required !== false ? 'checked' : ''} onchange="_ws.updateStaff(${option.uid}, ${idx}, 'required', this.checked)">
        <button class="ghost small" onclick="_ws.removeStaff(${option.uid}, ${idx})">x</button>
      </div>
    </div>
  `).join('');
}

function renderKvList(list, scope, mode = 'amount', keyLabel = 'resourceId') {
  if (!list || !list.length) return `<div class="pill hint">None set.</div>`;

  return list.map((entry, idx) => {
    const useResourcePicker = keyLabel === 'resourceId';
    const idField = useResourcePicker
      ? `<select onchange="_ws.updateKv('${scope}', ${idx}, 'id', this.value)">${renderResourceOptions(entry.id)}</select>`
      : `<input type="text" value="${safe(entry.id || entry.itemId)}" placeholder="${keyLabel}" oninput="_ws.updateKv('${scope}', ${idx}, 'id', this.value)">`;

    if (mode === 'range') {
      return `<div class="pill-row">
        ${idField}
        <input type="number" value="${safe(entry.min)}" placeholder="min" style="width:70px" oninput="_ws.updateKv('${scope}', ${idx}, 'min', this.value)">
        <input type="number" value="${safe(entry.max)}" placeholder="max" style="width:70px" oninput="_ws.updateKv('${scope}', ${idx}, 'max', this.value)">
        <button class="ghost small" onclick="_ws.removeKv('${scope}', ${idx})">x</button>
      </div>`;
    }

    return `<div class="pill-row">
      ${idField}
      <input type="number" value="${safe(entry.amount || entry.count)}" placeholder="amount" style="width:80px" oninput="_ws.updateKv('${scope}', ${idx}, 'amount', this.value)">
      <button class="ghost small" onclick="_ws.removeKv('${scope}', ${idx})">x</button>
    </div>`;
  }).join('');
}

function renderResolution(option) {
  const res = option.resolution;
  const uid = option.uid;

  if (res.type === 'weighted_outcomes') {
    const outcomes = res.outcomes.map((outcome, idx) => renderOutcome(option, outcome, idx)).join('');
    return `<div class="stacked">${outcomes}<button class="ghost small" onclick="_ws.addOutcome(${uid})">+ outcome</button></div>`;
  }

  return `
    <div class="input-grid two-col">
      <div>
        <div class="muted" style="margin-bottom:6px">Output Resources</div>
        ${renderKvList(res.outputs.resources, `out-res|${uid}`, 'range')}
        <button class="ghost small" onclick="_ws.addKv('out-res|${uid}')">+ resource</button>
      </div>
      <div>
        <div class="muted" style="margin-bottom:6px">Output Items</div>
        ${renderKvList(res.outputs.items, `out-items|${uid}`, 'amount', 'itemId')}
        <button class="ghost small" onclick="_ws.addKv('out-items|${uid}')">+ item</button>
      </div>
    </div>
    <div class="input-grid two-col" style="margin-top:8px">
      <div>
        <label>Heat Delta (min / max)</label>
        <div class="pill-row">
          <input type="number" value="${safe(res.heatDelta.min)}" placeholder="min" oninput="_ws.updateResDelta(${uid}, 'heat', 'min', this.value)">
          <input type="number" value="${safe(res.heatDelta.max)}" placeholder="max" oninput="_ws.updateResDelta(${uid}, 'heat', 'max', this.value)">
        </div>
      </div>
      <div>
        <label>Cred Delta (min / max)</label>
        <div class="pill-row">
          <input type="number" value="${safe(res.credDelta.min)}" placeholder="min" oninput="_ws.updateResDelta(${uid}, 'cred', 'min', this.value)">
          <input type="number" value="${safe(res.credDelta.max)}" placeholder="max" oninput="_ws.updateResDelta(${uid}, 'cred', 'max', this.value)">
        </div>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="subheader"><span>Effects</span><button class="ghost small" onclick="_ws.addEffect('option|${uid}|resolution')">+ effect</button></div>
      ${renderEffectList(res.effects, `option|${uid}|resolution`)}
    </div>
  `;
}

function renderOutcome(option, outcome, idx) {
  const uid = option.uid;
  return `
    <div class="pill">
      <div class="pill-row" style="justify-content:space-between">
        <div class="flex">
          <label class="muted" style="margin:0">ID</label>
          <input type="text" value="${safe(outcome.id)}" style="width:120px" oninput="_ws.updateOutcome(${uid}, ${idx}, 'id', this.value)">
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Weight</label>
          <input type="number" value="${safe(outcome.weight)}" style="width:70px" oninput="_ws.updateOutcome(${uid}, ${idx}, 'weight', parseInt(this.value,10)||0)">
          <button class="ghost small" onclick="_ws.removeOutcome(${uid}, ${idx})">x</button>
        </div>
      </div>
      <div class="input-grid two-col" style="margin-top:8px">
        <div>
          <div class="muted" style="margin-bottom:6px">Resource Outputs</div>
          ${renderKvList(outcome.outputs.resources, `outcome-res|${uid}|${idx}`, 'range')}
          <button class="ghost small" onclick="_ws.addKv('outcome-res|${uid}|${idx}')">+ resource</button>
        </div>
        <div>
          <div class="muted" style="margin-bottom:6px">Item Outputs</div>
          ${renderKvList(outcome.outputs.items, `outcome-items|${uid}|${idx}`, 'amount', 'itemId')}
          <button class="ghost small" onclick="_ws.addKv('outcome-items|${uid}|${idx}')">+ item</button>
        </div>
      </div>
      <div class="input-grid three-col" style="margin-top:8px">
        <div>
          <label>Heat (min/max)</label>
          <div class="pill-row">
            <input type="number" value="${safe(outcome.heatDelta.min)}" placeholder="min" oninput="_ws.updateOutcomeDelta(${uid}, ${idx}, 'heat', 'min', this.value)">
            <input type="number" value="${safe(outcome.heatDelta.max)}" placeholder="max" oninput="_ws.updateOutcomeDelta(${uid}, ${idx}, 'heat', 'max', this.value)">
          </div>
        </div>
        <div>
          <label>Cred (min/max)</label>
          <div class="pill-row">
            <input type="number" value="${safe(outcome.credDelta.min)}" placeholder="min" oninput="_ws.updateOutcomeDelta(${uid}, ${idx}, 'cred', 'min', this.value)">
            <input type="number" value="${safe(outcome.credDelta.max)}" placeholder="max" oninput="_ws.updateOutcomeDelta(${uid}, ${idx}, 'cred', 'max', this.value)">
          </div>
        </div>
        <div>
          <label>Jail (ms)</label>
          <input type="number" value="${safe(outcome.jailMs)}" placeholder="0 = none" oninput="_ws.updateOutcome(${uid}, ${idx}, 'jailMs', this.value)">
        </div>
      </div>
      <div style="margin-top:8px">
        <div class="subheader"><span>Outcome Effects</span><button class="ghost small" onclick="_ws.addEffect('outcome|${uid}|${idx}')">+ effect</button></div>
        ${renderEffectList(outcome.effects, `outcome|${uid}|${idx}`)}
      </div>
    </div>
  `;
}

function renderNeighborhood() {
  if (!editorState.id) return '';

  const actId = editorState.id;
  const neighbors = new Map();

  // Find activities that reveal/unlock this one
  store.activities.forEach(act => {
    if (act.id === actId) return;
    const allEffects = [];
    (act.reveals?.onReveal || []).forEach(e => allEffects.push(e));
    (act.reveals?.onUnlock || []).forEach(e => allEffects.push(e));
    (act.options || []).forEach(opt => {
      (opt.resolution?.effects || []).forEach(e => allEffects.push(e));
      (opt.resolution?.outcomes || []).forEach(out => {
        (out.effects || []).forEach(e => allEffects.push(e));
      });
    });

    allEffects.forEach(e => {
      if ((e.type === 'revealActivity' || e.type === 'unlockActivity') && e.activityId === actId) {
        neighbors.set(act.id, { id: act.id, dir: 'in', type: e.type });
      }
    });
  });

  // Find what this activity reveals/unlocks
  const thisEffects = [];
  (editorState.reveals.onReveal || []).forEach(e => thisEffects.push(e));
  (editorState.reveals.onUnlock || []).forEach(e => thisEffects.push(e));
  editorState.options.forEach(opt => {
    (opt.resolution?.effects || []).forEach(e => thisEffects.push(e));
    (opt.resolution?.outcomes || []).forEach(out => {
      (out.effects || []).forEach(e => thisEffects.push(e));
    });
  });

  thisEffects.forEach(e => {
    if (e.type === 'revealActivity' || e.type === 'unlockActivity') {
      if (e.activityId) neighbors.set(e.activityId, { id: e.activityId, dir: 'out', type: e.type });
    }
    if (e.type === 'revealBranch') {
      neighbors.set(`branch:${e.branchId}`, { id: e.branchId, dir: 'out', type: 'revealBranch', isBranch: true });
    }
    if (e.type === 'revealResource') {
      neighbors.set(`res:${e.resourceId}`, { id: e.resourceId, dir: 'out', type: 'revealResource', isResource: true });
    }
  });

  // Conditions that reference resources
  (editorState.visibleIf || []).forEach(c => {
    if (c.type === 'resourceGte' && c.resourceId) {
      neighbors.set(`req:${c.resourceId}`, { id: c.resourceId, dir: 'in', type: 'requires', isResource: true });
    }
  });
  (editorState.unlockIf || []).forEach(c => {
    if (c.type === 'resourceGte' && c.resourceId) {
      neighbors.set(`gate:${c.resourceId}`, { id: c.resourceId, dir: 'in', type: 'gates', isResource: true });
    }
  });

  if (!neighbors.size) return '';

  const inbound = [...neighbors.values()].filter(n => n.dir === 'in');
  const outbound = [...neighbors.values()].filter(n => n.dir === 'out');

  return `
    <div style="margin-top:14px">
      <div class="muted" style="font-size:0.8rem;margin-bottom:6px">NEIGHBORHOOD</div>
      <div class="pill-row" style="gap:16px">
        ${inbound.length ? `<div>
          <div class="muted" style="font-size:0.75rem;margin-bottom:4px">LEADS HERE</div>
          ${inbound.map(n => `<span class="ws-chip">${safe(n.type)}: ${safe(n.id)}</span>`).join(' ')}
        </div>` : ''}
        ${outbound.length ? `<div>
          <div class="muted" style="font-size:0.75rem;margin-bottom:4px">LEADS TO</div>
          ${outbound.map(n => `<span class="ws-chip">${safe(n.type)}: ${safe(n.id)}</span>`).join(' ')}
        </div>` : ''}
      </div>
    </div>
  `;
}

function renderBalancePreview() {
  const json = buildActivityJson(editorState);
  if (!json.options.length) return '<div class="hint">Add options to see balance.</div>';

  const flows = new Map();

  json.options.forEach(opt => {
    // Inputs (consumed)
    if (opt.inputs?.resources) {
      Object.entries(opt.inputs.resources).forEach(([id, val]) => {
        if (!flows.has(id)) flows.set(id, { consumed: 0, produced: '' });
        const f = flows.get(id);
        f.consumed += typeof val === 'number' ? val : (val.min || 0);
      });
    }

    // Outputs (produced)
    const resolution = opt.resolution;
    if (resolution.type === 'weighted_outcomes') {
      (resolution.outcomes || []).forEach(out => {
        if (out.outputs?.resources) {
          Object.entries(out.outputs.resources).forEach(([id, val]) => {
            if (!flows.has(id)) flows.set(id, { consumed: 0, produced: '' });
            const f = flows.get(id);
            f.produced = formatRange(val) || val;
          });
        }
      });
    } else if (resolution.outputs?.resources) {
      Object.entries(resolution.outputs.resources).forEach(([id, val]) => {
        if (!flows.has(id)) flows.set(id, { consumed: 0, produced: '' });
        const f = flows.get(id);
        f.produced = formatRange(val) || val;
      });
    }
  });

  if (!flows.size) return '<div class="hint">No resource flows detected.</div>';

  const rows = [...flows.entries()].map(([id, f]) => {
    const prodClass = f.produced ? 'positive' : 'neutral';
    const consClass = f.consumed > 0 ? 'negative' : 'neutral';
    return `<tr>
      <td>${safe(id)}</td>
      <td class="${consClass}">${f.consumed > 0 ? `-${f.consumed}` : '-'}</td>
      <td class="${prodClass}">${f.produced || '-'}</td>
    </tr>`;
  }).join('');

  return `
    <div class="ws-balance">
      <table>
        <thead><tr><th>Resource</th><th>Consumed</th><th>Produced</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Toast ──

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
