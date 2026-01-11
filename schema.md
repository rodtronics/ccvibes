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
    "streetCred": 0,
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
      { "roleId": "runner", "count": 1, "starsMin": 0 }
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
    "resources": { "streetCred": 1 },
    "items": {}
  },
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
      "heatDelta": 6,
      "jail": { "durationMs": 43200000 },
      "effects": []
    }
  ]
}

10. MODIFIERS

Modifiers adjust resolution parameters before rolling.

Canonical modifier types:

heatAbove

heatBelow

staffStars

hasItem

flagIs

resourceGte

{
  "type": "staffStars",
  "roleId": "runner",
  "applyPerStar": {
    "caughtWeightDelta": -1,
    "luckyWeightDelta": 1
  }
}


Modifiers may only adjust numeric values.
They must not execute logic.

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
    { "type": "resourceGte", "resourceId": "streetCred", "value": 20 },
    { "type": "flagIs", "key": "met_fence", "value": true }
  ]
}

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
```
