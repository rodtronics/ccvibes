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
      resources: { cash: 0, dirtyMoney: 0, cleanMoney: 0, streetCred: 0, heat: 0, notoriety: 0 },
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
      repeatQueues: {}, // { "activityId:optionId": { remaining: number | "infinite", total: number } }
      completions: { activity: {}, option: {} },
      log: [{ id: this.createId("log"), time: Date.now(), text: "System initialized.", kind: "info" }],
      _lastHeatDecay: Date.now()
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
    state.repeatQueues = state.repeatQueues || {};
    state.completions = state.completions || { activity: {}, option: {} };
    state.log = state.log || [];
    state._lastHeatDecay = state._lastHeatDecay || Date.now();
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

  startRun(activityId, optionId, assignedStaffIds) {
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

    const run = {
      runId: this.createId("run"),
      activityId,
      optionId,
      startedAt: this.state.now,
      endsAt: this.state.now + option.durationMs,
      assignedStaffIds: assignedStaffIds,
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
    const message = window.Lexicon?.template('log_templates.run_started', {
      activityName: activity.name,
      optionName: option.name
    }) || `Started: ${activity.name} → ${option.name}`;
    this.addLog(message, "info");

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

    return { ok: true };
  },

  setRepeatQueue(activityId, optionId, count) {
    const key = `${activityId}:${optionId}`;
    if (count === 0) {
      delete this.state.repeatQueues[key];
    } else if (count === "infinite") {
      this.state.repeatQueues[key] = { remaining: "infinite", total: "infinite" };
    } else {
      this.state.repeatQueues[key] = { remaining: count, total: count };
    }
  },

  stopRepeatQueue(activityId, optionId) {
    const key = `${activityId}:${optionId}`;
    delete this.state.repeatQueues[key];
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
  },

  checkRepeatQueue(run) {
    // Check for repeat queue and auto-restart
    // Called AFTER run is removed from array and staff are freed
    const queueKey = `${run.activityId}:${run.optionId}`;
    const queue = this.state.repeatQueues[queueKey];

    if (queue) {
      // Auto-restart with same staff
      const result = this.startRun(run.activityId, run.optionId, run.assignedStaffIds);

      if (result.ok) {
        // Decrement queue if not infinite
        if (queue.remaining !== "infinite") {
          queue.remaining--;
          if (queue.remaining <= 0) {
            delete this.state.repeatQueues[queueKey];
          }
        }
      } else {
        // Can't restart, stop queue
        delete this.state.repeatQueues[queueKey];
        const message = window.Lexicon?.template('log_templates.repeat_stopped', { reason: result.reason })
          || `Repeat stopped: ${result.reason}`;
        this.addLog(message, "warn");
      }
    }
  },

  resolveOutcome(option, run, staff) {
    const resolution = option.resolution;
    if (!resolution) return;

    if (resolution.type === "deterministic") {
      this.applyOutputs(resolution.outputs);
      this.applyHeatDelta(resolution.heatDelta);
      this.applyEffects(resolution.effects || []);
    }
    else if (resolution.type === "ranged_outputs") {
      this.applyRangedOutputs(resolution.outputs);
      this.applyRangedHeat(resolution.heatDelta);
      this.applyEffects(resolution.effects || []);
    }
    else if (resolution.type === "weighted_outcomes") {
      const outcomeId = run.snapshot.plannedOutcomeId;
      const outcome = resolution.outcomes.find(o => o.id === outcomeId);

      if (outcome) {
        this.applyOutputs(outcome.outputs);
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

      // Check if we have enough staff for this role
      if (candidates.length < req.count) {
        return { ok: false, reason: `Need ${req.count} ${req.roleId}, only ${candidates.length} available` };
      }

      // Check if any meet the star requirement
      if (req.starsMin) {
        const qualified = candidates.filter(s => this.getStarsForStaff(s) >= req.starsMin);
        if (qualified.length === 0) {
          return { ok: false, reason: `Need ${req.starsMin}★ ${req.roleId}` };
        }
      }

      // Assign the required count
      for (let i = 0; i < req.count; i++) {
        assignedIds.push(candidates[i].id);
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

  applyHeatDelta(heatDelta) {
    if (typeof heatDelta === "number") {
      this.state.resources.heat = (this.state.resources.heat || 0) + heatDelta;
    }
  },

  applyRangedHeat(heatDelta) {
    if (heatDelta && heatDelta.min !== undefined) {
      const amount = this.randomRange(heatDelta.min, heatDelta.max);
      this.state.resources.heat = (this.state.resources.heat || 0) + amount;
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
    this.state.log.push({
      id: this.createId("log"),
      time: this.state.now,
      text,
      kind
    });

    if (this.state.log.length > 200) {
      this.state.log = this.state.log.slice(-200);
    }
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
  }
};
