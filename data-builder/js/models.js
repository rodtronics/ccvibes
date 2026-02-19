import { numberOrDefault, cleanObject, cloneJson, kvToObject, kvListFromObject, toRangeFields, rangeValue, parseTags, parseModifiers } from './utils.js';

let variantUid = 1;

export function nextVariantUid() {
  return variantUid++;
}

export function resetVariantUid() {
  variantUid = 1;
}

// ── Factory functions ──

export function createScenario() {
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

export function createVariant() {
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
    scenarioId: '',
    key: '',
    value: 0,
    bool: true
  };
}

export function defaultEffect() {
  return {
    type: 'revealScenario',
    scenarioId: '',
    branchId: '',
    resourceId: '',
    roleId: '',
    tabId: '',
    modalId: '',
    key: '',
    value: '',
    text: '',
    kind: ''
  };
}

// ── Serialization (editor state → JSON) ──

export function buildScenarioJson(state) {
  const tags = parseTags(state.tags);
  const scenarioId = state.id || 'untitled_scenario';

  return {
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
}

export function normalizeVariant(variant, scenarioId, idx) {
  const variantId = variant.variantId || `${scenarioId}_variant_${idx + 1}`;
  const modifiers = parseModifiers(variant.modifiersText);
  const data = {
    id: variantId,
    name: variant.name || `variant_${idx + 1}`,
    description: variant.description || '',
    visibleIf: variant.visibleIf.map(normalizeCondition),
    unlockIf: variant.unlockIf.map(normalizeCondition),
    requirements: {
      staff: variant.requirements.staff.map(s => cleanObject({
        roleId: s.roleId || 'player',
        count: numberOrDefault(s.count, 1),
        starsMin: numberOrDefault(s.starsMin, 0),
        required: s.required !== false,
        bonus: s.bonus || undefined
      })),
      items: variant.requirements.items.map(i => cleanObject({
        itemId: i.itemId || '',
        count: numberOrDefault(i.count, 1)
      })),
      buildings: variant.requirements.buildings.map(b => cleanObject({
        buildingId: b.buildingId || '',
        count: numberOrDefault(b.count, 1)
      }))
    },
    inputs: {
      resources: kvToObject(variant.inputs.resources, 'amount'),
      items: kvToObject(variant.inputs.items, 'amount')
    },
    durationMs: numberOrDefault(variant.durationMs, 10000),
    xpRewards: { onComplete: numberOrDefault(variant.xp, 0) },
    resolution: buildResolution(variant.resolution),
    modifiers: modifiers,
    cooldownMs: numberOrDefault(variant.cooldownMs, 0)
  };

  if (variant.repeatable) data.repeatable = true;
  if (variant.maxConcurrentRuns) data.maxConcurrentRuns = Number(variant.maxConcurrentRuns);

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

export function normalizeEffect(effect) {
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

// ── Deserialization (JSON → editor state) ──

export function inflateVariant(variant) {
  const variantState = createVariant();
  const reqs = variant.requirements || {};

  variantState.variantId = variant.id || '';
  variantState.name = variant.name || '';
  variantState.description = variant.description || '';
  variantState.repeatable = !!variant.repeatable;
  variantState.maxConcurrentRuns = variant.maxConcurrentRuns ?? '';
  variantState.visibleIf = cloneJson(variant.visibleIf || []);
  variantState.unlockIf = cloneJson(variant.unlockIf || []);
  variantState.requirements = {
    staff: inflateStaffRequirements(reqs.staff),
    items: inflateRequirementList(reqs.items, 'itemId'),
    buildings: inflateRequirementList(reqs.buildings, 'buildingId')
  };
  variantState.inputs = {
    resources: kvListFromObject(variant.inputs?.resources, 'amount'),
    items: kvListFromObject(variant.inputs?.items, 'amount', 'itemId')
  };
  variantState.durationMs = numberOrDefault(variant.durationMs, 10000);
  variantState.xp = numberOrDefault(variant.xpRewards?.onComplete ?? variant.xpReward ?? variant.xp, 0);
  variantState.cooldownMs = numberOrDefault(variant.cooldownMs, 0);
  variantState.resolution = inflateResolution(variant.resolution);
  variantState.modifiersText = Array.isArray(variant.modifiers) && variant.modifiers.length
    ? JSON.stringify(variant.modifiers, null, 2)
    : '';

  return variantState;
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

export function validateScenario(scenario) {
  const errors = [];

  if (!scenario.id || !scenario.id.trim()) {
    errors.push('Scenario ID is required');
  }

  if (!scenario.name || !scenario.name.trim()) {
    errors.push('Scenario name is required');
  }

  const variantIds = new Set();
  scenario.variants.forEach((variant, idx) => {
    if (!variant.id || !variant.id.trim()) {
      errors.push(`Variant ${idx + 1} has no ID`);
    } else if (variantIds.has(variant.id)) {
      errors.push(`Duplicate variant ID: ${variant.id}`);
    } else {
      variantIds.add(variant.id);
    }

    if (!variant.requirements.staff.length) {
      errors.push(`Variant ${variant.id || idx + 1} has no staff requirements`);
    }

    if (variant.resolution.type === 'weighted_outcomes') {
      const totalWeight = variant.resolution.outcomes.reduce((sum, out) => sum + (out.weight || 0), 0);
      if (totalWeight === 0) {
        errors.push(`Variant ${variant.id || idx + 1} has outcomes with zero total weight`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}
