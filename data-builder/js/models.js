import { numberOrDefault, cleanObject, cloneJson, kvToObject, kvListFromObject, toRangeFields, rangeValue, parseTags, parseModifiers } from './utils.js';

let optionUid = 1;

export function nextOptionUid() {
  return optionUid++;
}

export function resetOptionUid() {
  optionUid = 1;
}

// ── Factory functions ──

export function createActivity() {
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

export function createOption() {
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

export function createResolution(type) {
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

export function createOutcome(id = 'outcome', weight = 50) {
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

export function defaultCondition() {
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

export function defaultEffect() {
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

// ── Serialization (editor state → JSON) ──

export function buildActivityJson(state) {
  const tags = parseTags(state.tags);
  const activityId = state.id || 'untitled_activity';

  return {
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
}

export function normalizeOption(opt, activityId, idx) {
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

export function buildResolution(res) {
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

export function normalizeCondition(cond) {
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

export function normalizeEffect(effect) {
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

// ── Deserialization (JSON → editor state) ──

export function inflateOption(opt) {
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

export function inflateResolution(resolution) {
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

// ── Validation ──

export function validateActivity(activity) {
  const errors = [];

  if (!activity.id || !activity.id.trim()) {
    errors.push('Activity ID is required');
  }

  if (!activity.name || !activity.name.trim()) {
    errors.push('Activity name is required');
  }

  const optionIds = new Set();
  activity.options.forEach((opt, idx) => {
    if (!opt.id || !opt.id.trim()) {
      errors.push(`Option ${idx + 1} has no ID`);
    } else if (optionIds.has(opt.id)) {
      errors.push(`Duplicate option ID: ${opt.id}`);
    } else {
      optionIds.add(opt.id);
    }

    if (!opt.requirements.staff.length) {
      errors.push(`Option ${opt.id || idx + 1} has no staff requirements`);
    }

    if (opt.resolution.type === 'weighted_outcomes') {
      const totalWeight = opt.resolution.outcomes.reduce((sum, out) => sum + (out.weight || 0), 0);
      if (totalWeight === 0) {
        errors.push(`Option ${opt.id || idx + 1} has outcomes with zero total weight`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}
