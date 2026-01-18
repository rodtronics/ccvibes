// Crime Committer VI - UI Layer
// All rendering logic that writes to the FrameBuffer
// Uses Palette for colors, no direct DOM manipulation

import { Palette, BoxStyles } from './palette.js';
import { interpolateColor, getGradientColors } from './gradients.js';

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
    this.buffer.forceUppercase = !!this.ui.settings.allCaps;

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
    if (this.ui.tab === 'options') this.renderOptionsTab();
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
      { id: 'options', label: 'OPTIONS', hotkey: 'o' },
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

    // No navigation hint text (keep the bar clean)
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
      // Use color from schema, fallback to TERMINAL_GREEN
      const branchColor = b.ui?.color ? Palette[b.ui.color] : Palette.TERMINAL_GREEN;
      // Use gradient if specified in schema
      const gradient = b.ui?.gradient || null;
      const width = this.renderTab(
        tabX, tabY,
        b.name.toUpperCase(),
        b.hotkey || '',
        isActive,
        branchColor,
        Palette.BLACK,
        Palette.DIM_GRAY,
        gradient
      );
      tabX += width + 2;
    });

    // Determine layout based on focus
    const showingOptions = (this.ui.focus === 'option' || this.ui.focus === 'runs') && activity;

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
      // Split into two columns: LEFT = options list, RIGHT = active runs
      const optionsTop = 6;
      const leftCol = { x: 2, width: 48 };
      const rightCol = { x: 52, width: 26 };

      // Apply branch background color if specified
      const branchBgColor = branch?.ui?.bgColor ? Palette[branch.ui.bgColor] : Palette.BLACK;
      this.buffer.fillRect(0, 3, Layout.WIDTH, Layout.HEIGHT - 3, ' ', Palette.LIGHT_GRAY, branchBgColor);

      // Redraw main box border over the background
      this.buffer.drawBox(0, 3, Layout.WIDTH, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, branchBgColor);

      // Draw vertical divider between columns
      this.buffer.drawVLine(51, optionsTop, Layout.HEIGHT - optionsTop - 2, '│', Palette.DIM_GRAY, branchBgColor);

      // LEFT COLUMN: Activity header and options list
      this.buffer.writeText(leftCol.x, optionsTop, activity.name.toUpperCase(), Palette.NEON_CYAN, branchBgColor);

      const descLines = this.wrapText(activity.description || '', leftCol.width - 4);
      descLines.slice(0, 2).forEach((line, idx) => {
        this.buffer.writeText(leftCol.x, optionsTop + 1 + idx, line, Palette.MID_GRAY, branchBgColor);
      });

      // Show numbered options (condensed to fit with repeat controls)
      options.slice(0, 9).forEach((opt, i) => {
        const optY = optionsTop + 4 + (i * 5);
        const number = i + 1;
        const selected = this.ui.optionIndex === i;

        // Validate if this option can be started
        const validation = selected ? this.engine.canStartRun(activity.id, opt.id) : { ok: true };
        const fg = selected
          ? (validation.ok ? Palette.SUCCESS_GREEN : Palette.HEAT_ORANGE)
          : Palette.NEON_TEAL;

        // Number and name
        this.buffer.writeText(leftCol.x, optY, `${number}.`, fg, branchBgColor);
        this.buffer.writeText(leftCol.x + 3, optY, opt.name.substring(0, leftCol.width - 5), fg, branchBgColor);

        // Details
        const detailFg = selected ? Palette.MID_GRAY : Palette.DIM_GRAY;
        this.buffer.writeText(leftCol.x + 3, optY + 1, `Duration: ${this.formatMs(opt.durationMs)}`, detailFg, branchBgColor);
        this.buffer.writeText(leftCol.x + 3, optY + 2, `Req: ${this.describeRequirements(opt.requirements)}`, detailFg, branchBgColor);

        // Show validation error if can't start
        if (selected && !validation.ok) {
          this.buffer.writeText(leftCol.x + 3, optY + 3, `! ${validation.reason}`, Palette.HEAT_ORANGE, branchBgColor);
        }

        // Repeat controls (only for selected option if repeatable and valid)
        if (selected && opt.repeatable && validation.ok) {
          const repeatRow = optY + 3;
          const mode = this.ui.repeatMode || 'single';

          // Mode buttons
          const multiColor = mode === 'multi' ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;
          const infColor = mode === 'infinite' ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;

          // N for multi (number of runs), I for infinite. Enter runs single.
          this.buffer.writeText(leftCol.x + 3, repeatRow, '[N]', multiColor, branchBgColor);

          if (mode === 'multi') {
            const count = this.ui.repeatCount || 2;
            this.buffer.writeText(leftCol.x + 7, repeatRow, `(${count})`, Palette.WHITE, branchBgColor);
            this.buffer.writeText(leftCol.x + 11, repeatRow, '[+/-]', Palette.DIM_GRAY, branchBgColor);
          }

          this.buffer.writeText(leftCol.x + 18, repeatRow, '[I]INF', infColor, branchBgColor);
        }

        if (selected) {
          this.buffer.writeText(leftCol.x + 3, optY + 4, '[ENTER] START', Palette.SUCCESS_GREEN, branchBgColor);
        }
      });

      // RIGHT COLUMN: Active runs for this activity
      const activityRuns = this.engine.state.runs.filter(r => r.activityId === activity.id);

      this.buffer.writeText(rightCol.x, optionsTop, 'ACTIVE RUNS', Palette.NEON_CYAN, branchBgColor);

      const runsTop = optionsTop + 2;
      const runsBottom = Layout.HEIGHT - 2;
      const runCardHeight = 4;
      const availableHeight = runsBottom - runsTop + 1;
      const visibleRuns = Math.max(0, Math.floor(availableHeight / runCardHeight));

      if (activityRuns.length === 0 || visibleRuns === 0) {
        this.buffer.writeText(rightCol.x, runsTop, 'None active', Palette.DIM_GRAY, branchBgColor);
      } else {
        let selectedRun = this.ui.selectedRun ?? 0;
        selectedRun = Math.max(0, Math.min(selectedRun, activityRuns.length - 1));
        this.ui.selectedRun = selectedRun;

        let scrollOffset = this.clampScrollOffset('runs', activityRuns.length, visibleRuns);
        if (this.ui.focus === 'runs') {
          if (selectedRun < scrollOffset) scrollOffset = selectedRun;
          if (selectedRun >= scrollOffset + visibleRuns) {
            scrollOffset = selectedRun - visibleRuns + 1;
          }
          this.ui.scroll.runs = scrollOffset;
        }

        const showScrollbar = activityRuns.length > visibleRuns;
        const runCardWidth = showScrollbar ? rightCol.width - 1 : rightCol.width;
        const visibleSlice = activityRuns.slice(scrollOffset, scrollOffset + visibleRuns);
        visibleSlice.forEach((run, idx) => {
          const runIndex = scrollOffset + idx;
          const runY = runsTop + (idx * runCardHeight);
          if (runY + 2 > runsBottom) return;

          const selected = this.ui.focus === 'runs' && selectedRun === runIndex;
          if (selected) {
            this.buffer.writeText(rightCol.x - 1, runY, '>', Palette.SUCCESS_GREEN, branchBgColor);
          }

          const indexWidth = String(activityRuns.length).length;
          const indexLabel = `${String(runIndex + 1).padStart(indexWidth, '0')}.`;
          this.renderCompactRunCard(run, rightCol.x, runY, runCardWidth, branchBgColor, selected, indexLabel);
        });

        if (showScrollbar) {
          this.renderScrollBar(
            rightCol.x + rightCol.width - 1,
            runsTop,
            visibleRuns * runCardHeight,
            activityRuns.length,
            scrollOffset,
            Palette.DIM_GRAY,
            branchBgColor,
            visibleRuns
          );
        }
      }
    }
  }

  // Render compact 3-line run card for options view right column
  renderCompactRunCard(run, x, y, maxWidth, bgColor = Palette.BLACK, selected = false, indexLabel = '') {
    const activity = this.engine.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);

    // Line 1: Option name + repeat status
    const label = indexLabel ? `${indexLabel} ` : '';
    let suffix = '';
    if (run.runsLeft === -1) {
      suffix = ' INF';
    } else if (run.runsLeft > 0) {
      suffix = ` +${run.runsLeft}`;
    }
    const nameMax = Math.max(0, maxWidth - label.length - suffix.length);
    const trimmedName = (option?.name || '?').substring(0, nameMax);
    const line1 = `${label}${trimmedName}${suffix}`.substring(0, maxWidth);
    this.buffer.writeText(x, y, line1, Palette.NEON_TEAL, bgColor);

    // Line 2: Time remaining (compact)
    const remaining = Math.max(0, run.endsAt - this.engine.state.now);
    const timeText = this.formatMs(remaining);
    this.buffer.writeText(x, y + 1, timeText, Palette.MID_GRAY, bgColor);

    // Line 3: Smooth gradient progress bar + buttons
    const barWidth = maxWidth - 8;
    const pct = (this.engine.state.now - run.startedAt) / (run.endsAt - run.startedAt);
    // Gradient from yellow/green to cyan, with dim gray as the empty color
    this.buffer.drawSmoothProgressBar(
      x, y + 2, barWidth, pct,
      Palette.BRIGHT_YELLOW,  // Start color (left side of gradient)
      Palette.NEON_CYAN,      // End color (right side of gradient)
      Palette.DIM_GRAY,       // Empty color (unfilled blocks)
      bgColor
    );

    // Stop buttons - only show when the run is selected
    if (selected) {
      this.buffer.writeText(x + barWidth + 1, y + 2, '[X]', Palette.HEAT_RED, bgColor);
      if (run.runsLeft !== 0) {
        this.buffer.writeText(x + barWidth + 4, y + 2, '[Z]', Palette.ELECTRIC_ORANGE, bgColor);
      }
    }
  }

  // Render a single run card in 4-line format
  renderRunCard(run, x, y, maxWidth, dimmed = false) {
    const activity = this.engine.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);

    // Select colors based on dimmed state
    const nameColor = dimmed ? Palette.NEON_TEAL_DIM : Palette.NEON_TEAL;
    const textColor = dimmed ? Palette.DIM_GRAY : Palette.MID_GRAY;

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

    // Line 4: Smooth gradient progress bar
    const pct = Math.min(1, Math.max(0, (this.engine.state.now - run.startedAt) / (run.endsAt - run.startedAt)));
    const barWidth = Math.min(40, maxWidth - 6);
    // Use dimmed colors if the run card itself is dimmed
    const gradientStart = dimmed ? Palette.ELECTRIC_ORANGE : Palette.BRIGHT_YELLOW;
    const gradientEnd = dimmed ? Palette.NEON_CYAN_DIM : Palette.NEON_CYAN;
    this.buffer.drawSmoothProgressBar(
      x, y + 3, barWidth, pct,
      gradientStart,
      gradientEnd,
      Palette.DIM_GRAY,
      Palette.BLACK
    );
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

    // Current crew count
    const crewCount = this.engine.state.crew.staff.length;
    this.buffer.writeText(2, top + 1, `Current crew: ${crewCount}`, Palette.MID_GRAY, Palette.BLACK);

    // Test spawn button
    this.buffer.writeText(2, top + 3, '[SPACE] Add test crew member (+1 free)', Palette.NEON_CYAN, Palette.BLACK);
    if (crewCount > 0) {
      this.buffer.writeText(2, top + 4, '[UP/DOWN] Scroll roster', Palette.DIM_GRAY, Palette.BLACK);
    }

    // List crew roster
    this.buffer.writeText(2, top + 6, 'CREW ROSTER:', Palette.SUCCESS_GREEN, Palette.BLACK);
    const rosterTop = top + 7;
    const rosterBottom = Layout.HEIGHT - 3;
    const visibleRows = Math.max(0, rosterBottom - rosterTop + 1);
    const scrollOffset = this.clampScrollOffset('crew', crewCount, visibleRows);

    const visibleCrew = this.engine.state.crew.staff.slice(scrollOffset, scrollOffset + visibleRows);
    visibleCrew.forEach((member, idx) => {
      const y = rosterTop + idx;
      const statusColor = member.status === 'available' ? Palette.SUCCESS_GREEN : Palette.HEAT_ORANGE;
      const rowNumber = scrollOffset + idx + 1;
      this.buffer.writeText(2, y, `${rowNumber}. ${member.name} - ${member.roleId} (${member.status})`, statusColor, Palette.BLACK);
    });

    // Simple ASCII scrollbar using '|' for track and '*' for thumb
    this.renderScrollBar(Layout.WIDTH - 3, rosterTop, visibleRows, crewCount, scrollOffset, Palette.DIM_GRAY, Palette.BLACK);
  }

  renderOptionsTab() {
    const top = 6;
    const selectedSetting = this.ui.selectedSetting ?? 0;

    this.buffer.writeText(2, top - 2, 'OPTIONS', Palette.SUCCESS_GREEN, Palette.BLACK);

    this.buffer.drawBox(2, top, Layout.WIDTH - 4, 12, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(4, top, ' DISPLAY ', Palette.NEON_CYAN, Palette.BLACK);

    // Font family
    const fontRow = top + 2;
    const fontSelected = selectedSetting === 0;
    this.buffer.writeText(3, fontRow, fontSelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, fontRow, '1. Font', fontSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);

    const fontNames = {
      'fira': 'Fira Code (modern)',
      'vga-9x8': 'VGA 9x8 (compact)',
      'vga-8x16': 'VGA 8x16 (classic)'
    };

    const fontText = fontNames[this.ui.settings.font] || this.ui.settings.font;
    this.buffer.writeText(18, fontRow, fontText, Palette.WHITE, Palette.DARKER_BLUE);
    if (fontSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, fontRow, '<ENTER> CYCLE', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Font size / zoom
    const sizeRow = top + 3;
    const sizeSelected = selectedSetting === 1;
    const zoom = this.ui.settings.zoom || 100;
    this.buffer.writeText(3, sizeRow, sizeSelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, sizeRow, '2. Font size', sizeSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(18, sizeRow, `${zoom}%`, Palette.WHITE, Palette.DARKER_BLUE);
    if (sizeSelected) {
      this.buffer.writeText(Layout.WIDTH - 25, sizeRow, '[LEFT/RIGHT] or <ENTER>', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Gradients toggle
    const gradRow = top + 5;
    const gradSelected = selectedSetting === 2;
    const gradientsOn = this.ui.settings.gradients !== false;
    this.buffer.writeText(3, gradRow, gradSelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, gradRow, '3. Gradients', gradSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(18, gradRow, gradientsOn ? 'ENABLED' : 'DISABLED', gradientsOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (gradSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, gradRow, '<ENTER> TOGGLE', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Hotkey glow toggle
    const glowRow = top + 6;
    const glowSelected = selectedSetting === 3;
    const glowOn = this.ui.settings.hotkeyGlow !== false;
    this.buffer.writeText(3, glowRow, glowSelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, glowRow, '4. Hotkey glow', glowSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(18, glowRow, glowOn ? 'ENABLED' : 'DISABLED', glowOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (glowSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, glowRow, '<ENTER> TOGGLE', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Bloom toggle
    const bloomRow = top + 8;
    const bloomSelected = selectedSetting === 4;
    const bloomOn = !!this.ui.settings.bloom;
    this.buffer.writeText(3, bloomRow, bloomSelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, bloomRow, '5. Bloom filter', bloomSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(18, bloomRow, bloomOn ? 'ENABLED' : 'DISABLED', bloomOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (bloomSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, bloomRow, '<ENTER> TOGGLE', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Funny names toggle
    const funnyRow = top + 9;
    const funnySelected = selectedSetting === 5;
    const funnyOn = !!this.ui.settings.funnyNames;
    this.buffer.writeText(3, funnyRow, funnySelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, funnyRow, '6. Funny names', funnySelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(18, funnyRow, funnyOn ? 'ENABLED' : 'DISABLED', funnyOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (funnySelected) {
      this.buffer.writeText(Layout.WIDTH - 18, funnyRow, '<ENTER> TOGGLE', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Force caps toggle
    const capsRow = top + 10;
    const capsSelected = selectedSetting === 6;
    const capsOn = !!this.ui.settings.allCaps;
    this.buffer.writeText(3, capsRow, capsSelected ? '>' : ' ', Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, capsRow, '7. Force caps', capsSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(18, capsRow, capsOn ? 'ENABLED' : 'DISABLED', capsOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (capsSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, capsRow, '<ENTER> TOGGLE', Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Help text
    this.buffer.writeText(4, top + 11, 'Arrows to move | 1-7 select | Enter toggles | LEFT/RIGHT resize font', Palette.DIM_GRAY, Palette.BLACK);
  }

  // Tab rendering helper - renders tab with colored hotkey letter and optional glow
  renderTab(x, y, label, hotkey, isActive, activeFg, activeBg, inactiveFg, gradient = null) {
    // Normalize inputs and locate the hotkey within the label
    const safeLabel = label || '';
    const lowerLabel = safeLabel.toLowerCase();
    const normalizedHotkey = (hotkey || '').toLowerCase();
    const hotkeyIndex = normalizedHotkey ? lowerLabel.indexOf(normalizedHotkey) : -1;

    const fg = isActive ? activeFg : inactiveFg;
    const bg = isActive ? activeBg : null;

    // Visual toggles driven by settings
    const glowEnabled = this.ui.settings?.hotkeyGlow !== false;
    const useGradient = !isActive && gradient && this.ui.settings?.gradients !== false;
    const gradientColors = useGradient ? getGradientColors(gradient, safeLabel.length) : null;

    // Write the label character by character, applying gradient/hotkey styling
    for (let i = 0; i < safeLabel.length; i++) {
      const char = safeLabel[i];
      const isHotkey = !isActive && hotkeyIndex === i && hotkeyIndex >= 0;
      const isGlow = !isActive && glowEnabled && hotkeyIndex >= 0 && Math.abs(i - hotkeyIndex) === 1;

      // Base color comes from gradient (if enabled) or the tab foreground
      const baseColor = gradientColors && gradientColors.length === safeLabel.length
        ? gradientColors[i]
        : fg;

      // Dim gradient colors on inactive tabs so the hotkey stands out
      const dimmedColor = useGradient && gradientColors
        ? interpolateColor(baseColor, inactiveFg, 0.5)
        : baseColor;

      let charColor = dimmedColor;

      if (isHotkey) {
        charColor = Palette.NEON_CYAN;
      } else if (isGlow) {
        const glowBase = dimmedColor || inactiveFg;
        charColor = interpolateColor(Palette.NEON_CYAN, glowBase, 0.67);
      }

      this.buffer.writeText(x + i, y, char, charColor, bg);
    }

    return safeLabel.length; // Return width for positioning next tab
  }

  // Helper methods
  clampScrollOffset(key, totalItems, visibleRows) {
    if (!this.ui.scroll) this.ui.scroll = {};
    const maxOffset = Math.max(0, totalItems - visibleRows);
    const current = this.ui.scroll[key] || 0;
    const clamped = Math.max(0, Math.min(current, maxOffset));
    this.ui.scroll[key] = clamped;
    return clamped;
  }

  renderScrollBar(x, y, height, totalItems, scrollOffset, fg = Palette.DIM_GRAY, bg = Palette.BLACK, visibleItems = height) {
    if (height <= 0 || totalItems <= visibleItems) return;

    // Draw track
    for (let i = 0; i < height; i++) {
      this.buffer.setCell(x, y + i, '|', fg, bg);
    }

    // Draw thumb
    const maxOffset = Math.max(1, totalItems - visibleItems);
    const thumbPos = Math.min(height - 1, Math.floor((scrollOffset / maxOffset) * (height - 1)));
    this.buffer.setCell(x, y + thumbPos, '*', Palette.WHITE, bg);
  }

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
