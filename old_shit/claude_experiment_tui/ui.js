/**

 * UI Layer - Handles all rendering and user interaction

 */

const UI = {

  currentBranch: "all",

  selectedActivity: null,

  view: "list", // list | detail

  fontSubmenuExpanded: false,

  repeatSelections: {}, // key: activityId:optionId -> { mode, count }

  // Settings

  settings: {

    fontId: 'default',

    glowEnabled: true

  },

  fontOptions: [

    { id: 'default', label: 'Default Mono', fontFamily: '"IBM Plex Mono", "JetBrains Mono", "Cascadia Mono", "Consolas", monospace' },

    { id: 'vga_8x14', label: 'IBM VGA 8x14', fontFamily: '"AcPlus_IBM_VGA_8x14", "IBM Plex Mono", monospace' },

    { id: 'vga_8x16', label: 'IBM VGA 8x16', fontFamily: '"AcPlus_IBM_VGA_8x16", "IBM Plex Mono", monospace' },

    { id: 'vga_9x14', label: 'IBM VGA 9x14', fontFamily: '"AcPlus_IBM_VGA_9x14", "IBM Plex Mono", monospace' },

    { id: 'vga_9x16', label: 'IBM VGA 9x16', fontFamily: '"AcPlus_IBM_VGA_9x16", "IBM Plex Mono", monospace' },

    { id: 'vga_9x8', label: 'IBM VGA 9x8', fontFamily: '"AcPlus_IBM_VGA_9x8", "IBM Plex Mono", monospace' }

  ],

  init() {

    this.loadSettings();

    this.applySettings();

    this.setupTabs();

    this.setupEventListeners();

    this.setupEngineEventListeners();

    this.setupKeyboardNavigation();

  },

  loadSettings() {

    try {

      const saved = localStorage.getItem('ccvi_settings');

      if (saved) {

        this.settings = { ...this.settings, ...JSON.parse(saved) };

      }

    } catch (err) {

      console.error("Failed to load settings", err);

    }

  },

  saveSettings() {

    try {

      localStorage.setItem('ccvi_settings', JSON.stringify(this.settings));

    } catch (err) {

      console.error("Failed to save settings", err);

    }

  },

  applySettings() {

    // Apply font to entire terminal

    const font = this.fontOptions.find(f => f.id === this.settings.fontId) || this.fontOptions[0];

    const terminal = document.getElementById('terminal');

    if (terminal) {

      terminal.style.fontFamily = font.fontFamily;

    } else {

      document.body.style.fontFamily = font.fontFamily;

    }

    // Apply glow

    if (this.settings.glowEnabled) {

      document.body.classList.remove('no-glow');

    } else {

      document.body.classList.add('no-glow');

    }

  },

  setFont(fontId) {

    this.settings.fontId = fontId;

    this.saveSettings();

    this.applySettings();

    this.renderSettings();

  },

  toggleGlow() {

    this.settings.glowEnabled = !this.settings.glowEnabled;

    this.saveSettings();

    this.applySettings();

    this.renderSettings();

  },

  resetGame() {

    if (confirm("Reset all game progress? This cannot be undone.")) {

      // Clear all saved data

      localStorage.removeItem('ccvi_save');

      localStorage.removeItem('ccvi_settings');

      // Reset engine state

      Engine.state = Engine.createDefaultState();

      // Force a full re-render

      this.renderAll();

      // Also reload to ensure clean slate

      setTimeout(() => location.reload(), 100);

    }

  },

  setupTabs() {

    const tabs = document.querySelectorAll(".nav-tab");

    const panels = document.querySelectorAll(".tab-panel");

    tabs.forEach(tab => {

      tab.addEventListener("click", () => {

        tabs.forEach(t => t.classList.remove("active"));

        panels.forEach(p => p.classList.remove("active"));

        tab.classList.add("active");

        const targetId = `tab-${tab.dataset.tab}`;

        const target = document.getElementById(targetId);

        if (target) {

          target.classList.add("active");

          // Render settings when opening that tab

          if (tab.dataset.tab === "settings") {

            this.renderSettings();

          }

        }

      });

    });

  },

  setupEventListeners() {

    document.addEventListener("click", (e) => {

      const target = e.target.closest("[data-action]");

      if (!target) return;

      const action = target.dataset.action;

      const id = target.dataset.id;

      if (action === "set-branch") {

        this.setBranch(id);

      }

      else if (action === "view-activity") {

        this.viewActivity(id);

      }

      else if (action === "back-to-list") {

        this.backToList();

      }

      else if (action === "start-run") {

        const activityId = target.dataset.activityId;

        const optionId = target.dataset.optionId;

        this.startRun(activityId, optionId);

      }

      else if (action === "cancel-run") {

        const runId = target.dataset.runId;

        this.cancelRun(runId);

      }

      else if (action === "repeat-run") {
        const activityId = target.dataset.activityId;
        const optionId = target.dataset.optionId;
        const count = parseInt(target.dataset.count) || 1;
        Engine.startRun(activityId, optionId, null, null, count);
        // Event system handles UI update via 'stateChange' event
      }

      else if (action === "repeat-infinite") {

        const activityId = target.dataset.activityId;

        const optionId = target.dataset.optionId;

        Engine.startRun(activityId, optionId, null, null, -1);
        // Event system handles UI update via 'stateChange' event

      }

      else if (action === "stop-repeat-request") {
        const runId = target.dataset.runId;
        target.dataset.action = "stop-repeat-confirm";
        target.dataset.runId = runId;
        target.textContent = "CONFIRM STOP?";
        target.classList.add("btn-stop-confirm");
      }

      else if (action === "stop-repeat-confirm") {
        const runId = target.dataset.runId;
        Engine.stopRepeat(runId);
        // Event system handles UI update via 'stateChange' event
      }

      else if (action === "set-font") {

        this.setFont(id);

      }

      else if (action === "toggle-glow") {

        this.toggleGlow();

      }

      else if (action === "toggle-font-submenu") {

        this.fontSubmenuExpanded = !this.fontSubmenuExpanded;

        this.renderSettings();

      }

      else if (action === "add-random-crew") {

        Engine.addRandomCrew();

        // Event system handles UI update via 'stateChange' event

      }

      else if (action === "reset-game") {

        this.resetGame();

      }

    });

  },

  setupEngineEventListeners() {

    // Subscribe to Engine events for automatic UI updates

    // State changed - full re-render (but only when state actually changes)

    Engine.on('stateChange', () => {

      this.renderAll();

    });

    // Tick - update progress bars and time remaining

    Engine.on('tick', () => {

      this.updateProgressBars();

    });

    // Runs completed - full re-render needed

    Engine.on('runsCompleted', () => {

      this.renderAll();

    });

    // Log entries - could be used for notifications in the future

    Engine.on('log', () => {

      // Currently log is rendered on demand, but we could add a mini-log here

    });

  },

  updateProgressBars() {
    // Efficiently update progress bars and remaining time without full re-render
    // This is called every tick for smooth animations
    const now = Engine.state.now;

    // Update progress bars in both crew tab and activity detail
    Engine.state.runs.forEach(run => {
      const elapsed = now - run.startedAt;
      const total = run.endsAt - run.startedAt;
      const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
      const remaining = Math.max(0, run.endsAt - now);

      // Update text-based progress bar
      const progressBar = document.querySelector(`[data-run-id="${run.runId}"] .progress-bar`);
      if (progressBar) {
        const filled = Math.floor((progress / 100) * 40);
        const emptyChars = 40 - filled;
        const barText = `[${'#'.repeat(filled)}${'-'.repeat(emptyChars)}]`;
        progressBar.textContent = barText;
      }

      // Update remaining time text
      const remainingLine = document.querySelector(`[data-run-id="${run.runId}"] .run-remaining`);
      if (remainingLine) {
        let timeText = `Remaining: ${this.formatDuration(remaining)}`;
        if (remaining > 3600000) {
          const finishTime = new Date(run.endsAt);
          const hours = finishTime.getHours();
          const minutes = finishTime.getMinutes();
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          timeText += ` (finishes at ${timeString})`;
        }
        remainingLine.textContent = timeText;
      }
    });
  },

  setBranch(branchId) {

    this.currentBranch = branchId;

    this.view = "list";

    this.selectedActivity = null;

    this.renderActivities();

  },

  viewActivity(activityId) {

    this.selectedActivity = activityId;

    this.view = "detail";

    this.renderActivities();

  },

  backToList() {

    this.view = "list";

    this.selectedActivity = null;

    this.renderActivities();

  },

  startRun(activityId, optionId) {

    // Find first available staff

    const availableStaff = Engine.state.crew.staff.filter(s => s.status === "available");

    if (availableStaff.length === 0) {

      Engine.addLog("No available crew members", "warn");

      this.renderAll();

      return;

    }

    const result = Engine.startRun(activityId, optionId, [availableStaff[0].id]);

    if (!result.ok) {

      Engine.addLog(result.reason, "warn");

    }

    this.renderAll();

  },

  cancelRun(runId) {

    const result = Engine.cancelRun(runId);

    if (!result.ok) {

      Engine.addLog(result.reason, "warn");

    }

    this.renderAll();

  },

  renderAll() {

    this.renderStats();

    this.renderActivities();

    this.renderStaff();

    this.renderRuns();

    this.renderResources();

    this.renderSettings();

    this.renderLog();

  },

  renderStats() {

    const cash = document.getElementById("stat-cash");

    const heat = document.getElementById("stat-heat");

    const crew = document.getElementById("stat-crew");

    const runs = document.getElementById("stat-runs");

    if (cash) cash.textContent = `$${this.formatNumber(Engine.state.resources.cash || 0)}`;

    if (heat) heat.textContent = `${this.formatNumber(Engine.state.resources.heat || 0)}`;

    if (crew) crew.textContent = `${Engine.state.crew.staff.length}`;

    if (runs) runs.textContent = `${Engine.state.runs.length}`;

  },

  renderActivities() {

    const branchSelector = document.getElementById("branch-selector");

    const listContainer = document.getElementById("activity-list");

    const detailContainer = document.getElementById("activity-detail");

    // Render branch tabs

    if (branchSelector) {

      branchSelector.innerHTML = "";

      const branches = [{ id: "all", name: "ALL" }, ...Engine.content.branches];

      branches.forEach(branch => {

        const tab = document.createElement("button");

        tab.className = "branch-tab";

        tab.dataset.action = "set-branch";

        tab.dataset.id = branch.id;

        tab.textContent = branch.name.toUpperCase();

        if (branch.id === this.currentBranch) {

          tab.classList.add("active");

        }

        branchSelector.appendChild(tab);

      });

    }

    // Show/hide views

    if (this.view === "list") {

      listContainer.style.display = "flex";

      detailContainer.style.display = "none";

      this.renderActivityList(listContainer);

    } else {

      listContainer.style.display = "none";

      detailContainer.style.display = "block";

      this.renderActivityDetail(detailContainer);

    }

  },

  renderActivityList(container) {

    container.innerHTML = "";

    let activities = Engine.content.activities;

    // Filter by branch

    if (this.currentBranch !== "all") {

      activities = activities.filter(a => a.branchId === this.currentBranch);

    }

    // Filter by visibility

    activities = activities.filter(a => {

      if (!a.visibleIf || a.visibleIf.length === 0) return true;

      return Engine.checkConditions(a.visibleIf);

    });

    if (activities.length === 0) {

      const empty = document.createElement("div");

      empty.className = "empty-state";

      empty.textContent = "No operations available in this branch.";

      container.appendChild(empty);

      return;

    }

    activities.forEach(activity => {

      const item = document.createElement("div");

      item.className = "activity-item";

      item.dataset.action = "view-activity";

      item.dataset.id = activity.id;

      item.tabIndex = 0;

      const name = document.createElement("div");

      name.className = "activity-name";

      name.textContent = activity.name;

      const meta = document.createElement("div");

      meta.className = "activity-meta";

      const metaParts = [];

      metaParts.push(`BRANCH: ${activity.branchId || "unknown"}`.toUpperCase());

      metaParts.push(`OPTIONS: ${activity.options.length}`);

      const unlocked = !activity.unlockIf || Engine.checkConditions(activity.unlockIf);

      metaParts.push(unlocked ? "[UNLOCKED]" : "[LOCKED]");

      meta.textContent = metaParts.join(" │ ");

      item.appendChild(name);

      item.appendChild(meta);

      if (activity.description) {

        const desc = document.createElement("div");

        desc.className = "activity-desc";

        desc.textContent = activity.description;

        item.appendChild(desc);

      }

      container.appendChild(item);

    });

  },

  renderActivityDetail(container) {

    container.innerHTML = "";

    if (!this.selectedActivity) {

      container.textContent = "No activity selected.";

      return;

    }

    const activity = Engine.content.activities.find(a => a.id === this.selectedActivity);

    if (!activity) {

      container.textContent = "Activity not found.";

      return;

    }

    // Header

    const header = document.createElement("div");

    header.className = "detail-header";

    const name = document.createElement("div");

    name.className = "activity-name";

    name.textContent = activity.name;

    const meta = document.createElement("div");

    meta.className = "activity-meta";

    meta.textContent = `BRANCH: ${(activity.branchId || "unknown").toUpperCase()} │ OPTIONS: ${activity.options.length}`;

    header.appendChild(name);

    header.appendChild(meta);

    if (activity.description) {

      const desc = document.createElement("div");

      desc.className = "activity-desc";

      desc.textContent = activity.description;

      header.appendChild(desc);

    }

    const actions = document.createElement("div");

    actions.className = "detail-actions";

    const backBtn = document.createElement("button");

    backBtn.className = "btn btn-secondary";

    backBtn.dataset.action = "back-to-list";

    backBtn.textContent = "← BACK";

    actions.appendChild(backBtn);

    header.appendChild(actions);

    container.appendChild(header);

    // Options

    const optionsSection = document.createElement("div");

    optionsSection.className = "options-section";

    activity.options.forEach(option => {

      const card = document.createElement("div");

      card.className = "option-card";

      const optHeader = document.createElement("div");

      optHeader.className = "option-header";

      const optMain = document.createElement("div");

      const optName = document.createElement("div");

      optName.className = "option-name";

      optName.textContent = option.name;

      const optMeta = document.createElement("div");

      optMeta.className = "option-meta";

      const metaParts = [];

      metaParts.push(`⏱ ${this.formatDuration(option.durationMs)}`);

      if (option.resolution) {

        if (option.resolution.type === "deterministic" && option.resolution.outputs && option.resolution.outputs.resources) {

          const cash = option.resolution.outputs.resources.cash;

          if (cash) metaParts.push(`$${this.formatNumber(cash)}`);

        }

        else if (option.resolution.type === "ranged_outputs" && option.resolution.outputs && option.resolution.outputs.resources) {

          const cash = option.resolution.outputs.resources.cash;

          if (cash && cash.min !== undefined) metaParts.push(`$${this.formatNumber(cash.min)}-${this.formatNumber(cash.max)}`);

        }

        else if (option.resolution.type === "weighted_outcomes" && option.resolution.outcomes) {

          // Show range across all outcomes

          const cashAmounts = option.resolution.outcomes

            .map(o => o.outputs?.resources?.cash || 0)

            .filter(c => c > 0);

          if (cashAmounts.length > 0) {

            const min = Math.min(...cashAmounts);

            const max = Math.max(...cashAmounts);

            if (min === max) {

              metaParts.push(`$${this.formatNumber(min)}`);

            } else {

              metaParts.push(`$${this.formatNumber(min)}-${this.formatNumber(max)}`);

            }

          }

        }

      }

      optMeta.textContent = metaParts.join(" │ ");

      optMain.appendChild(optName);

      optMain.appendChild(optMeta);

      optHeader.appendChild(optMain);

      card.appendChild(optHeader);

      if (option.description) {

        const optBody = document.createElement("div");

        optBody.className = "option-body";

        optBody.textContent = option.description;

        card.appendChild(optBody);

      }

      // Footer with requirements and button

      const footer = document.createElement("div");

      footer.className = "option-footer";

      const requirements = document.createElement("div");

      requirements.className = "option-requirements";

      const reqParts = [];

      if (option.requirements && option.requirements.staff) {

        option.requirements.staff.forEach(req => {

          const starsText = req.starsMin ? ` (${req.starsMin}★)` : "";

          reqParts.push(`${req.count}x ${req.roleId}${starsText}`);

        });

      }

      if (option.inputs && option.inputs.resources) {

        Object.entries(option.inputs.resources).forEach(([res, amt]) => {

          reqParts.push(`-${amt} ${res}`);

        });

      }

      requirements.textContent = reqParts.length ? `REQ: ${reqParts.join(", ")}` : "No requirements";

      const startBtn = document.createElement("button");

      startBtn.className = "btn";

      startBtn.dataset.action = "start-run";

      startBtn.dataset.activityId = activity.id;

      startBtn.dataset.optionId = option.id;

      startBtn.textContent = "[ START ]";

      // Check if can start - comprehensive validation

      const visible = !option.visibleIf || Engine.checkConditions(option.visibleIf);

      const unlocked = !option.unlockIf || Engine.checkConditions(option.unlockIf);

      let canStart = visible && unlocked;

      let reason = "";

      if (canStart) {

        // Check staff requirements

        const availableStaff = Engine.state.crew.staff.filter(s => s.status === "available");

        if (availableStaff.length === 0) {

          canStart = false;

          reason = "No crew available";

        } else if (option.requirements && option.requirements.staff) {

          const reqCheck = Engine.checkRequirements(option.requirements, [availableStaff[0].id]);

          if (!reqCheck.ok) {

            canStart = false;

            reason = reqCheck.reason;

          }

        }

        // Check input resources

        if (canStart && option.inputs) {

          const inputCheck = Engine.checkInputs(option.inputs);

          if (!inputCheck.ok) {

            canStart = false;

            reason = inputCheck.reason;

          }

        }

      } else if (!visible) {

        reason = "Hidden";

      } else if (!unlocked) {

        reason = "Locked";

      }

      if (!canStart) {

        startBtn.disabled = true;

        startBtn.classList.add("btn-disabled");

        if (reason) {

          startBtn.title = reason;

        }

      }

      footer.appendChild(requirements);

      // Count active runs for this specific option

      const activeRunCount = Engine.state.runs.filter(r => r.activityId === activity.id && r.optionId === option.id).length;

      // Check concurrency limit (default: unlimited if not specified)

      const maxConcurrent = option.maxConcurrentRuns !== undefined ? option.maxConcurrentRuns : Infinity;

      const canStartNewRun = activeRunCount < maxConcurrent;

      // Add reason text if disabled due to requirements

      if (reason) {

        const reasonText = document.createElement("div");

        reasonText.className = "option-status";

        reasonText.textContent = reason;

        footer.appendChild(reasonText);

      }

      // Add concurrency limit warning if at limit but otherwise ready

      if (!reason && !canStartNewRun && maxConcurrent !== Infinity) {

        const limitText = document.createElement("div");

        limitText.className = "option-status";

        limitText.style.color = "var(--warning)";

        limitText.textContent = `Concurrency limit reached (${activeRunCount}/${maxConcurrent})`;

        footer.appendChild(limitText);

      }

      // Button container

      const buttonContainer = document.createElement("div");

      buttonContainer.className = "option-buttons";

      // Repeat controls

      const queueKey = `${activity.id}:${option.id}`;
      const repeatSelection = this.repeatSelections[queueKey] || { mode: "once", count: 5 };
      const clampCount = (val) => {
        const num = parseInt(val, 10);
        if (!Number.isFinite(num)) return 5;
        return Math.min(999, Math.max(1, num));
      };
      const setRepeatSelection = (mode, count = repeatSelection.count) => {
        this.repeatSelections[queueKey] = { mode, count: clampCount(count ?? 5) };
      };
      const getRepeatInputValue = () => {
        const input = document.getElementById(`repeat-input-${option.id}`);
        if (input) return clampCount(input.value);
        return clampCount(repeatSelection.count);
      };

      // Check repeatable on option first, then activity meta, default to true
      const isRepeatable = option.repeatable !== false && activity.meta?.repeatable !== false;

      // Button-driven controls (no radios to reset)

      const controls = document.createElement("div");

      controls.className = "repeat-mode-selector";

      const canCommit = canStart && canStartNewRun;

      const disableIfBlocked = (btn) => {

        if (!canCommit) {

          btn.disabled = true;

          btn.classList.add("btn-disabled");

          if (!canStartNewRun && canStart) {

            btn.title = `Maximum concurrent runs reached (${maxConcurrent})`;

          } else if (!canStart) {

            btn.title = reason || "Requirements not met";

          }

        }

      };

      // RUN ONCE

      const onceBtn = document.createElement("button");

      onceBtn.className = "btn";

      onceBtn.textContent = "RUN ONCE";

      disableIfBlocked(onceBtn);

      onceBtn.onclick = (e) => {

        e.preventDefault();

        const result = Engine.startRun(activity.id, option.id);

        if (result.ok) {

          setRepeatSelection("once", getRepeatInputValue());

          // Event system handles UI update

        } else {

          console.error("Failed to start run:", result.reason);

          Engine.addLog(`ƒ?O Failed to start: ${result.reason}`, "error");

          alert(`Cannot start run: ${result.reason}`);

        }

      };

      controls.appendChild(onceBtn);

      // Repeat X times (with number input)

      if (isRepeatable) {

        const repeatGroup = document.createElement("div");

        repeatGroup.className = "repeat-mode-option";

        const repeatLabel = document.createElement("span");

        repeatLabel.textContent = "Repeat ";

        const decrementBtn = document.createElement("button");

        decrementBtn.className = "btn-increment-inline";

        decrementBtn.textContent = "-";

        const repeatInput = document.createElement("input");

        repeatInput.type = "number";

        repeatInput.className = "repeat-input-inline";

        repeatInput.value = String(repeatSelection.count ?? 5);

        repeatInput.min = "1";

        repeatInput.max = "999";

        repeatInput.id = `repeat-input-${option.id}`;

        repeatInput.oninput = () => {

          setRepeatSelection("repeat", getRepeatInputValue());

        };

        repeatInput.onclick = (e) => {

          e.stopPropagation();

        };

        const incrementBtn = document.createElement("button");

        incrementBtn.className = "btn-increment-inline";

        incrementBtn.textContent = "+";

        decrementBtn.onclick = (e) => {

          e.preventDefault();

          e.stopPropagation();

          const input = document.getElementById(`repeat-input-${option.id}`);

          if (input && input.value > 1) {

            input.value = clampCount(parseInt(input.value, 10) - 1);

            setRepeatSelection("repeat", input.value);

          }

        };

        incrementBtn.onclick = (e) => {

          e.preventDefault();

          e.stopPropagation();

          const input = document.getElementById(`repeat-input-${option.id}`);

          if (input && input.value < 999) {

            input.value = clampCount(parseInt(input.value, 10) + 1);

            setRepeatSelection("repeat", input.value);

          }

        };

        const timesText = document.createElement("span");

        timesText.textContent = " times";

        const repeatBtn = document.createElement("button");

        repeatBtn.className = "btn";

        repeatBtn.textContent = "RUN X";

        disableIfBlocked(repeatBtn);

        repeatBtn.onclick = (e) => {

          e.preventDefault();

          const count = clampCount(getRepeatInputValue());

          const result = Engine.startRun(activity.id, option.id, null, null, count);

          if (result.ok) {

            setRepeatSelection("repeat", count);

            // Event system handles UI update

          } else {

            console.error("Failed to start repeat:", result.reason);

            Engine.addLog(`ƒ?O Failed to start repeat: ${result.reason}`, "error");

            alert(`Cannot start repeat: ${result.reason}`);

          }

        };

        repeatGroup.appendChild(repeatLabel);

        repeatGroup.appendChild(decrementBtn);

        repeatGroup.appendChild(repeatInput);

        repeatGroup.appendChild(incrementBtn);

        repeatGroup.appendChild(timesText);

        repeatGroup.appendChild(repeatBtn);

        controls.appendChild(repeatGroup);

        // Repeat forever

        const foreverBtn = document.createElement("button");

        foreverBtn.className = "btn";

        foreverBtn.textContent = "RUN ∞";

        disableIfBlocked(foreverBtn);

        foreverBtn.onclick = (e) => {

          e.preventDefault();

          const result = Engine.startRun(activity.id, option.id, null, null, -1);

          if (result.ok) {

            setRepeatSelection("forever", getRepeatInputValue());

            // Event system handles UI update

          } else {

            console.error("Failed to start infinite repeat:", result.reason);

            Engine.addLog(`ƒ?O Failed to start infinite repeat: ${result.reason}`, "error");

            alert(`Cannot start repeat: ${result.reason}`);

          }

        };

        controls.appendChild(foreverBtn);

      }

      // Active runs info (placeholder keeps layout stable)
      const activeInfo = document.createElement("div");
      activeInfo.className = "option-status";
      activeInfo.style.marginBottom = "0.5rem";
      activeInfo.style.color = "var(--secondary)";
      if (activeRunCount > 0) {
        if (maxConcurrent === Infinity) {
          activeInfo.textContent = `${activeRunCount} active run${activeRunCount === 1 ? '' : 's'}`;
        } else {
          activeInfo.textContent = `${activeRunCount}/${maxConcurrent} concurrent run${maxConcurrent === 1 ? '' : 's'}`;
        }
      } else {
        activeInfo.innerHTML = "&nbsp;";
      }

      buttonContainer.appendChild(controls);

      footer.appendChild(buttonContainer);

      card.appendChild(footer);

      optionsSection.appendChild(card);

    });

    container.appendChild(optionsSection);

    // Active runs for this activity (shown after options)

    const activeRuns = Engine.state.runs.filter(run => run.activityId === activity.id);

    if (activeRuns.length > 0) {

      const runsSection = document.createElement("div");

      runsSection.className = "activity-runs-section";

      const runsTitle = document.createElement("div");

      runsTitle.className = "section-title";

      runsTitle.textContent = `ACTIVE RUNS (${activeRuns.length})`;

      runsSection.appendChild(runsTitle);

      const now = Engine.state.now;

      activeRuns.forEach(run => {
        const runItem = this.createRunItem(run, now);
        runsSection.appendChild(runItem);
      });

      container.appendChild(runsSection);

    }

  },

  createRunItem(run, now) {
    // Shared function to create a run display item (used in both crew tab and activity detail)
    const activity = Engine.content.activities.find(a => a.id === run.activityId);
    const option = activity?.options.find(o => o.id === run.optionId);

    const item = document.createElement("div");
    item.className = "run-item";
    item.dataset.runId = run.runId;

    // Line 1: Crime name
    const nameLine = document.createElement("div");
    nameLine.className = "run-name";
    nameLine.textContent = `${activity?.name || "Unknown"} → ${option?.name || "Unknown"}`;
    item.appendChild(nameLine);

    // Line 2: Staff
    const assignedNames = run.assignedStaffIds.map(id => {
      const s = Engine.state.crew.staff.find(staff => staff.id === id);
      return s ? s.name : "Unknown";
    }).join(", ");
    const staffLine = document.createElement("div");
    staffLine.className = "run-staff";
    staffLine.textContent = `Staff: ${assignedNames}`;
    item.appendChild(staffLine);

    // Line 3: Remaining time
    const remaining = Math.max(0, run.endsAt - now);
    const remainingLine = document.createElement("div");
    remainingLine.className = "run-remaining";
    let timeText = `Remaining: ${this.formatDuration(remaining)}`;
    if (remaining > 3600000) {
      const finishTime = new Date(run.endsAt);
      const hours = finishTime.getHours();
      const minutes = finishTime.getMinutes();
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      timeText += ` (finishes at ${timeString})`;
    }
    remainingLine.textContent = timeText;
    item.appendChild(remainingLine);

    // Line 4: Progress bar (40 chars, using #)
    const elapsed = now - run.startedAt;
    const total = run.endsAt - run.startedAt;
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const filled = Math.floor((progress / 100) * 40);
    const emptyChars = 40 - filled;
    const barText = `[${'#'.repeat(filled)}${'-'.repeat(emptyChars)}]`;

    const progressLine = document.createElement("div");
    progressLine.className = "run-progress";
    progressLine.style.display = "flex";
    progressLine.style.justifyContent = "space-between";
    progressLine.style.alignItems = "center";

    const progressBar = document.createElement("span");
    progressBar.className = "progress-bar";
    progressBar.textContent = barText;
    progressLine.appendChild(progressBar);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-cancel";
    cancelBtn.textContent = "STOP";
    cancelBtn.dataset.action = "cancel-run";
    cancelBtn.dataset.runId = run.runId;
    progressLine.appendChild(cancelBtn);

    item.appendChild(progressLine);

    // Repeat info (only shown if repeating)
    if (run.runsLeft !== 0) {
      const repeatLine = document.createElement("div");
      repeatLine.className = "run-repeat-info";
      repeatLine.style.display = "flex";
      repeatLine.style.justifyContent = "space-between";
      repeatLine.style.alignItems = "center";
      repeatLine.style.marginTop = "4px";
      repeatLine.style.fontSize = "0.9em";
      repeatLine.style.color = "var(--secondary)";

      let displayText;
      if (run.runsLeft === -1) {
        displayText = "REPEATING infinite";
      } else {
        displayText = `REPEATING (${run.runsLeft} more after this)`;
      }

      const repeatLabel = document.createElement("span");
      repeatLabel.textContent = displayText;
      repeatLine.appendChild(repeatLabel);

      const stopRepeatBtn = document.createElement("button");
      stopRepeatBtn.className = "btn-stop";
      stopRepeatBtn.textContent = "STOP REPEAT";
      stopRepeatBtn.dataset.action = "stop-repeat-request";
      stopRepeatBtn.dataset.runId = run.runId;
      repeatLine.appendChild(stopRepeatBtn);

      item.appendChild(repeatLine);
    }

    return item;
  },

  renderStaff() {

    const container = document.getElementById("staff-list");

    if (!container) return;

    container.innerHTML = "";

    if (Engine.state.crew.staff.length === 0) {

      const empty = document.createElement("div");

      empty.className = "empty-state";

      empty.textContent = "No crew members.";

      container.appendChild(empty);

      return;

    }

    Engine.state.crew.staff.forEach(staff => {

      const item = document.createElement("div");

      item.className = "staff-item";

      const main = document.createElement("div");

      const name = document.createElement("div");

      name.className = "staff-name";

      const stars = Engine.getStarsForStaff(staff);

      const starsText = stars > 0 ? ` <span class="stars">${"★".repeat(stars)}</span>` : "";

      name.innerHTML = `${staff.name}${starsText}`;

      const role = document.createElement("div");

      role.className = "staff-role";

      role.textContent = staff.roleId.toUpperCase();

      const meta = document.createElement("div");

      meta.className = "staff-meta";

      meta.textContent = `XP: ${staff.xp || 0}`;

      main.appendChild(name);

      main.appendChild(role);

      main.appendChild(meta);

      const status = document.createElement("div");

      status.className = `staff-status status-${staff.status}`;

      status.textContent = `[${staff.status.toUpperCase()}]`;

      item.appendChild(main);

      item.appendChild(status);

      container.appendChild(item);

    });

  },

  renderRuns() {
    const container = document.getElementById("runs-list");
    if (!container) return;

    container.innerHTML = "";

    if (Engine.state.runs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No active runs.";
      container.appendChild(empty);
      return;
    }

    const now = Engine.state.now;
    Engine.state.runs.forEach(run => {
      const item = this.createRunItem(run, now);
      container.appendChild(item);
    });
  },

  renderResources() {

    const container = document.getElementById("resources-list");

    if (!container) return;

    container.innerHTML = "";

    // Combine resources and items

    const entries = [];

    Object.entries(Engine.state.resources).forEach(([id, amount]) => {

      if (amount !== 0) {

        entries.push({ id, amount, type: "resource" });

      }

    });

    Object.entries(Engine.state.items).forEach(([id, amount]) => {

      entries.push({ id, amount, type: "item" });

    });

    if (entries.length === 0) {

      const empty = document.createElement("div");

      empty.className = "empty-state";

      empty.textContent = "No resources or items.";

      container.appendChild(empty);

      return;

    }

    entries.forEach(entry => {

      const item = document.createElement("div");

      item.className = "resource-item";

      const name = document.createElement("div");

      name.className = "resource-name";

      name.textContent = entry.id.replace(/([A-Z])/g, " $1").trim().toUpperCase();

      const amount = document.createElement("div");

      amount.className = "resource-amount";

      amount.textContent = this.formatNumber(entry.amount);

      item.appendChild(name);

      item.appendChild(amount);

      container.appendChild(item);

    });

  },

  renderSettings() {

    const container = document.getElementById("settings-content");

    if (!container) return;

    container.innerHTML = "";

    // Font Selection (Collapsible)

    const fontSection = document.createElement("div");

    fontSection.className = "settings-section";

    const fontHeader = document.createElement("div");

    fontHeader.className = "settings-section-header";

    fontHeader.style.cursor = "pointer";

    fontHeader.dataset.action = "toggle-font-submenu";

    const fontTitle = document.createElement("div");

    fontTitle.className = "settings-section-title";

    const currentFont = this.fontOptions.find(f => f.id === this.settings.fontId) || this.fontOptions[0];

    fontTitle.textContent = `FONT: ${currentFont.label}`;

    const expandIcon = document.createElement("span");

    expandIcon.className = "expand-icon";

    expandIcon.textContent = this.fontSubmenuExpanded ? "▼" : "►";

    expandIcon.style.marginLeft = "0.5rem";

    expandIcon.style.fontSize = "0.6rem";

    fontTitle.appendChild(expandIcon);

    fontHeader.appendChild(fontTitle);

    const fontDesc = document.createElement("div");

    fontDesc.className = "settings-section-desc";

    fontDesc.textContent = "Click to change terminal font";

    fontHeader.appendChild(fontDesc);

    fontSection.appendChild(fontHeader);

    // Font options submenu (collapsible)

    if (this.fontSubmenuExpanded) {

      const fontSubmenu = document.createElement("div");

      fontSubmenu.className = "settings-submenu";

      fontSubmenu.style.marginTop = "0.75rem";

      this.fontOptions.forEach(font => {

        const option = document.createElement("div");

        option.className = "settings-option";

        option.dataset.action = "set-font";

        option.dataset.id = font.id;

        if (font.id === this.settings.fontId) {

          option.classList.add("active");

        }

        const left = document.createElement("div");

        const label = document.createElement("div");

        label.className = "settings-option-label";

        label.textContent = font.label;

        const preview = document.createElement("div");

        preview.className = "settings-option-preview";

        preview.style.fontFamily = font.fontFamily;

        preview.textContent = "CRIME COMMITTER VI — $1,234";

        left.appendChild(label);

        left.appendChild(preview);

        const status = document.createElement("div");

        status.className = "settings-option-status";

        status.textContent = font.id === this.settings.fontId ? "[ACTIVE]" : "";

        option.appendChild(left);

        option.appendChild(status);

        fontSubmenu.appendChild(option);

      });

      fontSection.appendChild(fontSubmenu);

    }

    container.appendChild(fontSection);

    // Glow Toggle

    const glowSection = document.createElement("div");

    glowSection.className = "settings-section";

    const glowTitle = document.createElement("div");

    glowTitle.className = "settings-section-title";

    glowTitle.textContent = "VISUAL EFFECTS";

    glowSection.appendChild(glowTitle);

    const glowDesc = document.createElement("div");

    glowDesc.className = "settings-section-desc";

    glowDesc.textContent = "Toggle neon glow effects on text and UI elements.";

    glowSection.appendChild(glowDesc);

    const glowToggle = document.createElement("div");

    glowToggle.className = "settings-toggle";

    glowToggle.dataset.action = "toggle-glow";

    const toggleLeft = document.createElement("div");

    toggleLeft.className = "settings-toggle-label";

    const toggleLabel = document.createElement("div");

    toggleLabel.textContent = "Glow Effects";

    const toggleDesc = document.createElement("div");

    toggleDesc.className = "settings-toggle-desc";

    toggleDesc.textContent = "Neon text-shadow and box-shadow on active elements";

    toggleLeft.appendChild(toggleLabel);

    toggleLeft.appendChild(toggleDesc);

    const toggleSwitch = document.createElement("div");

    toggleSwitch.className = "toggle-switch";

    if (this.settings.glowEnabled) {

      toggleSwitch.classList.add("active");

    }

    const toggleSlider = document.createElement("div");

    toggleSlider.className = "toggle-slider";

    toggleSwitch.appendChild(toggleSlider);

    glowToggle.appendChild(toggleLeft);

    glowToggle.appendChild(toggleSwitch);

    glowSection.appendChild(glowToggle);

    container.appendChild(glowSection);

    // Debug Tools

    const debugSection = document.createElement("div");

    debugSection.className = "settings-section";

    const debugTitle = document.createElement("div");

    debugTitle.className = "settings-section-title";

    debugTitle.textContent = "DEBUG TOOLS";

    debugSection.appendChild(debugTitle);

    const debugDesc = document.createElement("div");

    debugDesc.className = "settings-section-desc";

    debugDesc.textContent = "Testing utilities for development.";

    debugSection.appendChild(debugDesc);

    const addCrewButton = document.createElement("button");

    addCrewButton.className = "btn";

    addCrewButton.dataset.action = "add-random-crew";

    addCrewButton.textContent = "[ ADD RANDOM CREW ]";

    addCrewButton.style.marginTop = "0.5rem";

    debugSection.appendChild(addCrewButton);

    container.appendChild(debugSection);

    // Reset Game

    const resetSection = document.createElement("div");

    resetSection.className = "settings-section";

    const resetTitle = document.createElement("div");

    resetTitle.className = "settings-section-title";

    resetTitle.textContent = "DANGER ZONE";

    resetSection.appendChild(resetTitle);

    const resetDesc = document.createElement("div");

    resetDesc.className = "settings-section-desc";

    resetDesc.textContent = "Reset all game progress. This action cannot be undone.";

    resetSection.appendChild(resetDesc);

    const resetButton = document.createElement("button");

    resetButton.className = "btn btn-danger";

    resetButton.dataset.action = "reset-game";

    resetButton.textContent = "[ RESET GAME ]";

    resetSection.appendChild(resetButton);

    container.appendChild(resetSection);

  },

  renderLog() {

    const container = document.getElementById("log-list");

    if (!container) return;

    container.innerHTML = "";

    if (Engine.state.log.length === 0) {

      const empty = document.createElement("div");

      empty.className = "empty-state";

      empty.textContent = "No log entries.";

      container.appendChild(empty);

      return;

    }

    const recent = Engine.state.log.slice(-50).reverse();

    recent.forEach(entry => {

      const item = document.createElement("div");

      item.className = `log-item log-${entry.kind}`;

      const time = document.createElement("span");

      time.className = "log-time";

      time.textContent = `[${this.formatTime(entry.time)}]`;

      const text = document.createElement("span");

      text.className = "log-text";

      text.textContent = entry.text;

      item.appendChild(time);

      item.appendChild(text);

      container.appendChild(item);

    });

  },

  formatNumber(num) {

    return Math.floor(num).toLocaleString();

  },

  formatDuration(ms) {
    const totalSeconds = ms / 1000;
    const seconds = Math.floor(totalSeconds);
    const tenths = Math.floor((totalSeconds % 1) * 10);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}.${tenths}s`;
    return `${seconds}.${tenths}s`;
  },

  formatTime(timestamp) {

    const date = new Date(timestamp);

    return date.toLocaleTimeString();

  },

  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      // Don't interfere with input fields
      if (e.target.tagName === 'INPUT') {
        return;
      }

      // TAB: Cycle through tabs
      if (e.key === 'Tab') {
        e.preventDefault();
        const tabs = Array.from(document.querySelectorAll('.nav-tab'));
        const activeIndex = tabs.findIndex(tab => tab.classList.contains('active'));
        const nextIndex = e.shiftKey
          ? (activeIndex - 1 + tabs.length) % tabs.length
          : (activeIndex + 1) % tabs.length;
        tabs[nextIndex].click();
      }

      // ESC: Go back in activities view
      else if (e.key === 'Escape') {
        if (this.view === 'detail') {
          this.backToList();
        }
      }

      // Arrow keys: Navigate within lists
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.handleArrowNavigation(e.key);
      }

      // Enter: Activate focused element
      else if (e.key === 'Enter') {
        e.preventDefault();
        this.handleEnterKey();
      }
    });
  },

  handleArrowNavigation(key) {
    const activeTab = document.querySelector('.nav-tab.active');
    if (!activeTab) return;

    const tabId = activeTab.dataset.tab;

    if (tabId === 'activities') {
      if (this.view === 'list') {
        // Navigate branch tabs or activity items
        const branches = Array.from(document.querySelectorAll('.branch-tab'));
        const activities = Array.from(document.querySelectorAll('.activity-item'));

        // If we have branches, handle left/right for branch navigation
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          const activeIndex = branches.findIndex(b => b.classList.contains('active'));
          if (activeIndex >= 0) {
            const nextIndex = key === 'ArrowRight'
              ? Math.min(activeIndex + 1, branches.length - 1)
              : Math.max(activeIndex - 1, 0);
            if (branches[nextIndex]) {
              branches[nextIndex].click();
            }
          }
        }

        // Up/Down for activity navigation
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          if (activities.length > 0) {
            const focused = document.activeElement;
            const currentIndex = activities.indexOf(focused);
            let nextIndex = 0;

            if (currentIndex >= 0) {
              nextIndex = key === 'ArrowDown'
                ? Math.min(currentIndex + 1, activities.length - 1)
                : Math.max(currentIndex - 1, 0);
            }

            if (activities[nextIndex]) {
              activities[nextIndex].focus();
              activities[nextIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }
        }
      } else if (this.view === 'detail') {
        // Navigate option cards
        const options = Array.from(document.querySelectorAll('.option-card .btn:not(:disabled)'));
        if (options.length > 0) {
          const focused = document.activeElement;
          const currentIndex = options.indexOf(focused);
          let nextIndex = 0;

          if (currentIndex >= 0) {
            nextIndex = key === 'ArrowDown' || key === 'ArrowRight'
              ? Math.min(currentIndex + 1, options.length - 1)
              : Math.max(currentIndex - 1, 0);
          }

          if (options[nextIndex]) {
            options[nextIndex].focus();
            options[nextIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }
      }
    }
  },

  handleEnterKey() {
    const focused = document.activeElement;

    // If a button or clickable element is focused, click it
    if (focused && (focused.tagName === 'BUTTON' || focused.dataset.action)) {
      focused.click();
    } else {
      // Auto-focus first interactable element
      const activeTab = document.querySelector('.nav-tab.active');
      if (!activeTab) return;

      const tabId = activeTab.dataset.tab;

      if (tabId === 'activities') {
        if (this.view === 'list') {
          const firstActivity = document.querySelector('.activity-item');
          if (firstActivity) firstActivity.click();
        } else if (this.view === 'detail') {
          const firstButton = document.querySelector('.option-card .btn:not(:disabled)');
          if (firstButton) firstButton.click();
        }
      }
    }
  }

};