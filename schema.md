📄 SCHEMA.md

# Crime Committer VI — Canonical Schema Reference

This document defines the **single source of truth** for all data structures used by Crime Committer VI.

All game content must be expressible using these schemas.
If a mechanic cannot be represented here, it must be redesigned.

The schema supports:

- Activity → Option → Run execution
- discovery / fog-of-systems
- probabilistic outcomes
- heat as pressure (no lockouts)
- jail as temporary staff unavailability
- data-driven conditions and effects

All content is JSON-serialisable.

---

## 0. GLOBAL CONVENTIONS

### IDs

- All entities use stable string IDs.
- `snake_case` recommended.
- IDs are unique within their namespace.

Examples:

- activityId: `shoplifting`
- optionId: `shoplifting_grab_and_go`
- resourceId: `dirtyMoney`
- roleId: `thief`

### Time

- All durations are in **milliseconds**.
- All timestamps are Unix epoch milliseconds.

---

## 1. RUNTIME GAME STATE

Canonical minimal runtime state shape.

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

  "repeatQueues": {},

  "persistentOperations": [],

  "completions": {
    "activity": {},
    "option": {}
  },

  "log": []
}

Staff Status

available

unavailable (e.g. jail)

Unavailability is always time-based.

### Repeat Queues

Repeat queues allow options to automatically restart after completion.

```json
"repeatQueues": {
  "activityId:optionId": {
    "remaining": 5,
    "total": 10
  },
  "another_activity:another_option": {
    "remaining": "infinite",
    "total": "infinite"
  }
}
```

**Key**: String in format `"activityId:optionId"`

**Fields**:
- `remaining`: Number of repeats left, or `"infinite"`
- `total`: Total repeats requested (for UI display), or `"infinite"`

**Behavior**:
- When a run completes, engine checks if a repeat queue exists for that activity:option
- If queue exists and `remaining > 0` (or `"infinite"`), automatically call `startRun()` with same parameters
- Decrement `remaining` if not infinite
- Remove queue when `remaining` reaches 0
- Stop queue if auto-restart fails (insufficient resources, no crew, etc.)

**UI Patterns**:
- User can set repeat count (1-999) or infinite (∞)
- Two-stage stop button prevents accidental dropping (forfeits progress)
- Shows progress: "REPEATING 3/10" or "∞ REPEATING"
- Only shown for activities/options where `meta.repeatable === true`

**Unlocking Repeat Functionality**:
- Not all activities support repeat queues
- Activity schema includes `meta.repeatable` boolean field
- Can be initially `false` and unlocked via flags/progression
- Provides gameplay progression and early-game pacing

### Persistent Operations

Persistent operations are ongoing activities that generate passive events over time, distinct from one-time runs.

**Example: Card Skimmer**
- Player completes "Install Card Skimmer" activity
- Creates a persistent operation entry in `persistentOperations` array
- Each tick/interval, engine checks for passive events
- May yield rewards, be discovered and removed, or increase heat

```json
"persistentOperations": [
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
]
```

**Fields**:
- `id`: Unique persistent operation ID
- `type`: Operation type (skimmer, drop, lookout, etc.)
- `installedAt`: Timestamp when operation began
- `lastCheckAt`: Last time operation was checked/processed
- `locationId`: Optional location/context identifier
- `discoveryChance`: Base probability per check of being discovered/removed
- `yieldChance`: Probability per check of generating reward
- `checkIntervalMs`: How often to process this operation

**Behavior**:
- Engine processes persistent operations on each tick
- When `now - lastCheckAt >= checkIntervalMs`, roll for events:
  1. **Yield**: Generate rewards (cash, items) based on `yieldChance`
  2. **Discovery**: Remove operation and optionally increase heat based on `discoveryChance`
  3. **Nothing**: Operation continues silently
- Modifiers affect chances (heat level increases discovery, upgrades reduce it)
- Operations removed when discovered or when player manually removes them

**Option Schema Extension**:
```json
{
  "id": "install_skimmer_campus",
  "name": "install skimmer at campus ATM",
  "createsPersistentOperation": {
    "type": "skimmer",
    "baseDiscoveryChance": 0.02,
    "baseYieldChance": 0.30,
    "checkIntervalMs": 60000,
    "yieldOutputs": {
      "resources": { "cash": { "min": 20, "max": 80 } }
    }
  }
}
```

**Design Notes**:
- Distinct from runs (no crew assignment after installation)
- Passive income mechanic for mid-to-late game
- Risk/reward balance via discovery chance
- Limited slots prevent infinite passive scaling
- Upgrades can improve yield/reduce discovery
- Different operation types for variety

2. BRANCH

Branches are UI groupings only.

{
  "id": "street",
  "name": "street",
  "description": "low stakes, high confidence",
  "order": 10,
  "ui": {
    "accent": "green"
  }
}

3. RESOURCE

Resources are numeric counters.

{
  "id": "dirtyMoney",
  "name": "dirty money",
  "description": "money that feels slightly wet.",
  "revealedByDefault": false
}

### Special Resources

**Cred (Reputation)**
- Range: 0-100 (capped)
- Starting value: 50
- Fluctuates based on success/failure
- Gates crew recruitment and activity unlocks
- Can be lost through failed operations
- Recovered through low-risk "reputation jobs"

**Heat (Police Attention)**
- Range: 0+ (uncapped, naturally decays)
- Always positive
- Increases from crimes (regardless of outcome)
- Decays over time using exponential formula
- High heat increases discovery chances
- Never blocks actions directly

4. ITEM

Items are integer inventory counts.

{
  "id": "lockpick",
  "name": "lockpick",
  "description": "technically it’s a hobby tool.",
  "stackable": true,
  "revealedByDefault": false
}

5. ROLE

Defines staff roles and XP → star mapping.

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

### Role Archetypes (RPG System)

**Core Roles** (Required for most operations):
- `thief` - Primary executor, handles physical tasks
- `driver` - Getaway specialist, logistics
- `runner` - Low-level grunt work, starter role
- `hacker` - Digital operations specialist

**Specialist Roles** (Optional, provide strategic bonuses):
- `fixer` - **Reputation specialist**
  - Improves cred gains
  - Shifts outcomes toward "clean" success
  - Unlocks higher-tier crew recruitment

- `cleaner` - **Heat reduction specialist**
  - Reduces heat generation (40-60% reduction)
  - Lowers passive operation discovery chance
  - Enables sustainable high-frequency operations

- `planner` - **Success rate specialist**
  - Improves outcome probabilities
  - May increase duration (more thorough = slower)
  - Shifts away from "brute force" outcomes

**Reputation Grinder Roles**:
- `courier` - Low-risk delivery jobs for cred recovery
- `lookout` - Passive cred gain, ties up crew for extended time
- `consultant` - Mid-tier cred building, requires moderate skill

**Design Notes:**
- Specialist roles are never strictly required
- They enable strategic depth without complexity gating
- Players discover optimal compositions through experimentation
- Role bonuses stack when multiple specialists are used
- Early game: Can't afford specialists (brute force only)
- Late game: Can field optimized teams (sustainable operations)

Stars are derived, never stored.

6. ACTIVITY

Activities are UI containers.
They never execute directly.

{
  "id": "shoplifting",
  "branchId": "street",
  "name": "shoplifting",
  "description": "you borrow something and forget to return it.",

  "meta": {
    "tags": ["crime", "starter"],
    "icon": "👜",
    "repeatable": true
  },

  "visibleIf": [],
  "unlockIf": [],

  "reveals": {
    "onReveal": [],
    "onUnlock": []
  },

  "options": []
}

**Repeatable Field:**
- `repeatable`: Boolean (optional, defaults to `false`)
- When `true`, shows repeat queue UI controls for all options in this activity
- When `false` or undefined, repeat controls are hidden
- Repeatable status can be unlocked via progression (e.g., flag conditions)

7. OPTION

Options are executable recipes.
Each Option creates a Run.

{
  "id": "shoplifting_grab_and_go",
  "name": "grab and go",
  "description": "confidence is the real disguise.",

  "visibleIf": [],
  "unlockIf": [],

  "requirements": {
    "staff": [
      {
        "roleId": "runner",
        "count": 1,
        "starsMin": 0,
        "required": true
      }
    ],
    "items": [],
    "buildings": []
  },

  "inputs": {
    "resources": {},
    "items": {}
  },

  "durationMs": 6000,

  "xpRewards": {
    "onComplete": 8
  },

  "resolution": {},

  "modifiers": [],

  "cooldownMs": 0
}

### Staff Requirements (RPG Crew Composition)

Staff requirements support both **required** and **optional** roles, enabling strategic crew composition.

**Required Roles:**
- Must be assigned to start the operation
- Typically the minimum viable crew (e.g., thief + driver)
- Validates before allowing commit

**Optional Roles:**
- Provide bonuses via modifiers when assigned
- Enable "brute force vs planned" gameplay
- Examples: fixer (cred specialist), cleaner (heat reduction), planner (success rate)

**Example: Multi-Person Heist**
```json
{
  "requirements": {
    "staff": [
      {
        "roleId": "thief",
        "count": 1,
        "starsMin": 2,
        "required": true
      },
      {
        "roleId": "driver",
        "count": 1,
        "starsMin": 1,
        "required": true
      },
      {
        "roleId": "fixer",
        "count": 1,
        "starsMin": 0,
        "required": false,
        "bonus": "improved reputation & success rate"
      },
      {
        "roleId": "cleaner",
        "count": 1,
        "starsMin": 0,
        "required": false,
        "bonus": "reduced heat generation"
      }
    ]
  }
}
```

**Staff Requirement Fields:**
- `roleId`: Role type identifier
- `count`: Number of crew needed
- `starsMin`: Minimum star rating required
- `required`: Boolean - must have to start (default: true for backward compat)
- `bonus`: UI hint describing optional role benefit

**Gameplay Implications:**
- **Brute force**: Use minimum required crew (fast, risky, high heat, low/negative cred)
- **Planned approach**: Add optional specialists (slower, safer, sustainable cred)
- **Progression**: Early game forces brute force, late game enables optimization
- **Trade-offs**: Opportunity cost (crew tied up) vs. improved outcomes

8. RUN (RUNTIME INSTANCE)

Created when an Option starts.

{
  "runId": "r_001",
  "activityId": "shoplifting",
  "optionId": "shoplifting_grab_and_go",
  "startedAt": 1700000000000,
  "endsAt": 1700000006000,
  "assignedStaffIds": ["s_001"],

  "snapshot": {
    "inputsPaid": {},
    "roll": null,
    "plannedOutcomeId": null
  }
}


Once chosen, plannedOutcomeId must not change.

9. RESOLUTION

Defines how an Option resolves.

A) Deterministic
{
  "type": "deterministic",
  "outputs": {
    "resources": { "cash": 50 },
    "items": {}
  },
  "credDelta": 2,
  "heatDelta": 1,
  "effects": []
}

B) Ranged Outputs
{
  "type": "ranged_outputs",
  "outputs": {
    "resources": {
      "dirtyMoney": { "min": 20, "max": 60 }
    },
    "items": {}
  },
  "credDelta": { "min": 1, "max": 5 },
  "heatDelta": { "min": 1, "max": 3 },
  "effects": []
}

C) Weighted Outcomes (Preferred)
{
  "type": "weighted_outcomes",
  "outcomes": [
    {
      "id": "ok",
      "weight": 70,
      "outputs": {
        "resources": { "dirtyMoney": 40 },
        "items": {}
      },
      "credDelta": 3,
      "heatDelta": 2,
      "effects": []
    },
    {
      "id": "lucky",
      "weight": 20,
      "outputs": {
        "resources": { "dirtyMoney": 120 },
        "items": {}
      },
      "credDelta": 8,
      "heatDelta": 1,
      "effects": [
        { "type": "revealActivity", "activityId": "fencing_goods" }
      ]
    },
    {
      "id": "caught",
      "weight": 10,
      "outputs": {
        "resources": {},
        "items": {}
      },
      "credDelta": -20,
      "heatDelta": 6,
      "jail": { "durationMs": 43200000 },
      "effects": []
    }
  ]
}

10. MODIFIERS

Modifiers adjust resolution parameters before rolling. They stack additively and are applied before outcome selection.

### Canonical Modifier Types

**Environment-Based:**
- `heatAbove` - Applies when heat exceeds threshold
- `heatBelow` - Applies when heat is below threshold
- `flagIs` - Applies when flag matches value
- `resourceGte` - Applies when resource meets minimum
- `hasItem` - Applies when item is in inventory

**Crew-Based (RPG System):**
- `staffStars` - Scales per star rating of assigned crew
- `staffRole` - Applies when specific role is assigned to run
- `staffCount` - Scales based on number of crew assigned

### Modifier Effects

Modifiers can adjust:
- **Outcome weights**: Shift probability distribution
- **Delta values**: Modify heat/cred changes
- **Multipliers**: Scale heat/cred by percentage
- **Success chances**: Direct probability adjustments

### Examples

**A) Star-Based Scaling**
```json
{
  "type": "staffStars",
  "roleId": "thief",
  "applyPerStar": {
    "outcomeWeightAdjustment": {
      "caught": -5,
      "clean_success": +5
    }
  }
}
```

**B) Role-Based Bonuses (Optional Specialists)**
```json
{
  "type": "staffRole",
  "roleId": "fixer",
  "effects": {
    "credDeltaBonus": 5,
    "outcomeWeightAdjustment": {
      "caught": -15,
      "clean_success": +15
    }
  }
}
```

**C) Heat Reduction Specialist**
```json
{
  "type": "staffRole",
  "roleId": "cleaner",
  "effects": {
    "heatDeltaMultiplier": 0.6,
    "discoveryChanceReduction": -0.15
  }
}
```

**D) Multi-Effect Modifier**
```json
{
  "type": "staffRole",
  "roleId": "planner",
  "effects": {
    "durationMultiplier": 1.2,
    "outcomeWeightAdjustment": {
      "brute_force_success": -20,
      "clean_success": +20
    },
    "credDeltaBonus": 3
  }
}
```

### Effect Types Reference

**Delta Adjustments** (additive):
- `credDeltaBonus`: Add to cred gain/loss
- `heatDeltaReduction`: Subtract from heat gain
- `outcomeWeightAdjustment`: Shift weight by outcome ID

**Multipliers** (multiplicative):
- `credDeltaMultiplier`: Scale final cred change (e.g., 1.5 = +50%)
- `heatDeltaMultiplier`: Scale final heat change (e.g., 0.6 = -40%)
- `durationMultiplier`: Scale operation time

**Special**:
- `discoveryChanceReduction`: Lower passive operation discovery chance

### Stacking Rules

1. **Multiple modifiers of same type**: Effects add together
2. **Delta bonuses**: Applied before multipliers
3. **Weight adjustments**: Sum all deltas, then clamp outcome weights to 0+
4. **Multipliers**: Applied after all additive adjustments
5. **Final values**: Cred clamped 0-100, heat clamped 0+

### Design Principles

- Modifiers may only adjust numeric values
- They must not execute logic or mutate state
- All effects must be data-driven and composable
- Optional specialists provide meaningful choices, not requirements

### Complete RPG Example: Jewelry Store Heist

This example demonstrates the full crew composition system with brute force vs. strategic planning outcomes.

```json
{
  "id": "jewelry_heist_smash",
  "name": "smash and grab",
  "description": "fast, loud, effective. pick two.",

  "requirements": {
    "staff": [
      {
        "roleId": "thief",
        "count": 1,
        "starsMin": 2,
        "required": true
      },
      {
        "roleId": "driver",
        "count": 1,
        "starsMin": 1,
        "required": true
      },
      {
        "roleId": "fixer",
        "count": 1,
        "starsMin": 0,
        "required": false,
        "bonus": "+5 cred, improved success rate"
      },
      {
        "roleId": "cleaner",
        "count": 1,
        "starsMin": 0,
        "required": false,
        "bonus": "-40% heat generation"
      }
    ]
  },

  "durationMs": 180000,

  "resolution": {
    "type": "weighted_outcomes",
    "outcomes": [
      {
        "id": "brute_force_success",
        "weight": 40,
        "outputs": { "resources": { "cash": 300 } },
        "credDelta": -5,
        "heatDelta": 12,
        "effects": []
      },
      {
        "id": "clean_success",
        "weight": 30,
        "outputs": { "resources": { "cash": 350 } },
        "credDelta": 8,
        "heatDelta": 3,
        "effects": []
      },
      {
        "id": "caught",
        "weight": 30,
        "outputs": {},
        "credDelta": -20,
        "heatDelta": 15,
        "jail": { "durationMs": 86400000 },
        "effects": []
      }
    ]
  },

  "modifiers": [
    {
      "type": "staffStars",
      "roleId": "thief",
      "applyPerStar": {
        "outcomeWeightAdjustment": {
          "caught": -5,
          "clean_success": +5
        }
      }
    },
    {
      "type": "staffRole",
      "roleId": "fixer",
      "effects": {
        "credDeltaBonus": 5,
        "outcomeWeightAdjustment": {
          "caught": -15,
          "clean_success": +15
        }
      }
    },
    {
      "type": "staffRole",
      "roleId": "cleaner",
      "effects": {
        "heatDeltaMultiplier": 0.6
      }
    }
  ]
}
```

**Outcome Scenarios:**

**Scenario A: Brute Force (2★ Thief + 1★ Driver only)**
- Caught weight: 30 - 10 (thief stars) = 20
- Clean success weight: 30 + 10 (thief stars) = 40
- Brute force weight: 40
- **Probabilities**: 20% caught, 40% clean, 40% brute force
- **If brute force**: -5 cred, +12 heat, $300
- **Verdict**: Unsustainable, burns reputation

**Scenario B: With Fixer (2★ Thief + 1★ Driver + Fixer)**
- Caught weight: 20 - 15 (fixer) = 5
- Clean success weight: 40 + 15 (fixer) = 55
- Brute force weight: 40
- **Probabilities**: 5% caught, 55% clean, 40% brute force
- **If clean**: 8 + 5 (fixer bonus) = +13 cred, +3 heat, $350
- **Verdict**: Builds reputation, moderate heat

**Scenario C: Full Team (2★ Thief + 1★ Driver + Fixer + Cleaner)**
- Weights same as Scenario B
- **Probabilities**: 5% caught, 55% clean, 40% brute force
- **If clean**: +13 cred, 3 × 0.6 (cleaner) = +2 heat, $350
- **Verdict**: Professional operation, sustainable long-term

**Strategic Implications:**
- Early game: Limited crew forces brute force approach
- Mid game: Can afford specialists, must choose which to prioritize
- Late game: Full teams enable sustainable criminal enterprise
- Risk/reward: High-cred players have more to lose from failures

11. CONDITIONS

Used by visibleIf and unlockIf.

Atomic condition types

flagIs

resourceGte

itemGte

roleRevealed

activityRevealed

staffStarsGte

activityCompletedGte

Logical wrappers

allOf

anyOf

not

{
  "type": "allOf",
  "conds": [
    { "type": "resourceGte", "resourceId": "cred", "value": 50 },
    { "type": "flagIs", "key": "met_fence", "value": true }
  ]
}

**Cred-Gated Examples:**
```json
{
  "type": "resourceGte",
  "resourceId": "cred",
  "value": 60,
  "description": "Requires 60+ reputation to unlock"
}

{
  "type": "allOf",
  "conds": [
    { "type": "resourceGte", "resourceId": "cred", "value": 40 },
    { "type": "staffStarsGte", "roleId": "thief", "stars": 2 }
  ],
  "description": "Requires 40+ cred and a 2-star thief"
}
```

12. EFFECTS

Effects mutate world state.

Reveal effects

revealBranch

revealActivity

revealResource

revealRole

revealTab

Capability effects

unlockActivity

unlockOption

State effects

setFlag

incFlagCounter

logMessage

{ "type": "revealBranch", "branchId": "finance" }

{ "type": "unlockOption", "activityId": "laundering", "optionId": "shell_shuffle" }

13. TECH NODE (OPTIONAL, DISCOVERY-ORIENTED)
{
  "id": "shell_companies",
  "name": "shell companies",
  "description": "paperwork that somehow weighs more than money.",

  "visibleIf": [],
  "unlockIf": [],

  "durationMs": 600000,

  "inputs": {
    "resources": { "dirtyMoney": 200 },
    "items": { "fakeID": 1 }
  },

  "effects": [
    { "type": "revealActivity", "activityId": "laundering" },
    { "type": "unlockOption", "activityId": "laundering", "optionId": "shell_shuffle" }
  ]
}

14. ENGINE RULES (NON-NEGOTIABLE)

No custom per-activity code.

All behaviour must emerge from data.

Heat never blocks actions.

Consequences are time-based, not permanent.

Unlocking grants capability; revealing grants knowledge.

The system must tolerate content being incomplete or hidden.

**Cred & Heat Philosophy:**

Cred (0-100, fluctuating):
- Represents professional reputation
- Goes up on success, down on failure
- Loss scales with current cred (more to lose when high)
- Gain scales with risk taken (bigger rewards for bigger jobs)
- Gates crew recruitment and activity access
- Can always be recovered through low-risk "reputation jobs"
- Creates strategic choice: risk reputation for big score?

Heat (0+, decaying):
- Represents police attention
- Always increases from crimes (even successful ones)
- Naturally decays over time (exponential formula)
- Never blocks actions directly
- Increases failure chances and discovery rates
- Punishment is indirect (higher risk) not lockout

**RPG Crew Composition Philosophy:**

Brute Force (early game):
- Minimal crew (only required roles)
- Fast execution
- High heat generation
- Negative or minimal cred gain
- Unsustainable long-term

Strategic Planning (late game):
- Optimized teams with specialists
- Slower execution (more thorough)
- Manageable heat levels
- Positive cred gains
- Sustainable criminal enterprise

**Core Loop:**
1. Early: Forced to brute force (limited crew)
2. Build cred through successes (unlock better crew)
3. Fail occasionally (lose cred, learn from mistakes)
4. Recover through reputation jobs (tie up crew for safety)
5. Invest in specialists (enable strategic operations)
6. Late: Balance risk/reward with optimized teams

15. UI DISPLAY RULES

## Resolution Display

When displaying options to the player, show expected rewards based on resolution type:

**Deterministic:**
Show exact value: `$100`

**Ranged Outputs:**
Show range: `$20-60`

**Weighted Outcomes:**
Show range across all outcomes: `$0-120` (min of all outcomes to max)

## Active Run Display

When viewing an activity's detail page, display:

- All currently running instances of that activity's options
- Progress bar showing elapsed/remaining time
- Assigned staff members
- Option name being executed

This provides immediate feedback that operations are in progress without requiring navigation to a separate runs panel.

## Resource Display Format

Resources should display:
- Name (formatted from camelCase to Title Case)
- Current amount (formatted with locale separators)
- Only show resources that are revealed via `reveals.resources`

## Staff Display Format

Staff should display:
- Name
- Role
- XP value
- Stars (derived from XP, displayed as ★ symbols)
- Status: `[AVAILABLE]` `[BUSY]` `[UNAVAILABLE]`

Stars are never stored, always computed from XP thresholds at display time.

## Crew Selection Interface

When committing to an operation with staff requirements, a crew selection modal/panel must be displayed.

**Interaction Flow:**
1. User clicks "COMMIT" button on option card
2. Crew selection modal opens
3. User assigns crew members to required roles
4. User optionally assigns specialists to optional roles
5. Modal shows updated outcome probabilities based on selected crew
6. User clicks "CONFIRM" to start run with selected crew
7. Modal closes, run begins

**Modal Structure:**

**Header:**
- Activity name
- Option name
- Option description

**Required Roles Section:**
- One row per required role
- Shows: Role name, star requirement, [SELECT] button
- Displays currently selected crew member (or "None Selected")
- Visually distinct (red/warning if unfilled)
- Must be filled before CONFIRM is enabled

**Optional Roles Section:**
- One row per optional role
- Shows: Role name, bonus description, [SELECT] button
- Displays currently selected crew member (or "None")
- Visually distinct from required (dim/secondary styling)
- Can be left empty

**Crew Picker Dropdown (when [SELECT] clicked):**
- Lists all crew members with matching role
- Filters by role type
- Shows for each crew member:
  - Name
  - Star rating (★★★)
  - Status indicator
  - Availability (if unavailable, show return time)
- Only shows available crew as selectable
- Grays out busy/unavailable crew with reason
- Sorted: Available first, then by star rating descending

**Expected Outcome Section:**
- Shows probability distribution with current crew
- Displays cred range: `CRED: -20 to +13`
- Displays heat range: `HEAT: +2 to +15`
- Updates dynamically as crew is assigned
- Uses modifier calculations to show accurate outcomes

**Footer:**
- [CANCEL] button - closes modal without starting run
- [CONFIRM] button - starts run with assigned crew
  - Disabled if required roles unfilled
  - Disabled if assigned crew doesn't meet star requirements
  - Enabled once all requirements satisfied

**Engine Method:**
```javascript
Engine.startRun(activityId, optionId, assignedStaffIds)
// assignedStaffIds: ["s_001", "s_003", "s_007"]
```

**Validation Rules:**
- All required roles must be filled
- Assigned crew must meet minimum star requirements
- Assigned crew must be available (not busy, not in jail)
- Crew can only be assigned to roles they possess
- Same crew member cannot be assigned to multiple slots

**UI States:**
- **Empty**: No crew assigned, CONFIRM disabled
- **Partial**: Some required filled, CONFIRM disabled
- **Valid**: All required filled, CONFIRM enabled
- **Optimized**: All roles (including optional) filled

**Visual Feedback:**
- Required role slots: Red/warning border when empty
- Optional role slots: Dim border, secondary color
- Selected crew: Highlighted, shows name and stars
- Updated probabilities: Color-coded (green for good, red for bad)
- CONFIRM button: Disabled state clearly visible
```
