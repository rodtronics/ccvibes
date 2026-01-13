# Crime Committer VI — UI & Visual Spec

Purpose: single source for visual language, layout, and interaction patterns. Pair with `01_design_philosophy.md` for intent and `03_schema_engine.md` for data/logic.

## 1. UI Direction

- TRUE ASCII/ANSI.. renderer will be platform dependent, but this is to be made with nothing but characters, AS IF we were running on a terminal. yes we have to fake it because this is the web, BUT the entire display is a grid of characters
- Modern TUI aesthetic; characters-only feel; black background with crisp monospace font.
- Thin rules, segmented bars, restrained color; minimal, purposeful animation.

## 2. Viewport and Layout

- Fixed viewport: 200 columns × 60 rows (200x60 character grid).
- No page scroll; panels scroll internally; designed for modern screen sizes.
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
- Shows timers, assigned staff, progress bars, and repeat status.
- Each run displays as a 4-line block (see section 12 for format).
- Cancelling a run via STOP forfeits rewards.
- Stopping repeat via STOP REPEAT converts the run to a single run without forfeiting current progress.

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

1. Critical actions/warnings; 2) Active operations; 3) Available options; 4) Contextual data; 5) Background/inactive.

### Interface Components

- Buttons/selections: `[ OPTION ]` or `[ > SELECTED ]`.
- Progress bars: `[########################################]` (40 characters; use `#` for filled, `-` for empty; no border or background styling).
- Meters: `HEAT [########--------] 40%`.
- Timers: `2:34:15 remaining` or `45.3s` (tenths of seconds for sub-minute durations).
- Status badges: `[ACTIVE] [LOCKED] [COMPLETE]`.
- Data labels: `CREW: 3/5` `CASH: $12,450`.
- Dividers: horizontal rules using box characters.

### Accessibility

- Maintain minimum contrast; avoid color-only signaling; provide text labels alongside symbols.
- Support standard terminal color schemes where possible; allow font size adjustment when technically possible.

### Aesthetic Inspirations

- 1980s computer terminals/CLIs; music production equipment; cyberpunk UI; retro arcade/early computer games; technical diagrams.

## 10. Interaction Patterns

### Unified Repeat System UI Pattern

The repeat system uses a single `runsLeft` field architecture (0 = single, N = countdown, -1 = infinite).

- **Control states:**
  - Idle (no active run): number input (1–999) with +/- buttons; "REPEAT X" for finite; "∞ REPEAT" for infinite; clean terminal aesthetic (no spinners).
  - Active repeat: status text "REPEATING (5 more after this)" (finite) or "REPEATING infinite" (infinite); green accent background; STOP REPEAT button available.
  - STOP REPEAT: converts the active run to a single run (sets `runsLeft = 0`) without forfeiting current progress.
  - STOP: cancels the run immediately and forfeits all rewards.
- **Visual hierarchy:** green for active automation; secondary color for STOP REPEAT; danger red for STOP.
- **Interaction:** inline increment handlers; validate min/max; repeat state persists across refresh via `runsLeft` field on run instance; auto-restart after completion; stop with warning if auto-restart fails (no resources, crew busy).
- **Color coding:** active status background `rgba(0, 255, 0, 0.1)`; status text uses secondary/green.
- **Responsive:** modal/controls max-width ~600px; on narrow screens controls stack vertically.
- **Unlocking:** only shown where `option.repeatable === true`; can be progression-gated.

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
- **Engine call:** `Engine.startRun(activityId, optionId, assignedStaffIds, orderOverride, runsLeft)` with assigned staff IDs in order of selection and optional repeat parameter.

## 12. Active Run Display Format (4-line block)

Each active run displays as a consistent 4-line block in both the Activities tab (detail view) and the Crew tab (active runs list).

### Line 1: Crime Name

- Format: `{Activity Name} → {Option Name}`
- Class: `.run-name`
- Example: `Shoplifting → Grab and Go`

### Line 2: Staff Assignment

- Format: `Staff: {name1}, {name2}, ...`
- Class: `.run-staff`
- Example: `Staff: Runner_001, Thief_003`

### Line 3: Remaining Time

- Format: `Remaining: {duration}` (with optional finish time for long durations)
- Class: `.run-remaining`
- Duration format includes tenths of seconds for sub-minute times
- Examples:
  - `Remaining: 45.3s`
  - `Remaining: 5m 23.7s`
  - `Remaining: 2h 15m (finishes at 14:30)`
- For durations over 1 hour, append finish time in 24-hour format: `(finishes at HH:MM)`

### Line 4: Progress Bar and Controls

- Format: `[{progress_bar}] {controls}`
- Class: `.run-progress`
- Progress bar: 40 characters using `#` for filled and `-` for empty
- Example: `[################------------------------] STOP`
- Progress bar class: `.progress-bar` (monospace font, no border)
- Controls: STOP button (danger red, cancels run and forfeits rewards)

### Optional Line 5: Repeat Status (only shown if repeating)

- Format: `{status_text} {STOP_REPEAT_button}`
- Class: `.run-repeat-info`
- Status text examples:
  - `REPEATING (5 more after this)` (countdown mode)
  - `REPEATING infinite` (infinite mode)
- STOP REPEAT button: converts to single run without forfeiting current progress

### Shared Component Pattern

Both the Activities tab and Crew tab use the same `UI.createRunItem(run, now)` function to generate run display blocks, ensuring consistency across views.

## 13. Duration Display Format

Duration formatting depends on the time scale:

- **Days**: `3d 12h` (days + remaining hours)
- **Hours**: `2h 45m` (hours + remaining minutes)
- **Minutes**: `5m 23.7s` (minutes + seconds with one decimal place)
- **Seconds**: `12.4s` (seconds with one decimal place)

Tenths of seconds provide smooth visual feedback for countdown timers updated at 50ms intervals (20 updates per second).

## 14. Event-Driven UI Updates

The UI uses a subscription pattern to listen for Engine events rather than polling or manual refresh calls.

### Setup Pattern

```javascript
UI.setupEngineEventListeners() {
  Engine.on('stateChange', () => { this.renderAll(); });
  Engine.on('tick', () => { this.updateProgressBars(); });
  Engine.on('runsCompleted', () => { this.renderAll(); });
}
```

### Update Strategies

- **Full render** (`renderAll()`): Called on `stateChange` and `runsCompleted` events when data changes.
- **Partial update** (`updateProgressBars()`): Called on `tick` events (50ms intervals) to update progress bars and countdown timers without full re-render.
- **Selective render**: Individual components (e.g., `renderStats()`) can be called independently for targeted updates.

### Benefits

- **Performance**: Avoids unnecessary full re-renders; progress bars update smoothly via partial updates.
- **Decoupling**: UI never directly polls Engine state; responds only to events.
- **Maintainability**: Clear separation between state management (Engine) and presentation (UI).
