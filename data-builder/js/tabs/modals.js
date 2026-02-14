import { store, on, cascadeModalRename } from '../state.js';
import { safe, showToast } from '../utils.js';
import { saveFile } from '../data-io.js';
import { initPreview, renderPreview, destroyPreview } from '../modal-preview.js';

let container = null;
let previewInitialized = false;
let debounceTimer = null;

const MODAL_TYPES = [
  { key: 'story', label: 'Story', icon: '📖' },
  { key: 'lore', label: 'Lore', icon: '🔮' },
  { key: 'lesson', label: 'Lesson', icon: '💡' },
];

let activeTypeFilters = new Set(MODAL_TYPES.map(t => t.key));
let filterCountdownOnly = false;

function getTypeIcon(type) {
  const hit = MODAL_TYPES.find(t => t.key === type);
  return hit?.icon || '📄';
}

function escapeJsSingleQuoted(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

// ── Color options for the formatting toolbar ──
const fgColors = [
  { tag: 'neon_cyan',       label: 'Cyan',        hex: '#00ffff' },
  { tag: 'terminal_green',  label: 'Green',       hex: '#00ff00' },
  { tag: 'hot_pink',        label: 'Pink',        hex: '#ff00ff' },
  { tag: 'electric_orange', label: 'Orange',      hex: '#ff6600' },
  { tag: 'bright_yellow',   label: 'Yellow',      hex: '#ffff00' },
  { tag: 'gold',            label: 'Gold',        hex: '#ffd700' },
  { tag: 'purple',          label: 'Purple',      hex: '#a78bfa' },
  { tag: 'rose',            label: 'Rose',        hex: '#f472b6' },
  { tag: 'lava_red',        label: 'Red',         hex: '#ff3300' },
  { tag: 'emerald',         label: 'Emerald',     hex: '#34d399' },
  { tag: 'white',           label: 'White',       hex: '#ffffff' },
  { tag: 'light_gray',      label: 'Light Gray',  hex: '#cccccc' },
  { tag: 'mid_gray',        label: 'Mid Gray',    hex: '#888888' },
  { tag: 'dim_gray',        label: 'Dim Gray',    hex: '#555555' },
];

const bgColors = [
  { tag: 'black',           label: 'Black',       hex: '#000000' },
  { tag: 'dark_blue',       label: 'Dark Blue',   hex: '#0a1628' },
  { tag: 'vga_blue',        label: 'VGA Blue',    hex: '#0000aa' },
  { tag: 'dark_green',      label: 'Dark Green',  hex: '#002200' },
  { tag: 'dark_gray',       label: 'Dark Gray',   hex: '#1a1a1a' },
  { tag: 'neon_cyan_dim',   label: 'Dim Cyan',    hex: '#006666' },
  { tag: 'hot_pink_dim',    label: 'Dim Pink',    hex: '#660066' },
];

// ── Tab lifecycle ──

export function init(el) {
  container = el;
  on('data-loaded', render);
  on('save-complete', render);
  window._modals = {
    selectModal, updateModal, updateModalBody, addModal, deleteModal, saveModals,
    wrapSelection, insertAtCursor, refreshPreview, duplicateModal,
    toggleTypeFilter, toggleCountdownFilter
  };
}

export function activate() {
  if (container) container.style.overflow = 'hidden';
  render();
}

export function deactivate() {
  clearTimeout(debounceTimer);
  debounceTimer = null;
  if (container) container.style.overflow = '';
  if (previewInitialized) {
    destroyPreview();
    previewInitialized = false;
  }
}

// ── Render ──

function toggleTypeFilter(type) {
  if (activeTypeFilters.has(type)) activeTypeFilters.delete(type);
  else activeTypeFilters.add(type);

  if (activeTypeFilters.size === 0) {
    activeTypeFilters = new Set(MODAL_TYPES.map(t => t.key));
  }

  render();
}

function toggleCountdownFilter() {
  filterCountdownOnly = !filterCountdownOnly;
  render();
}

function render() {
  if (!container) return;

  if (previewInitialized) {
    destroyPreview();
    previewInitialized = false;
  }

  if (!store.selectedModalId && store.modals.length > 0) {
    store.selectedModalId = store.modals[0].id;
  }

  // Save focus/selection state
  const activeEl = document.activeElement;
  const activeId = activeEl?.getAttribute('data-focus-id');
  const selStart = activeEl?.selectionStart;
  const selEnd = activeEl?.selectionEnd;

  const filtered = store.modals.filter(modal => {
    const type = modal.type || 'lore';
    if (activeTypeFilters.size > 0 && !activeTypeFilters.has(type)) return false;
    if (filterCountdownOnly && !modal.countdown) return false;
    return true;
  });

  if (filtered.length > 0 && !filtered.some(modal => modal.id === store.selectedModalId)) {
    store.selectedModalId = filtered[0].id;
  }

  const m = store.modals.find(m => m.id === store.selectedModalId);

  container.innerHTML = `
    <div class="tab-panel__content modals-shell">
      <!-- Left: Modal list -->
      <div class="modals-sidebar">
        <div class="panel__header" style="flex-shrink:0">
          <h2>Modals</h2>
          <div class="flex" style="gap:6px;justify-content:flex-end">
            ${MODAL_TYPES.map(t => `
              <button class="icon-btn small" type="button" style="width:30px;height:28px;padding:0;display:grid;place-items:center;line-height:1;font-size:0.95rem" title="New ${safe(t.label)} modal" onclick="_modals.addModal('${t.key}')">${t.icon}</button>
            `).join('')}
            <button class="small" type="button" onclick="_modals.saveModals()">Save</button>
          </div>
        </div>
        <div class="flex" style="gap:6px;flex-wrap:nowrap;align-items:center;flex-shrink:0">
          ${MODAL_TYPES.map(t => {
            const isActive = activeTypeFilters.has(t.key);
            return `
              <button class="icon-btn ghost small ${isActive ? 'is-active' : ''}" type="button" style="width:30px;height:28px;padding:0;display:grid;place-items:center;line-height:1;font-size:0.95rem;${isActive ? 'border-color:var(--accent);color:var(--accent-bright);box-shadow:0 0 0 3px rgba(125,211,252,0.12)' : ''}" title="Filter ${safe(t.label)}" aria-pressed="${isActive}" onclick="_modals.toggleTypeFilter('${t.key}')">${t.icon}</button>
            `;
          }).join('')}
          <span style="width:1px;height:18px;background:var(--border);margin:0 2px"></span>
          <button class="icon-btn ghost small ${filterCountdownOnly ? 'is-active' : ''}" type="button" style="width:30px;height:28px;padding:0;display:grid;place-items:center;line-height:1;font-size:0.8rem;${filterCountdownOnly ? 'border-color:var(--accent);color:var(--accent-bright);box-shadow:0 0 0 3px rgba(125,211,252,0.12)' : ''}" title="Filter: Countdown (3s)" aria-pressed="${filterCountdownOnly}" onclick="_modals.toggleCountdownFilter()">3s</button>
          <span class="muted" style="margin-left:auto;font-size:0.75rem;white-space:nowrap">${filtered.length}/${store.modals.length}</span>
        </div>

        <div class="list modal-list">
          ${filtered.length ? filtered.map(modal => {
            const isSelected = modal.id === store.selectedModalId;
            const typeIcon = getTypeIcon(modal.type);
            return `
              <div class="item modal-list__item ${isSelected ? 'is-selected' : ''}" onclick="_modals.selectModal('${escapeJsSingleQuoted(modal.id)}')">
                <span class="modal-list__emoji">${typeIcon}</span>
                <span class="modal-list__meta">
                  <span class="modal-list__id">${safe(modal.id)}</span>
                  <span class="modal-list__title">${safe(modal.title || modal.id)}</span>
                </span>
              </div>`;
          }).join('') : '<div class="hint" style="padding:10px">No modals match the current filters.</div>'}
        </div>
      </div>

      <!-- Right: Editor + Preview -->
      <div class="modals-editor">
        ${m ? renderEditor(m) : '<div class="hint" style="padding:20px">Select a modal to edit, or create a new one.</div>'}
      </div>
    </div>
  `;

  // Restore focus
  if (activeId) {
    const target = document.querySelector(`[data-focus-id="${activeId}"]`);
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      setTimeout(() => {
        target.focus();
        if (typeof selStart === 'number' && typeof selEnd === 'number') {
          target.setSelectionRange(selStart, selEnd);
        }
      }, 0);
    }
  }

  // Reinit and refresh preview after render
  setTimeout(() => {
    if (!document.getElementById('modalPreviewCanvas')) return;
    initPreview('modalPreviewCanvas');
    previewInitialized = true;
    refreshPreview();
  }, 50);
}

function renderEditor(m) {
  // Palette options for style dropdowns
  const paletteOptions = [
    { value: '', label: '(default)' },
    { value: 'BLACK', label: 'Black' }, { value: 'WHITE', label: 'White' },
    { value: 'LIGHT_GRAY', label: 'Light Gray' }, { value: 'MID_GRAY', label: 'Mid Gray' },
    { value: 'DIM_GRAY', label: 'Dim Gray' }, { value: 'DARK_GRAY', label: 'Dark Gray' },
    { value: 'NEON_CYAN', label: 'Neon Cyan' }, { value: 'NEON_TEAL', label: 'Neon Teal' },
    { value: 'TERMINAL_GREEN', label: 'Terminal Green' },
    { value: 'HOT_PINK', label: 'Hot Pink' }, { value: 'MAGENTA', label: 'Magenta' },
    { value: 'ELECTRIC_ORANGE', label: 'Electric Orange' }, { value: 'BRIGHT_ORANGE', label: 'Bright Orange' },
    { value: 'BRIGHT_YELLOW', label: 'Bright Yellow' }, { value: 'GOLD', label: 'Gold' },
    { value: 'AMBER', label: 'Amber' }, { value: 'EMERALD', label: 'Emerald' },
    { value: 'PURPLE', label: 'Purple' }, { value: 'ROSE', label: 'Rose' },
    { value: 'HEAT_RED', label: 'Heat Red' }, { value: 'LAVA_RED', label: 'Lava Red' },
    { value: 'INTRO_A', label: 'Intro Yellow' }, { value: 'INTRO_B', label: 'Intro Pink' }
  ];

  const borderStyleOptions = [
    { value: '', label: '(default)' },
    { value: 'SINGLE', label: 'Single' }, { value: 'DOUBLE', label: 'Double' },
    { value: 'HEAVY', label: 'Heavy' }
  ];

  return `
    <!-- Top row: metadata fields -->
    <div class="panel" style="flex-shrink:0;padding:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr 120px 120px 120px auto;gap:10px;align-items:end">
        <div><label>ID</label><input type="text" data-focus-id="modal-id" value="${safe(m.id)}" onchange="_modals.updateModal('id', this.value)" style="padding:6px 8px;font-size:0.85rem"></div>
        <div><label>Title</label><input type="text" data-focus-id="modal-title" value="${safe(m.title)}" oninput="_modals.updateModal('title', this.value); _modals.refreshPreview()" style="padding:6px 8px;font-size:0.85rem"></div>
        <div>
          <label>Type</label>
          <select data-focus-id="modal-type" onchange="_modals.updateModal('type', this.value); _modals.refreshPreview()" style="padding:6px 8px;font-size:0.85rem">
            <option value="story" ${m.type === 'story' ? 'selected' : ''}>Story</option>
            <option value="lore" ${m.type === 'lore' ? 'selected' : ''}>Lore</option>
            <option value="lesson" ${m.type === 'lesson' ? 'selected' : ''}>Lesson</option>
          </select>
        </div>
        <div class="flex" style="gap:6px;padding-bottom:2px">
          <label class="muted" style="margin:0;font-size:0.8rem;white-space:nowrap">Show Once</label>
          <input type="checkbox" ${m.showOnce ? 'checked' : ''} onchange="_modals.updateModal('showOnce', this.checked)">
        </div>
        <div class="flex" style="gap:6px;padding-bottom:2px">
          <label class="muted" style="margin:0;font-size:0.8rem;white-space:nowrap">Countdown</label>
          <input type="checkbox" ${m.countdown ? 'checked' : ''} onchange="_modals.updateModal('countdown', this.checked); _modals.refreshPreview()">
        </div>
        <div>
          <div class="flex" style="gap:6px;justify-content:flex-end">
            <button class="small" onclick="_modals.duplicateModal()" style="padding:6px 10px;font-size:0.8rem">Duplicate</button>
            <button class="danger small" onclick="_modals.deleteModal('${escapeJsSingleQuoted(m.id)}')" style="padding:6px 10px;font-size:0.8rem">Delete</button>
          </div>
        </div>
      </div>

      <!-- Style overrides row -->
      <details style="margin-top:10px">
        <summary class="muted" style="cursor:pointer;font-size:0.8rem;user-select:none">Style Overrides</summary>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:8px">
          <div>
            <label style="font-size:0.75rem">Border Style</label>
            <select style="padding:4px;font-size:0.8rem" onchange="_modals.updateModal('borderStyle', this.value); _modals.refreshPreview()">
              ${borderStyleOptions.map(o => `<option value="${o.value}" ${(m.borderStyle || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem">Border Color</label>
            <select style="padding:4px;font-size:0.8rem" onchange="_modals.updateModal('borderColor', this.value); _modals.refreshPreview()">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.borderColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem">Background</label>
            <select style="padding:4px;font-size:0.8rem" onchange="_modals.updateModal('backgroundColor', this.value); _modals.refreshPreview()">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.backgroundColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem">Title Color</label>
            <select style="padding:4px;font-size:0.8rem" onchange="_modals.updateModal('titleColor', this.value); _modals.refreshPreview()">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.titleColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.75rem">Body Color</label>
            <select style="padding:4px;font-size:0.8rem" onchange="_modals.updateModal('bodyColor', this.value); _modals.refreshPreview()">
              ${paletteOptions.map(o => `<option value="${o.value}" ${(m.bodyColor || '') === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </details>
    </div>

    <!-- Editor + Preview (stacked) -->
    <div style="flex:1;display:flex;flex-direction:column;gap:12px;min-height:0;overflow-y:auto">
      <!-- Body editor with toolbar -->
      <div style="display:flex;flex-direction:column;gap:0">
        <!-- Formatting toolbar -->
        <div class="modal-toolbar" style="display:flex;gap:4px;flex-wrap:wrap;padding:8px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-bottom:none;border-radius:var(--radius-sm) var(--radius-sm) 0 0;align-items:center">
          <!-- Bold / Dim -->
          <button class="tb-btn" onclick="_modals.wrapSelection('**','**')" title="Bold (White)">B</button>
          <button class="tb-btn" style="opacity:0.5" onclick="_modals.wrapSelection('~~','~~')" title="Dim text">~~</button>
          <span style="width:1px;height:18px;background:var(--border);margin:0 4px"></span>

          <!-- FG Color dropdown -->
          <select id="fgColorPicker" style="padding:2px 4px;font-size:0.8rem;background:#0b1220;border:1px solid var(--border);color:var(--text);border-radius:3px;max-width:100px">
            ${fgColors.map(c => `<option value="${c.tag}" style="color:${c.hex}">${c.label}</option>`).join('')}
          </select>
          <button class="tb-btn" onclick="_modals.wrapSelection('{{' + document.getElementById('fgColorPicker').value + '}}', '{{/}}')" title="Apply foreground color">FG</button>

          <span style="width:1px;height:18px;background:var(--border);margin:0 4px"></span>

          <!-- BG Color dropdown -->
          <select id="bgColorPicker" style="padding:2px 4px;font-size:0.8rem;background:#0b1220;border:1px solid var(--border);color:var(--text);border-radius:3px;max-width:100px">
            ${bgColors.map(c => `<option value="${c.tag}" style="color:${c.hex}">${c.label}</option>`).join('')}
          </select>
          <button class="tb-btn" onclick="_modals.wrapSelection('{{bg:' + document.getElementById('bgColorPicker').value + '}}', '{{/}}')" title="Apply background color">BG</button>

          <span style="width:1px;height:18px;background:var(--border);margin:0 4px"></span>

          <!-- Quick insert templates -->
          <button class="tb-btn" onclick="_modals.insertAtCursor('\\n')" title="Insert newline">\\n</button>

          <span style="flex:1"></span>
          <div class="hint" style="font-size:0.7rem;margin:0">**bold** &nbsp; ~~dim~~ &nbsp; {{color}}text{{/}} &nbsp; {{bg:color}}text{{/}}</div>
        </div>

        <!-- Body textarea -->
        <textarea
          id="modalBodyEditor"
          data-focus-id="modal-body"
          style="resize:vertical;border-radius:0 0 var(--radius-sm) var(--radius-sm);font-family:var(--font-mono);font-size:0.85rem;line-height:1.5;min-height:150px;height:200px;tab-size:2"
          oninput="_modals.updateModalBody(this.value)"
          spellcheck="false"
        >${safe(m.body)}</textarea>
      </div>

      <!-- Live preview (below) -->
      <div style="display:flex;flex-direction:column;gap:0;flex-shrink:0">
        <div style="padding:6px 8px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-bottom:none;border-radius:var(--radius-sm) var(--radius-sm) 0 0">
          <span class="muted" style="font-size:0.8rem">Live Preview (80×25)</span>
        </div>
        <div id="modalPreviewCanvas" style="border:1px solid var(--border);border-radius:0 0 var(--radius-sm) var(--radius-sm);overflow:hidden;background:#000;font-family:'VGA_9x8','Courier New',monospace;font-size:13px;line-height:1;letter-spacing:0;white-space:pre;user-select:none"></div>
      </div>
    </div>
  `;
}

// ── Actions ──

function selectModal(id) {
  store.selectedModalId = id;
  previewInitialized = false; // Force re-init since DOM is rebuilt
  render();
}

function updateModal(field, value) {
  const m = store.modals.find(m => m.id === store.selectedModalId);
  if (!m) return;

  if (field === 'id') {
    const oldId = m.id;
    const nextId = String(value ?? '').trim();
    if (!nextId) {
      showToast('Modal ID cannot be empty', 'error');
      render();
      return;
    }
    if (nextId !== oldId && store.modalMap.has(nextId)) {
      showToast(`Modal ID "${nextId}" already exists`, 'error');
      render();
      return;
    }

    m.id = nextId;
    store.selectedModalId = nextId;
    store.modalMap.delete(oldId);
    store.modalMap.set(nextId, m);
    cascadeModalRename(oldId, nextId);
    render();
    return;
  }

  m[field] = value;
}

function updateModalBody(value) {
  const m = store.modals.find(m => m.id === store.selectedModalId);
  if (!m) return;
  m.body = value;

  // Debounced preview update
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshPreview, 150);
}

function addModal(type = 'lore') {
  const nextType = type || 'lore';
  activeTypeFilters.add(nextType);
  filterCountdownOnly = false;

  const newId = 'new_modal_' + Date.now();
  const modal = {
    id: newId,
    title: 'New Modal',
    body: 'Modal body text goes here.\n\nUse {{neon_cyan}}color tags{{/}} for formatting.\nUse **bold** for emphasis.\nUse ~~dim~~ for subtle text.',
    type: nextType,
    showOnce: false,
    countdown: false
  };
  store.modals.push(modal);
  store.modalMap.set(newId, modal);
  store.selectedModalId = newId;
  previewInitialized = false;
  render();
}

function getUniqueCopyId(sourceId) {
  const base = `${sourceId || 'modal'}_copy`;
  if (!store.modalMap.has(base)) return base;

  let index = 2;
  let candidate = `${base}${index}`;
  while (store.modalMap.has(candidate)) {
    index += 1;
    candidate = `${base}${index}`;
  }
  return candidate;
}

function duplicateModal() {
  const source = store.modals.find(m => m.id === store.selectedModalId);
  if (!source) return;

  const nextId = getUniqueCopyId(source.id);
  const clone = JSON.parse(JSON.stringify(source));
  clone.id = nextId;
  clone.title = source.title ? `${source.title} (Copy)` : nextId;

  store.modals.push(clone);
  store.modalMap.set(nextId, clone);
  store.selectedModalId = nextId;
  previewInitialized = false;
  render();
  showToast(`Duplicated ${source.id} -> ${nextId}`, 'success');
}

function deleteModal(id) {
  if (!confirm(`Delete modal "${id}"?`)) return;
  store.modals = store.modals.filter(m => m.id !== id);
  store.modalMap.delete(id);
  if (store.selectedModalId === id) store.selectedModalId = null;
  previewInitialized = false;
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

// ── Formatting helpers ──

/**
 * Wrap the current text selection in the body textarea with prefix/suffix tags.
 * If no text is selected, inserts prefix+suffix at cursor and places cursor between them.
 */
function wrapSelection(prefix, suffix) {
  const textarea = document.getElementById('modalBodyEditor');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);

  const newText = text.substring(0, start) + prefix + selected + suffix + text.substring(end);
  textarea.value = newText;

  // Update store
  const m = store.modals.find(m => m.id === store.selectedModalId);
  if (m) m.body = newText;

  // Place cursor after the wrapped text (or between tags if no selection)
  const cursorPos = selected.length > 0
    ? start + prefix.length + selected.length + suffix.length
    : start + prefix.length;

  textarea.focus();
  textarea.setSelectionRange(cursorPos, cursorPos);

  // Refresh preview
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshPreview, 100);
}

/**
 * Insert text at the current cursor position.
 */
function insertAtCursor(text) {
  const textarea = document.getElementById('modalBodyEditor');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  const newText = val.substring(0, start) + text + val.substring(end);
  textarea.value = newText;

  const m = store.modals.find(m => m.id === store.selectedModalId);
  if (m) m.body = newText;

  textarea.focus();
  textarea.setSelectionRange(start + text.length, start + text.length);

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refreshPreview, 100);
}

/**
 * Refresh the live preview from current modal state.
 */
function refreshPreview() {
  const m = store.modals.find(m => m.id === store.selectedModalId);
  renderPreview(m || null);
}
