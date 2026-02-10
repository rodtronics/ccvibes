import {
  ensureSaveSlotStorage,
  getActiveSaveSlot,
  getDefaultPlayerName,
  getGameStateKey,
  getSeenModalsKey,
  normalizeSlotId,
  saveSlotExists,
  setActiveSaveSlot,
  setSlotRawState,
  getSlotRawState,
  removeSlotState,
  sanitizePlayerName
} from './save_slots.js';

function createDefaultState(playerName = 'player1') {
  return {
    version: 6,
    now: Date.now(),
    playerName,
    resources: {
      cash: 0,
      cred: 50,
      heat: 0,
    },
    flags: {},
    reveals: {
      branches: {},
      activities: {},
      resources: {},
      roles: {},
      tabs: { activities: true, log: true }
    },
    crew: {
      staff: [
        { id: "s_you", name: "you", roleId: "player", xp: 0, status: "available", unavailableUntil: 0, perks: [], perkChoices: {}, unchosen: [], pendingPerkChoice: null }
      ]
    },
    runs: [],
    log: [],
    stats: {
      lastRecorded: { second: 0, minute: 0, fiveMin: 0, hour: 0, day: 0, month: 0 },
      series: {},
      totals: { crimesCompleted: 0, crimesSucceeded: 0, crimesFailed: 0, totalEarned: 0, totalSpent: 0 }
    },
    debugMode: false
  };
}

/** Sort comparator: active runs first, completed last */
export const sortRunsActiveFirst = (a, b) => {
  if (a.status === "active" && b.status === "completed") return -1;
  if (a.status === "completed" && b.status === "active") return 1;
  return 0;
};

export class Engine {
  constructor(modalQueue = null) {
    this.modalQueue = modalQueue;
    ensureSaveSlotStorage();
    this.activeSaveSlot = getActiveSaveSlot();
    this.state = createDefaultState(getDefaultPlayerName(this.activeSaveSlot));
    this.data = {
      activities: [],
      branches: [],
      // items merged into resources
      lexicon: {},
      resources: [],
      roles: [],
      tech: [],
      perks: {},
      modals: []
    };
    this.lastTick = Date.now();
  }

  async init(onProgress) {
    await this.loadData(onProgress);
    this.loadState();
    await onProgress?.('SAVED STATE');
    this.applyDefaultReveals();
    this.log("System online.", "info");
  }

  async loadData(onProgress) {
    const files = [
      ["activities.json", "activities"],
      ["branches.json", "branches"],
      // items.json merged into resources.json
      ["lexicon.json", "lexicon"],
      ["resources.json", "resources"],
      ["roles.json", "roles"],
      ["tech.json", "tech"],
      ["perks.json", "perks"]
    ];

    for (const [file, key] of files) {
      try {
        const res = await fetch(`data/${file}`, { cache: 'no-store' });
        this.data[key] = await res.json();
      } catch (err) {
        console.warn(`Failed to load ${file}`, err);
        this.log(`Failed to load ${file}`, "warn");
      }
      await onProgress?.(file.replace('.json', '.DAT').toUpperCase());
    }
  }

  loadState() {
    ensureSaveSlotStorage();
    this.activeSaveSlot = getActiveSaveSlot();
    this.state = createDefaultState(getDefaultPlayerName(this.activeSaveSlot));

    try {
      const saveKey = getGameStateKey(this.activeSaveSlot);
      const saved = saveKey ? localStorage.getItem(saveKey) : null;
      if (!saved) {
        console.log(`No saved state found in ${this.activeSaveSlot}, starting fresh`);
        return;
      }

      const parsed = JSON.parse(saved);
      console.log('Loading saved state:', parsed);

      // Merge saved state with defaults
      this.state = {
        ...this.state,
        ...parsed,
        playerName: sanitizePlayerName(parsed.playerName, getDefaultPlayerName(this.activeSaveSlot)),
        now: Date.now()  // Always use current time
      };

      // Migrate crew members to include new perk fields
      if (this.state.crew?.staff) {
        this.state.crew.staff = this.state.crew.staff.map(staff => ({
          ...staff,
          perks: staff.perks || [],
          perkChoices: staff.perkChoices || {},
          unchosen: staff.unchosen || [],
          pendingPerkChoice: staff.pendingPerkChoice !== undefined ? staff.pendingPerkChoice : null
        }));
      }

      // Migrate stats if missing or incomplete
      if (!this.state.stats) {
        this.state.stats = {
          lastRecorded: { second: 0, minute: 0, fiveMin: 0, hour: 0, day: 0, month: 0 },
          series: {},
          totals: { crimesCompleted: 0, crimesSucceeded: 0, crimesFailed: 0, totalEarned: 0, totalSpent: 0 }
        };
      }
      // Ensure all sub-objects exist
      if (!this.state.stats.lastRecorded) {
        this.state.stats.lastRecorded = { second: 0, minute: 0, fiveMin: 0, hour: 0, day: 0, month: 0 };
      }
      if (!this.state.stats.series) {
        this.state.stats.series = {};
      }
      if (!this.state.stats.totals) {
        this.state.stats.totals = { crimesCompleted: 0, crimesSucceeded: 0, crimesFailed: 0, totalEarned: 0, totalSpent: 0 };
      }

      // Migrate runs to include new fields for persistent completed runs
      if (this.state.runs) {
        this.state.runs = this.state.runs.map(run => ({
          ...run,
          status: run.status || 'active',
          results: run.results || [],
          currentRun: run.currentRun || 1,
          totalRuns: run.totalRuns || (run.runsLeft === -1 ? -1 : (run.runsLeft || 0) + 1),
          completedAt: run.completedAt || null,
        }));
      }

      // Process any runs that should have completed while offline
      const now = Date.now();
      let completedCount = 0;

      // Loop until no more runs need completion (handles multi-run chains)
      let hasMore = true;
      while (hasMore) {
        hasMore = false;
        this.state.runs.forEach((run, index) => {
          // Skip already-completed runs
          if (run.status === 'completed') return;

          if (run.endsAt <= now) {
            console.log(`Completing run that finished offline: ${run.runId}`);
            this.completeRun(run, index);
            completedCount++;
            hasMore = true;  // Check again in case repeat spawned a new run that also completed
          }
        });
      }

      const stillActive = this.state.runs.filter(r => r.status === 'active' && r.endsAt > now);
      const completed = this.state.runs.filter(r => r.status === 'completed');
      console.log(`State loaded (${this.activeSaveSlot}): ${completedCount} sub-runs completed offline, ${stillActive.length} active, ${completed.length} completed`);
    } catch (err) {
      console.warn('Failed to load state:', err);
      this.log('Failed to load saved state', 'warn');
    }
  }

  resetProgress() {
    const stateKey = getGameStateKey(this.activeSaveSlot);
    const seenKey = getSeenModalsKey(this.activeSaveSlot);
    if (stateKey) localStorage.removeItem(stateKey);
    if (seenKey) localStorage.removeItem(seenKey);
    localStorage.removeItem('ccv_has_booted');
    this.state = createDefaultState(getDefaultPlayerName(this.activeSaveSlot));
    this.applyDefaultReveals();
    this.log("Progress reset. Starting fresh.", "info");
    return { ok: true };
  }

  saveState() {
    try {
      // Prune old completed runs to prevent localStorage bloat (keep max 50)
      const MAX_COMPLETED = 50;
      const completedRuns = this.state.runs.filter(r => r.status === 'completed');
      if (completedRuns.length > MAX_COMPLETED) {
        // Sort by completedAt ascending (oldest first), remove oldest
        completedRuns.sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
        const toRemove = new Set(
          completedRuns.slice(0, completedRuns.length - MAX_COMPLETED).map(r => r.runId)
        );
        this.state.runs = this.state.runs.filter(r => !toRemove.has(r.runId));
      }

      const toSave = {
        version: this.state.version,
        playerName: sanitizePlayerName(this.state.playerName, getDefaultPlayerName(this.activeSaveSlot)),
        resources: this.state.resources,
        flags: this.state.flags,
        reveals: this.state.reveals,
        crew: this.state.crew,
        runs: this.state.runs,
        log: this.state.log.slice(0, 50),  // Save only last 50 log entries
        stats: this.state.stats
      };

      const saveKey = getGameStateKey(this.activeSaveSlot);
      if (!saveKey) {
        console.warn('Failed to save state: invalid active slot', this.activeSaveSlot);
        return;
      }
      localStorage.setItem(saveKey, JSON.stringify(toSave));
      console.log(`State saved (${this.activeSaveSlot}):`, toSave);
    } catch (err) {
      console.warn('Failed to save state:', err);
    }
  }

  getActiveSaveSlot() {
    return this.activeSaveSlot;
  }

  getActivePlayerName() {
    return sanitizePlayerName(this.state.playerName, getDefaultPlayerName(this.activeSaveSlot));
  }

  setActivePlayerName(name) {
    const nextName = sanitizePlayerName(name, getDefaultPlayerName(this.activeSaveSlot));
    this.state.playerName = nextName;
    this.saveState();
    return nextName;
  }

  reloadActiveSlot() {
    this.loadState();
    this.applyDefaultReveals();
    return { ok: true, slotId: this.activeSaveSlot, playerName: this.getActivePlayerName() };
  }

  switchSaveSlot(slotInput, options = {}) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) return { ok: false, reason: 'Invalid slot' };

    const { saveCurrent = true, createIfMissing = true } = options;
    if (saveCurrent) {
      this.saveState();
    }

    const existed = saveSlotExists(slotId);
    setActiveSaveSlot(slotId);
    this.activeSaveSlot = slotId;
    this.loadState();
    this.applyDefaultReveals();

    if (!existed && createIfMissing) {
      this.state.playerName = getDefaultPlayerName(slotId);
      this.saveState();
    }

    return {
      ok: true,
      slotId,
      created: !existed,
      playerName: this.getActivePlayerName()
    };
  }

  slotExists(slotInput) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) return false;
    return saveSlotExists(slotId);
  }

  getSlotName(slotInput) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId || !saveSlotExists(slotId)) return null;

    const raw = getSlotRawState(slotId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return sanitizePlayerName(parsed?.playerName, getDefaultPlayerName(slotId));
    } catch {
      return getDefaultPlayerName(slotId);
    }
  }

  setSlotName(slotInput, nameInput) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) return { ok: false, reason: 'Invalid slot' };
    if (!saveSlotExists(slotId)) return { ok: false, reason: 'Slot is empty' };

    const nextName = sanitizePlayerName(nameInput, getDefaultPlayerName(slotId));

    if (slotId === this.activeSaveSlot) {
      this.state.playerName = nextName;
      this.saveState();
      return { ok: true, slotId, name: nextName, active: true };
    }

    const raw = getSlotRawState(slotId);
    if (!raw) return { ok: false, reason: 'Slot is empty' };

    try {
      const parsed = JSON.parse(raw);
      parsed.playerName = nextName;
      setSlotRawState(slotId, JSON.stringify(parsed));
      return { ok: true, slotId, name: nextName, active: false };
    } catch {
      return { ok: false, reason: 'Save file is invalid' };
    }
  }

  copySaveSlot(sourceInput, targetInput, options = {}) {
    const sourceId = normalizeSlotId(sourceInput);
    const targetId = normalizeSlotId(targetInput);
    if (!sourceId || !targetId) return { ok: false, reason: 'Invalid slot' };
    if (sourceId === targetId) return { ok: false, reason: 'Source and target must differ' };

    const sourceRaw = getSlotRawState(sourceId);
    if (!sourceRaw) return { ok: false, reason: 'Source slot is empty' };

    const targetExists = saveSlotExists(targetId);
    const { overwrite = false } = options;
    if (targetExists && !overwrite) {
      return { ok: false, reason: 'Target slot exists', needsConfirm: true };
    }

    setSlotRawState(targetId, sourceRaw);

    const sourceSeenKey = getSeenModalsKey(sourceId);
    const targetSeenKey = getSeenModalsKey(targetId);
    const sourceSeen = sourceSeenKey ? localStorage.getItem(sourceSeenKey) : null;
    if (targetSeenKey) {
      if (sourceSeen !== null) {
        localStorage.setItem(targetSeenKey, sourceSeen);
      } else {
        localStorage.removeItem(targetSeenKey);
      }
    }

    return { ok: true, sourceId, targetId, overwritten: targetExists };
  }

  deleteSaveSlot(slotInput) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) return { ok: false, reason: 'Invalid slot' };
    if (!saveSlotExists(slotId)) return { ok: false, reason: 'Slot is empty' };

    removeSlotState(slotId);
    if (slotId === this.activeSaveSlot) {
      this.state = createDefaultState(getDefaultPlayerName(slotId));
      this.applyDefaultReveals();
      return { ok: true, slotId, activeCleared: true };
    }

    return { ok: true, slotId, activeCleared: false };
  }

  exportSaveSlot(slotInput) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) return { ok: false, reason: 'Invalid slot' };
    const raw = getSlotRawState(slotId);
    if (!raw) return { ok: false, reason: 'Slot is empty' };
    return { ok: true, slotId, raw };
  }

  importSaveSlot(slotInput, rawText, options = {}) {
    const slotId = normalizeSlotId(slotInput);
    if (!slotId) return { ok: false, reason: 'Invalid slot' };

    const exists = saveSlotExists(slotId);
    const { overwrite = false } = options;
    if (exists && !overwrite) {
      return { ok: false, reason: 'Target slot exists', needsConfirm: true };
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { ok: false, reason: 'Imported file is not valid JSON' };
    }

    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, reason: 'Imported file is invalid' };
    }

    const imported = {
      ...parsed,
      playerName: sanitizePlayerName(parsed.playerName, getDefaultPlayerName(slotId))
    };

    setSlotRawState(slotId, JSON.stringify(imported));

    if (slotId === this.activeSaveSlot) {
      this.loadState();
      this.applyDefaultReveals();
    }

    return { ok: true, slotId, overwritten: exists };
  }

  applyDefaultReveals() {
    this.data.resources.forEach((res) => {
      if (res.revealedByDefault) this.state.reveals.resources[res.id] = true;
    });
    this.data.roles.forEach((role) => {
      if (role.revealedByDefault) this.state.reveals.roles[role.id] = true;
    });
    this.data.branches.forEach((branch) => {
      if (branch.revealedByDefault) this.state.reveals.branches[branch.id] = true;
    });
  }

  tick() {
    const now = Date.now();
    this.state.now = now;
    this.processRuns(now);
    this.recoverStaff(now);
    this.decayHeat(now);
    this.recordStats(now);
    this.lastTick = now;
  }

  recordStats(now) {
    // 64 points per time period
    const intervals = {
      second: 1000,      // 64000 / 64 (64 seconds total)
      minute: 938,       // 60000 / 64
      fiveMin: 4688,     // 300000 / 64
      hour: 56250,       // 3600000 / 64
      day: 1350000,      // 86400000 / 64
      month: 40500000    // 2592000000 / 64 (30 days)
    };

    const statsToRecord = {
      cash: this.state.resources.cash || 0,
      heat: this.state.resources.heat || 0,
      cred: this.state.resources.cred || 0,
      crewCount: this.state.crew.staff.length,
      activeRuns: this.state.runs.length,
      successRate: this.calculateSuccessRate()
    };

    Object.entries(intervals).forEach(([scale, interval]) => {
      const lastRecorded = this.state.stats.lastRecorded[scale] || 0;
      if (now - lastRecorded >= interval) {
        this.state.stats.lastRecorded[scale] = now;

        Object.entries(statsToRecord).forEach(([stat, value]) => {
          if (!this.state.stats.series[stat]) {
            this.state.stats.series[stat] = {};
          }
          if (!this.state.stats.series[stat][scale]) {
            this.state.stats.series[stat][scale] = [];
          }

          const arr = this.state.stats.series[stat][scale];
          arr.push(value);
          if (arr.length > 64) arr.shift();
        });
      }
    });
  }

  calculateSuccessRate() {
    const totals = this.state.stats?.totals;
    if (!totals || totals.crimesCompleted === 0) return 0;
    return Math.round((totals.crimesSucceeded / totals.crimesCompleted) * 100);
  }

  processRuns(now) {
    const completed = [];

    this.state.runs.forEach((run, index) => {
      // Skip already-completed runs
      if (run.status === 'completed') return;

      if (run.endsAt <= now) {
        // Store original index for position preservation on repeat
        completed.push({ run, originalIndex: index });
      }
    });

    // Don't filter yet - let completeRun handle it so repeats can replace in-place
    completed.forEach(({ run, originalIndex }) => this.completeRun(run, originalIndex));
  }

  recoverStaff(now) {
    this.state.crew.staff.forEach((member) => {
      if (member.status === "unavailable" && member.unavailableUntil <= now) {
        member.status = "available";
        member.unavailableUntil = 0;
        this.log(`${member.name} is available again.`, "info");
      }
    });
  }

  decayHeat(now) {
    const delta = now - this.lastTick;
    if (delta <= 0) return;
    const decayEveryMs = 45000;
    if (this.state.resources.heat > 0) {
      const steps = Math.floor(delta / decayEveryMs);
      if (steps > 0) {
        this.state.resources.heat = Math.max(0, this.state.resources.heat - steps);
      }
    }
  }

  startRun(activityId, optionId, assignedStaffIds, runsLeft = 0, replaceIndex = -1) {
    this.state.now = Date.now();
    const activity = this.data.activities.find((a) => a.id === activityId);
    if (!activity) return { ok: false, reason: "Activity not found" };

    const option = activity.options.find((o) => o.id === optionId);
    if (!option) return { ok: false, reason: "Option not found" };

    if (!this.isActivityVisible(activity)) {
      return { ok: false, reason: "Activity hidden" };
    }

    if (!this.isOptionUnlocked(option)) {
      return { ok: false, reason: "Option locked" };
    }

    const staffIds = assignedStaffIds || this.autoAssign(option.requirements);
    if (!staffIds || staffIds.length === 0) {
      return { ok: false, reason: "No crew available" };
    }

    const reqCheck = this.checkRequirements(option.requirements, staffIds);
    if (!reqCheck.ok) return reqCheck;

    const inputCheck = this.checkInputs(option.inputs);
    if (!inputCheck.ok) return inputCheck;

    this.consumeInputs(option.inputs);

    const staff = staffIds
      .map((id) => this.state.crew.staff.find((s) => s.id === id))
      .filter(Boolean);
    staff.forEach((s) => (s.status = "busy"));

    const plannedOutcomeId = this.planOutcome(option, staff);
    const duration = option.durationMs || 5000;

    // Calculate totalRuns based on runsLeft
    let totalRuns;
    if (runsLeft === 0) {
      totalRuns = 1;  // Single run
    } else if (runsLeft === -1) {
      totalRuns = -1;  // Infinite
    } else {
      totalRuns = runsLeft + 1;  // N more after this = N+1 total
    }

    const run = {
      runId: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      activityId,
      optionId,
      startedAt: this.state.now,
      endsAt: this.state.now + duration,
      assignedStaffIds: staffIds,
      runsLeft: runsLeft,  // 0 = single, N = N more after this, -1 = infinite
      snapshot: { plannedOutcomeId },
      // New fields for persistent completed runs
      status: 'active',
      totalRuns: totalRuns,
      currentRun: 1,
      results: [],
      completedAt: null,
    };

    // Replace at specific index (for repeat runs) or append to end
    if (replaceIndex >= 0 && replaceIndex < this.state.runs.length) {
      // For repeat continuation, update the existing run in-place
      const existingRun = this.state.runs[replaceIndex];
      existingRun.endsAt = run.endsAt;
      existingRun.snapshot = run.snapshot;
      existingRun.runsLeft = run.runsLeft;
      existingRun.currentRun = (existingRun.currentRun || 1) + 1;
      // Don't overwrite: runId, startedAt, totalRuns, results, status, completedAt
    } else {
      this.state.runs.push(run);
    }
    this.log(`Started: ${activity.name} / ${option.name}`, "info");
    this.saveState();  // Save state after starting run
    return { ok: true, run };
  }

  planOutcome(option, staff) {
    if (!option.resolution || option.resolution.type !== "weighted_outcomes") return null;
    const outcomes = this.applyModifiers(option, staff);
    const total = outcomes.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
    const roll = Math.random() * total;
    let acc = 0;
    for (const outcome of outcomes) {
      acc += Math.max(0, outcome.weight);
      if (roll <= acc) return outcome.id;
    }
    return outcomes[0]?.id || null;
  }

  completeRun(run, originalIndex = -1) {
    const activity = this.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);
    if (!activity || !option) return;

    const staff = run.assignedStaffIds
      .map((id) => this.state.crew.staff.find((s) => s.id === id))
      .filter(Boolean);
    staff.forEach((s) => (s.status = "available"));

    // Resolve outcome and capture the result
    const outcomeResult = this.resolveOutcome(option, run, staff);
    if (!run.snapshot?.botched) {
      this.log(`Completed: ${activity.name} / ${option.name}`, "success");
    }

    // Record this sub-run's result
    if (!run.results) run.results = [];
    run.results.push({
      subRunIndex: run.currentRun || 1,
      completedAt: this.state.now,
      wasSuccess: outcomeResult.wasSuccess,
      resourcesGained: outcomeResult.resourcesGained,
      botched: outcomeResult.botched,
    });

    // Handle repeat runs
    if (run.runsLeft !== 0) {
      const nextRunsLeft = run.runsLeft === -1 ? -1 : run.runsLeft - 1;

      // Try to continue with same staff, updating the existing run in-place
      const result = this.startRun(
        run.activityId,
        run.optionId,
        run.assignedStaffIds,
        nextRunsLeft,
        originalIndex  // Update at same position
      );

      if (!result.ok) {
        // Repeat failed - mark run as completed with partial results
        run.status = 'completed';
        run.completedAt = this.state.now;
        const reasonText = String(result.reason || 'Unknown');
        const clarifiedReason = reasonText === 'No crew available'
          ? 'Assigned crew unavailable (jailed or busy)'
          : reasonText;
        this.log(`Repeat failed: ${clarifiedReason}`, 'warning');
        this.saveState();
      }
      // Note: startRun already saves state if successful
    } else {
      // Single run or last repeat - mark as completed, don't remove
      run.status = 'completed';
      run.completedAt = this.state.now;
      this.saveState();
    }
  }

  stopRun(runId) {
    const run = this.state.runs.find((r) => r.runId === runId);
    if (!run) return { ok: false, reason: 'Run not found' };
    if (run.status === 'completed') return { ok: false, reason: 'Run already completed' };

    // Mark staff available
    run.assignedStaffIds.forEach((id) => {
      const staff = this.state.crew.staff.find((s) => s.id === id);
      if (staff) staff.status = 'available';
    });

    // If run has partial results, mark as completed; otherwise remove entirely
    if (run.results && run.results.length > 0) {
      run.status = 'completed';
      run.completedAt = this.state.now;
      this.log('Run stopped (partial results preserved)', 'warning');
    } else {
      this.state.runs = this.state.runs.filter((r) => r.runId !== runId);
      this.log('Run stopped (progress forfeited)', 'warning');
    }
    this.saveState();
    return { ok: true };
  }

  stopAllRuns() {
    const activeRuns = this.state.runs.filter(r => r.status !== 'completed');
    if (activeRuns.length === 0) return { ok: false, reason: 'No active runs' };

    const count = activeRuns.length;
    activeRuns.forEach((run) => {
      run.assignedStaffIds.forEach((id) => {
        const staff = this.state.crew.staff.find((s) => s.id === id);
        if (staff && staff.status === 'busy') staff.status = 'available';
      });

      // If run has partial results, mark as completed; otherwise remove
      if (run.results && run.results.length > 0) {
        run.status = 'completed';
        run.completedAt = this.state.now;
      } else {
        this.state.runs = this.state.runs.filter(r => r.runId !== run.runId);
      }
    });

    this.log(`Stopped all ${count} runs`, 'warning');
    this.saveState();
    return { ok: true, count };
  }

  stopRepeat(runId) {
    const run = this.state.runs.find((r) => r.runId === runId);
    if (!run) return { ok: false, reason: 'Run not found' };
    if (run.status === 'completed') return { ok: false, reason: 'Run already completed' };

    run.runsLeft = 0;  // Convert to single run
    this.log('Repeat stopped (current run will complete)', 'info');
    this.saveState();
    return { ok: true };
  }

  clearCompletedRun(runId) {
    const run = this.state.runs.find((r) => r.runId === runId);
    if (!run) return { ok: false, reason: 'Run not found' };
    if (run.status !== 'completed') return { ok: false, reason: 'Run is still active' };

    this.state.runs = this.state.runs.filter((r) => r.runId !== runId);
    this.saveState();
    return { ok: true };
  }

  clearAllCompletedRuns() {
    const before = this.state.runs.length;
    this.state.runs = this.state.runs.filter((r) => r.status !== 'completed');
    const removed = before - this.state.runs.length;
    if (removed > 0) {
      this.log(`Cleared ${removed} completed run${removed > 1 ? 's' : ''}`, 'info');
      this.saveState();
    }
    return { ok: true, removed };
  }

  canStartRun(activityId, optionId) {
    // Validate WITHOUT mutating state
    const activity = this.data.activities.find((a) => a.id === activityId);
    if (!activity) return { ok: false, reason: 'Activity not found' };

    const option = activity.options.find((o) => o.id === optionId);
    if (!option) return { ok: false, reason: 'Option not found' };

    if (!this.isActivityVisible(activity)) {
      return { ok: false, reason: 'Activity hidden' };
    }

    if (!this.isOptionUnlocked(option)) {
      return { ok: false, reason: 'Option locked' };
    }

    // Check if we can auto-assign staff
    const staffIds = this.autoAssign(option.requirements);
    if (!staffIds || staffIds.length === 0) {
      return { ok: false, reason: 'No crew available' };
    }

    const reqCheck = this.checkRequirements(option.requirements, staffIds);
    if (!reqCheck.ok) return reqCheck;

    const inputCheck = this.checkInputs(option.inputs);
    if (!inputCheck.ok) return inputCheck;

    return { ok: true };
  }

  resolveOutcome(option, run, staff) {
    const resolution = option.resolution;
    if (!resolution) return { wasSuccess: true, resourcesGained: {}, botched: false };

    // Snapshot resources before resolution to calculate gains
    const beforeResources = { ...this.state.resources };

    // Base XP reward for completing a job (scaled by difficulty/duration)
    const baseXp = option.xpRewards?.onComplete || 10;
    let wasSuccessful = true;
    let botched = false;

    if (resolution.type === "deterministic" || resolution.type === "ranged_outputs") {
      this.applyOutputs(resolution.outputs);
      this.applyCred(resolution.credDelta);
      this.applyHeat(resolution.heatDelta);
      this.applyEffects(resolution.effects);
    } else if (resolution.type === "weighted_outcomes") {
      const outcome = resolution.outcomes.find((o) => o.id === run.snapshot.plannedOutcomeId) || resolution.outcomes[0];
      if (!outcome) return { wasSuccess: true, resourcesGained: {}, botched: false };
      this.applyOutputs(outcome.outputs);
      this.applyCred(outcome.credDelta);
      this.applyHeat(outcome.heatDelta);
      this.applyEffects(outcome.effects);
      if (outcome.jail) {
        wasSuccessful = false;
        botched = true;
        const activity = this.data.activities.find((a) => a.id === run.activityId);
        const activityName = activity?.name || "Unknown";
        const optionName = option?.name || "Unknown";
        const durationMs = outcome.jail.durationMs || 0;
        const durationText = this.formatDuration(durationMs);
        run.runsLeft = 0;
        run.snapshot.botched = true;
        this.log(`Botched: ${activityName} / ${optionName}`, "warning");
        staff.forEach((s) => {
          s.status = "unavailable";
          s.unavailableUntil = this.state.now + durationMs;
          this.log(`Unavailable: ${s.name} jailed for ${durationText}.`, "warning");
        });
      }
    }

    // Calculate resource gains by diffing before/after
    const resourcesGained = {};
    for (const key of Object.keys(this.state.resources)) {
      const delta = (this.state.resources[key] || 0) - (beforeResources[key] || 0);
      if (delta !== 0) {
        resourcesGained[key] = delta;
      }
    }

    // Track stats totals
    this.state.stats.totals.crimesCompleted++;
    if (wasSuccessful) {
      this.state.stats.totals.crimesSucceeded++;
    } else {
      this.state.stats.totals.crimesFailed++;
    }

    // Award XP on successful completion
    if (wasSuccessful && staff.length > 0) {
      this.awardXp(staff, baseXp);
    }

    return { wasSuccess: wasSuccessful, resourcesGained, botched };
  }

  applyModifiers(option, staff) {
    const outcomes = JSON.parse(JSON.stringify(option.resolution.outcomes || []));
    (option.modifiers || []).forEach((mod) => {
      if (mod.type === "staffStars") {
        const target = staff.find((s) => s.roleId === mod.roleId);
        if (!target) return;
        const stars = this.getStars(target);
        const adjustments = mod.applyPerStar?.outcomeWeightAdjustment || {};
        outcomes.forEach((o) => {
          Object.entries(adjustments).forEach(([id, delta]) => {
            if (o.id === id) {
              o.weight = Math.max(0, o.weight + delta * stars);
            }
          });
        });
      }
      if (mod.type === "staffRole") {
        const hasRole = staff.some((s) => s.roleId === mod.roleId);
        if (!hasRole) return;
        const effects = mod.effects || {};
        outcomes.forEach((o) => {
          Object.entries(effects.outcomeWeightAdjustment || {}).forEach(([id, delta]) => {
            if (o.id === id) {
              o.weight = Math.max(0, o.weight + delta);
            }
          });
        });
      }
    });
    return outcomes;
  }

  applyOutputs(outputs) {
    if (!outputs?.resources) return;
    Object.entries(outputs.resources).forEach(([id, amount]) => {
      // Handle both simple numbers and ranged {min, max} objects
      let numAmount;
      if (typeof amount === 'object' && amount !== null && 'min' in amount && 'max' in amount) {
        numAmount = Math.floor(Math.random() * (amount.max - amount.min + 1)) + amount.min;
      } else {
        numAmount = Number(amount);
      }
      this.state.resources[id] = (this.state.resources[id] || 0) + numAmount;
      this.state.reveals.resources[id] = true;
    });
  }

  applyCred(delta) {
    if (delta === undefined || delta === null) return;
    const amount = (typeof delta === 'object' && 'min' in delta && 'max' in delta)
      ? this.randomBetween(delta.min, delta.max) : delta;
    this.state.resources.cred = Math.max(0, Math.min(100, (this.state.resources.cred || 0) + amount));
  }

  applyHeat(delta) {
    if (delta === undefined || delta === null) return;
    const amount = (typeof delta === 'object' && 'min' in delta && 'max' in delta)
      ? this.randomBetween(delta.min, delta.max) : delta;
    this.state.resources.heat = Math.max(0, (this.state.resources.heat || 0) + amount);
  }

  formatDuration(ms) {
    ms = Math.max(0, ms);
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 60) {
      const millis = Math.floor((ms % 1000) / 10);
      return `${totalSeconds}.${String(millis).padStart(2, '0')}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}m ${secs}s`;
  }

  applyEffects(effects) {
    if (!effects) return;
    effects.forEach((effect) => {
      if (effect.type === "revealBranch") this.state.reveals.branches[effect.branchId] = true;
      if (effect.type === "revealActivity") this.state.reveals.activities[effect.activityId] = true;
      if (effect.type === "revealResource") this.state.reveals.resources[effect.resourceId] = true;
      if (effect.type === "revealRole") this.state.reveals.roles[effect.roleId] = true;
      if (effect.type === "revealTab") this.state.reveals.tabs[effect.tabId] = true;
      if (effect.type === "unlockActivity") this.state.reveals.activities[effect.activityId] = true;
      if (effect.type === "setFlag") this.state.flags[effect.key] = effect.value;
      if (effect.type === "incFlagCounter") this.state.flags[effect.key] = (this.state.flags[effect.key] || 0) + 1;
      if (effect.type === "logMessage") this.log(effect.text, effect.kind || "info");
      if (effect.type === "showModal" && this.modalQueue) {
        this.modalQueue.enqueue(effect.modalId);
      }
    });
  }

  log(message, type = "info") {
    this.state.log.unshift({ message, type, timestamp: Date.now() });
    if (this.state.log.length > 200) this.state.log.pop();
  }

  // Helpers
  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getStars(staff) {
    const role = this.data.roles.find((r) => r.id === staff.roleId);
    if (!role || !role.xpToStars) return 0;
    const xp = staff.xp || 0;
    let stars = 0;
    role.xpToStars.forEach((tier) => {
      if (xp >= tier.minXp) stars = tier.stars;
    });
    return stars;
  }

  autoAssign(requirements) {
    const staffReqs = requirements?.staff || [];
    if (staffReqs.length === 0) return [];

    const chosen = [];
    for (const req of staffReqs) {
      const available = this.state.crew.staff.filter(
        (s) => s.roleId === req.roleId && s.status === "available" && !chosen.includes(s.id)
      );
      if (available.length < req.count) return [];
      available.slice(0, req.count).forEach((s) => chosen.push(s.id));
    }
    return chosen;
  }

  checkRequirements(requirements, staffIds) {
    const staffReqs = requirements?.staff || [];
    for (const req of staffReqs) {
      const matching = staffIds
        .map((id) => this.state.crew.staff.find((s) => s.id === id))
        .filter((s) => s && s.roleId === req.roleId && s.status === "available");
      if (matching.length < req.count) {
        return { ok: false, reason: `Need ${req.count} ${req.roleId}` };
      }
      if (req.starsMin) {
        const meets = matching.some((s) => this.getStars(s) >= req.starsMin);
        if (!meets) return { ok: false, reason: `Need ${req.starsMin}+ stars ${req.roleId}` };
      }
    }
    return { ok: true };
  }

  checkInputs(inputs) {
    if (!inputs?.resources) return { ok: true };
    for (const [id, amount] of Object.entries(inputs.resources)) {
      if ((this.state.resources[id] || 0) < amount) return { ok: false, reason: `Need ${amount} ${id}` };
    }
    return { ok: true };
  }

  consumeInputs(inputs) {
    if (!inputs?.resources) return;
    Object.entries(inputs.resources).forEach(([id, amount]) => {
      this.state.resources[id] = (this.state.resources[id] || 0) - amount;
    });
  }

  isActivityVisible(activity) {
    if (this.state.debugMode) return true;
    const revealed = this.state.reveals.activities[activity.id];
    const conds = activity.visibleIf || [];

    // If already revealed, always visible
    if (revealed) return true;

    // If not revealed and no conditions, visible
    if (conds.length === 0) return true;

    // If not revealed but has conditions, check if conditions are met
    return this.checkConditions(conds);
  }

  isActivityUnlocked(activity) {
    if (this.state.debugMode) return true;
    const conds = activity.unlockIf || [];
    return conds.length === 0 || this.checkConditions(conds);
  }

  isOptionUnlocked(option) {
    if (this.state.debugMode) return true;
    const conds = option.unlockIf || [];
    return conds.length === 0 || this.checkConditions(conds);
  }

  checkConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond) => this.evalCondition(cond));
  }

  evalCondition(cond) {
    if (cond.type === "flagIs") return this.state.flags[cond.key] === cond.value;
    if (cond.type === "resourceGte") return (this.state.resources[cond.resourceId] || 0) >= cond.value;
    if (cond.type === "roleRevealed") return !!this.state.reveals.roles[cond.roleId];
    if (cond.type === "activityRevealed") return !!this.state.reveals.activities[cond.activityId];
    if (cond.type === "allOf") return cond.conds.every((c) => this.evalCondition(c));
    if (cond.type === "anyOf") return cond.conds.some((c) => this.evalCondition(c));
    if (cond.type === "not") return !this.evalCondition(cond.cond);
    return false;
  }

  // Award XP to staff after successful job completion
  awardXp(staff, xpAmount) {
    if (!staff || !xpAmount || xpAmount <= 0) return;

    staff.forEach((s) => {
      // Ensure perk fields exist
      if (!s.perks) s.perks = [];
      if (!s.perkChoices) s.perkChoices = {};
      if (!s.unchosen) s.unchosen = [];

      const oldStars = this.getStars(s);
      s.xp = (s.xp || 0) + xpAmount;
      const newStars = this.getStars(s);

      if (newStars > oldStars) {
        this.onStarGained(s, newStars);
      }
    });
  }

  // Called when a staff member gains a new star
  onStarGained(staff, newStars) {
    this.log(`${staff.name} reached ${newStars} star${newStars > 1 ? 's' : ''}!`, 'success');

    // Don't queue if already has a pending choice
    if (staff.pendingPerkChoice) return;

    const role = this.data.roles.find(r => r.id === staff.roleId);
    if (!role?.perkChoices) return;

    // Star 5 is special - redemption tier (choose from unchosen perks)
    if (newStars === 5) {
      const unchosen = staff.unchosen || [];
      if (unchosen.length > 0) {
        staff.pendingPerkChoice = {
          tierId: `${staff.roleId}_redemption`,
          starsRequired: 5,
          options: [...unchosen],
          isRedemption: true
        };
        this.log(`${staff.name} can reclaim a passed perk!`, 'info');
      }
      return;
    }

    // Stars 1-4: Find the tier that just unlocked
    const newTier = role.perkChoices.find(t =>
      t.starsRequired === newStars &&
      !staff.perkChoices?.[t.tierId]
    );

    if (newTier) {
      staff.pendingPerkChoice = {
        tierId: newTier.tierId,
        starsRequired: newTier.starsRequired,
        options: [...newTier.options],
        isRedemption: false
      };
      this.log(`${staff.name} can learn a new skill!`, 'info');
    }
  }

  // Apply a perk choice for a staff member
  choosePerk(staff, perkId) {
    if (!staff.pendingPerkChoice) {
      return { ok: false, reason: 'No pending choice' };
    }

    const pending = staff.pendingPerkChoice;
    if (!pending.options.includes(perkId)) {
      return { ok: false, reason: 'Invalid perk choice' };
    }

    // Ensure arrays exist
    if (!staff.perks) staff.perks = [];
    if (!staff.perkChoices) staff.perkChoices = {};
    if (!staff.unchosen) staff.unchosen = [];

    // Add chosen perk
    staff.perks.push(perkId);
    staff.perkChoices[pending.tierId] = perkId;

    // For non-redemption choices, track the unchosen perk(s)
    if (!pending.isRedemption) {
      pending.options.forEach(opt => {
        if (opt !== perkId) {
          staff.unchosen.push(opt);
        }
      });
    } else {
      // For redemption, remove chosen from unchosen list
      staff.unchosen = staff.unchosen.filter(u => u !== perkId);
    }

    // Clear pending choice
    staff.pendingPerkChoice = null;

    const perk = this.data.perks?.[perkId];
    const perkName = perk?.name || perkId;
    this.log(`${staff.name} learned: ${perkName}`, 'success');
    this.saveState();

    return { ok: true };
  }

  // Auto-upgrade all staff with pending perk choices (random selection)
  autoUpgradeAll() {
    let upgraded = 0;

    this.state.crew.staff.forEach(staff => {
      if (staff.pendingPerkChoice) {
        const options = staff.pendingPerkChoice.options || [];
        if (options.length > 0) {
          const randomIndex = Math.floor(Math.random() * options.length);
          const result = this.choosePerk(staff, options[randomIndex]);
          if (result.ok) upgraded++;
        }
      }
    });

    if (upgraded > 0) {
      this.log(`Auto-upgraded ${upgraded} crew member${upgraded > 1 ? 's' : ''}`, 'info');
    } else {
      this.log('No pending upgrades to apply', 'info');
    }

    return upgraded;
  }
}
