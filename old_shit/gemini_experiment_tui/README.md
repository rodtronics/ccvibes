# Gemini Experiment TUI

This is a Text User Interface (TUI) implementation of the Crime Committer VI game, running in the browser.

## How to Run

Because this game uses `fetch` to load JSON data from the `../data/` directory, it **cannot** be run by simply opening `index.html` in a browser (due to CORS/file protocol restrictions).

You must serve the project root (or at least the parent of `gemini_experiment_tui` and `data`) via a local web server.

### using Python (simplest)
1. Open a terminal in the **root** of the repo (`.../ccvibes/ccvibes/`).
2. Run: `python -m http.server`
3. Go to: `http://localhost:8000/gemini_experiment_tui/`

### using Node/VS Code
- Use the "Live Server" extension in VS Code.
- Or run `npx http-server` in the root.

## Controls

- **Arrow Up/Down**: Navigate lists (Activities, Options).
- **Enter**: Select Activity / Start Run (on an Option).
- **Arrow Right**: Move focus to Options.
- **Arrow Left / Esc**: Back to Activity list.
- **1, 2, 3**: Switch Tabs (Activities, Runs, Log).
