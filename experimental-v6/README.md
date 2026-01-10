# Crime Committer VI - Experimental Schema-Compliant Build

This is a **clean-slate implementation** built entirely from `schema.md` and `design.md`.

## What This Is

A complete rewrite that:
- ✅ Implements the **Activity → Option → Run** model exactly as specified
- ✅ Uses the **canonical schema state structure** (schema.md section 1)
- ✅ Supports **weighted outcomes** with pre-rolled results
- ✅ Implements **staff XP & stars** with role-based progression
- ✅ Has **jail/unavailability** mechanics (staff temporarily out of action)
- ✅ Uses **conditions, modifiers, and effects** - no custom per-activity logic
- ✅ Separates **reveals** (knowledge) from **unlocks** (capability)
- ✅ Applies the **retrofuturistic terminal UI** aesthetic from design.md

## Architecture

### Files

- **`index.html`** - Terminal-themed UI structure with box-drawing characters
- **`style.css`** - Neon cyberpunk color palette, modular panel design
- **`engine.js`** - Pure data-driven engine, schema-compliant
- **`ui.js`** - UI rendering layer
- **`main.js`** - Initialization, game loop, sample content

### Key Differences from Main Build

| Aspect | Main Build | Experimental Build |
|--------|-----------|-------------------|
| Architecture | Crime-based, simplified | Activity → Option → Run |
| State Shape | Custom structure | Schema section 1 exact |
| Outcomes | Single deterministic | Weighted + ranged + deterministic |
| Progression | Basic XP counter | XP → Stars per role |
| Conditions | Simple role checks | Full condition system |
| Effects | Hardcoded unlocks | Data-driven effects |
| Jail | Not implemented | Time-based unavailability |
| Reveals | Mixed with unlocks | Separate reveal system |

## How to Use

1. Open `index.html` in a browser
2. You'll see the retrofuturistic terminal interface
3. Click **ACTIVITIES** → Select an activity → Choose an option → **START**
4. Watch runs progress in the **CREW** tab
5. Staff gain XP and stars after completing runs
6. Some options unlock only after meeting conditions (street cred, stars, etc.)

## Sample Content

The build includes 3 activities demonstrating key features:

### 1. **Panhandling** (Starter)
- Ranged outputs (1-5 cash)
- No requirements
- Low XP gain

### 2. **Shoplifting** (Core Example)
- **Two options:**
  - **Grab and Go**: 3 weighted outcomes (success/big score/caught)
  - **Coordinated Distraction**: Unlocks at 1 street cred, requires 1★
- Star-based modifiers (better stars = better odds)
- Can result in jail (30s unavailability)
- Reveals "Street Cred" resource on big score

### 3. **Street Dealing** (Locked)
- Visible at 2 street cred
- Unlocked at 5 street cred
- Requires input resources (cash: 20)
- Demonstrates resource transformation

## Schema Compliance

This build matches `schema.md` exactly:

- **State structure** (lines 45-96)
- **Staff with status/unavailableUntil** (lines 76-85, 98-104)
- **Runs with snapshot** (lines 229-246)
- **Resolution types** (lines 251-317)
- **Conditions** (lines 350-384)
- **Modifiers** (lines 319-348)
- **Effects** (lines 386-418)
- **Completions tracking** (lines 90-93)

## Design Compliance

Follows `design.md` visual guidelines:

- **Color palette**: Deep blacks, neon cyan/teal, terminal green, hot pink accents
- **Layout**: Box-drawing characters (┌─┐│└┘), modular panels
- **Typography**: Monospace only
- **Progress indicators**: Block-based bars with percentage
- **Status badges**: `[ACTIVE]`, `[LOCKED]` format
- **Animation**: Minimal, functional only (progress bars)
- **Hierarchy**: Bright colors for active, dimmed for inactive

## Console Commands

Open dev tools and try:

```javascript
resetGame()           // Clear save and restart
saveGame()            // Force save
Engine.state          // Inspect current state
Engine.content        // View loaded content
```

## Next Steps

To expand this:

1. **Add more content** in `main.js` → `SAMPLE_CONTENT`
2. **Create data files** - Move content to JSON files
3. **Implement tech nodes** - Add research activities with effects
4. **Add more roles** - Create specialized crew with unique XP curves
5. **Build UI for hiring** - Add crew recruitment panel
6. **Expand branches** - Create commerce, tech, smuggling branches
7. **Add heat modifiers** - Make high heat affect outcome weights
8. **Implement buildings** - Add requirement checks for structures

## Philosophy

This build demonstrates that **all game behavior can emerge from data** with no custom per-activity code. Every mechanic is expressed through:

- Conditions (visibility, unlock requirements)
- Requirements (staff, items, buildings)
- Inputs (resource/item costs)
- Resolutions (deterministic, ranged, weighted outcomes)
- Modifiers (stars, heat, items adjust probabilities)
- Effects (reveals, unlocks, flags, logs)

The engine is **content-agnostic** - it doesn't know what "shoplifting" or "cash" means. It just processes data structures according to the schema rules.

---

**Status**: ✅ Fully functional, schema-compliant, ready for content authoring

**Tone**: dry, understated, cynical - never congratulatory
