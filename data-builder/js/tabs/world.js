import { store, on, emit, getBranchColor } from '../state.js';
import { safe } from '../utils.js';
import { saveFile } from '../data-io.js';

let container = null;

export function init(el) {
  container = el;
  on('data-loaded', render);
  on('save-complete', render);
  window._world = { selectBranch, updateBranch, addBranch, deleteBranch, saveBranches };
}

export function activate() { render(); }
export function deactivate() {}

function render() {
  if (!container) return;

  const branches = store.branches.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const branchColors = ['NEON_CYAN', 'LAVA_RED', 'ELECTRIC_BLUE', 'GOLD', 'HOT_PINK', 'TERMINAL_GREEN', 'PURPLE', 'ORANGE'];
  const gradients = ['street', 'new_branch'];

  container.innerHTML = `
    <div class="tab-panel__content">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
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
          <h2 style="margin-bottom:12px">Roles</h2>
          <div class="list">
            ${store.roles.map(r => {
              const perkCount = Object.keys(store.perks).filter(k => store.perks[k]?.roleId === r.id).length;
              const maxStars = (r.xpToStars || []).length;
              return `
                <div class="item">
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
        </div>
      </div>
    </div>
  `;
}

function renderBranchEditor(branchColors, gradients) {
  const b = store.branches.find(b => b.id === store.selectedBranchId);
  if (!b) return '';

  return `
    <div class="panel" style="margin-top:16px">
      <h3 style="margin-bottom:12px">Edit: ${safe(b.name || b.id)}</h3>
      <div class="input-grid">
        <div class="input-grid two-col">
          <div><label>ID</label><input type="text" value="${safe(b.id)}" oninput="_world.updateBranch('id', this.value)"></div>
          <div><label>Name</label><input type="text" value="${safe(b.name)}" oninput="_world.updateBranch('name', this.value)"></div>
        </div>
        <div><label>Description</label><textarea oninput="_world.updateBranch('description', this.value)">${safe(b.description)}</textarea></div>
        <div class="input-grid three-col">
          <div><label>Order</label><input type="number" value="${safe(b.order)}" oninput="_world.updateBranch('order', parseInt(this.value,10)||0)"></div>
          <div><label>Hotkey</label><input type="text" value="${safe(b.hotkey)}" oninput="_world.updateBranch('hotkey', this.value)" maxlength="1"></div>
          <div class="flex"><label class="muted" style="margin:0">Revealed?</label><input type="checkbox" ${b.revealedByDefault ? 'checked' : ''} onchange="_world.updateBranch('revealedByDefault', this.checked)"></div>
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
  } else if (field.startsWith('ui.')) {
    if (!b.ui) b.ui = {};
    b.ui[field.slice(3)] = value;
  } else {
    b[field] = value;
  }
  render();
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
    const el = document.createElement('div');
    el.className = 'toast success';
    el.textContent = 'Branches saved';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  } catch (err) {
    const el = document.createElement('div');
    el.className = 'toast error';
    el.textContent = `Failed: ${err.message}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }
}
