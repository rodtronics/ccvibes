// Crime Committer VI - UI Layer
// All rendering logic that writes to the FrameBuffer
// Uses Palette for colors, no direct DOM manipulation

import { Palette, BoxStyles } from "./palette.js";
import { interpolateColor, getGradientColors } from "./gradients.js";
import { parseModalContent } from "./modal.js";

// Layout constants for 80x25 viewport
export const Layout = {
  WIDTH: 80,
  HEIGHT: 25,

  statusRail: { x: 0, y: 0, width: 80, height: 1 },
  tabBar: { x: 0, y: 1, width: 80, height: 1 },
  mainPanel: { x: 0, y: 2, width: 56, height: 23 },
  logPanel: { x: 56, y: 2, width: 24, height: 23 },
  footer: { x: 0, y: 24, width: 80, height: 1 },
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
    this.buffer.fill(" ", Palette.LIGHT_GRAY, Palette.BLACK);

    // Layer 1: Draw structure (all borders and boxes)
    this.renderStructure();

    // Layer 2: Draw content (overwrites borders as needed)
    this.renderStatusRail();
    this.renderTabBar();

    if (this.ui.tab === "jobs") this.renderJobsTab();
    if (this.ui.tab === "active") this.renderActiveTab();
    if (this.ui.tab === "crew") this.renderCrewTab();
    if (this.ui.tab === "resources") this.renderResourcesTab();
    if (this.ui.tab === "stats") this.renderStatsTab();
    if (this.ui.tab === "log") this.renderLogTab();
    if (this.ui.tab === "options") this.renderOptionsTab();

    // Layer 3: Crime detail overlay (if active)
    if (this.ui.crimeDetail && this.ui.crimeDetail.active) {
      this.renderCrimeDetail();
    }

    // Layer 4: Modal overlay (if active, highest priority)
    if (this.ui.modal && this.ui.modal.active) {
      this.renderModal();
    }
  }

  renderStructure() {
    // Draw all boxes/borders for current tab
    // This is the structure layer that content will overwrite
    // VISUAL HIERARCHY: Borders are DARK, content/titles will be BRIGHT

    // Tab bar gets no box, just content

    // Main content area - single panel with dark border
    this.buffer.drawBox(0, 2, Layout.WIDTH, Layout.HEIGHT - 2, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
  }

  renderStatusRail() {
    const x = 2;
    const y = 0;

    // Title (overwrites box border)
    this.buffer.writeText(x, y, "CRIME COMMITTER VI", Palette.NEON_CYAN, Palette.BLACK);

    // Resources
    const cash = this.fmtNum(this.engine.state.resources.cash);
    const heat = Math.floor(this.engine.state.resources.heat);
    const cred = Math.floor(this.engine.state.resources.cred);

    this.buffer.writeText(22, y, `CASH $${cash}`, Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(38, y, `HEAT ${heat}`, heat > 50 ? Palette.HEAT_RED : Palette.BRIGHT_YELLOW, Palette.BLACK);
    this.buffer.writeText(52, y, `CRED ${cred}`, Palette.TERMINAL_GREEN, Palette.BLACK);

    // Clock
    const clock = new Date(this.engine.state.now).toLocaleTimeString();
    this.buffer.writeTextRight(Layout.WIDTH - 2, y, clock, Palette.MID_GRAY, Palette.BLACK);
  }

  renderTabBar() {
    const leftTabs = [
      { id: "jobs", label: "JOBS", hotkey: "j" },
      { id: "active", label: "ACTIVE", hotkey: "a" },
      { id: "crew", label: "CREW", hotkey: "c" },
      { id: "resources", label: "RESOURCES", hotkey: "r" },
      { id: "stats", label: "STATS", hotkey: "s" },
    ];

    const rightTabs = [
      { id: "log", label: "LOG", hotkey: "l" },
      { id: "options", label: "OPTIONS", hotkey: "o" },
    ];

    const y = 1;

    // Render left-aligned tabs
    let x = 2;
    leftTabs.forEach((tab) => {
      const active = tab.id === this.ui.tab;
      const width = this.renderTab(x, y, tab.label, tab.hotkey, active, Palette.NEON_CYAN, Palette.BLACK, Palette.DIM_GRAY);
      x += width + 3; // Add spacing between tabs
    });

    // Render right-aligned tabs (calculate position from right edge)
    const rightTabsReversed = [...rightTabs].reverse();
    x = Layout.WIDTH - 2;
    rightTabsReversed.forEach((tab) => {
      const active = tab.id === this.ui.tab;
      // Calculate tab width first
      const tabWidth = tab.label.length + 3; // [X] format
      x -= tabWidth;
      this.renderTab(x, y, tab.label, tab.hotkey, active, Palette.NEON_CYAN, Palette.BLACK, Palette.DIM_GRAY);
      x -= 3; // Add spacing
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
    const tabY = 3;
    branches.forEach((b, i) => {
      const isActive = i === this.ui.branchIndex;
      // Use color from schema, fallback to TERMINAL_GREEN
      const branchColor = b.ui?.color ? Palette[b.ui.color] : Palette.TERMINAL_GREEN;
      // Use gradient if specified in schema
      const gradient = b.ui?.gradient || null;
      const width = this.renderTab(tabX, tabY, b.name.toUpperCase(), b.hotkey || "", isActive, branchColor, Palette.BLACK, Palette.DIM_GRAY, gradient);
      tabX += width + 2;
    });

    // Determine layout based on focus
    const showingOptions = (this.ui.focus === "option" || this.ui.focus === "runs") && activity;

    if (!showingOptions) {
      // ACTIVITY LIST VIEW (focused on activities, numbered 1-9)
      const listTop = 5;
      const listTitle = branch ? branch.name.toUpperCase() + " JOBS" : "JOBS";
      this.buffer.writeText(2, listTop, listTitle, Palette.NEON_CYAN, Palette.BLACK);

      // Show numbered list of activities
      activities.slice(0, 9).forEach((a, i) => {
        const row = listTop + 2 + i;
        const number = i + 1;
        const selected = this.ui.activityIndex === i;
        const fg = selected ? Palette.NEON_CYAN : Palette.NEON_TEAL;
        const prefix = selected ? ">" : " ";

        this.buffer.writeText(2, row, `${prefix}${number}.`, fg, Palette.BLACK);
        this.buffer.writeText(6, row, a.name, fg, Palette.BLACK);
      });

      // Show description of selected activity
      if (activity) {
        const descY = listTop + 13;
        this.buffer.drawHLine(2, descY, Layout.WIDTH - 4, "─", Palette.DIM_GRAY, Palette.BLACK);
        this.buffer.writeText(2, descY + 1, activity.name.toUpperCase(), Palette.NEON_CYAN, Palette.BLACK);

        const descLines = this.wrapText(activity.description || "", Layout.WIDTH - 6);
        descLines.slice(0, 3).forEach((line, idx) => {
          this.buffer.writeText(2, descY + 2 + idx, line, Palette.MID_GRAY, Palette.BLACK);
        });

        this.buffer.writeText(2, Layout.HEIGHT - 2, "[ENTER] Select options", Palette.SUCCESS_GREEN, Palette.BLACK);
      }
    } else {
      // OPTIONS VIEW (showing numbered options for selected activity)
      // Split into two columns: LEFT = options list, RIGHT = active runs
      const optionsTop = 5;
      const leftCol = { x: 2, width: 48 };
      const rightCol = { x: 52, width: 26 };

      // Apply branch background color if specified
      const branchBgColor = branch?.ui?.bgColor ? Palette[branch.ui.bgColor] : Palette.BLACK;
      this.buffer.fillRect(0, 3, Layout.WIDTH, Layout.HEIGHT - 3, " ", Palette.LIGHT_GRAY, branchBgColor);

      // Redraw main box border over the background
      this.buffer.drawBox(0, 3, Layout.WIDTH, Layout.HEIGHT - 3, BoxStyles.SINGLE, Palette.DIM_GRAY, branchBgColor);

      // Draw vertical divider between columns
      this.buffer.drawVLine(51, optionsTop, Layout.HEIGHT - optionsTop - 2, "│", Palette.DIM_GRAY, branchBgColor);

      // LEFT COLUMN: Activity header and options list
      this.buffer.writeText(leftCol.x, optionsTop, activity.name.toUpperCase(), Palette.NEON_CYAN, branchBgColor);

      const descLines = this.wrapText(activity.description || "", leftCol.width - 4);
      descLines.slice(0, 2).forEach((line, idx) => {
        this.buffer.writeText(leftCol.x, optionsTop + 1 + idx, line, Palette.MID_GRAY, branchBgColor);
      });

      // Show numbered options (condensed to fit with repeat controls)
      options.slice(0, 9).forEach((opt, i) => {
        const optY = optionsTop + 4 + i * 5;
        const number = i + 1;
        const selected = this.ui.optionIndex === i;

        // Validate if this option can be started
        const validation = selected ? this.engine.canStartRun(activity.id, opt.id) : { ok: true };
        const fg = selected ? (validation.ok ? Palette.SUCCESS_GREEN : Palette.HEAT_ORANGE) : Palette.NEON_TEAL;

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
          const mode = this.ui.repeatMode || "single";

          // Mode buttons
          const multiColor = mode === "multi" ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;
          const infColor = mode === "infinite" ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;

          // N for multi (number of runs), I for infinite. Enter runs single.
          this.buffer.writeText(leftCol.x + 3, repeatRow, "[N]", multiColor, branchBgColor);

          if (mode === "multi") {
            const count = this.ui.repeatCount || 2;
            this.buffer.writeText(leftCol.x + 7, repeatRow, `(${count})`, Palette.WHITE, branchBgColor);
            this.buffer.writeText(leftCol.x + 11, repeatRow, "[+/-]", Palette.DIM_GRAY, branchBgColor);
          }

          this.buffer.writeText(leftCol.x + 18, repeatRow, "[I]INF", infColor, branchBgColor);
        }

        if (selected) {
          this.buffer.writeText(leftCol.x + 3, optY + 4, "[Q] Quick | [ENTER] Details", Palette.SUCCESS_GREEN, branchBgColor);
        }
      });

      // RIGHT COLUMN: Active runs for this activity
      const activityRuns = this.engine.state.runs.filter((r) => r.activityId === activity.id);

      this.buffer.writeText(rightCol.x, optionsTop, "ACTIVE RUNS", Palette.NEON_CYAN, branchBgColor);

      const runsTop = optionsTop + 2;
      const runsBottom = Layout.HEIGHT - 2;
      const runCardHeight = 4;
      const availableHeight = runsBottom - runsTop + 1;
      const visibleRuns = Math.max(0, Math.floor(availableHeight / runCardHeight));

      if (activityRuns.length === 0 || visibleRuns === 0) {
        this.buffer.writeText(rightCol.x, runsTop, "None active", Palette.DIM_GRAY, branchBgColor);
      } else {
        let selectedRun = this.ui.selectedRun ?? 0;
        selectedRun = Math.max(0, Math.min(selectedRun, activityRuns.length - 1));
        this.ui.selectedRun = selectedRun;

        let scrollOffset = this.clampScrollOffset("runs", activityRuns.length, visibleRuns);
        if (this.ui.focus === "runs") {
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
          const runY = runsTop + idx * runCardHeight;
          if (runY + 2 > runsBottom) return;

          const selected = this.ui.focus === "runs" && selectedRun === runIndex;
          if (selected) {
            this.buffer.writeText(rightCol.x - 1, runY, ">", Palette.SUCCESS_GREEN, branchBgColor);
          }

          const indexWidth = String(activityRuns.length).length;
          const indexLabel = `${String(runIndex + 1).padStart(indexWidth, "0")}.`;
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
  renderCompactRunCard(run, x, y, maxWidth, bgColor = Palette.BLACK, selected = false, indexLabel = "") {
    const activity = this.engine.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);

    // Line 1: Option name + repeat status
    const label = indexLabel ? `${indexLabel} ` : "";
    let suffix = "";
    if (run.runsLeft === -1) {
      suffix = " INF";
    } else if (run.runsLeft > 0) {
      suffix = ` +${run.runsLeft}`;
    }
    const nameMax = Math.max(0, maxWidth - label.length - suffix.length);
    const trimmedName = (option?.name || "?").substring(0, nameMax);
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
      x,
      y + 2,
      barWidth,
      pct,
      Palette.BRIGHT_YELLOW, // Start color (left side of gradient)
      Palette.NEON_CYAN, // End color (right side of gradient)
      Palette.DIM_GRAY, // Empty color (unfilled blocks)
      bgColor
    );

    // Stop buttons - only show when the run is selected
    if (selected) {
      this.buffer.writeText(x + barWidth + 1, y + 2, "[X]", Palette.HEAT_RED, bgColor);
      if (run.runsLeft !== 0) {
        this.buffer.writeText(x + barWidth + 4, y + 2, "[Z]", Palette.ELECTRIC_ORANGE, bgColor);
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
    const nameText = `${activity?.name || "?"} → ${option?.name || "?"}`;
    this.buffer.writeText(x, y, nameText.slice(0, maxWidth), nameColor, Palette.BLACK);

    // Line 2: Staff assignment
    const staffText = `Staff: ${run.assignedStaffIds?.join(", ") || "none"}`;
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
    this.buffer.drawSmoothProgressBar(x, y + 3, barWidth, pct, gradientStart, gradientEnd, Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(x + barWidth + 1, y + 3, "STOP", Palette.HEAT_RED, Palette.BLACK);
  }

  renderActiveTab() {
    const top = 4;

    this.buffer.writeText(2, top - 1, "ACTIVE OPERATIONS", Palette.SUCCESS_GREEN, Palette.BLACK);

    if (this.engine.state.runs.length === 0) {
      this.buffer.writeText(2, top + 1, "No active runs. Start something risky.", Palette.DIM_GRAY, Palette.BLACK);
      return;
    }

    // Render each run using shared 4-line card format
    this.engine.state.runs.forEach((run, idx) => {
      const y = top + idx * 5;
      if (y + 4 < Layout.HEIGHT - 1) {
        this.renderRunCard(run, 2, y, Layout.WIDTH - 4);
      }
    });
  }

  renderCrewTab() {
    const top = 4;
    this.buffer.writeText(2, top - 1, "CREW MANAGEMENT", Palette.SUCCESS_GREEN, Palette.BLACK);

    // Current crew count
    const crewCount = this.engine.state.crew.staff.length;
    this.buffer.writeText(2, top + 1, `Current crew: ${crewCount}`, Palette.MID_GRAY, Palette.BLACK);

    // Test spawn button
    this.buffer.writeText(2, top + 3, "[SPACE] Add test crew member (+1 free)", Palette.NEON_CYAN, Palette.BLACK);
    if (crewCount > 0) {
      this.buffer.writeText(2, top + 4, "[UP/DOWN] Scroll roster", Palette.DIM_GRAY, Palette.BLACK);
    }

    // List crew roster
    this.buffer.writeText(2, top + 6, "CREW ROSTER:", Palette.SUCCESS_GREEN, Palette.BLACK);
    const rosterTop = top + 7;
    const rosterBottom = Layout.HEIGHT - 3;
    const visibleRows = Math.max(0, rosterBottom - rosterTop + 1);
    const scrollOffset = this.clampScrollOffset("crew", crewCount, visibleRows);

    const visibleCrew = this.engine.state.crew.staff.slice(scrollOffset, scrollOffset + visibleRows);
    visibleCrew.forEach((member, idx) => {
      const y = rosterTop + idx;
      const statusColor = member.status === "available" ? Palette.SUCCESS_GREEN : Palette.HEAT_ORANGE;
      const rowNumber = scrollOffset + idx + 1;
      this.buffer.writeText(2, y, `${rowNumber}. ${member.name} - ${member.roleId} (${member.status})`, statusColor, Palette.BLACK);
    });

    // Simple ASCII scrollbar using '|' for track and '*' for thumb
    this.renderScrollBar(Layout.WIDTH - 3, rosterTop, visibleRows, crewCount, scrollOffset, Palette.DIM_GRAY, Palette.BLACK);
  }

  renderResourcesTab() {
    const top = 4;
    this.buffer.writeText(2, top - 1, "RESOURCES", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(2, top + 1, "Resources view coming soon.", Palette.DIM_GRAY, Palette.BLACK);
  }

  renderStatsTab() {
    const top = 4;
    this.buffer.writeText(2, top - 1, "STATS", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(2, top + 1, "Stats view coming soon.", Palette.DIM_GRAY, Palette.BLACK);
  }

  renderLogTab() {
    const top = 4;
    this.buffer.writeText(2, top - 1, "LOG", Palette.SUCCESS_GREEN, Palette.BLACK);

    const listTop = top + 1;
    const listBottom = Layout.HEIGHT - 3;
    const visibleRows = Math.max(0, listBottom - listTop + 1);
    const entries = this.engine.state.log || [];
    const scrollOffset = this.clampScrollOffset("log", entries.length, visibleRows);

    const colorForType = (type) => {
      const key = (type || "").toString().toLowerCase();
      if (key === "success") return Palette.SUCCESS_GREEN;
      if (key === "error") return Palette.HEAT_RED;
      if (key === "warning" || key === "warn") return Palette.HEAT_ORANGE;
      return Palette.MID_GRAY;
    };

    const availableWidth = Layout.WIDTH - 4;
    const visibleEntries = entries.slice(scrollOffset, scrollOffset + visibleRows);
    visibleEntries.forEach((entry, idx) => {
      const y = listTop + idx;
      const time = new Date(entry.timestamp || Date.now()).toLocaleTimeString();
      const line = `${time} ${entry.message || ""}`.slice(0, availableWidth);
      this.buffer.writeText(2, y, line, colorForType(entry.type), Palette.BLACK);
    });

    this.renderScrollBar(Layout.WIDTH - 3, listTop, visibleRows, entries.length, scrollOffset, Palette.DIM_GRAY, Palette.BLACK, visibleRows);
  }

  renderOptionsTab() {
    const top = 5;
    const selectedSetting = this.ui.selectedSetting ?? 0;
    const valueCol = 22; // Column for values

    // Check if in font submenu
    if (this.ui.inFontSubMenu) {
      this.renderFontSubMenu();
      return;
    }

    this.buffer.writeText(2, top - 2, "OPTIONS", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.drawBox(2, top, Layout.WIDTH - 4, 11, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(4, top, " DISPLAY ", Palette.NEON_CYAN, Palette.BLACK);

    // 1. Font (Submenu)
    const fontRow = top + 2;
    const fontSelected = selectedSetting === 0;
    this.buffer.writeText(3, fontRow, fontSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, fontRow, "1. Font...", fontSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    if (fontSelected) {
      this.buffer.writeText(Layout.WIDTH - 25, fontRow, "<ENTER> CONFIGURE", Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // 2. Bloom toggle
    const bloomRow = top + 3;
    const bloomSelected = selectedSetting === 1;
    const bloomOn = !!this.ui.settings.bloom;
    this.buffer.writeText(3, bloomRow, bloomSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, bloomRow, "2. Bloom filter", bloomSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(valueCol, bloomRow, bloomOn ? "ENABLED" : "DISABLED", bloomOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (bloomSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, bloomRow, "<ENTER> TOGGLE", Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // 3. Funny names toggle
    const funnyRow = top + 4;
    const funnySelected = selectedSetting === 2;
    const funnyOn = !!this.ui.settings.funnyNames;
    this.buffer.writeText(3, funnyRow, funnySelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, funnyRow, "3. Funny names", funnySelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(valueCol, funnyRow, funnyOn ? "ENABLED" : "DISABLED", funnyOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (funnySelected) {
      this.buffer.writeText(Layout.WIDTH - 18, funnyRow, "<ENTER> TOGGLE", Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // 4. Show intro toggle
    const introRow = top + 5;
    const introSelected = selectedSetting === 3;
    const introOn = !!this.ui.settings.showIntro;
    this.buffer.writeText(3, introRow, introSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, introRow, "4. Show intro", introSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(valueCol, introRow, introOn ? "ENABLED" : "DISABLED", introOn ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    if (introSelected) {
      this.buffer.writeText(Layout.WIDTH - 18, introRow, "<ENTER> TOGGLE", Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // 5. About
    const aboutRow = top + 6;
    const aboutSelected = selectedSetting === 4;
    this.buffer.writeText(3, aboutRow, aboutSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, aboutRow, "5. About", aboutSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    if (aboutSelected) {
      this.buffer.writeText(Layout.WIDTH - 20, aboutRow, "<ENTER> VIEW INFO", Palette.SUCCESS_GREEN, Palette.BLACK);
    }

    // Help text
    this.buffer.writeText(4, top + 9, "Arrows to move | 1-5 select | Enter toggles", Palette.DIM_GRAY, Palette.BLACK);
  }

  renderFontSubMenu() {
    const top = 5;
    const selected = this.ui.fontSubMenuIndex ?? 0;
    const valueCol = 22;

    this.buffer.writeText(2, top - 2, "OPTIONS > FONT", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.drawBox(2, top, Layout.WIDTH - 4, 11, BoxStyles.SINGLE, Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(4, top, " CONFIGURATION ", Palette.NEON_CYAN, Palette.BLACK);

    const fontNames = {
      fira: "Fira Mono (bold)",
      "vga-9x8": "VGA 9x8 (compact)",
      "vga-8x16": "VGA 8x16 (classic)",
      "jetbrains-mono": "JetBrains Mono (bold)",
      "ibm-bios": "IBM BIOS (retro)",
      "scp": "Source Code Pro (bold)",
    };

    // Determine category
    const fontId = this.ui.settings.font;
    const isRetro = ["vga-9x8", "vga-8x16", "ibm-bios"].includes(fontId);
    const categoryLabel = isRetro ? "RETRO" : "MODERN";

    // 1. Generation
    const catRow = top + 2;
    const catSelected = selected === 0;
    this.buffer.writeText(3, catRow, catSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, catRow, "1. Generation", catSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(valueCol, catRow, categoryLabel, Palette.WHITE, Palette.BLACK);
    if (catSelected) this.buffer.writeText(Layout.WIDTH - 25, catRow, "<ENTER> TOGGLE", Palette.SUCCESS_GREEN, Palette.BLACK);

    // 2. Face
    const faceRow = top + 3;
    const faceSelected = selected === 1;
    const fontText = fontNames[this.ui.settings.font] || this.ui.settings.font;
    this.buffer.writeText(3, faceRow, faceSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, faceRow, "2. Font Face", faceSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(valueCol, faceRow, fontText, Palette.WHITE, Palette.BLACK);
    if (faceSelected) this.buffer.writeText(Layout.WIDTH - 25, faceRow, "[ARROWS] CYCLE", Palette.SUCCESS_GREEN, Palette.BLACK);

    // 3. Size
    const sizeRow = top + 4;
    const sizeSelected = selected === 2;
    const zoom = this.ui.settings.zoom || 100;
    this.buffer.writeText(3, sizeRow, sizeSelected ? ">" : " ", Palette.SUCCESS_GREEN, Palette.BLACK);
    this.buffer.writeText(4, sizeRow, "3. Font size", sizeSelected ? Palette.NEON_CYAN : Palette.NEON_TEAL, Palette.BLACK);
    this.buffer.writeText(valueCol, sizeRow, `${zoom}%`, Palette.WHITE, Palette.BLACK);
    if (sizeSelected) this.buffer.writeText(Layout.WIDTH - 25, sizeRow, "[ARROWS] RESIZE", Palette.SUCCESS_GREEN, Palette.BLACK);

    this.buffer.writeText(4, top + 9, "<ESC/BACKSPACE> BACK", Palette.DIM_GRAY, Palette.BLACK);
  }

  // Tab rendering helper - renders tab with colored hotkey letter and optional glow
  renderTab(x, y, label, hotkey, isActive, activeFg, activeBg, inactiveFg, gradient = null) {
    // Normalize inputs and locate the hotkey within the label
    const safeLabel = label || "";
    const lowerLabel = safeLabel.toLowerCase();
    const normalizedHotkey = (hotkey || "").toString().trim().toLowerCase();
    const hotkeyIndex = normalizedHotkey ? lowerLabel.indexOf(normalizedHotkey) : -1;

    const fg = isActive ? activeFg : inactiveFg;
    const bg = isActive ? activeBg : null;

    // Visual toggles - gradients and hotkey glow are always off
    const glowEnabled = false;
    const useGradient = false;
    const gradientColors = useGradient ? getGradientColors(gradient, safeLabel.length) : null;

    // Write the label character by character, applying gradient/hotkey styling
    for (let i = 0; i < safeLabel.length; i++) {
      const char = safeLabel[i];
      const isHotkey = hotkeyIndex === i && hotkeyIndex >= 0;
      const isGlow = !isActive && glowEnabled && hotkeyIndex >= 0 && Math.abs(i - hotkeyIndex) === 1;

      // Base color comes from gradient (if enabled) or the tab foreground
      const baseColor = gradientColors && gradientColors.length === safeLabel.length ? gradientColors[i] : fg;

      // Dim gradient colors on inactive tabs so the hotkey stands out
      const dimmedColor = useGradient && gradientColors ? interpolateColor(baseColor, inactiveFg, 0.5) : baseColor;

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
      this.buffer.setCell(x, y + i, "|", fg, bg);
    }

    // Draw thumb
    const maxOffset = Math.max(1, totalItems - visibleItems);
    const thumbPos = Math.min(height - 1, Math.floor((scrollOffset / maxOffset) * (height - 1)));
    this.buffer.setCell(x, y + thumbPos, "*", Palette.WHITE, bg);
  }

  getVisibleBranches() {
    return this.engine.data.branches.filter((b) => this.engine.state.reveals.branches[b.id]).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getVisibleActivities(branchId) {
    return this.engine.data.activities
      .filter((a) => !branchId || a.branchId === branchId)
      .filter((a) => this.engine.isActivityVisible(a))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getVisibleOptions(activity) {
    if (!activity) return [];
    return (activity.options || []).filter((opt) => this.engine.checkConditions(opt.visibleIf || [])).filter((opt) => this.engine.isOptionUnlocked(opt));
  }

  describeRequirements(req) {
    const staffReqs = req?.staff || [];
    if (staffReqs.length === 0) return "none";
    return staffReqs.map((s) => `${s.count} ${s.roleId}${s.starsMin ? ` ${s.starsMin}+*` : ""}`).join(", ");
  }

  summarizeResolution(resolution) {
    if (!resolution) return "unknown";
    if (resolution.type === "deterministic") return "fixed result";
    if (resolution.type === "ranged_outputs") return "ranged output";
    if (resolution.type === "weighted_outcomes") {
      const topOutcome = resolution.outcomes?.[0];
      return topOutcome ? `weighted: ${topOutcome.id}` : "weighted";
    }
    return "unknown";
  }

  formatMs(ms) {
    if (!ms) return "instant";
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  wrapText(text, width) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    words.forEach((word) => {
      if ((line + word).length > width) {
        lines.push(line.trim());
        line = "";
      }
      line += `${word} `;
    });
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  fmtNum(num) {
    return Math.round(num).toLocaleString();
  }

  // Render crime detail window (fullscreen overlay)
  renderCrimeDetail() {
    const detail = this.ui.crimeDetail;
    if (!detail || !detail.active) return;

    const activity = this.engine.data.activities.find(a => a.id === detail.activityId);
    const option = activity?.options.find(o => o.id === detail.optionId);

    if (!activity || !option) return;

    const bgColor = Palette.BLACK;
    const borderColor = Palette.NEON_CYAN;

    // Start from row 3 to leave top 2 rows visible
    const startY = 3;
    const height = Layout.HEIGHT - startY;

    // Fill overlay area with solid background (start from row 3)
    for (let row = startY; row < Layout.HEIGHT; row++) {
      for (let col = 0; col < Layout.WIDTH; col++) {
        this.buffer.setCell(col, row, " ", Palette.LIGHT_GRAY, bgColor);
      }
    }

    // Draw box with border (start from row 3)
    this.buffer.drawBox(0, startY, Layout.WIDTH, height, BoxStyles.DOUBLE, borderColor, bgColor);

    // Title and Description (compact header)
    const title = `${activity.name.toUpperCase()} - ${option.name.toUpperCase()}`;
    this.buffer.writeText(2, startY + 1, title.substring(0, Layout.WIDTH - 4), Palette.NEON_CYAN, bgColor);

    // Description (2 lines max)
    let y = startY + 2;
    if (activity.description) {
      const descLines = this.wrapText(activity.description, Layout.WIDTH - 6);
      descLines.slice(0, 2).forEach((line, idx) => {
        this.buffer.writeText(2, y + idx, line, Palette.MID_GRAY, bgColor);
      });
      y += 2;
    }

    // Gap
    y += 1;

    // Requirements section
    this.buffer.writeText(2, y, "Requirements:", Palette.NEON_TEAL, bgColor);
    y += 1;

    // Duration
    this.buffer.writeText(4, y, `Duration: ${this.formatMs(option.durationMs)}`, Palette.WHITE, bgColor);
    y += 1;

    // Staff requirements (show all)
    const staffReqs = option.requirements?.staff || [];
    if (staffReqs.length > 0) {
      staffReqs.forEach(req => {
        this.buffer.writeText(4, y, `Crew: ${req.count}x ${req.roleId}`, Palette.WHITE, bgColor);
        y += 1;
      });
    } else {
      this.buffer.writeText(4, y, `Crew: None`, Palette.WHITE, bgColor);
      y += 1;
    }

    // Resource requirements
    if (option.requirements?.resources) {
      Object.entries(option.requirements.resources).forEach(([id, amt]) => {
        this.buffer.writeText(4, y, `Cost: $${amt} ${id}`, Palette.WHITE, bgColor);
        y += 1;
      });
    }

    y += 1;

    // Build selected staff from crew slots
    const selectedStaff = [];
    for (const slot of detail.crewSlots) {
      const staff = slot.options[slot.selectedIndex];
      if (staff) {
        for (let i = 0; i < slot.count; i++) {
          selectedStaff.push(staff);
        }
      }
    }

    // Define left and right columns (50/50 split)
    const leftCol = { x: 2, width: 38 };
    const rightCol = { x: 42, width: 36 };

    // LEFT COLUMN: Outcomes
    let leftY = y;
    if (option.resolution?.type === 'weighted_outcomes') {
      this.buffer.writeText(leftCol.x, leftY, "Outcomes:", Palette.SUCCESS_GREEN, bgColor);
      leftY += 1;

      // Apply modifiers based on selected crew
      const modifiedOutcomes = this.engine.applyModifiers(option, selectedStaff);
      const totalWeight = modifiedOutcomes.reduce((sum, o) => sum + Math.max(0, o.weight), 0);

      modifiedOutcomes.slice(0, 4).forEach((outcome) => {
        const pct = totalWeight > 0 ? Math.round((outcome.weight / totalWeight) * 100) : 0;
        const name = outcome.id || 'Unknown';

        // Color based on outcome type
        let nameColor = Palette.NEON_TEAL;
        let icon = ' ';
        if (name.toLowerCase().includes('success')) {
          nameColor = Palette.SUCCESS_GREEN;
          icon = '✓';
        } else if (name.toLowerCase().includes('botch')) {
          nameColor = Palette.ELECTRIC_ORANGE;
          icon = '!';
        } else if (name.toLowerCase().includes('bust')) {
          nameColor = Palette.HEAT_RED;
          icon = '✗';
        }

        this.buffer.writeText(leftCol.x, leftY, `${icon} ${name}`, nameColor, bgColor);
        this.buffer.writeText(leftCol.x + 16, leftY, `${pct}%`, Palette.WHITE, bgColor);

        // Show outputs in detail (compact)
        const details = [];
        if (outcome.outputs?.resources) {
          Object.entries(outcome.outputs.resources).forEach(([id, amt]) => {
            details.push(`$${amt}`);
          });
        }
        if (outcome.credDelta) {
          details.push(`${outcome.credDelta > 0 ? '+' : ''}${outcome.credDelta}C`);
        }
        if (outcome.heatDelta) {
          details.push(`${outcome.heatDelta > 0 ? '+' : ''}${outcome.heatDelta}H`);
        }

        if (details.length > 0) {
          const detailText = details.join(' ').substring(0, leftCol.width - 20);
          this.buffer.writeText(leftCol.x + 20, leftY, detailText, Palette.MID_GRAY, bgColor);
        }
        leftY += 1;
      });
    }

    // RIGHT COLUMN: Crew slots
    let rightY = y;
    this.buffer.writeText(rightCol.x, rightY, "Crew Selection:", Palette.SUCCESS_GREEN, bgColor);
    rightY += 1;

    if (detail.crewSlots.length === 0) {
      this.buffer.writeText(rightCol.x, rightY, "No crew required", Palette.DIM_GRAY, bgColor);
    } else {
      detail.crewSlots.forEach((slot, idx) => {
        const selected = detail.selectedSlotIndex === idx;
        const prefix = selected ? '>' : ' ';
        const labelColor = selected ? Palette.SUCCESS_GREEN : Palette.NEON_TEAL;

        // Slot label
        const slotLabel = `${prefix} ${slot.count}x ${slot.roleId}:`;
        this.buffer.writeText(rightCol.x, rightY, slotLabel, labelColor, bgColor);
        rightY += 1;

        // Selected crew member
        const staff = slot.options[slot.selectedIndex];
        if (staff) {
          const stars = this.engine.getStars(staff);
          const crewText = stars > 0 ? `${staff.name} (${stars}★)` : staff.name;
          this.buffer.writeText(rightCol.x + 2, rightY, crewText.substring(0, rightCol.width - 4), Palette.WHITE, bgColor);
        } else {
          this.buffer.writeText(rightCol.x + 2, rightY, 'None available', Palette.HEAT_RED, bgColor);
        }
        rightY += 1;

        // Show navigation hint for selected slot
        if (selected && slot.options.length > 1) {
          this.buffer.writeText(rightCol.x + 2, rightY, `[←→] ${slot.selectedIndex + 1}/${slot.options.length}`, Palette.DIM_GRAY, bgColor);
          rightY += 1;
        }
      });
    }

    // Toggle controls section (near bottom)
    const controlsY = Layout.HEIGHT - 6;

    // Only show iteration controls if the option is repeatable
    if (option.repeatable) {
      this.buffer.writeText(2, controlsY, "[I] Iterate:", Palette.NEON_CYAN, bgColor);
      const mode = detail.repeatMode;
      const modeText = mode === 'single' ? 'Single' : mode === 'multi' ? `Multi (${detail.repeatCount})` : 'Infinite';
      this.buffer.writeText(15, controlsY, modeText, Palette.WHITE, bgColor);
      if (mode === 'multi') {
        this.buffer.writeText(15 + modeText.length + 1, controlsY, '[+/-]', Palette.DIM_GRAY, bgColor);
      }

      this.buffer.writeText(2, controlsY + 1, "[P] Policy:", Palette.NEON_CYAN, bgColor);
      const policyText = detail.stopPolicy === 'stopOnFail' ? 'Stop on fail' : 'Retry regardless';
      this.buffer.writeText(15, controlsY + 1, policyText, Palette.WHITE, bgColor);
    }

    // Validation check
    const validation = this.engine.canStartRun(activity.id, option.id);
    if (!validation.ok) {
      this.buffer.writeText(2, Layout.HEIGHT - 4, `! ${validation.reason}`, Palette.HEAT_RED, bgColor);
    }

    // Bottom controls
    this.buffer.drawHLine(2, Layout.HEIGHT - 3, Layout.WIDTH - 4, "─", Palette.DIM_GRAY, bgColor);
    this.buffer.writeText(2, Layout.HEIGHT - 2, "[Q]Quick", Palette.SUCCESS_GREEN, bgColor);
    this.buffer.writeText(14, Layout.HEIGHT - 2, "[ENTER]Start", Palette.SUCCESS_GREEN, bgColor);
    this.buffer.writeText(30, Layout.HEIGHT - 2, "[↑↓←→]Crew", Palette.NEON_CYAN, bgColor);

    // Only show iteration/policy hints if repeatable
    if (option.repeatable) {
      this.buffer.writeText(46, Layout.HEIGHT - 2, "[I]Iterate", Palette.NEON_CYAN, bgColor);
      this.buffer.writeText(60, Layout.HEIGHT - 2, "[P]Policy", Palette.NEON_CYAN, bgColor);
    }

    this.buffer.writeText(Layout.WIDTH - 14, Layout.HEIGHT - 2, "[ESC]Cancel", Palette.DIM_GRAY, bgColor);
  }

  // Render fullscreen modal overlay
  renderModal() {
    const modal = this.ui.modal;
    if (!modal || !modal.active) return;

    const { content, borderStyle, borderColor, backgroundColor } = modal;

    // Parse content into formatted lines
    const contentWidth = Layout.WIDTH - 4; // Leave 2 chars padding on each side
    const parsedLines = parseModalContent(content, contentWidth, backgroundColor);

    // Calculate content area dimensions
    const contentHeight = Layout.HEIGHT - 2; // Top border (1) + bottom border (1)
    const scrollOffset = modal.scroll || 0;

    // Fill entire screen with solid background first
    this.buffer.fill(" ", Palette.LIGHT_GRAY, backgroundColor);

    // Draw fullscreen box with border
    this.buffer.drawBox(0, 0, Layout.WIDTH, Layout.HEIGHT, borderStyle, borderColor, backgroundColor);

    // Draw content area (scrollable) - starts at row 1
    const contentStartY = 1;
    const visibleLines = parsedLines.slice(scrollOffset, scrollOffset + contentHeight);

    visibleLines.forEach((line, idx) => {
      const y = contentStartY + idx;
      let x = 2; // Left padding

      // Render each segment in the line
      line.segments.forEach((segment) => {
        this.buffer.writeText(x, y, segment.text, segment.fg, segment.bg);
        x += segment.text.length;
      });
    });

    // Draw scrollbar if content exceeds visible area
    if (parsedLines.length > contentHeight) {
      this.renderScrollBar(Layout.WIDTH - 2, contentStartY, contentHeight, parsedLines.length, scrollOffset, borderColor, backgroundColor, contentHeight);
    }
  }
}
