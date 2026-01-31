const tabs = {};
let activeTabId = null;

export function registerTab(id, module) {
  tabs[id] = { module, initialized: false };
}

export function switchTab(tabId) {
  if (tabId === activeTabId) return;

  // Deactivate current
  if (activeTabId) {
    const panel = document.getElementById(`tab-${activeTabId}`);
    const btn = document.querySelector(`[data-tab="${activeTabId}"]`);
    if (panel) panel.classList.remove('active');
    if (btn) btn.classList.remove('active');
    tabs[activeTabId]?.module?.deactivate?.();
  }

  activeTabId = tabId;

  // Activate new
  const panel = document.getElementById(`tab-${tabId}`);
  const btn = document.querySelector(`[data-tab="${tabId}"]`);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');

  const tab = tabs[tabId];
  if (tab) {
    if (!tab.initialized) {
      tab.module.init(panel);
      tab.initialized = true;
    }
    tab.module.activate?.();
  }
}

export function getActiveTab() {
  return activeTabId;
}

export function wireTabBar() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}
