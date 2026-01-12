/**
 * Main Entry Point - Initializes game and starts game loop
 */

const STORAGE_KEY = "ccvi_experimental_v6";
const TICK_INTERVAL = 1000;

// Data Loading System
const DataLoader = {
  async loadAll() {
    console.log("Loading game data...");
    const [lexicon, branches, resources, items, roles, activities] = await Promise.all([
      this.fetchJson("data/lexicon.json"),
      this.fetchJson("data/branches.json"),
      this.fetchJson("data/resources.json"),
      this.fetchJson("data/items.json"),
      this.fetchJson("data/roles.json"),
      this.fetchJson("data/activities.json"),
    ]);

    // Initialize Lexicon globally
    window.Lexicon.data = lexicon || {};
    console.log("Lexicon loaded");

    // Return content object for Engine
    return {
      branches: branches || [],
      resources: resources || [],
      items: items || [],
      roles: roles || [],
      activities: activities || [],
    };
  },

  async fetchJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error(`Failed to load ${url}:`, err);
      return null;
    }
  },
};

// Global Lexicon object
const Lexicon = {
  data: null,

  get(path) {
    if (!this.data) return path;
    const parts = path.split(".");
    let value = this.data;
    for (const part of parts) {
      value = value?.[part];
      if (value === undefined) return path;
    }
    return value;
  },

  template(path, vars = {}) {
    let text = this.get(path);
    for (const [key, val] of Object.entries(vars)) {
      text = text.replace(`{${key}}`, val);
    }
    return text;
  },
};

document.addEventListener("DOMContentLoaded", async () => {
  // Load all external data
  const content = await DataLoader.loadAll();

  // Load saved state
  let savedState = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      savedState = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to load saved state:", err);
  }

  // Initialize engine
  Engine.init(savedState);
  Engine.loadContent(content);

  // Initialize UI (this sets up event listeners to Engine)
  UI.init();
  UI.renderAll();

  // Start game loop - now event-driven!
  // Engine emits events, UI listens and updates automatically
  let tickCounter = 0;
  setInterval(() => {
    Engine.tick(); // Engine handles state updates and emits events

    // Stats update on every tick
    UI.renderStats();

    // Auto-save every 10 ticks (10 seconds)
    tickCounter++;
    if (tickCounter >= 10) {
      saveGame();
      tickCounter = 0;
    }

    // Update uptime
    updateUptime();
  }, TICK_INTERVAL);

  // Setup save on page unload
  window.addEventListener("beforeunload", () => {
    saveGame();
  });
});

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Engine.state));
  } catch (err) {
    console.error("Failed to save game:", err);
  }
}

function updateUptime() {
  const uptimeEl = document.getElementById("uptime");
  if (!uptimeEl) return;

  const elapsed = Engine.state.now - (Engine.state.log[0]?.time || Engine.state.now);
  const seconds = Math.floor(elapsed / 1000) % 60;
  const minutes = Math.floor(elapsed / 60000) % 60;
  const hours = Math.floor(elapsed / 3600000);

  uptimeEl.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Expose for debugging
window.Engine = Engine;
window.UI = UI;
window.Lexicon = Lexicon;
window.saveGame = saveGame;

// Add reset command
window.resetGame = () => {
  if (confirm("Reset all progress?")) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
};

console.log("%c═══════════════════════════════════════════════════════", "color: #00ffff");
console.log("%c CRIME COMMITTER VI - EXPERIMENTAL BUILD", "color: #00ffff; font-weight: bold");
console.log("%c═══════════════════════════════════════════════════════", "color: #00ffff");
console.log("%cCommands:", "color: #00ff00");
console.log("%c  resetGame() - Clear all data and restart", "color: #cccccc");
console.log("%c  saveGame() - Manually save current state", "color: #cccccc");
console.log("%c  Engine.state - View current game state", "color: #cccccc");
console.log("%c═══════════════════════════════════════════════════════", "color: #00ffff");
