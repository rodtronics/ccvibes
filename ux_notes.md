# Crime Committer VI — UX & UI Notes

This document describes UI intent, layout, and player-facing presentation.
It supports the design goals of discovery, restraint, and legibility.

---

## 1. UI DIRECTION

- Modern TUI aesthetic
- Characters-only feel (no skeuomorphism)
- Black background, crisp monospace font
- Thin rules, segmented bars, restrained colour
- Minimal animation

---

## 2. VIEWPORT & LAYOUT

- Fixed viewport; no page scroll
- Panels scroll internally
- UI must fit comfortably within a single screen

Primary layout concept:

- Status rail at top
- Tab bar beneath
- Main panel content below
- Wide log panel where appropriate

---

## 3. STATUS RAIL

Displays:

- Game title
- Cash
- Heat
- Active runs count
- Live clock

Always visible.

---

## 4. TABS & NAVIGATION

Tabs may include:

- Activities
- Tech Web
- Crew
- Inventory
- Economy
- Active
- Log

Important:

- Not all tabs are visible at game start
- Tabs may appear or become usable over time
- The existence of a tab implies discovery, not mastery

---

## 5. ACTIVITIES VIEW

- Shows branch selection and available Activities
- Selecting an Activity opens a detail pane
- Detail pane lists Options and requirements
- Primary control happens through Activity detail views

Branches may include:

- Primordial
- Drugs
- Tech
- Smuggling / Logistics
- Fraud / Grift
- Corruption / Influence

Branch completeness and size may vary.

---

## 6. ACTIVE RUNS

- Active runs live in a dedicated tab
- Secondary management view
- Shows timers, assigned staff, and status
- Cancelling a run forfeits rewards

---

## 7. EVENT LOG

- Timestamped entries
- Scrolls internally
- Used for:
  - outcomes
  - discoveries
  - consequences
  - rumours

The log is a key discovery channel.

---

## 8. INFORMATION DISCLOSURE

- Avoid full numeric breakdowns early
- Risk should be expressed emotionally at first
- Details unlock as systems are understood

Examples:

- “this feels risky”
- “results may vary”
- “someone might notice”

---

## 9. DISCOVERY FEEDBACK

- New systems may be introduced via:
  - vague messages
  - UI placeholders (???)
  - post-event explanations
- Avoid explicit “you unlocked X” messaging

Curiosity should lead, explanation should follow.
