# Main Build vs Experimental Build Comparison

## File Structure

### Main Build (Root)
```
mainGame.js     - 1574 lines, mixed concerns
style.css       - 470 lines
index.html      - 134 lines
data/           - JSON content files
```

### Experimental Build
```
engine.js       - Pure data-driven engine (schema-compliant)
ui.js           - Rendering & UI logic only
main.js         - Initialization & game loop
style.css       - Retrofuturistic terminal theme
index.html      - Terminal-styled structure
```

## Architecture Comparison

### Data Model

**Main Build:**
```javascript
state = {
  resources: { cash, heat },
  inventory: {},
  roster: [],           // mixed player + crew
  activeActivities: [], // simplified run tracking
  unlockedNodes: [],
  completedActivities: []
}
```

**Experimental Build:**
```javascript
state = {
  resources: { cash, dirtyMoney, cleanMoney, streetCred, heat, notoriety },
  items: {},
  flags: {},
  reveals: { branches, activities, resources, roles, tabs },
  crew: {
    staff: [{ id, name, roleId, xp, status, unavailableUntil }]
  },
  runs: [{ runId, activityId, optionId, startedAt, endsAt, assignedStaffIds, snapshot }],
  completions: { activity: {}, option: {} }
}
```

### Activity Execution

**Main Build:**
```
Crime → Start → Complete
- Simple 1:1 mapping
- Hardcoded reward application
- No options within activities
```

**Experimental Build:**
```
Activity → Option → Run → Completion
- Activities are UI containers
- Options are executable recipes
- Runs track individual executions with pre-rolled outcomes
- Full schema section 8 compliance
```

### Outcomes

**Main Build:**
```javascript
// Fixed rewards
crime.rewards = { cash: 100 }
crime.heat = 5
```

**Experimental Build:**
```javascript
// Deterministic
resolution: {
  type: "deterministic",
  outputs: { resources: { cash: 100 } },
  heatDelta: 5,
  effects: []
}

// Ranged
resolution: {
  type: "ranged_outputs",
  outputs: { resources: { cash: { min: 20, max: 60 } } },
  heatDelta: { min: 1, max: 3 }
}

// Weighted (with pre-roll)
resolution: {
  type: "weighted_outcomes",
  outcomes: [
    { id: "success", weight: 70, outputs: {...}, heatDelta: 2 },
    { id: "caught", weight: 30, outputs: {...}, jail: {...} }
  ]
}
```

### Staff Progression

**Main Build:**
```javascript
// No XP or progression system
crew.speedMultiplier = 1.5  // static value
crew.riskTolerance = 1.0     // static value
```

**Experimental Build:**
```javascript
// Dynamic XP → Stars
staff.xp = 150
role.xpToStars = [
  { stars: 0, minXp: 0 },
  { stars: 1, minXp: 100 },
  { stars: 2, minXp: 300 }
]
// Stars derived at runtime, affect outcome modifiers
```

### Conditions & Visibility

**Main Build:**
```javascript
// Manual checks scattered in code
if (isCrimeUnlocked(crime)) { ... }

function isCrimeUnlocked(crime) {
  const unlockers = index.crimeUnlockers[crime.id];
  return unlockers.some(nodeId => state.unlockedNodes.includes(nodeId));
}
```

**Experimental Build:**
```javascript
// Data-driven conditions
visibleIf: [
  { type: "resourceGte", resourceId: "streetCred", value: 2 }
]

unlockIf: [
  { type: "allOf", conds: [
    { type: "resourceGte", resourceId: "streetCred", value: 5 },
    { type: "flagIs", key: "met_fence", value: true }
  ]}
]

// Engine evaluates generically
Engine.checkConditions(option.visibleIf)
```

### Modifiers

**Main Build:**
```
Not implemented
```

**Experimental Build:**
```javascript
modifiers: [
  {
    type: "staffStars",
    roleId: "player",
    applyPerStar: {
      successWeightDelta: 5,
      caughtWeightDelta: -3
    }
  }
]
// Automatically adjusts outcome weights based on staff stars
```

### Effects

**Main Build:**
```javascript
// Hardcoded in completion logic
if (crime.rewards.unlockNodes) {
  unlockNodes(crime.rewards.unlockNodes);
}
```

**Experimental Build:**
```javascript
// Data-driven effects
effects: [
  { type: "revealActivity", activityId: "fencing" },
  { type: "setFlag", key: "met_fence", value: true },
  { type: "incFlagCounter", key: "shoplifts_completed" },
  { type: "logMessage", text: "discovered something", kind: "info" }
]
// Engine applies generically via applyEffects()
```

### Jail/Consequences

**Main Build:**
```
Not implemented
```

**Experimental Build:**
```javascript
// Outcome can jail staff
jail: { durationMs: 43200000 }  // 12 hours

// Staff becomes unavailable
staff.status = "unavailable"
staff.unavailableUntil = now + durationMs

// Auto-release when time expires
Engine.updateStaffAvailability()
```

### Discovery System

**Main Build:**
```
Mixed reveals and unlocks
- Activities revealed via tech nodes
- No separation of knowledge vs capability
```

**Experimental Build:**
```
Separate reveals and unlocks
- reveals: { branches, activities, resources, roles, tabs }
- visibleIf: conditions for knowledge
- unlockIf: conditions for capability
- Activity can be visible but locked
```

## UI/UX Comparison

### Visual Style

**Main Build:**
- Dark blue/teal palette
- Subtle gradients
- Modern clean aesthetic
- Rounded corners, soft shadows

**Experimental Build:**
- Black background with neon accents
- Cyberpunk terminal aesthetic
- Box-drawing characters (┌─┐)
- Sharp borders, high contrast
- Pulsing status indicators

### Layout

**Main Build:**
- Tab-based with panels
- Activity list → Detail view
- Branch subtabs for filtering

**Experimental Build:**
- Same tab structure
- Terminal-themed panels
- Retrofuturistic readouts
- Progress bars with block characters
- Status badges `[ACTIVE]` `[LOCKED]`

## Code Quality

### Main Build
- ✅ Functional and working
- ✅ Clean code structure
- ✅ Good defensive programming
- ❌ Schema mismatch
- ❌ Missing core features (weighted outcomes, jail, modifiers, conditions)
- ❌ Mixed concerns (data + logic)

### Experimental Build
- ✅ 100% schema compliant
- ✅ Pure data-driven engine
- ✅ All schema features implemented
- ✅ Separation of concerns (engine/ui/main)
- ✅ Design.md aesthetic compliance
- ✅ Ready for content authoring
- ❌ Less polished (sample content only)
- ❌ No JSON data files yet

## Performance

Both builds are lightweight and perform well. The experimental build has slightly more computation due to:
- Condition evaluation on every render
- Modifier application on outcome rolls
- Effect processing
- XP → Stars derivation

But this is negligible for the game scale.

## Extensibility

### Main Build
**Hard to extend with:**
- Multiple options per activity
- Probabilistic outcomes
- Discovery mechanics
- Complex conditions
- Staff progression

**Would require:**
- Significant refactoring
- Schema alignment
- Feature rewrites

### Experimental Build
**Easy to extend with:**
- ✅ New activities/options (just JSON)
- ✅ New outcome types (engine handles)
- ✅ New condition types (add to evalCondition)
- ✅ New effect types (add to applyEffects)
- ✅ New modifier types (add to applyModifier)
- ✅ Content-driven progression

**Just add data:**
```javascript
// No code changes needed for 90% of content
activities.push({
  id: "new_activity",
  options: [...]
})
```

## Recommendation

### Use Main Build If:
- You want a simpler game
- Current feature set is sufficient
- You prefer the cleaner aesthetic
- You're okay with the schema mismatch

### Use Experimental Build If:
- You want the full schema vision
- You need weighted outcomes & progression
- You want discovery mechanics
- You prefer retrofuturistic aesthetic
- You want to author content via data

### Hybrid Approach:
- Port experimental engine to main build
- Keep main build's aesthetic
- Get schema compliance + current UX

---

**Bottom line**: Experimental is architecturally superior and schema-compliant, but main build is more polished. Your choice depends on your vision for the game's complexity and scope.
