import { BoxStyles, Panel } from "./framebuffer.js";
import { Palette } from "./palette.js";

const LAYOUT = {
  status: { x: 0, y: 0, width: 80, height: 2 },
  tabs: { x: 0, y: 2, width: 80, height: 1 },
  mainBox: { x: 0, y: 3, width: 80, height: 22 },
  main: { x: 1, y: 4, width: 78, height: 20 },
};

const TAB_DEFS = [
  { id: "jobs", hotkey: "j" },
  { id: "active", hotkey: "a" },
  { id: "crew", hotkey: "c" },
  { id: "settings", hotkey: "s" },
];

export class UI {
  constructor(buffer, renderer, engine, lexicon, data) {
    this.buffer = buffer;
    this.renderer = renderer;
    this.engine = engine;
    this.lexicon = lexicon;
    this.data = data;

    this.panels = {
      status: new Panel(buffer, LAYOUT.status.x, LAYOUT.status.y, LAYOUT.status.width, LAYOUT.status.height),
      tabs: new Panel(buffer, LAYOUT.tabs.x, LAYOUT.tabs.y, LAYOUT.tabs.width, LAYOUT.tabs.height),
      main: new Panel(buffer, LAYOUT.main.x, LAYOUT.main.y, LAYOUT.main.width, LAYOUT.main.height),
    };

    this.state = {
      activeTab: "jobs",
      jobsView: "list",
      selectedBranchIndex: 0,
      selectedJobIndex: 0,
      selectedOptionIndex: 0,
      selectedRunIndex: 0,
      modal: null,
    };

    this.repeatByOption = {};
    this.settings = this.loadSettings();
    this.applySettings();
  }

  loadSettings() {
    const defaults = { glow: false, gradients: false, fontScale: 1 };
    const raw = localStorage.getItem("ccvibes_new_gpt_settings");
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch (err) {
      return defaults;
    }
  }

  saveSettings() {
    localStorage.setItem("ccvibes_new_gpt_settings", JSON.stringify(this.settings));
  }

  applySettings() {
    document.documentElement.style.setProperty("--font-scale", this.settings.fontScale);
    const screen = document.getElementById("screen");
    if (screen) {
      screen.classList.toggle("glow", !!this.settings.glow);
    }
  }

  renderAll() {
    this.buffer.fill(" ", Palette.LIGHT_GRAY, Palette.BLACK);
    this.renderStatus();
    this.renderTabs();
    this.renderMainFrame();
    this.renderMainContent();
    if (this.state.modal) {
      this.renderModal();
    }
    this.flush();
  }

  updateProgressBars() {
    this.renderStatus();
    this.renderMainContent();
    if (this.state.modal) {
      this.renderModal();
    }
    this.flush();
  }

  flush() {
    this.renderer.renderDirty();
    this.buffer.clearDirtyFlags();
  }

  renderStatus() {
    const panel = this.panels.status;
    panel.clear(" ", Palette.LIGHT_GRAY, Palette.BLACK);
    const state = this.engine.state;
    const cash = formatNumber(state.resources.cash || 0);
    const heat = formatNumber(Math.round((state.resources.heat || 0) * 10) / 10);
    const cred = formatNumber(Math.round(state.resources.cred || 0));
    const dirtyMoney = state.resources.dirtyMoney || 0;
    const dirtyRevealed = state.reveals.resources.dirtyMoney;
    const runs = state.runs.length;
    const time = formatClock(new Date());
    const crewStats = this.getCrewCounts();

    panel.write(0, 0, "CRIME COMMITTER VI", Palette.NEON_CYAN, Palette.BLACK);
    panel.write(25, 0, `${this.lexicon.get("labels.cash")} $${cash}`, Palette.SUCCESS_GREEN, Palette.BLACK);
    panel.write(44, 0, `${this.lexicon.get("labels.heat")} ${heat}`, Palette.HEAT_ORANGE, Palette.BLACK);
    panel.write(60, 0, `${this.lexicon.get("labels.runs")} ${runs}`, Palette.BRIGHT_YELLOW, Palette.BLACK);
    panel.write(70, 0, `${this.lexicon.get("labels.time")} ${time}`, Palette.LIGHT_GRAY, Palette.BLACK);

    panel.write(0, 1, `${this.lexicon.get("labels.cred")} ${cred}`, Palette.LIGHT_GRAY, Palette.BLACK);
    panel.write(18, 1, `${this.lexicon.get("labels.crew")} ${crewStats.available}/${crewStats.total}`, Palette.LIGHT_GRAY, Palette.BLACK);
    if (dirtyRevealed) {
      panel.write(36, 1, `${this.lexicon.get("labels.dirtyMoney")} ${formatNumber(dirtyMoney)}`, Palette.LIGHT_GRAY, Palette.BLACK);
    }
  }

  renderTabs() {
    const panel = this.panels.tabs;
    panel.clear(" ", Palette.LIGHT_GRAY, Palette.BLACK);
    let x = 0;
    for (const tab of TAB_DEFS) {
      const label = this.lexicon.get(`tabs.${tab.id}`) || tab.id.toUpperCase();
      const active = this.state.activeTab === tab.id;
      this.writeHotkeyText(panel, x, 0, label, tab.hotkey, active, Palette.NEON_CYAN, Palette.DIM_GRAY);
      x += label.length + 2;
    }
  }

  renderMainFrame() {
    this.buffer.drawBox(
      LAYOUT.mainBox.x,
      LAYOUT.mainBox.y,
      LAYOUT.mainBox.width,
      LAYOUT.mainBox.height,
      BoxStyles.SINGLE,
      Palette.DIM_GRAY,
      Palette.BLACK
    );
  }

  renderMainContent() {
    const panel = this.panels.main;
    panel.clear(" ", Palette.LIGHT_GRAY, Palette.BLACK);
    if (this.state.activeTab === "jobs") {
      if (this.state.jobsView === "list") {
        this.renderJobsList(panel);
      } else {
        this.renderJobOptions(panel);
      }
      return;
    }
    if (this.state.activeTab === "active") {
      this.renderActiveRuns(panel);
      return;
    }
    if (this.state.activeTab === "crew") {
      this.renderCrew(panel);
      return;
    }
    if (this.state.activeTab === "settings") {
      this.renderSettings(panel);
    }
  }
  renderJobsList(panel) {
    const branches = this.getVisibleBranches();
    if (!branches.length) {
      panel.write(0, 0, "No branches revealed.", Palette.MID_GRAY, Palette.BLACK);
      return;
    }
    this.state.selectedBranchIndex = clampIndex(this.state.selectedBranchIndex, branches.length);
    const branch = branches[this.state.selectedBranchIndex];

    this.renderBranchTabs(panel, branches, branch);

    const activities = this.getVisibleActivities(branch.id);
    const logHeight = 5;
    const descHeight = 3;
    const listStart = 2;
    const listEnd = panel.bounds.height - logHeight - descHeight - 1;
    const listHeight = Math.max(1, listEnd - listStart + 1);
    this.state.selectedJobIndex = clampIndex(this.state.selectedJobIndex, activities.length);

    if (!activities.length) {
      panel.write(0, listStart, "No jobs in this branch.", Palette.MID_GRAY, Palette.BLACK);
    } else {
      const window = getListWindow(activities.length, this.state.selectedJobIndex, listHeight);
      for (let i = 0; i < window.count; i += 1) {
        const idx = window.start + i;
        const activity = activities[idx];
        const prefix = idx === this.state.selectedJobIndex ? ">" : " ";
        const line = `${prefix} ${idx + 1}. ${activity.name}`;
        const color = idx === this.state.selectedJobIndex ? Palette.NEON_CYAN : Palette.LIGHT_GRAY;
        panel.write(0, listStart + i, truncate(line, panel.bounds.width), color, Palette.BLACK);
      }
    }

    const selectedActivity = activities[this.state.selectedJobIndex];
    const descStart = listEnd + 1;
    if (selectedActivity) {
      const descLines = wrapText(selectedActivity.description, panel.bounds.width);
      panel.write(0, descStart, truncate(descLines[0] || "", panel.bounds.width), Palette.MID_GRAY, Palette.BLACK);
      panel.write(0, descStart + 1, truncate(descLines[1] || "", panel.bounds.width), Palette.MID_GRAY, Palette.BLACK);
    }

    this.renderLog(panel, panel.bounds.height - logHeight, logHeight);
  }

  renderJobOptions(panel) {
    const branches = this.getVisibleBranches();
    if (!branches.length) {
      panel.write(0, 0, "No branches revealed.", Palette.MID_GRAY, Palette.BLACK);
      return;
    }
    this.state.selectedBranchIndex = clampIndex(this.state.selectedBranchIndex, branches.length);
    const branch = branches[this.state.selectedBranchIndex];
    this.renderBranchTabs(panel, branches, branch);

    const activities = this.getVisibleActivities(branch.id);
    if (!activities.length) {
      panel.write(0, 2, "No jobs in this branch.", Palette.MID_GRAY, Palette.BLACK);
      return;
    }
    this.state.selectedJobIndex = clampIndex(this.state.selectedJobIndex, activities.length);
    const activity = activities[this.state.selectedJobIndex];
    const options = this.getVisibleOptions(activity);
    this.state.selectedOptionIndex = clampIndex(this.state.selectedOptionIndex, options.length);

    let row = 2;
    panel.write(0, row, activity.name.toUpperCase(), Palette.NEON_CYAN, Palette.BLACK);
    row += 1;
    const descLines = wrapText(activity.description, panel.bounds.width);
    panel.write(0, row, truncate(descLines[0] || "", panel.bounds.width), Palette.MID_GRAY, Palette.BLACK);
    row += 1;
    panel.write(0, row, truncate(descLines[1] || "", panel.bounds.width), Palette.MID_GRAY, Palette.BLACK);
    row += 1;
    panel.write(0, row, "OPTIONS", Palette.BRIGHT_YELLOW, Palette.BLACK);
    row += 1;

    const logHeight = 5;
    const maxContent = panel.bounds.height - logHeight;
    const optionsSpace = Math.max(2, maxContent - row - 6);
    const optionWindow = getListWindow(options.length, this.state.selectedOptionIndex, optionsSpace);

    if (!options.length) {
      panel.write(0, row, "No options available.", Palette.MID_GRAY, Palette.BLACK);
      row += 1;
    } else {
      for (let i = 0; i < optionWindow.count; i += 1) {
        const idx = optionWindow.start + i;
        const option = options[idx];
        const prefix = idx === this.state.selectedOptionIndex ? ">" : " ";
        const duration = formatDuration(option.durationMs);
        const reqs = formatRequirements(option, this.data.roles);
        const locked = !this.engine.areConditionsMet(option.unlockIf);
        const lockText = locked ? " [LOCKED]" : "";
        const line = `${prefix} ${idx + 1}. ${option.name} ${duration} ${reqs}${lockText}`;
        const color = idx === this.state.selectedOptionIndex ? Palette.NEON_CYAN : Palette.LIGHT_GRAY;
        panel.write(0, row + i, truncate(line, panel.bounds.width), color, Palette.BLACK);
      }
      row += optionWindow.count;
    }

    if (options.length) {
      const option = options[this.state.selectedOptionIndex];
      if (option && option.repeatable) {
        const runsLeft = this.getRepeatCount(option.id);
        panel.write(0, row, formatRepeatLine(runsLeft), Palette.MID_GRAY, Palette.BLACK);
        row += 1;
      }
    }

    const runs = this.engine.state.runs.filter((run) => run.activityId === activity.id);
    if (runs.length && row < maxContent) {
      panel.write(0, row, `ACTIVE RUNS (${runs.length})`, Palette.BRIGHT_ORANGE, Palette.BLACK);
      row += 1;
      const availableHeight = maxContent - row;
      this.renderRunBlocks(panel, row, availableHeight, runs, Palette.BRIGHT_ORANGE);
    }

    this.renderLog(panel, panel.bounds.height - logHeight, logHeight);
  }
  renderActiveRuns(panel) {
    const runs = this.engine.state.runs;
    panel.write(0, 0, `ACTIVE RUNS (${runs.length})`, Palette.BRIGHT_YELLOW, Palette.BLACK);
    const logHeight = 5;
    const availableHeight = panel.bounds.height - logHeight - 1;
    if (!runs.length) {
      panel.write(0, 2, this.lexicon.get("errors.no_runs") || "No active runs.", Palette.MID_GRAY, Palette.BLACK);
      this.renderLog(panel, panel.bounds.height - logHeight, logHeight);
      return;
    }
    this.state.selectedRunIndex = clampIndex(this.state.selectedRunIndex, runs.length);
    const window = getListWindow(runs.length, this.state.selectedRunIndex, Math.max(1, Math.floor(availableHeight / 5)));
    const visibleRuns = runs.slice(window.start, window.start + window.count);
    let row = 1;
    for (let i = 0; i < visibleRuns.length; i += 1) {
      const run = visibleRuns[i];
      const selected = window.start + i === this.state.selectedRunIndex;
      const color = selected ? Palette.NEON_CYAN : Palette.BRIGHT_ORANGE;
      const height = this.renderRunBlock(panel, 0, row, run, color, true);
      row += height + 1;
      if (row >= availableHeight) break;
    }
    this.renderLog(panel, panel.bounds.height - logHeight, logHeight);
  }

  renderCrew(panel) {
    const staff = this.engine.state.crew.staff;
    panel.write(0, 0, `CREW (${staff.length})`, Palette.BRIGHT_YELLOW, Palette.BLACK);
    let row = 2;
    for (const member of staff) {
      if (row >= panel.bounds.height - 5) break;
      const role = this.engine.getRoleById(member.roleId);
      const stars = "*".repeat(this.engine.getStaffStars(member));
      const status = this.getStaffStatus(member);
      const statusColor = status === "AVAILABLE" ? Palette.SUCCESS_GREEN : Palette.BRIGHT_ORANGE;
      const line = `${member.name} (${role ? role.name : member.roleId}) ${stars}`;
      panel.write(0, row, truncate(line, panel.bounds.width), Palette.LIGHT_GRAY, Palette.BLACK);
      panel.write(0, row + 1, `Status: ${status}`, statusColor, Palette.BLACK);
      if (member.status === "unavailable" && member.unavailableUntil > Date.now()) {
        panel.write(
          0,
          row + 2,
          `Returns: ${formatClock(new Date(member.unavailableUntil))}`,
          Palette.MID_GRAY,
          Palette.BLACK
        );
        row += 3;
      } else {
        row += 2;
      }
    }
    this.renderLog(panel, panel.bounds.height - 5, 5);
  }

  renderSettings(panel) {
    panel.write(0, 0, "SETTINGS", Palette.BRIGHT_YELLOW, Palette.BLACK);
    panel.write(0, 2, `Glow: ${this.settings.glow ? "ON" : "OFF"} (G)`, Palette.LIGHT_GRAY, Palette.BLACK);
    panel.write(0, 3, `Gradients: ${this.settings.gradients ? "ON" : "OFF"} (T)`, Palette.LIGHT_GRAY, Palette.BLACK);
    panel.write(0, 4, `Font size: ${this.settings.fontScale.toFixed(1)} (+/-)`, Palette.LIGHT_GRAY, Palette.BLACK);
    panel.write(0, 6, "Changes apply immediately.", Palette.MID_GRAY, Palette.BLACK);
    this.renderLog(panel, panel.bounds.height - 5, 5);
  }

  renderBranchTabs(panel, branches, activeBranch) {
    let x = 0;
    for (const branch of branches) {
      const active = branch.id === activeBranch.id;
      const label = branch.name.toUpperCase();
      if (active && this.settings.gradients && branch.ui && branch.ui.gradient) {
        this.buffer.drawGradientText(
          LAYOUT.main.x + x,
          LAYOUT.main.y,
          label,
          branch.ui.gradient,
          Palette.BLACK,
          "left"
        );
      } else {
        const color = active ? Palette[branch.ui.color] || Palette.NEON_CYAN : Palette.DIM_GRAY;
        this.writeHotkeyText(panel, x, 0, label, branch.hotkey, active, color, Palette.DIM_GRAY);
      }
      x += label.length + 2;
    }
  }

  renderLog(panel, startRow, height) {
    if (height < 2) return;
    panel.write(0, startRow, this.lexicon.get("panels.log") || "EVENTS", Palette.MID_GRAY, Palette.BLACK);
    const lines = height - 1;
    const log = this.engine.state.log;
    const start = Math.max(0, log.length - lines);
    for (let i = 0; i < lines; i += 1) {
      const entry = log[start + i];
      if (!entry) continue;
      const time = formatClock(new Date(entry.time));
      const line = `${time} ${entry.message}`;
      panel.write(0, startRow + 1 + i, truncate(line, panel.bounds.width), Palette.MID_GRAY, Palette.BLACK);
    }
  }

  renderRunBlocks(panel, startRow, height, runs, color) {
    let row = startRow;
    for (const run of runs) {
      if (row >= startRow + height) break;
      const blockHeight = this.renderRunBlock(panel, 0, row, run, color, false);
      row += blockHeight + 1;
    }
  }

  renderRunBlock(panel, x, y, run, color, showControls) {
    const activity = this.engine.getActivityById(run.activityId);
    const option = this.engine.getOptionById(run.activityId, run.optionId);
    const nameLine = `${activity ? activity.name : "unknown"} - ${option ? option.name : "unknown"}`;
    const staffNames = run.assignedStaffIds
      .map((id) => this.engine.getStaffById(id))
      .filter(Boolean)
      .map((staff) => staff.name)
      .join(", ");
    const remaining = formatRemaining(run, Date.now());
    const progress = getProgress(run, Date.now());
    const bar = buildProgressBar(progress, 40);
    panel.write(x, y, truncate(nameLine, panel.bounds.width), color, Palette.BLACK);
    panel.write(x, y + 1, truncate(`Staff: ${staffNames || "None"}`, panel.bounds.width), Palette.LIGHT_GRAY, Palette.BLACK);
    panel.write(x, y + 2, truncate(`Remaining: ${remaining}`, panel.bounds.width), Palette.LIGHT_GRAY, Palette.BLACK);
    const controlText = showControls ? " STOP" : "";
    panel.write(x, y + 3, truncate(`[${bar}]${controlText}`, panel.bounds.width), Palette.BRIGHT_ORANGE, Palette.BLACK);
    let height = 4;
    if (run.runsLeft !== 0) {
      const repeatText = run.runsLeft === -1 ? "REPEATING infinite" : `REPEATING (${run.runsLeft} more after this)`;
      panel.write(x, y + 4, truncate(repeatText, panel.bounds.width), Palette.SUCCESS_GREEN, Palette.BLACK);
      height += 1;
    }
    return height;
  }

  renderModal() {
    const modal = this.state.modal;
    if (!modal) return;
    this.buffer.fill(" ", Palette.LIGHT_GRAY, Palette.BLACK);
    this.buffer.drawBox(0, 0, 80, 25, BoxStyles.SINGLE, Palette.NEON_CYAN, Palette.BLACK);
    this.buffer.writeTextCentered(1, "ASSIGN CREW", Palette.NEON_CYAN, Palette.BLACK);
    this.buffer.drawHLine(1, 2, 78, "-", Palette.DIM_GRAY, Palette.BLACK);

    if (modal.type === "crew") {
      this.renderCrewModal(modal);
    }
  }

  renderCrewModal(modal) {
    const activity = this.engine.getActivityById(modal.activityId);
    const option = this.engine.getOptionById(modal.activityId, modal.optionId);
    let row = 4;
    this.buffer.writeText(2, row, `${activity.name} - ${option.name}`, Palette.LIGHT_GRAY, Palette.BLACK);
    row += 2;
    for (let i = 0; i < modal.slots.length; i += 1) {
      const slot = modal.slots[i];
      const role = this.engine.getRoleById(slot.roleId);
      const requiredMark = slot.required ? "*" : " ";
      const selectedId = modal.selections[i] || null;
      const selectedStaff = selectedId ? this.engine.getStaffById(selectedId) : null;
      const name = selectedStaff ? selectedStaff.name : "NONE";
      const stars = selectedStaff ? "*".repeat(this.engine.getStaffStars(selectedStaff)) : "";
      const cursor = modal.cursor === i ? ">" : " ";
      const line = `${cursor} ${i + 1}. ${requiredMark} ${role ? role.name : slot.roleId} ${name} ${stars}`;
      this.buffer.writeText(2, row + i, truncate(line, 74), Palette.LIGHT_GRAY, Palette.BLACK);
    }
    const confirmRow = modal.slots.length + 2;
    const cancelRow = modal.slots.length + 3;
    const canConfirm = this.canConfirmModal(modal);
    const confirmCursor = modal.cursor === modal.slots.length ? ">" : " ";
    const cancelCursor = modal.cursor === modal.slots.length + 1 ? ">" : " ";
    this.buffer.writeText(2, row + confirmRow, `${confirmCursor} CONFIRM`, canConfirm ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY, Palette.BLACK);
    this.buffer.writeText(2, row + cancelRow, `${cancelCursor} CANCEL`, Palette.BRIGHT_ORANGE, Palette.BLACK);
    this.buffer.writeText(2, 22, "Arrows: move  Left/Right: cycle  Enter: select", Palette.MID_GRAY, Palette.BLACK);
  }
  handleKey(event) {
    if (this.state.modal) {
      this.handleModalKey(event);
      return;
    }
    const key = event.key.toLowerCase();
    if (TAB_DEFS.some((tab) => tab.hotkey === key)) {
      this.state.activeTab = TAB_DEFS.find((tab) => tab.hotkey === key).id;
      this.state.selectedRunIndex = 0;
      this.renderAll();
      return;
    }
    if (this.state.activeTab === "jobs") {
      this.handleJobsKey(event);
      return;
    }
    if (this.state.activeTab === "active") {
      this.handleActiveKey(event);
      return;
    }
    if (this.state.activeTab === "settings") {
      this.handleSettingsKey(event);
      return;
    }
  }

  handleJobsKey(event) {
    const key = event.key;
    const branches = this.getVisibleBranches();
    if (!branches.length) return;
    const branch = branches[this.state.selectedBranchIndex];
    const activities = this.getVisibleActivities(branch.id);

    if (this.state.jobsView === "list") {
      if (key === "ArrowUp") {
        this.state.selectedJobIndex = Math.max(0, this.state.selectedJobIndex - 1);
        this.renderAll();
        return;
      }
      if (key === "ArrowDown") {
        this.state.selectedJobIndex = Math.min(activities.length - 1, this.state.selectedJobIndex + 1);
        this.renderAll();
        return;
      }
      if (key === "ArrowLeft") {
        this.state.selectedBranchIndex = Math.max(0, this.state.selectedBranchIndex - 1);
        this.state.selectedJobIndex = 0;
        this.renderAll();
        return;
      }
      if (key === "ArrowRight") {
        this.state.selectedBranchIndex = Math.min(branches.length - 1, this.state.selectedBranchIndex + 1);
        this.state.selectedJobIndex = 0;
        this.renderAll();
        return;
      }
      if (key >= "1" && key <= "9") {
        const idx = Number(key) - 1;
        if (idx < activities.length) {
          this.state.selectedJobIndex = idx;
          this.state.jobsView = "options";
          this.state.selectedOptionIndex = 0;
          this.renderAll();
        }
        return;
      }
      if (key === "Enter") {
        if (activities.length) {
          this.state.jobsView = "options";
          this.state.selectedOptionIndex = 0;
          this.renderAll();
        }
        return;
      }
      const hotkeyBranch = branches.find((b) => b.hotkey.toLowerCase() === key);
      if (hotkeyBranch) {
        this.state.selectedBranchIndex = branches.indexOf(hotkeyBranch);
        this.state.selectedJobIndex = 0;
        this.renderAll();
      }
      return;
    }

    if (key === "Backspace") {
      this.state.jobsView = "list";
      this.renderAll();
      return;
    }

    const options = this.getVisibleOptions(activities[this.state.selectedJobIndex]);
    if (key === "ArrowUp") {
      this.state.selectedOptionIndex = Math.max(0, this.state.selectedOptionIndex - 1);
      this.renderAll();
      return;
    }
    if (key === "ArrowDown") {
      this.state.selectedOptionIndex = Math.min(options.length - 1, this.state.selectedOptionIndex + 1);
      this.renderAll();
      return;
    }
    if (key === "+" || key === "=") {
      this.adjustRepeatCount(options[this.state.selectedOptionIndex], 1);
      this.renderAll();
      return;
    }
    if (key === "-" || key === "_") {
      this.adjustRepeatCount(options[this.state.selectedOptionIndex], -1);
      this.renderAll();
      return;
    }
    if (key.toLowerCase() === "r") {
      this.toggleRepeatInfinite(options[this.state.selectedOptionIndex]);
      this.renderAll();
      return;
    }
    if (key >= "1" && key <= "9") {
      const idx = Number(key) - 1;
      if (idx < options.length) {
        this.state.selectedOptionIndex = idx;
        this.openCrewModal(activities[this.state.selectedJobIndex], options[idx]);
      }
      return;
    }
    if (key === "Enter") {
      const option = options[this.state.selectedOptionIndex];
      if (option) {
        this.openCrewModal(activities[this.state.selectedJobIndex], option);
      }
    }
  }

  handleActiveKey(event) {
    const runs = this.engine.state.runs;
    const key = event.key;
    if (key === "ArrowUp") {
      this.state.selectedRunIndex = Math.max(0, this.state.selectedRunIndex - 1);
      this.renderAll();
      return;
    }
    if (key === "ArrowDown") {
      this.state.selectedRunIndex = Math.min(runs.length - 1, this.state.selectedRunIndex + 1);
      this.renderAll();
      return;
    }
    if (key.toLowerCase() === "x") {
      const run = runs[this.state.selectedRunIndex];
      if (run) this.engine.cancelRun(run.runId);
      return;
    }
    if (key.toLowerCase() === "r") {
      const run = runs[this.state.selectedRunIndex];
      if (run) this.engine.stopRepeat(run.runId);
    }
  }

  handleSettingsKey(event) {
    const key = event.key.toLowerCase();
    if (key === "g") {
      this.settings.glow = !this.settings.glow;
      this.applySettings();
      this.saveSettings();
      this.renderAll();
      return;
    }
    if (key === "t") {
      this.settings.gradients = !this.settings.gradients;
      this.saveSettings();
      this.renderAll();
      return;
    }
    if (key === "+" || key === "=") {
      this.settings.fontScale = Math.min(1.6, this.settings.fontScale + 0.1);
      this.applySettings();
      this.saveSettings();
      this.renderAll();
      return;
    }
    if (key === "-" || key === "_") {
      this.settings.fontScale = Math.max(0.8, this.settings.fontScale - 0.1);
      this.applySettings();
      this.saveSettings();
      this.renderAll();
    }
  }

  handleModalKey(event) {
    const modal = this.state.modal;
    if (!modal || modal.type !== "crew") return;
    const key = event.key;
    const maxCursor = modal.slots.length + 1;
    if (key === "Escape" || key === "Backspace") {
      this.state.modal = null;
      this.renderAll();
      return;
    }
    if (key === "ArrowUp") {
      modal.cursor = Math.max(0, modal.cursor - 1);
      this.renderAll();
      return;
    }
    if (key === "ArrowDown") {
      modal.cursor = Math.min(maxCursor, modal.cursor + 1);
      this.renderAll();
      return;
    }
    if (key === "ArrowLeft") {
      this.cycleCrewSelection(modal, modal.cursor, -1);
      this.renderAll();
      return;
    }
    if (key === "ArrowRight") {
      this.cycleCrewSelection(modal, modal.cursor, 1);
      this.renderAll();
      return;
    }
    if (key === "Enter") {
      if (modal.cursor < modal.slots.length) {
        this.cycleCrewSelection(modal, modal.cursor, 1);
        this.renderAll();
        return;
      }
      if (modal.cursor === modal.slots.length) {
        if (this.confirmModal(modal)) {
          this.state.modal = null;
          this.renderAll();
        }
      }
      if (modal.cursor === modal.slots.length + 1) {
        this.state.modal = null;
        this.renderAll();
      }
    }
  }

  openCrewModal(activity, option) {
    const slots = [];
    for (const req of option.requirements.staff || []) {
      for (let i = 0; i < req.count; i += 1) {
        slots.push({
          roleId: req.roleId,
          required: req.required !== false,
          starsMin: req.starsMin || 0,
        });
      }
    }
    const modal = {
      type: "crew",
      activityId: activity.id,
      optionId: option.id,
      slots,
      selections: {},
      cursor: 0,
      runsLeft: this.getRepeatCount(option.id),
    };
    this.state.modal = modal;
    this.renderAll();
  }

  cycleCrewSelection(modal, slotIndex, direction) {
    if (slotIndex >= modal.slots.length) return;
    const slot = modal.slots[slotIndex];
    const eligible = this.getEligibleCrew(slot);
    const current = modal.selections[slotIndex] || null;
    const filtered = eligible.filter((id) => !this.isCrewSelectedElsewhere(modal, id, slotIndex));
    const choices = slot.required ? filtered : [null, ...filtered];
    if (!choices.length) return;
    const currentIndex = choices.indexOf(current);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + choices.length) % choices.length;
    modal.selections[slotIndex] = choices[nextIndex];
  }

  getEligibleCrew(slot) {
    const staff = this.engine.state.crew.staff;
    return staff
      .filter((member) => member.roleId === slot.roleId)
      .filter((member) => this.engine.isStaffAvailable(member.id))
      .filter((member) => this.engine.getStaffStars(member) >= slot.starsMin)
      .map((member) => member.id);
  }

  isCrewSelectedElsewhere(modal, staffId, currentSlot) {
    for (const [index, value] of Object.entries(modal.selections)) {
      if (Number(index) !== currentSlot && value === staffId) return true;
    }
    return false;
  }

  canConfirmModal(modal) {
    for (let i = 0; i < modal.slots.length; i += 1) {
      const slot = modal.slots[i];
      if (slot.required && !modal.selections[i]) return false;
    }
    return true;
  }

  confirmModal(modal) {
    if (!this.canConfirmModal(modal)) return false;
    const selected = [];
    for (let i = 0; i < modal.slots.length; i += 1) {
      const staffId = modal.selections[i];
      if (staffId) selected.push(staffId);
    }
    const result = this.engine.startRun(
      modal.activityId,
      modal.optionId,
      selected,
      null,
      modal.runsLeft
    );
    if (!result.ok) {
      this.engine.addLog(result.error, "warn");
      return false;
    }
    return true;
  }
  adjustRepeatCount(option, delta) {
    if (!option || !option.repeatable) return;
    const current = this.getRepeatCount(option.id);
    if (current === -1) {
      this.repeatByOption[option.id] = 0;
      return;
    }
    const next = clampNumber(current + delta, 0, 9);
    this.repeatByOption[option.id] = next;
  }

  toggleRepeatInfinite(option) {
    if (!option || !option.repeatable) return;
    const current = this.getRepeatCount(option.id);
    this.repeatByOption[option.id] = current === -1 ? 0 : -1;
  }

  getRepeatCount(optionId) {
    if (this.repeatByOption[optionId] === undefined) {
      this.repeatByOption[optionId] = 0;
    }
    return this.repeatByOption[optionId];
  }

  getVisibleBranches() {
    return this.data.branches
      .filter((branch) => this.engine.state.reveals.branches[branch.id])
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getVisibleActivities(branchId) {
    return this.data.activities.filter((activity) => {
      if (activity.branchId !== branchId) return false;
      if (!this.engine.state.reveals.activities[activity.id]) return false;
      return this.engine.areConditionsMet(activity.visibleIf);
    });
  }

  getVisibleOptions(activity) {
    if (!activity) return [];
    return activity.options.filter((option) => this.engine.areConditionsMet(option.visibleIf));
  }

  getCrewCounts() {
    const total = this.engine.state.crew.staff.length;
    const available = this.engine.state.crew.staff.filter((staff) => this.engine.isStaffAvailable(staff.id)).length;
    return { total, available };
  }

  getStaffStatus(member) {
    if (member.status === "unavailable" && member.unavailableUntil > Date.now()) {
      return this.lexicon.get("status.unavailable") || "UNAVAILABLE";
    }
    if (member.status === "busy") {
      return this.lexicon.get("status.busy") || "BUSY";
    }
    return this.lexicon.get("status.available") || "AVAILABLE";
  }

  writeHotkeyText(panel, x, y, text, hotkey, active, activeColor, inactiveColor) {
    const target = text.toLowerCase();
    const hot = hotkey.toLowerCase();
    const idx = target.indexOf(hot);
    for (let i = 0; i < text.length; i += 1) {
      let color = active ? activeColor : inactiveColor;
      if (!active && i === idx) color = Palette.NEON_CYAN;
      panel.setCell(x + i, y, text[i], color, Palette.BLACK);
    }
  }
}

function formatRequirements(option, roles) {
  const staffReqs = option.requirements?.staff || [];
  if (!staffReqs.length) return "crew none";
  const parts = staffReqs.map((req) => {
    const role = roles.find((entry) => entry.id === req.roleId);
    const name = role ? role.name : req.roleId;
    return `${name}x${req.count}`;
  });
  return `crew ${parts.join(",")}`;
}

function formatRepeatLine(runsLeft) {
  if (runsLeft === -1) return "Repeat: infinite";
  if (runsLeft === 0) return "Repeat: single";
  return `Repeat: ${runsLeft} more`;
}

function buildProgressBar(progress, width) {
  const fill = Math.round(progress * width);
  let bar = "";
  for (let i = 0; i < width; i += 1) {
    bar += i < fill ? "#" : "-";
  }
  return bar;
}

function formatRemaining(run, now) {
  const remainingMs = Math.max(0, run.endsAt - now);
  const duration = formatDuration(remainingMs);
  if (remainingMs >= 3600000) {
    const finish = formatClock(new Date(run.endsAt));
    return `${duration} (finishes at ${finish})`;
  }
  return duration;
}

function formatDuration(ms) {
  if (ms >= 86400000) {
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    return `${days}d ${hours}h`;
  }
  if (ms >= 3600000) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
  if (ms >= 60000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatClock(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function truncate(text, width) {
  if (!text) return "";
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return text.slice(0, width - 3) + "...";
}

function wrapText(text, width) {
  if (!text) return [""];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function getProgress(run, now) {
  const total = Math.max(1, run.endsAt - run.startedAt);
  const elapsed = Math.min(total, now - run.startedAt);
  return clampNumber(elapsed / total, 0, 1);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function getListWindow(total, selectedIndex, maxVisible) {
  const count = Math.min(total, maxVisible);
  const half = Math.floor(count / 2);
  let start = Math.max(0, selectedIndex - half);
  if (start + count > total) start = Math.max(0, total - count);
  return { start, count };
}

function clampIndex(index, length) {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
