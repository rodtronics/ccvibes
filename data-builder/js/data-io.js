import { store, rebuildMaps, emit } from './state.js';

const FILES = [
  { key: 'activities', file: 'activities.json', isArray: true },
  { key: 'resources', file: 'resources.json', isArray: true },
  { key: 'branches', file: 'branches.json', isArray: true },
  { key: 'roles', file: 'roles.json', isArray: true },
  { key: 'perks', file: 'perks.json', isArray: false },
  { key: 'modals', file: 'modals.json', isArray: true }
  // items.json merged into resources.json
];

export async function checkServer() {
  try {
    const res = await fetch('/api/health');
    store.serverOnline = res.ok;
  } catch {
    store.serverOnline = false;
  }
  return store.serverOnline;
}

export async function loadAll() {
  const results = await Promise.allSettled(
    FILES.map(async ({ key, file, isArray }) => {
      const res = await fetch(`/api/data/${file}`);
      if (!res.ok) throw new Error(`Failed: ${file} (${res.status})`);
      const data = await res.json();
      return { key, data, isArray };
    })
  );

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      const { key, data, isArray } = result.value;
      if (isArray) {
        store[key] = Array.isArray(data) ? data : [];
      } else {
        store[key] = data || {};
      }
    } else {
      console.warn('Failed to load:', result.reason.message);
    }
  });

  // Save snapshots for dirty tracking
  store.savedSnapshots.activities = JSON.stringify(store.activities);
  store.savedSnapshots.resources = JSON.stringify(store.resources);
  store.savedSnapshots.branches = JSON.stringify(store.branches);
  store.savedSnapshots.roles = JSON.stringify(store.roles);
  store.savedSnapshots.perks = JSON.stringify(store.perks);
  store.savedSnapshots.modals = JSON.stringify(store.modals);

  rebuildMaps();
  store.loaded = true;
  emit('data-loaded');
}

export async function saveFile(key) {
  const entry = FILES.find(f => f.key === key);
  if (!entry) throw new Error(`Unknown data key: ${key}`);

  const res = await fetch(`/api/data/${entry.file}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store[key])
  });

  if (!res.ok) throw new Error(`Save failed: ${entry.file} (${res.status})`);

  // Update snapshot
  if (store.savedSnapshots[key] !== undefined) {
    store.savedSnapshots[key] = JSON.stringify(store[key]);
  }
  store.dirty[key] = false;

  rebuildMaps();

  // Broadcast to other tabs via hub-storage
  window.CcvibesHubStorage?.broadcastSaved(entry.file);

  emit('save-complete', key);
  return true;
}

export function isDirty(key) {
  if (!store.savedSnapshots[key]) return false;
  return JSON.stringify(store[key]) !== store.savedSnapshots[key];
}

const ALL_KEYS = ['activities', 'resources', 'branches', 'roles', 'perks', 'modals'];

export function isAnyDirty() {
  return ALL_KEYS.some(k => isDirty(k));
}

export async function saveAllDirty() {
  const results = [];
  for (const key of ALL_KEYS) {
    if (isDirty(key)) {
      try {
        await saveFile(key);
        results.push({ key, ok: true });
      } catch (err) {
        results.push({ key, ok: false, error: err.message });
      }
    }
  }
  return results;
}
