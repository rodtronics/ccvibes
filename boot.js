// Crime Committer VI - Boot Screen & DOS Prompt
// 286-style POST screen shown during loading, optional DOS CLI

import { Palette } from './palette.js';

const HEADER_COLOR = Palette.NEON_CYAN;
const LABEL_COLOR = Palette.LIGHT_GRAY;
const VALUE_COLOR = Palette.WHITE;
const OK_COLOR = Palette.TERMINAL_GREEN;
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
const VIEWER_STATUS_Y = 24;
const VIEWER_CONTENT_HEIGHT = 24;
const STORAGE_KEYS = {
  GAME_STATE: 'ccv_game_state',
  SEEN_MODALS: 'ccv_seen_modals',
  SETTINGS: 'ccv_tui_settings',
};

export class DosPrompt {
  constructor(buffer) {
    this.buffer = buffer;
    this.inputBuffer = '';
    this.currentY = 0;
    this.pendingLines = null; // Paged output waiting for user to advance
    this.pendingConfirm = null; // Waiting for YES/NO confirmation
    this.textViewer = null;
    this.viewerSnapshot = null;
    this.viewerReturnY = 0;
  }

  start() {
    this.buffer.clear();
    this.currentY = 0;
    this.pendingConfirm = null;
    this.textViewer = null;
    this.viewerSnapshot = null;
    this.drawBanner();
    this.drawPromptLine();
  }

  drawBanner() {
    // Generate a hash-looking version from random bytes (built-in crypto API)
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const ver = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

    this.writeLine(`WFOS [WAVEFRONT OPERATING SYSTEM v ${ver}]`, HEADER_COLOR);
    this.writeLine('(c) 2026 WFPRODUCTIONSNZ. ALL RIGHTS RESERVED.', LABEL_COLOR);
    this.advanceLine();
  }

  handleKey(key) {
    if (this.textViewer) {
      this.handleTextViewerKey(key);
      return null;
    }

    // Paging mode — waiting for user to advance or cancel
    if (this.pendingLines) {
      if (key === ' ' || key === 'Enter') {
        this.showNextPage();
      } else if (key === 'Escape' || key === 'q' || key === 'Q') {
        this.pendingLines = null;
        this.clearCurrentLine();
        this.advanceLine();
        this.drawPromptLine();
      }
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
    const cmd = this.inputBuffer.trim().toLowerCase();
    this.inputBuffer = '';

    // Advance past the typed command line
    this.advanceLine();

    // Confirmations block command execution until resolved.
    if (this.pendingConfirm) {
      const lines = this.resolveConfirmation(cmd);
      this.outputWithPaging(lines);
      return null;
    }

    if (cmd === 'cc.exe' || cmd === 'cc' || cmd === 'run' || cmd === 'start' || cmd === 'exit') {
      return 'launch';
    }

    if (cmd === '') {
      this.drawPromptLine();
      return null;
    }

    const lines = this.getResponse(cmd);
    if (this.textViewer) {
      return null;
    }
    if (lines.length === 0) {
      this.drawPromptLine();
      return null;
    }
    this.outputWithPaging(lines);
    return null;
  }

  getResponse(cmd) {
    // Strip extra spaces for multi-word matching
    const parts = cmd.split(/\s+/);
    const base = parts[0];

    if (base === 'dir' || base === 'ls') {
      const save = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      const saveSize = save ? save.length : 0;
      const saveSizeStr = saveSize.toLocaleString().padStart(10);
      const fileCount = saveSize > 0 ? 3 : 2;
      const totalBytes = (49664 + saveSize).toLocaleString();
      const lines = [
        { text: ' Volume in drive C is CCVI', color: LABEL_COLOR },
        { text: ' Directory of C:\\CCVI', color: LABEL_COLOR },
        { text: '', color: LABEL_COLOR },
        { text: 'CC       EXE        49,152  01-15-96  12:00a', color: VALUE_COLOR },
        { text: 'README   TXT           512  01-15-96  12:00a', color: VALUE_COLOR },
      ];
      if (saveSize > 0) {
        lines.push({ text: `SAVE     SAV    ${saveSizeStr}  ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}  ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '')}`, color: VALUE_COLOR });
      }
      lines.push(
        { text: `         ${fileCount} File(s)     ${totalBytes} bytes`, color: LABEL_COLOR },
        { text: '         0 Dir(s)     524,288 bytes free', color: LABEL_COLOR },
      );
      return lines;
    }

    if (base === 'ver') {
      return [{ text: 'CCVI-DOS Version 6.22', color: VALUE_COLOR }];
    }

    if (base === 'help') {
      return [
        { text: 'DIR     Displays directory contents', color: VALUE_COLOR },
        { text: 'CLS     Clears the screen', color: VALUE_COLOR },
        { text: 'VER     Displays DOS version', color: VALUE_COLOR },
        { text: 'SAVE    Displays save summary', color: VALUE_COLOR },
        { text: 'SEED    Copies compact snapshot seed', color: VALUE_COLOR },
        { text: 'CLEAR SAVE  Deletes save (with confirmation)', color: VALUE_COLOR },
        { text: 'STATUS  Displays save + boot settings status', color: VALUE_COLOR },
        { text: 'AUTHBOOT [ON|OFF|TOGGLE]  Sets authentic boot mode', color: VALUE_COLOR },
        { text: 'TYPE    Opens scrollable text viewer', color: VALUE_COLOR },
        { text: 'TYPE <file> [-C] [-D]  copy/download file text', color: VALUE_COLOR },
        { text: 'HELP    Displays this help', color: VALUE_COLOR },
        { text: 'CC.EXE  Launches Crime Committer VI', color: VALUE_COLOR },
      ];
    }

    if (base === 'save') {
      return this.getSaveSummary();
    }

    if (base === 'seed' || base === 'snapshot') {
      return this.getSeedSnapshotLines();
    }

    if (base === 'status') {
      return this.getStatusSummary();
    }

    if ((base === 'clear' && parts[1] === 'save') || cmd === 'clear save') {
      return this.beginClearSave();
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

    if (base === 'type' || base === 'type.exe') {
      const args = this.parseTypeArgs(parts);
      if (!args.target) {
        return [{ text: 'Usage: TYPE <file> [-C] [-D]', color: ERROR_COLOR }];
      }

      const file = this.readTypeFile(args.target);
      if (!file.ok) {
        return [{ text: file.reason, color: ERROR_COLOR }];
      }

      if (args.copy) {
        this.copyToClipboard(file.text);
      }
      if (args.download) {
        this.downloadTextFile(file.name, file.text);
      }

      if (args.copy || args.download) {
        const status = [];
        if (args.copy) {
          status.push({ text: 'Clipboard copy requested.', color: LABEL_COLOR });
        }
        if (args.download) {
          status.push({ text: `Download requested: ${file.name}`, color: LABEL_COLOR });
        }
        status.push({ text: 'Tip: TYPE <file> to open scrollable viewer.', color: DOT_COLOR });
        return status;
      }

      this.openTextViewer(file.name, file.text);
      return [];
    }

    if (base === 'format') {
      return [{ text: 'Access denied. Nice try, criminal.', color: ERROR_COLOR }];
    }

    if (base === 'del' || base === 'delete' || base === 'rm') {
      return [{ text: 'Access denied.', color: ERROR_COLOR }];
    }

    if (base === 'cd') {
      return [{ text: 'Invalid directory', color: ERROR_COLOR }];
    }

    return [{ text: 'Bad command or file name', color: ERROR_COLOR }];
  }

  getSaveSummary() {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!raw) {
      return [{ text: 'SAVE.SAV not found', color: ERROR_COLOR }];
    }

    const sizeText = raw.length.toLocaleString();
    const lines = [{ text: `SAVE.SAV present (${sizeText} bytes)`, color: OK_COLOR }];

    try {
      const parsed = JSON.parse(raw);
      const cash = parsed?.resources?.cash ?? 0;
      const heat = Math.floor(parsed?.resources?.heat ?? 0);
      const cred = Math.floor(parsed?.resources?.cred ?? 0);
      const crew = parsed?.crew?.staff?.length ?? 0;
      const runs = parsed?.runs?.length ?? 0;
      lines.push(
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
    const saveExists = !!localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    const seenModalsExists = !!localStorage.getItem(STORAGE_KEYS.SEEN_MODALS);
    const authenticBoot = !!settings.authenticBoot;

    return [
      { text: `SAVE.SAV: ${saveExists ? 'present' : 'missing'}`, color: saveExists ? OK_COLOR : ERROR_COLOR },
      { text: `Seen modals cache: ${seenModalsExists ? 'present' : 'missing'}`, color: seenModalsExists ? LABEL_COLOR : DOT_COLOR },
      { text: `Authentic boot: ${authenticBoot ? 'ON' : 'OFF'}`, color: authenticBoot ? OK_COLOR : LABEL_COLOR },
      { text: 'Tip: AUTHBOOT ON|OFF|TOGGLE to change startup mode', color: DOT_COLOR },
    ];
  }

  parseTypeArgs(parts) {
    const args = { target: '', copy: false, download: false };
    for (let i = 1; i < parts.length; i++) {
      const token = parts[i];
      if (!token) continue;

      if (token === '-c' || token === '/c') {
        args.copy = true;
        continue;
      }
      if (token === '-d' || token === '/d') {
        args.download = true;
        continue;
      }
      if (!args.target) {
        args.target = token;
      }
    }
    return args;
  }

  readTypeFile(target) {
    const file = String(target || '').toLowerCase();
    if (file === 'save.sav' || file === 'save') {
      const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
      if (!raw) {
        return { ok: false, reason: 'File is empty' };
      }
      try {
        return { ok: true, name: 'save.sav', text: JSON.stringify(JSON.parse(raw), null, 2) };
      } catch {
        return { ok: true, name: 'save.sav', text: raw };
      }
    }

    if (file === 'readme.txt' || file === 'readme') {
      return { ok: true, name: 'readme.txt', text: this.getReadmeText() };
    }

    return { ok: false, reason: 'File not found' };
  }

  getReadmeText() {
    return [
      '========================================',
      '  CRIME COMMITTER VI - README',
      '========================================',
      '',
      'Welcome to Crime Committer VI.',
      'To begin, run CC.EXE from this prompt.',
      'Use SAVE / STATUS to inspect local progress.',
      'Use SEED to copy a compact progress snapshot.',
      '',
      'Good luck. You\'ll need it.',
    ].join('\n');
  }

  openTextViewer(fileName, text) {
    this.viewerSnapshot = this.buffer.clone();
    this.viewerReturnY = this.currentY;

    const lines = String(text || '').split('\n');
    this.textViewer = {
      fileName: fileName || 'file.txt',
      lines,
      offset: 0,
    };

    this.renderTextViewer();
  }

  handleTextViewerKey(key) {
    if (!this.textViewer) return;

    const totalLines = this.textViewer.lines.length;
    const maxOffset = Math.max(0, totalLines - VIEWER_CONTENT_HEIGHT);
    let offset = this.textViewer.offset;

    if (key === 'Escape' || key === 'q' || key === 'Q' || key === 'Enter') {
      this.closeTextViewer();
      return;
    }

    if (key === 'ArrowUp') offset -= 1;
    if (key === 'ArrowDown') offset += 1;
    if (key === 'PageUp') offset -= VIEWER_CONTENT_HEIGHT;
    if (key === 'PageDown' || key === ' ') offset += VIEWER_CONTENT_HEIGHT;
    if (key === 'Home') offset = 0;
    if (key === 'End') offset = maxOffset;

    offset = Math.max(0, Math.min(maxOffset, offset));
    if (offset !== this.textViewer.offset) {
      this.textViewer.offset = offset;
      this.renderTextViewer();
    }
  }

  closeTextViewer() {
    if (this.viewerSnapshot) {
      this.buffer.swap(this.viewerSnapshot);
    }
    this.viewerSnapshot = null;
    this.textViewer = null;
    this.currentY = this.viewerReturnY;
    this.drawPromptLine();
  }

  renderTextViewer() {
    if (!this.textViewer) return;

    const b = this.buffer;
    const { lines, offset, fileName } = this.textViewer;

    b.fill(' ', Palette.LIGHT_GRAY, Palette.BLACK);

    for (let row = 0; row < VIEWER_CONTENT_HEIGHT; row++) {
      const line = lines[offset + row];
      if (line === undefined) continue;
      b.writeText(0, row, line.slice(0, 80), VALUE_COLOR, Palette.BLACK);
    }

    const start = lines.length === 0 ? 0 : offset + 1;
    const end = Math.min(lines.length, offset + VIEWER_CONTENT_HEIGHT);
    const status = `${fileName} ${start}-${end}/${lines.length}  [UP/DN][PGUP/PGDN][HOME/END][ESC]`;
    b.writeText(0, VIEWER_STATUS_Y, status.slice(0, 80), DOT_COLOR, Palette.BLACK);
  }

  getSeedSnapshotLines() {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!raw) {
      return [{ text: 'Cannot generate seed: SAVE.SAV not found', color: ERROR_COLOR }];
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [{ text: 'Cannot generate seed: save is invalid', color: ERROR_COLOR }];
    }

    const resources = parsed?.resources || {};
    const totals = parsed?.stats?.totals || {};
    const reveals = parsed?.reveals || {};
    const runs = Array.isArray(parsed?.runs) ? parsed.runs : [];
    const snapshot = {
      v: 1,
      n: Date.now(),
      r: [
        Math.floor(resources.cash || 0),
        Math.floor(resources.heat || 0),
        Math.floor(resources.cred || 0),
      ],
      c: Array.isArray(parsed?.crew?.staff) ? parsed.crew.staff.length : 0,
      a: runs.filter((run) => run?.status === 'active').length,
      t: [
        Math.floor(totals.crimesCompleted || 0),
        Math.floor(totals.crimesSucceeded || 0),
        Math.floor(totals.crimesFailed || 0),
      ],
      u: [
        this.countTruthy(reveals.branches),
        this.countTruthy(reveals.activities),
        this.countTruthy(reveals.resources),
        this.countTruthy(reveals.roles),
      ],
    };

    const seedPayload = JSON.stringify(snapshot);
    const seed = `CC6S1.${this.toBase64Url(seedPayload)}`;

    this.copyToClipboard(seed);

    const lines = [
      { text: `Seed generated (${seed.length} chars)`, color: OK_COLOR },
      { text: 'Clipboard copy requested (browser permission may apply).', color: LABEL_COLOR },
      { text: 'Fallback: copy the seed shown below.', color: DOT_COLOR },
    ];
    this.wrapText(seed, 76).forEach((line) => lines.push({ text: line, color: VALUE_COLOR }));
    return lines;
  }

  countTruthy(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    return Object.values(obj).reduce((sum, value) => sum + (value ? 1 : 0), 0);
  }

  toBase64Url(text) {
    let binary = '';
    const bytes = new TextEncoder().encode(text);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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
        // Ignore failures; seed is still displayed for manual copy.
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

  wrapText(text, width = 76) {
    if (!text) return [''];
    const lines = [];
    for (let i = 0; i < text.length; i += width) {
      lines.push(text.slice(i, i + width));
    }
    return lines;
  }

  beginClearSave() {
    const hasSaveData = !!localStorage.getItem(STORAGE_KEYS.GAME_STATE) || !!localStorage.getItem(STORAGE_KEYS.SEEN_MODALS);
    if (!hasSaveData) {
      return [{ text: 'No save data found to clear', color: ERROR_COLOR }];
    }

    this.pendingConfirm = 'clear_save';
    return [
      { text: 'WARNING: This will permanently delete SAVE.SAV progress.', color: ERROR_COLOR },
      { text: 'Type YES to confirm or NO to cancel.', color: VALUE_COLOR },
    ];
  }

  resolveConfirmation(cmd) {
    if (this.pendingConfirm !== 'clear_save') {
      this.pendingConfirm = null;
      return [{ text: 'Pending action canceled', color: LABEL_COLOR }];
    }

    if (cmd === 'yes' || cmd === 'y') {
      localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
      localStorage.removeItem(STORAGE_KEYS.SEEN_MODALS);
      this.pendingConfirm = null;
      return [{ text: 'Save data cleared.', color: OK_COLOR }];
    }

    if (cmd === 'no' || cmd === 'n' || cmd === 'cancel') {
      this.pendingConfirm = null;
      return [{ text: 'Clear save canceled.', color: LABEL_COLOR }];
    }

    return [{ text: 'Please type YES or NO.', color: ERROR_COLOR }];
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

  // ── Paged output ───────────────────────────────────────

  outputWithPaging(lines) {
    const available = MAX_Y - this.currentY; // rows left on screen
    if (lines.length <= available) {
      // Everything fits — no paging needed
      for (const line of lines) {
        this.writeLine(line.text, line.color);
      }
      this.advanceLine();
      this.drawPromptLine();
      return;
    }
    // Show first batch (leave last row for "more" prompt)
    const batchSize = Math.max(1, available - 1);
    for (let i = 0; i < batchSize; i++) {
      this.writeLine(lines[i].text, lines[i].color);
    }
    this.pendingLines = lines.slice(batchSize);
    this.drawMorePrompt();
  }

  showNextPage() {
    this.clearCurrentLine(); // erase "more" prompt
    const pageSize = MAX_Y - 1; // lines per subsequent page
    const batch = this.pendingLines.slice(0, pageSize);
    const remaining = this.pendingLines.slice(pageSize);
    for (const line of batch) {
      this.writeLine(line.text, line.color);
    }
    if (remaining.length > 0) {
      this.pendingLines = remaining;
      this.drawMorePrompt();
    } else {
      this.pendingLines = null;
      this.advanceLine();
      this.drawPromptLine();
    }
  }

  drawMorePrompt() {
    this.buffer.writeText(0, this.currentY,
      '-- Press SPACE or ENTER for next page, ESC to cancel --', DOT_COLOR);
  }

  clearCurrentLine() {
    for (let x = 0; x < 80; x++) {
      this.buffer.writeText(x, this.currentY, ' ', Palette.BLACK, Palette.BLACK);
    }
  }

  // ── Drawing helpers ─────────────────────────────────────

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
