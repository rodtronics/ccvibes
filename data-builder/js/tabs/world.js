import { store, on, emit, getBranchColor } from '../state.js';
import { safe } from '../utils.js';
import { saveFile } from '../data-io.js';

let container = null;

export function init(el) {
  container = el;
  on('data-loaded', render);
  on('save-complete', render);
  window._world = {
    selectBranch, updateBranch, addBranch, deleteBranch, saveBranches,
    selectRole, updateRole, addRole, deleteRole, saveRoles,
    selectPerk, updatePerk, addPerk, deletePerk, savePerks,
    selectModal, updateModal, addModal, deleteModal, saveModals,
    startFromScratch, confirmClearAll
  };
}

export function activate() { render(); }
export function deactivate() {}

function render() {
  if (!container) return;

  // Save focus state before re-rendering
  const activeEl = document.activeElement;
  const activeId = activeEl?.id || activeEl?.getAttribute('data-focus-id');
  const selectionStart = activeEl?.selectionStart;
  const selectionEnd = activeEl?.selectionEnd;

  const branches = store.branches.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const branchColors = ['NEON_CYAN', 'LAVA_RED', 'ELECTRIC_BLUE', 'GOLD', 'HOT_PINK', 'TERMINAL_GREEN', 'PURPLE', 'ORANGE'];
  const gradients = ['street', 'new_branch'];
  const totalActivities = store.activities.length;

  container.innerHTML = `
    <div class="tab-panel__content">
      ${renderNewGamePanel()}

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;align-items:start;margin-top:24px">
        <div>
          <div class="panel__header">
            <h2>Branches</h2>
            <div class="flex">
              <button class="small" onclick="_world.addBranch()">+ Branch</button>
              <button class="small" onclick="_world.saveBranches()">Save</button>
            </div>
          </div>
          <div class="list">
            ${branches.map(b => {
              const color = getBranchColor(b.id);
              const isSelected = b.id === store.selectedBranchId;
              const actCount = store.activities.filter(a => a.branchId === b.id).length;
              return `
                <div class="item" style="cursor:pointer;${isSelected ? 'border-color:var(--accent)' : ''}" onclick="_world.selectBranch('${safe(b.id)}')">
                  <div class="flex" style="justify-content:space-between">
                    <div class="flex">
                      <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
                      <strong>${safe(b.name || b.id)}</strong>
                    </div>
                    <span class="muted">order: ${b.order || 0} | ${actCount} activities</span>
                  </div>
                  <div class="muted" style="font-size:0.85rem">${safe(b.description || '')}</div>
                </div>`;
            }).join('')}
          </div>

          ${renderBranchEditor(branchColors, gradients)}
        </div>

        <div>
          <div class="panel__header">
            <h2>Roles</h2>
            <div class="flex">
              <button class="small" onclick="_world.addRole()">+ Role</button>
              <button class="small" onclick="_world.saveRoles()">Save</button>
            </div>
          </div>
          <div class="list">
            ${store.roles.map(r => {
              const perkCount = Object.keys(store.perks).filter(k => store.perks[k]?.roleId === r.id).length;
              const maxStars = (r.xpToStars || []).length;
              const isSelected = r.id === store.selectedRoleId;
              return `
                <div class="item" style="cursor:pointer;${isSelected ? 'border-color:var(--accent)' : ''}" onclick="_world.selectRole('${safe(r.id)}')">
                  <div class="flex" style="justify-content:space-between">
                    <strong>${safe(r.id)}</strong>
                    <span class="muted">${safe(r.name)}</span>
                  </div>
                  <div class="muted" style="font-size:0.85rem">
                    ${maxStars} star tiers | ${perkCount} perks | ${r.revealedByDefault ? 'visible' : 'hidden'}
                  </div>
                </div>`;
            }).join('')}
          </div>

          ${renderRoleEditor()}
        </div>

        <div>
          <div class="panel__header">
            <h2>Perks</h2>
            <div class="flex">
              <button class="small" onclick="_world.addPerk()">+ Perk</button>
              <button class="small" onclick="_world.savePerks()">Save</button>
            </div>
          </div>
          <div class="list" style="max-height:400px;overflow-y:auto">
            ${Object.values(store.perks || {}).sort((a, b) => {
              if (a.roleId !== b.roleId) return a.roleId.localeCompare(b.roleId);
              return (a.tier || 0) - (b.tier || 0);
            }).map(p => {
              const isSelected = p.id === store.selectedPerkId;
              return `
                <div class="item" style="cursor:pointer;${isSelected ? 'border-color:var(--accent)' : ''}" onclick="_world.selectPerk('${safe(p.id)}')">
                  <div class="flex" style="justify-content:space-between;margin-bottom:4px">
                    <strong style="font-size:0.9rem">${safe(p.name)}</strong>
                    <span class="badge" style="font-size:0.7rem;padding:2px 6px">T${p.tier || 1}</span>
                  </div>
                  <div class="muted" style="font-size:0.75rem">${safe(p.roleId)}</div>
                </div>`;
            }).join('')}
          </div>

          ${renderPerkEditor()}
        </div>

        <div>
          <div class="panel__header">
            <h2>Modals</h2>
            <div class="flex">
              <button class="small" onclick="_world.addModal()">+ Modal</button>
              <button class="small" onclick="_world.saveModals()">Save</button>
            </div>
          </div>
          <div class="list" style="max-height:400px;overflow-y:auto">
            ${store.modals.map(m => {
              const isSelected = m.id === store.selectedModalId;
              const typeLabel = m.type === 'story' ? '📖' : '💡';
              return `
                <div class="item" style="cursor:pointer;${isSelected ? 'border-color:var(--accent)' : ''}" onclick="_world.selectModal('${safe(m.id)}')">
                  <div class="flex" style="justify-content:space-between;margin-bottom:4px">
                    <strong style="font-size:0.9rem">${safe(m.title)}</strong>
                    <span style="font-size:0.9rem">${typeLabel}</span>
                  </div>
                  <div class="muted" style="font-size:0.75rem">${safe(m.id)}</div>
                </div>`;
            }).join('')}
          </div>

          ${renderModalEditor()}
        </div>
      </div>
    </div>
  `;

  // Restore focus after re-render
  if (activeId) {
    const targetEl = document.getElementById(activeId) || document.querySelector(`[data-focus-id="${activeId}"]`);
    if (targetEl && targetEl.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA') {
      setTimeout(() => {
        targetEl.focus();
        if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
          targetEl.setSelectionRange(selectionStart, selectionEnd);
        }
      }, 0);
    }
  }
}

function renderBranchEditor(branchColors, gradients) {
  const b = store.branches.find(b => b.id === store.selectedBranchId);
  if (!b) return '';

  return `
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-bottom:12px">Edit: ${safe(b.name || b.id)}</h3>
      <div class="input-grid">
        <div class="input-grid two-col">
          <div><label>ID</label><input type="text" data-focus-id="branch-id" value="${safe(b.id)}" onchange="_world.updateBranch('id', this.value)"></div>
          <div><label>Name</label><input type="text" data-focus-id="branch-name" value="${safe(b.name)}" oninput="_world.updateBranch('name', this.value)"></div>
        </div>
        <div><label>Description</label><textarea data-focus-id="branch-desc" oninput="_world.updateBranch('description', this.value)">${safe(b.description)}</textarea></div>
        <div class="input-grid three-col">
          <div><label>Order</label><input type="number" data-focus-id="branch-order" value="${safe(b.order)}" oninput="_world.updateBranch('order', parseInt(this.value,10)||0)"></div>
          <div><label>Hotkey</label><input type="text" data-focus-id="branch-hotkey" value="${safe(b.hotkey)}" oninput="_world.updateBranch('hotkey', this.value)" maxlength="1"></div>
          <div class="flex"><label class="muted" style="margin:0">Revealed?</label><input type="checkbox" data-focus-id="branch-revealed" ${b.revealedByDefault ? 'checked' : ''} onchange="_world.updateBranch('revealedByDefault', this.checked)"></div>
        </div>
        <div class="input-grid two-col">
          <div>
            <label>UI Color</label>
            <select onchange="_world.updateBranch('ui.color', this.value)">
              ${branchColors.map(c => `<option value="${c}" ${b.ui?.color === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Gradient</label>
            <select onchange="_world.updateBranch('ui.gradient', this.value)">
              ${gradients.map(g => `<option value="${g}" ${b.ui?.gradient === g ? 'selected' : ''}>${g}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <button class="danger small" style="margin-top:12px" onclick="_world.deleteBranch('${safe(b.id)}')">Delete Branch</button>
    </div>
  `;
}

function selectBranch(id) { store.selectedBranchId = id; render(); }

function updateBranch(field, value) {
  const b = store.branches.find(b => b.id === store.selectedBranchId);
  if (!b) return;

  if (field === 'id') {
    const oldId = b.id;
    b.id = value;
    store.selectedBranchId = value;
    store.branchMap.delete(oldId);
    store.branchMap.set(value, b);
    render();
    return;
  } else if (field.startsWith('ui.')) {
    if (!b.ui) b.ui = {};
    b.ui[field.slice(3)] = value;
  } else {
    b[field] = value;
  }
}

function addBranch() {
  const id = `new_branch_${store.branches.length + 1}`;
  const branch = { id, name: id.toUpperCase(), description: '', order: (store.branches.length + 1) * 10, hotkey: '', revealedByDefault: false, ui: { color: 'NEON_CYAN', gradient: 'new_branch' } };
  store.branches.push(branch);
  store.branchMap.set(id, branch);
  store.selectedBranchId = id;
  render();
}

function deleteBranch(id) {
  if (!confirm(`Delete branch "${id}"?`)) return;
  store.branches = store.branches.filter(b => b.id !== id);
  store.branchMap.delete(id);
  if (store.selectedBranchId === id) store.selectedBranchId = null;
  render();
}

async function saveBranches() {
  try {
    await saveFile('branches');
    showToast('Branches saved', 'success');
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

function renderNewGamePanel() {
  const totalActivities = store.activities.length;
  const totalResources = store.resources.length;
  const totalBranches = store.branches.length;

  return `
    <div class="panel" style="background:var(--gradient-panel);border:2px solid var(--accent-dim);box-shadow:var(--shadow-glow)">
      <div class="panel__header">
        <div>
          <h2 style="color:var(--accent-bright)">🎮 New Game Setup</h2>
          <p class="muted" style="margin-top:4px;font-size:0.9rem">Build your game progression from the ground up</p>
        </div>
      </div>

      <div style="margin-top:16px;padding:14px;background:rgba(0,0,0,0.2);border-radius:var(--radius-md);border:1px solid var(--border)">
        <div class="flex" style="justify-content:space-between;margin-bottom:12px">
          <span class="muted">Current Content</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:800;color:var(--accent)">${totalActivities}</div>
            <div class="muted" style="font-size:0.8rem">Activities</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:800;color:var(--accent-2)">${totalResources}</div>
            <div class="muted" style="font-size:0.8rem">Resources</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:2rem;font-weight:800;color:var(--success)">${totalBranches}</div>
            <div class="muted" style="font-size:0.8rem">Branches</div>
          </div>
        </div>
      </div>

      <div style="margin-top:16px">
        <h3 style="font-size:0.95rem;margin-bottom:10px;color:var(--text-bright)">Start Fresh</h3>
        <p class="muted" style="font-size:0.9rem;margin-bottom:12px">Clear all current content and set up a minimal starter template with:</p>
        <ul style="margin:0 0 14px 20px;color:var(--muted);font-size:0.9rem;line-height:1.8">
          <li>1 starter branch ("street")</li>
          <li>Core resources (cash, heat, intel)</li>
          <li>Empty activities file (ready for your first crime)</li>
        </ul>
        <button class="danger" onclick="_world.confirmClearAll()" style="width:100%">
          🗑️ Clear All & Start Fresh
        </button>
      </div>

      <div style="margin-top:16px;padding:12px;background:rgba(125,211,252,0.08);border:1px solid rgba(125,211,252,0.25);border-radius:var(--radius-sm)">
        <div style="font-size:0.85rem;color:var(--accent);font-weight:700;margin-bottom:6px">💡 Recommended Workflow</div>
        <ol style="margin:0;padding-left:20px;color:var(--muted);font-size:0.85rem;line-height:1.8">
          <li>Start fresh or keep existing content</li>
          <li>Use the <strong style="color:var(--text)">Activity Wizard</strong> (🧙 button) to create your first crime</li>
          <li>Keep it simple: cash reward, low/no gates, instant duration</li>
          <li>Build outward: each activity unlocks the next</li>
          <li>Use the <strong style="color:var(--text)">Map tab</strong> to visualize progression</li>
        </ol>
      </div>
    </div>
  `;
}

function confirmClearAll() {
  const confirmed = confirm(
    'WARNING: This will DELETE all activities, resources, and branches.\n\n' +
    'This action cannot be undone. A minimal starter template will be created.\n\n' +
    'Are you absolutely sure?'
  );

  if (confirmed) {
    const doubleCheck = confirm(
      'FINAL WARNING: All your work will be lost!\n\n' +
      `You have ${store.activities.length} activities, ${store.resources.length} resources, and ${store.branches.length} branches.\n\n` +
      'Click OK to proceed with deletion.'
    );

    if (doubleCheck) {
      startFromScratch();
    }
  }
}

async function startFromScratch() {
  // Clear everything
  store.activities = [];
  store.activityMap.clear();

  // Create minimal starter resources
  store.resources = [
    { id: 'cash', name: 'Cash', description: 'Money for buying things and paying costs', category: 'currency', revealedByDefault: true },
    { id: 'heat', name: 'Heat', description: 'Police attention - get too hot and you\'ll be caught', category: 'risk', revealedByDefault: true },
    { id: 'intel', name: 'Intel', description: 'Information and knowledge about opportunities', category: 'intel', revealedByDefault: false }
  ];
  store.resourceMap.clear();
  store.resources.forEach(r => store.resourceMap.set(r.id, r));

  // Create single starter branch
  store.branches = [
    {
      id: 'street',
      name: 'Street Crime',
      description: 'Small-time hustles and petty crimes to get started',
      order: 10,
      hotkey: 's',
      revealedByDefault: true,
      ui: { color: 'NEON_CYAN', gradient: 'street' }
    }
  ];
  store.branchMap.clear();
  store.branches.forEach(b => store.branchMap.set(b.id, b));

  store.selectedActivityId = null;
  store.selectedResourceId = null;
  store.selectedBranchId = null;

  // Save all files
  try {
    await Promise.all([
      saveFile('activities'),
      saveFile('resources'),
      saveFile('branches')
    ]);

    showToast('✨ Fresh start created! Use the Activity Wizard to create your first crime.', 'success');
    emit('data-loaded');
    render();

    // Switch to workshop and open wizard
    setTimeout(() => {
      document.querySelector('[data-tab="workshop"]')?.click();
      if (window._ws?.openWizard) {
        setTimeout(() => window._ws.openWizard(), 200);
      }
    }, 500);
  } catch (err) {
    showToast(`Failed to save: ${err.message}`, 'error');
  }
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Role Management ──

function selectRole(id) {
  store.selectedRoleId = id;
  render();
}

function updateRole(field, value) {
  const r = store.roles.find(r => r.id === store.selectedRoleId);
  if (!r) return;

  if (field === 'id') {
    const oldId = r.id;
    r.id = value;
    store.selectedRoleId = value;
    store.roleMap.delete(oldId);
    store.roleMap.set(value, r);
    render();
    return;
  }

  r[field] = value;
}

function addRole() {
  const newId = 'new_role_' + (store.roles.length + 1);
  const role = {
    id: newId,
    name: 'New Role',
    description: 'Role description',
    xpToStars: [
      { stars: 0, minXp: 0 },
      { stars: 1, minXp: 100 },
      { stars: 2, minXp: 350 },
      { stars: 3, minXp: 800 },
      { stars: 4, minXp: 1500 },
      { stars: 5, minXp: 2500 }
    ],
    perkChoices: [],
    revealedByDefault: false
  };
  store.roles.push(role);
  store.roleMap.set(newId, role);
  store.selectedRoleId = newId;
  render();
}

function deleteRole(id) {
  const perkCount = Object.keys(store.perks || {}).filter(k => store.perks[k]?.roleId === id).length;
  const warning = perkCount > 0
    ? `Delete role "${id}"?\n\nThis role has ${perkCount} associated perks. They will become orphaned.`
    : `Delete role "${id}"?`;

  if (!confirm(warning)) return;

  store.roles = store.roles.filter(r => r.id !== id);
  store.roleMap.delete(id);
  if (store.selectedRoleId === id) store.selectedRoleId = null;
  render();
}

async function saveRoles() {
  try {
    await saveFile('roles');
    showToast('Roles saved', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

function renderRoleEditor() {
  const r = store.roles.find(r => r.id === store.selectedRoleId);
  if (!r) return '';

  const maxStars = (r.xpToStars || []).length;
  const perkCount = Object.keys(store.perks || {}).filter(k => store.perks[k]?.roleId === r.id).length;

  return `
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-bottom:12px">Edit: ${safe(r.name || r.id)}</h3>
      <div class="input-grid">
        <div class="input-grid two-col">
          <div><label>ID</label><input type="text" data-focus-id="role-id" value="${safe(r.id)}" onchange="_world.updateRole('id', this.value)"></div>
          <div><label>Name</label><input type="text" data-focus-id="role-name" value="${safe(r.name)}" oninput="_world.updateRole('name', this.value)"></div>
        </div>
        <div><label>Description</label><textarea data-focus-id="role-desc" oninput="_world.updateRole('description', this.value)">${safe(r.description)}</textarea></div>
        <div class="flex">
          <label class="muted" style="margin:0">Revealed by default?</label>
          <input type="checkbox" data-focus-id="role-revealed" ${r.revealedByDefault ? 'checked' : ''} onchange="_world.updateRole('revealedByDefault', this.checked)">
        </div>
        <div class="hint" style="font-size:0.85rem;padding:10px;background:rgba(125,211,252,0.08);border:1px solid rgba(125,211,252,0.2);border-radius:var(--radius-sm)">
          <strong>XP & Perks:</strong> This role has ${maxStars} star tiers and ${perkCount} associated perks. Edit XP thresholds and perk choices directly in roles.json for now.
        </div>
      </div>
      <button class="danger small" style="margin-top:12px" onclick="_world.deleteRole('${safe(r.id)}')">Delete Role</button>
    </div>
  `;
}

// ── Perk Management ──

function selectPerk(id) {
  store.selectedPerkId = id;
  render();
}

function updatePerk(field, value) {
  const p = store.perks[store.selectedPerkId];
  if (!p) return;

  if (field === 'id') {
    const oldId = p.id;
    p.id = value;
    delete store.perks[oldId];
    store.perks[value] = p;
    store.selectedPerkId = value;
    render();
    return;
  } else if (field.startsWith('effects.')) {
    // Handle nested effects object
    const effectPath = field.slice(8); // remove "effects."
    if (!p.effects) p.effects = {};

    if (effectPath.includes('.')) {
      // e.g., "outcomeWeightAdjust.success"
      const [effectType, outcomeType] = effectPath.split('.');
      if (!p.effects[effectType]) p.effects[effectType] = {};
      p.effects[effectType][outcomeType] = parseFloat(value) || 0;
    } else {
      // e.g., "durationMultiplier"
      p.effects[effectPath] = parseFloat(value) || 0;
    }
  } else if (field === 'tier') {
    p.tier = parseInt(value, 10) || 1;
  } else {
    p[field] = value;
  }
}

function addPerk() {
  const newId = 'new_perk_' + Date.now();
  const perk = {
    id: newId,
    name: 'New Perk',
    description: 'Perk description',
    roleId: store.roles[0]?.id || 'player',
    tier: 1,
    effects: { cashMultiplier: 1.1 }
  };
  store.perks[newId] = perk;
  store.selectedPerkId = newId;
  render();
}

function deletePerk(id) {
  if (!confirm(`Delete perk "${id}"?`)) return;
  delete store.perks[id];
  if (store.selectedPerkId === id) store.selectedPerkId = null;
  render();
}

async function savePerks() {
  try {
    await saveFile('perks');
    showToast('Perks saved', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

function renderPerkEditor() {
  const p = store.perks[store.selectedPerkId];
  if (!p) return '';

  // Determine current effect type and values
  const effects = p.effects || {};
  let effectType = 'cashMultiplier';
  let effectValue = 1.1;
  let outcomeType = '';
  let outcomeValue = 0;

  if (effects.cashMultiplier) {
    effectType = 'cashMultiplier';
    effectValue = effects.cashMultiplier;
  } else if (effects.credMultiplier) {
    effectType = 'credMultiplier';
    effectValue = effects.credMultiplier;
  } else if (effects.heatMultiplier) {
    effectType = 'heatMultiplier';
    effectValue = effects.heatMultiplier;
  } else if (effects.durationMultiplier) {
    effectType = 'durationMultiplier';
    effectValue = effects.durationMultiplier;
  } else if (effects.jailTimeMultiplier) {
    effectType = 'jailTimeMultiplier';
    effectValue = effects.jailTimeMultiplier;
  } else if (effects.outcomeWeightAdjust) {
    effectType = 'outcomeWeightAdjust';
    const outcomes = effects.outcomeWeightAdjust;
    if (outcomes.success !== undefined) {
      outcomeType = 'success';
      outcomeValue = outcomes.success;
    } else if (outcomes.caught !== undefined) {
      outcomeType = 'caught';
      outcomeValue = outcomes.caught;
    }
  }

  const roleOptions = store.roles.map(r =>
    `<option value="${safe(r.id)}" ${p.roleId === r.id ? 'selected' : ''}>${safe(r.name || r.id)}</option>`
  ).join('');

  return `
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-bottom:12px">Edit: ${safe(p.name || p.id)}</h3>
      <div class="input-grid">
        <div><label>ID</label><input type="text" data-focus-id="perk-id" value="${safe(p.id)}" onchange="_world.updatePerk('id', this.value)"></div>
        <div><label>Name</label><input type="text" data-focus-id="perk-name" value="${safe(p.name)}" oninput="_world.updatePerk('name', this.value)"></div>
        <div><label>Description</label><textarea data-focus-id="perk-desc" oninput="_world.updatePerk('description', this.value)">${safe(p.description)}</textarea></div>

        <div class="input-grid two-col">
          <div>
            <label>Role</label>
            <select data-focus-id="perk-role" onchange="_world.updatePerk('roleId', this.value)">
              ${roleOptions}
            </select>
          </div>
          <div><label>Tier</label><input type="number" data-focus-id="perk-tier" value="${p.tier || 1}" min="1" max="5" oninput="_world.updatePerk('tier', this.value)"></div>
        </div>

        <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;background:rgba(0,0,0,0.2)">
          <label style="margin-bottom:8px;display:block">Effect Type</label>
          <select data-focus-id="perk-effect-type" onchange="
            const val = this.value;
            const p = store.perks[store.selectedPerkId];
            p.effects = {};
            if (val === 'outcomeWeightAdjust') {
              p.effects.outcomeWeightAdjust = { success: 5 };
            } else {
              p.effects[val] = val.includes('Multiplier') ? (val === 'durationMultiplier' || val === 'heatMultiplier' ? 0.9 : 1.1) : 5;
            }
            _world.selectPerk(store.selectedPerkId);
          " style="margin-bottom:10px">
            <option value="cashMultiplier" ${effectType === 'cashMultiplier' ? 'selected' : ''}>Cash Multiplier (+% cash)</option>
            <option value="credMultiplier" ${effectType === 'credMultiplier' ? 'selected' : ''}>Cred Multiplier (+% cred)</option>
            <option value="heatMultiplier" ${effectType === 'heatMultiplier' ? 'selected' : ''}>Heat Multiplier (-% heat)</option>
            <option value="durationMultiplier" ${effectType === 'durationMultiplier' ? 'selected' : ''}>Duration Multiplier (-% time)</option>
            <option value="jailTimeMultiplier" ${effectType === 'jailTimeMultiplier' ? 'selected' : ''}>Jail Time Multiplier (-% jail)</option>
            <option value="outcomeWeightAdjust" ${effectType === 'outcomeWeightAdjust' ? 'selected' : ''}>Outcome Weight Adjust</option>
          </select>

          ${effectType === 'outcomeWeightAdjust' ? `
            <div style="margin-top:8px">
              <label style="font-size:0.85rem">Outcome Type</label>
              <select data-focus-id="perk-outcome-type" onchange="
                const p = store.perks[store.selectedPerkId];
                const oldVal = Object.values(p.effects.outcomeWeightAdjust || {})[0] || 5;
                p.effects.outcomeWeightAdjust = { [this.value]: oldVal };
                _world.selectPerk(store.selectedPerkId);
              " style="margin-bottom:6px">
                <option value="success" ${outcomeType === 'success' ? 'selected' : ''}>Success</option>
                <option value="caught" ${outcomeType === 'caught' ? 'selected' : ''}>Caught</option>
              </select>
              <label style="font-size:0.85rem">Adjustment Value</label>
              <input type="number" data-focus-id="perk-outcome-val" step="1" value="${outcomeValue}" oninput="_world.updatePerk('effects.outcomeWeightAdjust.${outcomeType}', this.value)">
            </div>
          ` : `
            <div style="margin-top:8px">
              <label style="font-size:0.85rem">Multiplier Value ${effectType.includes('duration') || effectType.includes('heat') || effectType.includes('jail') ? '(0.9 = -10%, 0.85 = -15%)' : '(1.1 = +10%, 1.15 = +15%)'}</label>
              <input type="number" data-focus-id="perk-effect-val" step="0.05" value="${effectValue}" oninput="_world.updatePerk('effects.${effectType}', this.value)">
            </div>
          `}
        </div>
      </div>
      <button class="danger small" style="margin-top:12px" onclick="_world.deletePerk('${safe(p.id)}')">Delete Perk</button>
    </div>
  `;
}

// ── Modal Management ──

function selectModal(id) {
  store.selectedModalId = id;
  render();
}

function updateModal(field, value) {
  const m = store.modals.find(m => m.id === store.selectedModalId);
  if (!m) return;

  if (field === 'id') {
    const oldId = m.id;
    m.id = value;
    store.selectedModalId = value;
    store.modalMap.delete(oldId);
    store.modalMap.set(value, m);
    render();
    return;
  }

  if (field === 'showOnce' || field === 'type') {
    m[field] = value;
  } else {
    m[field] = value;
  }
}

function addModal() {
  const newId = 'new_modal_' + Date.now();
  const modal = {
    id: newId,
    title: 'New Modal',
    body: 'Modal body text goes here. Use {{neon_cyan}}color tags{{/}} for formatting.',
    type: 'story',
    showOnce: true
  };
  store.modals.push(modal);
  store.modalMap.set(newId, modal);
  store.selectedModalId = newId;
  render();
}

function deleteModal(id) {
  if (!confirm(`Delete modal "${id}"?`)) return;
  store.modals = store.modals.filter(m => m.id !== id);
  store.modalMap.delete(id);
  if (store.selectedModalId === id) store.selectedModalId = null;
  render();
}

async function saveModals() {
  try {
    await saveFile('modals');
    showToast('Modals saved', 'success');
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

function renderModalEditor() {
  const m = store.modals.find(m => m.id === store.selectedModalId);
  if (!m) return '';

  // Palette color options (Palette color keys from palette.js)
  const paletteOptions = [
    { value: '', label: '(default)' },
    { value: 'BLACK', label: 'Black' },
    { value: 'WHITE', label: 'White' },
    { value: 'LIGHT_GRAY', label: 'Light Gray' },
    { value: 'MID_GRAY', label: 'Mid Gray' },
    { value: 'DIM_GRAY', label: 'Dim Gray' },
    { value: 'DARK_GRAY', label: 'Dark Gray' },
    { value: 'NEON_CYAN', label: 'Neon Cyan' },
    { value: 'NEON_TEAL', label: 'Neon Teal' },
    { value: 'TERMINAL_GREEN', label: 'Terminal Green' },
    { value: 'HOT_PINK', label: 'Hot Pink' },
    { value: 'MAGENTA', label: 'Magenta' },
    { value: 'ELECTRIC_ORANGE', label: 'Electric Orange' },
    { value: 'BRIGHT_ORANGE', label: 'Bright Orange' },
    { value: 'BRIGHT_YELLOW', label: 'Bright Yellow' },
    { value: 'GOLD', label: 'Gold' },
    { value: 'AMBER', label: 'Amber' },
    { value: 'EMERALD', label: 'Emerald' },
    { value: 'PURPLE', label: 'Purple' },
    { value: 'ROSE', label: 'Rose' },
    { value: 'HEAT_RED', label: 'Heat Red' },
    { value: 'INTRO_A', label: 'Intro Yellow' },
    { value: 'INTRO_B', label: 'Intro Pink' }
  ];

  const borderStyleOptions = [
    { value: '', label: '(default)' },
    { value: 'SINGLE', label: 'Single' },
    { value: 'DOUBLE', label: 'Double' },
    { value: 'ROUNDED', label: 'Rounded' },
    { value: 'BOLD', label: 'Bold' }
  ];

  return `
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-bottom:12px">Edit: ${safe(m.title || m.id)}</h3>
      <div class="input-grid">
        <div><label>ID</label><input type="text" data-focus-id="modal-id" value="${safe(m.id)}" onchange="_world.updateModal('id', this.value)"></div>
        <div><label>Title</label><input type="text" data-focus-id="modal-title" value="${safe(m.title)}" oninput="_world.updateModal('title', this.value)"></div>
        <div>
          <label>Body <span class="muted" style="font-size:0.75rem">(use {{color}}text{{/}} for colors, e.g. {{neon_cyan}}blue text{{/}})</span></label>
          <textarea data-focus-id="modal-body" oninput="_world.updateModal('body', this.value)">${safe(m.body)}</textarea>
        </div>

        <div class="input-grid two-col">
          <div>
            <label>Type</label>
            <select data-focus-id="modal-type" onchange="_world.updateModal('type', this.value)">
              <option value="story" ${m.type === 'story' ? 'selected' : ''}>Story</option>
              <option value="lesson" ${m.type === 'lesson' ? 'selected' : ''}>Lesson</option>
            </select>
          </div>
          <div class="flex">
            <label class="muted" style="margin:0">Show Once?</label>
            <input type="checkbox" data-focus-id="modal-show-once" ${m.showOnce ? 'checked' : ''} onchange="_world.updateModal('showOnce', this.checked)">
          </div>
        </div>

        <div class="input-grid three-col" style="margin-top:12px">
          <div>
            <label>Border Style</label>
            <select data-focus-id="modal-border-style" onchange="_world.updateModal('borderStyle', this.value)">
              ${borderStyleOptions.map(o => `<option value="${o.value}" ${(m.borderStyle || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Border Color</label>
            <select data-focus-id="modal-border-color" onchange="_world.updateModal('borderColor', this.value)">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.borderColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Background Color</label>
            <select data-focus-id="modal-bg-color" onchange="_world.updateModal('backgroundColor', this.value)">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.backgroundColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="input-grid two-col" style="margin-top:12px">
          <div>
            <label>Title Color <span class="muted" style="font-size:0.75rem">(default color for title text)</span></label>
            <select data-focus-id="modal-title-color" onchange="_world.updateModal('titleColor', this.value)">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.titleColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Body Color <span class="muted" style="font-size:0.75rem">(default color for body text, can be overridden with {{color}} tags)</span></label>
            <select data-focus-id="modal-body-color" onchange="_world.updateModal('bodyColor', this.value)">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.bodyColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <button class="danger small" style="margin-top:12px" onclick="_world.deleteModal('${safe(m.id)}')">Delete Modal</button>
    </div>
  `;
}
