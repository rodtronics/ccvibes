import { TuiRenderer } from './tui_renderer.js';
import { Engine } from './engine.js';

const WIDTH = 100;
const HEIGHT = 35; // Increased height for better layout

const renderer = new TuiRenderer('game-container', WIDTH, HEIGHT);
const engine = new Engine();

// UI State
let activeTab = 'activities'; // activities, runs, crew, log, settings
let selectedActivityIndex = 0;
let selectedOptionIndex = -1; // -1 means activity selection mode
let scrollOffset = 0;
let selectedSettingIndex = 0; // For settings tab

// Input Handling
document.addEventListener('keydown', handleInput);

async function main() {
    await engine.init();
    applySettings(); // Apply initial settings
    
    // Game Loop
    setInterval(() => {
        engine.tick();
        render();
    }, 100);
}

function applySettings() {
    const container = document.getElementById('game-container');
    container.classList.remove('font-vga', 'font-modern');
    container.classList.add(`font-${engine.state.settings.font}`);
}

function handleInput(e) {
    if (activeTab === 'activities') {
        handleActivitiesInput(e);
    } else if (activeTab === 'runs') {
        // handle runs input
    } else if (activeTab === 'settings') {
        handleSettingsInput(e);
    }
    
    // Global Tabs
    if (e.key === '1') activeTab = 'activities';
    if (e.key === '2') activeTab = 'runs';
    if (e.key === '3') activeTab = 'log';
    if (e.key === '4') activeTab = 'settings';
    
    render();
}

function handleSettingsInput(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        // Toggle Font
        engine.state.settings.font = engine.state.settings.font === 'vga' ? 'modern' : 'vga';
        applySettings();
    }
}

function handleActivitiesInput(e) {
    const visibleActivities = getVisibleActivities();
    
    if (selectedOptionIndex === -1) {
        // Navigating Activities
        if (e.key === 'ArrowUp') {
            selectedActivityIndex = Math.max(0, selectedActivityIndex - 1);
        } else if (e.key === 'ArrowDown') {
            selectedActivityIndex = Math.min(visibleActivities.length - 1, selectedActivityIndex + 1);
        } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
            // Select Activity, move to options
            selectedOptionIndex = 0;
        }
    } else {
        // Navigating Options
        const activity = visibleActivities[selectedActivityIndex];
        if (!activity) return;
        
        if (e.key === 'ArrowUp') {
            selectedOptionIndex = Math.max(0, selectedOptionIndex - 1);
        } else if (e.key === 'ArrowDown') {
            selectedOptionIndex = Math.min(activity.options.length - 1, selectedOptionIndex + 1);
        } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
            selectedOptionIndex = -1;
        } else if (e.key === 'Enter') {
            // Start Run
            // For prototype, auto-select first available staff matching role
            const option = activity.options[selectedOptionIndex];
            const requiredStaffDef = option.requirements?.staff?.[0];
            const requiredStaffCount = requiredStaffDef?.count || 1;
            const requiredRoleId = requiredStaffDef?.roleId || 'player';
            
            // Find available staff with correct role
            const availableStaff = engine.state.crew.staff.filter(s => 
                s.status === 'available' && s.roleId === requiredRoleId
            );
            
            if (availableStaff.length >= requiredStaffCount) {
                 const assignedIds = availableStaff.slice(0, requiredStaffCount).map(s => s.id);
                 engine.startRun(activity.id, option.id, assignedIds);
            } else {
                engine.log(`No available staff with role: ${requiredRoleId}!`, "error");
            }
        }
    }
}

function getVisibleActivities() {
    // Filter by branch logic ideally, but for now showing all revealed
    return engine.data.activities.filter(a => engine.state.reveals.activities[a.id] || true); // Showing all for debug/prototype
}

function render() {
    renderer.clear();
    
    // 1. Status Rail (Top)
    renderStatusRail();
    
    // 2. Tab Bar
    renderTabBar();
    
    // 3. Main Content
    if (activeTab === 'activities') {
        renderActivitiesTab();
    } else if (activeTab === 'runs') {
        renderRunsTab();
    } else if (activeTab === 'log') {
        renderLogTab();
    } else if (activeTab === 'settings') {
        renderSettingsTab();
    }
    
    renderer.render();
}

function renderStatusRail() {
    renderer.drawBox(0, 0, WIDTH, 3, null, 'double', '#00ff00');
    
    const cash = `$${engine.state.resources.cash}`;
    const heat = `HEAT: ${Math.floor(engine.state.resources.heat)}%`;
    const cred = `CRED: ${engine.state.resources.cred}`;
    const time = new Date(engine.state.now).toLocaleTimeString();
    
    renderer.write(2, 1, "CRIME COMMITTER VI", '#00ff00');
    renderer.write(25, 1, cash, '#ffffff');
    renderer.write(40, 1, heat, engine.state.resources.heat > 50 ? '#ff4500' : '#00ffff');
    renderer.write(55, 1, cred, '#ffff00');
    renderer.write(WIDTH - 12, 1, time, '#888888');
}

function renderTabBar() {
    const tabs = [
        { id: 'activities', label: '1.ACTIVITIES' },
        { id: 'runs', label: `2.RUNS [${engine.state.runs.length}]` },
        { id: 'log', label: '3.LOG' },
        { id: 'settings', label: '4.SETTINGS' }
    ];
    
    let x = 1;
    renderer.write(0, 3, "─".repeat(WIDTH), '#333333');
    
    tabs.forEach(tab => {
        const isActive = activeTab === tab.id;
        const color = isActive ? '#000000' : '#888888';
        const bg = isActive ? '#00ff00' : null;
        const text = ` ${tab.label} `;
        
        renderer.write(x, 3, text, color, bg);
        x += text.length + 1;
    });
}

// ... existing renderActivitiesTab ...

function renderSettingsTab() {
    renderer.write(2, 5, "SYSTEM SETTINGS", '#00ff00');
    renderer.write(2, 6, "Use [ENTER] to toggle options.", '#666666');

    // Font Setting
    const fontLabel = "DISPLAY FONT";
    const fontValue = engine.state.settings.font === 'vga' ? "VGA (Retro)" : "MODERN (Source Code Pro)";
    
    renderer.drawBox(2, 8, 50, 3, null, 'normal', '#ffffff');
    renderer.write(4, 9, `${fontLabel}: `, '#aaaaaa');
    renderer.write(20, 9, fontValue, '#00ffff');
    
    renderer.write(54, 9, "< SELECTED", '#00ff00'); // Always selected since it's the only one
}


function renderActivitiesTab() {
    const activities = getVisibleActivities();
    const listWidth = 30;
    
    // Activity List (Left)
    renderer.drawBox(0, 4, listWidth, HEIGHT - 4, "BRANCHES", 'normal', '#333333');
    
    activities.forEach((act, i) => {
        const isSelected = selectedActivityIndex === i;
        const color = isSelected ? '#ffffff' : '#888888';
        const bg = (isSelected && selectedOptionIndex === -1) ? '#333333' : null;
        const prefix = isSelected ? "> " : "  ";
        
        renderer.write(1, 5 + i, `${prefix}${act.name.padEnd(25)}`, color, bg);
    });
    
    // Detail View (Right)
    const detailX = listWidth;
    const detailW = WIDTH - listWidth;
    renderer.drawBox(detailX, 4, detailW, HEIGHT - 4, "OPTIONS", 'normal', '#333333');
    
    const activity = activities[selectedActivityIndex];
    if (activity) {
        renderer.write(detailX + 2, 5, activity.name.toUpperCase(), '#00ffff');
        renderer.write(detailX + 2, 6, activity.description, '#cccccc');
        
        // Options
        activity.options.forEach((opt, i) => {
            const isSelected = selectedOptionIndex === i;
            const y = 8 + (i * 4);
            
            const color = isSelected ? '#ffffff' : '#aaaaaa';
            const borderColor = isSelected ? '#00ff00' : '#444444';
            
            renderer.drawBox(detailX + 2, y, detailW - 4, 3, null, 'normal', borderColor);
            renderer.write(detailX + 4, y + 1, opt.name, color);
            
            if (isSelected) {
                 renderer.write(detailX + detailW - 15, y + 1, "[ENTER] START", '#00ff00');
            }
            
            // Stats (Duration, Risk etc - mocked for now)
            const duration = (opt.durationMs / 1000) + 's';
            renderer.write(detailX + 25, y + 1, duration, '#666666');
        });
    }
}

function renderRunsTab() {
    renderer.write(2, 5, "ACTIVE OPERATIONS", '#00ff00');
    
    if (engine.state.runs.length === 0) {
        renderer.write(2, 7, "No active operations.", '#666666');
        return;
    }
    
    engine.state.runs.forEach((run, i) => {
        const y = 7 + (i * 3);
        const activity = engine.data.activities.find(a => a.id === run.activityId);
        const option = activity.options.find(o => o.id === run.optionId);
        
        const progress = Math.min(1, (engine.state.now - run.startedAt) / (run.endsAt - run.startedAt));
        const barWidth = 40;
        const filled = Math.floor(progress * barWidth);
        const bar = "█".repeat(filled) + "▒".repeat(barWidth - filled);
        
        renderer.write(2, y, `${activity.name} - ${option.name}`, '#ffffff');
        renderer.write(2, y + 1, `[${bar}] ${Math.floor(progress * 100)}%`, '#00ffff');
    });
}

function renderLogTab() {
    engine.state.log.forEach((entry, i) => {
        const color = entry.type === 'error' ? '#ff0000' : (entry.type === 'success' ? '#00ff00' : '#cccccc');
        const time = new Date(entry.timestamp).toLocaleTimeString();
        renderer.write(2, 5 + i, `[${time}] ${entry.message}`, color);
    });
}

main();
