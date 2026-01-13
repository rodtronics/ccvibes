# Crime Committer VI — Data Schema and Engine Rules

Purpose: single source of truth for data structures and engine behavior. All game content must be expressible here; no custom per-activity code. Pair with `01_design_philosophy.md` for intent and `02_ui_spec.md` for presentation.

## 0. Global Conventions
- IDs: stable string IDs; `snake_case` recommended; unique within each namespace. Examples: `activityId: shoplifting`, `optionId: shoplifting_grab_and_go`, `resourceId: dirtyMoney`, `roleId: thief`.
- Time: all durations are in milliseconds; all timestamps are Unix epoch milliseconds.
- All content is JSON-serialisable.

## 1. Runtime Game State (minimal shape)
```json
{
  "version": 6,
  "now": 0,
  "resources": {
    "cash": 0,
    "dirtyMoney": 0,
    "cleanMoney": 0,
    "cred": 50,
    "heat": 0,
    "notoriety": 0
  },
  "items": {},
  "flags": {},
  "reveals": {
    "branches": {},
    "activities": {},
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
        "unavailableUntil": 0
      }
    ]
  },
  "runs": [],
  "persistentOperations": [],
  "completions": {
    "activity": {},
    "option": {}
  },
  "log": []
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
  "activityId": "shoplifting",
  "optionId": "shoplifting_grab_and_go",
  "startedAt": 1700000000000,
  "endsAt": 1700000006000,
  "assignedStaffIds": ["s_001"],
  "runsLeft": 5,
  "snapshot": { "inputsPaid": {}, "roll": null, "plannedOutcomeId": null }
}
```

### runsLeft Values
- `0`: Single run (no repeat). This is the default for all runs.
- `N` (positive integer): Countdown mode. After this run completes, start another run with `runsLeft = N - 1`.
- `-1`: Infinite repeat. After this run completes, start another run with `runsLeft = -1`.

### Behavior
- On run completion, `checkRepeatQueue(run)` examines `run.runsLeft`.
- If `runsLeft === 0`, do nothing (single run completed).
- If `runsLeft > 0`, decrement by 1 and call `startRun(activityId, optionId, assignedStaffIds, order, newRunsLeft)`.
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
- Only available when `option.repeatable === true` (can be progression-gated at option level).
- Run-bound design allows multiple concurrent runs of the same option to each have independent repeat states.

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
- Option extension example:
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
  "name": "street",
  "description": "low stakes, high confidence",
  "order": 10,
  "ui": { "accent": "green" }
}
```

### Resource
Numeric counters; may be hidden until revealed.
```json
{ "id": "dirtyMoney", "name": "dirty money", "description": "money that feels slightly wet.", "revealedByDefault": false }
```
Special resources:
- **Cred (0–100, capped)**: starting ~50; gates crew recruitment and activity unlocks; fluctuates on success/failure; recoverable through low-risk jobs.
- **Heat (0+, uncapped)**: always positive; rises from crimes; decays over time (exponential); increases failure/discovery chances; never blocks actions directly.

### Item
Integer inventory counts.
```json
{ "id": "lockpick", "name": "lockpick", "description": "technically it is a hobby tool.", "stackable": true, "revealedByDefault": false }
```

### Role
Staff role definition with XP -> stars mapping.
```json
{
  "id": "thief",
  "name": "thief",
  "description": "handles doors, pockets, and ethics.",
  "xpToStars": [
    { "stars": 0, "minXp": 0 },
    { "stars": 1, "minXp": 100 },
    { "stars": 2, "minXp": 300 },
    { "stars": 3, "minXp": 700 }
  ],
  "revealedByDefault": false
}
```
Role archetypes:
- Core: thief (executor), driver (getaway/logistics), runner (starter), hacker (digital).
- Specialists (optional bonuses): fixer (cred specialist), cleaner (heat reduction), planner (success/precision).
- Reputation grinder roles: courier, lookout, consultant.

### Activity
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
  "options": []
}
```

### Option
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
    "items": [],
    "buildings": []
  },
  "inputs": { "resources": {}, "items": {} },
  "durationMs": 6000,
  "xpRewards": { "onComplete": 8 },
  "resolution": {},
  "modifiers": [],
  "cooldownMs": 0
}
```
- `repeatable` (optional, default false) controls whether repeat queue UI/behavior is available for this specific option. Set at option level for granular control.
- Staff requirements support `required` (default true) and optional slots; optional slots describe bonuses and are expressed via modifiers.

### Run (runtime instance)
```json
{
  "runId": "r_001",
  "activityId": "shoplifting",
  "optionId": "shoplifting_grab_and_go",
  "startedAt": 1700000000000,
  "endsAt": 1700000006000,
  "assignedStaffIds": ["s_001"],
  "runsLeft": 0,
  "snapshot": { "inputsPaid": {}, "roll": null, "plannedOutcomeId": null }
}
```
- `runsLeft`: Unified repeat field. `0` = single run, `N` = repeat N more times after this, `-1` = infinite repeat.
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
  "inputs": { "resources": { "dirtyMoney": 200 }, "items": { "fakeID": 1 } },
  "effects": [
    { "type": "revealActivity", "activityId": "laundering" },
    { "type": "unlockOption", "activityId": "laundering", "optionId": "shell_shuffle" }
  ]
}
```

## 5. Resolution Types
### Deterministic
```json
{
  "type": "deterministic",
  "outputs": { "resources": { "cash": 50 }, "items": {} },
  "credDelta": 2,
  "heatDelta": 1,
  "effects": []
}
```
### Ranged Outputs
```json
{
  "type": "ranged_outputs",
  "outputs": { "resources": { "dirtyMoney": { "min": 20, "max": 60 } } },
  "items": {},
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
    { "id": "ok", "weight": 70, "outputs": { "resources": { "dirtyMoney": 40 } }, "items": {}, "credDelta": 3, "heatDelta": 2, "effects": [] },
    { "id": "lucky", "weight": 20, "outputs": { "resources": { "dirtyMoney": 120 } }, "items": {}, "credDelta": 8, "heatDelta": 1, "effects": [{ "type": "revealActivity", "activityId": "fencing_goods" }] },
    { "id": "caught", "weight": 10, "outputs": {}, "items": {}, "credDelta": -20, "heatDelta": 6, "jail": { "durationMs": 43200000 }, "effects": [] }
  ]
}
```

## 6. Modifiers
Modifiers adjust resolution parameters before rolling; they stack additively and apply before outcome selection.

### Canonical Modifier Types
- Environment-based: `heatAbove`, `heatBelow`, `flagIs`, `resourceGte`, `hasItem`.
- Crew-based: `staffStars`, `staffRole`, `staffCount`.

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

Design principle: modifiers only adjust numeric values; they do not execute logic or mutate state directly.

## 7. Conditions (visibleIf/unlockIf)
Atomic types: `flagIs`, `resourceGte`, `itemGte`, `roleRevealed`, `activityRevealed`, `staffStarsGte`, `activityCompletedGte`.
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
Reveal effects: `revealBranch`, `revealActivity`, `revealResource`, `revealRole`, `revealTab`.
Capability effects: `unlockActivity`, `unlockOption`.
State effects: `setFlag`, `incFlagCounter`, `logMessage`.
Examples:
```json
{ "type": "revealBranch", "branchId": "finance" }
{ "type": "unlockOption", "activityId": "laundering", "optionId": "shell_shuffle" }
```

## 9. Engine Rules (non-negotiable)
- No custom per-activity code; all behavior emerges from data.
- Heat never blocks actions; consequences are time-based, not permanent.
- Unlocking grants capability; revealing grants knowledge.
- The system must tolerate content being incomplete or hidden.
- Engine validation for `Engine.startRun(activityId, optionId, assignedStaffIds, orderOverride, runsLeft)`:
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
- **runStarted**: Emitted when a new run begins. Payload: `{ run, activity, option }`.
- **runCompleted**: Emitted when a run finishes. Payload: `{ run, activity, option, outcome }`.
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
