// Crime Committer VI - Main Controller
// Handles input, manages UI state, coordinates render loop

import { Engine } from './engine.js';
import { FrameBuffer } from './framebuffer.js';
import { DOMRenderer } from './dom_renderer.js';
import { UI, Layout } from './ui.js';

// Initialize the rendering stack
const buffer = new FrameBuffer(Layout.WIDTH, Layout.HEIGHT);
const renderer = new DOMRenderer(buffer, 'game');
const engine = new Engine();

// UI state (navigation, selections, settings)
const ui = {
  tab: 'jobs', // jobs, active, crew, settings
  focus: 'activity', // activity | option
  branchIndex: 0,
  activityIndex: 0,
  optionIndex: 0,
  logOffset: 0,
  settings: loadSettings(),
};

// Create UI layer
const uiLayer = new UI(buffer, engine, ui);

// Input handling
document.addEventListener('keydown', handleInput);

// Main entry point
async function main() {
  await engine.init();
  applyFont();
  render();

  // Game loop: tick engine and render at 5fps (200ms)
  setInterval(() => {
    engine.tick();
    render();
  }, 200);
}

// Available fonts (cycle order)
const FONTS = ['fira', 'vga-9x8', 'vga-8x16'];
const FONT_NAMES = {
  'fira': 'Fira Code (modern)',
  'vga-9x8': 'VGA 9x8 (compact)',
  'vga-8x16': 'VGA 8x16 (classic)'
};

// Settings persistence
function loadSettings() {
  try {
    const raw = localStorage.getItem('ccv_tui_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate old font settings
      if (parsed.font === 'vga') parsed.font = 'vga-9x8';
      if (parsed.font === 'scp') parsed.font = 'fira';
      if (FONTS.includes(parsed.font)) return parsed;
    }
  } catch (err) {
    console.warn('Settings load failed', err);
  }
  return { font: 'fira' };
}

function saveSettings() {
  try {
    localStorage.setItem('ccv_tui_settings', JSON.stringify(ui.settings));
  } catch (err) {
    console.warn('Settings save failed', err);
  }
}

function applyFont() {
  const container = document.getElementById('game');
  // Remove all font classes
  FONTS.forEach(font => container.classList.remove(`font-${font}`));
  // Add current font class
  container.classList.add(`font-${ui.settings.font}`);
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
  // Tab switching (J, A, C, S)
  if (e.key === 'j' || e.key === 'J') ui.tab = 'jobs';
  if (e.key === 'a' || e.key === 'A') ui.tab = 'active';
  if (e.key === 'c' || e.key === 'C') ui.tab = 'crew';
  if (e.key === 's' || e.key === 'S') ui.tab = 'settings';

  // Tab-specific input
  if (ui.tab === 'jobs') handleJobsInput(e);
  if (ui.tab === 'active') handleActiveInput(e);
  if (ui.tab === 'crew') handleCrewInput(e);
  if (ui.tab === 'settings') handleSettingsInput(e);

  render();
}

function handleJobsInput(e) {
  const branches = uiLayer.getVisibleBranches();
  const branch = branches[ui.branchIndex] || branches[0];
  const activities = uiLayer.getVisibleActivities(branch?.id);
  const activity = activities[ui.activityIndex];
  const options = activity ? uiLayer.getVisibleOptions(activity) : [];

  // Branch hotkeys
  branches.forEach((b, i) => {
    if (e.key === b.hotkey || e.key === b.hotkey?.toUpperCase()) {
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
      // Select activity by number
      if (num - 1 < activities.length) {
        ui.activityIndex = num - 1;
      }
    } else if (ui.focus === 'option') {
      // Select and start option by number
      if (num - 1 < options.length) {
        ui.optionIndex = num - 1;
        startSelectedRun(activity, options[num - 1]);
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
  }
}

function handleActiveInput(e) {
  // Placeholder for future run management
  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleCrewInput(e) {
  // Placeholder for crew management
  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

function handleSettingsInput(e) {
  console.log(`Settings input: ${e.key}`);
  if (e.key === 'Enter' || e.key === ' ') {
    console.log('Cycling font...');
    cycleFontSetting();
  }
}

function startSelectedRun(activity, option) {
  if (!activity || !option) return;
  const result = engine.startRun(activity.id, option.id);
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
