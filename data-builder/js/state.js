// Central data store — all tabs read/write from here
export const store = {
  // Raw data arrays from server
  scenarios: [],
  resources: [],
  branches: [],
  roles: [],
  perks: {},
  modals: [],
  // items merged into resources

  // Lookup maps (rebuilt on load/mutation)
  resourceMap: new Map(),
  branchMap: new Map(),
  roleMap: new Map(),
  scenarioMap: new Map(),
  modalMap: new Map(),

  // Editor state
  selectedScenarioId: null,
  selectedResourceId: null,
  selectedBranchId: null,
  selectedRoleId: null,
  selectedPerkId: null,
  selectedModalId: null,

  // Dirty tracking per file
  dirty: {
    scenarios: false,
    resources: false,
    branches: false,
    roles: false,
    perks: false,
    modals: false
  },

  // Last saved snapshots for change detection
  savedSnapshots: {
    scenarios: null,
    resources: null,
    branches: null,
    roles: null,
    perks: null,
    modals: null
  },

  // Server status
  serverOnline: false,
  loaded: false
};

// Rebuild lookup maps from arrays
export function rebuildMaps() {
  store.resourceMap = new Map(store.resources.map(r => [r.id, r]));
  store.branchMap = new Map(store.branches.map(b => [b.id, b]));
  store.roleMap = new Map(store.roles.map(r => [r.id, r]));
  store.scenarioMap = new Map(store.scenarios.map(a => [a.id, a]));
  store.modalMap = new Map(store.modals.map(m => [m.id, m]));
}

// ── Event bus ──

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
}

export function off(event, fn) {
  const list = listeners.get(event);
  if (!list) return;
  const idx = list.indexOf(fn);
  if (idx >= 0) list.splice(idx, 1);
}

export function emit(event, data) {
  (listeners.get(event) || []).forEach(fn => {
    try { fn(data); } catch (e) { console.error(`Event handler error [${event}]:`, e); }
  });
}

// Branch colors for UI
const BRANCH_COLORS = {
  primordial: '#7dd3fc',
  street: '#f87171',
  drugs: '#34d399',
  grift: '#fbbf24',
  corruption: '#f472b6',
  tech: '#60a5fa',
  forbidden: '#a78bfa',
  commerce: '#fb923c'
};

export function getBranchColor(branchId) {
  return BRANCH_COLORS[branchId] || '#94a3b8';
}

// ── ID Rename Cascades ──
// When an entity ID changes, update all references across other data

export function cascadeBranchRename(oldId, newId) {
  // Update scenarios referencing this branch
  store.scenarios.forEach(a => {
    if (a.branchId === oldId) a.branchId = newId;
  });
  // Update resources referencing this branch
  store.resources.forEach(r => {
    if (r.branchId === oldId) r.branchId = newId;
  });
}

export function cascadeRoleRename(oldId, newId) {
  // Update staff requirements in all scenario variants
  store.scenarios.forEach(a => {
    (a.variants || []).forEach(opt => {
      const staff = opt.requirements?.staff || [];
      staff.forEach(s => {
        if (s.roleId === oldId) s.roleId = newId;
      });
    });
  });
}

export function cascadeResourceRename(oldId, newId) {
  store.scenarios.forEach(a => {
    // Update conditions
    (a.visibleIf || []).forEach(c => { if (c.resourceId === oldId) c.resourceId = newId; });
    (a.unlockIf || []).forEach(c => { if (c.resourceId === oldId) c.resourceId = newId; });
    // Update variants
    (a.variants || []).forEach(opt => {
      // Conditions
      (opt.visibleIf || []).forEach(c => { if (c.resourceId === oldId) c.resourceId = newId; });
      (opt.unlockIf || []).forEach(c => { if (c.resourceId === oldId) c.resourceId = newId; });
      // Inputs
      if (opt.inputs?.resources && oldId in opt.inputs.resources) {
        opt.inputs.resources[newId] = opt.inputs.resources[oldId];
        delete opt.inputs.resources[oldId];
      }
      if (opt.inputs?.items && oldId in opt.inputs.items) {
        opt.inputs.items[newId] = opt.inputs.items[oldId];
        delete opt.inputs.items[oldId];
      }
      // Outputs (deterministic)
      const res = opt.resolution;
      if (res) {
        if (res.outputs?.resources && oldId in res.outputs.resources) {
          res.outputs.resources[newId] = res.outputs.resources[oldId];
          delete res.outputs.resources[oldId];
        }
        if (res.outputs?.items && oldId in res.outputs.items) {
          res.outputs.items[newId] = res.outputs.items[oldId];
          delete res.outputs.items[oldId];
        }
        // Weighted outcomes
        (res.outcomes || []).forEach(out => {
          if (out.outputs?.resources && oldId in out.outputs.resources) {
            out.outputs.resources[newId] = out.outputs.resources[oldId];
            delete out.outputs.resources[oldId];
          }
          if (out.outputs?.items && oldId in out.outputs.items) {
            out.outputs.items[newId] = out.outputs.items[oldId];
            delete out.outputs.items[oldId];
          }
        });
      }
      // Effects
      (res?.effects || []).forEach(fx => { if (fx.resourceId === oldId) fx.resourceId = newId; });
    });
  });
}

export function cascadeModalRename(oldId, newId) {
  // Update showModal effects in scenarios
  store.scenarios.forEach(a => {
    const allEffects = [
      ...(a.reveals?.onReveal || []),
      ...(a.reveals?.onUnlock || [])
    ];
    (a.variants || []).forEach(opt => {
      const res = opt.resolution;
      if (res?.effects) allEffects.push(...res.effects);
      (res?.outcomes || []).forEach(out => {
        if (out.effects) allEffects.push(...out.effects);
      });
    });
    allEffects.forEach(fx => {
      if (fx.type === 'showModal' && fx.modalId === oldId) fx.modalId = newId;
    });
  });
}
