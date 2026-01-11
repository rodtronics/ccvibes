# Crime Committer VI — Design Reference

Crime Committer VI is a lighthearted, GTA-ish incremental management game with a modern terminal-style UI.
It blends idle timers, data-driven systems, and discovery-based progression.

The game is about **assigning a limited crew to time-based activities**, managing risk and heat,
and gradually uncovering a messy, interconnected web of systems.

Current design target: v6+

---

## 1. CORE PHILOSOPHY

- Progress is discovered, not explained.
- Systems exist before the player understands them.
- Risk is optional but tempting.
- Punishment is time loss, not progress deletion.
- The player is never hard-blocked from acting.
- Information is revealed gradually and often incompletely.

The game should feel **alive, slightly opaque, and interconnected**, not linear or tutorialised.

---

## 2. CORE LOOP

- Pick an activity (crime, research, build, or other operation).
- Choose a specific execution option and assign an available worker.
- Each assignment creates an independent, time-based run.
- Runs continue offline and complete on return.
- Rewards may include cash, heat, items, flags, or revelations.
- Abandoning an in-progress run forfeits its rewards.
- Long timers (hours to days) are allowed to encourage return play.

Multiple workers do **not** speed up a single run.
Each worker creates a **parallel run with its own outcome and risk**.

---

## 3. FUNDAMENTAL UNITS

### Activity

An **Activity** is a UI container and conceptual grouping.

An Activity:

- has a name and description
- belongs to a single browsing branch (for UI only)
- may be hidden, vaguely known, or fully understood
- contains one or more execution Options

An Activity never:

- directly consumes resources
- directly assigns staff
- directly resolves outcomes

---

### Option

An **Option** is a specific way of performing an Activity.

Options define:

- requirements (staff role, star level, items, buildings)
- inputs (resources or items consumed)
- duration
- XP rewards
- outcome resolution (deterministic or probabilistic)
- side effects (heat, jail, flags, reveals)

Multiple Options may produce the **same end result** with different:

- efficiency
- risk
- speed
- reliability

---

## 4. STAFF, XP, AND STARS

- Staff are assigned to Options, not Activities.
- Staff gain XP from time spent or completed runs.
- Star level is derived from XP thresholds.
- Stars do **not** directly unlock content.
- Stars improve:
  - reliability
  - efficiency
  - access to safer or faster Options

Skill bends probability; it does not guarantee success.

---

## 5. OUTCOMES & RANDOMNESS

- Options may resolve via weighted outcome tables.
- Binary success/failure should be avoided where possible.
- Partial success, bad trades, lucky outcomes, and consequences are preferred.
- Randomness must be learnable and influenceable.

Outcome chances may be modified by:

- staff star level
- tools and preparation
- current heat

Risk should always be **telegraphed**, even if imprecisely.

---

## 6. HEAT SYSTEM

Heat represents background pressure, not a hard limit.

Rules:

- Heat rises through risky or noisy actions.
- Heat decays naturally over time.
- Heat never blocks an action outright.
- Higher heat increases the chance and severity of negative outcomes.

Low heat enables safer, cleaner execution.
High heat creates tension and volatility.

---

## 7. JAIL & CONSEQUENCES

- Staff may be temporarily unavailable due to consequences (e.g. jail).
- Jail is a **time cost**, not a permanent loss.
- Duration scales with heat and severity.
- Progress continues while staff are unavailable.

Later systems may mitigate consequences (bail, corruption, upgrades).

---

## 8. RESOURCES & TRANSFORMATIONS

Resources exist to enable **recipes**, not hoarding.

Types include:

- currencies (cash, heat, notoriety, cred)
- consumables (tools, supplies)
- loot (raw goods)
- processed goods
- abstract/meta resources (intel, contacts, flags)

Many Activities are **resource transformations**.
The same output may be obtainable through multiple recipes.

---

## 9. DISCOVERY & PROGRESSION

- Not all branches or systems are visible at game start.
- Activities, resources, and mechanics may be revealed before they are usable.
- Revelation is distinct from unlocking capability.

Progression relies on:

- flags (knowledge, events, contacts)
- reveals (branches, activities, resources)
- cross-branch effects

Explicit dependency chains should be avoided in favour of discovery.

---

## 10. TECH WEB & RESEARCH

Research and tech nodes:

- reveal capabilities, methods, or opportunities
- may expose new activities, options, roles, or resources
- should not function as a transparent linear tech tree

The Tech Web supports discovery, not full explanation.

---

## 11. DESIGN CONSTRAINTS (DO NOT BREAK)

- No irreversible punishment
- No permanent dead ends
- No mandatory waiting without player choice
- No single linear progression path
- No full system map or completion percentage

When in doubt, preserve curiosity over clarity.

---

## 12. AUTHORING GUIDELINES

When generating content:

- respect the Activity → Option → Run structure
- use conditions and effects, not custom logic
- prefer adding Options over adding new Activities
- prefer flags and reveals over explicit unlocks

Tone:

- dry
- understated
- cynical
- never congratulatory

---

## 13. VISUAL & UI DESIGN

The UI should feel like a **retrofuturistic control terminal** — part 1980s computer interface, part music production equipment, part cyberpunk data readout.

### Color Palette

Use dark backgrounds with high-contrast neon accents:

- **Background**: Deep blacks (#000000) and dark blues (#0a1628, #1a2332)
- **Primary UI elements**: Terminal green (#00ff00, #33ff33), neon cyan/teal (#00ffff, #40e0d0)
- **Accents & highlights**: Hot pink/magenta (#ff00ff, #ff1493), electric orange (#ff6600, #ff8c00), bright yellow (#ffff00)
- **Warnings & heat**: Orange-red gradients (#ff4500 → #ff0000)
- **Success & completion**: Bright lime green (#00ff00)
- **Data & neutral text**: White (#ffffff), light gray (#cccccc), mid gray (#888888)

### Layout Principles

- **Modular panel design**: Think mixing board, synthesizer interface, or control console
- **Box-drawing characters**: Heavy use of borders (─│┌┐└┘├┤┬┴┼), frames, separators
- **Data-dense but organized**: Information should feel technical but remain parseable
- **Parallel operation visibility**: Show multiple simultaneous runs/workers clearly
- **Hierarchical nesting**: Panels within panels, clear visual grouping
- **Grid-based alignment**: Everything snaps to character grid

### Visual Language

- **Progress indicators**: Block characters (█▓▒░), percentage readouts, time remaining
- **Meters & gauges**: Horizontal bars for heat, risk, completion states
- **Technical readouts**: Coordinates, timestamps, run IDs, status codes
- **Waveforms & graphs**: ASCII-based data visualization where appropriate
- **Status markers**: Colored dots (●), brackets, chevrons (›‹), arrows (→←↑↓)
- **Typography**: Monospace/bitmap fonts exclusively (VGA, terminal fonts)
- **Minimal decoration**: ASCII art sparingly, only when it adds functional clarity
- **Geometric patterns**: Dithering, checker patterns, grid overlays for visual texture

### UI Feedback & State

Visual feedback should be immediate and unambiguous:

- **Idle state**: Muted colors, subtle borders
- **Active/running**: Bright accent colors, animated progress indicators
- **Warning state**: Orange/yellow highlights, increased visual weight
- **Error/blocked**: Red accents, clear visual distinction
- **Completed**: Brief green flash/highlight before settling to neutral
- **Selected/focused**: Brighter borders, inverted colors, or distinct highlight color

### Animation Philosophy

- **Minimal but purposeful**: Avoid gratuitous effects
- **Functional animations only**: Progress bars filling, timers counting, status transitions
- **Instant state changes**: No slow fades or lengthy transitions
- **Typing/reveal effects**: Acceptable for initial text display or discoveries
- **Pulse/blink**: Use sparingly for critical alerts only

### Information Hierarchy

Visual weight should guide player attention:

1. **Critical actions/warnings**: Brightest colors, bold borders, prominent position
2. **Active operations**: Medium brightness, clear progress indicators
3. **Available options**: Standard contrast, clickable/selectable appearance
4. **Contextual data**: Lower contrast, supporting information
5. **Background/inactive**: Dimmest, clearly de-emphasized

### Interface Components

Standard component design patterns:

- **Buttons/selections**: `[ OPTION ]` or `[ > SELECTED ]`
- **Progress bars**: `[████████░░░░░░░░] 45%`
- **Meters**: `HEAT [▓▓▓▓▓▓▓▓░░░░░░░░░░] 40%`
- **Timers**: `⏱ 2:34:15 remaining`
- **Status badges**: `[ACTIVE]` `[LOCKED]` `[COMPLETE]`
- **Data labels**: `CREW: 3/5` `CASH: $12,450`
- **Dividers**: Horizontal rules using `═` or `─`, section breaks

### Accessibility Considerations

- Maintain minimum contrast ratios for readability
- Don't rely on color alone to convey critical information
- Provide text labels alongside symbols
- Support standard terminal color schemes for compatibility
- Allow font size adjustment where technically possible

### Repeat Queue UI Pattern

The repeat queue system allows activities to automatically restart upon completion. The UI provides three modes with clear visual feedback:

**Control States:**

1. **Idle (No Active Run)**: Shows full repeat controls
   - Number input field (1-999) with +/- increment buttons
   - "REPEAT X" button to start finite repeat queue
   - "∞ REPEAT" button to start infinite repeat queue
   - Input has no arrow spinners (clean terminal aesthetic)

2. **Active Repeat**: Shows status and control
   - Status text: "REPEATING 3/10" (finite) or "∞ REPEATING" (infinite)
   - Green accent background indicates active automation
   - STOP button in warning orange color

3. **Stop Confirmation**: Two-stage safety mechanism
   - First click changes STOP to "CONFIRM STOP?"
   - Button becomes red with pulsing animation
   - Click anywhere else or second click confirms

**Visual Hierarchy:**
- Active repeat status uses bright green to indicate successful automation
- Stop button uses warning orange (not critical red) until confirmation
- Confirmation state uses danger red with pulse animation
- Number controls use dim styling to appear secondary to main action button

**Interaction Pattern:**
- Increment buttons use inline handlers for immediate response
- Number input validates min (1) and max (999) constraints
- Repeat queue persists across page refreshes
- Auto-restart happens after completion, not during run
- If auto-restart fails (no resources, crew busy), queue stops with warning

**Color Coding:**
- `rgba(0, 255, 0, 0.1)` background for active repeat status
- `var(--secondary)` (green) for status text
- `var(--warning)` (orange) for initial STOP button
- `var(--danger)` (red) for CONFIRM state

### Crew Selection Modal Pattern

The crew selection modal enables RPG-style crew composition before committing to operations. It separates "what to do" from "who does it," providing strategic depth without cluttering the main UI.

**Trigger:**
- User clicks "COMMIT" button on any option card
- Modal overlays current screen
- Dims background to focus attention on modal

**Modal Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ JEWELRY HEIST: SMASH AND GRAB                            │
│ fast, loud, effective. pick two.                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ REQUIRED ROLES                                            │
│ ┌────────────────────────────────────────────────────┐  │
│ │ THIEF (2★ minimum)              [SELECT ▼]  ⚠️    │  │
│ │ None Selected                                      │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ DRIVER (1★ minimum)             [SELECT ▼]  ⚠️    │  │
│ │ None Selected                                      │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ OPTIONAL SPECIALISTS                                      │
│ ┌────────────────────────────────────────────────────┐  │
│ │ FIXER (any)                     [SELECT ▼]        │  │
│ │ Bonus: +5 cred, improved success rate             │  │
│ │ Currently: None                                    │  │
│ └────────────────────────────────────────────────────┘  │
│ ┌────────────────────────────────────────────────────┐  │
│ │ CLEANER (any)                   [SELECT ▼]        │  │
│ │ Bonus: -40% heat generation                       │  │
│ │ Currently: None                                    │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ EXPECTED OUTCOME (with current crew)                     │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Probability: 30% caught, 70% success               │  │
│ │ CRED: -20 to +8  │  HEAT: +3 to +15               │  │
│ │ CASH: $0 to $350                                   │  │
│ └────────────────────────────────────────────────────┘  │
│                                                           │
│ [CANCEL]                      [CONFIRM] (disabled)       │
└──────────────────────────────────────────────────────────┘
```

**When [SELECT ▼] is clicked:**

Dropdown appears showing filtered crew:

```
┌──────────────────────────────────────┐
│ Available THIEVES:                   │
├──────────────────────────────────────┤
│ ○ Vincent (★★★) - AVAILABLE         │
│ ○ Marcus (★★) - AVAILABLE           │
│ ○ Jesse (★) - BUSY (returns 2m)     │ (grayed)
│ ○ Alex (★★) - JAIL (4h remaining)   │ (grayed)
└──────────────────────────────────────┘
```

**After selecting crew:**

```
┌────────────────────────────────────────────────────┐
│ THIEF (2★ minimum)              [Vincent ✓]  ✓   │
│ Vincent (★★★) - AVAILABLE                        │
└────────────────────────────────────────────────────┘
```

**Expected Outcome updates dynamically:**

```
EXPECTED OUTCOME (with Vincent ★★★ + Marcus ★★)
┌────────────────────────────────────────────────────┐
│ Probability: 15% caught, 85% success               │
│ CRED: -20 to +13  │  HEAT: +3 to +12              │
│ CASH: $0 to $350                                   │
└────────────────────────────────────────────────────┘

[CANCEL]                      [CONFIRM] ✓
```

**Visual Hierarchy:**

**Required Role Slot (unfilled):**
- Border: Red/warning color (`var(--danger)`)
- Background: Dark with subtle red tint
- Warning icon (⚠️) visible
- "None Selected" text in dim color

**Required Role Slot (filled):**
- Border: Green/success color (`var(--success-green)`)
- Background: Dark with subtle green tint
- Checkmark (✓) visible
- Shows crew name and stars

**Optional Role Slot (empty):**
- Border: Dim gray (`var(--text-dim)`)
- Background: Darker than required
- No warning icon
- "Currently: None" text in secondary color
- Bonus description prominent

**Optional Role Slot (filled):**
- Border: Cyan (`var(--primary)`)
- Background: Dark with subtle cyan tint
- Shows crew name and stars
- Bonus description remains visible

**Dropdown Items:**
- Available: Full brightness, selectable
- Busy: 50% opacity, shows return time, not selectable
- Unavailable: 30% opacity, shows reason, not selectable
- Hover state: Cyan border glow

**Expected Outcome Box:**
- Border: Cyan (`var(--primary)`)
- Updates in real-time as crew selected
- Probability bars could be ASCII visualized
- Color-coded: Green for good odds, Red for bad

**Buttons:**
- CANCEL: Secondary styling, always enabled
- CONFIRM: Primary styling
  - Disabled: 40% opacity, dim border, no hover
  - Enabled: Full brightness, cyan glow on hover

**Color Coding:**
- `var(--danger)` - Unfilled required slots
- `var(--success-green)` - Filled required slots
- `var(--primary)` - Optional slots, outcome box, confirm button
- `var(--text-dim)` - Empty optional slots
- `var(--warning)` - Warnings, moderate probability outcomes

**Interaction States:**

1. **Initial Open**: All required slots red/warning
2. **Partial Fill**: Some required green, some red
3. **Requirements Met**: All required green, CONFIRM enabled
4. **Fully Optimized**: All slots (required + optional) filled

**Responsive Behavior:**
- Modal max-width: 600px
- On narrow screens (<768px), dropdowns become full-width
- Expected outcome section stacks vertically on mobile

**Animation:**
- Modal fade-in: 150ms
- Background dim: 150ms
- Dropdown slide-down: 100ms
- Outcome update: Smooth transition 200ms

**Keyboard Support:**
- ESC: Close modal (same as CANCEL)
- TAB: Navigate between SELECT buttons
- ENTER on SELECT: Open dropdown
- Arrow keys: Navigate dropdown
- ENTER on crew: Select and close dropdown
- ENTER on CONFIRM: Start run (if enabled)

---

## 14. AESTHETIC INSPIRATIONS

Visual references include:

- 1980s computer terminals and command-line interfaces
- Music production equipment: synthesizers, mixing boards, drum machines
- Cyberpunk UI: wireframe graphics, data streams, technical readouts
- Retro video game aesthetics: arcade cabinets, early computer games
- Technical diagrams: oscilloscopes, radar displays, control panels

The overall feel should be **technical, slightly mysterious, and visually striking** without sacrificing clarity or usability.
