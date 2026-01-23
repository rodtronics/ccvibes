export class Engine {
  constructor(data, lexicon) {
    this.data = data;
    this.lexicon = lexicon;
    this.listeners = {};
    this.storageKey = "ccvibes_new_gpt_attempt_v6";
    this.state = Engine.defaultState(data);
    this._tickHandle = null;
    this._autosaveCounter = 0;
    this._runCounter = 0;
    this._logCounter = 0;
  }

  static defaultState(data) {
    const now = Date.now();
    const resources = {};
    for (const resource of data.resources) {
      resources[resource.id] = 0;
    }
    if (resources.cred !== undefined) resources.cred = 50;
    if (resources.heat !== undefined) resources.heat = 0;

    const reveals = {
      branches: {},
      activities: {},
      resources: {},
      roles: {},
      tabs: { jobs: true, active: true, crew: true, settings: true },
    };

    for (const branch of data.branches) {
      reveals.branches[branch.id] = !!branch.revealedByDefault;
    }
    for (const activity of data.activities) {
      reveals.activities[activity.id] = !!activity.revealedByDefault;
    }
    for (const resource of data.resources) {
      reveals.resources[resource.id] = !!resource.revealedByDefault;
    }
    for (const role of data.roles) {
      reveals.roles[role.id] = !!role.revealedByDefault;
    }

    return {
      version: 6,
      now,
      resources,
      items: {},
      flags: {},
      reveals,
      crew: {
        staff: [
          {
            id: "s_001",
            name: "Rook",
            roleId: "runner",
            xp: 0,
            status: "available",
            unavailableUntil: 0,
          },
          {
            id: "s_002",
            name: "Moth",
            roleId: "thief",
            xp: 0,
            status: "available",
            unavailableUntil: 0,
          },
          {
            id: "s_003",
            name: "Wire",
            roleId: "runner",
            xp: 0,
            status: "available",
            unavailableUntil: 0,
          },
        ],
      },
      runs: [],
      persistentOperations: [],
      completions: { activity: {}, option: {} },
      log: [],
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, payload) {
    const callbacks = this.listeners[event];
    if (!callbacks) return;
    for (const cb of callbacks) {
      cb(payload);
    }
  }

  load() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      this.state = this.normalizeState(parsed);
      this.processOfflineProgress(Date.now());
    } catch (err) {
      this.state = Engine.defaultState(this.data);
    }
  }

  save() {
    const snapshot = JSON.stringify(this.state);
    localStorage.setItem(this.storageKey, snapshot);
  }

  normalizeState(state) {
    const next = state || Engine.defaultState(this.data);
    next.version = 6;
    if (!next.resources) next.resources = {};
    for (const resource of this.data.resources) {
      if (next.resources[resource.id] === undefined) {
        next.resources[resource.id] = 0;
      }
    }
    if (next.resources.cred === undefined) next.resources.cred = 50;
    if (next.resources.heat === undefined) next.resources.heat = 0;
    next.resources.cred = clamp(next.resources.cred, 0, 100);
    next.resources.heat = Math.max(0, next.resources.heat);
    if (!next.items) next.items = {};
    if (!next.flags) next.flags = {};
    if (!next.reveals) {
      next.reveals = { branches: {}, activities: {}, resources: {}, roles: {}, tabs: {} };
    }
    next.reveals.branches = next.reveals.branches || {};
    next.reveals.activities = next.reveals.activities || {};
    next.reveals.resources = next.reveals.resources || {};
    next.reveals.roles = next.reveals.roles || {};
    next.reveals.tabs = next.reveals.tabs || {};
    for (const branch of this.data.branches) {
      if (next.reveals.branches[branch.id] === undefined) {
        next.reveals.branches[branch.id] = !!branch.revealedByDefault;
      }
    }
    for (const activity of this.data.activities) {
      if (next.reveals.activities[activity.id] === undefined) {
        next.reveals.activities[activity.id] = !!activity.revealedByDefault;
      }
    }
    for (const resource of this.data.resources) {
      if (next.reveals.resources[resource.id] === undefined) {
        next.reveals.resources[resource.id] = !!resource.revealedByDefault;
      }
    }
    for (const role of this.data.roles) {
      if (next.reveals.roles[role.id] === undefined) {
        next.reveals.roles[role.id] = !!role.revealedByDefault;
      }
    }
    if (!next.crew) next.crew = { staff: [] };
    if (!Array.isArray(next.crew.staff)) next.crew.staff = [];
    for (const staff of next.crew.staff) {
      if (!staff.status) staff.status = "available";
      if (staff.unavailableUntil === undefined) staff.unavailableUntil = 0;
    }
    if (!Array.isArray(next.runs)) next.runs = [];
    for (const run of next.runs) {
      if (run.runsLeft === undefined) run.runsLeft = 0;
      if (!run.snapshot) run.snapshot = { inputsPaid: {}, roll: null, plannedOutcomeId: null };
    }
    if (!next.persistentOperations) next.persistentOperations = [];
    if (!next.completions) next.completions = { activity: {}, option: {} };
    if (!next.log) next.log = [];
    return next;
  }

  start() {
    if (this._tickHandle) return;
    this.state.now = Date.now();
    this._tickHandle = setInterval(() => this.tick(), 50);
  }

  stop() {
    if (this._tickHandle) clearInterval(this._tickHandle);
    this._tickHandle = null;
  }

  tick() {
    const now = Date.now();
    const delta = now - this.state.now;
    this.state.now = now;
    if (delta > 0) {
      this.applyHeatDecay(delta);
      this.releaseUnavailableStaff(now);
      this.processRunCompletions(now);
    }
    this.emit("tick", { now });
    this._autosaveCounter += 1;
    if (this._autosaveCounter >= 200) {
      this._autosaveCounter = 0;
      this.save();
    }
  }

  processOfflineProgress(now) {
    const maxSteps = 200;
    let steps = 0;
    while (steps < maxSteps) {
      let nextRun = null;
      for (const run of this.state.runs) {
        if (run.endsAt <= now && (!nextRun || run.endsAt < nextRun.endsAt)) {
          nextRun = run;
        }
      }
      if (!nextRun) break;
      this.state.runs = this.state.runs.filter((run) => run.runId !== nextRun.runId);
      this.completeRun(nextRun, nextRun.endsAt, true);
      steps += 1;
    }
    if (steps === maxSteps) {
      this.addLog("Offline progress truncated.", "warn");
    }
  }

  applyHeatDecay(deltaMs) {
    const heat = this.state.resources.heat || 0;
    if (heat <= 0) return;
    const decay = Math.pow(0.9995, deltaMs / 1000);
    this.state.resources.heat = Math.max(0, heat * decay);
  }

  releaseUnavailableStaff(now) {
    for (const staff of this.state.crew.staff) {
      if (staff.status === "unavailable" && staff.unavailableUntil <= now) {
        staff.status = "available";
        staff.unavailableUntil = 0;
      }
      if (staff.status === "busy" && !this.isStaffBusy(staff.id)) {
        staff.status = "available";
      }
    }
  }

  processRunCompletions(now) {
    const completed = [];
    const active = [];
    for (const run of this.state.runs) {
      if (run.endsAt <= now) {
        completed.push(run);
      } else {
        active.push(run);
      }
    }
    if (completed.length === 0) return;
    this.state.runs = active;
    for (const run of completed) {
      this.completeRun(run, now, false);
    }
    this.emit("runsCompleted", { runs: this.state.runs });
  }

  startRun(activityId, optionId, assignedStaffIds, orderOverride, runsLeft = 0, startAtOverride = null) {
    const activity = this.getActivityById(activityId);
    const option = this.getOptionById(activityId, optionId);
    if (!activity || !option) {
      return { ok: false, error: this.lexicon.get("errors.invalid_option") || "Invalid option." };
    }
    const validation = this.validateRun(activity, option, assignedStaffIds);
    if (!validation.ok) return validation;

    const now = startAtOverride || Date.now();
    const modifierTotals = this.computeModifierTotals(option, assignedStaffIds);
    const durationMs = Math.max(1000, Math.round(option.durationMs * modifierTotals.durationMultiplier));
    const inputsPaid = this.payInputs(option.inputs);
    if (!inputsPaid.ok) return inputsPaid;

    const runId = this.nextRunId();
    const run = {
      runId,
      activityId,
      optionId,
      startedAt: now,
      endsAt: now + durationMs,
      assignedStaffIds: [...assignedStaffIds],
      runsLeft,
      snapshot: {
        inputsPaid: inputsPaid.paid,
        roll: null,
        plannedOutcomeId: null,
        durationMultiplier: modifierTotals.durationMultiplier,
      },
    };

    this.state.runs.push(run);
    for (const staffId of assignedStaffIds) {
      const staff = this.getStaffById(staffId);
      if (staff) {
        staff.status = "busy";
        staff.busyRunId = runId;
      }
    }
    this.addLog(
      this.lexicon.template("log_templates.run_started", {
        activityName: activity.name,
        optionName: option.name,
      }) || `Started: ${activity.name} - ${option.name}`
    );
    this.emit("runStarted", { run, activity, option });
    this.emit("runsCompleted", { runs: this.state.runs });
    this.emit("stateChange", { state: this.state });
    return { ok: true, run };
  }

  cancelRun(runId) {
    const run = this.state.runs.find((entry) => entry.runId === runId);
    if (!run) return false;
    this.state.runs = this.state.runs.filter((entry) => entry.runId !== runId);
    for (const staffId of run.assignedStaffIds) {
      const staff = this.getStaffById(staffId);
      if (staff && staff.status === "busy") {
        staff.status = "available";
        staff.busyRunId = null;
      }
    }
    const activity = this.getActivityById(run.activityId);
    const option = this.getOptionById(run.activityId, run.optionId);
    if (activity && option) {
      this.addLog(
        this.lexicon.template("log_templates.run_cancelled", {
          activityName: activity.name,
          optionName: option.name,
        }) || `Dropped: ${activity.name} - ${option.name}`,
        "warn"
      );
    }
    this.emit("runCancelled", { run });
    this.emit("runsCompleted", { runs: this.state.runs });
    this.emit("stateChange", { state: this.state });
    return true;
  }

  stopRepeat(runId) {
    const run = this.state.runs.find((entry) => entry.runId === runId);
    if (!run) return false;
    run.runsLeft = 0;
    const activity = this.getActivityById(run.activityId);
    const option = this.getOptionById(run.activityId, run.optionId);
    if (activity && option) {
      this.addLog(
        this.lexicon.template("log_templates.repeat_stopped", {
          activityName: activity.name,
          optionName: option.name,
        }) || `Repeat stopped: ${activity.name} - ${option.name}`
      );
    }
    this.emit("repeatStopped", { run });
    this.emit("stateChange", { state: this.state });
    return true;
  }

  completeRun(run, now, offline) {
    const activity = this.getActivityById(run.activityId);
    const option = this.getOptionById(run.activityId, run.optionId);
    if (!activity || !option) return;
    const resolution = this.resolveOption(option, run);
    this.applyResolution(resolution, run, activity, option, now);
    this.applyXp(option.xpRewards, run.assignedStaffIds);
    this.incrementCompletion(activity.id, option.id);
    this.releaseStaffFromRun(run, now);
    this.emit("runCompleted", { run, activity, option, outcome: resolution.outcomeId });
    this.emit("stateChange", { state: this.state });
    this.checkRepeat(run, activity, option, now, offline);
  }

  checkRepeat(run, activity, option, now, offline) {
    if (run.runsLeft === 0) return;
    let nextRunsLeft = run.runsLeft;
    if (run.runsLeft > 0) nextRunsLeft = run.runsLeft - 1;
    if (run.runsLeft === -1) nextRunsLeft = -1;
    const startAt = offline ? now : null;
    const result = this.startRun(
      activity.id,
      option.id,
      run.assignedStaffIds,
      null,
      nextRunsLeft,
      startAt
    );
    if (!result.ok) {
      this.addLog("Repeat failed: " + result.error, "warn");
    }
  }

  resolveOption(option, run) {
    const modifierTotals = this.computeModifierTotals(option, run.assignedStaffIds);
    const resolution = option.resolution || { type: "deterministic", outputs: {}, items: {} };
    if (resolution.type === "weighted_outcomes") {
      const outcomes = resolution.outcomes.map((outcome) => {
        const weightAdjust = modifierTotals.outcomeWeightAdjustment[outcome.id] || 0;
        const weight = Math.max(0, outcome.weight + weightAdjust);
        return { ...outcome, weight };
      });
      const total = outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
      const roll = Math.random() * (total || 1);
      let running = 0;
      let selected = outcomes[0];
      for (const outcome of outcomes) {
        running += outcome.weight;
        if (roll <= running) {
          selected = outcome;
          break;
        }
      }
      return {
        type: resolution.type,
        outcomeId: selected.id,
        outputs: resolveOutputs(selected.outputs || {}),
        items: resolveMap(selected.items || {}),
        credDelta: resolveDelta(selected.credDelta),
        heatDelta: resolveDelta(selected.heatDelta),
        effects: selected.effects || [],
        jail: selected.jail || null,
        modifiers: modifierTotals,
      };
    }
    if (resolution.type === "ranged_outputs") {
      return {
        type: resolution.type,
        outcomeId: "ranged",
        outputs: resolveOutputs(resolution.outputs || {}),
        items: resolveMap(resolution.items || {}),
        credDelta: resolveDelta(resolution.credDelta),
        heatDelta: resolveDelta(resolution.heatDelta),
        effects: resolution.effects || [],
        jail: resolution.jail || null,
        modifiers: modifierTotals,
      };
    }
    return {
      type: "deterministic",
      outcomeId: "deterministic",
      outputs: resolveOutputs(resolution.outputs || {}),
      items: resolveMap(resolution.items || {}),
      credDelta: resolveDelta(resolution.credDelta),
      heatDelta: resolveDelta(resolution.heatDelta),
      effects: resolution.effects || [],
      jail: resolution.jail || null,
      modifiers: modifierTotals,
    };
  }

  applyResolution(resolution, run, activity, option, now) {
    const modifierTotals = resolution.modifiers || defaultModifierTotals();
    const credDelta = applyDeltaModifiers(resolution.credDelta, modifierTotals.credDeltaBonus, modifierTotals.credDeltaMultiplier);
    const heatDelta = applyDeltaModifiers(resolution.heatDelta, modifierTotals.heatDeltaBonus, modifierTotals.heatDeltaMultiplier);
    if (resolution.outputs && resolution.outputs.resources) {
      for (const [resourceId, value] of Object.entries(resolution.outputs.resources)) {
        this.addResource(resourceId, value);
      }
    }
    if (resolution.outputs && resolution.outputs.items) {
      for (const [itemId, value] of Object.entries(resolution.outputs.items)) {
        this.addItem(itemId, value);
      }
    }
    if (resolution.items) {
      for (const [itemId, value] of Object.entries(resolution.items)) {
        this.addItem(itemId, value);
      }
    }
    if (typeof credDelta === "number") this.addResource("cred", credDelta);
    if (typeof heatDelta === "number") this.addResource("heat", heatDelta);
    this.state.resources.cred = clamp(this.state.resources.cred, 0, 100);
    this.state.resources.heat = Math.max(0, this.state.resources.heat);
    if (resolution.effects && resolution.effects.length) {
      for (const effect of resolution.effects) {
        this.applyEffect(effect);
      }
    }
    if (resolution.jail) {
      for (const staffId of run.assignedStaffIds) {
        const staff = this.getStaffById(staffId);
        if (!staff) continue;
        staff.status = "unavailable";
        staff.unavailableUntil = now + resolution.jail.durationMs;
        this.addLog(
          this.lexicon.template("log_templates.jail", { staffName: staff.name }) ||
            `${staff.name} is unavailable for a while`,
          "warn"
        );
      }
    }
    this.addLog(
      this.lexicon.template("log_templates.run_completed", {
        activityName: activity.name,
        optionName: option.name,
        outcomeId: resolution.outcomeId,
      }) || `Completed: ${activity.name} - ${option.name} (${resolution.outcomeId})`
    );
  }

  applyEffect(effect) {
    if (!effect) return;
    switch (effect.type) {
      case "revealBranch":
        this.state.reveals.branches[effect.branchId] = true;
        break;
      case "revealActivity":
        this.state.reveals.activities[effect.activityId] = true;
        break;
      case "revealResource":
        this.state.reveals.resources[effect.resourceId] = true;
        break;
      case "revealRole":
        this.state.reveals.roles[effect.roleId] = true;
        break;
      case "revealTab":
        this.state.reveals.tabs[effect.tabId] = true;
        break;
      case "unlockActivity":
        this.state.flags[`unlock_${effect.activityId}`] = true;
        break;
      case "unlockOption":
        this.state.flags[`unlock_${effect.activityId}_${effect.optionId}`] = true;
        break;
      case "setFlag":
        this.state.flags[effect.key] = effect.value;
        break;
      case "incFlagCounter":
        this.state.flags[effect.key] = (this.state.flags[effect.key] || 0) + (effect.value || 1);
        break;
      case "logMessage":
        this.addLog(effect.message || "", effect.level || "info");
        break;
      default:
        break;
    }
  }

  applyXp(xpRewards, staffIds) {
    if (!xpRewards || !xpRewards.onComplete) return;
    for (const staffId of staffIds) {
      const staff = this.getStaffById(staffId);
      if (staff) staff.xp += xpRewards.onComplete;
    }
  }

  incrementCompletion(activityId, optionId) {
    this.state.completions.activity[activityId] =
      (this.state.completions.activity[activityId] || 0) + 1;
    const key = `${activityId}.${optionId}`;
    this.state.completions.option[key] = (this.state.completions.option[key] || 0) + 1;
  }

  releaseStaffFromRun(run, now) {
    for (const staffId of run.assignedStaffIds) {
      const staff = this.getStaffById(staffId);
      if (!staff) continue;
      if (staff.status === "busy") {
        staff.status = "available";
        staff.busyRunId = null;
      }
      if (staff.status === "unavailable" && staff.unavailableUntil <= now) {
        staff.status = "available";
        staff.unavailableUntil = 0;
      }
    }
  }

  validateRun(activity, option, assignedStaffIds) {
    if (!this.areConditionsMet(option.unlockIf)) {
      return { ok: false, error: this.lexicon.get("errors.locked") || "Locked." };
    }
    const staffSet = new Set(assignedStaffIds);
    if (staffSet.size !== assignedStaffIds.length) {
      return { ok: false, error: this.lexicon.get("errors.invalid_option") || "Invalid option." };
    }
    const required = option.requirements?.staff || [];
    const missingRoles = [];
    for (const req of required) {
      if (req.required === false) continue;
      const count = assignedStaffIds.filter((id) => {
        const staff = this.getStaffById(id);
        return staff && staff.roleId === req.roleId;
      }).length;
      if (count < req.count) missingRoles.push(req.roleId);
    }
    if (missingRoles.length) {
      return {
        ok: false,
        error:
          this.lexicon.template("log_templates.no_slots", {
            activityName: activity.name,
            optionName: option.name,
          }) || `Required roles missing for ${activity.name} - ${option.name}`,
      };
    }
    for (const staffId of assignedStaffIds) {
      const staff = this.getStaffById(staffId);
      if (!staff) {
        return {
          ok: false,
          error:
            this.lexicon.template("log_templates.crew_unavailable", {
              activityName: activity.name,
              optionName: option.name,
            }) || `Crew unavailable for ${activity.name} - ${option.name}`,
        };
      }
      if (!this.isStaffAvailable(staffId)) {
        return {
          ok: false,
          error:
            this.lexicon.template("log_templates.crew_unavailable", {
              activityName: activity.name,
              optionName: option.name,
            }) || `Crew unavailable for ${activity.name} - ${option.name}`,
        };
      }
    }
    if (!this.hasInputs(option.inputs)) {
      return {
        ok: false,
        error:
          this.lexicon.template("log_templates.missing_resources", {
            activityName: activity.name,
            optionName: option.name,
          }) || `Missing inputs for ${activity.name} - ${option.name}`,
      };
    }
    return { ok: true };
  }

  hasInputs(inputs) {
    if (!inputs) return true;
    if (inputs.resources) {
      for (const [resourceId, amount] of Object.entries(inputs.resources)) {
        if ((this.state.resources[resourceId] || 0) < amount) return false;
      }
    }
    if (inputs.items) {
      for (const [itemId, amount] of Object.entries(inputs.items)) {
        if ((this.state.items[itemId] || 0) < amount) return false;
      }
    }
    return true;
  }

  payInputs(inputs) {
    if (!inputs) return { ok: true, paid: {} };
    if (!this.hasInputs(inputs)) {
      return { ok: false, error: "Missing inputs." };
    }
    const paid = { resources: {}, items: {} };
    if (inputs.resources) {
      for (const [resourceId, amount] of Object.entries(inputs.resources)) {
        this.state.resources[resourceId] = (this.state.resources[resourceId] || 0) - amount;
        paid.resources[resourceId] = amount;
      }
    }
    if (inputs.items) {
      for (const [itemId, amount] of Object.entries(inputs.items)) {
        this.state.items[itemId] = (this.state.items[itemId] || 0) - amount;
        paid.items[itemId] = amount;
      }
    }
    return { ok: true, paid };
  }

  addResource(resourceId, amount) {
    if (amount === undefined || amount === null) return;
    if (this.state.resources[resourceId] === undefined) this.state.resources[resourceId] = 0;
    this.state.resources[resourceId] += amount;
    if (resourceId === "cred") {
      this.state.resources.cred = clamp(this.state.resources.cred, 0, 100);
    }
    if (resourceId === "heat") {
      this.state.resources.heat = Math.max(0, this.state.resources.heat);
    }
  }

  addItem(itemId, amount) {
    if (amount === undefined || amount === null) return;
    if (this.state.items[itemId] === undefined) this.state.items[itemId] = 0;
    this.state.items[itemId] += amount;
  }

  computeModifierTotals(option, assignedStaffIds) {
    const totals = defaultModifierTotals();
    if (!option.modifiers) return totals;
    for (const modifier of option.modifiers) {
      switch (modifier.type) {
        case "heatAbove":
          if ((this.state.resources.heat || 0) > modifier.threshold) {
            applyModifierEffects(totals, modifier.effects);
          }
          break;
        case "heatBelow":
          if ((this.state.resources.heat || 0) < modifier.threshold) {
            applyModifierEffects(totals, modifier.effects);
          }
          break;
        case "flagIs":
          if (this.state.flags[modifier.key] === modifier.value) {
            applyModifierEffects(totals, modifier.effects);
          }
          break;
        case "resourceGte":
          if ((this.state.resources[modifier.resourceId] || 0) >= modifier.value) {
            applyModifierEffects(totals, modifier.effects);
          }
          break;
        case "staffStars": {
          const stars = this.getTotalStarsForRole(assignedStaffIds, modifier.roleId);
          for (let i = 0; i < stars; i += 1) {
            applyModifierEffects(totals, modifier.applyPerStar);
          }
          break;
        }
        case "staffRole": {
          const hasRole = assignedStaffIds.some((id) => {
            const staff = this.getStaffById(id);
            return staff && staff.roleId === modifier.roleId;
          });
          if (hasRole) applyModifierEffects(totals, modifier.effects);
          break;
        }
        default:
          break;
      }
    }
    return totals;
  }

  getTotalStarsForRole(staffIds, roleId) {
    let total = 0;
    for (const staffId of staffIds) {
      const staff = this.getStaffById(staffId);
      if (!staff || staff.roleId !== roleId) continue;
      total += this.getStaffStars(staff);
    }
    return total;
  }

  getStaffStars(staff) {
    const role = this.getRoleById(staff.roleId);
    if (!role) return 0;
    let stars = 0;
    for (const entry of role.xpToStars) {
      if (staff.xp >= entry.minXp) stars = entry.stars;
    }
    return stars;
  }

  isStaffAvailable(staffId) {
    const staff = this.getStaffById(staffId);
    if (!staff) return false;
    if (staff.status === "unavailable" && staff.unavailableUntil > Date.now()) return false;
    if (staff.status === "busy") return false;
    return true;
  }

  isStaffBusy(staffId) {
    return this.state.runs.some((run) => run.assignedStaffIds.includes(staffId));
  }

  addLog(message, level = "info") {
    if (!message) return;
    this._logCounter += 1;
    this.state.log.push({
      id: `log_${this._logCounter}`,
      time: Date.now(),
      message,
      level,
    });
    if (this.state.log.length > 200) {
      this.state.log.shift();
    }
    this.emit("log", { message, level });
  }

  getActivityById(activityId) {
    return this.data.activities.find((activity) => activity.id === activityId) || null;
  }

  getOptionById(activityId, optionId) {
    const activity = this.getActivityById(activityId);
    if (!activity) return null;
    return activity.options.find((option) => option.id === optionId) || null;
  }

  getBranchById(branchId) {
    return this.data.branches.find((branch) => branch.id === branchId) || null;
  }

  getRoleById(roleId) {
    return this.data.roles.find((role) => role.id === roleId) || null;
  }

  getResourceById(resourceId) {
    return this.data.resources.find((resource) => resource.id === resourceId) || null;
  }

  getStaffById(staffId) {
    return this.state.crew.staff.find((staff) => staff.id === staffId) || null;
  }

  areConditionsMet(conditions) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((cond) => this.checkCondition(cond));
  }

  checkCondition(cond) {
    if (!cond) return true;
    switch (cond.type) {
      case "flagIs":
        return this.state.flags[cond.key] === cond.value;
      case "resourceGte":
        return (this.state.resources[cond.resourceId] || 0) >= cond.value;
      case "itemGte":
        return (this.state.items[cond.itemId] || 0) >= cond.value;
      case "roleRevealed":
        return !!this.state.reveals.roles[cond.roleId];
      case "activityRevealed":
        return !!this.state.reveals.activities[cond.activityId];
      case "staffStarsGte": {
        const staff = this.state.crew.staff.find((s) => s.roleId === cond.roleId);
        if (!staff) return false;
        return this.getStaffStars(staff) >= cond.value;
      }
      case "activityCompletedGte":
        return (this.state.completions.activity[cond.activityId] || 0) >= cond.value;
      case "allOf":
        return (cond.conds || []).every((sub) => this.checkCondition(sub));
      case "anyOf":
        return (cond.conds || []).some((sub) => this.checkCondition(sub));
      case "not":
        return !this.checkCondition(cond.cond);
      default:
        return true;
    }
  }

  nextRunId() {
    this._runCounter += 1;
    return `r_${Date.now()}_${this._runCounter}`;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveDelta(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value.min !== undefined && value.max !== undefined) {
    return randomBetween(value.min, value.max);
  }
  return 0;
}

function resolveOutputs(outputs) {
  const result = { resources: {}, items: {} };
  if (outputs.resources) {
    for (const [resourceId, value] of Object.entries(outputs.resources)) {
      result.resources[resourceId] = resolveDelta(value);
    }
  }
  if (outputs.items) {
    for (const [itemId, value] of Object.entries(outputs.items)) {
      result.items[itemId] = resolveDelta(value);
    }
  }
  return result;
}

function resolveMap(map) {
  const result = {};
  for (const [key, value] of Object.entries(map)) {
    result[key] = resolveDelta(value);
  }
  return result;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function defaultModifierTotals() {
  return {
    outcomeWeightAdjustment: {},
    credDeltaBonus: 0,
    heatDeltaBonus: 0,
    credDeltaMultiplier: 1,
    heatDeltaMultiplier: 1,
    durationMultiplier: 1,
  };
}

function applyModifierEffects(totals, effects) {
  if (!effects) return;
  if (effects.outcomeWeightAdjustment) {
    for (const [key, value] of Object.entries(effects.outcomeWeightAdjustment)) {
      totals.outcomeWeightAdjustment[key] =
        (totals.outcomeWeightAdjustment[key] || 0) + value;
    }
  }
  if (effects.credDeltaBonus) totals.credDeltaBonus += effects.credDeltaBonus;
  if (effects.heatDeltaReduction) totals.heatDeltaMultiplier *= effects.heatDeltaReduction;
  if (effects.heatDeltaMultiplier) totals.heatDeltaMultiplier *= effects.heatDeltaMultiplier;
  if (effects.credDeltaMultiplier) totals.credDeltaMultiplier *= effects.credDeltaMultiplier;
  if (effects.durationMultiplier) totals.durationMultiplier *= effects.durationMultiplier;
  if (effects.heatDeltaBonus) totals.heatDeltaBonus += effects.heatDeltaBonus;
}

function applyDeltaModifiers(value, bonus, multiplier) {
  if (value === undefined || value === null) return 0;
  const base = value + bonus;
  return Math.round(base * multiplier);
}
