// Crime Committer VI - Main Controller
// Handles input, manages UI state, coordinates render loop

import { Engine } from './engine.js';
import { FrameBuffer } from './framebuffer.js';
import { DOMRenderer } from './dom_renderer.js';
import { UI, Layout } from './ui.js';
import { NameGenerator } from './names.js';

// Initialize the rendering stack
const buffer = new FrameBuffer(Layout.WIDTH, Layout.HEIGHT);
const renderer = new DOMRenderer(buffer, 'game');
const engine = new Engine();
const BLOOM_OVERLAY_ID = 'bloom-overlay';

// Settings constants (must be defined before loadSettings)
const FONTS = ['fira', 'vga-9x8', 'vga-8x16'];
const FONT_NAMES = {
  'fira': 'Fira Code (modern)',
  'vga-9x8': 'VGA 9x8 (compact)',
  'vga-8x16': 'VGA 8x16 (classic)'
};
const MIN_ZOOM = 100; // %
const MAX_ZOOM = 300; // %
const ZOOM_STEP = 50; // %

// UI state (navigation, selections, options)
const ui = {
  tab: 'jobs', // jobs, active, crew, options
  focus: 'activity', // activity | option
  branchIndex: 0,
  activityIndex: 0,
  optionIndex: 0,
  logOffset: 0,
  settings: loadSettings(),
  scroll: {
    crew: 0, // vertical scroll offset for crew roster
  },
};

// Create UI layer
const uiLayer = new UI(buffer, engine, ui);

// Input handling
document.addEventListener('keydown', handleInput);
window.addEventListener('beforeunload', saveSettings);

// Main entry point
async function main() {
  await engine.init();
  applyFont();
  saveSettings(); // Persist any new default fields (zoom/bloom) immediately
  render();

  // Game loop: tick engine and render at 5fps (200ms)
  setInterval(() => {
    engine.tick();
    render();
  }, 200);
}

// Settings persistence
function loadSettings() {
  const defaults = {
    font: 'fira',
    gradients: true,
    hotkeyGlow: true,
    bloom: false,
    funnyNames: false,
    zoom: 100, // Font size zoom percentage (100, 150, 200, 250, etc.)
  };

  try {
    const raw = localStorage.getItem('ccv_tui_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old font settings
      if (parsed.font === 'vga') parsed.font = 'vga-9x8';
      if (parsed.font === 'scp') parsed.font = 'fira';
      if (parsed.fontScale && !parsed.zoom) parsed.zoom = Math.round(parsed.fontScale * 100);
      if (parsed.zoom && parsed.zoom < MIN_ZOOM) parsed.zoom = MIN_ZOOM;

      // Merge with defaults to ensure new settings exist
      const loaded = { ...defaults, ...parsed };
      console.log('Settings loaded:', loaded);
      return loaded;
    }
  } catch (err) {
    console.warn('Settings load failed', err);
  }
  console.log('Using default settings:', defaults);
  return defaults;
}

function saveSettings() {
  try {
    localStorage.setItem('ccv_tui_settings', JSON.stringify(ui.settings));
    console.log('Settings saved:', ui.settings);
  } catch (err) {
    console.warn('Settings save failed', err);
  }
}

function applyFont() {
  const container = document.getElementById('game');
  if (!container) return;

  // Remove all font classes
  FONTS.forEach(font => container.classList.remove(`font-${font}`));
  // Add current font class
  const nextFont = FONTS.includes(ui.settings.font) ? ui.settings.font : 'fira';
  ui.settings.font = nextFont;
  container.classList.add(`font-${nextFont}`);

  // Scale the font size via CSS
  const zoom = clamp(ui.settings.zoom || MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  ui.settings.zoom = zoom;
  container.style.fontSize = `${zoom}%`;

  // Bloom-style overlay (separate element)
  applyBloom();
}

function cycleFontSetting() {
  const currentIndex = FONTS.indexOf(ui.settings.font);
  const nextIndex = (currentIndex + 1) % FONTS.length;
  ui.settings.font = FONTS[nextIndex];
  console.log(`Font changed to: ${ui.settings.font}`);
  applyFont();
  saveSettings();
}

// Input handling by tab
function handleInput(e) {
  // Tab switching (J, A, C, O)
  if (e.key === 'j' || e.key === 'J') {
    ui.tab = 'jobs';
    ui.focus = 'activity';  // Reset to branch/activity list
    ui.optionIndex = 0;
    // ui.branchIndex already persists, so last branch is remembered
  }
  if (e.key === 'a' || e.key === 'A') ui.tab = 'active';
  if (e.key === 'c' || e.key === 'C') ui.tab = 'crew';
  if (e.key === 'o' || e.key === 'O') ui.tab = 'options';

  // Tab-specific input
  if (ui.tab === 'jobs') handleJobsInput(e);
  if (ui.tab === 'active') handleActiveInput(e);
  if (ui.tab === 'crew') handleCrewInput(e);
  if (ui.tab === 'options') handleOptionsInput(e);

  render();
}

function handleJobsInput(e) {
  const branches = uiLayer.getVisibleBranches();
  const branch = branches[ui.branchIndex] || branches[0];
  const activities = uiLayer.getVisibleActivities(branch?.id);
  const activity = activities[ui.activityIndex];
  const options = activity ? uiLayer.getVisibleOptions(activity) : [];
  const key = (e.key || '').toLowerCase();

  // Branch hotkeys
  branches.forEach((b, i) => {
    const hotkey = (b.hotkey || '').toLowerCase();
    if (hotkey && key === hotkey) {
      ui.branchIndex = i;
      ui.activityIndex = 0;
      ui.optionIndex = 0;
      ui.focus = 'activity';
    }
  });

  // Number keys for selection
  if (e.key >= '1' && e.key <= '9') {
    const num = parseInt(e.key);
    if (ui.focus === 'activity') {
      // Select activity by number and auto-drill into it
      if (num - 1 < activities.length) {
        ui.activityIndex = num - 1;
        ui.focus = 'option';
        ui.optionIndex = 0;
      }
    } else if (ui.focus === 'option') {
      // Select option by number (don't start it)
      if (num - 1 < options.length) {
        ui.optionIndex = num - 1;
      }
    }
  }

  // Backspace to go back
  if (e.key === 'Backspace') {
    if (ui.focus === 'option') {
      ui.focus = 'activity';
      ui.optionIndex = 0;
    }
  }

  // Arrow key navigation
  if (ui.focus === 'activity') {
    if (e.key === 'ArrowUp') ui.activityIndex = Math.max(0, ui.activityIndex - 1);
    if (e.key === 'ArrowDown') ui.activityIndex = Math.min(Math.max(0, activities.length - 1), ui.activityIndex + 1);
    if (e.key === 'Enter' && activity) {
      ui.focus = 'option';
      ui.optionIndex = 0;
    }
  } else if (ui.focus === 'option') {
    if (e.key === 'ArrowUp') ui.optionIndex = Math.max(0, ui.optionIndex - 1);
    if (e.key === 'ArrowDown') ui.optionIndex = Math.min(Math.max(0, options.length - 1), ui.optionIndex + 1);
    if (e.key === 'Enter') startSelectedRun(activity, options[ui.optionIndex]);

    // RIGHT arrow switches to runs column
    if (e.key === 'ArrowRight') {
      const activityRuns = engine.state.runs.filter(r => r.activityId === activity.id);
      if (activityRuns.length > 0) {
        ui.focus = 'runs';
        ui.selectedRun = ui.selectedRun || 0;
      }
    }

    // Repeat mode controls (only if selected option is repeatable)
    const selectedOption = options[ui.optionIndex];
    if (selectedOption?.repeatable) {
      // Toggle repeat mode
      if (key === 'g') ui.repeatMode = 'single';
      if (key === 'm') ui.repeatMode = 'multi';
      if (key === 'i') ui.repeatMode = 'infinite';

      // Adjust multi count
      if (ui.repeatMode === 'multi') {
        if (e.key === '+' || e.key === '=') {
          ui.repeatCount = Math.min(999, (ui.repeatCount || 2) + 1);
        }
        if (e.key === '-' || e.key === '_') {
          ui.repeatCount = Math.max(2, (ui.repeatCount || 2) - 1);
        }
      }
    }
  } else if (ui.focus === 'runs') {
    // NEW FOCUS STATE for navigating runs
    const activityRuns = engine.state.runs.filter(r => r.activityId === activity.id);

    // LEFT arrow switches back to options
    if (e.key === 'ArrowLeft') {
      ui.focus = 'option';
    }

    // UP/DOWN navigate runs
    if (e.key === 'ArrowUp') {
      ui.selectedRun = Math.max(0, ui.selectedRun - 1);
    }
    if (e.key === 'ArrowDown') {
      ui.selectedRun = Math.min(activityRuns.length - 1, ui.selectedRun + 1);
    }

    // X key stops selected run immediately
    if (e.key === 'x' || e.key === 'X') {
      const run = activityRuns[ui.selectedRun];
      if (run) engine.stopRun(run.runId);
    }

    // Z key stops repeat (lets current finish)
    if (e.key === 'z' || e.key === 'Z') {
      const run = activityRuns[ui.selectedRun];
      if (run && run.runsLeft !== 0) {
        engine.stopRepeat(run.runId);
      }
    }
  }
}

function handleActiveInput(e) {
  // Placeholder for future run management
  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function getUsedCrewNames() {
  return new Set(
    engine.state.crew.staff.map((member) => (member.name || '').toLowerCase())
  );
}

function generateUniqueCrewName(usedNames = getUsedCrewNames()) {
  let candidate = '';
  let attempts = 0;

  do {
    candidate = NameGenerator.generate(ui.settings?.funnyNames);
    attempts += 1;
  } while (usedNames.has(candidate.toLowerCase()) && attempts < 20);

  // Fallback to suffixing if we somehow hit too many duplicates
  if (usedNames.has(candidate.toLowerCase())) {
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    candidate = `${candidate} ${suffix}`;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function handleCrewInput(e) {
  // Scrolling support (keep in sync with renderCrewTab layout)
  const rosterTop = 5 + 7; // tab top (5) + roster header spacing (7)
  const rosterBottom = Layout.HEIGHT - 3;
  const visibleRows = Math.max(0, rosterBottom - rosterTop + 1);
  const totalCrew = engine.state.crew.staff.length;
  const pageStep = Math.max(1, visibleRows - 1);
  const maxOffset = Math.max(0, totalCrew - visibleRows);

  const setCrewScroll = (next) => {
    if (!ui.scroll) ui.scroll = {};
    ui.scroll.crew = Math.max(0, Math.min(maxOffset, next));
  };

  if (e.key === 'ArrowDown') setCrewScroll((ui.scroll?.crew || 0) + 1);
  if (e.key === 'ArrowUp') setCrewScroll((ui.scroll?.crew || 0) - 1);
  if (e.key === 'PageDown') setCrewScroll((ui.scroll?.crew || 0) + pageStep);
  if (e.key === 'PageUp') setCrewScroll((ui.scroll?.crew || 0) - pageStep);
  if (e.key === 'End') setCrewScroll(maxOffset);
  if (e.key === 'Home') setCrewScroll(0);

  const usedNames = getUsedCrewNames();

  // Spawn single test crew member
  if (e.key === ' ') {
    const testMember = {
      id: `test_${Date.now()}`,
      name: generateUniqueCrewName(usedNames),
      roleId: 'player',  // Fixed: use 'player' instead of 'muscle'
      status: 'available',
      xp: 0,
      stars: 1
    };
    engine.state.crew.staff.push(testMember);
    engine.log('Added test crew member', 'info');
    engine.saveState();  // Save state after adding crew
  }

  // Spawn 5 test crew members
  if (e.key === 'a' || e.key === 'A') {
    for (let i = 0; i < 5; i++) {
      const testMember = {
        id: `test_${Date.now()}_${i}`,
        name: generateUniqueCrewName(usedNames),
        roleId: 'player',  // Fixed: use 'player' instead of 'muscle'
        status: 'available',
        xp: 0,
        stars: 1
      };
      engine.state.crew.staff.push(testMember);
    }
    engine.log('Added 5 test crew members', 'info');
    engine.saveState();  // Save state after adding crew
  }

  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleOptionsInput(e) {
  // Initialize selectedSetting if not set
  if (ui.selectedSetting === undefined) ui.selectedSetting = 0;

  // Arrow navigation for settings list
  if (e.key === 'ArrowUp') {
    ui.selectedSetting = Math.max(0, ui.selectedSetting - 1);
  }
  if (e.key === 'ArrowDown') {
    ui.selectedSetting = Math.min(5, ui.selectedSetting + 1);
  }

  // Number key selection (1-6)
  if (e.key >= '1' && e.key <= '6') {
    ui.selectedSetting = parseInt(e.key) - 1;
  }

  // Left/right to change font size when selected
  if (ui.selectedSetting === 1) {
    if (e.key === 'ArrowLeft') {
      ui.settings.zoom = clamp((ui.settings.zoom || MIN_ZOOM) - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
      applyFont();
      saveSettings();
    }
    if (e.key === 'ArrowRight') {
      ui.settings.zoom = clamp((ui.settings.zoom || MIN_ZOOM) + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
      applyFont();
      saveSettings();
    }
  }

  // Enter/space to toggle or cycle
  if (e.key === 'Enter' || e.key === ' ') {
    if (ui.selectedSetting === 0) {
      cycleFontSetting();
    } else if (ui.selectedSetting === 1) {
      // Step up (wrap to min after max)
      const nextZoom = (ui.settings.zoom || MIN_ZOOM) + ZOOM_STEP;
      ui.settings.zoom = nextZoom > MAX_ZOOM ? MIN_ZOOM : clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      applyFont();
      saveSettings();
    } else if (ui.selectedSetting === 2) {
      ui.settings.gradients = !ui.settings.gradients;
      saveSettings();
    } else if (ui.selectedSetting === 3) {
      ui.settings.hotkeyGlow = !ui.settings.hotkeyGlow;
      saveSettings();
    } else if (ui.selectedSetting === 4) {
      ui.settings.bloom = !ui.settings.bloom;
      applyBloom();
      saveSettings();
    } else if (ui.selectedSetting === 5) {
      ui.settings.funnyNames = !ui.settings.funnyNames;
      saveSettings();
    }
  }
}

function applyBloom() {
  const existing = document.getElementById(BLOOM_OVERLAY_ID);
  if (!ui.settings.bloom) {
    if (existing) existing.style.display = 'none';
    return;
  }

  const overlay = existing || (() => {
    const el = document.createElement('div');
    el.id = BLOOM_OVERLAY_ID;
    document.body.appendChild(el);
    return el;
  })();

  overlay.style.display = 'block';
}

function startSelectedRun(activity, option) {
  if (!activity || !option) return;

  // Calculate runsLeft based on repeat mode
  const mode = ui.repeatMode || 'single';
  let runsLeft = 0; // default: single run

  if (option.repeatable) {
    if (mode === 'infinite') {
      runsLeft = -1; // infinite repeats
    } else if (mode === 'multi') {
      const count = ui.repeatCount || 2;
      runsLeft = count - 1; // N more runs after this one
    }
  }

  const result = engine.startRun(activity.id, option.id, null, runsLeft);
  if (!result.ok) {
    engine.log(`Start failed: ${result.reason}`, 'error');
  }
}

// Main render function
function render() {
  syncSelection();

  // UI layer writes to buffer (layered composition)
  uiLayer.render();

  // Renderer flushes buffer to DOM
  renderer.render();
}

function syncSelection() {
  const branches = uiLayer.getVisibleBranches();
  if (branches.length === 0) {
    ui.branchIndex = 0;
    ui.activityIndex = 0;
    ui.optionIndex = 0;
    return;
  }

  ui.branchIndex = clamp(ui.branchIndex, 0, branches.length - 1);

  const branch = branches[ui.branchIndex];
  const activities = uiLayer.getVisibleActivities(branch?.id);
  if (activities.length === 0) {
    ui.activityIndex = 0;
    ui.optionIndex = 0;
    return;
  }

  ui.activityIndex = clamp(ui.activityIndex, 0, activities.length - 1);

  const options = uiLayer.getVisibleOptions(activities[ui.activityIndex]);
  if (options.length === 0) {
    ui.optionIndex = 0;
    return;
  }

  ui.optionIndex = clamp(ui.optionIndex, 0, options.length - 1);
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

// Start the application
main();
