# Experimental Build Changelog

## 2026-01-11 - Initial Release + Updates

### Fixed
- **NaN display bug** - Fixed issue where ranged outputs (e.g., `$1-5`) were displaying as `NaN` instead of the correct range
  - Updated UI.js to properly handle all three resolution types:
    - Deterministic: Shows exact value (`$100`)
    - Ranged outputs: Shows range (`$1-5`)
    - Weighted outcomes: Shows range across all outcomes (`$0-120`)

### Added
- **In-activity run progress display** - When viewing an activity's detail page, you now see:
  - All active runs for that specific activity
  - Real-time progress bars with percentage and time remaining
  - Assigned crew member names
  - Option being executed
  - Updates automatically every second while runs are in progress

### Updated
- **schema.md** - Added section 15: UI Display Rules
  - Documents how different resolution types should be displayed
  - Specifies active run display requirements
  - Defines resource and staff display formats
  - Clarifies that stars are always derived, never stored

### UI Improvements
- Active runs section appears between activity header and options list
- Uses orange border and subtle background to distinguish from options
- Progress bars show percentage and remaining time
- Automatically disappears when no runs are active for that activity

### Technical Changes
- Game loop now updates activity detail view every tick when runs are active
- Added new CSS classes: `.activity-runs-section`, `.run-item-inline`, `.progress-bar-small`
- UI rendering logic properly handles all resolution types without errors

---

## Implementation Details

### Resolution Display Logic

```javascript
// Deterministic
if (cash) show `$${cash}`

// Ranged Outputs
if (cash.min !== undefined) show `$${cash.min}-${cash.max}`

// Weighted Outcomes
const amounts = outcomes.map(o => o.outputs?.resources?.cash || 0)
const min = Math.min(...amounts)
const max = Math.max(...amounts)
show `$${min}-${max}`
```

### Active Runs Display

```javascript
// Filter runs by current activity
const activeRuns = Engine.state.runs.filter(run => run.activityId === activity.id)

// Display only if runs exist
if (activeRuns.length > 0) {
  // Show section with live progress bars
}
```

This provides immediate visual feedback that operations are in progress without requiring tab switching.

---

## Next Steps

Possible future enhancements:
- Add "Cancel Run" button to forfeit rewards and free crew
- Show outcome probabilities for weighted outcomes (if player discovers info)
- Add filters/sorting for activity list
- Implement heat modifier visualization
- Add staff XP gain preview in options
