import { store } from '../state.js';
import { safe } from '../utils.js';

export function renderResourceSelect(currentValue, onchangeAttr) {
  const categories = new Map();
  store.resources.forEach(r => {
    const cat = r.category || 'other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(r);
  });

  let html = `<select ${onchangeAttr}>`;
  html += `<option value="">-- select resource --</option>`;

  for (const [cat, resources] of categories) {
    html += `<optgroup label="${safe(cat)}">`;
    resources.forEach(r => {
      const sel = r.id === currentValue ? 'selected' : '';
      html += `<option value="${safe(r.id)}" ${sel}>${safe(r.id)} (${safe(r.name)})</option>`;
    });
    html += `</optgroup>`;
  }

  html += `</select>`;
  return html;
}

export function renderResourceOptions(currentValue) {
  const categories = new Map();
  store.resources.forEach(r => {
    const cat = r.category || 'other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(r);
  });

  let html = `<option value="">-- resource --</option>`;
  for (const [cat, resources] of categories) {
    html += `<optgroup label="${safe(cat)}">`;
    resources.forEach(r => {
      const sel = r.id === currentValue ? 'selected' : '';
      html += `<option value="${safe(r.id)}" ${sel}>${safe(r.id)}</option>`;
    });
    html += `</optgroup>`;
  }
  return html;
}
