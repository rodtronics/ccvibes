import { store, on } from './state.js';
import { checkServer, loadAll, saveAllDirty } from './data-io.js';
import { registerTab, switchTab, wireTabBar, getActiveTab } from './components/tab-bar.js';
import { init as initSidebar } from './components/sidebar.js';
import { init as initMiniMap } from './components/mini-map.js';
import * as workshop from './tabs/workshop.js';
import * as map from './tabs/map.js';
import * as economy from './tabs/economy.js';
import * as world from './tabs/world.js';
import * as modals from './tabs/modals.js';

async function boot() {
  // Register tabs
  registerTab('workshop', workshop);
  registerTab('map', map);
  registerTab('economy', economy);
  registerTab('world', world);
  registerTab('modals', modals);

  // Wire tab buttons + shell actions
  wireTabBar();
  wireShellActions();

  // Initialize sidebar and mini-map
  initSidebar();
  initMiniMap();

  // Check server
  const online = await checkServer();
  updateServerDot(online);

  if (!online) {
    updateStatus('Server offline. Start with: npm run dev:builder');
    return;
  }

  // Load all data
  updateStatus('Loading data...');
  try {
    await loadAll();
    updateStatus(`Loaded: ${store.activities.length} activities, ${store.resources.length} resources, ${store.branches.length} branches`);
  } catch (err) {
    updateStatus(`Failed to load: ${err.message}`);
  }

  // Activate default tab
  switchTab('workshop');

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const tab = getActiveTab();
      if (tab === 'workshop') {
        window._ws?.saveActivity?.();
      } else if (tab === 'economy') {
        window._econ?.saveResources?.();
      } else if (tab === 'world') {
        // Save all world tab data (branches, roles, perks)
        window._world?.saveBranches?.();
        window._world?.saveRoles?.();
        window._world?.savePerks?.();
      } else if (tab === 'modals') {
        window._modals?.saveModals?.();
      } else {
        // Fallback: save all dirty files
        saveAllDirty();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      switchTab('workshop');
      if (window._ws?.openWizard) window._ws.openWizard();
      else if (window._ws?.newActivity) window._ws.newActivity();
    }
    // Tab shortcuts: Ctrl+1-5
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '5') {
      e.preventDefault();
      const tabs = ['workshop', 'map', 'economy', 'world', 'modals'];
      switchTab(tabs[parseInt(e.key) - 1]);
    }
  });

  on('save-complete', () => updateServerDot(true));
}

function wireShellActions() {
  const btnNewActivity = document.getElementById('btnNewActivity');
  if (btnNewActivity) {
    btnNewActivity.addEventListener('click', () => {
      switchTab('workshop');
      if (window._ws?.openWizard) window._ws.openWizard();
      else if (window._ws?.newActivity) window._ws.newActivity();
    });
  }

  const btnNewResource = document.getElementById('btnNewResource');
  if (btnNewResource) {
    btnNewResource.addEventListener('click', () => {
      switchTab('economy');
    });
  }
}

function updateServerDot(online) {
  const dot = document.getElementById('serverDot');
  if (!dot) return;
  dot.textContent = '\u25CF';
  dot.style.color = online ? '#34d399' : '#f87171';
  dot.title = online ? 'Server online' : 'Server offline';
}

function updateStatus(msg) {
  const el = document.getElementById('statusText');
  if (el) el.textContent = msg;
}

document.addEventListener('DOMContentLoaded', boot);
