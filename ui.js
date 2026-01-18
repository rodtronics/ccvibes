// Crime Committer VI - UI Layer
// All rendering logic that writes to the FrameBuffer
// Uses Palette for colors, no direct DOM manipulation

import { Palette, BoxStyles } from './palette.js';

// Layout constants for 80x25 viewport
export const Layout = {
  WIDTH: 80,
  HEIGHT: 25,

  statusRail: { x: 0, y: 0, width: 80, height: 2 },
  tabBar: { x: 0, y: 2, width: 80, height: 1 },
  mainPanel: { x: 0, y: 3, width: 56, height: 20 },
  logPanel: { x: 56, y: 3, width: 24, height: 20 },
  footer: { x: 0, y: 23, width: 80, height: 2 },
};

export class UI {
  constructor(buffer, engine, uiState) {
    this.buffer = buffer;
    this.engine = engine;
    this.ui = uiState;
  }

  // Main render entry point using layered composition
  render() {
    // Layer 0: Clear background
    this.buffer.fill(' ', Palette.LIGHT_GRAY, Palette.BLACK);

    // Layer 1: Draw structure (all borders and boxes)
    this.renderStructure();

    // Layer 2: Draw content (overwrites borders as needed)
    this.renderStatusRail();
    this.renderTabBar();

    if (this.ui.tab === 'jobs') this.renderJobsTab();
    if (this.ui.tab === 'active') this.renderActiveTab();
    if (this.ui.tab === 'crew') this.renderCrewTab();
    if (this.ui.tab === 'settings') this.renderSettingsTab();
  }

  renderStructure() {
    // Draw all boxes/borders for current tab
    // This is the structure layer that content will overwrite
    // VISUAL HIERARCHY: Borders are DARK, content/titles will be BRIGHT

    // Status rail box (dark border)
    this.buffer.drawBox(
      Layout.statusRail.x,
      Layout.statusRail.y,
      Layout.statusRail.width,
      Layout.statusRail.height,
      BoxStyles.SINGLE,
      Palette.DIM_GRAY,
      Palette.BLACK
    );

    // Tab bar gets no box, just content

    // Main content area - single panel with dark border
    this.buffer.drawBox(0, 3, Layout.WIDTH, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
  }

  renderStatusRail() {
    const x = 2;
    const y = 1;

    // Title (overwrites box border)
    this.buffer.writeText(x, y, 'CRIME COMMITTER VI', Palette.NEON_CYAN, Palette.BLACK);

    // Resources
    const cash = this.fmtNum(this.engine.state.resources.cash);
    const heat = Math.floor(this.engine.state.resources.heat);
    const cred = Math.floor(this.engine.state.resources.cred);
    const runCount = this.engine.state.runs.length;

    this.buffer.writeText(30, y, `CASH $${cash}`, Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(50, y, `HEAT ${heat}`, heat > 50 ? Palette.HEAT_RED : Palette.BRIGHT_YELLOW, Palette.BLACK);
    this.buffer.writeText(70, y, `CRED ${cred}`, Palette.TERMINAL_GREEN, Palette.BLACK);
    this.buffer.writeText(90, y, `RUNS ${runCount}`, Palette.NEON_CYAN, Palette.BLACK);

    // Clock
    const clock = new Date(this.engine.state.now).toLocaleTimeString();
    this.buffer.writeTextRight(Layout.WIDTH - 2, y, clock, Palette.MID_GRAY, Palette.BLACK);
  }

  renderTabBar() {
    const tabs = [
      { id: 'jobs', label: 'JOBS', hotkey: 'j' },
      { id: 'active', label: 'ACTIVE', hotkey: 'a' },
      { id: 'crew', label: 'CREW', hotkey: 'c' },
      { id: 'settings', label: 'SETTINGS', hotkey: 's' },
    ];

    let x = 2;
    const y = 2;

    tabs.forEach((tab) => {
      const active = tab.id === this.ui.tab;
      const width = this.renderTab(
        x, y,
        tab.label,
        tab.hotkey,
        active,
        Palette.NEON_CYAN,
        Palette.BLACK,
        Palette.DIM_GRAY
      );
      x += width + 3; // Add spacing between tabs
    });

    // Help text on right
    this.buffer.writeTextRight(
      Layout.WIDTH - 2,
      y,
      'ARROWS | ENTER | BACKSPACE | NUMS',
      Palette.DIM_GRAY,
      Palette.BLACK
    );
  }

  renderJobsTab() {
    const branches = this.getVisibleBranches();
    const branch = branches[this.ui.branchIndex] || branches[0];
    const activities = this.getVisibleActivities(branch?.id);
    const activity = activities[this.ui.activityIndex];
    const options = activity ? this.getVisibleOptions(activity) : [];

    // Row 4: Branch tabs (secondary navigation)
    let tabX = 2;
    const tabY = 4;
    branches.forEach((b, i) => {
      const isActive = i === this.ui.branchIndex;
      const width = this.renderTab(
        tabX, tabY,
        b.name.toUpperCase(),
        b.hotkey || '',
        isActive,
        Palette.TERMINAL_GREEN,
        Palette.BLACK,
        Palette.DIM_GRAY
      );
      tabX += width + 2;
    });

    // Determine layout based on focus
    const showingOptions = this.ui.focus === 'option' && activity;

    if (!showingOptions) {
      // ACTIVITY LIST VIEW (focused on activities, numbered 1-9)
      const listTop = 6;
      const listTitle = branch ? branch.name.toUpperCase() + ' JOBS' : 'JOBS';
      this.buffer.writeText(2, listTop, listTitle, Palette.NEON_CYAN, Palette.BLACK);

      // Show numbered list of activities
      activities.slice(0, 9).forEach((a, i) => {
        const row = listTop + 2 + i;
        const number = i + 1;
        const selected = this.ui.activityIndex === i;
        const fg = selected ? Palette.NEON_CYAN : Palette.NEON_TEAL;
        const prefix = selected ? '>' : ' ';

        this.buffer.writeText(2, row, `${prefix}${number}.`, fg, Palette.BLACK);
        this.buffer.writeText(6, row, a.name, fg, Palette.BLACK);
      });

      // Show description of selected activity
      if (activity) {
        const descY = listTop + 13;
        this.buffer.drawHLine(2, descY, Layout.WIDTH - 4, '─', Palette.DIM_GRAY, Palette.BLACK);
        this.buffer.writeText(2, descY + 1, activity.name.toUpperCase(), Palette.NEON_CYAN, Palette.BLACK);

        const descLines = this.wrapText(activity.description || '', Layout.WIDTH - 6);
        descLines.slice(0, 3).forEach((line, idx) => {
          this.buffer.writeText(2, descY + 2 + idx, line, Palette.MID_GRAY, Palette.BLACK);
        });

        this.buffer.writeText(2, Layout.HEIGHT - 2, '[ENTER] Select options', Palette.SUCCESS_GREEN, Palette.BLACK);
      }
    } else {
      // OPTIONS VIEW (showing numbered options for selected activity)
      const optionsTop = 6;
      this.buffer.writeText(2, optionsTop, activity.name.toUpperCase(), Palette.NEON_CYAN, Palette.BLACK);

      const descLines = this.wrapText(activity.description || '', Layout.WIDTH - 6);
      descLines.slice(0, 2).forEach((line, idx) => {
        this.buffer.writeText(2, optionsTop + 1 + idx, line, Palette.MID_GRAY, Palette.BLACK);
      });

      // Show numbered options
      options.slice(0, 9).forEach((opt, i) => {
        const optY = optionsTop + 4 + (i * 5);
        const number = i + 1;
        const selected = this.ui.optionIndex === i;
        const fg = selected ? Palette.SUCCESS_GREEN : Palette.NEON_TEAL;

        // Number and name
        this.buffer.writeText(2, optY, `${number}.`, fg, Palette.BLACK);
        this.buffer.writeText(5, optY, opt.name, fg, Palette.BLACK);

        // Details
        const detailFg = selected ? Palette.MID_GRAY : Palette.DIM_GRAY;
        this.buffer.writeText(5, optY + 1, `Duration: ${this.formatMs(opt.durationMs)}`, detailFg, Palette.BLACK);
        this.buffer.writeText(5, optY + 2, `Req: ${this.describeRequirements(opt.requirements)}`, detailFg, Palette.BLACK);

        if (selected) {
          this.buffer.writeText(5, optY + 3, '[ENTER] START', Palette.SUCCESS_GREEN, Palette.BLACK);
        }
      });

      this.buffer.writeText(2, Layout.HEIGHT - 2, '[BACKSPACE] Back to jobs', Palette.DIM_GRAY, Palette.BLACK);
    }
  }

  // Render a single run card in 4-line format
  renderRunCard(run, x, y, maxWidth, dimmed = false) {
    const activity = this.engine.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);

    // Select colors based on dimmed state
    const nameColor = dimmed ? Palette.NEON_TEAL_DIM : Palette.NEON_TEAL;
    const textColor = dimmed ? Palette.DIM_GRAY : Palette.MID_GRAY;
    const progressColor = dimmed ? Palette.NEON_CYAN_DIM : Palette.NEON_CYAN;

    // Line 1: Crime name
    const nameText = `${activity?.name || '?'} → ${option?.name || '?'}`;
    this.buffer.writeText(x, y, nameText.slice(0, maxWidth), nameColor, Palette.BLACK);

    // Line 2: Staff assignment
    const staffText = `Staff: ${run.assignedStaff?.join(', ') || 'none'}`;
    this.buffer.writeText(x, y + 1, staffText.slice(0, maxWidth), textColor, Palette.BLACK);

    // Line 3: Remaining time
    const remaining = Math.max(0, run.endsAt - this.engine.state.now);
    const remainingText = `Remaining: ${this.formatMs(remaining)}`;
    this.buffer.writeText(x, y + 2, remainingText.slice(0, maxWidth), textColor, Palette.BLACK);

    // Line 4: Progress bar
    const pct = Math.min(1, Math.max(0, (this.engine.state.now - run.startedAt) / (run.endsAt - run.startedAt)));
    const barWidth = Math.min(40, maxWidth - 6);
    this.buffer.drawProgressBar(x, y + 3, barWidth, pct, progressColor, Palette.BLACK);
    this.buffer.writeText(x + barWidth + 1, y + 3, 'STOP', Palette.HEAT_RED, Palette.BLACK);
  }

  renderActiveTab() {
    const top = 5;

    this.buffer.writeText(2, top - 1, 'ACTIVE OPERATIONS', Palette.SUCCESS_GREEN, Palette.BLACK);

    if (this.engine.state.runs.length === 0) {
      this.buffer.writeText(2, top + 1, 'No active runs. Start something risky.', Palette.DIM_GRAY, Palette.BLACK);
      return;
    }

    // Render each run using shared 4-line card format
    this.engine.state.runs.forEach((run, idx) => {
      const y = top + (idx * 5);
      if (y + 4 < Layout.HEIGHT - 1) {
        this.renderRunCard(run, 2, y, Layout.WIDTH - 4);
      }
    });
  }

  renderCrewTab() {
    const top = 5;
    this.buffer.writeText(2, top - 1, 'CREW MANAGEMENT', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(2, top + 1, 'Coming soon...', Palette.DIM_GRAY, Palette.BLACK);
  }

  renderSettingsTab() {
    const top = 6;

    this.buffer.writeText(2, top - 2, 'SETTINGS', Palette.SUCCESS_GREEN, Palette.BLACK);

    this.buffer.drawBox(2, top, Layout.WIDTH - 4, 6, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(4, top, ' DISPLAY ', Palette.NEON_CYAN, Palette.BLACK);

    this.buffer.writeText(4, top + 2, 'Font', Palette.NEON_TEAL, Palette.BLACK);

    // Map font IDs to display names
    const fontNames = {
      'fira': 'Fira Code (modern)',
      'vga-9x8': 'VGA 9x8 (compact)',
      'vga-8x16': 'VGA 8x16 (classic)'
    };

    const fontText = fontNames[this.ui.settings.font] || this.ui.settings.font;
    this.buffer.writeText(18, top + 2, fontText, Palette.WHITE, Palette.DARKER_BLUE);
    this.buffer.writeText(Layout.WIDTH - 18, top + 2, '<ENTER> CYCLE', Palette.SUCCESS_GREEN, Palette.BLACK);
  }

  // Tab rendering helper - renders tab with underlined hotkey
  renderTab(x, y, label, hotkey, isActive, activeFg, activeBg, inactiveFg) {
    // Find the hotkey position in the label (case insensitive)
    const lowerLabel = label.toLowerCase();
    const lowerHotkey = hotkey.toLowerCase();
    const hotkeyIndex = lowerLabel.indexOf(lowerHotkey);

    const fg = isActive ? activeFg : inactiveFg;
    const bg = isActive ? activeBg : null;

    // Write the label character by character, underlining the hotkey
    for (let i = 0; i < label.length; i++) {
      const char = label[i];
      if (i === hotkeyIndex) {
        // Underline the hotkey character by writing it, then underlining on next row
        this.buffer.writeText(x + i, y, char, fg, bg);
        this.buffer.writeText(x + i, y + 1, '─', fg, bg);
      } else {
        this.buffer.writeText(x + i, y, char, fg, bg);
      }
    }

    return label.length; // Return width for positioning next tab
  }

  // Helper methods
  getVisibleBranches() {
    return this.engine.data.branches
      .filter((b) => this.engine.state.reveals.branches[b.id])
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getVisibleActivities(branchId) {
    return this.engine.data.activities
      .filter((a) => !branchId || a.branchId === branchId)
      .filter((a) => this.engine.isActivityVisible(a))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getVisibleOptions(activity) {
    if (!activity) return [];
    return (activity.options || [])
      .filter((opt) => this.engine.checkConditions(opt.visibleIf || []))
      .filter((opt) => this.engine.isOptionUnlocked(opt));
  }

  describeRequirements(req) {
    const staffReqs = req?.staff || [];
    if (staffReqs.length === 0) return 'none';
    return staffReqs
      .map((s) => `${s.count} ${s.roleId}${s.starsMin ? ` ${s.starsMin}+*` : ''}`)
      .join(', ');
  }

  summarizeResolution(resolution) {
    if (!resolution) return 'unknown';
    if (resolution.type === 'deterministic') return 'fixed result';
    if (resolution.type === 'ranged_outputs') return 'ranged output';
    if (resolution.type === 'weighted_outcomes') {
      const topOutcome = resolution.outcomes?.[0];
      return topOutcome ? `weighted: ${topOutcome.id}` : 'weighted';
    }
    return 'unknown';
  }

  formatMs(ms) {
    if (!ms) return 'instant';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  wrapText(text, width) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    words.forEach((word) => {
      if ((line + word).length > width) {
        lines.push(line.trim());
        line = '';
      }
      line += `${word} `;
    });
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  fmtNum(num) {
    return Math.round(num).toLocaleString();
  }
}
