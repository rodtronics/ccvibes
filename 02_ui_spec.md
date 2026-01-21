# Crime Committer VI — UI & Visual Spec

Purpose: single source for visual language, layout, and interaction patterns. Pair with `01_design_philosophy.md` for intent and `03_schema_engine.md` for data/logic.

## 1. UI Direction

- TRUE ASCII/ANSI.. renderer will be platform dependent, but this is to be made with nothing but characters, AS IF we were running on a terminal. yes we have to fake it because this is the web, BUT the entire display is a grid of characters
- Modern TUI aesthetic; characters-only feel; black background with crisp monospace font.
- Thin rules, segmented bars, restrained color; minimal, purposeful animation.

## 2. Viewport and Layout

- Fixed viewport: **80 columns × 25 rows (80x25 character grid)** - classic terminal dimensions.
- No page scroll; panels scroll internally; compact layout for focused gameplay.
- Primary layout: status rail at top, tab bar beneath, single main panel (full width).

## 3. Status Rail

- Always visible; displays game title, cash, heat, active runs count, and live clock.

## 4. Tabs and Navigation

### Main Tabs (Top Level)

- **Jobs (J)**: Browse criminal activities by branch, select jobs, start operations
- **Active (A)**: Monitor all active runs, manage ongoing operations
- **Crew (C)**: Manage crew members (future implementation)
- **Settings (S)**: Configure display options (font selection)

Tabs use **hotkey navigation** with underlined letters:
- Press J/A/C/S to switch tabs instantly
- Active tab displays in bright color (cyan), inactive tabs dimmed (gray)
- Hotkey letter highlighted in bright cyan on inactive tabs only

### Secondary Navigation (Branch Tabs)

Within the Jobs tab, branches appear as secondary tabs:
- Each branch has a single-letter hotkey (e.g., **S**treet, c**O**mmerce)
- Hotkey letter must exist within the branch name
- Highlighted in bright cyan when branch is inactive
- Active branch tab shown in full color

### Number-Based Selection

Jobs and options use numbered selection for fast access:
- **1-9 keys** select items from lists
- In job list: Press number to instantly open that job's options
- In options list: Press number to instantly start that option
- **Backspace** returns to previous screen
- Arrow keys provide alternative navigation

## 5. Jobs View (formerly Activities)

The Jobs tab uses a streamlined two-screen navigation:

### Screen 1: Job List

- Branch tabs displayed at top (row 4)
- Numbered list of jobs (1-9) for selected branch
- Selected job highlighted with `>` prefix and bright color
- Job description shown at bottom
- Press number key to drill into job options
- Press Enter on selected job to see options

### Screen 2: Options View

- Job name and description at top
- Numbered list of options (1-9) with details:
  - Option name
  - Duration estimate
  - Requirements (crew, items, etc.)
- Press number to instantly start that option
- Press Backspace to return to job list
- No third-level navigation - stays compact

**Active runs display:**
- Active runs for current job shown in options view
- Compact 4-line format per run
- Real-time progress updates

**Possible branches:**
- Street, Commerce (currently implemented)
- Future: Tech, Smuggling, Fraud, Corruption

### 5.1 Concurrent Runs Display

Activities display their active runs directly in the detail panel:

**Per-option status line:**
- Shows active run count: `"2 active runs"` (if no limit) or `"2/4 concurrent runs"` (with limit)
- Uses warning color when at limit: `"Concurrency limit reached (3/3)"`
- Placeholder space maintained when no runs to preserve layout stability

**Active runs section:**
- Appears below options list when runs are active for this activity
- Section header: `"ACTIVE RUNS (5)"` showing total count
- Each run displayed using 4-line block format (see section 12)
- Multiple concurrent runs visible simultaneously
- Allows monitoring all jaywalking runs within jaywalking detail, all shoplifting runs within shoplifting detail, etc.

**Visual hierarchy:**
- Active runs use warning/accent colors (orange borders) to stand out
- Dimmed display when panel not focused (see section 15)
- Progress bars update in real-time without full refresh

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

## 15. UI Customization via Data Schema

Branches and UI elements support color/gradient customization through their JSON definitions:

### Branch UI Schema

```json
{
  "id": "street",
  "name": "street",
  "hotkey": "s",
  "ui": {
    "color": "TERMINAL_GREEN",
    "gradient": null
  }
}
```

**Fields:**
- `hotkey`: Single letter that appears in the branch name (case insensitive)
- `ui.color`: Palette color name for active branch tab (e.g., "TERMINAL_GREEN", "NEON_CYAN")
- `ui.gradient`: Gradient name for future gradient text support (see GRADIENTS.md)

**Hotkey Requirements:**
- Must be a single character
- Must appear in the branch `name` field
- Case insensitive matching
- Game will find and highlight this letter in the tab label

**Color Support:**
- Active tab displays in specified color
- Inactive tab dims to DIM_GRAY
- Hotkey letter in inactive tab highlighted in NEON_CYAN

**Future Gradient Support:**
When gradients are implemented:
- If `ui.gradient` is set, use gradient instead of solid color
- Gradient names from GRADIENTS.md (cyber, cool, warm, heat, etc.)
- Smooth color transitions across tab label characters

### Main Tab Configuration

Main tabs are currently hardcoded in `ui.js` but could be moved to JSON:

```javascript
// Current implementation (hardcoded)
const tabs = [
  { id: 'jobs', label: 'JOBS', hotkey: 'j' },
  { id: 'active', label: 'ACTIVE', hotkey: 'a' },
  { id: 'crew', label: 'CREW', hotkey: 'c' },
  { id: 'settings', label: 'SETTINGS', hotkey: 's' },
];
```

Future JSON schema could add color/gradient support:

```json
{
  "id": "jobs",
  "label": "JOBS",
  "hotkey": "j",
  "ui": {
    "color": "NEON_CYAN",
    "gradient": null
  }
}
```

### Gradient Text Rendering

Gradients apply smooth color transitions across text for visual interest:

**Implementation:**
- `gradients.js` defines named gradients (cyber, cool, warm, heat, neon, toxic, street, commerce, etc.)
- Each gradient is an array of hex color values
- Colors interpolate linearly across text length
- `FrameBuffer.drawGradientText(x, y, text, gradientName, bgColor, alignment)` renders gradient text
- Falls back to solid color if gradient doesn't exist

**Example:**
```
STREET → S(#00ff00) T(#44ff22) R(#66ff33) E(#88ff44) E(#aaff55) T(#ccff88)
```

**Usage:**
- Branch tabs can specify `ui.gradient` in data/branches.json
- Enabled/disabled via user settings (gradients toggle)
- Used for visual hierarchy and branch identity

### Hotkey Glow Effect

Inactive tabs display a subtle "glow" effect around hotkey letters:

**Behavior:**
- Hotkey letter: bright cyan (NEON_CYAN)
- Adjacent characters (±1 position): 67% interpolation between cyan and grey
- Only visible on inactive tabs (disabled when tab is selected)
- Works alongside existing hotkey highlighting

**Example with hotkey 'R' in "STREET":**
```
S(dim) T(dim) R(CYAN) E(glow) E(glow) T(dim)
        ↑       ↑        ↑
      normal  hotkey  glow effect
```

**Implementation:**
- Color interpolation: `lerpColor(NEON_CYAN, DIM_GRAY, 0.67)`
- Applied in `ui.js` renderTab() function
- Enabled/disabled via user settings (hotkeyGlow toggle)

## 16. Visual Focus and Dimming

The UI uses visual dimming to indicate focus and guide attention within multi-panel layouts.

### Focus Tracking

- UI maintains a `focus` state indicating which panel or element currently has user attention
- In Activities tab: focus can be 'branch', 'activity', or 'option'
- Other tabs may define their own focus contexts

### Dimming Behavior

- **Focused panel**: Full brightness using standard Palette colors
- **Non-focused panels**: Dimmed using darker color variants
- **Active runs in non-focused activity**: Dimmed display when the activity detail panel is not currently focused
- **Borders**: Always use DIM_GRAY regardless of focus (maintain visual hierarchy)

### Dimming Strategy

- Text colors: Reduce brightness by using dimmer variants from Palette (e.g., TERMINAL_GREEN_DIM instead of TERMINAL_GREEN)
- Active run cards: Apply dim colors to all text and progress bars when parent activity is not focused
- Transition: No animation; instant color change on focus change
- Preserve legibility: Dimmed content should still be readable, just visually recessed

### Activities Tab Focus Example

- When focus is 'branch': Branch column bright, activity and option columns dimmed
- When focus is 'activity': Activity column bright, branch and option columns dimmed
- When focus is 'option': Option detail panel bright (including any active runs), branch and activity columns dimmed

### Purpose

- Reduces visual clutter by de-emphasizing non-focused content
- Guides user attention to currently active navigation area
- Maintains awareness of other panels without competing for attention
- Aligns with terminal aesthetic of focused workspace

## 17. Fullscreen Modal System

The game uses a fullscreen modal overlay system for presenting important information, tutorials, story reveals, and unlock notifications without interrupting the core game loop.

### Modal Display

- **Fullscreen overlay**: 80×25 character grid covering entire display
- **Double-line border**: Uses BoxStyles.DOUBLE border in NEON_CYAN for visual prominence
- **Solid background**: BLACK background, no transparency
- **Title bar**: Centered title text (row 1), separator line (row 2)
- **Content area**: Rows 3-24 for scrollable text content
- **Input priority**: Modals capture all input until dismissed

### Content Formatting

Modals support markdown-like formatting for rich text styling:

- `**text**` → Bold/bright text (WHITE color)
- `~~text~~` → Dimmed text (DIM_GRAY color)
- `{{color}}text{{/}}` → Colored text using any Palette color name
- `{{bg:color}}text{{/}}` → Background color using any Palette color name
- Blank lines → Preserved as line breaks
- Auto-wrapping → Text wraps to 76 characters (80 - 4 for borders/padding)

**Example:**
```
**Welcome!** You've unlocked {{neon_cyan}}Commerce{{/}} operations.

These jobs require {{success_green}}planning{{/}} and {{heat_orange}}careful execution{{/}}.

~~Press any key to continue.~~
```

### Modal Types and Usage

Modals are defined in `modal.js` with the following structure:

```javascript
{
  id: 'unique_id',
  title: 'MODAL TITLE',
  content: `Formatted text content...`,
  showOnce: true  // or false for replayable modals
}
```

**Current modals:**
- `intro`: Welcome screen shown on first launch
- `first_job_complete`: Tutorial shown after completing first job
- `commerce_unlocked`: Story/tutorial when Commerce branch unlocks

### Modal Queue System

- **Queue management**: ModalQueue class manages display order
- **localStorage tracking**: Tracks which modals have been shown (for `showOnce` modals)
- **Auto-queueing**: Game engine can queue modals based on progression events
- **Sequential display**: Only one modal shown at a time; next modal appears after dismissal
- **Force display**: Can override `showOnce` restriction with force parameter

### Input Controls

- **Scroll up**: ↑ Arrow key
- **Scroll down**: ↓ Arrow key
- **Dismiss**: SPACE, ENTER, or ESC key
- **Auto-scroll tracking**: Scrollbar appears when content exceeds visible area

### Visual Scrollbar

When content height exceeds visible area (21 lines):
- Scrollbar rendered on right edge (column 79)
- Track character: `│` (vertical line)
- Thumb character: `█` (solid block)
- Thumb position calculated from scroll offset
- Thumb color: NEON_CYAN

### Implementation Files

- `modal.js`: Content definitions, parser, ModalQueue class
- `ui.js`: renderModal() method (Layer 3 overlay)
- `main.js`: Input handling, showModal()/dismissModal() functions, queue integration

### Design Philosophy

- **Non-intrusive**: Quick dismiss with any common key (SPACE/ENTER/ESC)
- **Scrollable**: Long content doesn't overwhelm; user controls reading pace
- **Contextual**: Appears when relevant (first launch, unlocks, achievements)
- **Story integration**: Primary channel for narrative progression and world-building
- **Tutorial system**: Introduces new mechanics as they become available
