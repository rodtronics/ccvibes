// Crime Committer VI - Main Controller
// Handles input, manages UI state, coordinates render loop

import { Engine } from './engine.js';
import { FrameBuffer } from './framebuffer.js';
import { DOMRenderer } from './dom_renderer.js';
import { UI, Layout } from './ui.js';
import { NameGenerator } from './names.js';
import { ModalQueue, loadModalData, getModal } from './modal.js';

// Initialize the rendering stack
const buffer = new FrameBuffer(Layout.WIDTH, Layout.HEIGHT);
const renderer = new DOMRenderer(buffer, 'game');
const engine = new Engine();
const BLOOM_OVERLAY_ID = 'bloom-overlay';

// Settings constants (must be defined before loadSettings)
const FONTS = ['fira', 'vga-9x8', 'vga-8x16', 'jetbrains-mono', 'ibm-bios', 'scp'];
const FONT_CATEGORIES = {
  modern: ['fira', 'jetbrains-mono', 'scp'],
  retro: ['vga-9x8', 'vga-8x16', 'ibm-bios']
};

const FONT_NAMES = {
  'fira': 'Fira Mono (bold)',
  'vga-9x8': 'VGA 9x8 (compact)',
  'vga-8x16': 'VGA 8x16 (classic)',
  'jetbrains-mono': 'JetBrains Mono (bold)',
  'ibm-bios': 'IBM BIOS (retro)',
  'scp': 'Source Code Pro (bold)'
};

function getFontCategory(fontId) {
  if (FONT_CATEGORIES.modern.includes(fontId)) return 'modern';
  return 'retro';
}

const MIN_ZOOM = 100; // %
const MAX_ZOOM = 300; // %
const ZOOM_STEP = 50; // %

// UI state (navigation, selections, options)
const ui = {
  tab: 'jobs', // jobs, active, crew, resources, stats, options
  focus: 'activity', // activity | option | runs | crimeDetail
  branchIndex: 0,
  activityIndex: 0,
  optionIndex: 0,
  logOffset: 0,
  settings: loadSettings(),
  scroll: {
    crew: 0, // vertical scroll offset for crew roster
  },
  modal: {
    active: false,
    id: null,
    content: '',
    borderStyle: null,
    borderColor: null,
    backgroundColor: null,
    scroll: 0,
  },
  crimeDetail: {
    active: false,
    activityId: null,
    optionId: null,
    repeatMode: 'single', // 'single' | 'multi' | 'infinite'
    repeatCount: 2,
    stopPolicy: 'stopOnFail', // 'stopOnFail' | 'retryRegardless'
    selectedSlotIndex: 0, // Which crew slot is selected (for multi-crew crimes)
    crewSlots: [], // Array of { options: [], selectedIndex: 0 } for each slot
  },
};

// Create UI layer
const uiLayer = new UI(buffer, engine, ui);

// Modal queue
const modalQueue = new ModalQueue();

// Input handling
document.addEventListener('keydown', handleInput);
window.addEventListener('beforeunload', saveSettings);

// Main entry point
async function main() {
  // Hide the game container until fully initialized
  const container = document.getElementById('game');
  if (container) container.style.visibility = 'hidden';

  await engine.init();
  await loadModalData(); // Load modal definitions from JSON
  applyFont();
  saveSettings(); // Persist any new default fields (zoom/bloom) immediately
  render();

  // Show intro modal on launch (if enabled in settings)
  if (ui.settings.showIntro) {
    modalQueue.enqueue('intro');
    if (modalQueue.hasNext()) {
      const nextId = modalQueue.dequeue();
      showModal(nextId);
    }
  }

  // Reveal the game now that everything is ready
  if (container) container.style.visibility = 'visible';

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
    gradients: false,    // Always off (removed from options)
    hotkeyGlow: false,   // Always off (removed from options)
    bloom: false,
    funnyNames: false,
    allCaps: true,       // Always on (removed from options)
    zoom: 100, // Font size zoom percentage (100, 150, 200, 250, etc.)
    showIntro: true,     // Show intro modal on launch
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

function cycleFontSetting(direction = 1) {
  const currentFont = ui.settings.font;
  const category = getFontCategory(currentFont);
  const fonts = FONT_CATEGORIES[category];
  
  const currentIndex = fonts.indexOf(currentFont);
  // Calculate next index with wrap-around
  let nextIndex = (currentIndex + direction) % fonts.length;
  if (nextIndex < 0) nextIndex = fonts.length - 1;
  
  ui.settings.font = fonts[nextIndex];
  console.log(`Font cycled to: ${ui.settings.font} (Category: ${category})`);
  applyFont();
  saveSettings();
}

function switchFontCategory() {
  const currentFont = ui.settings.font;
  const currentCategory = getFontCategory(currentFont);
  const nextCategory = currentCategory === 'modern' ? 'retro' : 'modern';
  
  // Pick the first font of the new category
  ui.settings.font = FONT_CATEGORIES[nextCategory][0];
  console.log(`Font category switched to: ${nextCategory}, Font: ${ui.settings.font}`);
  applyFont();
  saveSettings();
}


// Input handling by tab
function handleInput(e) {
  // Modal takes priority over all other input
  if (ui.modal.active) {
    handleModalInput(e);
    return;
  }

  // Tab switching (J, A, C, O)
  if (e.key === 'j' || e.key === 'J') {
    ui.tab = 'jobs';
    ui.focus = 'activity';  // Reset to branch/activity list
    ui.optionIndex = 0;
    closeCrimeDetail(); // Close crime detail if open
    // ui.branchIndex already persists, so last branch is remembered
  }
  if (e.key === 'a' || e.key === 'A') {
    ui.tab = 'active';
    closeCrimeDetail();
  }
  if (e.key === 'c' || e.key === 'C') {
    ui.tab = 'crew';
    closeCrimeDetail();
  }
  if (e.key === 'r' || e.key === 'R') {
    ui.tab = 'resources';
    closeCrimeDetail();
  }
  if (e.key === 's' || e.key === 'S') {
    ui.tab = 'stats';
    closeCrimeDetail();
  }
  if (e.key === 'l' || e.key === 'L') {
    ui.tab = 'log';
    closeCrimeDetail();
  }
  if (e.key === 'o' || e.key === 'O') {
    ui.tab = 'options';
    closeCrimeDetail();
  }

  // Tab-specific input
  if (ui.tab === 'jobs') handleJobsInput(e);
  if (ui.tab === 'active') handleActiveInput(e);
  if (ui.tab === 'crew') handleCrewInput(e);
  if (ui.tab === 'resources') handleResourcesInput(e);
  if (ui.tab === 'stats') handleStatsInput(e);
  if (ui.tab === 'log') handleLogInput(e);
  if (ui.tab === 'options') handleOptionsInput(e);

  render();
}

function handleJobsInput(e) {
  // Crime detail window takes priority
  if (ui.crimeDetail.active) {
    handleCrimeDetailInput(e);
    return;
  }

  const branches = uiLayer.getVisibleBranches();
  const branch = branches[ui.branchIndex] || branches[0];
  const activities = uiLayer.getVisibleActivities(branch?.id);
  const activity = activities[ui.activityIndex];
  const options = activity ? uiLayer.getVisibleOptions(activity) : [];
  const key = (e.key || '').toLowerCase();

  // Branch hotkeys
  for (let i = 0; i < branches.length; i++) {
    const hotkey = (branches[i].hotkey || '').toString().trim().toLowerCase();
    if (hotkey && key === hotkey) {
      ui.branchIndex = i;
      ui.activityIndex = 0;
      ui.optionIndex = 0;
      ui.focus = 'activity';
      return;
    }
  }

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

  // Backspace/Escape to go back
  if (e.key === 'Backspace' || e.key === 'Escape') {
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

    // ENTER opens crime detail window
    if (e.key === 'Enter') {
      const selectedOption = options[ui.optionIndex];
      if (selectedOption) {
        openCrimeDetail(activity, selectedOption);
      }
    }

    // Q for quick start (skip detail window)
    if (key === 'q') {
      startSelectedRun(activity, options[ui.optionIndex]);
    }

    // RIGHT arrow switches to runs column
    if (e.key === 'ArrowRight') {
      const activityRuns = engine.state.runs.filter(r => r.activityId === activity.id);
      if (activityRuns.length > 0) {
        ui.focus = 'runs';
        const current = ui.selectedRun ?? 0;
        ui.selectedRun = clamp(current, 0, activityRuns.length - 1);
      }
    }

    // Repeat mode controls (only if selected option is repeatable)
    const selectedOption = options[ui.optionIndex];
    if (selectedOption?.repeatable) {
      // Toggle repeat mode
      if (key === 'n') ui.repeatMode = 'multi';  // N for multi (Number of runs)
      if (key === 'i') ui.repeatMode = 'infinite';

      // Adjust multi count
      if (ui.repeatMode === 'multi') {
        if (e.key === '+' || e.key === '=') {
          ui.repeatCount = Math.min(999, (ui.repeatCount || 2) + 1);
        }
        if (e.key === '-' || e.key === '_') {
          ui.repeatCount = Math.max(1, (ui.repeatCount || 2) - 1);  // Can go down to 1
        }
      }
    }
  } else if (ui.focus === 'runs') {
    // NEW FOCUS STATE for navigating runs
    const activityRuns = engine.state.runs.filter(r => r.activityId === activity.id);
    if (activityRuns.length === 0) {
      ui.focus = 'option';
      ui.selectedRun = 0;
      return;
    }

    if (ui.selectedRun === undefined) ui.selectedRun = 0;

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

// Open crime detail window
function openCrimeDetail(activity, option) {
  ui.crimeDetail.active = true;
  ui.crimeDetail.activityId = activity.id;
  ui.crimeDetail.optionId = option.id;
  // Reset to defaults
  ui.crimeDetail.repeatMode = 'single';
  ui.crimeDetail.repeatCount = 2;
  ui.crimeDetail.stopPolicy = 'stopOnFail';
  ui.crimeDetail.selectedSlotIndex = 0;

  // Build crew slots based on requirements
  const staffReqs = option.requirements?.staff || [];
  ui.crimeDetail.crewSlots = staffReqs.map(req => {
    // Get all available crew matching this role
    const available = engine.state.crew.staff.filter(
      s => s.roleId === req.roleId && s.status === 'available'
    );

    return {
      roleId: req.roleId,
      count: req.count,
      options: available,
      selectedIndex: 0
    };
  });
}

// Close crime detail window
function closeCrimeDetail() {
  ui.crimeDetail.active = false;
  ui.crimeDetail.activityId = null;
  ui.crimeDetail.optionId = null;
}

// Handle input for crime detail window
function handleCrimeDetailInput(e) {
  const key = (e.key || '').toLowerCase();
  const activity = engine.data.activities.find(a => a.id === ui.crimeDetail.activityId);
  const option = activity?.options.find(o => o.id === ui.crimeDetail.optionId);

  if (!activity || !option) {
    closeCrimeDetail();
    return;
  }

  // ESC/Backspace to close without starting
  if (e.key === 'Escape' || e.key === 'Backspace') {
    closeCrimeDetail();
    return;
  }

  // Q for quick start (single run with default policy)
  if (key === 'q') {
    startRunFromDetail(activity, option, 'single');
    closeCrimeDetail();
    return;
  }

  // I key cycles through iterate modes (only if repeatable)
  if (key === 'i') {
    if (option.repeatable) {
      const modes = ['single', 'multi', 'infinite'];
      const currentIndex = modes.indexOf(ui.crimeDetail.repeatMode);
      ui.crimeDetail.repeatMode = modes[(currentIndex + 1) % modes.length];
    } else {
      ui.crimeDetail.repeatMode = 'single';
    }
  }

  // P key toggles policy
  if (key === 'p') {
    ui.crimeDetail.stopPolicy = ui.crimeDetail.stopPolicy === 'stopOnFail'
      ? 'retryRegardless'
      : 'stopOnFail';
  }

  // +/- adjust repeat count (only for multi mode)
  if (ui.crimeDetail.repeatMode === 'multi') {
    if (e.key === '+' || e.key === '=') {
      ui.crimeDetail.repeatCount = Math.min(999, ui.crimeDetail.repeatCount + 1);
    }
    if (e.key === '-' || e.key === '_') {
      ui.crimeDetail.repeatCount = Math.max(1, ui.crimeDetail.repeatCount - 1);
    }
  }

  // UP/DOWN navigate crew slots
  const slots = ui.crimeDetail.crewSlots;
  if (e.key === 'ArrowUp' && slots.length > 0) {
    ui.crimeDetail.selectedSlotIndex = Math.max(0, ui.crimeDetail.selectedSlotIndex - 1);
  }
  if (e.key === 'ArrowDown' && slots.length > 0) {
    ui.crimeDetail.selectedSlotIndex = Math.min(slots.length - 1, ui.crimeDetail.selectedSlotIndex + 1);
  }

  // LEFT/RIGHT cycle through crew options for selected slot
  if (slots.length > 0) {
    const currentSlot = slots[ui.crimeDetail.selectedSlotIndex];
    if (currentSlot && currentSlot.options.length > 0) {
      if (e.key === 'ArrowLeft') {
        currentSlot.selectedIndex = Math.max(0, currentSlot.selectedIndex - 1);
      }
      if (e.key === 'ArrowRight') {
        currentSlot.selectedIndex = Math.min(currentSlot.options.length - 1, currentSlot.selectedIndex + 1);
      }
    }
  }

  // ENTER to start with configured settings
  if (e.key === 'Enter') {
    startRunFromDetail(activity, option, ui.crimeDetail.repeatMode);
    closeCrimeDetail();
  }
}

// Get all available crew choices that meet requirements (simplified)
function getAvailableCrewChoices(requirements) {
  const staffReqs = requirements?.staff || [];
  if (staffReqs.length === 0) return [];

  // For now, just get all available crew that match the role requirement
  // and create simple combinations (first N available crew)

  const choices = [];

  // Get all matching crew for the requirement
  if (staffReqs.length === 1) {
    const req = staffReqs[0];
    const available = engine.state.crew.staff.filter(
      s => s.roleId === req.roleId && s.status === 'available'
    );

    // Create choices by picking different crew members
    for (let i = 0; i + req.count - 1 < available.length; i++) {
      const staffIds = available.slice(i, i + req.count).map(s => s.id);
      choices.push({ staffIds, staff: available.slice(i, i + req.count) });
    }
  } else {
    // Multiple requirements - just use auto-assign for now
    const autoIds = engine.autoAssign(requirements);
    if (autoIds.length > 0) {
      choices.push({
        staffIds: autoIds,
        staff: autoIds.map(id => engine.state.crew.staff.find(s => s.id === id)).filter(Boolean)
      });
    }
  }

  return choices;
}

// Start run using crime detail settings
function startRunFromDetail(activity, option, repeatMode) {
  const mode = repeatMode || ui.crimeDetail.repeatMode;
  let runsLeft = 0;

  if (option.repeatable) {
    if (mode === 'infinite') {
      runsLeft = -1;
    } else if (mode === 'multi') {
      runsLeft = ui.crimeDetail.repeatCount - 1;
    }
  }

  // Build staff IDs from selected crew in slots
  let staffIds = null;
  if (ui.crimeDetail.crewSlots.length > 0) {
    staffIds = [];
    for (const slot of ui.crimeDetail.crewSlots) {
      const selectedStaff = slot.options[slot.selectedIndex];
      if (selectedStaff) {
        // Add this staff member 'count' times for the requirement
        for (let i = 0; i < slot.count; i++) {
          staffIds.push(selectedStaff.id);
        }
      }
    }
    // If we couldn't build a valid selection, fall back to auto-assign
    if (staffIds.length === 0) staffIds = null;
  }

  const result = engine.startRun(activity.id, option.id, staffIds, runsLeft);
  if (!result.ok) {
    engine.log(`Start failed: ${result.reason}`, 'error');
  }
}

function handleActiveInput(e) {
  // Placeholder for future run management
  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleResourcesInput(e) {
  // Placeholder for future resources management
  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleStatsInput(e) {
  // Placeholder for future stats screen
  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleLogInput(e) {
  const top = 4;
  const listTop = top + 1;
  const listBottom = Layout.HEIGHT - 3;
  const visibleRows = Math.max(0, listBottom - listTop + 1);
  const totalLogs = engine.state.log.length;
  const pageStep = Math.max(1, visibleRows - 1);
  const maxOffset = Math.max(0, totalLogs - visibleRows);

  const setLogScroll = (next) => {
    if (!ui.scroll) ui.scroll = {};
    ui.scroll.log = Math.max(0, Math.min(maxOffset, next));
  };

  if (e.key === 'ArrowDown') setLogScroll((ui.scroll?.log || 0) + 1);
  if (e.key === 'ArrowUp') setLogScroll((ui.scroll?.log || 0) - 1);
  if (e.key === 'PageDown') setLogScroll((ui.scroll?.log || 0) + pageStep);
  if (e.key === 'PageUp') setLogScroll((ui.scroll?.log || 0) - pageStep);
  if (e.key === 'End') setLogScroll(maxOffset);
  if (e.key === 'Home') setLogScroll(0);

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
      roleId: 'player',
      status: 'available',
      xp: 0,
      stars: 1
    };
    engine.state.crew.staff.push(testMember);
    engine.log('Added test crew member', 'info');
    engine.saveState();
  }

  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleOptionsInput(e) {
  // Check if we are in the font submenu
  if (ui.inFontSubMenu) {
    handleFontSubMenuInput(e);
    return;
  }

  // Initialize selectedSetting if not set
  if (ui.selectedSetting === undefined) ui.selectedSetting = 0;

  // Arrow navigation for settings list (4 options: 0-3)
  if (e.key === 'ArrowUp') {
    ui.selectedSetting = Math.max(0, ui.selectedSetting - 1);
  }
  if (e.key === 'ArrowDown') {
    ui.selectedSetting = Math.min(3, ui.selectedSetting + 1);
  }

  // Number key selection (1-4)
  if (e.key >= '1' && e.key <= '4') {
    ui.selectedSetting = parseInt(e.key) - 1;
  }

  // Enter/space to toggle or cycle
  // Options: 0=Font..., 1=Bloom, 2=Funny names, 3=Show intro
  if (e.key === 'Enter' || e.key === ' ') {
    if (ui.selectedSetting === 0) {
      ui.inFontSubMenu = true;
      ui.fontSubMenuIndex = 0;
    } else if (ui.selectedSetting === 1) {
      ui.settings.bloom = !ui.settings.bloom;
      applyBloom();
      saveSettings();
    } else if (ui.selectedSetting === 2) {
      ui.settings.funnyNames = !ui.settings.funnyNames;
      saveSettings();
    } else if (ui.selectedSetting === 3) {
      ui.settings.showIntro = !ui.settings.showIntro;
      saveSettings();
    }
  }
}

function handleFontSubMenuInput(e) {
  if (ui.fontSubMenuIndex === undefined) ui.fontSubMenuIndex = 0;

  // Exit submenu
  if (e.key === 'Escape' || e.key === 'Backspace') {
    ui.inFontSubMenu = false;
    return;
  }

  // Navigation (0-2)
  if (e.key === 'ArrowUp') {
    ui.fontSubMenuIndex = Math.max(0, ui.fontSubMenuIndex - 1);
  }
  if (e.key === 'ArrowDown') {
    ui.fontSubMenuIndex = Math.min(2, ui.fontSubMenuIndex + 1);
  }

  // 0: Generation (Toggle)
  if (ui.fontSubMenuIndex === 0) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      switchFontCategory();
    }
  }
  
  // 1: Face (Cycle)
  if (ui.fontSubMenuIndex === 1) {
    if (e.key === 'ArrowLeft') {
      cycleFontSetting(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      cycleFontSetting(1);
    }
  }

  // 2: Size (Resize)
  if (ui.fontSubMenuIndex === 2) {
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

// Modal input handler
function handleModalInput(e) {
  if (!ui.modal.active) return;

  const modal = getModal(ui.modal.id);
  if (!modal) return;

  const contentHeight = 25 - 4; // Layout.HEIGHT - 4
  const parsedLines = modal.content.split('\n').length; // Rough estimate for max scroll

  // Scroll with arrow keys
  if (e.key === 'ArrowDown') {
    ui.modal.scroll = Math.min(ui.modal.scroll + 1, Math.max(0, parsedLines - contentHeight));
    e.preventDefault();
  }
  if (e.key === 'ArrowUp') {
    ui.modal.scroll = Math.max(0, ui.modal.scroll - 1);
    e.preventDefault();
  }

  // Dismiss with SPACE, ENTER, or ESC
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
    dismissModal();
    e.preventDefault();
  }
}

// Show a modal
function showModal(modalId) {
  const modal = getModal(modalId);
  if (!modal) {
    console.warn(`Modal not found: ${modalId}`);
    return;
  }

  ui.modal.active = true;
  ui.modal.id = modalId;
  ui.modal.content = modal.content;
  ui.modal.borderStyle = modal.borderStyle;
  ui.modal.borderColor = modal.borderColor;
  ui.modal.backgroundColor = modal.backgroundColor;
  ui.modal.scroll = 0;

  console.log(`Showing modal: ${modalId}`);
}

// Dismiss current modal and check queue for next
function dismissModal() {
  if (!ui.modal.active) return;

  const modalId = ui.modal.id;
  ui.modal.active = false;
  ui.modal.id = null;
  ui.modal.content = '';
  ui.modal.borderStyle = null;
  ui.modal.borderColor = null;
  ui.modal.backgroundColor = null;
  ui.modal.scroll = 0;

  // Mark as seen
  if (modalId) {
    modalQueue.markSeen(modalId);
  }

  console.log(`Dismissed modal: ${modalId}`);

  // Check queue for next modal
  if (modalQueue.hasNext()) {
    const nextId = modalQueue.dequeue();
    showModal(nextId);
  }
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
