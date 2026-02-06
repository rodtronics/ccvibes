import { store, on, emit, cascadeResourceRename } from '../state.js';
import { safe, showToast } from '../utils.js';
import { saveFile } from '../data-io.js';

let container = null;
let filterText = '';
let filterCategory = '';
let flowCache = null;

export function init(el) {
  container = el;
  on('data-loaded', render);
  on('save-complete', render);
  window._econ = { selectResource, updateResource, addResource, deleteResource, saveResources, setFilter, setCategoryFilter };
}

export function activate() { render(); }
export function deactivate() {}

function render() {
  if (!container) return;

  const categories = [...new Set(store.resources.map(r => r.category || 'other'))].sort();
  const resources = getFilteredResources();

  // Resource flow analysis
  const flows = (flowCache = buildFlowTable());

  container.innerHTML = `
    <div class="tab-panel__content">
      <div class="panel__header">
        <h2>Resources & Economy</h2>
        <div class="flex">
          <button class="small" onclick="_econ.addResource()">+ Resource</button>
          <button class="small" onclick="_econ.saveResources()">Save (Ctrl+S)</button>
        </div>
      </div>

      <div class="input-grid two-col" style="margin-bottom:16px">
        <input id="econFilterText" type="text" placeholder="Search resources..." value="${safe(filterText)}" oninput="_econ.setFilter(this.value)">
        <select id="econCategoryFilter" onchange="_econ.setCategoryFilter(this.value)">
          <option value="">All categories</option>
          ${categories.map(c => `<option value="${safe(c)}" ${c === filterCategory ? 'selected' : ''}>${safe(c)}</option>`).join('')}
        </select>
      </div>

      <div class="input-grid two-col" style="align-items:start">
        <div>
          <h3 style="margin-bottom:10px">Resources (<span id="econResourceCount">${resources.length}</span>)</h3>
          <div class="list" id="econResourceList">${renderResourceListHtml(resources, flows)}</div>
        </div>

        <div>
          ${renderResourceEditor()}
          <div style="margin-top:16px">
            <h3 style="margin-bottom:10px">Resource Flow</h3>
            ${renderFlowTable(flows)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderResourceEditor() {
  const r = store.resources.find(r => r.id === store.selectedResourceId);
  if (!r) return '<div class="hint" style="padding:20px">Select a resource to edit.</div>';

  const categories = ['currency', 'reputation', 'risk', 'material', 'equipment', 'infrastructure', 'intel', 'influence', 'document', 'territory'];

  return `
    <div class="panel" style="margin-bottom:12px">
      <h3 style="margin-bottom:12px">Edit: ${safe(r.id)}</h3>
      <div class="input-grid">
        <div><label>ID</label><input type="text" value="${safe(r.id)}" onchange="_econ.updateResource('id', this.value)"></div>
        <div><label>Name</label><input type="text" value="${safe(r.name)}" oninput="_econ.updateResource('name', this.value)"></div>
        <div><label>Description</label><textarea oninput="_econ.updateResource('description', this.value)">${safe(r.description)}</textarea></div>
        <div class="input-grid two-col">
          <div>
            <label>Category</label>
            <select onchange="_econ.updateResource('category', this.value)">
              ${categories.map(c => `<option value="${c}" ${r.category === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Branch (optional)</label>
            <select onchange="_econ.updateResource('branchId', this.value)">
              <option value="">Global</option>
              ${store.branches.map(b => `<option value="${safe(b.id)}" ${r.branchId === b.id ? 'selected' : ''}>${safe(b.name || b.id)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label>Modal (lore/info popup)</label>
          <select onchange="_econ.updateResource('modalId', this.value)">
            <option value="">None</option>
            ${store.modals.map(m => `<option value="${safe(m.id)}" ${r.modalId === m.id ? 'selected' : ''}>${safe(m.title || m.id)}</option>`).join('')}
          </select>
        </div>
        <div class="flex">
          <label class="muted" style="margin:0">Revealed by default?</label>
          <input type="checkbox" ${r.revealedByDefault ? 'checked' : ''} onchange="_econ.updateResource('revealedByDefault', this.checked)">
        </div>
        <div style="margin-top:12px;padding:12px;background:rgba(0,0,0,0.2);border-radius:var(--radius-sm);border:1px solid var(--border)">
          <label style="font-size:0.85rem;margin-bottom:8px;display:block;color:var(--text)">Resource Behavior</label>
          <div class="flex" style="gap:16px;flex-wrap:wrap">
            <div class="flex">
              <label class="muted" style="margin:0;font-size:0.85rem">Discrete?</label>
              <input type="checkbox" ${r.discrete ? 'checked' : ''} onchange="_econ.updateResource('discrete', this.checked)" title="Whole numbers only (no decimals)">
            </div>
            <div class="flex">
              <label class="muted" style="margin:0;font-size:0.85rem">Singular?</label>
              <input type="checkbox" ${r.singular ? 'checked' : ''} onchange="_econ.updateResource('singular', this.checked)" title="Can only have 0 or 1 (binary possession)">
            </div>
            <div class="flex">
              <label class="muted" style="margin:0;font-size:0.85rem">Persistent?</label>
              <input type="checkbox" ${r.persistent ? 'checked' : ''} onchange="_econ.updateResource('persistent', this.checked)" title="Not consumed when used">
            </div>
          </div>
          <div class="hint" style="font-size:0.75rem;margin-top:8px;line-height:1.5">
            <strong>Discrete:</strong> Whole numbers only (lockpicks, documents)<br>
            <strong>Singular:</strong> Binary 0/1 (unique items, flags)<br>
            <strong>Persistent:</strong> Not consumed when used (permanent equipment, skills)
          </div>
        </div>
      </div>
      <button class="danger small" style="margin-top:12px" onclick="_econ.deleteResource('${safe(r.id)}')">Delete Resource</button>
    </div>
  `;
}

function buildFlowTable() {
  const flows = new Map();
  store.resources.forEach(r => flows.set(r.id, { producers: [], consumers: [] }));

  store.activities.forEach(act => {
    (act.options || []).forEach(opt => {
      if (opt.inputs?.resources) {
        Object.keys(opt.inputs.resources).forEach(rid => {
          if (!flows.has(rid)) flows.set(rid, { producers: [], consumers: [] });
          const label = `${act.id}/${opt.id || opt.name}`;
          if (!flows.get(rid).consumers.includes(label)) flows.get(rid).consumers.push(label);
        });
      }

      const addOutputs = (outputs, label) => {
        if (outputs?.resources) {
          Object.keys(outputs.resources).forEach(rid => {
            if (!flows.has(rid)) flows.set(rid, { producers: [], consumers: [] });
            if (!flows.get(rid).producers.includes(label)) flows.get(rid).producers.push(label);
          });
        }
      };

      const label = `${act.id}/${opt.id || opt.name}`;
      if (opt.resolution?.type === 'weighted_outcomes') {
        (opt.resolution.outcomes || []).forEach(out => addOutputs(out.outputs, label));
      } else if (opt.resolution) {
        addOutputs(opt.resolution.outputs, label);
      }
    });
  });

  return flows;
}

function renderFlowTable(flows) {
  const selected = store.selectedResourceId;
  const flow = selected ? flows.get(selected) : null;

  if (!flow) return '<div class="hint">Select a resource to see its flow.</div>';

  return `
    <div class="ws-balance">
      <table>
        <thead><tr><th>Direction</th><th>Activity / Option</th></tr></thead>
        <tbody>
          ${flow.producers.map(p => `<tr><td class="positive">Produces</td><td>${safe(p)}</td></tr>`).join('')}
          ${flow.consumers.map(c => `<tr><td class="negative">Consumes</td><td>${safe(c)}</td></tr>`).join('')}
          ${(!flow.producers.length && !flow.consumers.length) ? '<tr><td colspan="2" class="muted">No activities use this resource.</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;
}

// ── Handlers ──

function selectResource(id) {
  store.selectedResourceId = id;
  emit('resource-selected', id);
  render();
}

function updateResource(field, value) {
  const r = store.resources.find(r => r.id === store.selectedResourceId);
  if (!r) return;

  if (field === 'id') {
    const oldId = r.id;
    const nextId = String(value || '').trim();
    if (!nextId) {
      showToast('Resource ID is required.', 'error');
      render();
      return;
    }
    if (nextId !== oldId && store.resourceMap.has(nextId)) {
      showToast(`Resource ID already exists: ${nextId}`, 'error');
      render();
      return;
    }
    r.id = nextId;
    store.selectedResourceId = nextId;
    store.resourceMap.delete(oldId);
    store.resourceMap.set(nextId, r);
    cascadeResourceRename(oldId, nextId);
    render();
    return;
  }

  r[field] = value;

  // Avoid full re-render on each keystroke to keep focus stable.
  if (field === 'name' || field === 'category') {
    if (filterText || filterCategory) refreshResourceList();
    else patchSelectedResourceListItem();
  }
}

function addResource() {
  const id = `new_resource_${store.resources.length + 1}`;
  const resource = { id, name: 'New Resource', description: '', category: 'material', revealedByDefault: false };
  store.resources.push(resource);
  store.resourceMap.set(id, resource);
  store.selectedResourceId = id;
  render();
}

function deleteResource(id) {
  if (!confirm(`Delete resource "${id}"?`)) return;
  store.resources = store.resources.filter(r => r.id !== id);
  store.resourceMap.delete(id);
  if (store.selectedResourceId === id) store.selectedResourceId = null;
  render();
}

async function saveResources() {
  try {
    await saveFile('resources');
    showToast('Resources saved', 'success');
  } catch (err) {
    showToast(`Failed: ${err.message}`, 'error');
  }
}

function setFilter(text) { filterText = text; refreshResourceList(); }
function setCategoryFilter(cat) { filterCategory = cat; refreshResourceList(); }

function getFilteredResources() {
  let resources = store.resources;

  if (filterText) {
    const s = filterText.toLowerCase();
    resources = resources.filter(r => (r.id || '').toLowerCase().includes(s) || (r.name || '').toLowerCase().includes(s));
  }
  if (filterCategory) {
    resources = resources.filter(r => (r.category || 'other') === filterCategory);
  }

  return resources;
}

function renderResourceListHtml(resources, flows) {
  return resources.map((r) => {
    const flow = flows.get(r.id);
    const isSelected = r.id === store.selectedResourceId;
    return `
      <div class="item econ-resource-item ${isSelected ? 'selected' : ''}" data-resource-id="${safe(r.id)}" style="cursor:pointer;${isSelected ? 'border-color:var(--accent)' : ''}" onclick="_econ.selectResource('${safe(r.id)}')">
        <div class="flex" style="justify-content:space-between">
          <strong class="econ-resource-id">${safe(r.id)}</strong>
          <span class="badge econ-resource-category">${safe(r.category || 'other')}</span>
        </div>
        <div class="muted econ-resource-name" style="font-size:0.85rem">${safe(r.name)}</div>
        ${flow ? `<div style="font-size:0.78rem;margin-top:4px">
          ${flow.producers.length ? `<span class="text-success">+${flow.producers.length} produce</span>` : ''}
          ${flow.consumers.length ? `<span class="text-danger" style="margin-left:6px">-${flow.consumers.length} consume</span>` : ''}
        </div>` : ''}
      </div>`;
  }).join('');
}

function refreshResourceList() {
  if (!container) return;

  const listEl = container.querySelector('#econResourceList');
  const countEl = container.querySelector('#econResourceCount');
  if (!listEl || !countEl) {
    render();
    return;
  }

  const resources = getFilteredResources();
  const flows = flowCache || (flowCache = buildFlowTable());

  listEl.innerHTML = renderResourceListHtml(resources, flows);
  countEl.textContent = resources.length;
}

function patchSelectedResourceListItem() {
  if (!container) return;

  const r = store.resources.find(r => r.id === store.selectedResourceId);
  if (!r) return;

  const item = container.querySelector('.econ-resource-item.selected');
  if (!item) return;

  const idEl = item.querySelector('.econ-resource-id');
  if (idEl) idEl.textContent = r.id || '';

  const categoryEl = item.querySelector('.econ-resource-category');
  if (categoryEl) categoryEl.textContent = r.category || 'other';

  const nameEl = item.querySelector('.econ-resource-name');
  if (nameEl) nameEl.textContent = r.name || '';
}
