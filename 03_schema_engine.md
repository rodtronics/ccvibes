# Crime Committer VI — Data Schema and Engine Rules

Purpose: single source of truth for data structures and engine behavior. All game content must be expressible here; no custom per-activity code. Pair with `01_design_philosophy.md` for intent and `02_ui_spec.md` for presentation.

## 0. Global Conventions
- IDs: stable string IDs; `snake_case` recommended; unique within each namespace. Examples: `scenarioId: shoplifting`, `variantId: shoplifting_grab_and_go`, `resourceId: cash`, `roleId: thief`.
- Time: all durations are in milliseconds; all timestamps are Unix epoch milliseconds.
- All content is JSON-serialisable.

### Data Files
- `data/branches.json` — Branch definitions (UI grouping).
- `data/scenarios.json` — Scenarios and their Variants.
- `data/resources.json` — Resource definitions (currencies, equipment, intel, reputation).
- `data/roles.json` — Staff role definitions with XP/star progression.
- `data/modals.json` — Modal content (story, lore, lessons).
- `data/lexicon.json` — All UI-facing text strings (labels, actions, errors, tooltips, log templates).
- `data/names.json` — Crew name generation pool (1528 entries); consumed by `crew.js`.

## 1. Runtime Game State (minimal shape)
```json
{
  "version": 6,
  "now": 0,
  "resources": {
    "cash": 0,
    "cred": 50,
    "heat": 0,
    "intel": 0
  },
  "flags": {},
  "reveals": {
    "branches": {},
    "scenarios": {},
    "resources": {},
    "roles": {},
    "tabs": {}
  },
  "crew": {
    "staff": [
      {
        "id": "s_001",
        "name": "crew_001",
        "roleId": "runner",
        "xp": 0,
        "status": "available",
        "unavailableUntil": 0,
        "perks": [],
        "perkChoices": {},
        "unchosen": [],
        "pendingPerkChoice": null
      }
    ]
  },
  "runs": [],
  "log": [],
  "stats": {
    "lastRecorded": { "second": 0, "minute": 0, "fiveMin": 0, "hour": 0, "day": 0, "month": 0 },
    "series": {},
    "totals": { "crimesCompleted": 0, "crimesSucceeded": 0, "crimesFailed": 0, "totalEarned": 0, "totalSpent": 0 }
  }
}
```

Staff status values: `available`, `unavailable` (time-based).

**Note**: `repeatQueues` has been removed in favor of unified repeat architecture using `runsLeft` field (see section 2).

## 2. Unified Repeat System (run-bound architecture)
Repeat logic is now unified using a single `runsLeft` field on each run instance. This eliminates the separate `repeatQueues` structure.

### Run Instance with Repeat Field
```json
{
  "runId": "r_001",
  "scenarioId": "shoplifting",
  "variantId": "shoplifting_grab_and_go",
  "startedAt": 1700000000000,
  "endsAt": 1700000006000,
  "assignedStaffIds": ["s_001"],
  "runsLeft": 5,
  "status": "active",
  "totalRuns": 6,
  "currentRun": 1,
  "results": [],
  "completedAt": null,
  "snapshot": { "plannedOutcomeId": null }
}
```

### runsLeft Values
- `0`: Single run (no repeat). This is the default for all runs.
- `N` (positive integer): Countdown mode. After this run completes, start another run with `runsLeft = N - 1`.
- `-1`: Infinite repeat. After this run completes, start another run with `runsLeft = -1`.

### Behavior
- On run completion, `checkRepeatQueue(run)` examines `run.runsLeft`.
- If `runsLeft === 0`, do nothing (single run completed).
- If `runsLeft > 0`, decrement by 1 and call `startRun(scenarioId, variantId, assignedStaffIds, order, newRunsLeft)`.
- If `runsLeft === -1`, call `startRun()` with `runsLeft = -1` (infinite continuation).
- If auto-restart fails (insufficient resources, crew busy, etc.), log warning and stop repeating.

### Stop Repeat
- `Engine.stopRepeat(runId)` sets `run.runsLeft = 0`, causing the current run to complete as a single run without restarting.
- This allows stopping repeat behavior without forfeiting progress on the current run.

### Migration
- Legacy saved states with `repeatQueues` are migrated in `normalizeState()`:
  - All runs default to `runsLeft: 0` if missing.
  - Old `repeatQueues` structure is deleted.

### Availability
- Currently available for all variants; `variant.repeatable` gating is planned but not yet enforced.
- Run-bound design allows multiple concurrent runs of the same variant to each have independent repeat states.

## 3. Persistent Operations
Long-running passive operations distinct from runs.
```json
{
  "id": "po_001",
  "type": "skimmer",
  "installedAt": 1700000000000,
  "lastCheckAt": 1700000060000,
  "locationId": "campus_atm_3",
  "discoveryChance": 0.02,
  "yieldChance": 0.30,
  "checkIntervalMs": 60000
}
```
- Fields: unique `id`; `type`; timestamps; optional `locationId`; `discoveryChance`; `yieldChance`; `checkIntervalMs`.
- Behavior: on each tick, if `now - lastCheckAt >= checkIntervalMs`, process: (1) possible yield; (2) possible discovery/removal (heat can raise discovery); (3) nothing. Modifiers can adjust chances. Operations are removed on discovery or manual removal.
- Variant extension example:
```json
{
  "createsPersistentOperation": {
    "type": "skimmer",
    "baseDiscoveryChance": 0.02,
    "baseYieldChance": 0.30,
    "checkIntervalMs": 60000,
    "yieldOutputs": { "resources": { "cash": { "min": 20, "max": 80 } } }
  }
}
```

## 4. Entities
### Branch (UI grouping only)
```json
{
  "id": "street",
  "name": "the streets",
  "description": "Small-time hustles and petty crimes to get started",
  "order": 20,
  "hotkey": "s",
  "revealedByDefault": false,
  "ui": { "color": "NEON_CYAN" }
}
```

### Resource
Unified numeric counters for all trackable values — currencies, reputation, equipment, intel, and items. May be hidden until revealed.
```json
{
  "id": "lockpick",
  "name": "lockpick",
  "description": "technically it is a hobby tool.",
  "category": "equipment",
  "revealedByDefault": false,
  "branchId": null,
  "modalId": "lockpick_lore",
  "discrete": true,
  "persistent": false,
  "singular": false
}
```
- `category`: UI grouping — `currency`, `risk`, `reputation`, `intel`, `equipment`.
- `branchId` (optional): ties this resource to a specific branch (e.g. `"primordial"`).
- `modalId` (optional): lore modal shown on first reveal.
- `discrete` (optional, default false): integer-only values (e.g. items, tools).
- `persistent` (optional, default false): not consumed on use.
- `singular` (optional, default false): maximum quantity of 1.

Special resources:
- **Cred (0–100, capped)**: starting ~50; gates crew recruitment and activity unlocks; fluctuates on success/failure; recoverable through low-risk jobs.
- **Heat (0+, uncapped)**: always positive; rises from crimes; decays over time; increases failure/discovery chances; never blocks actions directly.

### Role
Staff role definition with XP -> stars mapping.
```json
{
  "id": "player",
  "name": "mastermind",
  "description": "you.",
  "xpToStars": [
    { "stars": 0, "minXp": 0 },
    { "stars": 1, "minXp": 100 },
    { "stars": 2, "minXp": 350 },
    { "stars": 3, "minXp": 800 },
    { "stars": 4, "minXp": 1500 },
    { "stars": 5, "minXp": 2500 }
  ],
  "revealedByDefault": true,
  "perkChoices": []
}
```
Planned role archetypes:
- Core: thief (executor), driver (getaway/logistics), runner (starter), hacker (digital).
- Specialists (optional bonuses): fixer (cred specialist), cleaner (heat reduction), planner (success/precision).
- Reputation grinder roles: courier, lookout, consultant.

Perk choices are optional. Each tier offers exactly two options; one is chosen permanently and the other is locked out.

### Perk
Permanent staff upgrade chosen from a tier.
```json
{
  "id": "steady_hands",
  "name": "steady hands",
  "description": "less noise, more time.",
  "tags": ["thief"],
  "revealedByDefault": false
}
```

Perk state lives on the staff record:
```json
{
  "perks": ["steady_hands"],
  "perkChoices": { "thief_1": "steady_hands" },
  "unchosen": ["cold_read"],
  "pendingPerkChoice": null
}
```

Perk choice flow (permanent):
- When a staff member gains a new star and a `perkChoices` tier is newly available, queue a `pendingPerkChoice` for that staff.
- Only one pending choice per staff at a time; if multiple tiers unlock, queue in star order.
- Selecting a perk adds it to `staff.perks` and records it in `staff.perkChoices`. The other option is added to `staff.unchosen`.

Redemption (tentative):
- At star 5, if `unchosen` is non-empty, the staff member gets a redemption choice: pick one previously passed perk from `unchosen`. Chosen perk is removed from `unchosen` and added to `perks`.

### Scenario
UI container; never executes directly.
```json
{
  "id": "shoplifting",
  "branchId": "street",
  "name": "shoplifting",
  "description": "you borrow something and forget to return it.",
  "meta": { "tags": ["crime", "starter"], "icon": ":)" },
  "visibleIf": [],
  "unlockIf": [],
  "reveals": { "onReveal": [], "onUnlock": [] },
  "variants": []
}
```

### Variant
Executable recipe; each creates a Run.
```json
{
  "id": "shoplifting_grab_and_go",
  "name": "grab and go",
  "repeatable": true,
  "description": "confidence is the real disguise.",
  "visibleIf": [],
  "unlockIf": [],
  "requirements": {
    "staff": [
      { "roleId": "runner", "count": 1, "starsMin": 0, "required": true }
    ],
    "buildings": []
  },
  "inputs": { "resources": {} },
  "durationMs": 6000,
  "xpRewards": { "onComplete": 8 },
  "resolution": {},
  "modifiers": [],
  "cooldownMs": 0
}
```
- `repeatable` (planned, not yet enforced) controls whether repeat queue UI/behavior is available for this specific variant. Currently all variants can repeat.
- Staff requirements support `required` (default true) and optional slots; optional slots describe bonuses and are expressed via modifiers.

### Run (runtime instance)
```json
{
  "runId": "r_001",
  "scenarioId": "shoplifting",
  "variantId": "shoplifting_grab_and_go",
  "startedAt": 1700000000000,
  "endsAt": 1700000006000,
  "assignedStaffIds": ["s_001"],
  "runsLeft": 0,
  "status": "active",
  "totalRuns": 1,
  "currentRun": 1,
  "results": [],
  "completedAt": null,
  "snapshot": { "plannedOutcomeId": null }
}
```
- `runsLeft`: Unified repeat field. `0` = single run, `N` = repeat N more times after this, `-1` = infinite repeat.
- `status`: `"active"` while running, `"completed"` when finished. Completed runs persist for UI display.
- `totalRuns`: Total runs planned (`1` for single, `N+1` for countdown, `-1` for infinite).
- `currentRun`: Which sub-run is currently executing (increments on repeat).
- `results`: Array of sub-run outcomes: `{ subRunIndex, completedAt, wasSuccess, resourcesGained, botched }`.
- `completedAt`: Timestamp when the run (or final repeat) finished; `null` while active.
- `plannedOutcomeId`, once chosen, must not change.

### Tech Node (optional, discovery-oriented)
```json
{
  "id": "shell_companies",
  "name": "shell companies",
  "description": "paperwork that somehow weighs more than money.",
  "visibleIf": [],
  "unlockIf": [],
  "durationMs": 600000,
  "inputs": { "resources": { "cash": 200, "fakeID": 1 } },
  "effects": [
    { "type": "revealScenario", "scenarioId": "laundering" }
  ]
}
```

### Modal
Modals are the primary narrative and tutorial delivery system. They are intended to be used extensively — for telling the story, introducing new mechanics, and providing lore context as the player progresses. Modals are queued and displayed one at a time.
```json
{
  "id": "intel_lore",
  "title": "Intel",
  "body": "**Intel** is the currency of the criminal underworld.\n\n{{neon_cyan}}knowledge is power{{/}}",
  "type": "lore",
  "showOnce": true
}
```
- `type`: `"story"` (narrative progression), `"lore"` (world-building, mechanic introductions), `"lesson"` (tutorial/guidance).
- `showOnce` (optional, default false): if true, only shown once per playthrough (tracked in localStorage).
- `body` supports inline formatting: `**bold**`, `~~dim~~`, `{{color}}text{{/}}`, `{{bg:color}}text{{/}}`.
- `borderColor`, `borderStyle`, `titleColor`, `bodyColor`, `backgroundColor` (all optional): style overrides.
- Modals can be triggered by effects (`showModal`), by resource `modalId` on first reveal, or queued directly.

## 5. Resolution Types
### Deterministic
```json
{
  "type": "deterministic",
  "outputs": { "resources": { "cash": 50 } },
  "credDelta": 2,
  "heatDelta": 1,
  "effects": []
}
```
### Ranged Outputs
```json
{
  "type": "ranged_outputs",
  "outputs": { "resources": { "cash": { "min": 20, "max": 60 } } },
  "credDelta": { "min": 1, "max": 5 },
  "heatDelta": { "min": 1, "max": 3 },
  "effects": []
}
```
### Weighted Outcomes (preferred)
```json
{
  "type": "weighted_outcomes",
  "outcomes": [
    { "id": "ok", "weight": 70, "outputs": { "resources": { "cash": 40 } }, "credDelta": 3, "heatDelta": 2, "effects": [] },
    { "id": "lucky", "weight": 20, "outputs": { "resources": { "cash": 120 } }, "credDelta": 8, "heatDelta": 1, "effects": [{ "type": "revealScenario", "scenarioId": "fencing_goods" }] },
    { "id": "caught", "weight": 10, "outputs": {}, "credDelta": -20, "heatDelta": 6, "jail": { "durationMs": 43200000 }, "effects": [] }
  ]
}
```

## 6. Modifiers
Modifiers adjust resolution parameters before rolling; they stack additively and apply before outcome selection.

### Canonical Modifier Types
- Environment-based: `heatAbove`, `heatBelow`, `flagIs`, `resourceGte`.
- Crew-based: `staffStars`, `staffRole`, `staffCount`, `staffPerk`.

### Modifier Effects
- Outcome weight adjustment, delta bonuses (`credDeltaBonus`, `heatDeltaReduction`), multipliers (`credDeltaMultiplier`, `heatDeltaMultiplier`, `durationMultiplier`), special (`discoveryChanceReduction`).

### Stacking Rules
1. Multiple modifiers of the same type add together.
2. Apply delta bonuses before multipliers.
3. Sum all weight adjustments, then clamp outcome weights to 0+.
4. Apply multipliers after additive adjustments.
5. Clamp cred to 0–100 and heat to 0+.

### Examples
- Star-based scaling:
```json
{ "type": "staffStars", "roleId": "thief", "applyPerStar": { "outcomeWeightAdjustment": { "caught": -5, "clean_success": 5 } } }
```
- Role-based bonuses (optional specialists):
```json
{ "type": "staffRole", "roleId": "fixer", "effects": { "credDeltaBonus": 5, "outcomeWeightAdjustment": { "caught": -15, "clean_success": 15 } } }
{ "type": "staffRole", "roleId": "cleaner", "effects": { "heatDeltaMultiplier": 0.6 } }
{ "type": "staffRole", "roleId": "planner", "effects": { "durationMultiplier": 1.2, "outcomeWeightAdjustment": { "brute_force_success": -20, "clean_success": 20 }, "credDeltaBonus": 3 } }
```
- Perk-based bonuses (applies once if any assigned staff has the perk):
```json
{ "type": "staffPerk", "perkId": "steady_hands", "effects": { "outcomeWeightAdjustment": { "caught": -5, "clean_success": 5 } } }
```

Design principle: modifiers only adjust numeric values; they do not execute logic or mutate state directly.

## 7. Conditions (visibleIf/unlockIf)
Atomic types: `flagIs`, `resourceGte`, `roleRevealed`, `scenarioRevealed`.
Logical wrappers: `allOf`, `anyOf`, `not`.
Example:
```json
{
  "type": "allOf",
  "conds": [
    { "type": "resourceGte", "resourceId": "cred", "value": 50 },
    { "type": "flagIs", "key": "met_fence", "value": true }
  ]
}
```

## 8. Effects
Reveal effects: `revealBranch`, `revealScenario`, `revealResource`, `revealRole`, `revealTab`.
Capability effects: `unlockScenario`.
State effects: `setFlag`, `incFlagCounter`, `logMessage`, `showModal`.
Examples:
```json
{ "type": "revealBranch", "branchId": "finance" }
{ "type": "unlockScenario", "scenarioId": "laundering" }
```

### Visibility States (branches and scenarios only)
- **Unrevealed**: the player has no knowledge of it; completely hidden.
- **Revealed**: the player can see it exists (e.g. a branch tab appears, a job shows in the list) but cannot interact with it yet.
- **Unlocked**: the player can see it and use it.
- Variants have no locked-but-visible state; they are either visible+unlocked or hidden entirely.

## 9. Engine Rules (non-negotiable)
- No custom per-scenario code; all behavior emerges from data.
- Heat never blocks actions; consequences are time-based, not permanent.
- Unlocking grants capability; revealing grants knowledge. This distinction applies to branches and scenarios only.
- The system must tolerate content being incomplete or hidden.
- Engine validation for `Engine.startRun(scenarioId, variantId, assignedStaffIds, orderOverride, runsLeft)`:
  - All required roles filled.
  - Assigned crew meet star minimums and are available (not busy, not in jail).
  - Staff can only be assigned to matching roles.
  - The same crew member cannot be assigned twice.
  - `runsLeft` parameter (optional, defaults to `0`): specifies repeat behavior for this run.

## 10. Event-Driven Architecture
The Engine uses a publish-subscribe pattern for decoupled communication between Engine and UI layers.

### Event System Structure
```javascript
Engine.listeners = [];
Engine.on(event, callback);  // Subscribe to events
Engine.emit(event, data);    // Publish events
```

### Standard Events
- **tick**: Emitted every game tick (50ms intervals). UI uses this for smooth progress bar updates and countdown timers.
- **stateChange**: Emitted when game state changes (resources, flags, reveals, etc.). UI re-renders affected components.
- **runStarted**: Emitted when a new run begins. Payload: `{ run, scenario, variant }`.
- **runCompleted**: Emitted when a run finishes. Payload: `{ run, scenario, variant, outcome }`.
- **runCancelled**: Emitted when a run is cancelled. Payload: `{ run }`.
- **repeatStopped**: Emitted when repeat behavior is stopped via `stopRepeat()`. Payload: `{ run }`.
- **runsCompleted**: Emitted when runs array changes (completion, cancellation, or new run).
- **log**: Emitted when a new log entry is added. Payload: `{ logEntry }`.

### UI Integration Pattern
The UI subscribes to Engine events during initialization:
```javascript
UI.setupEngineEventListeners() {
  Engine.on('stateChange', () => { this.renderAll(); });
  Engine.on('tick', () => { this.updateProgressBars(); });
  Engine.on('runsCompleted', () => { this.renderAll(); });
  // ... other listeners
}
```

### Benefits
- **Decoupling**: Engine never directly calls UI methods; UI decides how to respond to events.
- **Efficiency**: Partial updates via tick events avoid full re-renders every frame.
- **Extensibility**: New listeners can be added without modifying Engine code.

## 11. Performance: Tick Interval and Smooth Updates
- **Tick interval**: 50ms (20 updates per second) for smooth countdown animations.
- **Auto-save**: Every 200 ticks (10 seconds at 50ms intervals).
- **Progress updates**: Text-based progress bars update on every tick event.
- **Duration display**: Shows tenths of seconds for durations under 1 minute (e.g., `45.3s`).

### Format Rules
- Days: `3d 12h`
- Hours: `2h 45m`
- Minutes: `5m 23.7s`
- Seconds: `12.4s`

## 12. Crew Composition Data Notes
- Staff requirements support required and optional roles via `required` boolean (default true for backward compatibility).
- Optional specialists provide strategic bonuses through modifiers; they are never strictly required.
- Role bonuses stack; trade-offs remain via crew opportunity cost.

## 13. Complete RPG Example (crew + modifiers)
```json
{
  "id": "jewelry_heist_smash",
  "name": "smash and grab",
  "description": "fast, loud, effective. pick two.",
  "requirements": {
    "staff": [
      { "roleId": "thief", "count": 1, "starsMin": 2, "required": true },
      { "roleId": "driver", "count": 1, "starsMin": 1, "required": true },
      { "roleId": "fixer", "count": 1, "starsMin": 0, "required": false, "bonus": "+5 cred, improved success rate" },
      { "roleId": "cleaner", "count": 1, "starsMin": 0, "required": false, "bonus": "-40% heat generation" }
    ]
  },
  "durationMs": 180000,
  "resolution": {
    "type": "weighted_outcomes",
    "outcomes": [
      { "id": "brute_force_success", "weight": 40, "outputs": { "resources": { "cash": 300 } }, "credDelta": -5, "heatDelta": 12, "effects": [] },
      { "id": "clean_success", "weight": 30, "outputs": { "resources": { "cash": 350 } }, "credDelta": 8, "heatDelta": 3, "effects": [] },
      { "id": "caught", "weight": 30, "outputs": {}, "credDelta": -20, "heatDelta": 15, "jail": { "durationMs": 86400000 }, "effects": [] }
    ]
  },
  "modifiers": [
    { "type": "staffStars", "roleId": "thief", "applyPerStar": { "outcomeWeightAdjustment": { "caught": -5, "clean_success": 5 } } },
    { "type": "staffRole", "roleId": "fixer", "effects": { "credDeltaBonus": 5, "outcomeWeightAdjustment": { "caught": -15, "clean_success": 15 } } },
    { "type": "staffRole", "roleId": "cleaner", "effects": { "heatDeltaMultiplier": 0.6 } }
  ]
}
```
Example implications:
- Brute force (2-star thief + 1-star driver): caught weight reduced to 20; clean success increased to 40; brute force 40. Probabilities: 20% caught, 40% clean, 40% brute force. Verdict: unsustainable, burns reputation.
- With fixer: caught 5; clean 55; brute force 40. Probabilities: 5% caught, 55% clean, 40% brute force. Verdict: builds reputation, moderate heat.
- Full team with cleaner: same probabilities; heat reduced via multiplier; sustainable long-term.
