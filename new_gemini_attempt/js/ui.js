import { FrameBuffer } from './framebuffer.js';
import { Renderer } from './renderer.js';
import { Layout, Palette, Viewport, BoxStyles } from './constants.js';
import { Engine } from './engine.js';
import { formatDuration } from './utils.js';

export class UI {
    constructor() {
        this.buffer = new FrameBuffer(Viewport.width, Viewport.height);
        this.renderer = new Renderer(this.buffer, 'terminal');
        this.tabs = [
            { id: 'jobs', label: 'JOBS', hotkey: 'j' },
            { id: 'active', label: 'ACTIVE', hotkey: 'a' },
            { id: 'crew', label: 'CREW', hotkey: 'c' }
        ];
        this.activeTab = 'jobs';
        this.activeBranchId = 'street';
        this.selectedJobIndex = 0;
        this.viewState = 'list'; // 'list' or 'options'
        this.selectedOptionIndex = 0;
    }

    init() {
        this.setupInput();
        this.setupEngineListeners();
        this.renderAll();
    }

    setupInput() {
        document.addEventListener('keydown', (e) => {
            this.handleInput(e);
        });
    }

    setupEngineListeners() {
        Engine.on('stateChange', () => this.renderAll());
        Engine.on('tick', () => this.updateProgress());
        Engine.on('runsCompleted', () => this.renderAll());
        Engine.on('log', () => this.renderAll()); // Re-render log on new message
    }

    handleInput(e) {
        const key = e.key.toLowerCase();

        // Tab Navigation
        const tab = this.tabs.find(t => t.hotkey === key);
        if (tab) {
            this.activeTab = tab.id;
            this.viewState = 'list'; // Reset view on tab switch
            this.renderAll();
            return;
        }

        // View Specific Input
        if (this.activeTab === 'jobs') {
            this.handleJobsInput(e);
        } else if (this.activeTab === 'active') {
             // Handle active tab input
        }

        this.renderAll();
    }

    handleJobsInput(e) {
        if (this.viewState === 'list') {
            const currentBranchActivities = Engine.data.activities.filter(a => a.branchId === this.activeBranchId);
            
            // Branch switching (Primitive 1/2 for now, or just hotkeys if branches had them implemented fully)
            if (e.key === 'ArrowRight') {
                // Cycle branches
                const branches = Engine.data.branches;
                const idx = branches.findIndex(b => b.id === this.activeBranchId);
                this.activeBranchId = branches[(idx + 1) % branches.length].id;
                this.selectedJobIndex = 0;
            } else if (e.key === 'ArrowLeft') {
                 const branches = Engine.data.branches;
                const idx = branches.findIndex(b => b.id === this.activeBranchId);
                this.activeBranchId = branches[(idx - 1 + branches.length) % branches.length].id;
                this.selectedJobIndex = 0;
            }

            // Job Selection
            if (e.key === 'ArrowDown') {
                this.selectedJobIndex = (this.selectedJobIndex + 1) % currentBranchActivities.length;
            } else if (e.key === 'ArrowUp') {
                this.selectedJobIndex = (this.selectedJobIndex - 1 + currentBranchActivities.length) % currentBranchActivities.length;
            } else if (e.key === 'Enter') {
                this.viewState = 'options';
                this.selectedOptionIndex = 0;
            } else if (/[1-9]/.test(e.key)) {
                // Quick select
                const num = parseInt(e.key) - 1;
                if (num < currentBranchActivities.length) {
                    this.selectedJobIndex = num;
                    this.viewState = 'options';
                    this.selectedOptionIndex = 0;
                }
            }

        } else if (this.viewState === 'options') {
            const currentActivity = Engine.data.activities.filter(a => a.branchId === this.activeBranchId)[this.selectedJobIndex];
            
            if (e.key === 'Backspace') {
                this.viewState = 'list';
            } else if (e.key === 'ArrowDown') {
                this.selectedOptionIndex = (this.selectedOptionIndex + 1) % currentActivity.options.length;
            } else if (e.key === 'ArrowUp') {
                this.selectedOptionIndex = (this.selectedOptionIndex - 1 + currentActivity.options.length) % currentActivity.options.length;
            } else if (e.key === 'Enter') {
                // START RUN
                this.startSelectedOption(currentActivity);
            } else if (/[1-9]/.test(e.key)) {
                const num = parseInt(e.key) - 1;
                if (num < currentActivity.options.length) {
                    this.selectedOptionIndex = num;
                    this.startSelectedOption(currentActivity);
                }
            }
        }
    }

    startSelectedOption(activity) {
        const option = activity.options[this.selectedOptionIndex];
        // Auto-assign staff logic (simple greedy for prototype)
        const requiredRoles = option.requirements.staff.filter(r => r.required);
        const assignedIds = [];
        
        for (const req of requiredRoles) {
            for (let i = 0; i < req.count; i++) {
                const staff = Engine.state.staff.find(s => 
                    s.roleId === req.roleId && 
                    s.status === 'available' && 
                    !assignedIds.includes(s.id)
                );
                if (staff) {
                    assignedIds.push(staff.id);
                } else {
                    // Fail to assign
                    console.warn("Not enough staff");
                    return; // Cannot start
                }
            }
        }
        
        Engine.startRun(activity.id, option.id, assignedIds);
    }

    updateProgress() {
        this.renderer.render(); // Just re-render everything on tick for now, optimized later
    }

    renderAll() {
        this.buffer.fill(' ', Palette.LIGHT_GRAY, Palette.BLACK);
        
        this.renderStatusRail();
        this.renderTabs();
        
        if (this.activeTab === 'jobs') {
            this.renderJobsView();
        } else if (this.activeTab === 'active') {
            this.renderActiveRunsView();
        } else if (this.activeTab === 'crew') {
            this.renderCrewView();
        }

        this.renderer.render();
    }

    renderStatusRail() {
        const y = 0;
        this.buffer.drawHLine(0, 1, 80, BoxStyles.SINGLE.horizontal, Palette.DIM_GRAY, Palette.BLACK);
        
        this.buffer.writeText(1, 0, "CRIME COMMITTER VI", Palette.NEON_CYAN, Palette.BLACK);
        
        let x = 25;
        this.buffer.writeText(x, 0, `CASH $${Engine.state.resources.cash}`, Palette.SUCCESS_GREEN, Palette.BLACK);
        x += 15;
        this.buffer.writeText(x, 0, `HEAT ${Engine.state.resources.heat}`, Palette.HEAT_ORANGE, Palette.BLACK);
        x += 10;
        this.buffer.writeText(x, 0, `RUNS ${Engine.state.runs.length}`, Palette.WHITE, Palette.BLACK);
    }

    renderTabs() {
        const y = 2;
        let x = 1;
        
        this.tabs.forEach(tab => {
            const isActive = this.activeTab === tab.id;
            const color = isActive ? Palette.NEON_CYAN : Palette.DIM_GRAY;
            const label = `[ ${tab.label} ]`;
            
            this.buffer.writeText(x, y, label, color, Palette.BLACK);
            x += label.length + 2;
        });
        
        this.buffer.drawHLine(0, 3, 80, BoxStyles.SINGLE.horizontal, Palette.DIM_GRAY, Palette.BLACK);
    }

    renderJobsView() {
        // Render Branches
        let x = 2;
        const y = 4;
        Engine.data.branches.forEach(branch => {
            const isActive = this.activeBranchId === branch.id;
            const color = isActive ? Palette[branch.ui.color] : Palette.DIM_GRAY;
            const label = branch.name.toUpperCase();
            this.buffer.writeText(x, y, label, color, Palette.BLACK);
            x += label.length + 3;
        });

        const currentActivities = Engine.data.activities.filter(a => a.branchId === this.activeBranchId);

        if (this.viewState === 'list') {
            // Render Activity List
            let listY = 6;
            currentActivities.forEach((activity, idx) => {
                const isSelected = this.selectedJobIndex === idx;
                const prefix = isSelected ? '> ' : '  ';
                const color = isSelected ? Palette.WHITE : Palette.LIGHT_GRAY;
                
                this.buffer.writeText(2, listY, `${prefix}${idx + 1}. ${activity.name}`, color, Palette.BLACK);
                if (isSelected) {
                     this.buffer.writeText(2, 20, activity.description, Palette.DIM_GRAY, Palette.BLACK);
                }
                listY++;
            });
        } else {
            // Render Options
            const activity = currentActivities[this.selectedJobIndex];
            this.buffer.writeText(2, 6, `JOB: ${activity.name}`, Palette.WHITE, Palette.BLACK);
            this.buffer.writeText(2, 7, activity.description, Palette.DIM_GRAY, Palette.BLACK);

            let optY = 9;
            activity.options.forEach((opt, idx) => {
                const isSelected = this.selectedOptionIndex === idx;
                const prefix = isSelected ? '> ' : '  ';
                const color = isSelected ? Palette.WHITE : Palette.LIGHT_GRAY;
                
                this.buffer.writeText(2, optY, `${prefix}${idx + 1}. ${opt.name}`, color, Palette.BLACK);
                this.buffer.writeText(30, optY, `(${opt.durationMs/1000}s)`, Palette.DIM_GRAY, Palette.BLACK);
                optY++;
            });

            // Active Runs for this job
            const activeRuns = Engine.state.runs.filter(r => r.activityId === activity.id);
            if (activeRuns.length > 0) {
                 this.buffer.writeText(2, 16, `ACTIVE RUNS (${activeRuns.length})`, Palette.HEAT_ORANGE, Palette.BLACK);
                 activeRuns.forEach((run, i) => {
                     const remaining = Math.max(0, run.endsAt - Engine.state.now);
                     const progress = 1 - (remaining / (run.endsAt - run.startedAt));
                     const barLen = 20;
                     const filled = Math.floor(progress * barLen);
                     const bar = '#'.repeat(filled) + '-'.repeat(barLen - filled);
                     
                     this.buffer.writeText(2, 17 + i, `[${bar}] ${formatDuration(remaining)}`, Palette.HEAT_ORANGE, Palette.BLACK);
                 });
            }
        }
    }

    renderActiveRunsView() {
        this.buffer.writeText(2, 5, "ALL ACTIVE RUNS", Palette.WHITE, Palette.BLACK);
        let y = 7;
        if (Engine.state.runs.length === 0) {
            this.buffer.writeText(2, y, "No active runs.", Palette.DIM_GRAY, Palette.BLACK);
        } else {
            Engine.state.runs.forEach(run => {
                const activity = Engine.data.activities.find(a => a.id === run.activityId);
                const option = activity.options.find(o => o.id === run.optionId);
                const remaining = Math.max(0, run.endsAt - Engine.state.now);
                
                this.buffer.writeText(2, y, `${activity.name} -> ${option.name}`, Palette.WHITE, Palette.BLACK);
                this.buffer.writeText(40, y, formatDuration(remaining), Palette.NEON_CYAN, Palette.BLACK);
                y++;
            });
        }
    }

    renderCrewView() {
        this.buffer.writeText(2, 5, "CREW ROSTER", Palette.WHITE, Palette.BLACK);
        let y = 7;
        Engine.state.staff.forEach(s => {
            const color = s.status === 'available' ? Palette.SUCCESS_GREEN : Palette.DIM_GRAY;
            this.buffer.writeText(2, y, `${s.name} [${s.roleId}]`, Palette.WHITE, Palette.BLACK);
            this.buffer.writeText(30, y, s.status.toUpperCase(), color, Palette.BLACK);
            y++;
        });
    }
}
