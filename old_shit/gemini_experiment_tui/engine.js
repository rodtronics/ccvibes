export class Engine {
    constructor() {
        this.state = {
            version: 6,
            now: Date.now(),
            resources: {
                cash: 100, // Starting cash for testing
                dirtyMoney: 0,
                cleanMoney: 0,
                cred: 50,
                heat: 0,
                notoriety: 0
            },
            items: {},
            flags: {},
            reveals: {
                branches: { "street": true }, // Default reveals
                activities: {},
                resources: { "cash": true, "heat": true, "cred": true },
                roles: {},
                tabs: { "activities": true, "log": true }
            },
            settings: {
                font: 'vga' // 'vga' or 'modern'
            },
            crew: {
                staff: [
                    // Starter crew
                    { id: "s_001", name: "Rookie", roleId: "player", xp: 0, status: "available", unavailableUntil: 0 }
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
        this.log("System initialized.", "info");
    }

    async loadData() {
        const load = async (file, target) => {
            try {
                const res = await fetch(`../data/${file}`);
                this.data[target] = await res.json();
                this.log(`Loaded ${file}`, "info");
            } catch (e) {
                console.warn(`Failed to load ${file}:`, e);
                this.log(`Failed to load ${file}`, "warn");
            }
        };

        await Promise.all([
            load('activities.json', 'activities'),
            load('branches.json', 'branches'),
            load('items.json', 'items'),
            load('lexicon.json', 'lexicon'),
            load('resources.json', 'resources'),
            load('roles.json', 'roles'),
            load('tech.json', 'tech')
        ]);
    }

    tick() {
        const now = Date.now();
        const delta = now - this.lastTick;
        this.state.now = now;

        // Process active runs
        this.state.runs.forEach((run, index) => {
            if (run.endsAt <= now && !run.completed) {
                this.completeRun(run);
            }
        });

        // Heat decay (simplified)
        if (this.state.resources.heat > 0 && Math.random() < 0.01) {
             this.state.resources.heat = Math.max(0, this.state.resources.heat - 1);
        }

        // Staff recovery
        this.state.crew.staff.forEach(staff => {
             if (staff.status === "unavailable" && staff.unavailableUntil <= now) {
                 staff.status = "available";
                 this.log(`${staff.name} is back in action.`, "info");
             }
        });

        this.lastTick = now;
    }

    startRun(activityId, optionId, assignedStaffIds) {
        const activity = this.data.activities.find(a => a.id === activityId);
        const option = activity.options.find(o => o.id === optionId);

        // Validation (simplified for prototype)
        // Check staff availability
        const staff = this.state.crew.staff.filter(s => assignedStaffIds.includes(s.id));
        if (staff.some(s => s.status !== "available")) {
            this.log("Staff unavailable!", "error");
            return;
        }

        // Set staff busy
        staff.forEach(s => s.status = "busy");

        const duration = option.durationMs || 5000;

        const run = {
            runId: `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            activityId,
            optionId,
            startedAt: this.state.now,
            endsAt: this.state.now + duration,
            assignedStaffIds,
            completed: false
        };

        this.state.runs.push(run);
        this.log(`Started: ${activity.name} - ${option.name}`, "info");
    }

    completeRun(run) {
        run.completed = true;
        const activity = this.data.activities.find(a => a.id === run.activityId);
        const option = activity.options.find(o => o.id === run.optionId);

        // Free staff
        const staff = this.state.crew.staff.filter(s => run.assignedStaffIds.includes(s.id));
        staff.forEach(s => s.status = "available");

        // Resolve outcome (simplified - just take first outcome or success)
        // In real engine, we'd roll weights
        let outcome = null;
        if (option.resolution && option.resolution.outcomes) {
             // Simple weighted random
             const roll = Math.random() * 100;
             let cumulative = 0;
             for (const out of option.resolution.outcomes) {
                 cumulative += out.weight;
                 if (roll <= cumulative) {
                     outcome = out;
                     break;
                 }
             }
             if (!outcome) outcome = option.resolution.outcomes[0];
        }

        if (outcome) {
            this.applyEffects(outcome);
            this.log(`Completed: ${activity.name} - ${option.name} [${outcome.id}]`, outcome.id === "caught" ? "error" : "success");
        } else {
             this.log(`Completed: ${activity.name} - ${option.name}`, "success");
        }

        // Remove run from active list eventually, or keep in history
        this.state.runs = this.state.runs.filter(r => r.runId !== run.runId);
    }

    applyEffects(outcome) {
        // Resources
        if (outcome.outputs && outcome.outputs.resources) {
            for (const [resId, amount] of Object.entries(outcome.outputs.resources)) {
                // Handle ranged/fixed
                const val = (typeof amount === 'object') ? (amount.min + Math.random() * (amount.max - amount.min)) : amount;
                this.state.resources[resId] = (this.state.resources[resId] || 0) + Math.floor(val);
                this.state.reveals.resources[resId] = true;
            }
        }
        
        // Heat/Cred
        if (outcome.heatDelta) this.state.resources.heat = Math.max(0, (this.state.resources.heat || 0) + outcome.heatDelta);
        if (outcome.credDelta) this.state.resources.cred = Math.max(0, Math.min(100, (this.state.resources.cred || 0) + outcome.credDelta));
        
        // Jail/Consequences
        if (outcome.jail) {
             // Jail all assigned staff
             // We need to know who was assigned, but 'outcome' doesn't have it.
             // Ideally we pass context. For now, skip.
        }
    }

    log(message, type = "info") {
        this.state.log.unshift({
            timestamp: Date.now(),
            message,
            type
        });
        if (this.state.log.length > 50) this.state.log.pop();
    }
}
