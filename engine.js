export class Engine {
  constructor() {
    this.state = {
      version: 6,
      now: Date.now(),
      resources: {
        cash: 0,
        dirtyMoney: 0,
        cleanMoney: 0,
        cred: 50,
        heat: 0,
        notoriety: 0
      },
      items: {},
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
      }
    };
    this.data = {
      activities: [],
      branches: [],
      items: [],
      lexicon: {},
      resources: [],
      roles: [],
      tech: [],
      perks: {}
    };
    this.lastTick = Date.now();
  }

  async init() {
    await this.loadData();
    this.loadState();  // Load saved state before applying defaults
    this.applyDefaultReveals();
    this.log("System online.", "info");
  }

  async loadData() {
    const files = [
      ["activities.json", "activities"],
      ["branches.json", "branches"],
      ["items.json", "items"],
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
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem('ccv_game_state');
      if (!saved) {
        console.log('No saved state found, starting fresh');
        return;
      }

      const parsed = JSON.parse(saved);
      console.log('Loading saved state:', parsed);

      // Merge saved state with defaults
      this.state = {
        ...this.state,
        ...parsed,
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

      // Migrate stats if missing
      if (!this.state.stats) {
        this.state.stats = {
          lastRecorded: { second: 0, minute: 0, fiveMin: 0, hour: 0, day: 0, month: 0 },
          series: {},
          totals: { crimesCompleted: 0, crimesSucceeded: 0, crimesFailed: 0, totalEarned: 0, totalSpent: 0 }
        };
      }

      // Process any runs that should have completed while offline
      const now = Date.now();
      const completedOffline = [];

      this.state.runs.forEach((run, index) => {
        if (run.endsAt <= now) {
          completedOffline.push({ run, originalIndex: index });
        }
      });

      // Complete offline runs - completeRun handles removal/replacement
      completedOffline.forEach(({ run, originalIndex }) => {
        console.log(`Completing run that finished offline: ${run.runId}`);
        this.completeRun(run, originalIndex);
      });

      const stillActive = this.state.runs.filter(r => r.endsAt > now);
      console.log(`State loaded: ${completedOffline.length} runs completed offline, ${stillActive.length} still active`);
    } catch (err) {
      console.warn('Failed to load state:', err);
      this.log('Failed to load saved state', 'warn');
    }
  }

  resetProgress() {
    // Clear game state from localStorage
    localStorage.removeItem('ccv_game_state');
    localStorage.removeItem('ccv_seen_modals');
    // Reinitialize to default state
    this.state = {
      version: 6,
      now: Date.now(),
      resources: {
        cash: 0,
        dirtyMoney: 0,
        cleanMoney: 0,
        cred: 50,
        heat: 0,
        notoriety: 0
      },
      items: {},
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
      }
    };
    this.applyDefaultReveals();
    this.log("Progress reset. Starting fresh.", "info");
    return { ok: true };
  }

  saveState() {
    try {
      const toSave = {
        version: this.state.version,
        resources: this.state.resources,
        items: this.state.items,
        flags: this.state.flags,
        reveals: this.state.reveals,
        crew: this.state.crew,
        runs: this.state.runs,
        log: this.state.log.slice(0, 50),  // Save only last 50 log entries
        stats: this.state.stats
      };

      localStorage.setItem('ccv_game_state', JSON.stringify(toSave));
      console.log('State saved:', toSave);
    } catch (err) {
      console.warn('Failed to save state:', err);
    }
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
    // Initialize stats if missing
    if (!this.state.stats) {
      this.state.stats = {
        lastRecorded: { second: 0, minute: 0, fiveMin: 0, hour: 0, day: 0, month: 0 },
        series: {},
        totals: { crimesCompleted: 0, crimesSucceeded: 0, crimesFailed: 0, totalEarned: 0, totalSpent: 0 }
      };
    }

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
    const active = [];

    this.state.runs.forEach((run, index) => {
      if (run.endsAt <= now) {
        // Store original index for position preservation on repeat
        completed.push({ run, originalIndex: index });
      } else {
        active.push(run);
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

    const run = {
      runId: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      activityId,
      optionId,
      startedAt: this.state.now,
      endsAt: this.state.now + duration,
      assignedStaffIds: staffIds,
      runsLeft: runsLeft,  // 0 = single, N = N more after this, -1 = infinite
      snapshot: { plannedOutcomeId }
    };

    // Replace at specific index (for repeat runs) or append to end
    if (replaceIndex >= 0 && replaceIndex < this.state.runs.length) {
      this.state.runs[replaceIndex] = run;
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

    this.resolveOutcome(option, run, staff);
    if (!run.snapshot?.botched) {
      this.log(`Completed: ${activity.name} / ${option.name}`, "success");
    }

    // Handle repeat runs
    if (run.runsLeft !== 0) {
      const nextRunsLeft = run.runsLeft === -1 ? -1 : run.runsLeft - 1;

      // Try to restart with same staff, preserving position
      const result = this.startRun(
        run.activityId,
        run.optionId,
        run.assignedStaffIds,
        nextRunsLeft,
        originalIndex  // Replace at same position
      );

      if (!result.ok) {
        // Remove the completed run since restart failed
        this.state.runs = this.state.runs.filter(r => r.runId !== run.runId);
        const reasonText = String(result.reason || 'Unknown');
        const clarifiedReason = reasonText === 'No crew available'
          ? 'Assigned crew unavailable (jailed or busy)'
          : reasonText;
        this.log(`Repeat failed: ${clarifiedReason}`, 'warning');
        this.saveState();  // Save state even if repeat fails
      }
      // Note: startRun already saves state if successful
    } else {
      // Remove completed single run
      this.state.runs = this.state.runs.filter(r => r.runId !== run.runId);
      this.saveState();  // Save state after single run completion
    }
  }

  stopRun(runId) {
    const run = this.state.runs.find((r) => r.runId === runId);
    if (!run) return { ok: false, reason: 'Run not found' };

    // Mark staff available
    run.assignedStaffIds.forEach((id) => {
      const staff = this.state.crew.staff.find((s) => s.id === id);
      if (staff) staff.status = 'available';
    });

    // Remove from active runs
    this.state.runs = this.state.runs.filter((r) => r.runId !== runId);
    this.log('Run stopped (progress forfeited)', 'warning');
    this.saveState();  // Save state after stopping run
    return { ok: true };
  }

  stopRepeat(runId) {
    const run = this.state.runs.find((r) => r.runId === runId);
    if (!run) return { ok: false, reason: 'Run not found' };

    run.runsLeft = 0;  // Convert to single run
    this.log('Repeat stopped (current run will complete)', 'info');
    this.saveState();  // Save state after stopping repeat
    return { ok: true };
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
    if (!resolution) return;

    // Base XP reward for completing a job (scaled by difficulty/duration)
    const baseXp = option.xpReward || 10;
    let wasSuccessful = true;

    if (resolution.type === "deterministic") {
      this.applyOutputs(resolution.outputs);
      this.applyCred(resolution.credDelta);
      this.applyHeat(resolution.heatDelta);
      this.applyEffects(resolution.effects);
    } else if (resolution.type === "ranged_outputs") {
      this.applyRangedOutputs(resolution.outputs);
      this.applyRangedCred(resolution.credDelta);
      this.applyRangedHeat(resolution.heatDelta);
      this.applyEffects(resolution.effects);
    } else if (resolution.type === "weighted_outcomes") {
      const outcome = resolution.outcomes.find((o) => o.id === run.snapshot.plannedOutcomeId) || resolution.outcomes[0];
      if (!outcome) return;
      this.applyOutputs(outcome.outputs);
      this.applyCred(outcome.credDelta);
      this.applyHeat(outcome.heatDelta);
      this.applyEffects(outcome.effects);
      if (outcome.jail) {
        wasSuccessful = false;
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

    // Track stats totals
    if (!this.state.stats) {
      this.state.stats = {
        lastRecorded: { second: 0, minute: 0, fiveMin: 0, hour: 0, day: 0, month: 0 },
        series: {},
        totals: { crimesCompleted: 0, crimesSucceeded: 0, crimesFailed: 0, totalEarned: 0, totalSpent: 0 }
      };
    }
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
    if (!outputs) return;
    if (outputs.resources) {
      Object.entries(outputs.resources).forEach(([id, amount]) => {
        this.state.resources[id] = (this.state.resources[id] || 0) + amount;
        this.state.reveals.resources[id] = true;
      });
    }
    if (outputs.items) {
      Object.entries(outputs.items).forEach(([id, amount]) => {
        this.state.items[id] = (this.state.items[id] || 0) + amount;
      });
    }
  }

  applyRangedOutputs(outputs) {
    if (!outputs) return;
    if (outputs.resources) {
      Object.entries(outputs.resources).forEach(([id, range]) => {
        const amount = this.randomBetween(range.min, range.max);
        this.state.resources[id] = (this.state.resources[id] || 0) + amount;
        this.state.reveals.resources[id] = true;
      });
    }
    if (outputs.items) {
      Object.entries(outputs.items).forEach(([id, range]) => {
        const amount = this.randomBetween(range.min, range.max);
        this.state.items[id] = (this.state.items[id] || 0) + amount;
      });
    }
  }

  applyCred(delta) {
    if (delta === undefined || delta === null) return;
    this.state.resources.cred = Math.max(0, Math.min(100, (this.state.resources.cred || 0) + delta));
  }

  applyHeat(delta) {
    if (delta === undefined || delta === null) return;
    this.state.resources.heat = Math.max(0, (this.state.resources.heat || 0) + delta);
  }

  applyRangedCred(range) {
    if (!range) return;
    const amount = this.randomBetween(range.min, range.max);
    this.applyCred(amount);
  }

  applyRangedHeat(range) {
    if (!range) return;
    const amount = this.randomBetween(range.min, range.max);
    this.applyHeat(amount);
  }

  formatDuration(ms) {
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
    if (!inputs) return { ok: true };
    if (inputs.resources) {
      for (const [id, amount] of Object.entries(inputs.resources)) {
        if ((this.state.resources[id] || 0) < amount) return { ok: false, reason: `Need ${amount} ${id}` };
      }
    }
    if (inputs.items) {
      for (const [id, amount] of Object.entries(inputs.items)) {
        if ((this.state.items[id] || 0) < amount) return { ok: false, reason: `Need ${amount} ${id}` };
      }
    }
    return { ok: true };
  }

  consumeInputs(inputs) {
    if (!inputs) return;
    if (inputs.resources) {
      Object.entries(inputs.resources).forEach(([id, amount]) => {
        this.state.resources[id] = (this.state.resources[id] || 0) - amount;
      });
    }
    if (inputs.items) {
      Object.entries(inputs.items).forEach(([id, amount]) => {
        this.state.items[id] = (this.state.items[id] || 0) - amount;
        if (this.state.items[id] <= 0) delete this.state.items[id];
      });
    }
  }

  isActivityVisible(activity) {
    const revealed = this.state.reveals.activities[activity.id];
    const conds = activity.visibleIf || [];
    return (revealed || conds.length === 0) && this.checkConditions(conds);
  }

  isOptionUnlocked(option) {
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
    if (cond.type === "itemGte") return (this.state.items[cond.itemId] || 0) >= cond.value;
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
