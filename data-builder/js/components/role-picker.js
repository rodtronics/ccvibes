import { store } from '../state.js';
import { safe } from '../utils.js';

export function renderRoleOptions(currentValue) {
  let html = '';
  store.roles.forEach(r => {
    const sel = r.id === currentValue ? 'selected' : '';
    html += `<option value="${safe(r.id)}" ${sel}>${safe(r.id)} (${safe(r.name)})</option>`;
  });
  return html;
}
