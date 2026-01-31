export function safe(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function numberOrDefault(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function cleanObject(obj) {
  const cleaned = {};
  Object.entries(obj).forEach(([key, val]) => {
    if (val !== undefined && val !== '' && val !== null) cleaned[key] = val;
  });
  return cleaned;
}

export function cloneJson(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

export function kvToObject(list, mode) {
  const out = {};
  (list || []).forEach(entry => {
    const id = (entry.id || entry.itemId || '').trim();
    if (!id) return;

    if (mode === 'range') {
      const min = entry.min !== '' && entry.min !== null ? Number(entry.min) : null;
      const max = entry.max !== '' && entry.max !== null ? Number(entry.max) : null;

      if (min !== null && max !== null) {
        out[id] = min === max ? min : { min, max };
      } else if (min !== null) {
        out[id] = min;
      }
    } else {
      const amount = entry.amount !== '' && entry.amount !== null ? Number(entry.amount || entry.count) : null;
      if (amount !== null) out[id] = amount;
    }
  });
  return out;
}

export function kvListFromObject(obj, mode, keyLabel) {
  if (!obj) return [];
  return Object.entries(obj).map(([id, value]) => {
    if (mode === 'range') {
      const range = toRangeFields(value);
      return { id, min: range.min, max: range.max };
    }

    const amount = typeof value === 'object' ? (value.amount ?? value.count ?? '') : value;
    const entry = { id, amount };
    if (keyLabel === 'itemId') entry.itemId = id;
    return entry;
  });
}

export function toRangeFields(value) {
  if (value === undefined || value === null || value === '') return { min: '', max: '' };
  if (typeof value === 'object') {
    return { min: value.min ?? '', max: value.max ?? '' };
  }
  const num = Number(value);
  if (!Number.isFinite(num)) return { min: '', max: '' };
  return { min: num, max: num };
}

export function rangeValue(min, max, defaultValue = null) {
  const hasMin = min !== '' && min !== null && min !== undefined;
  const hasMax = max !== '' && max !== null && max !== undefined;
  if (hasMin && hasMax) {
    const minNum = Number(min);
    const maxNum = Number(max);
    if (minNum === maxNum) return minNum;
    return { min: minNum, max: maxNum };
  }
  if (hasMin) return Number(min);
  if (hasMax) return Number(max);
  return defaultValue;
}

export function parseTags(text) {
  if (!text) return [];
  return text.split(',').map(t => t.trim()).filter(Boolean);
}

export function parseModifiers(text) {
  if (!text || !text.trim()) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function formatRange(val) {
  if (val && typeof val === 'object') {
    if (val.min !== undefined && val.max !== undefined) return `${val.min}-${val.max}`;
    if (val.min !== undefined) return `${val.min}+`;
    if (val.max !== undefined) return `${val.max}`;
  }
  return val;
}
