import { Engine } from "./engine.js";
import { FrameBuffer } from "./framebuffer.js";
import { DOMGridRenderer } from "./renderer_dom.js";
import { Lexicon } from "./lexicon.js";
import { UI } from "./ui.js";
import { Palette } from "./palette.js";

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}

async function init() {
  const [branches, activities, roles, resources, lexiconData] = await Promise.all([
    loadJson("./data/branches.json"),
    loadJson("./data/activities.json"),
    loadJson("./data/roles.json"),
    loadJson("./data/resources.json"),
    loadJson("./data/lexicon.json"),
  ]);

  const data = { branches, activities, roles, resources };
  const lexicon = new Lexicon(lexiconData);
  const engine = new Engine(data, lexicon);
  engine.load();

  const buffer = new FrameBuffer(80, 25, Palette.LIGHT_GRAY, Palette.BLACK);
  const renderer = new DOMGridRenderer(buffer, document.getElementById("screen"));
  const ui = new UI(buffer, renderer, engine, lexicon, data);

  engine.on("stateChange", () => ui.renderAll());
  engine.on("runsCompleted", () => ui.renderAll());
  engine.on("runStarted", () => ui.renderAll());
  engine.on("runCancelled", () => ui.renderAll());
  engine.on("runCompleted", () => ui.renderAll());
  engine.on("tick", () => ui.updateProgressBars());

  document.addEventListener("keydown", (event) => {
    const keysToBlock = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Backspace",
      "Tab",
    ];
    if (keysToBlock.includes(event.key)) {
      event.preventDefault();
    }
    ui.handleKey(event);
  });

  ui.renderAll();
  engine.start();
}

init().catch((err) => {
  const screen = document.getElementById("screen");
  if (screen) {
    screen.textContent = "Failed to start: " + err.message;
  }
  console.error(err);
});
