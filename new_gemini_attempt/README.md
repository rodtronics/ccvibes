# Crime Committer VI - Gemini Prototype

This is a prototype implementation of Crime Committer VI, built according to the "founding documents" specifications.

## How to Run

1.  Open `index.html` in a modern web browser.
2.  (Optional) For the best experience, run a local web server (e.g., `python -m http.server` or `npx serve`) in this directory to ensure strict module loading security policies don't interfere, though it should work via `file://` in most browsers due to relative imports.

## Controls

-   **Arrows**: Navigate menus and tabs.
-   **1-9**: Quick select options.
-   **Enter**: Confirm selection / Start job.
-   **Backspace**: Go back.
-   **J / A / C**: Switch tabs (Jobs, Active, Crew).

## Features Implemented

-   **Rendering Engine**: Phase 2 DOM-based TUI with color support (spans).
-   **Game Engine**: Tick-based loop (50ms), resource management, staff scheduling.
-   **UI**: Status rail, Tab system, Job browser, Option details, Active run monitoring.
-   **Data**: "Street" branch with "Shoplifting" activity and outcomes.
