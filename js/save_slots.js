export const SLOT_COUNT = 8;
export const SLOT_IDS = Array.from({ length: SLOT_COUNT }, (_, index) => `sav${index + 1}`);

export const ACTIVE_SAVE_SLOT_KEY = 'ccv_active_save_slot';

const GAME_STATE_PREFIX = 'ccv_game_state_';
const SEEN_MODALS_PREFIX = 'ccv_seen_modals_';

const LEGACY_GAME_STATE_KEY = 'ccv_game_state';
const LEGACY_SEEN_MODALS_KEY = 'ccv_seen_modals';

const SLOT_INPUT_REGEX = /^(?:sav|save|cc_save)?0*([1-8])(?:\.sav)?$/i;
const SLOT_ZERO_ALIAS_REGEX = /^[0-7]$/;

export function normalizeSlotId(input) {
  if (input === null || input === undefined) return null;
  const token = String(input).trim().toLowerCase();
  if (!token) return null;

  if (SLOT_ZERO_ALIAS_REGEX.test(token)) {
    const slotNumber = Number(token) + 1;
    return `sav${slotNumber}`;
  }

  const match = token.match(SLOT_INPUT_REGEX);
  if (!match) return null;

  const slotNumber = Number(match[1]);
  if (Number.isNaN(slotNumber) || slotNumber < 1 || slotNumber > SLOT_COUNT) return null;
  return `sav${slotNumber}`;
}

export function isValidSlotId(slotId) {
  return normalizeSlotId(slotId) !== null;
}

export function getSlotNumber(slotId) {
  const normalized = normalizeSlotId(slotId);
  if (!normalized) return null;
  return Number(normalized.slice(3));
}

export function getSlotFileName(slotId) {
  const slotNumber = getSlotNumber(slotId);
  if (!slotNumber) return null;
  return `CC_SAVE${slotNumber}.SAV`;
}

export function getDefaultPlayerName(slotId) {
  const slotNumber = getSlotNumber(slotId);
  if (!slotNumber) return 'player1';
  return `player${slotNumber}`;
}

export function getGameStateKey(slotId) {
  const normalized = normalizeSlotId(slotId);
  if (!normalized) return null;
  return `${GAME_STATE_PREFIX}${normalized}`;
}

export function getSeenModalsKey(slotId) {
  const normalized = normalizeSlotId(slotId);
  if (!normalized) return null;
  return `${SEEN_MODALS_PREFIX}${normalized}`;
}

export function getActiveSaveSlot() {
  const stored = localStorage.getItem(ACTIVE_SAVE_SLOT_KEY);
  const normalized = normalizeSlotId(stored);
  return normalized || SLOT_IDS[0];
}

export function setActiveSaveSlot(slotId) {
  const normalized = normalizeSlotId(slotId);
  if (!normalized) return false;
  localStorage.setItem(ACTIVE_SAVE_SLOT_KEY, normalized);
  return true;
}

export function saveSlotExists(slotId) {
  const key = getGameStateKey(slotId);
  if (!key) return false;
  return localStorage.getItem(key) !== null;
}

export function getSlotRawState(slotId) {
  const key = getGameStateKey(slotId);
  if (!key) return null;
  return localStorage.getItem(key);
}

export function setSlotRawState(slotId, rawState) {
  const key = getGameStateKey(slotId);
  if (!key) return false;
  localStorage.setItem(key, rawState);
  return true;
}

export function removeSlotState(slotId) {
  const gameKey = getGameStateKey(slotId);
  const modalsKey = getSeenModalsKey(slotId);
  if (!gameKey || !modalsKey) return false;
  localStorage.removeItem(gameKey);
  localStorage.removeItem(modalsKey);
  return true;
}

export function getSlotPlayerName(slotId) {
  const raw = getSlotRawState(slotId);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const name = parsed?.playerName;
    if (typeof name === 'string' && name.trim() !== '') {
      return sanitizePlayerName(name);
    }
  } catch {
    return getDefaultPlayerName(slotId);
  }

  return getDefaultPlayerName(slotId);
}

export function sanitizePlayerName(name, fallback = 'player1') {
  const trimmed = String(name || '').trim().slice(0, 8);
  if (!trimmed) return fallback;
  return trimmed;
}

export function ensureSaveSlotStorage() {
  let activeSlot = getActiveSaveSlot();
  if (!setActiveSaveSlot(activeSlot)) {
    activeSlot = SLOT_IDS[0];
    setActiveSaveSlot(activeSlot);
  }

  const legacyState = localStorage.getItem(LEGACY_GAME_STATE_KEY);
  const slotOneKey = getGameStateKey(SLOT_IDS[0]);
  if (legacyState && slotOneKey && !localStorage.getItem(slotOneKey)) {
    localStorage.setItem(slotOneKey, legacyState);
  }

  const legacySeenModals = localStorage.getItem(LEGACY_SEEN_MODALS_KEY);
  const slotOneSeenKey = getSeenModalsKey(SLOT_IDS[0]);
  if (legacySeenModals && slotOneSeenKey && !localStorage.getItem(slotOneSeenKey)) {
    localStorage.setItem(slotOneSeenKey, legacySeenModals);
  }

  return activeSlot;
}
