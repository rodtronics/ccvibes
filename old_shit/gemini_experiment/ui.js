class UIManager {
    constructor() {
        this.activeTab = 'activities';
        this.selectedBranch = null;
    }

    init() {
        this.setupTabs();
        this.setupClock();
        
        // Listen to Engine
        window.Engine.on('init', () => this.render());
        window.Engine.on('stateChange', () => this.updateState());
        window.Engine.on('tick', () => this.updateTick());
        window.Engine.on('log', (entry) => this.addLogEntry(entry));
        
        // Initial render if engine already ready
        if (window.Engine.data.activities) {
            this.render();
        }
    }

    setupTabs() {
        const tabs = [
            { id: 'activities', label: 'ACTIVITIES' },
            { id: 'active', label: 'ACTIVE RUNS' },
            { id: 'crew', label: 'CREW' },
            { id: 'log', label: 'LOGS' }
        ];

        const container = document.getElementById('nav-tabs');
        container.innerHTML = '';
        tabs.forEach(t => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${this.activeTab === t.id ? 'active' : ''}`;
            btn.textContent = t.label;
            btn.onclick = () => this.switchTab(t.id);
            container.appendChild(btn);
        });
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        
        // Update Buttons
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.textContent === tabId.toUpperCase() || b.textContent === {activities: 'ACTIVITIES', active: 'ACTIVE RUNS', crew: 'CREW', log: 'LOGS'}[tabId]);
        });

        // Hide all views
        document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
        
        // Show active view
        const activeView = document.getElementById(`view-${tabId}`);
        if (activeView) activeView.classList.remove('hidden');

        this.render();
    }

    setupClock() {
        setInterval(() => {
            const now = new Date(window.Engine.state.now);
            document.getElementById('clock').textContent = now.toLocaleTimeString();
        }, 1000);
    }

    updateTick() {
        // Update Progress Bars of Active Runs
        this.renderActiveRuns();
        
        // Update Stats
        const r = window.Engine.state.resources;
        document.getElementById('stat-cash').textContent = `CASH: $${r.cash || 0}`;
        document.getElementById('stat-heat').textContent = `HEAT: [${this.renderBar(r.heat, 100)}] ${Math.floor(r.heat)}%`;
        document.getElementById('stat-cred').textContent = `CRED: ${r.cred}`;
        document.getElementById('stat-active').textContent = `RUNS: ${window.Engine.state.runs.length}`;
    }

    renderBar(value, max, width=8) {
        const fill = Math.min(width, Math.max(0, Math.floor((value / max) * width)));
        return '#'.repeat(fill) + '-'.repeat(width - fill);
    }

    updateState() {
        this.render();
    }

    render() {
        if (this.activeTab === 'activities') this.renderActivities();
        if (this.activeTab === 'active') this.renderActiveRuns();
        if (this.activeTab === 'crew') this.renderCrew();
        // Log is event driven
    }

    renderActivities() {
        const engine = window.Engine;
        const branchList = document.getElementById('branch-list');
        const activityList = document.getElementById('activity-list');
        
        // Render Branches
        const branches = Object.values(engine.data.branches).sort((a,b) => a.order - b.order);
        
        // Select first branch if none
        if (!this.selectedBranch && branches.length > 0) {
            this.selectedBranch = branches[0].id;
        }

        branchList.innerHTML = '';
        branches.forEach(b => {
            const div = document.createElement('div');
            div.className = `branch-item ${this.selectedBranch === b.id ? 'active' : ''}`;
            div.textContent = `> ${b.name.toUpperCase()}`;
            div.onclick = () => {
                this.selectedBranch = b.id;
                this.renderActivities();
            };
            branchList.appendChild(div);
        });

        // Render Activities for selected branch
        activityList.innerHTML = '';
        const activities = Object.values(engine.data.activities).filter(a => a.branchId === this.selectedBranch);
        
        activities.forEach(act => {
            const card = document.createElement('div');
            card.className = 'activity-card';
            
            const header = document.createElement('div');
            header.className = 'activity-header';
            header.innerHTML = `<span class="activity-title">${act.name.toUpperCase()}</span>`;
            card.appendChild(header);

            const optList = document.createElement('div');
            optList.className = 'option-list';
            
            act.options.forEach(opt => {
                const optCard = document.createElement('div');
                optCard.className = 'option-card';
                optCard.innerHTML = `
                    <span class="option-name">${opt.name}</span>
                    <span class="option-desc">${opt.description}</span>
                    <span class="option-meta">
                        TIME: ${(opt.durationMs/1000).toFixed(0)}s<br>
                        RISK: LOW
                    </span>
                    <button class="btn-commit" data-act="${act.id}" data-opt="${opt.id}">COMMIT</button>
                `;
                
                optCard.querySelector('.btn-commit').onclick = () => this.openCrewModal(act, opt);
                
                optList.appendChild(optCard);
            });

            card.appendChild(optList);
            activityList.appendChild(card);
        });
    }

    renderActiveRuns() {
        const container = document.getElementById(this.activeTab === 'active' ? 'view-active' : 'void'); // Only render if visible or found
        if (!container || container.id === 'void') return;

        container.innerHTML = '';
        window.Engine.state.runs.forEach(run => {
            const act = window.Engine.data.activities[run.activityId];
            const opt = act.options.find(o => o.id === run.optionId);
            const progress = (window.Engine.state.now - run.startedAt) / (run.endsAt - run.startedAt);
            const timeLeft = Math.max(0, (run.endsAt - window.Engine.state.now) / 1000).toFixed(1);

            const div = document.createElement('div');
            div.className = 'panel';
            div.style.marginBottom = '10px';
            div.innerHTML = `
                <div class="panel-header">RUNNING: ${act.name} / ${opt.name}</div>
                <div>STAFF: ${run.assignedStaffIds.join(', ')}</div>
                <div>REMAINING: ${timeLeft}s</div>
                <div>[${this.renderBar(progress * 100, 100, 40)}] ${(progress*100).toFixed(0)}%</div>
            `;
            container.appendChild(div);
        });
    }

    renderCrew() {
        const container = document.getElementById('view-crew');
        if (!container) return;
        container.innerHTML = '';
        
        window.Engine.state.crew.staff.forEach(s => {
            const div = document.createElement('div');
            div.className = 'panel';
            div.style.marginBottom = '5px';
            div.innerHTML = `
                <span class="text-cyan">${s.name}</span> [${s.roleId}] 
                XP: ${s.xp} 
                STATUS: <span class="${s.status === 'available' ? 'text-green' : 'text-orange'}">${s.status.toUpperCase()}</span>
            `;
            container.appendChild(div);
        });
    }

    addLogEntry(entry) {
        const mini = document.getElementById('mini-log-content');
        if (mini) {
            const div = document.createElement('div');
            div.className = `log-entry log-${entry.type}`;
            const time = new Date(entry.timestamp).toLocaleTimeString();
            div.innerHTML = `<span class="timestamp">[${time}]</span> ${entry.message}`;
            mini.prepend(div);
        }
    }

    openCrewModal(activity, option) {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        modal.classList.remove('hidden');

        // Logic to track selection
        let selectedStaff = {}; // roleIndex -> staffId

        const renderModal = () => {
            // Check Requirements
            const reqs = option.requirements && option.requirements.staff ? option.requirements.staff : [];
            // If no requirements, we assume 1 generic runner for prototype or auto-start? 
            // Design says: "Assignment creates independent time-based run".
            
            // Build UI
            let html = `<div class="modal-header">ASSIGN CREW: ${activity.name.toUpperCase()} - ${option.name}</div>`;
            
            // Generate slots
            let slotsHtml = '';
            let valid = true;

            reqs.forEach((req, idx) => {
                const isFilled = !!selectedStaff[idx];
                if (req.required && !isFilled) valid = false;

                const roleName = req.roleId;
                const assigned = isFilled ? window.Engine.state.crew.staff.find(s => s.id === selectedStaff[idx]).name : "NONE";

                slotsHtml += `
                    <div class="crew-selector-row ${req.required ? 'required' : 'optional'} ${isFilled ? 'filled' : ''}">
                        <div>
                            <strong>${roleName.toUpperCase()}</strong> ${req.required ? '*' : ''}
                            <div style="font-size:0.8em; color:#666">${isFilled ? assigned : 'Select crew...'}</div>
                        </div>
                        <div>
                            ${isFilled ? `<button onclick="window.UI.deselectCrew(${idx})">X</button>` : `<button onclick="window.UI.selectCrew(${idx}, '${req.roleId}')">ASSIGN</button>`}
                        </div>
                    </div>
                `;
            });

            html += slotsHtml;
            html += `
                <div class="modal-actions">
                    <button onclick="window.UI.closeModal()">CANCEL</button>
                    <button id="btn-start-run" ${valid ? '' : 'disabled'} class="text-green">START OPERATION</button>
                </div>
            `;

            content.innerHTML = html;
            
            const startBtn = document.getElementById('btn-start-run');
            if (startBtn) {
                startBtn.onclick = () => {
                    // Gather IDs
                    const ids = Object.values(selectedStaff);
                    window.Engine.startRun(activity.id, option.id, ids);
                    window.UI.closeModal();
                };
            }
        };
        
        // Attach helpers to window for inline onclicks (simple prototype hack)
        window.UI.currentModalContext = { activity, option, selectedStaff, renderModal };
        window.UI.selectCrew = (slotIdx, roleId) => {
            // Find available crew for this role
            const available = window.Engine.state.crew.staff.filter(s => 
                s.roleId === roleId && 
                s.status === 'available' &&
                !Object.values(window.UI.currentModalContext.selectedStaff).includes(s.id)
            );
            
            if (available.length === 0) {
                alert("No available crew for this role!");
                return;
            }
            
            // Auto pick first for now (Prototype)
            window.UI.currentModalContext.selectedStaff[slotIdx] = available[0].id;
            window.UI.currentModalContext.renderModal();
        };

        window.UI.deselectCrew = (slotIdx) => {
            delete window.UI.currentModalContext.selectedStaff[slotIdx];
            window.UI.currentModalContext.renderModal();
        }

        renderModal();
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }
}

window.UI = new UIManager();