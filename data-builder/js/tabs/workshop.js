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
let collapsedOptions = new Set(); // Track which options are collapsed by uid

const wizard = {
  open: false,
  step: 0,
  draft: null,
  lastBranch: null,
  lastResolutionType: 'ranged_outputs'
};

const WIZARD_STEPS = [
  { id: 'template', title: 'Template' },
  { id: 'identity', title: 'Identity' },
  { id: 'gates', title: 'Gates' },
  { id: 'option', title: 'First Option' },
  { id: 'effects', title: 'Effects' }
];

const WIZARD_TEMPLATES = {
  blank: {
    name: 'Blank',
    description: 'Start from scratch',
    preset: {}
  },
  basic_crime: {
    name: 'Basic Crime',
    description: 'Simple criminal activity with cash reward and heat risk',
    preset: {
      tags: 'crime',
      durationMs: 10000,
      xp: 5,
      heatDelta: 5,
      costs: [],
      outputs: [{ id: 'cash', min: 10, max: 25 }]
    }
  },
  business: {
    name: 'Business Operation',
    description: 'Legitimate business requiring investment with steady returns',
    preset: {
      tags: 'business, legitimate',
      durationMs: 30000,
      cooldownMs: 60000,
      xp: 10,
      heatDelta: 0,
      costs: [{ id: 'cash', amount: 50 }],
      outputs: [{ id: 'cash', min: 75, max: 100 }]
    }
  },
  territory: {
    name: 'Territory Expansion',
    description: 'High-cost expansion with influence rewards',
    preset: {
      tags: 'territory, expansion',
      durationMs: 60000,
      xp: 25,
      heatDelta: 15,
      costs: [{ id: 'cash', amount: 200 }],
      outputs: [{ id: 'influence', min: 1, max: 1 }],
      effects: {
        revealBranch: [],
        revealResource: ['influence'],
        revealActivity: [],
        unlockActivity: []
      }
    }
  },
  intel: {
    name: 'Intel Gathering',
    description: 'Low-risk reconnaissance with intel rewards',
    preset: {
      tags: 'intel, recon',
      durationMs: 20000,
      xp: 8,
      heatDelta: 2,
      costs: [],
      outputs: [{ id: 'intel', min: 1, max: 3 }],
      effects: {
        revealBranch: [],
        revealResource: ['intel'],
        revealActivity: [],
        unlockActivity: []
      }
    }
  },
  risky_heist: {
    name: 'Risky Heist',
    description: 'High-risk crime with success/failure outcomes (weighted_outcomes)',
    preset: {
      tags: 'crime, heist',
      durationMs: 45000,
      xp: 20,
      resolutionType: 'weighted_outcomes',
      costs: [{ id: 'cash', amount: 25 }],
      outcomes: [
        { name: 'Success', weight: 60, outputs: [{ id: 'cash', min: 150, max: 200 }], heatDelta: 10 },
        { name: 'Failure', weight: 40, outputs: [], heatDelta: 25 }
      ]
    }
  }
};

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

W.openWizard = function() {
  wizard.open = true;
  wizard.step = 0;
  wizard.draft = makeWizardDraft();
  wizard.selectedTemplate = 'blank';
  renderWizard();
};

W.wizSelectTemplate = function(templateId) {
  wizard.selectedTemplate = templateId;
  const template = WIZARD_TEMPLATES[templateId];
  if (template && template.preset) {
    wizard.draft = makeWizardDraft(template.preset);
  }
  renderWizard();
};

W.wizClose = function() {
  wizard.open = false;
  wizard.draft = null;
  renderWizard();
};

W.wizNext = function() {
  if (!wizard.open) return;
  wizard.step = Math.min(wizard.step + 1, WIZARD_STEPS.length - 1);
  renderWizard();
};

W.wizBack = function() {
  if (!wizard.open) return;
  wizard.step = Math.max(wizard.step - 1, 0);
  renderWizard();
};

W.wizSet = function(field, value) {
  if (!wizard.draft) return;
  wizard.draft[field] = value;
  renderWizard();
};

W.wizSetGate = function(idx, field, value) {
  if (!wizard.draft) return;
  const gate = wizard.draft.gates[idx];
  if (!gate) return;
  gate[field] = value;
  renderWizard();
};

W.wizSetCost = function(idx, field, value) {
  if (!wizard.draft) return;
  const cost = wizard.draft.costs[idx];
  if (!cost) return;
  cost[field] = value;
  renderWizard();
};

W.wizSetOutput = function(idx, field, value) {
  if (!wizard.draft) return;
  const out = wizard.draft.outputs[idx];
  if (!out) return;
  out[field] = value;
  renderWizard();
};

W.wizSetEffect = function(type, idx, value) {
  if (!wizard.draft) return;
  const list = wizard.draft.effects[type];
  if (!Array.isArray(list) || idx < 0 || idx >= list.length) return;
  list[idx] = value;
};

W.wizAddGate = function() {
  if (!wizard.draft) return;
  wizard.draft.gates.push({ scope: 'unlockIf', type: 'resourceGte', resourceId: '', value: 0 });
  renderWizard();
};

W.wizRemoveGate = function(idx) {
  if (!wizard.draft) return;
  wizard.draft.gates.splice(idx, 1);
  renderWizard();
};

W.wizAddCost = function() {
  if (!wizard.draft) return;
  wizard.draft.costs.push({ id: '', amount: 0 });
  renderWizard();
};

W.wizRemoveCost = function(idx) {
  if (!wizard.draft) return;
  wizard.draft.costs.splice(idx, 1);
  renderWizard();
};

W.wizAddOutput = function() {
  if (!wizard.draft) return;
  wizard.draft.outputs.push({ id: '', min: 0, max: 0 });
  renderWizard();
};

W.wizRemoveOutput = function(idx) {
  if (!wizard.draft) return;
  wizard.draft.outputs.splice(idx, 1);
  renderWizard();
};

W.wizAddOutcome = function() {
  if (!wizard.draft) return;
  wizard.draft.outcomes.push({ name: 'New Outcome', weight: 10, outputs: [], heatDelta: 0 });
  renderWizard();
};

W.wizRemoveOutcome = function(idx) {
  if (!wizard.draft || !wizard.draft.outcomes) return;
  if (wizard.draft.outcomes.length <= 1) return; // Keep at least one
  wizard.draft.outcomes.splice(idx, 1);
  renderWizard();
};

W.wizSetOutcome = function(idx, field, value) {
  if (!wizard.draft || !wizard.draft.outcomes) return;
  const outcome = wizard.draft.outcomes[idx];
  if (!outcome) return;
  outcome[field] = value;
  renderWizard();
};

W.wizAddOutcomeOutput = function(outcomeIdx) {
  if (!wizard.draft || !wizard.draft.outcomes) return;
  const outcome = wizard.draft.outcomes[outcomeIdx];
  if (!outcome) return;
  if (!outcome.outputs) outcome.outputs = [];
  outcome.outputs.push({ id: '', min: 0, max: 0 });
  renderWizard();
};

W.wizRemoveOutcomeOutput = function(outcomeIdx, outputIdx) {
  if (!wizard.draft || !wizard.draft.outcomes) return;
  const outcome = wizard.draft.outcomes[outcomeIdx];
  if (!outcome || !outcome.outputs) return;
  outcome.outputs.splice(outputIdx, 1);
  renderWizard();
};

W.wizSetOutcomeOutput = function(outcomeIdx, outputIdx, field, value) {
  if (!wizard.draft || !wizard.draft.outcomes) return;
  const outcome = wizard.draft.outcomes[outcomeIdx];
  if (!outcome || !outcome.outputs || !outcome.outputs[outputIdx]) return;
  outcome.outputs[outputIdx][field] = value;
  renderWizard();
};

W.wizAddEffect = function(type) {
  if (!wizard.draft) return;
  if (type === 'revealBranch') wizard.draft.effects.revealBranch.push('');
  if (type === 'revealResource') wizard.draft.effects.revealResource.push('');
  if (type === 'revealActivity') wizard.draft.effects.revealActivity.push('');
  if (type === 'unlockActivity') wizard.draft.effects.unlockActivity.push('');
  renderWizard();
};

W.wizRemoveEffect = function(type, idx) {
  if (!wizard.draft) return;
  const list = wizard.draft.effects[type];
  if (!Array.isArray(list)) return;
  list.splice(idx, 1);
  renderWizard();
};

W.wizCreate = function() {
  if (!wizard.draft) return;

  const draft = normalizeWizardDraft(wizard.draft);
  if (!draft.id) {
    showToast('Wizard: Activity ID is required.', 'error');
    return;
  }

  if (store.activityMap.has(draft.id)) {
    showToast(`Wizard: Activity already exists: ${draft.id}`, 'error');
    return;
  }

  // Remember user preferences for next time
  wizard.lastBranch = draft.branchId;
  wizard.lastResolutionType = draft.resolutionType;

  resetOptionUid();
  editorState = createActivity();
  editorState.id = draft.id;
  editorState.name = draft.name || draft.id;
  editorState.description = draft.description || '';
  editorState.branchId = draft.branchId || 'street';
  editorState.icon = draft.icon || '';
  editorState.tags = draft.tags || '';
  editorState.visibleIf = [];
  editorState.unlockIf = [];
  editorState.reveals = { onReveal: [], onUnlock: [] };

  draft.gates.forEach((g) => {
    if (!g.resourceId) return;
    const c = defaultCondition();
    c.type = 'resourceGte';
    c.resourceId = g.resourceId;
    c.value = Number(g.value || 0);
    if (g.scope === 'visibleIf') editorState.visibleIf.push(c);
    else editorState.unlockIf.push(c);
  });

  const opt = createOption();
  opt.optionId = `${draft.id}_default`;
  opt.name = draft.optionName || 'default';
  opt.description = draft.optionDescription || '';
  opt.durationMs = Number(draft.durationMs || 10000);
  opt.cooldownMs = Number(draft.cooldownMs || 0);
  opt.xp = Number(draft.xp || 0);

  opt.inputs.resources = draft.costs
    .filter((c) => c.id)
    .map((c) => ({ id: c.id, amount: Number(c.amount || 0) }));

  opt.resolution = createResolution(draft.resolutionType || 'ranged_outputs');

  if (draft.resolutionType === 'weighted_outcomes') {
    // Build outcomes from draft
    opt.resolution.outcomes = (draft.outcomesList || []).map((outcomeData) => {
      const outcome = createOutcome(outcomeData.name, outcomeData.weight);
      outcome.heatDelta = { min: String(outcomeData.heatDelta), max: String(outcomeData.heatDelta) };
      outcome.credDelta = { min: '', max: '' };
      outcome.outputs.resources = (outcomeData.outputs || [])
        .filter((o) => o.id)
        .map((o) => ({ id: o.id, min: Number(o.min || 0), max: Number(o.max ?? o.min ?? 0) }));
      return outcome;
    });
  } else {
    // Simple outputs for ranged_outputs/deterministic
    opt.resolution.outputs.resources = draft.outputs
      .filter((o) => o.id)
      .map((o) => ({ id: o.id, min: Number(o.min || 0), max: Number(o.max ?? o.min ?? 0) }));
    opt.resolution.heatDelta = { min: String(draft.heatDelta), max: String(draft.heatDelta) };
    opt.resolution.credDelta = { min: '', max: '' };
  }

  opt.resolution.effects = draft.effectsList.map(inflateWizardEffect);

  editorState.options = [opt];
  lastSavedState = null;
  store.selectedActivityId = null;
  emit('activity-selected', null);

  wizard.open = false;
  wizard.draft = null;
  wizard.selectedTemplate = null;
  renderWizard();
  showToast(`Wizard: Created draft ${draft.id}. Remember to save.`, 'success');
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
  collapsedOptions.delete(uid);
  render();
};

W.toggleOptionCollapse = function(uid) {
  if (collapsedOptions.has(uid)) {
    collapsedOptions.delete(uid);
  } else {
    collapsedOptions.add(uid);
  }
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

  // Save focus state before re-rendering
  const activeEl = document.activeElement;
  const activeId = activeEl?.id || activeEl?.getAttribute('data-focus-id');
  const selectionStart = activeEl?.selectionStart;
  const selectionEnd = activeEl?.selectionEnd;

  if (!editorState.id && !store.selectedActivityId) {
    container.innerHTML = `
      <div class="tab-panel__content">
        <div class="ws-empty">
          <h3>No activity selected</h3>
          <p>Select an activity from the sidebar, or create a new one.</p>
          <div class="flex" style="justify-content:center;margin-top:16px">
            <button onclick="_ws.openWizard()">🧙 Activity Wizard</button>
            <button class="ghost" onclick="_ws.newActivity()">Blank</button>
          </div>
        </div>
      </div>
      ${renderWizardModal()}
    `;
    return;
  }

  const s = editorState;
  const json = buildActivityJson(s);
  const optCount = s.options.length;
  const condCount = s.visibleIf.length + s.unlockIf.length;
  const revealCount = s.reveals.onReveal.length + s.reveals.onUnlock.length;
  const difficulty = computeDifficultyHint(json);
  const diffChip = renderDifficultyChip(difficulty);

  container.innerHTML = `
    <div class="section-nav">
      <button class="section-nav__btn" onclick="document.getElementById('ws-identity').scrollIntoView({behavior:'smooth'})">Identity</button>
      <button class="section-nav__btn" onclick="document.getElementById('ws-placement').scrollIntoView({behavior:'smooth'})">Placement</button>
      <button class="section-nav__btn" onclick="document.getElementById('ws-options').scrollIntoView({behavior:'smooth'})">Options</button>
      <button class="section-nav__btn" onclick="document.getElementById('ws-balance').scrollIntoView({behavior:'smooth'})">Balance</button>
      <span style="flex:1"></span>
      <span class="muted" style="font-size:0.8rem">${safe(s.id || 'new')}</span>
      <button class="ghost small" onclick="_ws.openWizard()">🧙 Wizard</button>
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
              ${diffChip}
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
          ${renderDifficultyPreview(difficulty)}
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
    ${renderWizardModal()}
  `;

  // Restore focus after re-render
  if (activeId) {
    const targetEl = document.getElementById(activeId) || document.querySelector(`[data-focus-id="${activeId}"]`);
    if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'SELECT')) {
      setTimeout(() => {
        targetEl.focus();
        if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
          if (targetEl.setSelectionRange) {
            targetEl.setSelectionRange(selectionStart, selectionEnd);
          }
        }
      }, 0);
    }
  }
}

// Separate wizard renderer that only updates the wizard modal
function renderWizard() {
  if (!container) return;

  const overlay = container.querySelector('.ws-modal-overlay');
  if (!overlay && (!wizard.open || !wizard.draft)) return;

  // Save focus state before re-rendering wizard
  const activeEl = document.activeElement;
  const activeId = activeEl?.id || activeEl?.getAttribute('data-focus-id');
  const selectionStart = activeEl?.selectionStart;
  const selectionEnd = activeEl?.selectionEnd;

  if (!wizard.open || !wizard.draft) {
    // Close wizard - remove overlay
    if (overlay) overlay.remove();
    return;
  }

  const wizardHtml = renderWizardModal();

  if (overlay) {
    // Replace existing wizard content
    const temp = document.createElement('div');
    temp.innerHTML = wizardHtml;
    const newOverlay = temp.firstElementChild;
    if (newOverlay) {
      overlay.replaceWith(newOverlay);
    }
  } else {
    // Insert new wizard modal
    container.insertAdjacentHTML('beforeend', wizardHtml);
  }

  // Restore focus after re-render
  if (activeId) {
    const targetEl = document.getElementById(activeId) || document.querySelector(`[data-focus-id="${activeId}"]`);
    if (targetEl && (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'SELECT')) {
      setTimeout(() => {
        targetEl.focus();
        if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
          if (targetEl.setSelectionRange) {
            targetEl.setSelectionRange(selectionStart, selectionEnd);
          }
        }
      }, 0);
    }
  }
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
  const types = ['showModal', 'revealBranch', 'revealActivity', 'revealResource', 'revealRole', 'revealTab', 'unlockActivity', 'setFlag', 'incFlagCounter', 'logMessage'];
  return types.map(t => `<option value="${t}" ${current === t ? 'selected' : ''}>${t}</option>`).join('');
}

function renderEffectFields(fx, scope, idx) {
  switch (fx.type) {
    case 'showModal':
      return `<select onchange="_ws.updateEffect('${scope}', ${idx}, 'modalId', this.value)">
        <option value="">-- modal --</option>
        ${store.modals.map(m => `<option value="${safe(m.id)}" ${m.id === fx.modalId ? 'selected' : ''}>${safe(m.title || m.id)}</option>`).join('')}
      </select>`;
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
  const isCollapsed = collapsedOptions.has(uid);

  // Build summary info
  const hasStaff = option.requirements.staff.length > 0;
  const hasCosts = Object.keys(option.inputs.resources).length > 0 || Object.keys(option.inputs.items).length > 0;
  const resType = option.resolution.type;
  const summary = [];
  if (option.name) summary.push(option.name);
  if (hasStaff) summary.push(`${option.requirements.staff.length} staff`);
  if (hasCosts) summary.push('has costs');
  if (resType === 'weighted_outcomes') summary.push('weighted');
  const summaryText = summary.length > 0 ? summary.join(' • ') : 'no details yet';

  return `
    <div class="option-card ${isCollapsed ? 'collapsed' : ''}">
      <div class="option-head" onclick="_ws.toggleOptionCollapse(${uid})" style="cursor:pointer">
        <div class="flex" style="flex:1">
          <div class="badge">Option ${idx + 1}</div>
          <div class="muted" style="flex:1">${safe(option.optionId || 'no id yet')}</div>
          ${isCollapsed ? `<div class="muted" style="font-size:0.85rem;margin-left:12px">${summaryText}</div>` : ''}
          <div style="margin-left:12px;color:var(--muted);font-size:1.2rem;user-select:none">${isCollapsed ? '▸' : '▾'}</div>
        </div>
        <div class="flex" onclick="event.stopPropagation()">
          <label class="muted" style="margin:0">Repeatable?</label>
          <input type="checkbox" ${option.repeatable ? 'checked' : ''} onchange="_ws.updateOptionField(${uid}, 'repeatable', this.checked)">
          <button class="ghost small" onclick="_ws.removeOption(${uid})">remove</button>
        </div>
      </div>

      ${isCollapsed ? '' : `<div class="option-details">`}

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
      ${isCollapsed ? '' : '</div>'}
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

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function avgRange(value, fallback = 0) {
  if (value && typeof value === 'object') {
    const min = safeNumber(value.min, fallback);
    const max = safeNumber(value.max, fallback);
    return (min + max) / 2;
  }
  return safeNumber(value, fallback);
}

function scoreCondition(cond, weight = 1) {
  if (!cond || !cond.type) return 0;
  switch (cond.type) {
    case 'resourceGte': {
      const v = safeNumber(cond.value, 0);
      return weight * (2 + Math.log10(1 + Math.max(0, v)) * 8);
    }
    case 'itemGte': {
      const v = safeNumber(cond.value, 0);
      return weight * (3 + Math.log10(1 + Math.max(0, v)) * 10);
    }
    case 'staffStarsGte': {
      const v = safeNumber(cond.value, 0);
      return weight * (4 + Math.max(0, v) * 8);
    }
    case 'activityCompletedGte': {
      const v = safeNumber(cond.value, 0);
      return weight * (6 + Math.max(0, v) * 6);
    }
    case 'roleRevealed':
    case 'activityRevealed':
      return weight * 3;
    case 'flagIs':
      return weight * 2;
    default:
      return weight * 3;
  }
}

function scoreToLabel(score) {
  if (score <= 15) return 'Trivial';
  if (score <= 30) return 'Easy';
  if (score <= 50) return 'Moderate';
  if (score <= 70) return 'Hard';
  return 'Extreme';
}

function difficultyClass(score) {
  if (score <= 30) return 'good';
  if (score <= 60) return 'warn';
  return 'bad';
}

function computeDifficultyHint(activity) {
  if (!activity) {
    return {
      score: 0,
      label: '—',
      className: 'good',
      parts: { gates: 0, costs: 0, time: 0, risk: 0 }
    };
  }

  const parts = { gates: 0, costs: 0, time: 0, risk: 0 };

  // Activity-level gates
  (activity.visibleIf || []).forEach((c) => (parts.gates += scoreCondition(c, 0.8)));
  (activity.unlockIf || []).forEach((c) => (parts.gates += scoreCondition(c, 1.2)));

  const options = Array.isArray(activity.options) ? activity.options : [];
  if (!options.length) {
    return {
      score: 0,
      label: '—',
      className: 'good',
      parts
    };
  }

  let durationSum = 0;
  let durationCount = 0;

  options.forEach((opt) => {
    // Option-level gates
    (opt.visibleIf || []).forEach((c) => (parts.gates += scoreCondition(c, 0.6)));
    (opt.unlockIf || []).forEach((c) => (parts.gates += scoreCondition(c, 1.0)));

    // Requirements as gates (staff/items/buildings)
    const req = opt.requirements || {};
    (req.staff || []).forEach((s) => {
      const stars = safeNumber(s.starsMin, 0);
      const count = safeNumber(s.count, 1);
      if (stars > 0) parts.gates += stars * 7;
      if (count > 1) parts.gates += (count - 1) * 3;
    });
    (req.items || []).forEach((i) => {
      const count = safeNumber(i.count, 1);
      parts.gates += 4 + Math.log10(1 + Math.max(0, count)) * 8;
    });
    (req.buildings || []).forEach((b) => {
      const count = safeNumber(b.count, 1);
      parts.gates += 10 + Math.max(0, count - 1) * 8;
    });

    // Costs
    const inRes = opt.inputs?.resources || {};
    const inItems = opt.inputs?.items || {};
    const resCost = Object.values(inRes).reduce((sum, v) => sum + safeNumber(v, 0), 0);
    const itemCost = Object.values(inItems).reduce((sum, v) => sum + safeNumber(v, 0), 0);
    parts.costs += Math.log10(1 + Math.max(0, resCost)) * 10;
    parts.costs += Math.log10(1 + Math.max(0, itemCost)) * 12;

    // Time / pacing (duration + cooldown)
    const dur = safeNumber(opt.durationMs, 0);
    const cd = safeNumber(opt.cooldownMs, 0);
    if (dur > 0) {
      durationSum += dur + cd;
      durationCount += 1;
    }

    // Risk (heat/jail mainly)
    const res = opt.resolution || {};
    if (res.type === 'weighted_outcomes') {
      const outcomes = Array.isArray(res.outcomes) ? res.outcomes : [];
      const totalW = outcomes.reduce((sum, o) => sum + safeNumber(o.weight, 0), 0) || 1;
      let expectedHeat = 0;
      let expectedJailMin = 0;
      outcomes.forEach((o) => {
        const p = safeNumber(o.weight, 0) / totalW;
        expectedHeat += p * Math.max(0, avgRange(o.heatDelta, 0));
        expectedJailMin += p * (safeNumber(o.jail?.durationMs, 0) / 60000);
      });
      parts.risk += expectedHeat * 6 + expectedJailMin * 8;
    } else {
      parts.risk += Math.max(0, avgRange(res.heatDelta, 0)) * 4;
    }
  });

  const avgDurationMs = durationCount ? durationSum / durationCount : 0;
  parts.time = Math.log10(1 + Math.max(0, avgDurationMs / 10000)) * 18;

  const raw = parts.gates + parts.costs + parts.time + parts.risk;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    label: scoreToLabel(score),
    className: difficultyClass(score),
    parts: {
      gates: Math.round(parts.gates),
      costs: Math.round(parts.costs),
      time: Math.round(parts.time),
      risk: Math.round(parts.risk)
    }
  };
}

function renderDifficultyChip(difficulty) {
  if (!difficulty) return '';
  return `<span class="ws-chip ws-chip--difficulty ${safe(difficulty.className)}" title="Heuristic difficulty score">${safe(difficulty.label)} • ${safe(difficulty.score)}</span>`;
}

function renderDifficultyPreview(difficulty) {
  if (!difficulty) return '';
  const p = difficulty.parts || { gates: 0, costs: 0, time: 0, risk: 0 };
  return `
    <div class="ws-difficulty">
      <div class="ws-difficulty__head">
        <div class="ws-difficulty__title">Difficulty heuristic</div>
        ${renderDifficultyChip(difficulty)}
      </div>
      <div class="ws-difficulty__grid">
        <div class="ws-difficulty__item"><span class="muted">Gates</span><span>${safe(p.gates)}</span></div>
        <div class="ws-difficulty__item"><span class="muted">Costs</span><span>${safe(p.costs)}</span></div>
        <div class="ws-difficulty__item"><span class="muted">Time</span><span>${safe(p.time)}</span></div>
        <div class="ws-difficulty__item"><span class="muted">Risk</span><span>${safe(p.risk)}</span></div>
      </div>
      <div class="hint" style="font-size:0.82rem;margin-top:8px">Heuristic only. Use as a prompt to tune gates/costs/rewards.</div>
    </div>
  `;
}

function makeWizardDraft(preset = {}) {
  const defaultBranch = wizard.lastBranch || store.branches?.[0]?.id || 'street';
  const defaultResolution = wizard.lastResolutionType || 'ranged_outputs';

  return {
    id: preset.id || '',
    name: preset.name || '',
    description: preset.description || '',
    branchId: preset.branchId || defaultBranch,
    icon: preset.icon || '',
    tags: preset.tags || '',
    gates: preset.gates || [],
    optionName: preset.optionName || 'default',
    optionDescription: preset.optionDescription || '',
    durationMs: preset.durationMs ?? 10000,
    cooldownMs: preset.cooldownMs ?? 0,
    xp: preset.xp ?? 0,
    heatDelta: preset.heatDelta ?? 0,
    resolutionType: preset.resolutionType || defaultResolution,
    costs: preset.costs || [],
    outputs: preset.outputs || [],
    outcomes: preset.outcomes || [
      { name: 'Success', weight: 70, outputs: [], heatDelta: 5 },
      { name: 'Failure', weight: 30, outputs: [], heatDelta: 15 }
    ],
    effects: preset.effects || {
      revealBranch: [],
      revealResource: [],
      revealActivity: [],
      unlockActivity: []
    }
  };
}

function normalizeWizardDraft(draft) {
  const effects = draft?.effects || {};
  const effectsList = [];

  (effects.revealBranch || []).forEach((branchId) => {
    const id = String(branchId || '').trim();
    if (id) effectsList.push({ type: 'revealBranch', branchId: id });
  });
  (effects.revealResource || []).forEach((resourceId) => {
    const id = String(resourceId || '').trim();
    if (id) effectsList.push({ type: 'revealResource', resourceId: id });
  });
  (effects.revealActivity || []).forEach((activityId) => {
    const id = String(activityId || '').trim();
    if (id) effectsList.push({ type: 'revealActivity', activityId: id });
  });
  (effects.unlockActivity || []).forEach((activityId) => {
    const id = String(activityId || '').trim();
    if (id) effectsList.push({ type: 'unlockActivity', activityId: id });
  });

  const allowedResolution = ['deterministic', 'ranged_outputs', 'weighted_outcomes'].includes(draft?.resolutionType)
    ? draft.resolutionType
    : 'ranged_outputs';

  const outcomesList = Array.isArray(draft?.outcomes) ? draft.outcomes.map((outcome) => ({
    name: String(outcome.name || 'Outcome').trim(),
    weight: safeNumber(outcome.weight, 10),
    heatDelta: safeNumber(outcome.heatDelta, 0),
    outputs: Array.isArray(outcome.outputs) ? outcome.outputs.map((o) => ({
      id: String(o.id || '').trim(),
      min: safeNumber(o.min, 0),
      max: safeNumber(o.max, safeNumber(o.min, 0))
    })) : []
  })) : [];

  return {
    id: String(draft?.id || '').trim(),
    name: String(draft?.name || '').trim(),
    description: String(draft?.description || '').trim(),
    branchId: String(draft?.branchId || 'street').trim() || 'street',
    icon: String(draft?.icon || '').trim(),
    tags: String(draft?.tags || '').trim(),
    gates: Array.isArray(draft?.gates) ? draft.gates.map((g) => ({
      scope: g.scope === 'visibleIf' ? 'visibleIf' : 'unlockIf',
      type: 'resourceGte',
      resourceId: String(g.resourceId || '').trim(),
      value: safeNumber(g.value, 0)
    })) : [],
    optionName: String(draft?.optionName || 'default').trim() || 'default',
    optionDescription: String(draft?.optionDescription || '').trim(),
    durationMs: safeNumber(draft?.durationMs, 10000),
    cooldownMs: safeNumber(draft?.cooldownMs, 0),
    xp: safeNumber(draft?.xp, 0),
    heatDelta: safeNumber(draft?.heatDelta, 0),
    resolutionType: allowedResolution,
    costs: Array.isArray(draft?.costs) ? draft.costs.map((c) => ({
      id: String(c.id || '').trim(),
      amount: safeNumber(c.amount, 0)
    })) : [],
    outputs: Array.isArray(draft?.outputs) ? draft.outputs.map((o) => ({
      id: String(o.id || '').trim(),
      min: safeNumber(o.min, 0),
      max: safeNumber(o.max, safeNumber(o.min, 0))
    })) : [],
    outcomesList,
    effectsList
  };
}

function inflateWizardEffect(effect) {
  return { ...defaultEffect(), ...(effect || {}) };
}

function wizardDraftToActivity(draft) {
  // Convert normalized draft to activity structure for difficulty calculation
  const activity = {
    id: draft.id || 'temp',
    visibleIf: [],
    unlockIf: [],
    options: []
  };

  draft.gates.forEach((g) => {
    if (!g.resourceId) return;
    const c = { type: 'resourceGte', resourceId: g.resourceId, value: g.value };
    if (g.scope === 'visibleIf') activity.visibleIf.push(c);
    else activity.unlockIf.push(c);
  });

  const opt = {
    durationMs: draft.durationMs,
    cooldownMs: draft.cooldownMs,
    xp: draft.xp,
    requirements: { staff: [], items: [], buildings: [] },
    inputs: { resources: {} },
    resolution: {
      type: draft.resolutionType,
      heatDelta: { min: draft.heatDelta, max: draft.heatDelta },
      outputs: { resources: {} },
      outcomes: []
    }
  };

  draft.costs.forEach((c) => {
    if (c.id) opt.inputs.resources[c.id] = c.amount;
  });

  if (draft.resolutionType === 'weighted_outcomes') {
    // Build outcomes for difficulty calculation
    opt.resolution.outcomes = (draft.outcomesList || []).map((o) => ({
      weight: o.weight,
      heatDelta: { min: o.heatDelta, max: o.heatDelta },
      jail: null,
      outputs: { resources: {} }
    }));
    draft.outcomesList.forEach((outcome, idx) => {
      outcome.outputs.forEach((o) => {
        if (o.id) opt.resolution.outcomes[idx].outputs.resources[o.id] = { min: o.min, max: o.max };
      });
    });
  } else {
    draft.outputs.forEach((o) => {
      if (o.id) opt.resolution.outputs.resources[o.id] = { min: o.min, max: o.max };
    });
  }

  activity.options.push(opt);
  return activity;
}

function computeWizardWarnings(draft, difficulty) {
  const warnings = [];

  const hasOutputs = draft.resolutionType === 'weighted_outcomes'
    ? (draft.outcomesList || []).some((o) => o.outputs.length > 0)
    : draft.outputs.length > 0;

  // No costs check
  if (draft.costs.length === 0 && hasOutputs) {
    warnings.push('Activity has rewards but no costs (free money?)');
  }

  // No outputs check
  if (!hasOutputs && draft.costs.length > 0) {
    warnings.push('Activity has costs but no outputs (waste of resources?)');
  }

  // Weighted outcomes specific warnings
  if (draft.resolutionType === 'weighted_outcomes') {
    const totalWeight = (draft.outcomesList || []).reduce((sum, o) => sum + (o.weight || 0), 0);
    if (totalWeight === 0) {
      warnings.push('Total outcome weight is 0 (outcomes will never trigger)');
    }
  }

  // High heat, no gates
  if (draft.heatDelta > 10 && draft.gates.length === 0) {
    warnings.push('High heat activity with no unlock gates (too easy?)');
  }

  // Very high difficulty
  if (difficulty.score > 70) {
    warnings.push('Very high difficulty - players may struggle to reach this');
  }

  // No XP reward
  if (draft.xp === 0 && draft.outputs.length > 0) {
    warnings.push('Activity has rewards but grants no XP');
  }

  // Long duration + long cooldown
  const totalTime = draft.durationMs + draft.cooldownMs;
  if (totalTime > 120000) {
    warnings.push('Very long total time (duration + cooldown > 2min)');
  }

  return warnings;
}

function renderWizardModal() {
  if (!wizard.open || !wizard.draft) return '';

  const step = WIZARD_STEPS[wizard.step] || WIZARD_STEPS[0];
  const isFirst = wizard.step <= 0;
  const isLast = wizard.step >= WIZARD_STEPS.length - 1;

  // Compute live difficulty and warnings
  const draft = normalizeWizardDraft(wizard.draft);
  const tempActivity = wizardDraftToActivity(draft);
  const difficulty = computeDifficultyHint(tempActivity);
  const warnings = computeWizardWarnings(draft, difficulty);

  return `
    <div class="ws-modal-overlay">
      <div class="ws-modal" role="dialog" aria-modal="true">
        <div class="ws-modal__head">
          <div>
            <div class="ws-modal__title">Activity Wizard</div>
            <div class="ws-modal__subtitle">${safe(step.title)}</div>
          </div>
          <button class="ghost small" onclick="_ws.wizClose()">Close</button>
        </div>

        <div class="ws-modal__steps">
          ${WIZARD_STEPS.map((s, idx) => `
            <div class="ws-step ${idx === wizard.step ? 'active' : ''}">
              <span class="ws-step__dot"></span>
              <span>${safe(s.title)}</span>
            </div>
          `).join('')}
        </div>

        <div class="ws-modal__body">
          ${renderWizardStep(step.id)}
        </div>

        <div class="ws-modal__footer">
          <button class="ghost" ${isFirst ? 'disabled' : ''} onclick="_ws.wizBack()">Back</button>
          <div style="flex:1;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            ${wizard.step > 0 ? renderDifficultyChip(difficulty) : ''}
            ${warnings.length > 0 ? `<span class="muted" style="font-size:0.8rem" title="${warnings.join('; ')}">\u26A0 ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}</span>` : ''}
          </div>
          ${isLast
            ? `<button onclick="_ws.wizCreate()">Create Draft</button>`
            : `<button onclick="_ws.wizNext()">Next</button>`}
        </div>
      </div>
    </div>
  `;
}

function renderWizardStep(id) {
  switch (id) {
    case 'template':
      return renderWizardTemplate();
    case 'identity':
      return renderWizardIdentity(wizard.draft);
    case 'gates':
      return renderWizardGates(wizard.draft);
    case 'option':
      return renderWizardOption(wizard.draft);
    case 'effects':
      return renderWizardEffects(wizard.draft);
    default:
      return renderWizardTemplate();
  }
}

function renderWizardTemplate() {
  const selected = wizard.selectedTemplate || 'blank';

  return `
    <div class="hint" style="margin-bottom:16px">Choose a template to start with. Templates pre-fill common patterns and can be customized in the next steps.</div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px">
      ${Object.entries(WIZARD_TEMPLATES).map(([id, template]) => {
        const isSelected = selected === id;
        return `
        <div
          class="wizard-template-card"
          onclick="_ws.wizSelectTemplate('${id}')"
          style="
            cursor:pointer;
            padding:16px;
            border:2px solid ${isSelected ? 'var(--accent-bright)' : 'var(--border)'};
            border-radius:var(--radius-md);
            background:${isSelected ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.02)'};
            transition:all var(--transition-base);
            position:relative;
            overflow:hidden;
          "
          onmouseenter="this.style.borderColor='var(--accent)';this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow-md)'"
          onmouseleave="this.style.borderColor='${isSelected ? 'var(--accent-bright)' : 'var(--border)'}';this.style.transform='translateY(0)';this.style.boxShadow='none'"
        >
          ${isSelected ? '<div style="position:absolute;top:8px;right:8px;color:var(--accent-bright);font-size:1.2rem">✓</div>' : ''}
          <div style="font-weight:700;margin-bottom:8px;color:${isSelected ? 'var(--accent-bright)' : 'var(--text)'};font-size:1rem">${safe(template.name)}</div>
          <div class="muted" style="font-size:0.88rem;line-height:1.5">${safe(template.description)}</div>
        </div>
      `;
      }).join('')}
    </div>
  `;
}

function renderWizardIdentity(draft) {
  return `
    <div class="input-grid two-col">
      <div>
        <label>Activity ID</label>
        <input type="text" data-focus-id="wiz-id" value="${safe(draft.id)}" placeholder="shoplifting" oninput="_ws.wizSet('id', this.value)">
        <div class="hint" style="font-size:0.8rem;margin-top:6px">Unique key. Use lowercase + underscores.</div>
      </div>
      <div>
        <label>Branch</label>
        <select data-focus-id="wiz-branch" onchange="_ws.wizSet('branchId', this.value)">
          ${store.branches.map(b => `<option value="${safe(b.id)}" ${draft.branchId === b.id ? 'selected' : ''}>${safe(b.name || b.id)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label>Name</label>
        <input type="text" data-focus-id="wiz-name" value="${safe(draft.name)}" placeholder="shoplifting" oninput="_ws.wizSet('name', this.value)">
      </div>
      <div>
        <label>Icon</label>
        <input type="text" data-focus-id="wiz-icon" value="${safe(draft.icon)}" placeholder="(optional)" oninput="_ws.wizSet('icon', this.value)">
      </div>
      <div style="grid-column:1 / -1">
        <label>Description</label>
        <textarea data-focus-id="wiz-desc" oninput="_ws.wizSet('description', this.value)">${safe(draft.description)}</textarea>
      </div>
      <div style="grid-column:1 / -1">
        <label>Tags (comma separated)</label>
        <input type="text" data-focus-id="wiz-tags" value="${safe(draft.tags)}" placeholder="crime, starter" oninput="_ws.wizSet('tags', this.value)">
      </div>
    </div>
  `;
}

function renderWizardGates(draft) {
  const list = Array.isArray(draft.gates) ? draft.gates : [];
  return `
    <div class="subheader">
      <span>Unlock Gates</span>
      <button class="ghost small" onclick="_ws.wizAddGate()">+ gate</button>
    </div>
    ${list.length ? list.map((g, idx) => `
      <div class="pill">
        <div class="pill-row" style="justify-content:space-between">
          <div class="pill-row" style="flex:1">
            <select style="width:140px" onchange="_ws.wizSetGate(${idx}, 'scope', this.value)">
              <option value="unlockIf" ${g.scope === 'unlockIf' ? 'selected' : ''}>unlockIf</option>
              <option value="visibleIf" ${g.scope === 'visibleIf' ? 'selected' : ''}>visibleIf</option>
            </select>
            <select onchange="_ws.wizSetGate(${idx}, 'resourceId', this.value)">${renderResourceOptions(g.resourceId)}</select>
            <input type="number" style="width:120px" value="${safe(g.value)}" placeholder="value" oninput="_ws.wizSetGate(${idx}, 'value', parseInt(this.value,10)||0)">
          </div>
          <button class="ghost small" onclick="_ws.wizRemoveGate(${idx})">remove</button>
        </div>
      </div>
    `).join('') : '<div class="hint">No gates. This activity will be available immediately.</div>'}

    <div class="hint" style="margin-top:10px;padding:10px;background:rgba(125,211,252,0.08);border:1px solid rgba(125,211,252,0.2);border-radius:var(--radius-sm)">
      <strong>Note:</strong> The wizard only supports resource-based gates (resourceGte). After creating the draft, you can add:
      <ul style="margin:6px 0 0 20px;font-size:0.9em">
        <li>Staff requirements (staffStarsGte)</li>
        <li>Activity completion gates (activityCompletedGte)</li>
        <li>Item requirements (itemGte)</li>
        <li>Flag checks (flagIs)</li>
      </ul>
    </div>
  `;
}

function renderWizardOption(draft) {
  const costs = Array.isArray(draft.costs) ? draft.costs : [];
  const outputs = Array.isArray(draft.outputs) ? draft.outputs : [];
  const outcomes = Array.isArray(draft.outcomes) ? draft.outcomes : [];
  const isWeightedOutcomes = draft.resolutionType === 'weighted_outcomes';
  const isDeterministic = draft.resolutionType === 'deterministic';

  return `
    <div class="hint" style="margin-bottom:12px">This wizard creates a single option. Add additional options after creating the draft.</div>

    <div class="input-grid two-col">
      <div>
        <label>Option Name</label>
        <input type="text" data-focus-id="wiz-opt-name" value="${safe(draft.optionName)}" oninput="_ws.wizSet('optionName', this.value)">
      </div>
      <div>
        <label>Resolution Type</label>
        <select data-focus-id="wiz-res-type" onchange="_ws.wizSet('resolutionType', this.value)">
          <option value="deterministic" ${draft.resolutionType === 'deterministic' ? 'selected' : ''}>deterministic (exact amounts)</option>
          <option value="ranged_outputs" ${draft.resolutionType === 'ranged_outputs' ? 'selected' : ''}>ranged_outputs (min/max)</option>
          <option value="weighted_outcomes" ${draft.resolutionType === 'weighted_outcomes' ? 'selected' : ''}>weighted_outcomes (success/fail)</option>
        </select>
        <div class="hint" style="font-size:0.78rem;margin-top:4px">${
          isWeightedOutcomes ? 'Configure success/failure outcomes below' :
          isDeterministic ? 'Always gives exact amounts' :
          'Random amounts between min and max'
        }</div>
      </div>
      <div style="grid-column:1 / -1">
        <label>Option Description</label>
        <textarea data-focus-id="wiz-opt-desc" oninput="_ws.wizSet('optionDescription', this.value)">${safe(draft.optionDescription)}</textarea>
      </div>

      <div>
        <label>Duration (ms)</label>
        <input type="number" data-focus-id="wiz-duration" value="${safe(draft.durationMs)}" oninput="_ws.wizSet('durationMs', parseInt(this.value,10)||0)">
      </div>
      <div>
        <label>Cooldown (ms)</label>
        <input type="number" data-focus-id="wiz-cooldown" value="${safe(draft.cooldownMs)}" oninput="_ws.wizSet('cooldownMs', parseInt(this.value,10)||0)">
      </div>
      <div>
        <label>XP on Complete</label>
        <input type="number" data-focus-id="wiz-xp" value="${safe(draft.xp)}" oninput="_ws.wizSet('xp', parseInt(this.value,10)||0)">
      </div>
      ${isWeightedOutcomes ? '' : `
      <div>
        <label>Heat Delta</label>
        <input type="number" data-focus-id="wiz-heat" value="${safe(draft.heatDelta)}" oninput="_ws.wizSet('heatDelta', parseInt(this.value,10)||0)">
      </div>
      `}
    </div>

    <div style="margin-top:14px">
      <div class="subheader">
        <span>Costs (inputs)</span>
        <button class="ghost small" onclick="_ws.wizAddCost()">+ cost</button>
      </div>
      ${costs.length ? costs.map((c, idx) => `
        <div class="pill">
          <div class="pill-row" style="justify-content:space-between">
            <div class="pill-row" style="flex:1">
              <select onchange="_ws.wizSetCost(${idx}, 'id', this.value)">${renderResourceOptions(c.id)}</select>
              <input type="number" style="width:120px" value="${safe(c.amount)}" oninput="_ws.wizSetCost(${idx}, 'amount', parseInt(this.value,10)||0)">
            </div>
            <button class="ghost small" onclick="_ws.wizRemoveCost(${idx})">remove</button>
          </div>
        </div>
      `).join('') : '<div class="hint">No resource costs.</div>'}
    </div>

    ${isWeightedOutcomes ? renderWizardOutcomes(outcomes) : `
    <div style="margin-top:14px">
      <div class="subheader">
        <span>Outputs (rewards)</span>
        <button class="ghost small" onclick="_ws.wizAddOutput()">+ output</button>
      </div>
      ${outputs.length ? outputs.map((o, idx) => `
        <div class="pill">
          <div class="pill-row" style="justify-content:space-between">
            <div class="pill-row" style="flex:1">
              <select onchange="_ws.wizSetOutput(${idx}, 'id', this.value)">${renderResourceOptions(o.id)}</select>
              ${isDeterministic ? `
                <input type="number" style="width:120px" value="${safe(o.min || o.max || 0)}" placeholder="amount" oninput="_ws.wizSetOutput(${idx}, 'min', parseInt(this.value,10)||0); _ws.wizSetOutput(${idx}, 'max', parseInt(this.value,10)||0)">
              ` : `
                <input type="number" style="width:100px" value="${safe(o.min)}" placeholder="min" oninput="_ws.wizSetOutput(${idx}, 'min', parseInt(this.value,10)||0)">
                <input type="number" style="width:100px" value="${safe(o.max)}" placeholder="max" oninput="_ws.wizSetOutput(${idx}, 'max', parseInt(this.value,10)||0)">
              `}
            </div>
            <button class="ghost small" onclick="_ws.wizRemoveOutput(${idx})">remove</button>
          </div>
        </div>
      `).join('') : '<div class="hint">No outputs set yet.</div>'}
    </div>
    `}
  `;
}

function renderWizardOutcomes(outcomes) {
  return `
    <div style="margin-top:14px">
      <div class="subheader">
        <span>Outcomes (weighted)</span>
        <button class="ghost small" onclick="_ws.wizAddOutcome()">+ outcome</button>
      </div>
      ${outcomes.map((outcome, outcomeIdx) => `
        <div class="panel" style="margin-top:10px;padding:12px;background:rgba(255,255,255,0.02)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="flex:1;display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px">
              <input type="text" value="${safe(outcome.name)}" placeholder="Outcome name" oninput="_ws.wizSetOutcome(${outcomeIdx}, 'name', this.value)">
              <input type="number" value="${safe(outcome.weight)}" placeholder="weight" oninput="_ws.wizSetOutcome(${outcomeIdx}, 'weight', parseInt(this.value,10)||0)" style="width:100%">
              <input type="number" value="${safe(outcome.heatDelta)}" placeholder="heat" oninput="_ws.wizSetOutcome(${outcomeIdx}, 'heatDelta', parseInt(this.value,10)||0)" style="width:100%">
            </div>
            <button class="ghost small" onclick="_ws.wizRemoveOutcome(${outcomeIdx})" ${outcomes.length <= 1 ? 'disabled' : ''}>remove</button>
          </div>

          <div style="margin-top:8px">
            <div class="subheader" style="font-size:0.8rem;margin-bottom:6px">
              <span>Outputs</span>
              <button class="ghost small" onclick="_ws.wizAddOutcomeOutput(${outcomeIdx})">+ output</button>
            </div>
            ${(outcome.outputs || []).length ? (outcome.outputs || []).map((o, outputIdx) => `
              <div class="pill" style="margin-top:4px">
                <div class="pill-row" style="justify-content:space-between">
                  <div class="pill-row" style="flex:1">
                    <select onchange="_ws.wizSetOutcomeOutput(${outcomeIdx}, ${outputIdx}, 'id', this.value)">${renderResourceOptions(o.id)}</select>
                    <input type="number" style="width:80px" value="${safe(o.min)}" placeholder="min" oninput="_ws.wizSetOutcomeOutput(${outcomeIdx}, ${outputIdx}, 'min', parseInt(this.value,10)||0)">
                    <input type="number" style="width:80px" value="${safe(o.max)}" placeholder="max" oninput="_ws.wizSetOutcomeOutput(${outcomeIdx}, ${outputIdx}, 'max', parseInt(this.value,10)||0)">
                  </div>
                  <button class="ghost small" onclick="_ws.wizRemoveOutcomeOutput(${outcomeIdx}, ${outputIdx})">×</button>
                </div>
              </div>
            `).join('') : '<div class="hint" style="font-size:0.8rem">No outputs for this outcome.</div>'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderWizardEffects(draft) {
  const fx = draft.effects || {};
  const branches = store.branches || [];
  const activities = store.activities || [];

  const renderIdList = (type, label, items, renderSelect) => `
    <div style="margin-top:12px">
      <div class="subheader">
        <span>${safe(label)}</span>
        <button class="ghost small" onclick="_ws.wizAddEffect('${type}')">+ add</button>
      </div>
      ${(items || []).length ? (items || []).map((id, idx) => `
        <div class="pill">
          <div class="pill-row" style="justify-content:space-between">
            <div style="flex:1">${renderSelect(id, idx)}</div>
            <button class="ghost small" onclick="_ws.wizRemoveEffect('${type}', ${idx})">remove</button>
          </div>
        </div>
      `).join('') : '<div class="hint">None.</div>'}
    </div>
  `;

  return `
    <div class="hint">These effects apply when the first option completes.</div>

    ${renderIdList('revealBranch', 'Reveal Branch', fx.revealBranch, (id, idx) => `
      <select onchange="_ws.wizSetEffect('revealBranch', ${idx}, this.value)">
        <option value="">-- branch --</option>
        ${branches.map(b => `<option value="${safe(b.id)}" ${b.id === id ? 'selected' : ''}>${safe(b.name || b.id)}</option>`).join('')}
      </select>
    `)}

    ${renderIdList('revealResource', 'Reveal Resource', fx.revealResource, (id, idx) => `
      <select onchange="_ws.wizSetEffect('revealResource', ${idx}, this.value)">${renderResourceOptions(id)}</select>
    `)}

    ${renderIdList('revealActivity', 'Reveal Activity', fx.revealActivity, (id, idx) => `
      <select onchange="_ws.wizSetEffect('revealActivity', ${idx}, this.value)">
        <option value="">-- activity --</option>
        ${activities.map(a => `<option value="${safe(a.id)}" ${a.id === id ? 'selected' : ''}>${safe(a.id)}</option>`).join('')}
      </select>
    `)}

    ${renderIdList('unlockActivity', 'Unlock Activity', fx.unlockActivity, (id, idx) => `
      <select onchange="_ws.wizSetEffect('unlockActivity', ${idx}, this.value)">
        <option value="">-- activity --</option>
        ${activities.map(a => `<option value="${safe(a.id)}" ${a.id === id ? 'selected' : ''}>${safe(a.id)}</option>`).join('')}
      </select>
    `)}
  `;
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
