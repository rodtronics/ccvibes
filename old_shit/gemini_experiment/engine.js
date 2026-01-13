class GameEngine {
    constructor() {
        this.version = 6;
        this.state = {
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
                tabs: {}
            },
            crew: {
                staff: []
            },
            runs: [],
            log: []
        };
        
        this.data = {
            activities: {},
            branches: {},
            items: {},
            roles: {},
            resources: {},
            tech: {}
        };

        this.listeners = [];
    }

    async init() {
        try {
            await Promise.all([
                this.loadData('activities'),
                this.loadData('branches'),
                this.loadData('items'),
                this.loadData('resources'),
                this.loadData('roles'),
                this.loadData('tech')
            ]);
            
            // Initial State Setup if empty
            // For prototype, we mock some starter data if needed
            if (this.state.crew.staff.length === 0) {
                 this.addStaff("crew_001", "runner", 0);
                 this.addStaff("crew_002", "driver", 0);
            }

            this.startGameLoop();
            console.log("Engine initialized.");
            this.emit('init');
        } catch (e) {
            console.error("Failed to init engine", e);
        }
    }

    async loadData(name) {
        try {
            const res = await fetch(`./data/${name}.json`);
            if (!res.ok) throw new Error(`Failed to load ${name}`);
            const json = await res.json();
            // Transform list to map if necessary, but schema says lists usually?
            // Schema 03 implies IDs. Let's store as maps for easy lookup if they are arrays.
            if (Array.isArray(json)) {
                this.data[name] = json.reduce((acc, item) => {
                    acc[item.id] = item;
                    return acc;
                }, {});
            } else {
                this.data[name] = json;
            }
        } catch (e) {
            console.error(e);
            // Fallback empty
            this.data[name] = {};
        }
    }

    addStaff(name, roleId, xp) {
        this.state.crew.staff.push({
            id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            roleId: roleId,
            xp: xp,
            status: 'available',
            unavailableUntil: 0
        });
    }

    startGameLoop() {
        setInterval(() => {
            this.tick();
        }, 100); // 10Hz tick
    }

    tick() {
        this.state.now = Date.now();
        
        // Process Runs
        const activeRuns = this.state.runs;
        const completeRuns = [];

        for (let i = activeRuns.length - 1; i >= 0; i--) {
            const run = activeRuns[i];
            if (this.state.now >= run.endsAt) {
                completeRuns.push(run);
                activeRuns.splice(i, 1);
            }
        }

        completeRuns.forEach(run => this.resolveRun(run));

        // Process Heat Decay (Simple linear for now, design says exponential but let's keep it simple for prototype)
        // Heat decays naturally over time
        // Implementing a slow decay
        if (Math.random() < 0.01 && this.state.resources.heat > 0) {
            this.state.resources.heat = Math.max(0, this.state.resources.heat - 0.1);
        }

        // Crew Availability
        this.state.crew.staff.forEach(s => {
            if (s.status === 'unavailable' && this.state.now >= s.unavailableUntil) {
                s.status = 'available';
                this.log(`Crew ${s.name} is back in action.`, 'info');
            }
        });

        this.emit('tick');
    }

    startRun(activityId, optionId, assignedStaffIds) {
        const activity = this.data.activities[activityId];
        // Find option inside activity.options (array)
        const option = activity.options.find(o => o.id === optionId);
        
        if (!option) {
            console.error("Option not found");
            return;
        }

        // Validate Crew
        const assignedStaff = this.state.crew.staff.filter(s => assignedStaffIds.includes(s.id));
        
        // Mark Crew Busy
        assignedStaff.forEach(s => s.status = 'busy');

        const duration = option.durationMs || 5000;

        const run = {
            runId: `r_${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
            activityId,
            optionId,
            startedAt: this.state.now,
            endsAt: this.state.now + duration,
            assignedStaffIds,
            snapshot: {
                inputsPaid: {}, // TODO: Input consumption
                roll: Math.random()
            }
        };

        this.state.runs.push(run);
        this.log(`Started: ${activity.name} → ${option.name}`);
        this.emit('stateChange');
    }

    resolveRun(run) {
        const activity = this.data.activities[run.activityId];
        const option = activity.options.find(o => o.id === run.optionId);
        
        // Free Crew
        const staff = this.state.crew.staff.filter(s => run.assignedStaffIds.includes(s.id));
        staff.forEach(s => s.status = 'available');

        // Logic for outcomes
        // Simplified resolution based on schema
        let outcome = null;
        
        if (option.resolution.type === 'weighted_outcomes') {
             const rand = Math.random() * 100;
             let sum = 0;
             // Naive weighted choice
             for (const out of option.resolution.outcomes) {
                 sum += out.weight; // TODO: Modifiers
                 if (rand <= sum) {
                     outcome = out;
                     break;
                 }
             }
             if (!outcome) outcome = option.resolution.outcomes[option.resolution.outcomes.length - 1];
        } else if (option.resolution.type === 'deterministic') {
            outcome = option.resolution;
        }

        if (outcome) {
            // Apply outputs
            if (outcome.outputs && outcome.outputs.resources) {
                for (const [res, amount] of Object.entries(outcome.outputs.resources)) {
                    // Handle min/max or static
                    let val = 0;
                    if (typeof amount === 'object') {
                        val = Math.floor(Math.random() * (amount.max - amount.min + 1)) + amount.min;
                    } else {
                        val = amount;
                    }
                    this.state.resources[res] = (this.state.resources[res] || 0) + val;
                }
            }
            
            // Apply Deltas
            if (outcome.credDelta) this.state.resources.cred = Math.max(0, Math.min(100, this.state.resources.cred + outcome.credDelta));
            if (outcome.heatDelta) this.state.resources.heat = Math.max(0, this.state.resources.heat + outcome.heatDelta);

            // Log
            const status = outcome.id === 'caught' ? 'error' : 'success';
            this.log(`Finished: ${activity.name} → ${option.name}. Result: ${outcome.id || 'Complete'}`, status);
            
            // XP
            if (option.xpRewards) {
                staff.forEach(s => {
                    s.xp += option.xpRewards.onComplete || 0;
                });
            }
        }
        
        this.emit('stateChange');
    }

    log(message, type='info') {
        const entry = {
            timestamp: Date.now(),
            message,
            type
        };
        this.state.log.unshift(entry);
        if (this.state.log.length > 50) this.state.log.pop();
        this.emit('log', entry);
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    emit(event, data) {
        this.listeners.filter(l => l.event === event).forEach(l => l.callback(data));
    }
}

window.Engine = new GameEngine();