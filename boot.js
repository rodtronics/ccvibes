// Crime Committer VI - Boot Screen & DOS Prompt
// 286-style POST screen shown during loading, optional DOS CLI

import { Palette } from './palette.js';
import {
  SLOT_IDS,
  ensureSaveSlotStorage,
  getActiveSaveSlot,
  getDefaultPlayerName,
  getSeenModalsKey,
  getSlotFileName,
  getSlotPlayerName,
  getSlotRawState,
  normalizeSlotId,
  saveSlotExists
} from './save_slots.js';

const HEADER_COLOR = Palette.NEON_CYAN;
const LABEL_COLOR = Palette.LIGHT_GRAY;
const VALUE_COLOR = Palette.WHITE;
const OK_COLOR = Palette.TERMINAL_GREEN;
const ACTIVE_SLOT_COLOR = Palette.ACTIVE_SLOT;
const DOT_COLOR = Palette.DIM_GRAY;
const ERROR_COLOR = Palette.HEAT_RED;
const PROMPT_COLOR = Palette.LIGHT_GRAY;
const INPUT_COLOR = Palette.WHITE;
const DOT_COLUMN = 38; // Column where dots end and "OK" begins

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Boot Screen ─────────────────────────────────────────────

export class BootScreen {
  constructor(buffer) {
    this.buffer = buffer;
    this.currentLine = 0;
  }

  drawHeader(slowBoot = false) {
    const b = this.buffer;
    b.clear();

    // BIOS banner
    b.writeText(1, 0, 'CCVI BIOS v6.0', HEADER_COLOR);

    // Hardware info
    b.writeText(1, 2, 'Main Processor', LABEL_COLOR);
    b.writeText(16, 2, ': MOS 6502 @ 1MHz', VALUE_COLOR);

    b.writeText(1, 3, 'Video', LABEL_COLOR);
    b.writeText(16, 3, ': TUI 80x25 Color', VALUE_COLOR);

    b.writeText(1, 4, 'Memory', LABEL_COLOR);
    if (slowBoot) {
      // Start at 0K — countRAM() will animate to 640K
      b.writeText(16, 4, ':    0K', VALUE_COLOR);
    } else {
      b.writeText(16, 4, ': 640K', VALUE_COLOR);
      b.writeText(23, 4, 'OK', OK_COLOR);
    }

    // Loading section header
    b.writeText(1, 6, 'Loading system files...', LABEL_COLOR);

    this.currentLine = 8;
  }

  async countRAM(onRender) {
    const b = this.buffer;
    for (let k = 0; k <= 640; k += 64) {
      b.writeText(16, 4, `: ${String(k).padStart(4)}K`, VALUE_COLOR);
      if (k === 640) b.writeText(22, 4, ' OK', OK_COLOR);
      onRender();
      if (k < 640) await sleep(50);
    }
  }

  addProgress(label) {
    const b = this.buffer;
    const y = this.currentLine;
    const x = 3;

    // Write label
    b.writeText(x, y, label, LABEL_COLOR);

    // Fill dots from end of label to DOT_COLUMN
    const dotsStart = x + label.length + 1;
    for (let i = dotsStart; i < DOT_COLUMN; i++) {
      b.writeText(i, y, '.', DOT_COLOR);
    }

    // Write OK
    b.writeText(DOT_COLUMN + 1, y, 'OK', OK_COLOR);

    this.currentLine++;
  }

  drawComplete() {
    const b = this.buffer;
    b.writeText(1, this.currentLine + 1, 'All systems nominal.', OK_COLOR);
  }
}

// ── DOS Prompt ──────────────────────────────────────────────

const PROMPT_STR = 'C:\\CCVI>';
const MAX_Y = 24; // last usable row (0-indexed, 25 rows)
const STORAGE_KEYS = {
  SETTINGS: 'ccv_tui_settings',
};
const HISTORY_MAX = 100;

// DOS Help Content (edit this block to change HELP output)
const DOS_HELP_SUMMARY = [
  { command: 'HELP.EXE', summary: 'Displays command help topics.' },
  { command: 'CC.EXE', summary: 'Launches the game and can switch slots.' },
  { command: 'DIR / LS', summary: 'Lists files in C:\\CCVI.' },
  { command: 'EXPORT', summary: 'Exports a save slot to file or clipboard.' },
  { command: 'IMPORT', summary: 'Imports a save file into a slot.' },
  { command: 'COPY', summary: 'Copies one save slot to another slot.' },
  { command: 'DEL', summary: 'Deletes a save slot file.' },
  { command: 'NAME', summary: 'Lists or edits save slot player names.' },
  { command: 'SAVE / STATUS', summary: 'Shows active slot status details.' },
  { command: 'AUTHBOOT', summary: 'Toggles authentic boot behavior.' },
  { command: 'CLS', summary: 'Clears the DOS screen.' },
  { command: 'VER', summary: 'Displays DOS version info.' },
  { command: 'CD', summary: 'Directory command (not supported here).' },
  { command: 'FORMAT', summary: 'Denied command (flavor response).' },
];

const DOS_HELP_DETAILS = {
  'help.exe': [
    'HELP.EXE',
    'Shows this command list.',
    'Run HELP <command> for command-specific notes.',
  ],
  'cc.exe': [
    'CC.EXE',
    'Launches Crime Committer VI.',
    'You can pass a slot alias before launch.',
  ],
  cc: [
    'CC',
    'Alias for CC.EXE.',
  ],
  run: [
    'RUN',
    'Alias for CC.EXE.',
  ],
  start: [
    'START',
    'Alias for CC.EXE.',
  ],
  exit: [
    'EXIT',
    'Alias for CC.EXE.',
  ],
  dir: [
    'DIR',
    'Lists files available in C:\\CCVI.',
  ],
  ls: [
    'LS',
    'Alias for DIR.',
  ],
  export: [
    'EXPORT',
    'Exports one slot at a time using -D (download) or -C (clipboard).',
    'Prompts for an optional visible password.',
  ],
  import: [
    'IMPORT',
    'Opens a file picker and imports the selected save into a slot.',
    'Prompts for password if required and asks overwrite confirmation.',
  ],
  copy: [
    'COPY',
    'Copies one save slot to another.',
    'Confirms before overwrite when target exists.',
  ],
  del: [
    'DEL',
    'Deletes one save slot file.',
    'Confirms before deletion.',
  ],
  delete: [
    'DELETE',
    'Alias for DEL.',
  ],
  name: [
    'NAME',
    'Without args: lists slot names.',
    'With args: NAME <slot> <newName> updates player name (max 8 chars).',
  ],
  save: [
    'SAVE',
    'Shows summary of active slot save data.',
  ],
  slot: [
    'SLOT',
    'Alias for SAVE.',
  ],
  status: [
    'STATUS',
    'Shows active slot and authentic boot state.',
  ],
  authboot: [
    'AUTHBOOT',
    'Shows or changes authentic boot mode.',
  ],
  cls: [
    'CLS',
    'Clears the screen and redraws DOS banner.',
  ],
  ver: [
    'VER',
    'Shows DOS version string.',
  ],
  cd: [
    'CD',
    'Directory switching is not available in this shell.',
  ],
  format: [
    'FORMAT',
    'This command is intentionally blocked.',
  ],
};

const HELP_ALIAS_MAP = {
  help: 'help.exe',
  cc: 'cc.exe',
  run: 'cc.exe',
  start: 'cc.exe',
  exit: 'cc.exe',
  ls: 'dir',
  slot: 'save',
  delete: 'del',
  rm: 'del',
};

export class DosPrompt {
  constructor(buffer, options = {}) {
    this.buffer = buffer;
    this.engine = options.engine || null;
    this.onRender = typeof options.onRender === 'function' ? options.onRender : null;
    this.inputBuffer = '';
    this.currentY = 0;
    this.pendingAction = null;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.historyDraft = '';
  }

  start() {
    ensureSaveSlotStorage();
    this.buffer.clear();
    this.inputBuffer = '';
    this.currentY = 0;
    this.pendingAction = null;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.historyDraft = '';
    this.drawBanner();
    this.drawPromptLine();
  }

  drawBanner() {
    // Generate a hash-looking version from random bytes (built-in crypto API)
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const ver = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const year = new Date().getFullYear();

    this.writeLine(`WFOS [WAVEFRONT OPERATING SYSTEM v ${ver}]`, HEADER_COLOR);
    this.writeLine(`(c) ${year} WFPRODUCTIONSNZ. ALL RIGHTS RESERVED.`, LABEL_COLOR);
    this.advanceLine();
  }

  handleKey(key) {
    if (!this.pendingAction && key === 'ArrowUp') {
      this.recallHistoryUp();
      return null;
    }
    if (!this.pendingAction && key === 'ArrowDown') {
      this.recallHistoryDown();
      return null;
    }

    if (key === 'Enter') {
      return this.execute();
    }
    if (key === 'Backspace') {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
    } else if (key.length === 1) {
      // Printable character — cap input length to prevent overflow
      if (this.inputBuffer.length < 80 - PROMPT_STR.length - 1) {
        this.inputBuffer += key;
      }
    }
    // Redraw the current input line
    this.drawPromptLine();
    return null;
  }

  execute() {
    const rawCmd = this.inputBuffer.trim();
    const cmd = rawCmd.toLowerCase();
    this.inputBuffer = '';

    // Advance past the typed command line
    this.advanceLine();

    if (this.pendingAction) {
      const lines = this.resolvePendingAction(rawCmd);
      if (Array.isArray(lines) && lines.length > 0) {
        this.outputLines(lines);
      } else {
        this.drawPromptLine();
      }
      return null;
    }

    if (rawCmd) {
      this.pushHistory(rawCmd);
    }

    const launchResult = this.tryHandleLaunchCommand(rawCmd);
    if (launchResult === 'launch') {
      return launchResult;
    }
    if (launchResult?.lines?.length) {
      this.outputLines(launchResult.lines);
      return null;
    }

    if (cmd === '') {
      this.drawPromptLine();
      return null;
    }

    const lines = this.getResponse(rawCmd);
    if (lines.length === 0) {
      this.drawPromptLine();
      return null;
    }
    this.outputLines(lines);
    return null;
  }

  getResponse(command) {
    const cmd = String(command || '').trim();
    const parts = cmd.split(/\s+/);
    const base = (parts[0] || '').toLowerCase();

    if (base === 'dir' || base === 'ls') {
      return this.getDirectoryLines();
    }

    if (base === 'ver') {
      return [{ text: 'CCVI-DOS Version 6.22', color: VALUE_COLOR }];
    }

    if (base === 'help' || base === 'help.exe') {
      return this.getHelpLines(parts[1]?.toLowerCase());
    }

    if (base === 'save' || base === 'slot') {
      return this.getSaveSummary();
    }

    if (base === 'status') {
      return this.getStatusSummary();
    }

    if (base === 'authboot') {
      return this.handleAuthBoot(parts[1]);
    }

    if (base === 'cls') {
      this.buffer.clear();
      this.currentY = 0;
      this.drawBanner();
      return [];
    }

    if (base === 'export') {
      return this.beginExport(parts);
    }

    if (base === 'import') {
      return this.beginImport(parts);
    }

    if (base === 'copy') {
      return this.beginCopy(parts);
    }

    if (base === 'name') {
      return this.handleName(parts);
    }

    if (base === 'format') {
      return [{ text: 'Access denied. Nice try, criminal.', color: ERROR_COLOR }];
    }

    if (base === 'del' || base === 'delete' || base === 'rm') {
      return this.beginDelete(parts);
    }

    if (base === 'cd') {
      return [{ text: 'Invalid directory', color: ERROR_COLOR }];
    }

    return [
      { text: 'Bad command or file name', color: ERROR_COLOR },
      { text: 'Type HELP.EXE for command list.', color: DOT_COLOR },
    ];
  }

  getSaveSummary() {
    const activeSlot = this.getActiveSlot();
    const fileName = getSlotFileName(activeSlot) || activeSlot.toUpperCase();
    const raw = getSlotRawState(activeSlot);
    if (!raw) {
      return [{ text: `${fileName} not found`, color: ERROR_COLOR }];
    }

    const sizeText = raw.length.toLocaleString();
    const lines = [{ text: `${fileName} present (${sizeText} bytes)`, color: OK_COLOR }];

    try {
      const parsed = JSON.parse(raw);
      const cash = parsed?.resources?.cash ?? 0;
      const heat = Math.floor(parsed?.resources?.heat ?? 0);
      const cred = Math.floor(parsed?.resources?.cred ?? 0);
      const crew = parsed?.crew?.staff?.length ?? 0;
      const runs = parsed?.runs?.length ?? 0;
      const name = parsed?.playerName || getDefaultPlayerName(activeSlot);
      lines.push(
        { text: `Slot: ${activeSlot.toUpperCase()}  Name: ${name}`, color: VALUE_COLOR },
        { text: `Resources: cash=${cash} heat=${heat} cred=${cred}`, color: VALUE_COLOR },
        { text: `Crew: ${crew}  Runs tracked: ${runs}`, color: VALUE_COLOR },
      );
    } catch {
      lines.push({ text: 'Save payload is not valid JSON', color: ERROR_COLOR });
    }

    return lines;
  }

  getStatusSummary() {
    const settings = this.readSettings();
    const activeSlot = this.getActiveSlot();
    const saveExists = saveSlotExists(activeSlot);
    const seenKey = getSeenModalsKey(activeSlot);
    const seenModalsExists = seenKey ? !!localStorage.getItem(seenKey) : false;
    const authenticBoot = !!settings.authenticBoot;

    return [
      { text: `Active slot: ${activeSlot.toUpperCase()}`, color: VALUE_COLOR },
      { text: `${getSlotFileName(activeSlot)}: ${saveExists ? 'present' : 'missing'}`, color: saveExists ? OK_COLOR : ERROR_COLOR },
      { text: `Seen modals cache: ${seenModalsExists ? 'present' : 'missing'}`, color: seenModalsExists ? LABEL_COLOR : DOT_COLOR },
      { text: `Authentic boot: ${authenticBoot ? 'ON' : 'OFF'}`, color: authenticBoot ? OK_COLOR : LABEL_COLOR },
      { text: 'Tip: AUTHBOOT ON|OFF|TOGGLE to change startup mode', color: DOT_COLOR },
    ];
  }

  getActiveSlot() {
    if (this.engine?.getActiveSaveSlot) {
      return this.engine.getActiveSaveSlot();
    }
    return getActiveSaveSlot();
  }

  getDirectoryLines() {
    const activeSlot = this.getActiveSlot();
    const files = [
      { name: 'CC.EXE', size: 49152, color: Palette.EXECUTABLE },
      { name: 'HELP.EXE', size: this.getHelpExecutableSize(), color: Palette.EXECUTABLE },
    ];

    SLOT_IDS.forEach((slotId) => {
      const raw = getSlotRawState(slotId);
      if (!raw) return;
      files.push({
        name: getSlotFileName(slotId),
        size: raw.length,
        color: slotId === activeSlot ? ACTIVE_SLOT_COLOR : VALUE_COLOR
      });
    });

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const lines = [
      { text: ' Volume in drive C is CCVI', color: LABEL_COLOR },
      { text: ' Directory of C:\\CCVI', color: LABEL_COLOR },
      { text: '', color: LABEL_COLOR },
    ];

    const timestamp = this.getDosTimestamp();
    files.forEach((file) => {
      const base = file.name.replace(/\.[^/.]+$/, '').padEnd(8, ' ');
      const ext = file.name.split('.').pop().padEnd(3, ' ');
      const line = `${base} ${ext}  ${file.size.toLocaleString().padStart(10)}  ${timestamp}`;
      lines.push({ text: line, color: file.color });
    });

    lines.push(
      { text: `         ${files.length} File(s)     ${totalBytes.toLocaleString()} bytes`, color: LABEL_COLOR },
      { text: '         0 Dir(s)     524,288 bytes free', color: LABEL_COLOR },
    );
    return lines;
  }

  getHelpLines(topic = '') {
    const normalizedTopic = HELP_ALIAS_MAP[topic] || topic;
    if (!normalizedTopic) {
      const lines = [{ text: 'CCVI-DOS Command List', color: HEADER_COLOR }];
      DOS_HELP_SUMMARY.forEach((entry) => {
        lines.push({ text: `${entry.command.padEnd(12)} ${entry.summary}`, color: VALUE_COLOR });
      });
      lines.push({ text: 'Use HELP <command> for command details.', color: DOT_COLOR });
      lines.push({ text: 'Slot aliases: 0-7, SAV1-SAV8, CC_SAVE1-CC_SAVE8', color: DOT_COLOR });
      return lines;
    }

    const detail = DOS_HELP_DETAILS[normalizedTopic];
    if (!detail) {
      return [
        { text: `No help topic for "${topic}"`, color: ERROR_COLOR },
        { text: 'Run HELP.EXE for available commands.', color: DOT_COLOR },
      ];
    }

    return detail.map((line, index) => ({ text: line, color: index === 0 ? HEADER_COLOR : VALUE_COLOR }));
  }

  getHelpExecutableSize() {
    return JSON.stringify({ summary: DOS_HELP_SUMMARY, details: DOS_HELP_DETAILS }).length;
  }

  tryHandleLaunchCommand(command) {
    const cmd = String(command || '').trim();
    if (!cmd) return null;

    const parts = cmd.split(/\s+/);
    const base = (parts[0] || '').toLowerCase();
    if (!['cc.exe', 'cc', 'run', 'start', 'exit'].includes(base)) {
      return null;
    }

    const slotToken = parts[1];
    if (!slotToken) {
      return 'launch';
    }

    const slotId = normalizeSlotId(slotToken);
    if (!slotId) {
      return {
        lines: [{ text: 'Invalid slot. Use 0-7, SAV1-SAV8, or CC_SAVE1-CC_SAVE8', color: ERROR_COLOR }]
      };
    }

    if (this.engine?.switchSaveSlot) {
      const result = this.engine.switchSaveSlot(slotId, { saveCurrent: true, createIfMissing: true });
      if (!result.ok) {
        return { lines: [{ text: result.reason || 'Failed to switch slot', color: ERROR_COLOR }] };
      }
      return 'launch';
    }

    return 'launch';
  }

  beginCopy(parts) {
    const sourceId = normalizeSlotId(parts[1]);
    const targetId = normalizeSlotId(parts[2]);

    if (!sourceId || !targetId) {
      return [{ text: 'Usage: COPY <sourceSlot> <targetSlot>', color: ERROR_COLOR }];
    }
    if (sourceId === targetId) {
      return [{ text: 'Source and target must differ', color: ERROR_COLOR }];
    }

    if (!this.engine?.slotExists?.(sourceId)) {
      return [{ text: 'Source slot is empty', color: ERROR_COLOR }];
    }

    const targetExists = this.engine?.slotExists?.(targetId);
    if (targetExists) {
      this.pendingAction = { type: 'copy_confirm', sourceId, targetId };
      return [{ text: `Overwrite ${getSlotFileName(targetId)}? Type YES or NO.`, color: VALUE_COLOR }];
    }

    return this.executeCopy(sourceId, targetId, false);
  }

  executeCopy(sourceId, targetId, overwrite) {
    if (!this.engine?.copySaveSlot) {
      return [{ text: 'Copy unavailable in this mode', color: ERROR_COLOR }];
    }

    const result = this.engine.copySaveSlot(sourceId, targetId, { overwrite });
    if (!result.ok) {
      return [{ text: result.reason || 'Copy failed', color: ERROR_COLOR }];
    }

    return [{
      text: `Copied ${getSlotFileName(sourceId)} -> ${getSlotFileName(targetId)}`,
      color: OK_COLOR
    }];
  }

  beginDelete(parts) {
    const slotId = normalizeSlotId(parts[1]);
    if (!slotId) {
      return [{ text: 'Usage: DEL <slot>', color: ERROR_COLOR }];
    }

    if (!this.engine?.slotExists?.(slotId)) {
      return [{ text: `${getSlotFileName(slotId)} is already empty`, color: LABEL_COLOR }];
    }

    this.pendingAction = { type: 'delete_confirm', slotId };
    return [{ text: `Delete ${getSlotFileName(slotId)}? Type YES or NO.`, color: ERROR_COLOR }];
  }

  executeDelete(slotId) {
    if (!this.engine?.deleteSaveSlot) {
      return [{ text: 'Delete unavailable in this mode', color: ERROR_COLOR }];
    }

    const result = this.engine.deleteSaveSlot(slotId);
    if (!result.ok) {
      return [{ text: result.reason || 'Delete failed', color: ERROR_COLOR }];
    }
    const lines = [{ text: `Deleted ${getSlotFileName(slotId)}`, color: OK_COLOR }];
    if (result.activeCleared) {
      lines.push({ text: 'Active slot reset to defaults in memory.', color: DOT_COLOR });
    }
    return lines;
  }

  handleName(parts) {
    if (!parts[1]) {
      return this.listSlotNames();
    }

    const slotId = normalizeSlotId(parts[1]);
    if (!slotId) {
      return [{ text: 'Usage: NAME <slot> <newName>', color: ERROR_COLOR }];
    }

    const newName = parts.slice(2).join(' ').trim();
    if (!newName) {
      return [{ text: 'Usage: NAME <slot> <newName>', color: ERROR_COLOR }];
    }

    if (!this.engine?.setSlotName) {
      return [{ text: 'Rename unavailable in this mode', color: ERROR_COLOR }];
    }

    const result = this.engine.setSlotName(slotId, newName);
    if (!result.ok) {
      return [{ text: result.reason || 'Rename failed', color: ERROR_COLOR }];
    }
    return [{ text: `${getSlotFileName(slotId)} renamed to ${result.name}`, color: OK_COLOR }];
  }

  listSlotNames() {
    const activeSlot = this.getActiveSlot();
    const lines = [{ text: 'Save Slots', color: HEADER_COLOR }];

    SLOT_IDS.forEach((slotId) => {
      const marker = slotId === activeSlot ? '*' : ' ';
      const fileName = getSlotFileName(slotId);
      const exists = this.engine?.slotExists?.(slotId) || saveSlotExists(slotId);
      if (!exists) {
        lines.push({ text: `${marker} ${fileName}  <empty>`, color: DOT_COLOR });
        return;
      }

      const name = this.engine?.getSlotName?.(slotId) || getSlotPlayerName(slotId) || getDefaultPlayerName(slotId);
      lines.push({ text: `${marker} ${fileName}  ${name}`, color: VALUE_COLOR });
    });

    lines.push({ text: '* = active slot', color: DOT_COLOR });
    return lines;
  }

  beginExport(parts) {
    const flag = (parts[1] || '').toLowerCase();
    const slotId = normalizeSlotId(parts[2]);

    if (!flag || !slotId || parts.length !== 3) {
      return [{ text: 'Usage: EXPORT -D|-C <slot>', color: ERROR_COLOR }];
    }
    if (flag !== '-d' && flag !== '/d' && flag !== '-c' && flag !== '/c') {
      return [{ text: 'Usage: EXPORT -D|-C <slot>', color: ERROR_COLOR }];
    }
    if (!this.engine?.slotExists?.(slotId)) {
      return [{ text: 'Slot is empty', color: ERROR_COLOR }];
    }

    const mode = flag.includes('d') ? 'download' : 'copy';
    this.pendingAction = { type: 'export_password', slotId, mode };
    return [{ text: 'Password (optional, visible):', color: VALUE_COLOR }];
  }

  beginImport(parts) {
    const slotId = normalizeSlotId(parts[1]);
    if (!slotId || parts.length !== 2) {
      return [{ text: 'Usage: IMPORT <slot>', color: ERROR_COLOR }];
    }

    this.pendingAction = { type: 'import_wait_file', slotId };
    this.pickImportFile(slotId);
    return [{ text: 'Select a .SAV file to import...', color: VALUE_COLOR }];
  }

  pickImportFile(slotId) {
    if (typeof document === 'undefined') {
      this.pendingAction = null;
      this.writeAsyncLines([{ text: 'Import unavailable in this environment', color: ERROR_COLOR }]);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sav,.json,text/plain';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      document.body.removeChild(input);

      if (!file) {
        this.pendingAction = null;
        this.writeAsyncLines([{ text: 'Import canceled.', color: LABEL_COLOR }]);
        return;
      }

      file.text().then((text) => {
        this.handleImportFileText(slotId, text);
      }).catch(() => {
        this.pendingAction = null;
        this.writeAsyncLines([{ text: 'Failed to read import file.', color: ERROR_COLOR }]);
      });
    });

    input.click();
  }

  handleImportFileText(slotId, text) {
    const preview = this.decodeImportText(text);
    if (!preview.ok) {
      this.pendingAction = null;
      this.writeAsyncLines([{ text: preview.reason, color: ERROR_COLOR }]);
      return;
    }

    if (preview.needsPassword) {
      this.pendingAction = { type: 'import_password', slotId, rawText: text };
      this.writeAsyncLines([{ text: 'Password:', color: VALUE_COLOR }]);
      return;
    }

    this.beginImportOverwrite(slotId, preview.rawSaveJson);
  }

  beginImportOverwrite(slotId, rawSaveJson) {
    const exists = this.engine?.slotExists?.(slotId);
    if (exists) {
      this.pendingAction = { type: 'import_confirm', slotId, rawSaveJson };
      this.writeAsyncLines([{ text: `Overwrite ${getSlotFileName(slotId)}? Type YES or NO.`, color: VALUE_COLOR }]);
      return;
    }

    const lines = this.executeImport(slotId, rawSaveJson, false);
    this.pendingAction = null;
    this.writeAsyncLines(lines);
  }

  executeImport(slotId, rawSaveJson, overwrite) {
    if (!this.engine?.importSaveSlot) {
      return [{ text: 'Import unavailable in this mode', color: ERROR_COLOR }];
    }

    const result = this.engine.importSaveSlot(slotId, rawSaveJson, { overwrite });
    if (!result.ok) {
      return [{ text: result.reason || 'Import failed', color: ERROR_COLOR }];
    }

    return [{ text: `Imported into ${getSlotFileName(slotId)}`, color: OK_COLOR }];
  }

  resolvePendingAction(inputText) {
    const value = String(inputText || '').trim();
    const lower = value.toLowerCase();
    const action = this.pendingAction;
    if (!action) return [{ text: 'No pending action', color: ERROR_COLOR }];

    if (action.type === 'copy_confirm') {
      this.pendingAction = null;
      if (lower === 'yes' || lower === 'y') {
        return this.executeCopy(action.sourceId, action.targetId, true);
      }
      return [{ text: 'Copy canceled.', color: LABEL_COLOR }];
    }

    if (action.type === 'delete_confirm') {
      this.pendingAction = null;
      if (lower === 'yes' || lower === 'y') {
        return this.executeDelete(action.slotId);
      }
      return [{ text: 'Delete canceled.', color: LABEL_COLOR }];
    }

    if (action.type === 'export_password') {
      this.pendingAction = null;
      return this.completeExport(action.slotId, action.mode, value);
    }

    if (action.type === 'import_password') {
      const decoded = this.decodeImportText(action.rawText, value);
      if (decoded.ok && decoded.needsPassword) {
        return [{ text: 'Password required. Try again or type CANCEL.', color: ERROR_COLOR }];
      }
      if (!decoded.ok) {
        return [{ text: decoded.reason, color: ERROR_COLOR }];
      }
      this.beginImportOverwrite(action.slotId, decoded.rawSaveJson);
      return [];
    }

    if (action.type === 'import_wait_file') {
      if (lower === 'cancel' || lower === 'c') {
        this.pendingAction = null;
        return [{ text: 'Import canceled.', color: LABEL_COLOR }];
      }
      return [{ text: 'Waiting for file selection... (type CANCEL to abort)', color: DOT_COLOR }];
    }

    if (action.type === 'import_confirm') {
      this.pendingAction = null;
      if (lower === 'yes' || lower === 'y') {
        return this.executeImport(action.slotId, action.rawSaveJson, true);
      }
      return [{ text: 'Import canceled.', color: LABEL_COLOR }];
    }

    return [{ text: 'Unhandled pending action', color: ERROR_COLOR }];
  }

  completeExport(slotId, mode, password) {
    if (!this.engine?.exportSaveSlot) {
      return [{ text: 'Export unavailable in this mode', color: ERROR_COLOR }];
    }

    const result = this.engine.exportSaveSlot(slotId);
    if (!result.ok) {
      return [{ text: result.reason || 'Export failed', color: ERROR_COLOR }];
    }

    const envelopeText = this.buildExportEnvelope(slotId, result.raw, password);
    if (mode === 'copy') {
      this.copyToClipboard(envelopeText);
      return [{ text: `Copied export for ${getSlotFileName(slotId)}`, color: OK_COLOR }];
    }

    this.downloadTextFile(getSlotFileName(slotId), envelopeText);
    return [{ text: `Downloaded ${getSlotFileName(slotId)}`, color: OK_COLOR }];
  }

  buildExportEnvelope(slotId, rawSaveJson, password) {
    const usePassword = !!password;
    let payload;
    if (usePassword) {
      payload = this.bytesToBase64Url(this.xorBytes(new TextEncoder().encode(rawSaveJson), password));
    } else {
      payload = this.toBase64Url(rawSaveJson);
    }

    const envelope = {
      magic: 'CCVI_SAVE',
      version: 1,
      slot: slotId,
      file: getSlotFileName(slotId),
      mode: usePassword ? 'pw' : 'plain',
      checksum: this.simpleChecksum(rawSaveJson),
      payload
    };

    return JSON.stringify(envelope, null, 2);
  }

  decodeImportText(rawText, password = '') {
    const trimmed = String(rawText || '').trim();
    if (!trimmed) return { ok: false, reason: 'Import file is empty' };

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, reason: 'Import file is not valid JSON' };
    }

    if (parsed?.magic === 'CCVI_SAVE' && typeof parsed.payload === 'string') {
      const mode = parsed.mode || 'plain';
      let rawSaveJson = '';

      if (mode === 'plain') {
        try {
          rawSaveJson = this.fromBase64UrlToText(parsed.payload);
        } catch {
          return { ok: false, reason: 'Invalid plain export payload' };
        }
      } else if (mode === 'pw') {
        if (!password) {
          return { ok: true, needsPassword: true };
        }

        try {
          const encryptedBytes = this.base64UrlToBytes(parsed.payload);
          const decrypted = this.xorBytes(encryptedBytes, password);
          rawSaveJson = new TextDecoder().decode(decrypted);
        } catch {
          return { ok: false, reason: 'Failed to decode encrypted payload' };
        }
      } else {
        return { ok: false, reason: 'Unsupported export mode' };
      }

      try {
        JSON.parse(rawSaveJson);
      } catch {
        if (mode === 'pw') {
          return { ok: false, reason: 'Invalid password or corrupted file' };
        }
        return { ok: false, reason: 'Export payload is invalid' };
      }

      if (parsed.checksum && this.simpleChecksum(rawSaveJson) !== parsed.checksum) {
        return { ok: false, reason: 'Checksum mismatch (wrong password or corrupted file)' };
      }

      return { ok: true, rawSaveJson };
    }

    if (parsed?.resources && parsed?.crew) {
      return { ok: true, rawSaveJson: JSON.stringify(parsed) };
    }

    return { ok: false, reason: 'File is not a recognized save format' };
  }

  writeAsyncLines(lines) {
    this.outputLines(lines);
    if (this.onRender) this.onRender();
  }

  outputLines(lines) {
    for (const line of lines) {
      this.writeLine(line.text, line.color);
    }
    this.advanceLine();
    this.drawPromptLine();
  }

  getDosTimestamp() {
    const date = new Date();
    const dateText = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
    const timeText = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase().replace(' ', '');
    return `${dateText}  ${timeText}`;
  }

  pushHistory(rawCmd) {
    this.commandHistory.push(rawCmd);
    if (this.commandHistory.length > HISTORY_MAX) {
      this.commandHistory.shift();
    }
    this.historyIndex = -1;
    this.historyDraft = '';
  }

  recallHistoryUp() {
    if (this.commandHistory.length === 0) return;
    if (this.historyIndex === -1) {
      this.historyDraft = this.inputBuffer;
      this.historyIndex = this.commandHistory.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex -= 1;
    }

    this.inputBuffer = this.commandHistory[this.historyIndex] || '';
    this.drawPromptLine();
  }

  recallHistoryDown() {
    if (this.commandHistory.length === 0 || this.historyIndex === -1) return;
    if (this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex += 1;
      this.inputBuffer = this.commandHistory[this.historyIndex] || '';
    } else {
      this.historyIndex = -1;
      this.inputBuffer = this.historyDraft || '';
      this.historyDraft = '';
    }
    this.drawPromptLine();
  }

  toBase64Url(text) {
    const bytes = new TextEncoder().encode(String(text ?? ''));
    return this.bytesToBase64Url(bytes);
  }

  bytesToBase64Url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  base64UrlToBytes(base64Url) {
    const normalized = String(base64Url || '').replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  fromBase64UrlToText(base64Url) {
    const bytes = this.base64UrlToBytes(base64Url);
    return new TextDecoder().decode(bytes);
  }

  xorBytes(bytes, password) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const keyBytes = new TextEncoder().encode(String(password || ''));
    if (keyBytes.length === 0) {
      return input.slice();
    }

    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] ^ keyBytes[i % keyBytes.length];
    }
    return output;
  }

  simpleChecksum(text) {
    const bytes = new TextEncoder().encode(String(text || ''));
    let hash = 2166136261;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  copyToClipboard(text) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
      return;
    }

    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // Ignore clipboard failures; caller still gets DOS feedback.
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }

  downloadTextFile(fileName, text) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
      return;
    }

    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'dump.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore failures; caller still gets DOS feedback.
    }
  }

  handleAuthBoot(arg) {
    const settings = this.readSettings();
    const current = !!settings.authenticBoot;

    if (!arg) {
      return [
        { text: `Authentic boot is currently ${current ? 'ON' : 'OFF'}`, color: current ? OK_COLOR : LABEL_COLOR },
        { text: 'Usage: AUTHBOOT ON | OFF | TOGGLE', color: DOT_COLOR },
      ];
    }

    let next = current;
    if (arg === 'on' || arg === '1' || arg === 'true') {
      next = true;
    } else if (arg === 'off' || arg === '0' || arg === 'false') {
      next = false;
    } else if (arg === 'toggle') {
      next = !current;
    } else {
      return [{ text: 'Invalid value. Use ON, OFF, or TOGGLE.', color: ERROR_COLOR }];
    }

    settings.authenticBoot = next;
    this.writeSettings(settings);
    return [{ text: `Authentic boot ${next ? 'ENABLED' : 'DISABLED'} (next launch).`, color: next ? OK_COLOR : LABEL_COLOR }];
  }

  readSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
      return {};
    } catch {
      return {};
    }
  }

  writeSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Ignore storage errors in DOS shell.
    }
  }

  drawPromptLine() {
    const b = this.buffer;
    const y = this.currentY;

    // Clear the line first
    for (let x = 0; x < 80; x++) {
      b.writeText(x, y, ' ', Palette.BLACK, Palette.BLACK);
    }

    // Draw prompt
    b.writeText(0, y, PROMPT_STR, PROMPT_COLOR);

    // Draw typed text
    if (this.inputBuffer.length > 0) {
      b.writeText(PROMPT_STR.length, y, this.inputBuffer, INPUT_COLOR);
    }

    // Cursor
    const cursorX = PROMPT_STR.length + this.inputBuffer.length;
    b.writeText(cursorX, y, '_', INPUT_COLOR);
  }

  writeLine(text, color) {
    if (text === '') {
      this.advanceLine();
      return;
    }
    this.buffer.writeText(0, this.currentY, text, color);
    this.advanceLine();
  }

  advanceLine() {
    this.currentY++;
    if (this.currentY > MAX_Y) {
      this.scrollUp();
    }
  }

  scrollUp() {
    const b = this.buffer;
    // Shift all rows up by 1
    for (let y = 0; y < MAX_Y; y++) {
      for (let x = 0; x < 80; x++) {
        const src = b.cells[y + 1][x];
        const dst = b.cells[y][x];
        dst.char = src.char;
        dst.fg = src.fg;
        dst.bg = src.bg;
        dst.dirty = true;
      }
    }
    // Clear the bottom row
    for (let x = 0; x < 80; x++) {
      const cell = b.cells[MAX_Y][x];
      cell.char = ' ';
      cell.fg = Palette.LIGHT_GRAY;
      cell.bg = Palette.BLACK;
      cell.dirty = true;
    }
    this.currentY = MAX_Y;
  }
}
