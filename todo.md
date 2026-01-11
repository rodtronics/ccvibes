and agent can ADD to this but CANNOT edit what is already here. this is for me to add my ideas into, as I am sometimes thinking of ideas fastedr than AI can implement them.

I dont like the | in between the % and the time left. its not like that on the activites screen but it is still like that on the crew/active runs window

need a way to buy crew .

settings should come after log.. in fact can settings be right aligned?

## Passive Crimes / Persistent Operations System

Implement passive income mechanics like "Install Skimmer" - crimes that generate ongoing effects over time rather than single completion rewards.

**Skimmer Example:**

- Activity: "Install Card Skimmer" (one-time installation crime)
- Once installed, creates a persistent "active skimmer" state
- Generates passive events with three possible outcomes:
  1. **Success**: Random cash reward generated at intervals
  2. **Removed**: Skimmer discovered and removed (ends passive income)
  3. **Compromised**: Removed + heat increase

**Design Considerations:**

- How to represent "active installations" in state (separate from runs)
- Tick-based or time-based passive reward checks
- Risk factors: heat level affects discovery chance
- Maintenance/monitoring options to extend lifespan
- Visual indication of active passive operations
- Limit on number of concurrent passive operations
- Different passive operation types (skimmers, drops, lookouts, etc.)

**Schema Requirements:**

- New state object for active persistent operations
- Option flag for "creates persistent operation" vs "one-time completion"
- Passive outcome tables (similar to weighted outcomes but time-triggered)
- Duration/lifespan mechanics
- Discovery/removal probability modifiers

---

## RPG Crew Selection Modal - Implementation Notes

**Added by AI - Crew selection interface for multi-person jobs**

The crew selection modal separates "what crime to commit" from "who commits it," enabling strategic crew composition.

**Key Components:**

1. **Modal Overlay** - Dims background, centers modal on screen
2. **Role Assignment Slots** - One per role requirement (required + optional)
3. **Crew Picker Dropdowns** - Filtered by role, shows availability
4. **Dynamic Outcome Calculator** - Updates probabilities as crew assigned
5. **Validation** - CONFIRM disabled until all required roles filled

**Engine Changes Needed:**

```javascript
// Current (auto-assigns crew):
Engine.startRun(activityId, optionId)

// New (explicit crew assignment):
Engine.startRun(activityId, optionId, assignedStaffIds)
// Where assignedStaffIds = ["s_001", "s_003", "s_007"]
```

**UI Flow:**

```
Option Card [COMMIT]
    ↓
Crew Selection Modal Opens
    ↓
User assigns required roles (THIEF, DRIVER)
    ↓
User optionally assigns specialists (FIXER, CLEANER)
    ↓
Expected outcomes update dynamically
    ↓
User clicks [CONFIRM]
    ↓
Run starts with selected crew
```

**Validation Logic:**
- Filter crew by role type
- Check star requirements (e.g., "THIEF 2★ minimum")
- Verify crew availability (not busy, not in jail)
- Prevent duplicate assignments (same person in multiple slots)
- Enable CONFIRM only when all required roles filled

**Visual States:**
- **Unfilled Required**: Red border, warning icon ⚠️
- **Filled Required**: Green border, checkmark ✓
- **Optional Empty**: Dim gray, no warning
- **Optional Filled**: Cyan border, shows bonus

**Outcome Display:**
Shows calculated probabilities based on modifiers from selected crew:
```
Probability: 15% caught, 85% success
CRED: -20 to +13  |  HEAT: +3 to +12
CASH: $0 to $350
```

Updates in real-time as crew members assigned/changed.
