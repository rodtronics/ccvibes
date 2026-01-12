# Crime Committer VI — UI & Visual Spec

Purpose: single source for visual language, layout, and interaction patterns. Pair with `01_design_philosophy.md` for intent and `03_schema_engine.md` for data/logic.

## 1. UI Direction
- Modern TUI aesthetic; characters-only feel; black background with crisp monospace font.
- Thin rules, segmented bars, restrained color; minimal, purposeful animation.

## 2. Viewport and Layout
- Fixed viewport; no page scroll; panels scroll internally; must fit comfortably on a single screen.
- Primary layout: status rail at top, tab bar beneath, main panel below, wide log panel where appropriate.

## 3. Status Rail
- Always visible; displays game title, cash, heat, active runs count, and live clock.

## 4. Tabs and Navigation
- Tabs may include: Activities, Tech Web, Crew, Inventory, Economy, Active, Log.
- Not all tabs are visible at start; tabs can appear or become usable over time; existence of a tab implies discovery, not mastery.

## 5. Activities View
- Shows branch selection and available Activities; selecting an Activity opens a detail pane listing Options and requirements.
- Primary control happens through Activity detail views.
- Possible branches: Primordial, Drugs, Tech, Smuggling/Logistics, Fraud/Grift, Corruption/Influence.

## 6. Active Runs
- Dedicated tab; secondary management view.
- Shows timers, assigned staff, and status; cancelling a run forfeits rewards.

## 7. Event Log
- Timestamped entries; scrolls internally.
- Used for outcomes, discoveries, consequences, and rumours; the log is a key discovery channel.

## 8. Information Disclosure and Discovery Feedback
- Avoid full numeric breakdowns early; express risk emotionally first; unlock details as systems are understood.
- Introduce new systems via vague messages, ??? placeholders, and post-event explanations.
- Avoid explicit “you unlocked X” messaging; curiosity should lead, explanation should follow.

## 9. Visual Design Language
### Aesthetic
Retrofuturistic control terminal: part 1980s computer interface, part music production equipment, part cyberpunk data readout.

### Color Palette
- Background: deep blacks/dark blues (#000000, #0a1628, #1a2332).
- Primary UI: terminal greens (#00ff00, #33ff33), neon cyan/teal (#00ffff, #40e0d0).
- Accents/highlights: hot pink/magenta (#ff00ff, #ff1493), electric orange (#ff6600, #ff8c00), bright yellow (#ffff00).
- Warnings/heat: orange-red gradients (#ff4500–#ff0000).
- Success/completion: bright lime green (#00ff00).
- Neutral text: white, light gray, mid gray (#ffffff/#cccccc/#888888).

### Layout Principles
- Modular panel design; grid-based alignment; panels within panels with clear grouping.
- Heavy use of borders/box-drawing; data-dense but organized.
- Show parallel operations clearly; hierarchical nesting.

### Visual Language Elements
- Progress indicators: block characters, percentage readouts, time remaining.
- Meters and gauges: horizontal bars for heat, risk, completion states.
- Technical readouts: coordinates, timestamps, run IDs, status codes.
- Waveforms/ASCII graphs where appropriate.
- Status markers: colored dots, brackets, chevrons, arrows.
- Typography: monospace/bitmap fonts only; minimal decoration; ASCII art sparingly; geometric patterns/dithering for texture.

### UI Feedback and State
- Idle: muted colors, subtle borders.
- Active/running: bright accent colors, animated progress indicators.
- Warning: orange/yellow highlights, increased visual weight.
- Error/blocked: red accents, clear distinction.
- Completed: brief green flash/highlight before settling.
- Selected/focused: brighter borders, inverted colors, or distinct highlight color.

### Animation Philosophy
- Minimal but purposeful; functional animations only (progress bars filling, timers counting, status transitions).
- Instant state changes; typing/reveal effects acceptable for initial display or discoveries.
- Pulse/blink sparingly for critical alerts only.

### Information Hierarchy
1) Critical actions/warnings; 2) Active operations; 3) Available options; 4) Contextual data; 5) Background/inactive.

### Interface Components
- Buttons/selections: `[ OPTION ]` or `[ > SELECTED ]`.
- Progress bars: `[########--------] 45%` (use block characters).
- Meters: `HEAT [########--------] 40%`.
- Timers: `2:34:15 remaining`.
- Status badges: `[ACTIVE] [LOCKED] [COMPLETE]`.
- Data labels: `CREW: 3/5` `CASH: $12,450`.
- Dividers: horizontal rules using box characters.

### Accessibility
- Maintain minimum contrast; avoid color-only signaling; provide text labels alongside symbols.
- Support standard terminal color schemes where possible; allow font size adjustment when technically possible.

### Aesthetic Inspirations
- 1980s computer terminals/CLIs; music production equipment; cyberpunk UI; retro arcade/early computer games; technical diagrams.

## 10. Interaction Patterns
### Repeat Queue UI Pattern
- **Control states:**
  - Idle (no active run): number input (1–999) with +/- buttons; “REPEAT X” for finite; “∞ REPEAT” for infinite; clean terminal aesthetic (no spinners).
  - Active repeat: status text “REPEATING 3/10” (finite) or “∞ REPEATING” (infinite); green accent background; STOP button in warning orange.
  - Stop confirmation: STOP -> “CONFIRM STOP?”; button turns danger red with pulse; second click confirms or clicking elsewhere cancels.
- **Visual hierarchy:** green for active automation; orange for stop; red for confirm; number controls dim/secondary.
- **Interaction:** inline increment handlers; validate min/max; repeat queue persists across refresh; auto-restart after completion; stop with warning if auto-restart fails (no resources, crew busy).
- **Color coding:** active status background `rgba(0, 255, 0, 0.1)`; status text uses secondary/green; warning orange for STOP; danger red for confirm.
- **Responsive:** modal/controls max-width ~600px; on narrow screens controls stack vertically.
- **Unlocking:** only shown where `meta.repeatable === true`; can be progression-gated.

### Crew Selection Modal Pattern
- **Trigger:** click “COMMIT” on any option card; modal overlays current screen and dims background.
- **Layout:** header (activity/option name + description); required roles; optional specialists; expected outcome; footer buttons.
- **Required slots:** red/warning border when empty; green when filled; show role, star requirement, selected crew or “None Selected”; warning icon allowed.
- **Optional slots:** dim gray border when empty; cyan when filled; show bonus description; “Currently: None” text when empty.
- **Dropdown:** filtered by role; shows name, star rating (e.g., `***`), status; available first; busy/unavailable grayed with reason and return time; hover uses cyan border glow.
- **Expected outcome box:** cyan border; updates in real time as crew are selected; color-coded odds (green good, red bad).
- **Buttons:** CANCEL is secondary; CONFIRM is primary, disabled until requirements are met; enabled once all required slots are filled.
- **Interaction states:** initial open (required empty), partial fill, requirements met (confirm enabled), fully optimized (all slots filled).
- **Responsive:** modal max-width ~600px; dropdowns become full-width on narrow screens; expected outcome stacks vertically on mobile.
- **Animation:** modal fade/dim ~150ms; dropdown slide ~100ms; outcome update ~200ms.
- **Keyboard:** ESC closes; TAB navigates selects; ENTER opens dropdown/chooses crew; ENTER on CONFIRM starts run if valid.

## 11. Display Rules
- **Resolution display:** deterministic shows exact value; ranged outputs show min-max; weighted outcomes show global min-max across outcomes.
- **Active run display:** show all runs for an activity, progress bar, remaining time, assigned staff, option name.
- **Resource display:** title-case name; current amount with locale separators; only show resources revealed via `reveals.resources`.
- **Staff display:** name, role, XP, derived stars (e.g., `***`), status `[AVAILABLE] [BUSY] [UNAVAILABLE]`.
- **Crew selection validation:** all required roles filled; assigned crew meet star minimums and are available; the same crew member cannot be used twice; validate before enabling CONFIRM.
- **Engine call:** `Engine.startRun(activityId, optionId, assignedStaffIds)` with assigned staff IDs in order of selection.
