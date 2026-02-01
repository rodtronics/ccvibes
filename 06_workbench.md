# Crime Committer VI — Workbench Documentation

Purpose: single source of truth for the game's content authoring tool. Describes architecture, data flow, and usage patterns for the unified workbench interface.

## 1. Overview

The Workbench is a single-page web application for designing, editing, and managing all game content. It replaces the original separate builders (activity builder, resource designer, branch designer, progression designer) with a unified interface.

**Location**: `data-builder/workbench.html`
**Server**: `data-builder/server.js` (serves data files via REST API)
**Data Files**: All content stored in `data/*.json`

### Key Features
- **Unified Interface**: Single tool for all content authoring (activities, resources, branches, roles, perks, modals)
- **Live Editing**: Changes are immediately reflected in the editor
- **Multi-tab Layout**: Workshop, Map, Economy, World tabs for different content types
- **Real-time Validation**: Visual feedback for data completeness and errors
- **Cross-reference Support**: Entity pickers for activities, resources, roles with live lookup
- **Dirty Tracking**: Clear indication of unsaved changes per file
- **Multi-tab Sync**: Cross-tab state sync via localStorage for multi-window editing

## 2. Architecture

### ES6 Module Structure
```
data-builder/
  workbench.html          ← main entry point
  server.js               ← local dev server with REST API
  hub-storage.js          ← cross-tab sync via localStorage

  js/
    app.js                ← boot sequence, initialization
    state.js              ← central store + event bus + lookup maps
    data-io.js            ← REST API client (fetch/save)
    models.js             ← factory functions for entities
    utils.js              ← safe(), kvToObject(), etc.

    tabs/
      workshop.js         ← activity editor (main tab)
      map.js              ← progression graph canvas
      economy.js          ← resource + flow table
      world.js            ← branches, roles, perks, modals

    components/
      sidebar.js          ← navigator tree + minimap
      tab-bar.js          ← tab switching
      condition-editor.js ← reusable condition builder
      effect-editor.js    ← reusable effect builder

  css/
    tokens.css            ← CSS custom properties
    layout.css            ← shell, sidebar, tabs
    components.css        ← shared component styles
    workshop.css          ← workshop-specific styles
    map.css
    economy.css
    world.css
```

### Central Data Store (state.js)
All tabs read/write from a single reactive store:

```javascript
export const store = {
  // Raw data arrays from server
  activities: [],
  resources: [],
  branches: [],
  roles: [],
  perks: {},
  modals: [],

  // Lookup maps (rebuilt on load/mutation)
  resourceMap: new Map(),
  branchMap: new Map(),
  roleMap: new Map(),
  activityMap: new Map(),
  modalMap: new Map(),

  // Editor state
  selectedActivityId: null,
  selectedResourceId: null,
  selectedBranchId: null,
  selectedModalId: null,

  // Dirty tracking per file
  dirty: {
    activities: false,
    resources: false,
    branches: false
  },

  // Last saved snapshots for change detection
  savedSnapshots: {
    activities: null,
    resources: null,
    branches: null
  },

  // Server status
  serverOnline: false,
  loaded: false
};
```

### Event Bus
Components communicate via named events:
- `data-loaded`: Fired when all JSON loaded from server
- `activity-selected`: User selected an activity to edit
- `resource-selected`: User selected a resource
- `activity-changed`: Activity data modified
- `save-complete`: File successfully saved to server

## 3. Tab Descriptions

### Workshop Tab (tabs/workshop.js)
**Purpose**: Primary activity editor - design crimes, their options, outcomes, and effects.

**Sections**:
1. **Identity**: Name, ID, branch, icon, tags, description
2. **Placement**: Visibility/unlock conditions and effects (onReveal, onUnlock)
3. **Options**: Execution methods with:
   - Basic properties (name, description, staff requirements, duration)
   - Input/output resources
   - Resolution types (deterministic, ranged, weighted outcomes)
   - Effects (reveal branches/activities, set flags, show modals, log messages)
   - Cooldowns and repeatability
4. **Balance Preview**: Resource flow analysis across all options

**Key Features**:
- **Collapsible Options**: Click option header to collapse/expand for space management
- **Entity Pickers**: Dropdowns for resources, roles, activities with live lookup
- **Effect System**: Unified effect editor with type-specific fields
- **Difficulty Ranking**: Visual indicators for option complexity (time, resources, heat)
- **Inline Neighborhood Graph**: Shows 5-7 nodes directly connected to current activity

### Map Tab (tabs/map.js)
**Purpose**: Visual progression graph using force-directed layout.

**Features**:
- Pan/zoom canvas with mouse/touch
- Activity nodes colored by branch
- Connection lines show prerequisites
- Double-click node → switches to Workshop tab with that activity loaded
- Auto-layout using force simulation (d3-like physics)

### Economy Tab (tabs/economy.js)
**Purpose**: Resource management and flow analysis.

**Features**:
- Resource list with category grouping (currency, equipment, intel, reputation, risk)
- Resource editor with properties:
  - Basic: name, description, category
  - Visibility: `revealedByDefault`, `branchId`
  - Behavior flags: `discrete` (whole numbers only), `singular` (max 1), `persistent` (never consumed)
- **Resource Flow Table**: Cross-reference showing which activities produce/consume each resource

### World Tab (tabs/world.js)
**Purpose**: Supporting game systems - branches, roles, perks, modals.

**Four-column layout**:

1. **Branches**: Crime progression trees (street, drugs, grift, corruption, tech, forbidden, commerce, primordial)
2. **Roles**: Crew member types with XP-to-stars curves and perk choices
3. **Perks**: Passive bonuses and modifiers unlocked via role progression
4. **Modals**: Fullscreen story/tutorial popups with color formatting

**Modal System**:
- Border/background styling (Palette.js color keys)
- Body text supports color markup: `{{color}}text{{/}}`, `{{gradient:a:b:X}}text{{/}}`
- Types: `story` (double border, cyan), `lesson` (single border, yellow)
- `showOnce` flag for one-time displays
- Queue system for sequential display

## 4. Data Files and Schemas

### activities.json
Array of activity objects:
```json
{
  "id": "shoplifting",
  "name": "Shoplifting",
  "branch": "street",
  "description": "Steal from stores",
  "tags": ["theft", "petty"],
  "visibleIf": [],
  "unlockIf": [],
  "onReveal": [],
  "onUnlock": [],
  "options": [
    {
      "id": "grab_and_go",
      "name": "Grab and Go",
      "description": "Quick theft",
      "duration": 5000,
      "staff": { "runner": { "min": 1, "max": 1 } },
      "inputs": { "cash": 0 },
      "resolution": {
        "type": "deterministic",
        "outputs": { "cash": 10, "heat": 5 },
        "credDelta": { "street": 2 },
        "heatDelta": 5,
        "effects": []
      },
      "repeatable": true,
      "cooldown": 0
    }
  ]
}
```

### resources.json
Array of resource objects:
```json
{
  "id": "cash",
  "name": "Cash",
  "description": "Money for buying things",
  "category": "currency",
  "revealedByDefault": true,
  "discrete": false,
  "singular": false,
  "persistent": false,
  "branchId": null
}
```

**Behavior Flags**:
- `discrete`: Whole numbers only (no decimals)
- `singular`: Maximum quantity of 1
- `persistent`: Never consumed, permanent acquisition

### branches.json
Array of branch objects:
```json
{
  "id": "street",
  "name": "Street",
  "color": "#f87171",
  "description": "Petty crime and hustling",
  "revealedByDefault": true
}
```

### roles.json
Array of role objects:
```json
{
  "id": "player",
  "name": "mastermind",
  "description": "you.",
  "xpToStars": [0, 100, 300, 600, 1000, 1500],
  "perkChoices": [],
  "revealedByDefault": true
}
```

### perks.json
Object mapping perk IDs to perk definitions:
```json
{
  "faster_hands": {
    "name": "Faster Hands",
    "description": "Reduce activity duration by 10%",
    "effects": []
  }
}
```

### modals.json
Array of modal objects:
```json
{
  "id": "intro",
  "title": "",
  "body": "{{gradient:intro_a:intro_b:0.5}}CRIME COMMITTER{{/}}",
  "type": "story",
  "showOnce": false,
  "borderColor": "BLACK",
  "borderStyle": "DOUBLE",
  "backgroundColor": "BLACK"
}
```

**Color Formatting** (in `body` field):
- `{{color}}text{{/}}` → colored text (Palette.js color keys, lowercase)
- `{{gradient:colorA:colorB:X}}text{{/}}` → gradient interpolation (X = 0.0 to 1.0)
- `**text**` → bold (WHITE)
- `~~text~~` → dim (DIM_GRAY)

**Border/Background Colors**: Use Palette.js keys (e.g., `BLACK`, `NEON_CYAN`, `HOT_PINK`, `TERMINAL_GREEN`)

## 5. Condition and Effect System

### Conditions (visibleIf, unlockIf)
Control when activities/resources become visible or unlockable.

**Types**:
- `hasResource`: Check resource quantity
  ```json
  { "type": "hasResource", "resourceId": "cash", "min": 100 }
  ```
- `hasFlag`: Check flag value
  ```json
  { "type": "hasFlag", "key": "tutorial_complete", "value": true }
  ```
- `completedActivity`: Check activity completion count
  ```json
  { "type": "completedActivity", "activityId": "shoplifting", "min": 5 }
  ```
- `branchRevealed`: Check if branch is revealed
  ```json
  { "type": "branchRevealed", "branchId": "drugs" }
  ```

### Effects (onReveal, onUnlock, option.resolution.effects)
Trigger when conditions are met or activities complete.

**Types**:
- `revealBranch`: Unlock a progression tree
  ```json
  { "type": "revealBranch", "branchId": "drugs" }
  ```
- `revealActivity`: Make activity visible
  ```json
  { "type": "revealActivity", "activityId": "drug_dealing" }
  ```
- `revealResource`: Show resource in UI
  ```json
  { "type": "revealResource", "resourceId": "intel" }
  ```
- `revealRole`: Unlock crew role
  ```json
  { "type": "revealRole", "roleId": "dealer" }
  ```
- `revealTab`: Unlock UI tab
  ```json
  { "type": "revealTab", "tabId": "crew" }
  ```
- `unlockActivity`: Make activity playable (distinct from reveal)
  ```json
  { "type": "unlockActivity", "activityId": "heist" }
  ```
- `setFlag`: Set flag to value
  ```json
  { "type": "setFlag", "key": "tutorial_complete", "value": true }
  ```
- `incFlagCounter`: Increment flag counter
  ```json
  { "type": "incFlagCounter", "key": "shoplifting_count" }
  ```
- `logMessage`: Add message to game log
  ```json
  { "type": "logMessage", "text": "You found a clue!", "kind": "info" }
  ```
- `showModal`: Display fullscreen modal
  ```json
  { "type": "showModal", "modalId": "first_cash" }
  ```

## 6. Resolution Types

Options can resolve in three ways:

### 1. Deterministic
Fixed outputs every time.
```json
{
  "type": "deterministic",
  "outputs": { "cash": 10 },
  "credDelta": { "street": 2 },
  "heatDelta": 5,
  "effects": []
}
```

### 2. Ranged Outputs
Random range for each resource.
```json
{
  "type": "ranged_outputs",
  "outputs": {
    "cash": { "min": 5, "max": 15 },
    "heat": { "min": 0, "max": 10 }
  },
  "credDelta": { "street": { "min": 1, "max": 3 } },
  "heatDelta": { "min": 0, "max": 5 },
  "effects": []
}
```

### 3. Weighted Outcomes
Choose one outcome from weighted table.
```json
{
  "type": "weighted_outcomes",
  "outcomes": [
    {
      "id": "success",
      "weight": 70,
      "outputs": { "cash": 20 },
      "credDelta": { "street": 3 },
      "heatDelta": 0,
      "jail": false,
      "effects": []
    },
    {
      "id": "caught",
      "weight": 30,
      "outputs": {},
      "credDelta": {},
      "heatDelta": 50,
      "jail": true,
      "jailDuration": 30000,
      "effects": [
        { "type": "logMessage", "text": "You got caught!", "kind": "danger" }
      ]
    }
  ]
}
```

## 7. Workflow

### Typical Workflow for Creating Content

1. **Start Server**: `npm run dev:builder` (runs on port 3177)
2. **Open Workbench**: `http://localhost:3177/workbench.html`
3. **Create Activity**:
   - Click "+ Activity" in sidebar
   - Fill in Identity section (name, branch, description)
   - Add placement conditions (visibleIf, unlockIf)
   - Add execution options
   - Configure option inputs/outputs/resolution
   - Add effects (reveals, flags, modals)
   - Save
4. **Test in Map**: Switch to Map tab to visualize progression
5. **Check Balance**: Use Economy tab's Resource Flow Table to verify economy
6. **Create Supporting Content**: Add resources, modals, perks as needed in World tab
7. **Iterate**: Edit, save, test in game

### Keyboard Shortcuts
- **Tab 1-4**: Switch between Workshop/Map/Economy/World
- **Ctrl+S**: Save current tab's data
- **Ctrl+N**: Create new entity (context-dependent)

### Cross-tab Sync
- Multiple workbench tabs can be open simultaneously
- Changes sync via `hub-storage.js` using localStorage
- Broadcast events: `saved`, `changed`
- Auto-refresh on external save

## 8. Integration with Game Engine

### Engine Data Loading
Engine loads from same JSON files via fetch:
```javascript
const files = [
  ["activities.json", "activities"],
  ["resources.json", "resources"],
  ["branches.json", "branches"],
  ["roles.json", "roles"],
  ["perks.json", "perks"],
  ["modals.json", "modals"]
];
```

### Modal Queue Integration
Engine accepts `modalQueue` in constructor:
```javascript
const modalQueue = new ModalQueue();
const engine = new Engine(modalQueue);
```

Effects with `type: "showModal"` enqueue modals for display after activity completion.

### Condition Evaluation
Conditions are evaluated in `Engine.evaluateCondition()` using current game state.

### Effect Application
Effects are applied in `Engine.applyEffects()` after activity completion or unlock events.

## 9. Best Practices

### Content Design
- **IDs**: Use `snake_case`, descriptive names (e.g., `street_shoplifting_grab_and_go`)
- **Branches**: Group related activities under same branch for coherent progression
- **Balance**: Use Economy tab to verify resource flows aren't broken
- **Flags**: Prefer flags over resource checks for story progression
- **Modals**: Keep body text concise, use color sparingly for emphasis
- **Effects**: Chain reveals progressively (don't reveal everything at once)

### Technical
- **Save Often**: No auto-save, must manually save each file type
- **Test Conditions**: Verify visibleIf/unlockIf in game before finalizing
- **Check Console**: Browser console shows validation errors/warnings
- **Backup Data**: JSON files are version-controlled, commit before major changes
- **Validate JSON**: Server returns 400 on invalid JSON, check syntax

### Performance
- **Lookup Maps**: Always use `store.activityMap.get(id)` instead of `store.activities.find()`
- **Render Throttling**: Heavy operations like Map tab force-layout are throttled
- **Focus Preservation**: Form inputs preserve focus during re-renders via `data-focus-id`

## 10. Troubleshooting

### Common Issues

**Server not responding**:
- Check `npm run dev:builder` is running
- Verify port 3177 is not in use
- Check browser console for CORS/fetch errors

**Changes not saving**:
- Check "Server Online" indicator in sidebar
- Verify file permissions in `data/` directory
- Check server console for write errors

**Data not loading**:
- Verify JSON syntax (use JSONLint)
- Check server console for parse errors
- Verify file paths are correct

**Cross-tab sync not working**:
- Check localStorage is enabled
- Verify both tabs are on same origin
- Check browser console for hub-storage errors

**Map tab performance issues**:
- Large graphs (100+ nodes) may lag
- Reduce physics iterations in map.js config
- Consider splitting into smaller branches

## 11. Future Enhancements

Potential improvements (not yet implemented):
- Undo/redo system
- JSON export/import for sharing
- Validation rules engine
- Preview mode (live game simulation)
- Batch operations (multi-select, bulk edit)
- Search/filter in all lists
- Templates for common patterns
- Version diffing
- Collaborative editing (WebSocket sync)
