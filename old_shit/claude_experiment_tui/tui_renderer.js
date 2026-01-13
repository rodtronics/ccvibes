export class TUIRenderer {
    constructor(container, engine) {
        this.container = container;
        this.engine = engine;
        this.width = 100;
        this.height = 40;
        this.currentTab = 'activities';
        this.selectedBranch = null;
        this.selectedActivity = null;
        this.selectedOption = null;
        this.scrollOffset = 0;
    }

    render() {
        const lines = [];

        // Status rail
        lines.push(...this.renderStatusRail());
        lines.push(this.horizontalLine());

        // Tab bar
        lines.push(this.renderTabBar());
        lines.push(this.horizontalLine());

        // Main content
        if (this.currentTab === 'activities') {
            lines.push(...this.renderActivitiesTab());
        } else if (this.currentTab === 'runs') {
            lines.push(...this.renderRunsTab());
        } else if (this.currentTab === 'log') {
            lines.push(...this.renderLogTab());
        } else if (this.currentTab === 'settings') {
            lines.push(...this.renderSettingsTab());
        }

        // Pad to height
        while (lines.length < this.height) {
            lines.push('');
        }

        this.container.textContent = lines.slice(0, this.height).join('\n');
    }

    renderStatusRail() {
        const lines = [];
        const title = '╔═══ CRIME COMMITTER VI ═══╗';

        const resources = [];
        if (this.engine.state.reveals.resources.cash) {
            resources.push(`CASH: $${this.formatNumber(Math.floor(this.engine.state.resources.cash || 0))}`);
        }
        if (this.engine.state.reveals.resources.heat) {
            const heat = Math.floor(this.engine.state.resources.heat || 0);
            resources.push(`HEAT: ${heat}${this.getHeatIndicator(heat)}`);
        }
        if (this.engine.state.reveals.resources.cred) {
            resources.push(`CRED: ${Math.floor(this.engine.state.resources.cred || 0)}`);
        }

        const activeRuns = `RUNS: ${this.engine.state.runs.length}`;
        const time = new Date().toLocaleTimeString();

        const statusLine = `${title}  ${resources.join('  |  ')}  |  ${activeRuns}  |  ${time}`;
        lines.push(this.padLine(statusLine));

        return lines;
    }

    renderTabBar() {
        const tabs = [];
        const tabDefs = [
            { id: 'activities', label: 'ACTIVITIES', key: '1' },
            { id: 'runs', label: 'RUNS', key: '2' },
            { id: 'log', label: 'LOG', key: '3' },
            { id: 'settings', label: 'SETTINGS', key: 'S' }
        ];

        tabDefs.forEach(tab => {
            const active = this.currentTab === tab.id;
            const bracket = active ? '>' : ' ';
            tabs.push(`${bracket} [${tab.key}] ${tab.label} ${bracket}`);
        });

        return tabs.join('   ');
    }

    renderActivitiesTab() {
        const lines = [];

        if (!this.selectedBranch) {
            // Branch selection
            lines.push('SELECT BRANCH:');
            lines.push('');

            const branches = this.engine.getVisibleBranches();
            branches.forEach((branch, idx) => {
                const marker = idx === 0 ? '>' : ' ';
                lines.push(`  ${marker} [${idx + 1}] ${branch.name.toUpperCase()}`);
                lines.push(`      ${branch.description}`);
            });

            lines.push('');
            lines.push('Controls: [1-9] Select branch  |  [S] Settings  |  [Q] Quit');
        } else if (!this.selectedActivity) {
            // Activity selection
            const branch = this.engine.data.branches.find(b => b.id === this.selectedBranch);
            lines.push(`BRANCH: ${branch.name.toUpperCase()}`);
            lines.push(this.horizontalLine());
            lines.push('');

            const activities = this.engine.getVisibleActivities(this.selectedBranch);

            if (activities.length === 0) {
                lines.push('  No activities available.');
            } else {
                activities.forEach((activity, idx) => {
                    const unlocked = this.engine.isActivityUnlocked(activity);
                    const marker = idx === 0 ? '>' : ' ';
                    const lockIcon = unlocked ? '' : ' [LOCKED]';

                    lines.push(`  ${marker} [${idx + 1}] ${activity.name.toUpperCase()}${lockIcon}`);
                    lines.push(`      ${activity.description}`);
                    lines.push('');
                });
            }

            lines.push('');
            lines.push('Controls: [1-9] Select activity  |  [ESC] Back to branches');
        } else {
            // Option selection
            const activity = this.engine.data.activities.find(a => a.id === this.selectedActivity);
            const unlocked = this.engine.isActivityUnlocked(activity);

            lines.push(`ACTIVITY: ${activity.name.toUpperCase()}`);
            lines.push(`${activity.description}`);
            lines.push(this.horizontalLine());
            lines.push('');

            if (!unlocked) {
                lines.push('  [LOCKED] This activity is not yet unlocked.');
                lines.push('');
                lines.push('Controls: [ESC] Back');
            } else {
                lines.push('SELECT METHOD:');
                lines.push('');

                activity.options.forEach((option, idx) => {
                    const optionUnlocked = this.engine.isOptionUnlocked(option);
                    const marker = idx === 0 ? '>' : ' ';
                    const lockIcon = optionUnlocked ? '' : ' [LOCKED]';

                    lines.push(`  ${marker} [${idx + 1}] ${option.name.toUpperCase()}${lockIcon}`);
                    lines.push(`      ${option.description}`);

                    if (optionUnlocked) {
                        const duration = this.formatDuration(option.durationMs);
                        const reqText = this.formatRequirements(option);
                        const rewardText = this.formatRewards(option);

                        lines.push(`      Duration: ${duration}  |  ${reqText}`);
                        lines.push(`      ${rewardText}`);

                        // Show if currently running
                        const activeRuns = this.engine.state.runs.filter(r => r.optionId === option.id);
                        if (activeRuns.length > 0) {
                            lines.push(`      [ACTIVE: ${activeRuns.length} run(s)]`);
                        }
                    }

                    lines.push('');
                });

                lines.push('');
                lines.push('Controls: [1-9] Start run  |  [ESC] Back');
            }
        }

        return lines;
    }

    renderRunsTab() {
        const lines = [];
        lines.push('ACTIVE RUNS:');
        lines.push(this.horizontalLine());
        lines.push('');

        if (this.engine.state.runs.length === 0) {
            lines.push('  No active runs.');
        } else {
            this.engine.state.runs.forEach((run, idx) => {
                const activity = this.engine.data.activities.find(a => a.id === run.activityId);
                const option = activity?.options.find(o => o.id === run.optionId);

                const remaining = Math.max(0, run.endsAt - this.engine.state.now);
                const progress = 1 - (remaining / option.durationMs);
                const progressBar = this.makeProgressBar(progress, 30);

                const staffNames = run.assignedStaffIds
                    .map(id => this.engine.state.crew.staff.find(s => s.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');

                lines.push(`  [${idx + 1}] ${activity?.name} → ${option?.name}`);
                lines.push(`      Staff: ${staffNames}`);
                lines.push(`      ${progressBar} ${this.formatDuration(remaining)} remaining`);

                // Show repeat queue info
                const queue = this.engine.state.repeatQueues[run.runId];
                if (queue) {
                    const queueText = queue.remaining === 'infinite'
                        ? '∞ REPEAT'
                        : `REPEAT ${queue.total - queue.remaining}/${queue.total}`;
                    lines.push(`      ${queueText}`);
                }

                lines.push('');
            });
        }

        lines.push('');
        lines.push('Controls: [1-9] Cancel run  |  [ESC] Back to activities');

        return lines;
    }

    renderLogTab() {
        const lines = [];
        lines.push('EVENT LOG:');
        lines.push(this.horizontalLine());
        lines.push('');

        const visibleLogs = this.engine.state.log.slice(0, 30);

        if (visibleLogs.length === 0) {
            lines.push('  No events yet.');
        } else {
            visibleLogs.forEach(entry => {
                const levelIcon = {
                    'info': '[·]',
                    'success': '[✓]',
                    'warn': '[!]',
                    'error': '[✗]'
                }[entry.level] || '[·]';

                lines.push(`  ${entry.timestamp} ${levelIcon} ${entry.message}`);
            });
        }

        lines.push('');
        lines.push('Controls: [ESC] Back to activities');

        return lines;
    }

    renderSettingsTab() {
        const lines = [];
        lines.push('SETTINGS:');
        lines.push(this.horizontalLine());
        lines.push('');
        lines.push('  [F] Toggle Font (VGA / Source Code Pro)');
        lines.push('');
        lines.push('  Current font: ' + (this.container.classList.contains('font-vga') ? 'VGA' : 'Source Code Pro'));
        lines.push('');
        lines.push('');
        lines.push('Controls: [ESC] Back to activities');

        return lines;
    }

    formatRequirements(option) {
        const parts = [];

        if (option.requirements?.staff) {
            option.requirements.staff.forEach(req => {
                const stars = req.starsMin > 0 ? ' (' + '★'.repeat(req.starsMin) + ')' : '';
                parts.push(`${req.count}x ${req.roleId}${stars}`);
            });
        }

        if (option.inputs?.resources) {
            Object.entries(option.inputs.resources).forEach(([resId, amount]) => {
                parts.push(`${amount} ${resId}`);
            });
        }

        return parts.length > 0 ? 'Needs: ' + parts.join(', ') : 'No requirements';
    }

    formatRewards(option) {
        const res = option.resolution;
        const parts = [];

        if (res.type === 'deterministic') {
            if (res.outputs?.resources) {
                Object.entries(res.outputs.resources).forEach(([resId, amount]) => {
                    parts.push(`${amount} ${resId}`);
                });
            }
        } else if (res.type === 'ranged_outputs') {
            if (res.outputs?.resources) {
                Object.entries(res.outputs.resources).forEach(([resId, range]) => {
                    parts.push(`${range.min}-${range.max} ${resId}`);
                });
            }
        } else if (res.type === 'weighted_outcomes') {
            const allOutputs = new Set();
            res.outcomes.forEach(outcome => {
                if (outcome.outputs?.resources) {
                    Object.keys(outcome.outputs.resources).forEach(resId => allOutputs.add(resId));
                }
            });
            if (allOutputs.size > 0) {
                parts.push(`Rewards: ${Array.from(allOutputs).join(', ')}`);
            }
        }

        return parts.length > 0 ? 'Rewards: ' + parts.join(', ') : 'Variable rewards';
    }

    formatDuration(ms) {
        const seconds = Math.ceil(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}m ${secs}s`;
    }

    formatNumber(num) {
        return num.toLocaleString();
    }

    makeProgressBar(progress, width) {
        const filled = Math.floor(progress * width);
        const empty = width - filled;
        return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    }

    getHeatIndicator(heat) {
        if (heat < 10) return '';
        if (heat < 30) return ' !';
        if (heat < 60) return ' !!';
        return ' !!!';
    }

    horizontalLine() {
        return '─'.repeat(this.width);
    }

    padLine(text) {
        if (text.length >= this.width) return text.substring(0, this.width);
        return text + ' '.repeat(this.width - text.length);
    }

    selectBranch(index) {
        const branches = this.engine.getVisibleBranches();
        if (index >= 0 && index < branches.length) {
            this.selectedBranch = branches[index].id;
            this.selectedActivity = null;
            this.selectedOption = null;
        }
    }

    selectActivity(index) {
        const activities = this.engine.getVisibleActivities(this.selectedBranch);
        if (index >= 0 && index < activities.length) {
            this.selectedActivity = activities[index].id;
            this.selectedOption = null;
        }
    }

    startOption(index) {
        if (!this.selectedActivity) return;

        const activity = this.engine.data.activities.find(a => a.id === this.selectedActivity);
        if (!activity) return;

        if (index >= 0 && index < activity.options.length) {
            const option = activity.options[index];

            // Check if unlocked
            if (!this.engine.isOptionUnlocked(option)) {
                this.engine.addLog(`Cannot start: option not unlocked`, 'error');
                return;
            }

            // Get available staff for requirements
            const staffIds = [];
            if (option.requirements?.staff) {
                for (const req of option.requirements.staff) {
                    const availableStaff = this.engine.state.crew.staff.filter(s =>
                        s.roleId === req.roleId &&
                        s.status === 'available' &&
                        this.engine.getStars(s) >= req.starsMin
                    );

                    if (availableStaff.length < req.count) {
                        this.engine.addLog(`Cannot start: need ${req.count} ${req.roleId}`, 'error');
                        return;
                    }

                    // Assign the required staff
                    for (let i = 0; i < req.count; i++) {
                        staffIds.push(availableStaff[i].id);
                    }
                }
            }

            // Start the run
            const run = this.engine.startRun(this.selectedActivity, option.id, staffIds);
            if (run) {
                // Return to activities view
                this.selectedActivity = null;
                this.selectedBranch = null;
            }
        }
    }

    cancelRun(index) {
        if (index >= 0 && index < this.engine.state.runs.length) {
            const run = this.engine.state.runs[index];
            this.engine.cancelRun(run.runId);
        }
    }

    goBack() {
        if (this.selectedActivity) {
            this.selectedActivity = null;
        } else if (this.selectedBranch) {
            this.selectedBranch = null;
        } else {
            this.currentTab = 'activities';
        }
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        this.selectedBranch = null;
        this.selectedActivity = null;
        this.selectedOption = null;
    }

    handleInput(key) {
        // Tab switching
        if (key === '1' && this.currentTab !== 'activities') {
            this.switchTab('activities');
            return true;
        }
        if (key === '2') {
            this.switchTab('runs');
            return true;
        }
        if (key === '3') {
            this.switchTab('log');
            return true;
        }
        if (key.toLowerCase() === 's') {
            this.switchTab('settings');
            return true;
        }

        // Settings tab
        if (this.currentTab === 'settings') {
            if (key.toLowerCase() === 'f') {
                this.container.classList.toggle('font-vga');
                this.container.classList.toggle('font-modern');
                return true;
            }
        }

        // Navigation
        if (key === 'Escape') {
            this.goBack();
            return true;
        }

        // Activities tab
        if (this.currentTab === 'activities') {
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                if (!this.selectedBranch) {
                    this.selectBranch(num - 1);
                } else if (!this.selectedActivity) {
                    this.selectActivity(num - 1);
                } else {
                    this.startOption(num - 1);
                }
                return true;
            }
        }

        // Runs tab
        if (this.currentTab === 'runs') {
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                this.cancelRun(num - 1);
                return true;
            }
        }

        return false;
    }
}
