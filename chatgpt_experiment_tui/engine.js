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
          { id: "s_you", name: "you", roleId: "player", xp: 0, status: "available", unavailableUntil: 0 }
        ]
      },
      runs: [],
      log: []
    };
    this.data = {
      activities: [],
      branches: [],
      items: [],
      lexicon: {},
      resources: [],
      roles: [],
      tech: []
    };
    this.lastTick = Date.now();
  }

  async init() {
    await this.loadData();
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
      ["tech.json", "tech"]
    ];

    for (const [file, key] of files) {
      try {
        const res = await fetch(`../data/${file}`);
        this.data[key] = await res.json();
      } catch (err) {
        console.warn(`Failed to load ${file}`, err);
        this.log(`Failed to load ${file}`, "warn");
      }
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
    this.lastTick = now;
  }

  processRuns(now) {
    const completed = [];
    const active = [];

    this.state.runs.forEach((run) => {
      if (run.endsAt <= now) {
        completed.push(run);
      } else {
        active.push(run);
      }
    });

    this.state.runs = active;
    completed.forEach((run) => this.completeRun(run));
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

  startRun(activityId, optionId, assignedStaffIds) {
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
      snapshot: { plannedOutcomeId }
    };

    this.state.runs.push(run);
    this.log(`Started: ${activity.name} / ${option.name}`, "info");
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

  completeRun(run) {
    const activity = this.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);
    if (!activity || !option) return;

    const staff = run.assignedStaffIds
      .map((id) => this.state.crew.staff.find((s) => s.id === id))
      .filter(Boolean);
    staff.forEach((s) => (s.status = "available"));

    this.resolveOutcome(option, run, staff);
    this.log(`Completed: ${activity.name} / ${option.name}`, "success");
  }

  resolveOutcome(option, run, staff) {
    const resolution = option.resolution;
    if (!resolution) return;

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
        staff.forEach((s) => {
          s.status = "unavailable";
          s.unavailableUntil = this.state.now + outcome.jail.durationMs;
        });
      }
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
}
