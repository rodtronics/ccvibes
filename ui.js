// Crime Committer VI - UI Layer
// All rendering logic that writes to the FrameBuffer
// Uses Palette for colors, no direct DOM manipulation

import { Palette, BoxStyles } from './palette.js';

// Layout constants for 200x60 viewport
export const Layout = {
  WIDTH: 200,
  HEIGHT: 60,

  statusRail: { x: 0, y: 0, width: 200, height: 2 },
  tabBar: { x: 0, y: 2, width: 200, height: 1 },
  mainPanel: { x: 0, y: 3, width: 140, height: 54 },
  logPanel: { x: 140, y: 3, width: 60, height: 54 },
  footer: { x: 0, y: 57, width: 200, height: 3 },
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

    if (this.ui.tab === 'activities') this.renderActivitiesTab();
    if (this.ui.tab === 'runs') this.renderRunsTab();
    if (this.ui.tab === 'log') this.renderLogTab();
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

    // Main content area structure varies by tab
    if (this.ui.tab === 'activities') {
      const branchW = 30;
      const activityW = 50;
      const detailW = Layout.WIDTH - branchW - activityW;

      // All borders use DIM_GRAY for subtle, recessed structure
      this.buffer.drawBox(0, 3, branchW, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
      this.buffer.drawBox(branchW, 3, activityW, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
      this.buffer.drawBox(branchW + activityW, 3, detailW, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    } else {
      // Default: single main panel with dark border
      this.buffer.drawBox(0, 3, Layout.WIDTH, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    }
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
      { id: 'activities', label: '1 ACTIVITIES' },
      { id: 'runs', label: '2 ACTIVE' },
      { id: 'log', label: '3 LOG' },
      { id: 'settings', label: '4 SETTINGS' },
    ];

    let x = 1;
    const y = 2;

    tabs.forEach((tab) => {
      const active = tab.id === this.ui.tab;
      const text = `[${tab.label}]`;
      const fg = active ? Palette.BLACK : Palette.MID_GRAY;
      const bg = active ? Palette.SUCCESS_GREEN : null;

      this.buffer.writeText(x, y, text, fg, bg);
      x += text.length + 1;
    });

    // Help text on right
    this.buffer.writeTextRight(
      Layout.WIDTH - 2,
      y,
      'ARROWS NAV | ENTER SELECT | 1-4 SWITCH',
      Palette.DIM_GRAY,
      Palette.BLACK
    );
  }

  renderActivitiesTab() {
    const top = 4;
    const branchW = 30;
    const activityW = 50;
    const detailW = Layout.WIDTH - branchW - activityW;

    const branches = this.getVisibleBranches();
    const branch = branches[this.ui.branchIndex] || branches[0];
    const activities = this.getVisibleActivities(branch?.id);
    const activity = activities[this.ui.activityIndex] || activities[0];
    const options = this.getVisibleOptions(activity);

    // Determine which panels are focused
    const branchFocused = this.ui.focus === 'branch';
    const activityFocused = this.ui.focus === 'activity';
    const optionFocused = this.ui.focus === 'option';

    // Branch column title
    const branchTitleColor = branchFocused ? Palette.TERMINAL_GREEN : Palette.TERMINAL_GREEN_DIMMER;
    this.buffer.writeText(2, top, 'BRANCH', branchTitleColor, Palette.BLACK);

    // Branch list
    branches.forEach((b, i) => {
      const row = top + 1 + i;
      const selected = this.ui.focus === 'branch' && this.ui.branchIndex === i;
      const text = b.name.padEnd(branchW - 3).slice(0, branchW - 3);
      const fg = selected ? Palette.BLACK : (branchFocused ? Palette.TERMINAL_GREEN_DIM : Palette.TERMINAL_GREEN_DIMMER);
      const bg = selected ? Palette.SUCCESS_GREEN : null;

      this.buffer.writeText(2, row, text, fg, bg);
    });

    // Activity column title
    const activityTitleColor = activityFocused ? Palette.NEON_CYAN : Palette.NEON_CYAN_DIM;
    this.buffer.writeText(branchW + 2, top, 'ACTIVITY', activityTitleColor, Palette.BLACK);

    // Activity list
    activities.slice(0, Layout.HEIGHT - top - 2).forEach((a, i) => {
      const row = top + 1 + i;
      const selected = this.ui.focus === 'activity' && this.ui.activityIndex === i;
      const prefix = selected ? '>' : ' ';
      const text = `${prefix} ${a.name}`.padEnd(activityW - 2).slice(0, activityW - 2);
      const fg = selected ? Palette.BLACK : (activityFocused ? Palette.NEON_TEAL : Palette.NEON_TEAL_DIM);
      const bg = selected ? Palette.NEON_CYAN : null;

      this.buffer.writeText(branchW + 1, row, text, fg, bg);
    });

    // Options detail panel
    const detailX = branchW + activityW + 2;

    const optionsTitleColor = optionFocused ? Palette.HOT_PINK : Palette.HOT_PINK_DIM;
    this.buffer.writeText(detailX, top, 'OPTIONS', optionsTitleColor, Palette.BLACK);

    if (activity) {
      const activityNameColor = optionFocused ? Palette.NEON_CYAN : Palette.NEON_CYAN_DIM;
      this.buffer.writeText(detailX, top + 1, activity.name.toUpperCase(), activityNameColor, Palette.BLACK);

      const descColor = optionFocused ? Palette.LIGHT_GRAY : Palette.MID_GRAY;
      const descLines = this.wrapText(activity.description || '', detailW - 4);
      descLines.slice(0, 2).forEach((line, idx) => {
        this.buffer.writeText(detailX, top + 2 + idx, line, descColor, Palette.BLACK);
      });

      let currentY = top + 5;

      // Options list
      options.forEach((opt, i) => {
        const y = currentY;
        const selected = this.ui.focus === 'option' && this.ui.optionIndex === i;

        // Divider with option name
        const dividerColor = selected ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;
        this.buffer.drawHLine(detailX - 1, y, detailW - 2, '─', dividerColor, Palette.BLACK);
        this.buffer.writeText(detailX, y, ` ${opt.name} `, dividerColor, Palette.BLACK);

        // Option details (use dimmed colors when not focused)
        const detailColor = optionFocused ? Palette.MID_GRAY : Palette.DIM_GRAY;
        this.buffer.writeText(detailX, y + 1, `Duration: ${this.formatMs(opt.durationMs)}`, detailColor, Palette.BLACK);
        this.buffer.writeText(detailX, y + 2, `Req: ${this.describeRequirements(opt.requirements)}`, detailColor, Palette.BLACK);
        this.buffer.writeText(detailX, y + 3, `Outcome: ${this.summarizeResolution(opt.resolution)}`, detailColor, Palette.BLACK);

        if (selected) {
          this.buffer.writeText(branchW + activityW + detailW - 16, y + 1, '[ENTER] START', Palette.SUCCESS_GREEN, Palette.BLACK);
        }

        currentY += 4;
      });

      // Active runs section for this activity
      const activeRuns = this.engine.state.runs.filter(run => run.activityId === activity.id);
      if (activeRuns.length > 0) {
        // Section header
        const headerY = currentY + 1;
        const headerColor = optionFocused ? Palette.ELECTRIC_ORANGE : Palette.ELECTRIC_ORANGE_DIM;
        this.buffer.writeText(detailX, headerY, `ACTIVE RUNS (${activeRuns.length})`, headerColor, Palette.BLACK);

        // Draw each active run using 4-line format (dimmed if panel not focused)
        activeRuns.forEach((run, idx) => {
          const runY = headerY + 2 + (idx * 5);
          this.renderRunCard(run, detailX, runY, detailW - 4, !optionFocused);
        });
      }
    } else {
      this.buffer.writeText(detailX, top + 2, 'No activity available.', Palette.DIM_GRAY, Palette.BLACK);
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

  renderRunsTab() {
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

  renderLogTab() {
    const top = 5;
    const maxRows = Layout.HEIGHT - top - 2;

    this.buffer.writeText(2, top - 1, 'LOG (UP/DOWN TO SCROLL)', Palette.SUCCESS_GREEN, Palette.BLACK);

    const entries = this.engine.state.log.slice(this.ui.logOffset, this.ui.logOffset + maxRows);
    entries.forEach((entry, idx) => {
      const y = top + idx;
      const time = new Date(entry.timestamp).toLocaleTimeString();

      let color = Palette.NEON_TEAL;
      if (entry.type === 'error') color = Palette.HEAT_RED;
      if (entry.type === 'success') color = Palette.SUCCESS_GREEN;

      this.buffer.writeText(2, y, `[${time}] ${entry.message}`.slice(0, Layout.WIDTH - 4), color, Palette.BLACK);
    });
  }

  renderSettingsTab() {
    const top = 6;

    this.buffer.writeText(2, top - 2, 'SETTINGS', Palette.SUCCESS_GREEN, Palette.BLACK);

    this.buffer.drawBox(2, top, Layout.WIDTH - 4, 6, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(4, top, ' DISPLAY ', Palette.NEON_CYAN, Palette.BLACK);

    this.buffer.writeText(4, top + 2, 'Font', Palette.NEON_TEAL, Palette.BLACK);

    // Map font IDs to display names
    const fontNames = {
      'vga-9x8': 'VGA 9x8 (compact)',
      'vga-8x16': 'VGA 8x16 (classic)',
      'scp': 'Source Code Pro (modern)'
    };

    const fontText = fontNames[this.ui.settings.font] || this.ui.settings.font;
    this.buffer.writeText(18, top + 2, fontText, Palette.WHITE, Palette.DARKER_BLUE);
    this.buffer.writeText(Layout.WIDTH - 18, top + 2, '<ENTER> CYCLE', Palette.SUCCESS_GREEN, Palette.BLACK);
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
