/**
 * Main Entry Point - Initializes game and starts game loop
 */

const STORAGE_KEY = "ccvi_experimental_v6";
const TICK_INTERVAL = 1000;

// Sample content matching schema
const SAMPLE_CONTENT = {
  branches: [
    { id: "street", name: "Street", order: 1, revealedByDefault: true },
    { id: "commerce", name: "Commerce", order: 2, revealedByDefault: false }
  ],

  resources: [
    { id: "cash", name: "Cash", description: "money", revealedByDefault: true },
    { id: "dirtyMoney", name: "Dirty Money", description: "needs washing", revealedByDefault: false },
    { id: "heat", name: "Heat", description: "attention level", revealedByDefault: true },
    { id: "streetCred", name: "Street Cred", description: "reputation", revealedByDefault: false }
  ],

  items: [
    { id: "lockpick", name: "Lockpick", description: "opens things", stackable: true }
  ],

  roles: [
    {
      id: "player",
      name: "Player",
      description: "that's you",
      xpToStars: [
        { stars: 0, minXp: 0 },
        { stars: 1, minXp: 100 },
        { stars: 2, minXp: 300 },
        { stars: 3, minXp: 700 }
      ],
      revealedByDefault: true
    },
    {
      id: "runner",
      name: "Runner",
      description: "fast and nimble",
      xpToStars: [
        { stars: 0, minXp: 0 },
        { stars: 1, minXp: 50 },
        { stars: 2, minXp: 150 },
        { stars: 3, minXp: 400 }
      ],
      revealedByDefault: false
    }
  ],

  activities: [
    {
      id: "panhandling",
      branchId: "street",
      name: "panhandling",
      description: "asking politely for other people's money.",
      meta: { tags: ["starter"], icon: "🪙" },
      visibleIf: [],
      unlockIf: [],
      reveals: {
        onReveal: [],
        onUnlock: []
      },
      options: [
        {
          id: "panhandling_default",
          name: "spare change",
          description: "sit with a cup. wait.",
          visibleIf: [],
          unlockIf: [],
          requirements: {
            staff: [{ roleId: "player", count: 1, starsMin: 0 }],
            items: [],
            buildings: []
          },
          inputs: {
            resources: {},
            items: {}
          },
          durationMs: 10000,
          xpRewards: {
            onComplete: 2
          },
          resolution: {
            type: "ranged_outputs",
            outputs: {
              resources: { cash: { min: 1, max: 5 } },
              items: {}
            },
            heatDelta: 0,
            effects: []
          },
          modifiers: [],
          cooldownMs: 0
        }
      ]
    },

    {
      id: "shoplifting",
      branchId: "street",
      name: "shoplifting",
      description: "borrow something. forget to return it.",
      meta: { tags: ["crime", "starter"], icon: "👜" },
      visibleIf: [],
      unlockIf: [],
      reveals: {
        onReveal: [],
        onUnlock: []
      },
      options: [
        {
          id: "shoplifting_grab_and_go",
          name: "grab and go",
          description: "confidence is the disguise.",
          visibleIf: [],
          unlockIf: [],
          requirements: {
            staff: [{ roleId: "player", count: 1, starsMin: 0 }],
            items: [],
            buildings: []
          },
          inputs: {
            resources: {},
            items: {}
          },
          durationMs: 15000,
          xpRewards: {
            onComplete: 5
          },
          resolution: {
            type: "weighted_outcomes",
            outcomes: [
              {
                id: "success",
                weight: 60,
                outputs: {
                  resources: { cash: 25 },
                  items: {}
                },
                heatDelta: 1,
                effects: []
              },
              {
                id: "big_score",
                weight: 20,
                outputs: {
                  resources: { cash: 80, streetCred: 1 },
                  items: {}
                },
                heatDelta: 1,
                effects: [
                  { type: "revealResource", resourceId: "streetCred" }
                ]
              },
              {
                id: "caught",
                weight: 20,
                outputs: {
                  resources: {},
                  items: {}
                },
                heatDelta: 5,
                jail: { durationMs: 30000 },
                effects: []
              }
            ]
          },
          modifiers: [
            {
              type: "staffStars",
              roleId: "player",
              applyPerStar: {
                successWeightDelta: 5,
                caughtWeightDelta: -3
              }
            }
          ],
          cooldownMs: 0
        },

        {
          id: "shoplifting_distract",
          name: "coordinated distraction",
          description: "one talks, one takes.",
          visibleIf: [],
          unlockIf: [
            { type: "resourceGte", resourceId: "streetCred", value: 1 }
          ],
          requirements: {
            staff: [{ roleId: "player", count: 1, starsMin: 1 }],
            items: [],
            buildings: []
          },
          inputs: {
            resources: {},
            items: {}
          },
          durationMs: 20000,
          xpRewards: {
            onComplete: 8
          },
          resolution: {
            type: "weighted_outcomes",
            outcomes: [
              {
                id: "success",
                weight: 80,
                outputs: {
                  resources: { cash: 50 },
                  items: {}
                },
                heatDelta: 1,
                effects: []
              },
              {
                id: "caught",
                weight: 20,
                outputs: {
                  resources: {},
                  items: {}
                },
                heatDelta: 4,
                jail: { durationMs: 25000 },
                effects: []
              }
            ]
          },
          modifiers: [],
          cooldownMs: 0
        }
      ]
    },

    {
      id: "street_dealing",
      branchId: "street",
      name: "street dealing",
      description: "exchange goods for money on street corners.",
      meta: { tags: ["crime", "commerce"], icon: "💊" },
      visibleIf: [
        { type: "resourceGte", resourceId: "streetCred", value: 2 }
      ],
      unlockIf: [
        { type: "resourceGte", resourceId: "streetCred", value: 5 }
      ],
      reveals: {
        onReveal: [],
        onUnlock: []
      },
      options: [
        {
          id: "street_dealing_basic",
          name: "corner hustle",
          description: "low risk, low reward.",
          visibleIf: [],
          unlockIf: [],
          requirements: {
            staff: [{ roleId: "player", count: 1, starsMin: 0 }],
            items: [],
            buildings: []
          },
          inputs: {
            resources: { cash: 20 },
            items: {}
          },
          durationMs: 25000,
          xpRewards: {
            onComplete: 10
          },
          resolution: {
            type: "deterministic",
            outputs: {
              resources: { cash: 45 },
              items: {}
            },
            heatDelta: 2,
            effects: []
          },
          modifiers: [],
          cooldownMs: 0
        }
      ]
    },

    {
      id: "dumpster_diving",
      branchId: "street",
      name: "dumpster diving",
      description: "one person's trash is another's treasure.",
      meta: { tags: ["starter", "low-risk"], icon: "🗑️" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "dumpster_diving_default",
        name: "retail alley sweep",
        description: "check behind the mall.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 8000,
        xpRewards: { onComplete: 1 },
        resolution: {
          type: "ranged_outputs",
          outputs: { resources: { cash: { min: 2, max: 8 } }, items: {} },
          heatDelta: 0,
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "pickpocketing",
      branchId: "street",
      name: "pickpocketing",
      description: "light fingers, quick exits.",
      meta: { tags: ["crime", "skill"], icon: "👋" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "pickpocketing_crowded_street",
        name: "crowded street",
        description: "blend into the crowd.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 12000,
        xpRewards: { onComplete: 4 },
        resolution: {
          type: "weighted_outcomes",
          outcomes: [
            { id: "success", weight: 70, outputs: { resources: { cash: 35 }, items: {} }, heatDelta: 1, effects: [] },
            { id: "big_score", weight: 15, outputs: { resources: { cash: 90 }, items: {} }, heatDelta: 2, effects: [] },
            { id: "caught", weight: 15, outputs: { resources: {}, items: {} }, heatDelta: 5, effects: [] }
          ]
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "car_burglary",
      branchId: "street",
      name: "car burglary",
      description: "parked cars are easy targets.",
      meta: { tags: ["crime", "theft"], icon: "🚗" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "car_burglary_smash_grab",
        name: "smash and grab",
        description: "quick but loud.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 18000,
        xpRewards: { onComplete: 6 },
        resolution: {
          type: "weighted_outcomes",
          outcomes: [
            { id: "success", weight: 60, outputs: { resources: { cash: 60 }, items: {} }, heatDelta: 3, effects: [] },
            { id: "jackpot", weight: 10, outputs: { resources: { cash: 150 }, items: {} }, heatDelta: 3, effects: [] },
            { id: "busted", weight: 30, outputs: { resources: {}, items: {} }, heatDelta: 6, jail: { durationMs: 30000 }, effects: [] }
          ]
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "package_theft",
      branchId: "street",
      name: "package theft",
      description: "porch pirates at work.",
      meta: { tags: ["crime", "theft"], icon: "📦" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "package_theft_suburb",
        name: "suburban sweep",
        description: "quiet neighborhoods, easy pickings.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 22000,
        xpRewards: { onComplete: 5 },
        resolution: {
          type: "ranged_outputs",
          outputs: { resources: { cash: { min: 30, max: 70 } }, items: {} },
          heatDelta: { min: 1, max: 3 },
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "ATM_skimming",
      branchId: "commerce",
      name: "ATM skimming",
      description: "harvest card data from machines.",
      meta: { tags: ["tech", "crime"], icon: "💳" },
      visibleIf: [],
      unlockIf: [{ type: "resourceGte", resourceId: "streetCred", value: 3 }],
      reveals: { onReveal: [{ type: "revealBranch", branchId: "commerce" }], onUnlock: [] },
      options: [{
        id: "ATM_skimming_install",
        name: "install skimmer",
        description: "attach the device and wait.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 1 }], items: [], buildings: [] },
        inputs: { resources: { cash: 50 }, items: {} },
        durationMs: 60000,
        xpRewards: { onComplete: 15 },
        resolution: {
          type: "deterministic",
          outputs: { resources: { cash: 180 }, items: {} },
          heatDelta: 4,
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "bike_theft",
      branchId: "street",
      name: "bike theft",
      description: "bolt cutters work wonders.",
      meta: { tags: ["crime", "theft"], icon: "🚲" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "bike_theft_campus",
        name: "campus raid",
        description: "college students never lock properly.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 14000,
        xpRewards: { onComplete: 3 },
        resolution: {
          type: "ranged_outputs",
          outputs: { resources: { cash: { min: 40, max: 120 } }, items: {} },
          heatDelta: 2,
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "storage_unit_raid",
      branchId: "commerce",
      name: "storage unit raid",
      description: "abandoned units hide treasures.",
      meta: { tags: ["crime", "long"], icon: "🏢" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "storage_unit_raid_night",
        name: "midnight haul",
        description: "cut the lock, load the truck.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: { cash: 30 }, items: {} },
        durationMs: 90000,
        xpRewards: { onComplete: 20 },
        resolution: {
          type: "weighted_outcomes",
          outcomes: [
            { id: "junk", weight: 40, outputs: { resources: { cash: 80 }, items: {} }, heatDelta: 2, effects: [] },
            { id: "decent", weight: 40, outputs: { resources: { cash: 200 }, items: {} }, heatDelta: 3, effects: [] },
            { id: "goldmine", weight: 20, outputs: { resources: { cash: 500 }, items: {} }, heatDelta: 4, effects: [] }
          ]
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "counterfeit_merch",
      branchId: "commerce",
      name: "counterfeit merch",
      description: "fake it till you make it.",
      meta: { tags: ["commerce", "crime"], icon: "👕" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "counterfeit_merch_street_sale",
        name: "street corner sale",
        description: "sell knockoffs to tourists.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: { cash: 40 }, items: {} },
        durationMs: 35000,
        xpRewards: { onComplete: 8 },
        resolution: {
          type: "deterministic",
          outputs: { resources: { cash: 110 }, items: {} },
          heatDelta: 2,
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "catalytic_converter_theft",
      branchId: "street",
      name: "catalytic converter theft",
      description: "quick money from parked cars.",
      meta: { tags: ["crime", "theft"], icon: "🔧" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "catalytic_converter_theft_parking_lot",
        name: "parking lot sweep",
        description: "slide under, cut it out.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 20000,
        xpRewards: { onComplete: 7 },
        resolution: {
          type: "weighted_outcomes",
          outcomes: [
            { id: "success", weight: 75, outputs: { resources: { cash: 85 }, items: {} }, heatDelta: 3, effects: [] },
            { id: "caught_alarm", weight: 25, outputs: { resources: {}, items: {} }, heatDelta: 7, effects: [] }
          ]
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "copper_wire_heist",
      branchId: "street",
      name: "copper wire heist",
      description: "strip construction sites for scrap.",
      meta: { tags: ["crime", "long"], icon: "⚡" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "copper_wire_heist_construction",
        name: "construction site raid",
        description: "heavy load, high reward.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 120000,
        xpRewards: { onComplete: 25 },
        resolution: {
          type: "ranged_outputs",
          outputs: { resources: { cash: { min: 300, max: 600 } }, items: {} },
          heatDelta: { min: 3, max: 5 },
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "jewelry_store_smash",
      branchId: "commerce",
      name: "jewelry store smash",
      description: "high risk, high reward.",
      meta: { tags: ["crime", "high-risk", "long"], icon: "💎" },
      visibleIf: [{ type: "resourceGte", resourceId: "streetCred", value: 5 }],
      unlockIf: [{ type: "resourceGte", resourceId: "streetCred", value: 10 }],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "jewelry_store_smash_night",
        name: "smash and grab heist",
        description: "break the glass, grab what you can.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 2 }], items: [], buildings: [] },
        inputs: { resources: { cash: 100 }, items: {} },
        durationMs: 180000,
        xpRewards: { onComplete: 40 },
        resolution: {
          type: "weighted_outcomes",
          outcomes: [
            { id: "success", weight: 50, outputs: { resources: { cash: 800 }, items: {} }, heatDelta: 8, effects: [] },
            { id: "big_haul", weight: 20, outputs: { resources: { cash: 1500 }, items: {} }, heatDelta: 10, effects: [] },
            { id: "busted", weight: 30, outputs: { resources: {}, items: {} }, heatDelta: 15, jail: { durationMs: 120000 }, effects: [] }
          ]
        },
        modifiers: [],
        cooldownMs: 0
      }]
    },

    {
      id: "vending_machine_hack",
      branchId: "commerce",
      name: "vending machine hack",
      description: "free snacks and cash.",
      meta: { tags: ["tech", "starter"], icon: "🍫" },
      visibleIf: [],
      unlockIf: [],
      reveals: { onReveal: [], onUnlock: [] },
      options: [{
        id: "vending_machine_hack_campus",
        name: "campus machines",
        description: "exploit the coin mechanism.",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 9000,
        xpRewards: { onComplete: 2 },
        resolution: {
          type: "ranged_outputs",
          outputs: { resources: { cash: { min: 15, max: 35 } }, items: {} },
          heatDelta: 1,
          effects: []
        },
        modifiers: [],
        cooldownMs: 0
      }]
    }
  ]
};

// Main initialization
document.addEventListener("DOMContentLoaded", async () => {
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
  Engine.loadContent(SAMPLE_CONTENT);

  // Initialize UI
  UI.init();
  UI.renderAll();

  // Start game loop
  let tickCounter = 0;
  setInterval(() => {
    const didComplete = Engine.tick();

    // Update stats every tick
    UI.renderStats();

    // Update runs display every tick
    if (Engine.state.runs.length > 0) {
      UI.renderRuns();

      // If we're viewing an activity detail, update it too
      if (UI.view === "detail" && UI.selectedActivity) {
        UI.renderActivities();
      }
    }

    // Full render if something completed
    if (didComplete) {
      UI.renderAll();
    }

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
