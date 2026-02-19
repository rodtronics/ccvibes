import { store, on, emit, getBranchColor } from '../state.js';
import { safe } from '../utils.js';

let searchText = '';

export function init() {
  const searchInput = document.getElementById('navSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchText = e.target.value.toLowerCase();
      renderTree();
    });
  }

  on('data-loaded', renderTree);
  on('scenario-selected', renderTree);
  on('scenario-changed', renderTree);
  on('save-complete', renderTree);
}

export function renderTree() {
  const container = document.getElementById('navTree');
  if (!container) return;

  if (!store.loaded || !store.scenarios.length) {
    container.innerHTML = '<div class="hint" style="padding:8px">Loading data...</div>';
    return;
  }

  const branches = store.branches.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const grouped = new Map();

  // Group scenarios by branch
  store.scenarios.forEach(act => {
    const bid = act.branchId || 'unassigned';
    if (!grouped.has(bid)) grouped.set(bid, []);
    grouped.get(bid).push(act);
  });

  // Sort scenarios within each branch
  grouped.forEach((list) => list.sort((a, b) => (a.id || '').localeCompare(b.id || '')));

  // Build HTML
  const html = branches
    .filter(b => grouped.has(b.id))
    .map(branch => {
      let scenarios = grouped.get(branch.id) || [];

      // Apply search filter
      if (searchText) {
        scenarios = scenarios.filter(act => {
          return (act.id || '').toLowerCase().includes(searchText) ||
                 (act.name || '').toLowerCase().includes(searchText);
        });
      }

      if (!scenarios.length) return '';

      const color = getBranchColor(branch.id);
      const items = scenarios.map(act => {
        const isSelected = act.id === store.selectedActivityId;
        const optCount = (act.variants || []).length;
        return `
          <button class="nav-item ${isSelected ? 'selected' : ''}" data-scenario-id="${safe(act.id)}">
            ${safe(act.id)}
            <span class="nav-item__meta">${safe(act.name || '')}${optCount ? ` (${optCount})` : ''}</span>
          </button>
        `;
      }).join('');

      return `
        <div class="nav-group">
          <div class="nav-branch">
            <span class="nav-branch__dot" style="background:${color}"></span>
            ${safe(branch.name || branch.id)}
            <span class="muted" style="font-size:0.7rem">${scenarios.length}</span>
          </div>
          <div class="nav-items">${items}</div>
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  // Check for unassigned scenarios
  let unassigned = grouped.get('unassigned') || [];
  if (searchText) {
    unassigned = unassigned.filter(act =>
      (act.id || '').toLowerCase().includes(searchText) ||
      (act.name || '').toLowerCase().includes(searchText)
    );
  }

  const unassignedHtml = unassigned.length ? `
    <div class="nav-group">
      <div class="nav-branch">
        <span class="nav-branch__dot" style="background:#94a3b8"></span>
        unassigned
      </div>
      <div class="nav-items">
        ${unassigned.map(act => {
          const isSelected = act.id === store.selectedActivityId;
          return `<button class="nav-item ${isSelected ? 'selected' : ''}" data-scenario-id="${safe(act.id)}">${safe(act.id)}</button>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  container.innerHTML = html + unassignedHtml || '<div class="hint" style="padding:8px">No scenarios found.</div>';

  // Wire click events via delegation
  container.onclick = (e) => {
    const btn = e.target.closest('[data-scenario-id]');
    if (!btn) return;
    const scenarioId = btn.dataset.scenarioId;
    store.selectedActivityId = scenarioId;
    emit('scenario-selected', scenarioId);
  };
}
