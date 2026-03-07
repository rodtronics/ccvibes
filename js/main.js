// Crime Committer VI - Main Controller
// Handles input, manages UI state, coordinates render loop

import { Engine, sortRunsActiveFirst } from './engine.js';
import { FrameBuffer } from './framebuffer.js';
import { DOMRenderer } from './dom_renderer.js';
import { UI, Layout } from './ui.js';
import { ModalQueue, loadModalData, getModal, parseModalContent } from './modal.js';
import { getUsedCrewNames, generateUniqueCrewName, initCrewSystem } from './crew.js';
import { BootScreen, DosPrompt, BiosSetup } from './boot.js';
import {
  loadSettings,
  saveSettings,
  applyFont,
  applyBloom,
  cycleFontSetting,
  switchFontCategory,
  cycleFpsSetting,
  GRID_HEIGHTS,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  FPS_TO_MS
} from './settings.js';

// Modal queue (created early so it can be passed to engine)
const modalQueue = new ModalQueue();

// Initialize the rendering stack
const buffer = new FrameBuffer(Layout.WIDTH, Layout.HEIGHT);
const renderer = new DOMRenderer(buffer, 'game');
const engine = new Engine(modalQueue);
const BLOOM_OVERLAY_ID = 'bloom-overlay';
const bloomLayer = document.getElementById(BLOOM_OVERLAY_ID);
const bloomRenderer = bloomLayer ? new DOMRenderer(buffer, BLOOM_OVERLAY_ID) : null;

if (bloomLayer) {
  bloomLayer.style.backgroundColor = 'transparent';
}

// UI state (navigation, selections, options)
const ui = {
  tab: 'jobs', // jobs, crew, resources, stats, log, options
  focus: 'scenario', // branch | scenario | variant
  panelFocus: 'left', // 'left' (jobs browser) | 'right' (active runs)
  runsFilterMode: 'matching', // 'matching' (auto-filter by left panel) | 'all'
  branchIndex: 0,
  scenarioIndex: 0,
  variantIndex: 0,
  selectedRun: 0,
  logOffset: 0,
  settings: loadSettings(),
  scroll: {
    crew: 0, // vertical scroll offset for crew roster
    resources: 0, // vertical scroll offset for resources list
    runsPanel: 0, // active runs panel scroll offset
  },
  crewSelection: {
    selectedIndex: 0,      // Currently highlighted crew member index
    detailView: false,     // Whether we're viewing a single crew member
    perkChoiceIndex: 0,    // 0 = first perk option, 1+ = other options
  },
  resourceSelection: {
    selectedIndex: 0,      // Currently highlighted resource index
  },
  statsSelection: {
    selectedStat: 0,       // Index of selected stat (0-5)
    selectedPeriod: 0,     // 0=1sec, 1=1min, 2=5min, 3=1hr, 4=1day, 5=1mo
    logScale: false        // Whether to use logarithmic Y-axis
  },
  modal: {
    active: false,
    id: null,
    content: '',
    borderStyle: null,
    borderColor: null,
    backgroundColor: null,
    layout: 'centered',
    overlay: 'dim50',
    contentWidth: 76,
    scroll: 0,
    countdownActive: false,
    countdownDurationMs: 0,
    countdownEndsAt: 0,
    countdownRemainingMs: 0,
    overlayDimFrom: 0.5,
    overlayDimTo: 0,
    overlayDimDurationMs: 0,
    overlayDimStartedAt: 0,
  },
  crimeDetail: {
    active: false,
    scenarioId: null,
    variantId: null,
    repeatMode: 'single', // 'single' | 'multi' | 'infinite'
    repeatCount: 2,
    stopPolicy: 'stopOnFail', // 'stopOnFail' | 'retryRegardless'
    selectedSlotIndex: 0, // Which crew slot is selected (for multi-crew crimes)
    crewSlots: [], // Array of { variants: [], selectedIndex: 0 } for each slot
  },
  runDetailModal: {
    active: false,
    runId: null,
    scroll: 0,
  },
  awayScreen: {
    active: false,
    selectedIndex: 0,
    detailMode: false,
    scroll: 0,
  },
  tabBarFocus: false,
  tabBarIndex: 0,
};

// Tab bar navigation order
const TAB_ORDER = [
  { id: 'jobs',      tab: 'jobs', panelFocus: 'left' },
  { id: 'active',    tab: 'jobs', panelFocus: 'right' },
  { id: 'crew',      tab: 'crew' },
  { id: 'resources', tab: 'resources' },
  { id: 'stats',     tab: 'stats' },
  { id: 'log',       tab: 'log' },
  { id: 'options',   tab: 'options' },
];

function enterTabFromBar() {
  const entry = TAB_ORDER[ui.tabBarIndex];
  ui.tab = entry.tab;
  if (entry.panelFocus) ui.panelFocus = entry.panelFocus;
  if (entry.tab === 'jobs' && entry.panelFocus === 'left') ui.focus = 'scenario';
  ui.tabBarFocus = false;
}

function focusTabBar() {
  ui.tabBarFocus = true;
  // Sync tabBarIndex to current tab
  const idx = TAB_ORDER.findIndex(t =>
    t.tab === ui.tab && (!t.panelFocus || t.panelFocus === ui.panelFocus)
  );
  if (idx >= 0) ui.tabBarIndex = idx;
}

// Create UI layer
const uiLayer = new UI(buffer, engine, ui);

const LOOP_MS_IDLE = 250;
const LOOP_MS_HIDDEN = 1000;
const MODAL_COUNTDOWN_MS = 3000;
const MODAL_DIM_FROM = 0.5;
const MODAL_DIM_TO = 0;
const MODAL_DIM_FADE_MS = 5000;
const STARTUP_MODAL_IDS = ['onboardingIntroductionModal', 'legallyBound'];

let loopTimeoutId = null;
let loopStarted = false;
const bootInput = {
  active: false,
  delQueued: false,
  biosArmed: false,
};

function isDeleteKey(event) {
  const key = event?.key;
  return key === 'Delete' || key === 'Del' || event?.keyCode === 46;
}

// Input handling
document.addEventListener('keydown', handleInput);
window.addEventListener('beforeunload', () => {
  stopLoop();
  saveSettings(ui.settings);
});

document.addEventListener('visibilitychange', () => {
  scheduleLoop(0);
});

function hasActiveRuns() {
  const runs = engine.state?.runs;
  if (!runs || runs.length === 0) return false;
  for (let i = 0; i < runs.length; i++) {
    if (runs[i]?.status === 'active') return true;
  }
  return false;
}

function getLoopDelay() {
  if (document.hidden) return LOOP_MS_HIDDEN;

  let baseDelay = LOOP_MS_IDLE;
  if (hasActiveRuns()) {
    const fps = ui.settings.fps || 60;
    baseDelay = FPS_TO_MS[fps] || 16; // Default to 60fps (16ms) if invalid
  }

  // Smooth modal overlay dim fades even when the game would otherwise idle.
  if (ui.modal.active && ui.modal.overlay === 'dim50') {
    const startedAt = ui.modal.overlayDimStartedAt || 0;
    const durationMs = ui.modal.overlayDimDurationMs || 0;
    if (durationMs > 0 && startedAt > 0 && Date.now() - startedAt < durationMs) {
      return Math.min(baseDelay, 33);
    }
  }

  return baseDelay;
}

function startLoop() {
  loopStarted = true;
  scheduleLoop(0);
}

function stopLoop() {
  loopStarted = false;
  if (loopTimeoutId !== null) {
    clearTimeout(loopTimeoutId);
    loopTimeoutId = null;
  }
}

function scheduleLoop(delayOverride = null) {
  if (!loopStarted) return;
  if (loopTimeoutId !== null) clearTimeout(loopTimeoutId);
  const delay = delayOverride ?? getLoopDelay();
  loopTimeoutId = setTimeout(loopStep, delay);
}

function loopStep() {
  engine.tick();
  updateModalCountdown();
  // Skip game rendering while DOS prompt, BIOS, or away screen is active
  if (!document.hidden && !ui.dosPrompt && !ui.biosSetup && !ui.awayScreen.active) render();
  scheduleLoop();
}

function enqueueStartupModals() {
  if (ui.settings.showIntro) {
    modalQueue.enqueue('intro', true);
  }
  STARTUP_MODAL_IDS.forEach((modalId) => modalQueue.enqueue(modalId));
}

function showNextQueuedModal() {
  if (!modalQueue.hasNext()) return;
  const nextId = modalQueue.dequeue();
  showModal(nextId);
}

function showStartupSequence() {
  if (!ui.settings.showIntro && engine.awayReport && engine.awayReport.awayRuns.length > 0) {
    activateAwayScreen();
  } else {
    showNextQueuedModal();
  }
}

function activateAwayScreen() {
  ui.awayScreen.active = true;
  ui.awayScreen.selectedIndex = 0;
  ui.awayScreen.detailMode = false;
  ui.awayScreen.scroll = 0;
  render();
}

function dismissAwayScreen() {
  ui.awayScreen.active = false;
  engine.awayReport = null;
  showNextQueuedModal();
}

function handleAwayInput(e) {
  const report = engine.awayReport;
  if (!report) return;

  const runs = report.awayRuns;

  if (ui.awayScreen.detailMode) {
    if (e.key === 'Escape' || e.key === 'Backspace') {
      ui.awayScreen.detailMode = false;
      ui.awayScreen.scroll = 0;
    } else if (e.key === 'PageDown') {
      ui.awayScreen.scroll += 5;
    } else if (e.key === 'PageUp') {
      ui.awayScreen.scroll = Math.max(0, ui.awayScreen.scroll - 5);
    }
    render();
    return;
  }

  if (e.key === 'ArrowUp') {
    ui.awayScreen.selectedIndex = Math.max(0, ui.awayScreen.selectedIndex - 1);
  } else if (e.key === 'ArrowDown') {
    ui.awayScreen.selectedIndex = Math.min(runs.length - 1, ui.awayScreen.selectedIndex + 1);
  } else if (e.key === 'Enter' && runs.length > 0) {
    ui.awayScreen.detailMode = true;
    ui.awayScreen.scroll = 0;
  } else if (e.key.toLowerCase() === 'z' || e.key === 'Escape') {
    dismissAwayScreen();
  }
  render();
}

function updateModalCountdown() {
  if (!ui.modal.active || !ui.modal.countdownActive) return;

  const remainingMs = Math.max(0, ui.modal.countdownEndsAt - Date.now());
  ui.modal.countdownRemainingMs = remainingMs;
  if (remainingMs === 0) {
    ui.modal.countdownActive = false;
    ui.modal.countdownDurationMs = 0;
    ui.modal.countdownEndsAt = 0;
  }
}

function renderFrame(allowBloom = true) {
  renderer.render();

  if (!bloomLayer || !bloomRenderer) return;
  const shouldBloom = allowBloom && !!ui.settings.bloom;
  bloomLayer.style.display = shouldBloom ? 'block' : 'none';
  if (shouldBloom) bloomRenderer.render();
}

function enterDosPrompt() {
  bootInput.active = false;
  bootInput.delQueued = false;
  bootInput.biosArmed = false;
  stopLoop();
  // Hide bloom during DOS
  if (bloomLayer) bloomLayer.style.display = 'none';
  const dos = new DosPrompt(buffer, {
    engine,
    onRender: () => renderFrame(false),
    onSystemPowerOff: () => {
      sessionStorage.setItem('ccv_force_slow_boot', '1');
      sessionStorage.setItem('ccv_force_dos_boot', '1');
    },
    onSystemReboot: () => { performRestart({ forceSlowBoot: true, forceDosBoot: true }); },
  });
  dos.start();
  ui.dosPrompt = dos;
  renderFrame(false);
}

// Main entry point
async function main() {
  bootInput.active = true;
  bootInput.delQueued = false;
  bootInput.biosArmed = false;

  const url = new URL(window.location.href);
  const oneShotAuthenticBoot = url.searchParams.has('ab');
  if (oneShotAuthenticBoot) {
    // Consume ?ab so the override applies only to this boot cycle.
    url.searchParams.delete('ab');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', nextUrl);
  }

  const authentic = !!ui.settings.authenticBoot;
  const forceSlowBoot = sessionStorage.getItem('ccv_force_slow_boot');
  sessionStorage.removeItem('ccv_force_slow_boot');
  const forceDosBoot = sessionStorage.getItem('ccv_force_dos_boot');
  sessionStorage.removeItem('ccv_force_dos_boot');

  const firstBoot = !localStorage.getItem('ccv_has_booted');
  const slowBoot = authentic || firstBoot || !!forceSlowBoot || oneShotAuthenticBoot;
  const shouldBootToDos = authentic || !!forceDosBoot || oneShotAuthenticBoot;
  // BIOS entry is intentionally hidden behind DOS shutdown/reboot flow, authentic boot mode, or one-shot ?ab.
  bootInput.biosArmed = authentic || !!forceSlowBoot || !!forceDosBoot || oneShotAuthenticBoot;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  // Squared random biases toward short pauses with occasional longer ones
  const bootDelay = () => delay(50 + Math.random() * Math.random() * 800);
  const shouldEnterBios = () => bootInput.biosArmed && bootInput.delQueued;

  // Apply saved zoom for boot screen (font stays as ibm-bios from HTML)
  const container = document.getElementById('game');
  if (container) {
    const zoom = ui.settings.zoom || 150;
    container.style.fontSize = `${zoom}%`;
  }

  // Boot screen - 286 POST style loading progress
  const boot = new BootScreen(buffer);
  boot.drawHeader(slowBoot);
  renderFrame(false);
  if (shouldEnterBios()) {
    enterBiosSetup();
    return;
  }

  // Animate RAM counting on slow boot
  if (slowBoot) {
    await boot.countRAM(() => renderFrame(false));
    if (shouldEnterBios()) {
      enterBiosSetup();
      return;
    }
  }

  // Load engine data with per-file progress (+ artificial delays on slow boot)
  await engine.init(async (label) => {
    boot.addProgress(label);
    renderFrame(false);
    if (slowBoot) await bootDelay();
  });
  if (shouldEnterBios()) {
    enterBiosSetup();
    return;
  }

  // Load modal definitions
  await loadModalData();
  boot.addProgress('MODALS.DAT');
  renderFrame(false);
  if (slowBoot) await bootDelay();
  if (shouldEnterBios()) {
    enterBiosSetup();
    return;
  }

  // Initialize crew name generation
  await initCrewSystem();
  boot.addProgress('CREW SUBSYSTEM');
  renderFrame(false);
  if (slowBoot) await bootDelay();
  if (shouldEnterBios()) {
    enterBiosSetup();
    return;
  }

  // Boot complete
  boot.drawComplete();
  if (bootInput.biosArmed) {
    boot.drawSetupPrompt();
  }
  renderFrame(false);

  // Mark first boot as seen
  localStorage.setItem('ccv_has_booted', '1');
  if (shouldEnterBios()) {
    enterBiosSetup();
    return;
  }

  if (shouldBootToDos) {
    await delay(800);
    enterDosPrompt();
    return;
  } else {
    bootInput.active = false;
    bootInput.delQueued = false;
    bootInput.biosArmed = false;
    // Straight to game
    applyFont(ui.settings);
    saveSettings(ui.settings);
    // Rebuild grid once web fonts confirm loaded (fixes 1ch on hard refresh)
    document.fonts.ready.then(() => { renderer.buildGrid(); render(); });
    buffer.clear();
    render();
    enqueueStartupModals();
    showStartupSequence();
  }

  startLoop();
}

// Transition from DOS prompt to game
function exitDosPrompt() {
  ui.dosPrompt = null;
  modalQueue.refreshForActiveSlot?.();
  applyFont(ui.settings);
  saveSettings(ui.settings);
  document.fonts.ready.then(() => { renderer.buildGrid(); render(); });
  buffer.clear();
  render();
  enqueueStartupModals();
  showStartupSequence();
  startLoop();
}

// Enter BIOS setup screen
function enterBiosSetup() {
  bootInput.active = false;
  bootInput.delQueued = false;
  bootInput.biosArmed = false;
  stopLoop();
  // Hide bloom during BIOS
  if (bloomLayer) bloomLayer.style.display = 'none';
  const bios = new BiosSetup(buffer, {
    settings: { ...ui.settings }, // Clone current settings
    onRender: () => renderFrame(false),
  });
  bios.start();
  ui.biosSetup = bios;
  renderFrame(false);
}

// Exit BIOS setup screen
function exitBiosSetup(shouldSave, settings) {
  ui.biosSetup = null;

  if (shouldSave) {
    // Apply new settings
    ui.settings = settings;
    saveSettings(settings);
  }

  // Decide where to go based on authenticBoot setting
  const authentic = settings.authenticBoot;
  if (authentic) {
    enterDosPrompt();
  } else {
    // Go straight to game
    applyFont(ui.settings);
    document.fonts.ready.then(() => { renderer.buildGrid(); render(); });
    buffer.clear();
    render();
    enqueueStartupModals();
    showStartupSequence();
    startLoop();
  }
}

// Perform system restart
async function performRestart(options = {}) {
  const forceSlowBoot = !!options.forceSlowBoot;
  const forceDosBoot = !!options.forceDosBoot;

  if (forceSlowBoot) sessionStorage.setItem('ccv_force_slow_boot', '1');
  if (forceDosBoot) sessionStorage.setItem('ccv_force_dos_boot', '1');

  // Stop game loop
  stopLoop();

  // Clear UI state
  ui.dosPrompt = null;
  ui.biosSetup = null;
  ui.modal.active = false;
  ui.crimeDetail.active = false;

  // Re-run main() with one-time boot flags
  await main();
}

// Input handling by tab
function handleInput(e) {
  // BIOS Setup has highest priority
  if (ui.biosSetup) {
    e.preventDefault();
    const result = ui.biosSetup.handleKey(e.key);
    renderFrame(false);
    if (result === 'save') {
      // Gather settings from BIOS and save
      exitBiosSetup(true, ui.biosSetup.settings);
    } else if (result === 'discard') {
      // Discard changes
      exitBiosSetup(false, ui.settings);
    }
    return;
  }

  // During boot screen, ignore all game input except DEL for BIOS queue.
  if (bootInput.active) {
    if (bootInput.biosArmed && isDeleteKey(e)) {
      bootInput.delQueued = true;
    }
    // Keep browser refresh available while blocking game input.
    if (e.key !== 'F5') {
      e.preventDefault();
    }
    return;
  }

  // Away screen
  if (ui.awayScreen.active) {
    e.preventDefault();
    handleAwayInput(e);
    return;
  }

  // DOS prompt takes priority over everything else
  if (ui.dosPrompt) {
    if (e.key === 'F5') return;
    e.preventDefault();
    const result = ui.dosPrompt.handleKey(e.key);
    renderFrame(false);
    if (result === 'launch') {
      exitDosPrompt();
    }
    return;
  }

  // Modal takes priority over all other input
  if (ui.modal.active) {
    handleModalInput(e);
    return;
  }

  // Run detail modal takes priority over tab input
  if (ui.runDetailModal.active) {
    handleRunDetailModalInput(e);
    return;
  }

  // Tab bar navigation (when focused)
  if (ui.tabBarFocus) {
    if (e.key === 'ArrowLeft') {
      ui.tabBarIndex = Math.max(0, ui.tabBarIndex - 1);
    } else if (e.key === 'ArrowRight') {
      ui.tabBarIndex = Math.min(TAB_ORDER.length - 1, ui.tabBarIndex + 1);
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      enterTabFromBar();
    } else if (e.key === 'Escape') {
      ui.tabBarFocus = false;
    }
    render();
    return;
  }

  // Tab switching (J, A, C, R, S, L, O)
  // J focuses left panel (jobs browser), A focuses right panel (active runs)
  if (e.key === 'j' || e.key === 'J') {
    ui.tab = 'jobs';
    ui.panelFocus = 'left';
    ui.focus = 'scenario';
    ui.variantIndex = 0;
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }
  if (e.key === 'a' || e.key === 'A') {
    ui.tab = 'jobs';
    ui.panelFocus = 'right';
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }
  // C switches to crew tab, unless right panel focused (C = clear there)
  if ((e.key === 'c' || e.key === 'C') && ui.panelFocus !== 'right') {
    ui.tab = 'crew';
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }
  // R switches to resources tab, unless right panel focused (R = cancel repeat there)
  if ((e.key === 'r' || e.key === 'R') && !(ui.tab === 'jobs' && ui.panelFocus === 'right')) {
    ui.tab = 'resources';
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }
  if (e.key === 's' || e.key === 'S') {
    ui.tab = 'stats';
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }
  if (e.key === 'l' || e.key === 'L') {
    ui.tab = 'log';
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }
  if (e.key === 'o' || e.key === 'O') {
    ui.tab = 'options';
    ui.tabBarFocus = false;
    closeCrimeDetail();
  }

  // Tab-specific input
  if (ui.tab === 'jobs') handleJobsInput(e);
  if (ui.tab === 'crew') handleCrewInput(e);
  if (ui.tab === 'resources') handleResourcesInput(e);
  if (ui.tab === 'stats') handleStatsInput(e);
  if (ui.tab === 'log') handleLogInput(e);
  if (ui.tab === 'options') handleOptionsInput(e);

  if (ui.dosPrompt) return;
  render();
}

function handleJobsInput(e) {
  // Crime detail window takes priority
  if (ui.crimeDetail.active) {
    handleCrimeDetailInput(e);
    return;
  }

  const key = (e.key || '').toLowerCase();

  // ── RIGHT PANEL (active runs) ──
  if (ui.panelFocus === 'right') {
    const filteredRuns = uiLayer.getFilteredRuns().sort(sortRunsActiveFirst);

    // LEFT or ESC switches back to left panel
    if (e.key === 'Escape' || e.key === 'Backspace') {
      ui.panelFocus = 'left';
      return;
    }

    // F toggles filter mode
    if (key === 'f') {
      ui.runsFilterMode = ui.runsFilterMode === 'matching' ? 'all' : 'matching';
      ui.selectedRun = 0;
      return;
    }

    if (filteredRuns.length === 0) {
      ui.selectedRun = 0;
      if (e.key === 'ArrowUp') { focusTabBar(); return; }
      return;
    }

    ui.selectedRun = Math.max(0, Math.min(ui.selectedRun, filteredRuns.length - 1));
    const selectedRun = filteredRuns[ui.selectedRun];
    const isCompleted = selectedRun?.status === 'completed';

    // UP/DOWN navigate runs
    if (e.key === 'ArrowUp') {
      if (ui.selectedRun === 0) { focusTabBar(); return; }
      ui.selectedRun = Math.max(0, ui.selectedRun - 1);
    }
    if (e.key === 'ArrowDown') ui.selectedRun = Math.min(filteredRuns.length - 1, ui.selectedRun + 1);

    // ENTER opens run detail modal
    if (e.key === 'Enter' && selectedRun) {
      ui.runDetailModal.active = true;
      ui.runDetailModal.runId = selectedRun.runId;
      ui.runDetailModal.scroll = 0;
    }

    // X clears selected completed run
    if (key === 'x' && selectedRun && isCompleted) {
      engine.clearCompletedRun(selectedRun.runId);
      if (ui.selectedRun >= filteredRuns.length - 1) {
        ui.selectedRun = Math.max(0, filteredRuns.length - 2);
      }
    }

    // Z clears ALL completed runs
    if (key === 'z') engine.clearAllCompletedRuns();

    // Y stops active run
    if (key === 'y' && selectedRun && !isCompleted) engine.stopRun(selectedRun.runId);

    // R cancels future runs
    if (key === 'r' && selectedRun && !isCompleted && selectedRun.runsLeft !== 0) {
      engine.stopRepeat(selectedRun.runId);
    }

    return;
  }

  // ── LEFT PANEL (jobs browser) ──
  const branches = uiLayer.getVisibleBranches();
  const branch = branches[ui.branchIndex] || branches[0];
  const scenarios = uiLayer.getVisibleScenarios(branch?.id);
  const scenario = scenarios[ui.scenarioIndex];
  const variants = scenario ? uiLayer.getVisibleVariants(scenario) : [];

  // Number keys for selection
  if (e.key >= '1' && e.key <= '9') {
    const num = parseInt(e.key);
    if (ui.focus === 'scenario') {
      if (num - 1 < scenarios.length) {
        ui.scenarioIndex = num - 1;
        ui.focus = 'variant';
        ui.variantIndex = 0;
      }
    } else if (ui.focus === 'variant') {
      if (num - 1 < variants.length) {
        ui.variantIndex = num - 1;
      }
    }
  }

  // Backspace/Escape to go back
  if (e.key === 'Backspace' || e.key === 'Escape') {
    if (ui.focus === 'branch') {
      ui.focus = 'scenario';
    } else if (ui.focus === 'variant') {
      ui.focus = 'scenario';
      ui.variantIndex = 0;
    }
  }

  // F toggles filter mode (works from either panel)
  if (key === 'f') {
    ui.runsFilterMode = ui.runsFilterMode === 'matching' ? 'all' : 'matching';
  }

  if (ui.focus === 'branch') {
    if (e.key === 'ArrowUp') {
      focusTabBar();
      return;
    }
    if (e.key === 'ArrowLeft') {
      ui.branchIndex = Math.max(0, ui.branchIndex - 1);
      ui.scenarioIndex = 0;
      ui.variantIndex = 0;
    }
    if (e.key === 'ArrowRight') {
      ui.branchIndex = Math.min(branches.length - 1, ui.branchIndex + 1);
      ui.scenarioIndex = 0;
      ui.variantIndex = 0;
    }
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      ui.focus = 'scenario';
    }
  } else if (ui.focus === 'scenario') {
    if (e.key === 'ArrowUp') {
      if (ui.scenarioIndex === 0) {
        ui.focus = 'branch';
      } else {
        ui.scenarioIndex = Math.max(0, ui.scenarioIndex - 1);
      }
    }
    if (e.key === 'ArrowDown') ui.scenarioIndex = Math.min(Math.max(0, scenarios.length - 1), ui.scenarioIndex + 1);

    if (e.key === 'ArrowRight' && scenario) {
      ui.focus = 'variant';
      ui.variantIndex = Math.max(0, Math.min(ui.variantIndex, Math.max(0, variants.length - 1)));
    }

    if (e.key === 'Enter' && scenario) {
      ui.focus = 'variant';
      ui.variantIndex = 0;
    }

    if (key === 'q' && scenario && variants.length > 0) {
      startSelectedRun(scenario, variants[0]);
    }
  } else if (ui.focus === 'variant') {
    if (e.key === 'ArrowLeft') {
      ui.focus = 'scenario';
      ui.variantIndex = 0;
    }

    if (e.key === 'ArrowUp') ui.variantIndex = Math.max(0, ui.variantIndex - 1);
    if (e.key === 'ArrowDown') ui.variantIndex = Math.min(Math.max(0, variants.length - 1), ui.variantIndex + 1);

    if (key === 'd') {
      const selectedVariant = variants[ui.variantIndex];
      if (selectedVariant) openCrimeDetail(scenario, selectedVariant);
    }

    if (key === 'q') {
      const selectedVariant = variants[ui.variantIndex];
      if (selectedVariant) {
        startSelectedRun(scenario, selectedVariant);
      } else {
        engine.log('No variant available to quick start', 'warning');
      }
    }

  }
}

// Open crime detail window
function openCrimeDetail(scenario, variant) {
  ui.crimeDetail.active = true;
  ui.crimeDetail.scenarioId = scenario.id;
  ui.crimeDetail.variantId = variant.id;
  // Reset to defaults
  ui.crimeDetail.repeatMode = 'single';
  ui.crimeDetail.repeatCount = 2;
  ui.crimeDetail.stopPolicy = 'stopOnFail';
  ui.crimeDetail.selectedSlotIndex = 0;

  // Build crew slots based on requirements
  const staffReqs = variant.requirements?.staff || [];
  ui.crimeDetail.crewSlots = staffReqs.map(req => {
    // Get all available crew matching this role
    const available = engine.state.crew.staff.filter(
      s => s.roleId === req.roleId && s.status === 'available'
    );

    return {
      roleId: req.roleId,
      count: req.count,
      variants: available,
      selectedIndex: 0
    };
  });
}

// Handle run detail modal input
function handleRunDetailModalInput(e) {
  const modal = ui.runDetailModal;
  const key = (e.key || '').toLowerCase();

  if (e.key === 'Escape' || e.key === 'Backspace') {
    modal.active = false;
    render();
    return;
  }

  const run = engine.state.runs.find(r => r.runId === modal.runId);
  if (!run) {
    modal.active = false;
    render();
    return;
  }

  const isCompleted = run.status === 'completed';

  // Scroll results
  if (e.key === 'ArrowDown' || e.key === 'PageDown') {
    modal.scroll = Math.min(modal.scroll + (e.key === 'PageDown' ? 5 : 1), Math.max(0, (run.results || []).length - 5));
  }
  if (e.key === 'ArrowUp' || e.key === 'PageUp') {
    modal.scroll = Math.max(0, modal.scroll - (e.key === 'PageUp' ? 5 : 1));
  }

  // X clears completed run
  if (key === 'x' && isCompleted) {
    engine.clearCompletedRun(run.runId);
    modal.active = false;
  }

  // Z clears all completed runs
  if (key === 'z') {
    engine.clearAllCompletedRuns();
    // Close modal if this run was cleared
    if (!engine.state.runs.find(r => r.runId === modal.runId)) {
      modal.active = false;
    }
  }

  // Y stops active run
  if (key === 'y' && !isCompleted) {
    engine.stopRun(run.runId);
  }

  // R cancels future runs
  if (key === 'r' && !isCompleted && run.runsLeft !== 0) {
    engine.stopRepeat(run.runId);
  }

  render();
}

// Close crime detail window
function closeCrimeDetail() {
  ui.crimeDetail.active = false;
  ui.crimeDetail.scenarioId = null;
  ui.crimeDetail.variantId = null;
}

// Handle input for crime detail window
function handleCrimeDetailInput(e) {
  const key = (e.key || '').toLowerCase();
  const scenario = engine.data.scenarios.find(s => s.id === ui.crimeDetail.scenarioId);
  const variant = scenario?.variants.find(v => v.id === ui.crimeDetail.variantId);

  if (!scenario || !variant) {
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
    startRunFromDetail(scenario, variant, 'single');
    closeCrimeDetail();
    return;
  }

  // I key cycles through iterate modes (only if repeatable)
  if (key === 'i') {
    if (variant.repeatable) {
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

  // LEFT/RIGHT cycle through crew variants for selected slot
  if (slots.length > 0) {
    const currentSlot = slots[ui.crimeDetail.selectedSlotIndex];
    if (currentSlot && currentSlot.variants.length > 0) {
      if (e.key === 'ArrowLeft') {
        currentSlot.selectedIndex = Math.max(0, currentSlot.selectedIndex - 1);
      }
      if (e.key === 'ArrowRight') {
        currentSlot.selectedIndex = Math.min(currentSlot.variants.length - 1, currentSlot.selectedIndex + 1);
      }
    }
  }

  // ENTER to start with configured settings
  if (e.key === 'Enter') {
    startRunFromDetail(scenario, variant, ui.crimeDetail.repeatMode);
    closeCrimeDetail();
  }
}

// Start run using crime detail settings
function startRunFromDetail(scenario, variant, repeatMode) {
  const mode = repeatMode || ui.crimeDetail.repeatMode;
  let runsLeft = 0;

  if (variant.repeatable) {
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
      const selectedStaff = slot.variants[slot.selectedIndex];
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

  const result = engine.startRun(scenario.id, variant.id, staffIds, runsLeft);
  if (!result.ok) {
    engine.log(`Start failed: ${result.reason}`, 'error');
  }
}



function handleResourcesInput(e) {
  // Get visible resources list (same logic as renderResourcesTab)
  const visibleResources = engine.data.resources.filter(res => {
    const revealed = engine.state.reveals.resources[res.id];
    const amount = engine.state.resources[res.id] || 0;
    return revealed || amount > 0;
  });

  const totalResources = visibleResources.length;
  if (totalResources === 0) {
    if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
    return;
  }

  // Layout calculations (must match renderResourcesTab)
  const top = 4;
  const listTop = top + 1;
  const listBottom = Layout.HEIGHT - 5;
  const visibleRows = Math.max(0, listBottom - listTop);
  const pageStep = Math.max(1, visibleRows - 1);

  // Clamp selection index to valid range
  if (ui.resourceSelection.selectedIndex >= totalResources) {
    ui.resourceSelection.selectedIndex = Math.max(0, totalResources - 1);
  }

  // Arrow up/down moves selection one at a time
  if (e.key === 'ArrowUp') {
    if (ui.resourceSelection.selectedIndex === 0) { focusTabBar(); return; }
    ui.resourceSelection.selectedIndex = Math.max(0, ui.resourceSelection.selectedIndex - 1);
    updateResourcesScroll(ui.resourceSelection.selectedIndex, visibleRows, totalResources);
  }
  if (e.key === 'ArrowDown') {
    ui.resourceSelection.selectedIndex = Math.min(totalResources - 1, ui.resourceSelection.selectedIndex + 1);
    updateResourcesScroll(ui.resourceSelection.selectedIndex, visibleRows, totalResources);
  }

  // Page up/down for faster navigation
  if (e.key === 'PageUp') {
    ui.resourceSelection.selectedIndex = Math.max(0, ui.resourceSelection.selectedIndex - pageStep);
    updateResourcesScroll(ui.resourceSelection.selectedIndex, visibleRows, totalResources);
  }
  if (e.key === 'PageDown') {
    ui.resourceSelection.selectedIndex = Math.min(totalResources - 1, ui.resourceSelection.selectedIndex + pageStep);
    updateResourcesScroll(ui.resourceSelection.selectedIndex, visibleRows, totalResources);
  }

  // Home/End to jump to start/end
  if (e.key === 'Home') {
    ui.resourceSelection.selectedIndex = 0;
    updateResourcesScroll(ui.resourceSelection.selectedIndex, visibleRows, totalResources);
  }
  if (e.key === 'End') {
    ui.resourceSelection.selectedIndex = Math.max(0, totalResources - 1);
    updateResourcesScroll(ui.resourceSelection.selectedIndex, visibleRows, totalResources);
  }

  // 'I' or Enter to open resource modal (if available)
  const key = (e.key || '').toLowerCase();
  if (key === 'i' || e.key === 'Enter') {
    const selectedResource = visibleResources[ui.resourceSelection.selectedIndex];
    if (selectedResource && selectedResource.modalId) {
      showModal(selectedResource.modalId);
    }
  }

  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

// Smart scroll helper for resources - keeps selection in "comfort zone" (5 rows from edges)
function updateResourcesScroll(selectedIndex, visibleRows, totalResources) {
  const COMFORT_ZONE = 5;
  const maxOffset = Math.max(0, totalResources - visibleRows);
  let scrollOffset = ui.scroll?.resources || 0;

  // If selection is too close to top, scroll up
  if (selectedIndex < scrollOffset + COMFORT_ZONE) {
    scrollOffset = Math.max(0, selectedIndex - COMFORT_ZONE);
  }

  // If selection is too close to bottom, scroll down
  if (selectedIndex >= scrollOffset + visibleRows - COMFORT_ZONE) {
    scrollOffset = Math.min(maxOffset, selectedIndex - visibleRows + COMFORT_ZONE + 1);
  }

  if (!ui.scroll) ui.scroll = {};
  ui.scroll.resources = scrollOffset;
}

function handleStatsInput(e) {
  const STAT_COUNT = 6;  // cash, heat, cred, crewCount, activeRuns, successRate
  const PERIOD_COUNT = 6;  // second, minute, fiveMin, hour, day, month

  // Arrow Up/Down: Navigate stat selection
  if (e.key === 'ArrowUp') {
    if (ui.statsSelection.selectedStat === 0) { focusTabBar(); return; }
    ui.statsSelection.selectedStat = Math.max(0, ui.statsSelection.selectedStat - 1);
  }
  if (e.key === 'ArrowDown') {
    ui.statsSelection.selectedStat = Math.min(STAT_COUNT - 1, ui.statsSelection.selectedStat + 1);
  }

  // Arrow Left/Right: Change time period
  if (e.key === 'ArrowLeft') {
    ui.statsSelection.selectedPeriod = Math.max(0, ui.statsSelection.selectedPeriod - 1);
  }
  if (e.key === 'ArrowRight') {
    ui.statsSelection.selectedPeriod = Math.min(PERIOD_COUNT - 1, ui.statsSelection.selectedPeriod + 1);
  }

  // L key: Toggle logarithmic scale
  if (e.key === 'l' || e.key === 'L') {
    ui.statsSelection.logScale = !ui.statsSelection.logScale;
  }

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
  if (e.key === 'ArrowUp') {
    if ((ui.scroll?.log || 0) === 0) { focusTabBar(); return; }
    setLogScroll((ui.scroll?.log || 0) - 1);
  }
  if (e.key === 'PageDown') setLogScroll((ui.scroll?.log || 0) + pageStep);
  if (e.key === 'PageUp') setLogScroll((ui.scroll?.log || 0) - pageStep);
  if (e.key === 'End') setLogScroll(maxOffset);
  if (e.key === 'Home') setLogScroll(0);

  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}


// Smart scroll helper - keeps selection in "comfort zone" (5 rows from edges)
function updateCrewScroll(selectedIndex, visibleRows, totalCrew) {
  const COMFORT_ZONE = 5;
  const maxOffset = Math.max(0, totalCrew - visibleRows);
  let scrollOffset = ui.scroll?.crew || 0;

  // If selection is too close to top, scroll up
  if (selectedIndex < scrollOffset + COMFORT_ZONE) {
    scrollOffset = Math.max(0, selectedIndex - COMFORT_ZONE);
  }

  // If selection is too close to bottom, scroll down
  if (selectedIndex >= scrollOffset + visibleRows - COMFORT_ZONE) {
    scrollOffset = Math.min(maxOffset, selectedIndex - visibleRows + COMFORT_ZONE + 1);
  }

  if (!ui.scroll) ui.scroll = {};
  ui.scroll.crew = scrollOffset;
}

function handleCrewInput(e) {
  const totalCrew = engine.state.crew.staff.length;

  // If in detail view, delegate to detail handler
  if (ui.crewSelection.detailView) {
    handleCrewDetailInput(e);
    return;
  }

  // Layout calculations for smart scroll
  const rosterTop = 4 + 5; // top offset + header spacing
  const rosterBottom = Layout.HEIGHT - 3;
  const visibleRows = Math.max(0, rosterBottom - rosterTop + 1);
  const pageStep = Math.max(1, visibleRows - 1);

  // Clamp selection index to valid range
  if (ui.crewSelection.selectedIndex >= totalCrew) {
    ui.crewSelection.selectedIndex = Math.max(0, totalCrew - 1);
  }

  // Arrow up/down moves selection one at a time
  if (e.key === 'ArrowUp') {
    if (ui.crewSelection.selectedIndex === 0) { focusTabBar(); return; }
    ui.crewSelection.selectedIndex = Math.max(0, ui.crewSelection.selectedIndex - 1);
    updateCrewScroll(ui.crewSelection.selectedIndex, visibleRows, totalCrew);
  }
  if (e.key === 'ArrowDown') {
    ui.crewSelection.selectedIndex = Math.min(totalCrew - 1, ui.crewSelection.selectedIndex + 1);
    updateCrewScroll(ui.crewSelection.selectedIndex, visibleRows, totalCrew);
  }

  // Page up/down for faster navigation
  if (e.key === 'PageUp') {
    ui.crewSelection.selectedIndex = Math.max(0, ui.crewSelection.selectedIndex - pageStep);
    updateCrewScroll(ui.crewSelection.selectedIndex, visibleRows, totalCrew);
  }
  if (e.key === 'PageDown') {
    ui.crewSelection.selectedIndex = Math.min(totalCrew - 1, ui.crewSelection.selectedIndex + pageStep);
    updateCrewScroll(ui.crewSelection.selectedIndex, visibleRows, totalCrew);
  }

  // Home/End to jump to start/end
  if (e.key === 'Home') {
    ui.crewSelection.selectedIndex = 0;
    updateCrewScroll(ui.crewSelection.selectedIndex, visibleRows, totalCrew);
  }
  if (e.key === 'End') {
    ui.crewSelection.selectedIndex = Math.max(0, totalCrew - 1);
    updateCrewScroll(ui.crewSelection.selectedIndex, visibleRows, totalCrew);
  }

  // Enter to view crew member details
  if (e.key === 'Enter' && totalCrew > 0) {
    ui.crewSelection.detailView = true;
    ui.crewSelection.perkChoiceIndex = 0;
  }

  // Space to add test crew member
  if (e.key === ' ') {
    const usedNames = getUsedCrewNames(engine.state.crew.staff);
    const testMember = {
      id: `test_${Date.now()}`,
      name: generateUniqueCrewName(usedNames, ui.settings?.funnyNames),
      roleId: 'player',
      status: 'available',
      xp: 0,
      perks: [],
      perkChoices: {},
      unchosen: [],
      pendingPerkChoice: null
    };
    engine.state.crew.staff.push(testMember);
    engine.log('Added test crew member', 'info');
    engine.saveState();
  }

  // U key for auto-upgrade all pending
  if (e.key === 'u' || e.key === 'U') {
    engine.autoUpgradeAll();
  }

  if (e.key === 'Escape' || e.key === 'Backspace') ui.tab = 'jobs';
}

// Handle input when viewing crew member detail
function handleCrewDetailInput(e) {
  const member = engine.state.crew.staff[ui.crewSelection.selectedIndex];
  if (!member) {
    ui.crewSelection.detailView = false;
    return;
  }

  // Escape/Backspace returns to list
  if (e.key === 'Escape' || e.key === 'Backspace') {
    ui.crewSelection.detailView = false;
    return;
  }

  // If there's a pending perk choice, handle perk selection
  if (member.pendingPerkChoice) {
    const options = member.pendingPerkChoice.options || [];
    const maxIndex = options.length - 1;

    // Arrow keys to select between options
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      ui.crewSelection.perkChoiceIndex = Math.max(0, ui.crewSelection.perkChoiceIndex - 1);
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      ui.crewSelection.perkChoiceIndex = Math.min(maxIndex, ui.crewSelection.perkChoiceIndex + 1);
    }

    // Number keys for direct selection (1-9)
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= options.length) {
      ui.crewSelection.perkChoiceIndex = num - 1;
    }

    // Enter to confirm perk choice
    if (e.key === 'Enter') {
      const selectedPerk = options[ui.crewSelection.perkChoiceIndex];
      if (selectedPerk) {
        engine.choosePerk(member, selectedPerk);
        ui.crewSelection.perkChoiceIndex = 0;
      }
    }
  }
}

function handleOptionsInput(e) {
  // Check if we are in the font submenu
  if (ui.inFontSubMenu) {
    handleFontSubMenuInput(e);
    return;
  }

  // Initialize selectedSetting if not set
  if (ui.selectedSetting === undefined) ui.selectedSetting = 0;
  ui.selectedSetting = Math.max(0, Math.min(8, ui.selectedSetting));

  // Clear confirmation state when navigating away from reset option
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    ui.confirmReset = false;
  }

  // Arrow navigation for settings list (9 options: 0-8)
  if (e.key === 'ArrowUp') {
    if (ui.selectedSetting === 0) { focusTabBar(); return; }
    ui.selectedSetting = Math.max(0, ui.selectedSetting - 1);
  }
  if (e.key === 'ArrowDown') {
    ui.selectedSetting = Math.min(8, ui.selectedSetting + 1);
  }

  // Number key selection (1-9, with 0 aliasing reset)
  if (e.key >= '1' && e.key <= '9') {
    const newSetting = parseInt(e.key) - 1;
    if (newSetting > 8) return;
    if (newSetting !== ui.selectedSetting) ui.confirmReset = false;
    ui.selectedSetting = newSetting;
  }
  if (e.key === '0') {
    if (ui.selectedSetting !== 8) ui.confirmReset = false;
    ui.selectedSetting = 8;
  }

  // Enter/space to toggle or cycle
  // Options: 0=Font, 1=Bloom, 2=Funny names, 3=Show intro, 4=Skip tutorials, 5=Exit to DOS, 6=About, 7=Debug, 8=Reset
  if (e.key === 'Enter' || e.key === ' ') {
    if (ui.selectedSetting === 0) {
      ui.inFontSubMenu = true;
      ui.fontSubMenuIndex = 0;
    } else if (ui.selectedSetting === 1) {
      ui.settings.bloom = !ui.settings.bloom;
      applyBloom(ui.settings);
      saveSettings(ui.settings);
    } else if (ui.selectedSetting === 2) {
      ui.settings.funnyNames = !ui.settings.funnyNames;
      saveSettings(ui.settings);
    } else if (ui.selectedSetting === 3) {
      ui.settings.showIntro = !ui.settings.showIntro;
      saveSettings(ui.settings);
    } else if (ui.selectedSetting === 4) {
      ui.settings.skipTutorials = !ui.settings.skipTutorials;
      saveSettings(ui.settings);
    } else if (ui.selectedSetting === 5) {
      // Exit to DOS - switch to BIOS font, clear screen, drop to CLI
      applyFont({ ...ui.settings, font: 'ibm-bios' });
      enterDosPrompt();
    } else if (ui.selectedSetting === 6) {
      showModal('about');
    } else if (ui.selectedSetting === 7) {
      engine.state.debugMode = !engine.state.debugMode;
    } else if (ui.selectedSetting === 8) {
      // Reset progress with confirmation
      if (ui.confirmReset) {
        engine.resetProgress();
        ui.confirmReset = false;
        ui.tab = 'jobs';
      } else {
        ui.confirmReset = true;
      }
    }
  }

  // Escape cancels reset confirmation
  if (e.key === 'Escape') {
    ui.confirmReset = false;
  }
}

function handleFontSubMenuInput(e) {
  if (ui.fontSubMenuIndex === undefined) ui.fontSubMenuIndex = 0;

  // Exit submenu
  if (e.key === 'Escape' || e.key === 'Backspace') {
    ui.inFontSubMenu = false;
    return;
  }

  // Navigation (0-4)
  if (e.key === 'ArrowUp') {
    ui.fontSubMenuIndex = Math.max(0, ui.fontSubMenuIndex - 1);
  }
  if (e.key === 'ArrowDown') {
    ui.fontSubMenuIndex = Math.min(4, ui.fontSubMenuIndex + 1);
  }

  // 0: Generation (Toggle)
  if (ui.fontSubMenuIndex === 0) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      switchFontCategory(ui.settings);
    }
  }

  // 1: Face (Cycle)
  if (ui.fontSubMenuIndex === 1) {
    if (e.key === 'ArrowLeft') {
      cycleFontSetting(ui.settings, -1);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      cycleFontSetting(ui.settings, 1);
    }
  }

  // 2: Size (Resize)
  if (ui.fontSubMenuIndex === 2) {
    if (e.key === 'ArrowLeft') {
      ui.settings.zoom = Math.max(MIN_ZOOM, (ui.settings.zoom || MIN_ZOOM) - ZOOM_STEP);
      applyFont(ui.settings);
      saveSettings(ui.settings);
    }
    if (e.key === 'ArrowRight') {
      ui.settings.zoom = Math.min(MAX_ZOOM, (ui.settings.zoom || MIN_ZOOM) + ZOOM_STEP);
      applyFont(ui.settings);
      saveSettings(ui.settings);
    }
  }

  // 3: FPS (Cycle)
  if (ui.fontSubMenuIndex === 3) {
    if (e.key === 'ArrowLeft') {
      cycleFpsSetting(ui.settings, -1);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      cycleFpsSetting(ui.settings, 1);
    }
  }

  // 4: Screen Height (Toggle + reload)
  if (ui.fontSubMenuIndex === 4) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      const current = ui.settings.gridHeight || 43;
      const idx = GRID_HEIGHTS.indexOf(current);
      ui.settings.gridHeight = GRID_HEIGHTS[(idx + 1) % GRID_HEIGHTS.length];
      saveSettings(ui.settings);
      location.reload();
    }
  }
}


// Modal input handler
function handleModalInput(e) {
  if (!ui.modal.active) return;

  const modal = getModal(ui.modal.id);
  if (!modal) return;

  const layoutMode = modal.layout === 'fullscreen' ? 'fullscreen' : 'centered';
  const textWidth = Math.max(24, Math.min(modal.contentWidth || 76, Layout.WIDTH - 4));
  const hasTitle = !!(modal.title && modal.title.trim() !== '');
  const parsedLines = parseModalContent(
    modal.content || '',
    textWidth,
    modal.backgroundColor,
    modal.bodyColor || undefined
  );

  let boxH = Layout.HEIGHT;
  if (layoutMode === 'centered') {
    const chromeRows = hasTitle ? 4 : 2;
    const minCenteredBoxH = hasTitle ? 10 : 8;
    const maxCenteredBoxH = Math.max(minCenteredBoxH, Layout.HEIGHT - 4);
    const maxBodyRows = Math.max(3, maxCenteredBoxH - chromeRows);
    const desiredBodyRows = Math.max(3, Math.min(parsedLines.length || 1, maxBodyRows));
    boxH = Math.max(minCenteredBoxH, desiredBodyRows + chromeRows);
  }

  const boxY = layoutMode === 'fullscreen' ? 0 : Math.floor((Layout.HEIGHT - boxH) / 2);
  let contentStartY = boxY + (hasTitle ? 3 : 1);
  const contentBottomY = boxY + boxH - 2;
  let contentHeight = Math.max(1, contentBottomY - contentStartY + 1);

  // Keep scroll math aligned with UI.renderModal(), which vertically centers
  // fullscreen modal content when it fits (eg: the intro screen).
  if (
    layoutMode === 'fullscreen' &&
    (ui.modal.scroll || 0) === 0 &&
    parsedLines.length > 0 &&
    parsedLines.length < contentHeight
  ) {
    const padTop = Math.floor((contentHeight - parsedLines.length) / 2);
    contentStartY += padTop;
    contentHeight = Math.max(1, contentBottomY - contentStartY + 1);
  }
  const maxScroll = Math.max(0, parsedLines.length - contentHeight);
  ui.modal.scroll = Math.min(ui.modal.scroll, maxScroll);

  // Scroll with arrow keys
  if (e.key === 'ArrowDown') {
    ui.modal.scroll = Math.min(ui.modal.scroll + 1, maxScroll);
    e.preventDefault();
  }
  if (e.key === 'ArrowUp') {
    ui.modal.scroll = Math.max(0, ui.modal.scroll - 1);
    e.preventDefault();
  }

  // Dismiss with SPACE, ENTER, or ESC
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
    if (ui.modal.countdownActive && ui.modal.countdownRemainingMs > 0) {
      e.preventDefault();
      return;
    }
    dismissModal();
    e.preventDefault();
  }

  render();
}

// Show a modal
function showModal(modalId) {
  const modal = getModal(modalId);
  if (!modal) {
    console.warn(`Modal not found: ${modalId}`);
    return;
  }

  // Skip tutorial and story modals if setting is enabled
  if (ui.settings.skipTutorials && (modal.type === 'tutorial' || modal.type === 'story')) {
    console.log(`Skipping ${modal.type} modal: ${modalId} (skipTutorials enabled)`);
    // Check for next modal in queue
    if (modalQueue.hasNext()) {
      const nextId = modalQueue.dequeue();
      showModal(nextId);
    }
    return;
  }

  ui.modal.active = true;
  ui.modal.id = modalId;
  ui.modal.title = modal.title;
  ui.modal.content = modal.content;
  ui.modal.borderStyle = modal.borderStyle;
  ui.modal.borderColor = modal.borderColor;
  ui.modal.backgroundColor = modal.backgroundColor;
  ui.modal.layout = modal.layout;
  ui.modal.overlay = modal.overlay;
  ui.modal.overlayDimStartedAt = Date.now();
  if (ui.modal.overlay === 'dim50') {
    ui.modal.overlayDimFrom = MODAL_DIM_FROM;
    ui.modal.overlayDimTo = MODAL_DIM_TO;
    ui.modal.overlayDimDurationMs = MODAL_DIM_FADE_MS;
  } else {
    ui.modal.overlayDimFrom = 0;
    ui.modal.overlayDimTo = 0;
    ui.modal.overlayDimDurationMs = 0;
  }
  ui.modal.contentWidth = modal.contentWidth;
  ui.modal.titleColor = modal.titleColor;
  ui.modal.bodyColor = modal.bodyColor;
  ui.modal.scroll = 0;
  ui.modal.countdownActive = !!modal.countdown;
  ui.modal.countdownDurationMs = ui.modal.countdownActive ? MODAL_COUNTDOWN_MS : 0;
  ui.modal.countdownEndsAt = ui.modal.countdownActive ? Date.now() + MODAL_COUNTDOWN_MS : 0;
  ui.modal.countdownRemainingMs = ui.modal.countdownDurationMs;

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
  ui.modal.layout = 'centered';
  ui.modal.overlay = 'dim50';
  ui.modal.contentWidth = 76;
  ui.modal.scroll = 0;
  ui.modal.countdownActive = false;
  ui.modal.countdownDurationMs = 0;
  ui.modal.countdownEndsAt = 0;
  ui.modal.countdownRemainingMs = 0;
  ui.modal.overlayDimFrom = MODAL_DIM_FROM;
  ui.modal.overlayDimTo = MODAL_DIM_TO;
  ui.modal.overlayDimDurationMs = 0;
  ui.modal.overlayDimStartedAt = 0;

  // Mark as seen
  if (modalId) {
    modalQueue.markSeen(modalId);
  }

  console.log(`Dismissed modal: ${modalId}`);

  // After intro, show away screen before remaining modals
  if (modalId === 'intro' && engine.awayReport && engine.awayReport.awayRuns.length > 0) {
    activateAwayScreen();
    return;
  }

  // Check queue for next modal
  if (modalQueue.hasNext()) {
    const nextId = modalQueue.dequeue();
    showModal(nextId);
  }
}

function startSelectedRun(scenario, variant) {
  if (!scenario || !variant) return;

  let runsLeft = 0; // single run

  const result = engine.startRun(scenario.id, variant.id, null, runsLeft);
  if (!result.ok) {
    engine.log(`Start failed: ${result.reason}`, 'error');
  }
}

// Main render function
function render() {
  if (ui.awayScreen.active) {
    uiLayer.renderAwayScreen(engine.awayReport, ui.awayScreen);
    renderFrame(true);
    return;
  }

  syncSelection();

  // UI layer writes to buffer (layered composition)
  uiLayer.render();

  // Renderer flushes buffer to DOM
  renderFrame(true);
}

function syncSelection() {
  const branches = uiLayer.getVisibleBranches();
  if (branches.length === 0) {
    ui.branchIndex = 0;
    ui.scenarioIndex = 0;
    ui.variantIndex = 0;
    return;
  }

  ui.branchIndex = Math.max(0, Math.min(branches.length - 1, ui.branchIndex));

  const branch = branches[ui.branchIndex];
  const scenarios = uiLayer.getVisibleScenarios(branch?.id);
  if (scenarios.length === 0) {
    ui.scenarioIndex = 0;
    ui.variantIndex = 0;
    return;
  }

  ui.scenarioIndex = Math.max(0, Math.min(scenarios.length - 1, ui.scenarioIndex));

  const variants = uiLayer.getVisibleVariants(scenarios[ui.scenarioIndex]);
  if (variants.length === 0) {
    ui.variantIndex = 0;
    return;
  }

  ui.variantIndex = Math.max(0, Math.min(variants.length - 1, ui.variantIndex));
}

// Start the application
main();
