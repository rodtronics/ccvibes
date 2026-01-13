/**
 * Crime Committer VI - Schema-Compliant Engine
 * Implements schema.md exactly - all behavior emerges from data
 */

const Engine = {
  state: null,
  content: {
    branches: [],
    resources: [],
    items: [],
    roles: [],
    activities: []
  },
  listeners: [],

  init(savedState = null) {
    if (savedState) {
      this.state = this.normalizeState(savedState);
    } else {
      this.state = this.createDefaultState();
    }
    this.processOfflineRuns();
    return this.state;
  },

  createDefaultState() {
    return {
      version: 6,
      now: Date.now(),
      resources: { cash: 0, dirtyMoney: 0, cleanMoney: 0, cred: 50, heat: 0, notoriety: 0 },
      items: {},
      flags: {},
      reveals: { branches: {}, activities: {}, resources: {}, roles: {}, tabs: {} },
      crew: {
        staff: [{
          id: "s_000",
          name: "You",
          roleId: "player",
          xp: 0,
          status: "available",
          unavailableUntil: 0
        }]
      },
      runs: [],
      completions: { activity: {}, option: {} },
      log: [{ id: this.createId("log"), time: Date.now(), text: "System initialized.", kind: "info" }],
      _lastHeatDecay: Date.now(),
      _runOrderCounter: 0
    };
  },

  normalizeState(state) {
    state.version = state.version || 6;
    state.now = Date.now();
    state.resources = state.resources || {};
    state.items = state.items || {};
    state.flags = state.flags || {};
    state.reveals = state.reveals || { branches: {}, activities: {}, resources: {}, roles: {}, tabs: {} };
    state.crew = state.crew || { staff: [] };
    state.runs = state.runs || [];
    state.completions = state.completions || { activity: {}, option: {} };
    state.log = state.log || [];
    state._lastHeatDecay = state._lastHeatDecay || Date.now();
    // Populate missing order indices and counter for stable run ordering
    let maxOrder = state._runOrderCounter || 0;
    state.runs.forEach((run, idx) => {
      if (run.order === undefined || run.order === null) {
        run.order = idx + 1;
      }
      if (run.order > maxOrder) maxOrder = run.order;
      // Migration: Add runsLeft to existing runs (they're all single runs)
      if (run.runsLeft === undefined) {
        run.runsLeft = 0;
      }
    });
    state._runOrderCounter = maxOrder;
    // Migration: Remove old repeatQueues if it exists
    if (state.repeatQueues) {
      delete state.repeatQueues;
    }
    return state;
  },

  loadContent(content) {
    this.content = {
      branches: content.branches || [],
      resources: content.resources || [],
      items: content.items || [],
      roles: content.roles || [],
      activities: content.activities || []
    };

    // Auto-reveal defaults
    this.content.resources.forEach(r => {
      if (r.revealedByDefault) this.state.reveals.resources[r.id] = true;
    });
    this.content.roles.forEach(r => {
      if (r.revealedByDefault) this.state.reveals.roles[r.id] = true;
    });
    this.content.branches.forEach(b => {
      if (b.revealedByDefault) this.state.reveals.branches[b.id] = true;
    });
  },

  tick() {
    this.state.now = Date.now();
    const didComplete = this.processCompletedRuns();
    this.updateStaffAvailability();
    this.decayHeat();
    this.emit('tick');
    if (didComplete) {
      this.emit('runsCompleted');
    }
    return didComplete;
  },

  processOfflineRuns() {
    const completed = this.state.runs.filter(run => run.endsAt <= this.state.now);

    // Process completions (awards, effects, etc)
    completed.forEach(run => this.completeRun(run));

    // Remove completed runs
    this.state.runs = this.state.runs.filter(run => run.endsAt > this.state.now);

    // Handle repeat queues (staff are free, old runs removed)
    completed.forEach(run => this.checkRepeatQueue(run));
  },

  processCompletedRuns() {
    const now = this.state.now;
    const completed = [];
    const remaining = [];

    this.state.runs.forEach(run => {
      if (run.endsAt <= now) {
        completed.push(run);
      } else {
        remaining.push(run);
      }
    });

    if (completed.length > 0) {
      // Process completions (awards, effects, etc)
      completed.forEach(run => this.completeRun(run));

      // Remove completed runs from array
      this.state.runs = remaining;

      // NOW handle repeat queues (staff are free, old runs removed)
      completed.forEach(run => this.checkRepeatQueue(run));

      return true;
    }
    return false;
  },

  updateStaffAvailability() {
    const now = this.state.now;
    this.state.crew.staff.forEach(s => {
      if (s.status === "unavailable" && s.unavailableUntil <= now) {
        s.status = "available";
        s.unavailableUntil = 0;
        this.addLog(`${s.name} is now available.`, "info");
      }
    });
  },

  decayHeat() {
    const elapsed = this.state.now - this.state._lastHeatDecay;
    const decayTicks = Math.floor(elapsed / 60000); // Every 60s

    if (decayTicks > 0 && this.state.resources.heat > 0) {
      this.state.resources.heat = Math.max(0, this.state.resources.heat - decayTicks);
      this.state._lastHeatDecay = this.state.now;
    }
  },

  startRun(activityId, optionId, assignedStaffIds, orderOverride = null, runsLeft = 0) {
    const activity = this.content.activities.find(a => a.id === activityId);
    if (!activity) return { ok: false, reason: "Activity not found" };

    const option = activity.options.find(o => o.id === optionId);
    if (!option) return { ok: false, reason: "Option not found" };

    if (!this.checkConditions(option.visibleIf || [])) {
      return { ok: false, reason: "Option not visible" };
    }

    if (!this.checkConditions(option.unlockIf || [])) {
      return { ok: false, reason: "Option locked" };
    }

    // Check concurrency limit
    if (option.maxConcurrentRuns !== undefined) {
      const activeRunCount = this.state.runs.filter(r => r.activityId === activityId && r.optionId === optionId).length;
      if (activeRunCount >= option.maxConcurrentRuns) {
        return { ok: false, reason: `Max ${option.maxConcurrentRuns} concurrent run${option.maxConcurrentRuns === 1 ? '' : 's'} reached` };
      }
    }

    // Auto-assign staff if not explicitly provided (legacy behavior until crew selection modal is implemented)
    if (!assignedStaffIds) {
      const autoAssigned = this.autoAssignStaff(option.requirements);
      if (!autoAssigned.ok) return autoAssigned;
      assignedStaffIds = autoAssigned.staffIds;
    }

    const reqCheck = this.checkRequirements(option.requirements, assignedStaffIds);
    if (!reqCheck.ok) return reqCheck;

    const inputCheck = this.checkInputs(option.inputs);
    if (!inputCheck.ok) return inputCheck;

    this.consumeInputs(option.inputs);

    const staff = assignedStaffIds.map(id => this.state.crew.staff.find(s => s.id === id)).filter(Boolean);
    staff.forEach(s => { s.status = "busy"; });

    // Monotonic order index for stable sorting of runs in UI
    const order = orderOverride !== null
      ? orderOverride
      : ((this.state._runOrderCounter || 0) + 1);
    this.state._runOrderCounter = Math.max(this.state._runOrderCounter || 0, order);

    const run = {
      runId: this.createId("run"),
      activityId,
      optionId,
      startedAt: this.state.now,
      endsAt: this.state.now + option.durationMs,
      order,
      assignedStaffIds: assignedStaffIds,
      runsLeft: runsLeft, // 0 = single run, -1 = infinite, N = repeat N more times
      snapshot: {
        inputsPaid: option.inputs || {},
        roll: null,
        plannedOutcomeId: null
      }
    };

    if (option.resolution && option.resolution.type === "weighted_outcomes") {
      const outcome = this.rollOutcome(option, staff);
      run.snapshot.roll = outcome.roll;
      run.snapshot.plannedOutcomeId = outcome.id;
    }

    this.state.runs.push(run);
    // Keep runs ordered by their stable order index to avoid jumping in UI
    this.state.runs.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.startedAt - b.startedAt;
    });
    const message = window.Lexicon?.template('log_templates.run_started', {
      activityName: activity.name,
      optionName: option.name
    }) || `Started: ${activity.name} → ${option.name}`;
    this.addLog(message, "info");

    this.emit('runStarted', { run, activity, option });
    this.emit('stateChange');

    return { ok: true, run };
  },

  cancelRun(runId) {
    const runIndex = this.state.runs.findIndex(r => r.runId === runId);
    if (runIndex === -1) return { ok: false, reason: "Run not found" };

    const run = this.state.runs[runIndex];
    const activity = this.content.activities.find(a => a.id === run.activityId);
    const option = activity?.options.find(o => o.id === run.optionId);

    // Free assigned staff
    const staff = run.assignedStaffIds.map(id => this.state.crew.staff.find(s => s.id === id)).filter(Boolean);
    staff.forEach(s => {
      if (s.status === "busy") s.status = "available";
    });

    // Remove run from state
    this.state.runs.splice(runIndex, 1);

    const activityName = activity?.name || "Unknown";
    const optionName = option?.name || "Unknown";
    const message = window.Lexicon?.template('log_templates.run_dropped', { activityName, optionName })
      || `Dropped: ${activityName} → ${optionName}`;
    this.addLog(message, "warn");

    this.emit('runCancelled', { run, activity, option });
    this.emit('stateChange');

    return { ok: true };
  },

  stopRepeat(runId) {
    // Stop a run from repeating by setting runsLeft to 0
    // The current iteration will finish, but it won't restart
    const run = this.state.runs.find(r => r.runId === runId);
    if (run) {
      run.runsLeft = 0;
      this.emit('repeatStopped', { run });
      this.emit('stateChange');
    }
  },

  completeRun(run) {
    const activity = this.content.activities.find(a => a.id === run.activityId);
    const option = activity?.options.find(o => o.id === run.optionId);

    if (!activity || !option) {
      this.addLog("Run completed but definition missing", "warn");
      return;
    }

    const staff = run.assignedStaffIds.map(id => this.state.crew.staff.find(s => s.id === id)).filter(Boolean);
    staff.forEach(s => {
      if (s.status === "busy") s.status = "available";
    });

    if (option.xpRewards && option.xpRewards.onComplete) {
      staff.forEach(s => {
        s.xp = (s.xp || 0) + option.xpRewards.onComplete;
      });
    }

    this.resolveOutcome(option, run, staff);

    this.state.completions.option[run.optionId] = (this.state.completions.option[run.optionId] || 0) + 1;
    this.state.completions.activity[run.activityId] = (this.state.completions.activity[run.activityId] || 0) + 1;

    const message = window.Lexicon?.template('log_templates.run_completed', {
      activityName: activity.name,
      optionName: option.name
    }) || `Completed: ${activity.name} → ${option.name}`;
    this.addLog(message, "success");

    this.emit('runCompleted', { run, activity, option });
  },

  checkRepeatQueue(run) {
    // Check if this run should repeat and auto-restart
    // Called AFTER run is removed from array and staff are freed

    // Check runsLeft: 0 = don't repeat, -1 = infinite, N > 0 = repeat N more times
    if (run.runsLeft === 0) return; // Single run, no repeat

    // Calculate new runsLeft for the next iteration
    let newRunsLeft = run.runsLeft;
    if (run.runsLeft > 0) {
      newRunsLeft = run.runsLeft - 1; // Decrement countdown
    }
    // If runsLeft is -1 (infinite), it stays -1

    // Auto-restart with same staff, preserving order for stable display
    const result = this.startRun(run.activityId, run.optionId, run.assignedStaffIds, run.order, newRunsLeft);

    if (!result.ok) {
      // Can't restart, stop repeating
      const message = window.Lexicon?.template('log_templates.repeat_stopped', { reason: result.reason })
        || `Repeat stopped: ${result.reason}`;
      this.addLog(message, "warn");
    }
  },

  resolveOutcome(option, run, staff) {
    const resolution = option.resolution;
    if (!resolution) return;

    if (resolution.type === "deterministic") {
      this.applyOutputs(resolution.outputs);
      this.applyCredDelta(resolution.credDelta);
      this.applyHeatDelta(resolution.heatDelta);
      this.applyEffects(resolution.effects || []);
    }
    else if (resolution.type === "ranged_outputs") {
      this.applyRangedOutputs(resolution.outputs);
      this.applyRangedCred(resolution.credDelta);
      this.applyRangedHeat(resolution.heatDelta);
      this.applyEffects(resolution.effects || []);
    }
    else if (resolution.type === "weighted_outcomes") {
      const outcomeId = run.snapshot.plannedOutcomeId;
      const outcome = resolution.outcomes.find(o => o.id === outcomeId);

      if (outcome) {
        this.applyOutputs(outcome.outputs);
        this.applyCredDelta(outcome.credDelta);
        this.applyHeatDelta(outcome.heatDelta);
        this.applyEffects(outcome.effects || []);

        if (outcome.jail) {
          staff.forEach(s => {
            s.status = "unavailable";
            s.unavailableUntil = this.state.now + outcome.jail.durationMs;
          });
          this.addLog(`Staff jailed for ${this.formatDuration(outcome.jail.durationMs)}`, "warn");
        }
      }
    }
  },

  rollOutcome(option, staff) {
    const resolution = option.resolution;
    if (resolution.type !== "weighted_outcomes") return null;

    let outcomes = JSON.parse(JSON.stringify(resolution.outcomes));

    if (option.modifiers) {
      option.modifiers.forEach(mod => {
        outcomes = this.applyModifier(mod, outcomes, staff);
      });
    }

    const totalWeight = outcomes.reduce((sum, o) => sum + Math.max(0, o.weight), 0);
    const roll = Math.random() * totalWeight;

    let cumulative = 0;
    for (const outcome of outcomes) {
      cumulative += Math.max(0, outcome.weight);
      if (roll < cumulative) {
        return { id: outcome.id, roll };
      }
    }

    return { id: outcomes[0].id, roll };
  },

  applyModifier(modifier, outcomes, staff) {
    if (modifier.type === "staffStars") {
      const targetStaff = staff.find(s => s.roleId === modifier.roleId);
      if (!targetStaff) return outcomes;

      const stars = this.getStarsForStaff(targetStaff);
      const deltas = modifier.applyPerStar || {};

      outcomes.forEach(outcome => {
        Object.entries(deltas).forEach(([key, deltaPerStar]) => {
          if (key.endsWith("WeightDelta")) {
            const outcomeKey = key.replace("WeightDelta", "");
            if (outcome.id === outcomeKey) {
              outcome.weight = Math.max(0, outcome.weight + (deltaPerStar * stars));
            }
          }
        });
      });
    }

    return outcomes;
  },

  getStarsForStaff(staff) {
    const role = this.content.roles.find(r => r.id === staff.roleId);
    if (!role || !role.xpToStars) return 0;

    const xp = staff.xp || 0;
    let stars = 0;

    for (const tier of role.xpToStars) {
      if (xp >= tier.minXp) {
        stars = tier.stars;
      }
    }

    return stars;
  },

  checkConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(cond => this.evalCondition(cond));
  },

  evalCondition(cond) {
    if (cond.type === "flagIs") return this.state.flags[cond.key] === cond.value;
    if (cond.type === "resourceGte") return (this.state.resources[cond.resourceId] || 0) >= cond.value;
    if (cond.type === "itemGte") return (this.state.items[cond.itemId] || 0) >= cond.value;
    if (cond.type === "roleRevealed") return this.state.reveals.roles[cond.roleId] === true;
    if (cond.type === "activityRevealed") return this.state.reveals.activities[cond.activityId] === true;
    if (cond.type === "allOf") return cond.conds.every(c => this.evalCondition(c));
    if (cond.type === "anyOf") return cond.conds.some(c => this.evalCondition(c));
    if (cond.type === "not") return !this.evalCondition(cond.cond);
    return false;
  },

  autoAssignStaff(requirements) {
    if (!requirements || !requirements.staff || requirements.staff.length === 0) {
      return { ok: true, staffIds: [] };
    }

    const assignedIds = [];

    for (const req of requirements.staff) {
      // Find available staff matching this role
      const candidates = this.state.crew.staff.filter(s =>
        s.roleId === req.roleId &&
        s.status === "available" &&
        !assignedIds.includes(s.id) // Don't assign same person twice
      );

      // Sort by stars (best first) to assign the most qualified
      candidates.sort((a, b) => this.getStarsForStaff(b) - this.getStarsForStaff(a));

      // Filter by star requirement if specified
      let qualified = candidates;
      if (req.starsMin) {
        qualified = candidates.filter(s => this.getStarsForStaff(s) >= req.starsMin);
        if (qualified.length === 0) {
          return { ok: false, reason: `Need ${req.starsMin}★ ${req.roleId}` };
        }
      }

      // Check if we have enough qualified staff for this role
      if (qualified.length < req.count) {
        return { ok: false, reason: `Need ${req.count} ${req.roleId}${req.starsMin ? ` (${req.starsMin}★+)` : ''}, only ${qualified.length} available` };
      }

      // Assign the required count from qualified candidates
      for (let i = 0; i < req.count; i++) {
        assignedIds.push(qualified[i].id);
      }
    }

    return { ok: true, staffIds: assignedIds };
  },

  checkRequirements(requirements, assignedStaffIds) {
    if (!requirements) return { ok: true };

    if (requirements.staff && requirements.staff.length > 0) {
      for (const req of requirements.staff) {
        const matchingStaff = assignedStaffIds
          .map(id => this.state.crew.staff.find(s => s.id === id))
          .filter(s => s && s.roleId === req.roleId && s.status === "available");

        if (matchingStaff.length < req.count) {
          return { ok: false, reason: `Need ${req.count} ${req.roleId}` };
        }

        if (req.starsMin) {
          const hasEnoughStars = matchingStaff.some(s => this.getStarsForStaff(s) >= req.starsMin);
          if (!hasEnoughStars) {
            return { ok: false, reason: `Need ${req.starsMin}★ ${req.roleId}` };
          }
        }
      }
    }

    return { ok: true };
  },

  checkInputs(inputs) {
    if (!inputs) return { ok: true };

    if (inputs.resources) {
      for (const [resId, amount] of Object.entries(inputs.resources)) {
        if ((this.state.resources[resId] || 0) < amount) {
          return { ok: false, reason: `Need ${amount} ${resId}` };
        }
      }
    }

    if (inputs.items) {
      for (const [itemId, amount] of Object.entries(inputs.items)) {
        if ((this.state.items[itemId] || 0) < amount) {
          return { ok: false, reason: `Need ${amount} ${itemId}` };
        }
      }
    }

    return { ok: true };
  },

  consumeInputs(inputs) {
    if (!inputs) return;

    if (inputs.resources) {
      for (const [resId, amount] of Object.entries(inputs.resources)) {
        this.state.resources[resId] = (this.state.resources[resId] || 0) - amount;
      }
    }

    if (inputs.items) {
      for (const [itemId, amount] of Object.entries(inputs.items)) {
        this.state.items[itemId] = (this.state.items[itemId] || 0) - amount;
        if (this.state.items[itemId] <= 0) delete this.state.items[itemId];
      }
    }
  },

  applyOutputs(outputs) {
    if (!outputs) return;

    if (outputs.resources) {
      for (const [resId, amount] of Object.entries(outputs.resources)) {
        this.state.resources[resId] = (this.state.resources[resId] || 0) + amount;
      }
    }

    if (outputs.items) {
      for (const [itemId, amount] of Object.entries(outputs.items)) {
        this.state.items[itemId] = (this.state.items[itemId] || 0) + amount;
      }
    }
  },

  applyRangedOutputs(outputs) {
    if (!outputs) return;

    if (outputs.resources) {
      for (const [resId, range] of Object.entries(outputs.resources)) {
        const amount = this.randomRange(range.min, range.max);
        this.state.resources[resId] = (this.state.resources[resId] || 0) + amount;
      }
    }

    if (outputs.items) {
      for (const [itemId, range] of Object.entries(outputs.items)) {
        const amount = this.randomRange(range.min, range.max);
        this.state.items[itemId] = (this.state.items[itemId] || 0) + amount;
      }
    }
  },

  applyCredDelta(credDelta) {
    if (typeof credDelta === "number") {
      const newCred = (this.state.resources.cred || 0) + credDelta;
      // Clamp cred to 0-100 range per schema
      this.state.resources.cred = Math.max(0, Math.min(100, newCred));
    }
  },

  applyRangedCred(credDelta) {
    if (credDelta && credDelta.min !== undefined) {
      const amount = this.randomRange(credDelta.min, credDelta.max);
      const newCred = (this.state.resources.cred || 0) + amount;
      // Clamp cred to 0-100 range per schema
      this.state.resources.cred = Math.max(0, Math.min(100, newCred));
    }
  },

  applyHeatDelta(heatDelta) {
    if (typeof heatDelta === "number") {
      this.state.resources.heat = Math.max(0, (this.state.resources.heat || 0) + heatDelta);
    }
  },

  applyRangedHeat(heatDelta) {
    if (heatDelta && heatDelta.min !== undefined) {
      const amount = this.randomRange(heatDelta.min, heatDelta.max);
      this.state.resources.heat = Math.max(0, (this.state.resources.heat || 0) + amount);
    }
  },

  applyEffects(effects) {
    if (!effects) return;

    effects.forEach(effect => {
      if (effect.type === "revealBranch") {
        this.state.reveals.branches[effect.branchId] = true;
      }
      else if (effect.type === "revealActivity") {
        this.state.reveals.activities[effect.activityId] = true;
      }
      else if (effect.type === "revealResource") {
        this.state.reveals.resources[effect.resourceId] = true;
      }
      else if (effect.type === "revealRole") {
        this.state.reveals.roles[effect.roleId] = true;
      }
      else if (effect.type === "revealTab") {
        this.state.reveals.tabs[effect.tabId] = true;
      }
      else if (effect.type === "unlockActivity") {
        if (!this.state.reveals.activities[effect.activityId]) {
          this.state.reveals.activities[effect.activityId] = true;
          this.addLog(`Discovered: ${effect.activityId}`, "info");
        }
      }
      else if (effect.type === "setFlag") {
        this.state.flags[effect.key] = effect.value;
      }
      else if (effect.type === "incFlagCounter") {
        this.state.flags[effect.key] = (this.state.flags[effect.key] || 0) + 1;
      }
      else if (effect.type === "logMessage") {
        this.addLog(effect.text, effect.kind || "info");
      }
    });
  },

  randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  addLog(text, kind = "info") {
    const entry = {
      id: this.createId("log"),
      time: this.state.now,
      text,
      kind
    };
    this.state.log.push(entry);

    if (this.state.log.length > 200) {
      this.state.log = this.state.log.slice(-200);
    }

    this.emit('log', entry);
  },

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  },

  // DEBUG: Add random crew member
  addRandomCrew() {
    const names = ["Alex", "Blake", "Casey", "Drew", "Ellis", "Finley", "Gray", "Harper", "Indigo", "Jordan", "Kelly", "Logan", "Morgan", "Nova", "Parker", "Quinn", "Riley", "Sage", "Taylor", "West"];

    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomXp = Math.floor(Math.random() * 500);

    const newStaff = {
      id: this.createId("s"),
      name: randomName,
      roleId: "player",
      xp: randomXp,
      status: "available",
      unavailableUntil: 0
    };

    this.state.crew.staff.push(newStaff);
    this.addLog(`Hired ${randomName} (${randomXp} XP)`, "info");
    this.emit('stateChange');
    return newStaff;
  },

  // Event System (Pub/Sub Pattern)
  on(event, callback) {
    this.listeners.push({ event, callback });
  },

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }
};
