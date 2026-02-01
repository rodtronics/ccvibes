// Central data store — all tabs read/write from here
export const store = {
  // Raw data arrays from server
  activities: [],
  resources: [],
  branches: [],
  roles: [],
  perks: {},
  // items merged into resources

  // Lookup maps (rebuilt on load/mutation)
  resourceMap: new Map(),
  branchMap: new Map(),
  roleMap: new Map(),
  activityMap: new Map(),

  // Editor state
  selectedActivityId: null,
  selectedResourceId: null,
  selectedBranchId: null,

  // Dirty tracking per file
  dirty: {
    activities: false,
    resources: false,
    branches: false
  },

  // Last saved snapshots for change detection
  savedSnapshots: {
    activities: null,
    resources: null,
    branches: null
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
  store.activityMap = new Map(store.activities.map(a => [a.id, a]));
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
