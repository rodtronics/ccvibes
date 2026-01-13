# Crime Committer VI — ChatGPT Experiment

Fresh build generated from the founding documents and data files only (no existing code reused). Everything lives inside this folder and reads data from `../data` without modifying it.

## Running
- Open `index.html` in a browser, or serve this folder with any static server.
- Data is loaded from `../data/*.json`; the loader tolerates minor JSON formatting issues (missing commas) but does not change the files on disk.

## Features
- Status rail with live cash/heat/run count and clock.
- Activities tab with branch filter, option cards, repeat queue controls (where allowed), and crew assignment modal following the UI spec.
- Active tab for timers/progress bars, repeat status, and assigned staff.
- Crew/resources/items and event log views; logs use the lexicon where available.
- Core engine: validates requirements, pays inputs, rolls deterministic/ranged/weighted outcomes, applies modifiers, awards XP, handles jail/unavailability, heat decay, and repeat queues.

## Notes
- Starting crew: a single `mastermind` (player role) with XP 0; cred starts at 50 per schema.
- Heat decays slowly over time; cred is clamped 0–100; heat never blocks actions.
- Repeat queues are bound to a specific run; if auto-restart fails (busy crew or missing inputs), the queue stops and logs why.
