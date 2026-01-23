import { deepClone, generateId } from './utils.js';
import { resources } from '../data/resources.js';
import { branches } from '../data/branches.js';
import { activities } from '../data/activities.js';
import { roles, initialStaff } from '../data/roles.js';

class EngineClass {
    constructor() {
        this.state = {
            resources: {},
            staff: [],
            runs: [],
            log: [],
            flags: {},
            now: Date.now()
        };
        this.listeners = {};
        this.tickInterval = null;
        
        // Data caches
        this.data = {
            resources,
            branches,
            activities,
            roles
        };
    }

    init() {
        // Initialize resources
        this.data.resources.forEach(res => {
            this.state.resources[res.id] = res.value || 0;
        });

        // Initialize staff
        this.state.staff = deepClone(initialStaff);

        this.startLoop();
        this.emit('stateChange');
        this.log("System initialized.", "info");
    }

    startLoop() {
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = setInterval(() => this.tick(), 50);
    }

    tick() {
        this.state.now = Date.now();
        let stateChanged = false;
        const runsCompleted = [];

        // Process runs
        this.state.runs.forEach(run => {
            if (this.state.now >= run.endsAt) {
                runsCompleted.push(run);
            }
        });

        if (runsCompleted.length > 0) {
            runsCompleted.forEach(run => this.completeRun(run));
            // Remove completed runs
            this.state.runs = this.state.runs.filter(r => !runsCompleted.includes(r));
            stateChanged = true;
            this.emit('runsCompleted');
        }

        // Check staff availability
        this.state.staff.forEach(staff => {
            if (staff.status === 'unavailable' && this.state.now >= staff.unavailableUntil) {
                staff.status = 'available';
                staff.unavailableUntil = 0;
                stateChanged = true;
                this.log(`${staff.name} is available again.`, "info");
            }
        });

        if (stateChanged) {
            this.emit('stateChange');
        }
        this.emit('tick');
    }

    startRun(activityId, optionId, assignedStaffIds) {
        const activity = this.data.activities.find(a => a.id === activityId);
        const option = activity.options.find(o => o.id === optionId);

        if (!activity || !option) return false;

        // Verify staff
        const staff = assignedStaffIds.map(id => this.state.staff.find(s => s.id === id));
        if (staff.some(s => s.status !== 'available')) {
            this.log("Some staff are not available.", "error");
            return false;
        }

        // Mark staff busy
        staff.forEach(s => s.status = 'busy');

        const run = {
            runId: generateId('run'),
            activityId,
            optionId,
            startedAt: this.state.now,
            endsAt: this.state.now + option.durationMs,
            assignedStaffIds,
            runsLeft: option.repeatable ? 0 : 0 // Default to single run
        };

        this.state.runs.push(run);
        this.log(`Started: ${activity.name} -> ${option.name}`, "info");
        this.emit('stateChange');
        this.emit('runStarted', run);
        return true;
    }

    completeRun(run) {
        const activity = this.data.activities.find(a => a.id === run.activityId);
        const option = activity.options.find(o => o.id === run.optionId);

        // Resolve outcome (simplified)
        let outcome = null;
        if (option.resolution.type === 'weighted_outcomes') {
            const roll = Math.random() * 100;
            let cumulative = 0;
            for (const out of option.resolution.outcomes) {
                cumulative += out.weight;
                if (roll <= cumulative) {
                    outcome = out;
                    break;
                }
            }
        }
        
        if (!outcome) {
            // Fallback or deterministic
             outcome = option.resolution.outcomes ? option.resolution.outcomes[0] : null;
        }

        if (outcome) {
            this.applyOutcome(outcome, run.assignedStaffIds);
            this.log(`Completed: ${activity.name} (${outcome.id})`, outcome.id === 'caught' ? 'error' : 'success');
        }

        // Free staff
        const staff = run.assignedStaffIds.map(id => this.state.staff.find(s => s.id === id));
        staff.forEach(s => s.status = 'available');
        
        // Handle Repeat
        if (run.runsLeft > 0 || run.runsLeft === -1) {
            // Logic to restart run would go here
            // For prototype, we'll skip auto-repeat implementation detail for now
        }
    }

    applyOutcome(outcome, staffIds) {
        // Resources
        if (outcome.outputs && outcome.outputs.resources) {
            for (const [resId, value] of Object.entries(outcome.outputs.resources)) {
                this.state.resources[resId] = (this.state.resources[resId] || 0) + value;
            }
        }

        // Jail/Unavailable
        if (outcome.jail) {
            const staff = staffIds.map(id => this.state.staff.find(s => s.id === id));
            staff.forEach(s => {
                s.status = 'unavailable';
                s.unavailableUntil = this.state.now + outcome.jail.durationMs;
            });
        }
    }

    log(message, type = "info") {
        this.state.log.unshift({
            timestamp: this.state.now,
            message,
            type
        });
        if (this.state.log.length > 50) this.state.log.pop();
        this.emit('log', { message, type });
    }

    // Event Emitter
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }
}

export const Engine = new EngineClass();
