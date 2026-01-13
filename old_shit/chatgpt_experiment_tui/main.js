import { Engine } from "./engine.js";
import { TuiRenderer } from "./tui_renderer.js";

const WIDTH = 112;
const HEIGHT = 38;
const renderer = new TuiRenderer("game", WIDTH, HEIGHT);
const engine = new Engine();

const ui = {
  tab: "activities", // activities, runs, log, settings
  focus: "activity", // branch | activity | option
  branchIndex: 0,
  activityIndex: 0,
  optionIndex: 0,
  logOffset: 0,
  settings: loadSettings()
};

document.addEventListener("keydown", handleInput);

async function main() {
  await engine.init();
  applyFont();
  render();
  setInterval(() => {
    engine.tick();
    render();
  }, 200);
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("ccv_tui_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.font === "scp" || parsed.font === "vga") return parsed;
    }
  } catch (err) {
    console.warn("Settings load failed", err);
  }
  return { font: "vga" };
}

function saveSettings() {
  try {
    localStorage.setItem("ccv_tui_settings", JSON.stringify(ui.settings));
  } catch (err) {
    console.warn("Settings save failed", err);
  }
}

function applyFont() {
  const container = document.getElementById("game");
  container.classList.remove("font-vga", "font-scp");
  if (ui.settings.font === "scp") {
    container.classList.add("font-scp");
  } else {
    container.classList.add("font-vga");
  }
}

function handleInput(e) {
  if (e.key === "1") ui.tab = "activities";
  if (e.key === "2") ui.tab = "runs";
  if (e.key === "3") ui.tab = "log";
  if (e.key === "4") ui.tab = "settings";

  if (ui.tab === "activities") handleActivitiesInput(e);
  if (ui.tab === "runs") handleRunsInput(e);
  if (ui.tab === "log") handleLogInput(e);
  if (ui.tab === "settings") handleSettingsInput(e);

  render();
}

function handleActivitiesInput(e) {
  const branches = getVisibleBranches();
  const branch = branches[ui.branchIndex] || branches[0];
  const activities = getVisibleActivities(branch?.id);
  const activity = activities[ui.activityIndex] || activities[0];
  const options = getVisibleOptions(activity);

  if (ui.focus === "branch") {
    if (e.key === "ArrowUp") ui.branchIndex = Math.max(0, ui.branchIndex - 1);
    if (e.key === "ArrowDown") ui.branchIndex = Math.min(branches.length - 1, ui.branchIndex + 1);
    if (e.key === "ArrowRight" || e.key === "Enter") {
      ui.focus = "activity";
      ui.activityIndex = 0;
      ui.optionIndex = 0;
    }
  } else if (ui.focus === "activity") {
    if (e.key === "ArrowUp") ui.activityIndex = Math.max(0, ui.activityIndex - 1);
    if (e.key === "ArrowDown") ui.activityIndex = Math.min(Math.max(0, activities.length - 1), ui.activityIndex + 1);
    if (e.key === "ArrowLeft") ui.focus = "branch";
    if (e.key === "ArrowRight" || e.key === "Enter") {
      ui.focus = "option";
      ui.optionIndex = 0;
    }
  } else if (ui.focus === "option") {
    if (e.key === "ArrowUp") ui.optionIndex = Math.max(0, ui.optionIndex - 1);
    if (e.key === "ArrowDown") ui.optionIndex = Math.min(Math.max(0, options.length - 1), ui.optionIndex + 1);
    if (e.key === "ArrowLeft") ui.focus = "activity";
    if (e.key === "Enter") startSelectedRun(activity, options[ui.optionIndex]);
  }
}

function handleRunsInput(e) {
  // Placeholder for future run management (drop/inspect)
  if (e.key === "Escape") ui.tab = "activities";
}

function handleLogInput(e) {
  const maxOffset = Math.max(0, engine.state.log.length - 1);
  if (e.key === "ArrowUp") ui.logOffset = Math.min(maxOffset, ui.logOffset + 1);
  if (e.key === "ArrowDown") ui.logOffset = Math.max(0, ui.logOffset - 1);
}

function handleSettingsInput(e) {
  if (e.key === "Enter" || e.key === " ") {
    ui.settings.font = ui.settings.font === "vga" ? "scp" : "vga";
    applyFont();
    saveSettings();
  }
}

function startSelectedRun(activity, option) {
  if (!activity || !option) return;
  const result = engine.startRun(activity.id, option.id);
  if (!result.ok) {
    engine.log(`Start failed: ${result.reason}`, "error");
  }
}

function render() {
  syncSelection();
  renderer.clear();
  renderStatusRail();
  renderTabBar();

  if (ui.tab === "activities") renderActivitiesTab();
  if (ui.tab === "runs") renderRunsTab();
  if (ui.tab === "log") renderLogTab();
  if (ui.tab === "settings") renderSettingsTab();

  renderer.render();
}

function syncSelection() {
  const branches = getVisibleBranches();
  if (branches.length === 0) {
    ui.branchIndex = 0;
    ui.activityIndex = 0;
    ui.optionIndex = 0;
    return;
  }
  ui.branchIndex = clamp(ui.branchIndex, 0, branches.length - 1);
  const branch = branches[ui.branchIndex];
  const activities = getVisibleActivities(branch?.id);
  if (activities.length === 0) {
    ui.activityIndex = 0;
    ui.optionIndex = 0;
    return;
  }
  ui.activityIndex = clamp(ui.activityIndex, 0, activities.length - 1);
  const options = getVisibleOptions(activities[ui.activityIndex]);
  if (options.length === 0) {
    ui.optionIndex = 0;
    return;
  }
  ui.optionIndex = clamp(ui.optionIndex, 0, options.length - 1);
}

function renderStatusRail() {
  renderer.drawBox(0, 0, WIDTH, 3, "CRIME COMMITTER VI", "thin", "#0cf");
  const cash = fmtNum(engine.state.resources.cash);
  const heat = Math.floor(engine.state.resources.heat);
  const cred = Math.floor(engine.state.resources.cred);
  const runCount = engine.state.runs.length;
  const clock = new Date(engine.state.now).toLocaleTimeString();

  renderer.write(2, 1, `CASH $${cash}`, "#8ef");
  renderer.write(20, 1, `HEAT ${heat}`, heat > 50 ? "#f66" : "#ff8");
  renderer.write(35, 1, `CRED ${cred}`, "#9f6");
  renderer.write(50, 1, `RUNS ${runCount}`, "#0f0");
  renderer.write(WIDTH - 14, 1, clock.padStart(12), "#777");
}

function renderTabBar() {
  const tabs = [
    { id: "activities", label: "1 ACTIVITIES" },
    { id: "runs", label: "2 ACTIVE" },
    { id: "log", label: "3 LOG" },
    { id: "settings", label: "4 SETTINGS" }
  ];
  let x = 1;
  const y = 3;
  tabs.forEach((tab) => {
    const active = tab.id === ui.tab;
    const text = `[${tab.label}]`;
    const color = active ? "#000" : "#888";
    const bg = active ? "#0f0" : null;
    renderer.write(x, y, text, color, bg);
    x += text.length + 1;
  });
  renderer.write(70, y, "ARROWS NAV | ENTER SELECT | 1-4 SWITCH", "#444");
}

function renderActivitiesTab() {
  const top = 4;
  const branchW = 18;
  const activityW = 34;
  const detailW = WIDTH - branchW - activityW;
  const branches = getVisibleBranches();
  const branch = branches[ui.branchIndex] || branches[0];
  const activities = getVisibleActivities(branch?.id);
  const activity = activities[ui.activityIndex] || activities[0];
  const options = getVisibleOptions(activity);

  renderer.drawBox(0, top, branchW, HEIGHT - top, "BRANCH", "thin", "#0f0");
  renderer.drawBox(branchW, top, activityW, HEIGHT - top, "ACTIVITY", "thin", "#0af");
  renderer.drawBox(branchW + activityW, top, detailW, HEIGHT - top, "OPTIONS", "thin", "#f0f");

  branches.forEach((b, i) => {
    const row = top + 1 + i;
    const selected = ui.focus === "branch" && ui.branchIndex === i;
    renderer.write(2, row, b.name.padEnd(branchW - 3).slice(0, branchW - 3), selected ? "#000" : "#9f9", selected ? "#0f0" : null);
  });

  activities.slice(0, HEIGHT - top - 2).forEach((a, i) => {
    const row = top + 1 + i;
    const selected = ui.focus === "activity" && ui.activityIndex === i;
    const prefix = selected ? ">" : " ";
    const text = `${prefix} ${a.name}`.padEnd(activityW - 2).slice(0, activityW - 2);
    renderer.write(branchW + 1, row, text, selected ? "#000" : "#8bd", selected ? "#0af" : null);
  });

  if (activity) {
    renderer.write(branchW + activityW + 2, top + 1, activity.name.toUpperCase(), "#0ff");
    const descLines = wrapText(activity.description || "", detailW - 4);
    descLines.slice(0, 2).forEach((line, idx) => {
      renderer.write(branchW + activityW + 2, top + 2 + idx, line, "#aaa");
    });

    const startY = top + 5;
    options.forEach((opt, i) => {
      const y = startY + i * 4;
      const selected = ui.focus === "option" && ui.optionIndex === i;
      renderer.drawDivider(branchW + activityW + 1, y, detailW - 2, opt.name, selected ? "#0f0" : "#666");
      renderer.write(branchW + activityW + 2, y + 1, `Duration: ${formatMs(opt.durationMs)}`, "#888");
      renderer.write(branchW + activityW + 2, y + 2, `Req: ${describeRequirements(opt.requirements)}`, "#888");
      renderer.write(branchW + activityW + 2, y + 3, `Outcome: ${summarizeResolution(opt.resolution)}`, "#777");
      if (selected) {
        renderer.write(branchW + activityW + detailW - 16, y + 1, "[ENTER] START", "#0f0");
      }
    });
  } else {
    renderer.write(branchW + activityW + 2, top + 2, "No activity available.", "#666");
  }
}

function renderRunsTab() {
  const top = 5;
  renderer.write(2, top - 1, "ACTIVE OPERATIONS", "#0f0");
  if (engine.state.runs.length === 0) {
    renderer.write(2, top + 1, "No active runs. Start something risky.", "#555");
    return;
  }
  engine.state.runs.slice(0, HEIGHT - top - 2).forEach((run, idx) => {
    const y = top + idx * 3;
    const activity = engine.data.activities.find((a) => a.id === run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);
    const label = `${activity?.name || "?"} / ${option?.name || "?"}`;
    const pct = Math.min(1, Math.max(0, (engine.state.now - run.startedAt) / (run.endsAt - run.startedAt)));
    renderer.write(2, y, label.padEnd(WIDTH - 4).slice(0, WIDTH - 4), "#9cf");
    renderer.drawProgress(2, y + 1, WIDTH - 4, pct, "#0ff");
  });
}

function renderLogTab() {
  const top = 5;
  const maxRows = HEIGHT - top - 2;
  renderer.write(2, top - 1, "LOG (UP/DOWN TO SCROLL)", "#0f0");

  const entries = engine.state.log.slice(ui.logOffset, ui.logOffset + maxRows);
  entries.forEach((entry, idx) => {
    const y = top + idx;
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const color = entry.type === "error" ? "#f66" : entry.type === "success" ? "#0f0" : "#9cf";
    renderer.write(2, y, `[${time}] ${entry.message}`.slice(0, WIDTH - 4), color);
  });
}

function renderSettingsTab() {
  const top = 6;
  renderer.write(2, top - 2, "SETTINGS", "#0f0");
  renderer.drawBox(2, top, WIDTH - 4, 6, "DISPLAY", "thin", "#0af");
  renderer.write(4, top + 2, "Font", "#9cf");
  const fontText = ui.settings.font === "vga" ? "VGA (retro grid)" : "Source Code Pro (modern)";
  renderer.write(18, top + 2, fontText, "#fff", "#111");
  renderer.write(WIDTH - 18, top + 2, "<ENTER> TOGGLE", "#0f0");
}

function getVisibleBranches() {
  return engine.data.branches
    .filter((b) => engine.state.reveals.branches[b.id])
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function getVisibleActivities(branchId) {
  return engine.data.activities
    .filter((a) => !branchId || a.branchId === branchId)
    .filter((a) => engine.isActivityVisible(a))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function getVisibleOptions(activity) {
  if (!activity) return [];
  return (activity.options || [])
    .filter((opt) => engine.checkConditions(opt.visibleIf || []))
    .filter((opt) => engine.isOptionUnlocked(opt));
}

function describeRequirements(req) {
  const staffReqs = req?.staff || [];
  if (staffReqs.length === 0) return "none";
  return staffReqs
    .map((s) => `${s.count} ${s.roleId}${s.starsMin ? ` ${s.starsMin}+*` : ""}`)
    .join(", ");
}

function summarizeResolution(resolution) {
  if (!resolution) return "unknown";
  if (resolution.type === "deterministic") return "fixed result";
  if (resolution.type === "ranged_outputs") return "ranged output";
  if (resolution.type === "weighted_outcomes") {
    const topOutcome = resolution.outcomes?.[0];
    return topOutcome ? `weighted: ${topOutcome.id}` : "weighted";
  }
  return "unknown";
}

function formatMs(ms) {
  if (!ms) return "instant";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function wrapText(text, width) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if ((line + word).length > width) {
      lines.push(line.trim());
      line = "";
    }
    line += `${word} `;
  });
  if (line.trim()) lines.push(line.trim());
  return lines;
}

function fmtNum(num) {
  return Math.round(num).toLocaleString();
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

main();
