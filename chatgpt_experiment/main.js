const DATA_ROOT = "../data";
const DATA_FILES = {
  activities: "activities.json",
  branches: "branches.json",
  resources: "resources.json",
  roles: "roles.json",
  items: "items.json",
  lexicon: "lexicon.json"
};

const HEAT_DECAY_PER_SECOND = 0.02;
const TICK_MS = 250;

const dataStore = {
  activities: [],
  branches: [],
  resources: [],
  roles: [],
  items: [],
  lexicon: {}
};

const indexById = {
  activities: new Map(),
  branches: new Map(),
  resources: new Map(),
  roles: new Map(),
  items: new Map()
};

const state = {
  version: 6,
  now: Date.now(),
  resources: {},
  items: {},
  flags: {},
  reveals: { branches: {}, activities: {}, resources: {}, roles: {}, tabs: {} },
  crew: { staff: [] },
  runs: [],
  repeatQueues: {},
  persistentOperations: [],
  completions: { activity: {}, option: {} },
  log: []
};

const uiState = {
  selectedBranch: null,
  selectedActivityId: null,
  repeatRequests: {}
};

const Lexicon = {
  data: {},
  load(payload) {
    this.data = payload || {};
  },
  get(path) {
    const parts = path.split(".");
    let node = this.data;
    for (const p of parts) {
      if (!node || typeof node !== "object") return null;
      node = node[p];
    }
    return typeof node === "string" ? node : null;
  },
  template(path, vars = {}) {
    const base = this.get(path);
    if (!base) return null;
    return base.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? vars[key] : ""));
  }
};

async function boot() {
  await loadData();
  Lexicon.load(dataStore.lexicon);
  initState();
  refreshDiscoveries();
  wireTabs();
  renderAll();
  startLoop();
}

async function loadData() {
  const loaders = [
    loadJsonFile(DATA_FILES.activities, []),
    loadJsonFile(DATA_FILES.branches, []),
    loadJsonFile(DATA_FILES.resources, []),
    loadJsonFile(DATA_FILES.roles, []),
    loadJsonFile(DATA_FILES.items, []),
    loadJsonFile(DATA_FILES.lexicon, {})
  ];
  const [
    activitiesRaw,
    branchesRaw,
    resourcesRaw,
    rolesRaw,
    itemsRaw,
    lexiconRaw
  ] = await Promise.all(loaders);

  dataStore.activities = dedupeById(activitiesRaw);
  dataStore.branches = dedupeById(branchesRaw);
  dataStore.resources = dedupeById(resourcesRaw);
  dataStore.roles = dedupeById(rolesRaw);
  dataStore.items = dedupeById(itemsRaw);
  dataStore.lexicon = lexiconRaw || {};

  buildIndexes();
}

function buildIndexes() {
  indexById.activities = mapById(dataStore.activities);
  indexById.branches = mapById(dataStore.branches);
  indexById.resources = mapById(dataStore.resources);
  indexById.roles = mapById(dataStore.roles);
  indexById.items = mapById(dataStore.items);
}

function mapById(list) {
  const map = new Map();
  list.forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return map;
}

async function loadJsonFile(filename, fallback) {
  const res = await fetch(`${DATA_ROOT}/${filename}`);
  const text = await res.text();
  return parseJsonWithRecovery(text, fallback, filename);
}

function parseJsonWithRecovery(raw, fallback, label = "json") {
  const trimmed = raw.trim();
  if (!trimmed) return clone(fallback);
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const softened = trimmed
      .replace(/}\s*{/g, "},{")
      .replace(/]\s*{/g, "],{")
      .replace(/,(\s*])/g, "$1");
    try {
      return JSON.parse(softened);
    } catch (err2) {
      console.warn(`Failed to parse ${label}, using fallback`, err2);
      return clone(fallback);
    }
  }
}

function dedupeById(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Map();
  list.forEach((item) => {
    if (item && item.id) {
      seen.set(item.id, { ...seen.get(item.id), ...item });
    }
  });
  return Array.from(seen.values());
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function initState() {
  state.resources = {};
  state.items = {};
  state.flags = {};
  state.reveals = { branches: {}, activities: {}, resources: {}, roles: {}, tabs: {} };
  state.crew = {
    staff: [
      {
        id: "s_mastermind",
        name: "you",
        roleId: "player",
        xp: 0,
        status: "available",
        unavailableUntil: 0
      }
    ]
  };
  state.runs = [];
  state.repeatQueues = {};
  state.persistentOperations = [];
  state.completions = { activity: {}, option: {} };
  state.log = [];

  dataStore.resources.forEach((res) => {
    const base = res.id === "cred" ? 50 : 0;
    state.resources[res.id] = base;
    if (res.revealedByDefault) state.reveals.resources[res.id] = true;
  });

  dataStore.items.forEach((item) => {
    state.items[item.id] = 0;
  });

  dataStore.branches.forEach((branch) => {
    if (branch.revealedByDefault) state.reveals.branches[branch.id] = true;
  });

  dataStore.roles.forEach((role) => {
    if (role.revealedByDefault) state.reveals.roles[role.id] = true;
  });

  const firstBranch = dataStore.branches.find((b) => state.reveals.branches[b.id]) || dataStore.branches[0];
  uiState.selectedBranch = firstBranch ? firstBranch.id : null;
  uiState.selectedActivityId = null;
}

function refreshDiscoveries() {
  dataStore.activities.forEach((activity) => {
    if (evaluateConditions(activity.visibleIf)) {
      state.reveals.activities[activity.id] = true;
    }
    if (evaluateConditions(activity.unlockIf)) {
      state.reveals.activities[activity.id] = true;
    }
  });
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".panel").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === target);
      });
    });
  });
}

function renderAll() {
  renderStatusRail();
  renderBranches();
  renderActivities();
  renderCrew();
  renderResources();
  renderItems();
  renderActiveRuns();
  renderLogs();
}

function renderStatusRail() {
  const cashLabel = Lexicon.get("labels.cash") || "CASH";
  const heatLabel = Lexicon.get("labels.heat") || "HEAT";
  const runsLabel = Lexicon.get("labels.runs") || "RUNS";
  const cash = formatNumber(state.resources.cash || 0);
  const heat = formatNumber(state.resources.heat || 0);
  const runs = state.runs.length;
  const now = new Date(state.now);
  const clock = now.toLocaleTimeString();

  const statNodes = {
    cash: `${cashLabel} $${cash}`,
    heat: `${heatLabel} ${heat}`,
    runs: `${runsLabel} ${runs}`,
    clock
  };

  document.querySelectorAll(".stat").forEach((node) => {
    const key = node.dataset.stat;
    if (!key) return;
    node.innerHTML = `<span class="label">${key.toUpperCase()}</span><span class="value">${statNodes[key] || ""}</span>`;
  });
}

function renderBranches() {
  const container = document.getElementById("branch-list");
  container.innerHTML = "";
  const branches = dataStore.branches
    .filter((b) => state.reveals.branches[b.id])
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (!branches.length) {
    container.innerHTML = `<div class="muted">No branches discovered.</div>`;
    return;
  }

  branches.forEach((branch) => {
    const card = document.createElement("button");
    card.className = `branch-card ${uiState.selectedBranch === branch.id ? "active" : ""}`;
    card.innerHTML = `
      <div class="title-row">
        <div>${branch.name || branch.id}</div>
        <div class="badge">${branch.ui?.accent || ""}</div>
      </div>
      <div class="muted">${branch.description || "branch"}</div>
    `;
    card.addEventListener("click", () => {
      uiState.selectedBranch = branch.id;
      uiState.selectedActivityId = null;
      renderActivities();
    });
    container.appendChild(card);
  });
}

function renderActivities() {
  const label = document.getElementById("activity-branch-label");
  const list = document.getElementById("activity-list");
  const detail = document.getElementById("option-detail");

  const branch = uiState.selectedBranch ? indexById.branches.get(uiState.selectedBranch) : null;
  label.textContent = branch ? branch.name : "Unknown";

  list.innerHTML = "";
  detail.innerHTML = "Select an activity to view options.";
  detail.classList.add("muted");

  const activities = dataStore.activities
    .filter((a) => (!branch || a.branchId === branch.id) && isActivityVisible(a))
    .sort((a, b) => a.name.localeCompare(b.name));

  activities.forEach((activity) => {
    const unlocked = isActivityUnlocked(activity);
    const card = document.createElement("button");
    card.className = `activity-card ${uiState.selectedActivityId === activity.id ? "active" : ""}`;
    card.innerHTML = `
      <div class="title-row">
        <div>${activity.name}</div>
        <div class="badge ${unlocked ? "ok" : "warn"}">${unlocked ? "ACTIVE" : "LOCKED"}</div>
      </div>
      <div class="muted">${activity.description || ""}</div>
      <div class="requirements">Tags: ${(activity.meta?.tags || []).map((t) => `<span class="tag">${t}</span>`).join(" ")}</div>
    `;
    card.addEventListener("click", () => {
      uiState.selectedActivityId = activity.id;
      renderActivityDetail(activity);
    });
    list.appendChild(card);
  });

  if (uiState.selectedActivityId) {
    const selected = indexById.activities.get(uiState.selectedActivityId);
    if (selected) renderActivityDetail(selected);
  }
}

function renderActivityDetail(activity) {
  const detail = document.getElementById("option-detail");
  detail.classList.remove("muted");
  detail.innerHTML = "";

  const header = document.createElement("div");
  header.innerHTML = `<div class="title-row"><div>${activity.name}</div><div class="badge">${activity.branchId}</div></div><div class="muted">${activity.description}</div>`;
  detail.appendChild(header);

  const options = activity.options || [];
  if (!options.length) {
    detail.innerHTML += `<div class="muted">No options yet.</div>`;
    return;
  }

  options.forEach((option) => {
    const visible = isOptionVisible(option);
    if (!visible) return;
    const unlocked = isOptionUnlocked(activity, option);
    const optionCard = document.createElement("div");
    optionCard.className = "option-card";
    const repeatState = getRepeatState(option.id);
    const durationText = formatDuration(option.durationMs);
    optionCard.innerHTML = `
      <div class="option-header">
        <div>${option.name}</div>
        <div class="badge">${durationText}</div>
      </div>
      <div class="muted">${option.description || ""}</div>
      ${renderRequirements(option)}
      ${renderInputs(option)}
      ${renderResolutionPreview(option)}
      ${option.maxConcurrentRuns ? `<div class="muted">Max concurrent: ${option.maxConcurrentRuns}</div>` : ""}
      <div class="controls">
        ${option.repeatable ? renderRepeatControl(option.id, repeatState) : ""}
        <button class="ghost" data-auto="${option.id}">AUTO</button>
        <button class="primary" ${unlocked ? "" : "disabled"} data-activity="${activity.id}" data-option="${option.id}">COMMIT</button>
      </div>
    `;

    optionCard.querySelector("button.primary").addEventListener("click", () => {
      openAssignmentModal(activity, option, getRepeatState(option.id));
    });

    const autoBtn = optionCard.querySelector(`button[data-auto="${option.id}"]`);
    autoBtn.addEventListener("click", () => {
      attemptAutoStart(activity, option, getRepeatState(option.id));
    });

    if (option.repeatable) {
      const countInput = optionCard.querySelector(`input[data-repeat="${option.id}"]`);
      const infiniteBtn = optionCard.querySelector(`button[data-repeat-infinite="${option.id}"]`);
      const finiteBtn = optionCard.querySelector(`button[data-repeat-finite="${option.id}"]`);
      countInput.addEventListener("input", () => {
        const parsed = Number(countInput.value);
        uiState.repeatRequests[option.id] = { mode: "finite", count: Number.isFinite(parsed) ? Math.max(1, parsed) : 1 };
      });
      infiniteBtn.addEventListener("click", () => {
        uiState.repeatRequests[option.id] = { mode: "infinite", count: "infinite" };
        renderActivityDetail(activity);
      });
      finiteBtn.addEventListener("click", () => {
        uiState.repeatRequests[option.id] = { mode: "finite", count: repeatState.count === "infinite" ? 1 : repeatState.count };
        renderActivityDetail(activity);
      });
    }

    detail.appendChild(optionCard);
  });
}

function renderRequirements(option) {
  const staffReqs = option.requirements?.staff || [];
  if (!staffReqs.length) return `<div class="muted">No crew required.</div>`;
  const rows = staffReqs
    .map((req) => {
      const label = `${req.roleId} x${req.count || 1} ${req.starsMin ? `(${req.starsMin}+ stars)` : ""}`;
      return `<span class="badge ${req.required === false ? "" : "warn"}">${label}</span>`;
    })
    .join(" ");
  return `<div class="requirements">Crew: ${rows}</div>`;
}

function renderInputs(option) {
  const inputs = option.inputs || {};
  const res = inputs.resources || {};
  const items = inputs.items || {};
  const resEntries = Object.entries(res);
  const itemEntries = Object.entries(items);
  if (!resEntries.length && !itemEntries.length) return `<div class="muted">Inputs: none</div>`;
  const resText = resEntries.map(([id, amount]) => `${id}: ${amount}`).join(", ");
  const itemText = itemEntries.map(([id, amount]) => `${id}: ${amount}`).join(", ");
  const parts = [];
  if (resText) parts.push(resText);
  if (itemText) parts.push(itemText);
  return `<div class="muted">Inputs: ${parts.join(" | ")}</div>`;
}

function renderResolutionPreview(option) {
  const res = option.resolution || {};
  if (!res.type) return `<div class="muted">Resolution: n/a</div>`;
  if (res.type === "deterministic") {
    const outputs = renderOutputs(res.outputs);
    const deltas = renderDeltas(res);
    return `<div class="muted">Resolution: deterministic | ${outputs} ${deltas}</div>`;
  }
  if (res.type === "ranged_outputs") {
    const outputs = renderOutputs(res.outputs, true);
    const deltas = renderDeltas(res);
    return `<div class="muted">Resolution: ranged | ${outputs} ${deltas}</div>`;
  }
  if (res.type === "weighted_outcomes") {
    const lines = (res.outcomes || [])
      .map((o) => `${o.id} [${o.weight}%]: ${renderOutputs(o.outputs, true)} ${renderDeltas(o)}`)
      .join("<br>");
    return `<div class="muted">Resolution: weighted<br>${lines}</div>`;
  }
  return `<div class="muted">Resolution: ${res.type}</div>`;
}

function renderOutputs(outputs = {}, ranged = false) {
  const res = outputs.resources || {};
  const items = outputs.items || {};
  const resText = Object.entries(res)
    .map(([id, val]) => `${id}: ${formatRange(val, ranged)}`)
    .join(", ");
  const itemText = Object.entries(items)
    .map(([id, val]) => `${id}: ${formatRange(val, ranged)}`)
    .join(", ");
  return [resText, itemText].filter(Boolean).join(" | ") || "no outputs";
}

function renderDeltas(node = {}) {
  const parts = [];
  if (node.heatDelta !== undefined) parts.push(`heat ${formatRange(node.heatDelta, true, true)}`);
  if (node.credDelta !== undefined) parts.push(`cred ${formatRange(node.credDelta, true, true)}`);
  return parts.length ? `| ${parts.join(" | ")}` : "";
}

function formatRange(val, ranged, signed = false) {
  if (val === undefined || val === null) return "-";
  if (typeof val === "object") {
    const min = val.min ?? 0;
    const max = val.max ?? min;
    return `${signed ? prefix(min) : min} to ${signed ? prefix(max) : max}`;
  }
  return signed ? prefix(val) : val;
}

function prefix(val) {
  const n = Number(val) || 0;
  return n > 0 ? `+${n}` : `${n}`;
}

function attemptAutoStart(activity, option, repeatState) {
  const staffIds = autoAssign(option);
  if (!staffIds || !staffIds.length) {
    logEvent("No available crew for autostart", "warn");
    return;
  }
  const ok = startRun(activity, option, staffIds, repeatState);
  if (!ok) logEvent("Autostart failed", "warn");
}

function autoAssign(option) {
  const reqs = (option.requirements?.staff || []).filter((r) => r.required !== false);
  const chosen = [];
  const used = new Set();
  for (const req of reqs) {
    const count = req.count || 1;
    const candidates = shuffle(
      availableCrewForRole(req.roleId).filter(
        (c) => c.status === "available" && getStars(c.roleId, c.xp) >= (req.starsMin || 0) && !used.has(c.id)
      )
    );
    for (let i = 0; i < count; i++) {
      const pick = candidates[i];
      if (!pick) return null;
      chosen.push(pick.id);
      used.add(pick.id);
    }
  }
  return chosen;
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRepeatState(optionId) {
  const current = uiState.repeatRequests[optionId];
  if (current) return current;
  uiState.repeatRequests[optionId] = { mode: "finite", count: 1 };
  return uiState.repeatRequests[optionId];
}

function renderRepeatControl(optionId, repeatState) {
  const repeatLabel = Lexicon.get("actions.repeat") || "REPEAT";
  const repeatInfinite = Lexicon.get("actions.repeat_infinite") || "INFINITE";
  return `
    <div class="repeat-control">
      <span class="muted">${repeatLabel}</span>
      <input type="number" min="1" value="${repeatState.count === "infinite" ? 1 : repeatState.count}" data-repeat="${optionId}" />
      <button class="ghost" data-repeat-finite="${optionId}">FINITE</button>
      <button class="ghost" data-repeat-infinite="${optionId}">${repeatInfinite}</button>
    </div>
  `;
}

function isActivityVisible(activity) {
  if (state.reveals.activities[activity.id]) return true;
  return evaluateConditions(activity.visibleIf);
}

function isActivityUnlocked(activity) {
  return evaluateConditions(activity.unlockIf);
}

function isOptionVisible(option) {
  return evaluateConditions(option.visibleIf);
}

function isOptionUnlocked(activity, option) {
  return isActivityUnlocked(activity) && evaluateConditions(option.unlockIf);
}

function evaluateConditions(conds) {
  if (!conds || !conds.length) return true;
  return conds.every((cond) => evaluateCondition(cond));
}

function evaluateCondition(cond) {
  if (!cond || !cond.type) return true;
  switch (cond.type) {
    case "flagIs":
      return state.flags[cond.key] === cond.value;
    case "resourceGte":
      return (state.resources[cond.resourceId] || 0) >= cond.value;
    case "itemGte":
      return (state.items[cond.itemId] || 0) >= cond.value;
    case "roleRevealed":
      return !!state.reveals.roles[cond.roleId];
    case "activityRevealed":
      return !!state.reveals.activities[cond.activityId];
    case "staffStarsGte": {
      const stars = getHighestStars(cond.roleId);
      return stars >= (cond.value || 0);
    }
    case "activityCompletedGte": {
      const val = state.completions.activity[cond.activityId] || 0;
      return val >= (cond.value || 0);
    }
    case "allOf":
      return (cond.conds || []).every((c) => evaluateCondition(c));
    case "anyOf":
      return (cond.conds || []).some((c) => evaluateCondition(c));
    case "not":
      return !evaluateCondition(cond.cond);
    default:
      return true;
  }
}

function getHighestStars(roleId) {
  const staff = state.crew.staff.filter((s) => s.roleId === roleId);
  return staff.reduce((max, s) => Math.max(max, getStars(s.roleId, s.xp)), 0);
}

function getStars(roleId, xp) {
  const role = indexById.roles.get(roleId);
  if (!role || !Array.isArray(role.xpToStars)) return 0;
  let stars = 0;
  role.xpToStars.forEach((row) => {
    if (xp >= row.minXp) stars = row.stars;
  });
  return stars;
}

function openAssignmentModal(activity, option, repeatState) {
  const modal = document.getElementById("modal-layer");
  const title = document.getElementById("modal-title");
  const subtitle = document.getElementById("modal-subtitle");
  const body = document.getElementById("modal-body");
  const summary = document.getElementById("modal-summary");
  const confirm = document.getElementById("modal-confirm");

  title.textContent = activity.name;
  subtitle.textContent = option.name;

  body.innerHTML = "";

  const slots = [];
  (option.requirements?.staff || []).forEach((req) => {
    const count = req.count || 1;
    for (let i = 0; i < count; i++) {
      slots.push({ requirement: req, selection: null });
    }
  });

  slots.forEach((slot, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = `slot ${slot.requirement.required === false ? "" : "required"}`;
    const select = document.createElement("select");
    select.dataset.slotIndex = idx;
    select.innerHTML = `<option value="">None</option>`;
    availableCrewForRole(slot.requirement.roleId).forEach((staff) => {
      const stars = getStars(staff.roleId, staff.xp);
      const status = staff.status;
      const busy = status !== "available";
      select.innerHTML += `<option value="${staff.id}" ${busy ? "disabled" : ""}>${staff.name} [${staff.roleId}] ${"*".repeat(stars)} ${busy ? `(${status})` : ""}</option>`;
    });
    select.addEventListener("change", (e) => {
      const choice = e.target.value || null;
      slot.selection = choice;
      refreshSlotVisuals();
      updateSummary();
    });
    wrapper.innerHTML = `<div>${slot.requirement.roleId} ${slot.requirement.required === false ? "(optional)" : ""}</div>`;
    wrapper.appendChild(select);
    wrapper.innerHTML += `<div class="hint">${slot.requirement.starsMin ? `${slot.requirement.starsMin}+ stars` : "no star requirement"}</div>`;
    body.appendChild(wrapper);
  });

  function refreshSlotVisuals() {
    body.querySelectorAll(".slot").forEach((node, idx) => {
      const slot = slots[idx];
      const ok = validateSlot(slot);
      node.classList.toggle("ready", ok);
    });
    confirm.disabled = !validateAssignments();
  }

  function validateSlot(slot) {
    if (slot.requirement.required === false && !slot.selection) return true;
    if (!slot.selection) return false;
    const crew = findCrew(slot.selection);
    if (!crew) return false;
    if (crew.status !== "available") return false;
    const stars = getStars(crew.roleId, crew.xp);
    return stars >= (slot.requirement.starsMin || 0);
  }

  function validateAssignments() {
    const chosenIds = slots.map((s) => s.selection).filter(Boolean);
    if (new Set(chosenIds).size !== chosenIds.length) return false;
    return slots.every(validateSlot);
  }

  function updateSummary() {
    const chosen = slots.map((s) => s.selection).filter(Boolean);
    const repeatText =
      repeatState.mode === "infinite"
        ? `${Lexicon.get("actions.repeat_infinite") || "REPEAT"}`
        : `${Lexicon.get("actions.repeat") || "REPEAT"} ${repeatState.count}x`;
    summary.textContent = `${chosen.length} assigned | ${repeatText}`;
  }

  confirm.onclick = () => {
    const staffIds = slots.map((s) => s.selection).filter(Boolean);
    const ok = startRun(activity, option, staffIds, repeatState);
    if (ok) closeModal();
  };

  document.getElementById("modal-close").onclick = closeModal;
  document.getElementById("modal-cancel").onclick = closeModal;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  refreshSlotVisuals();
  updateSummary();
}

function closeModal() {
  const modal = document.getElementById("modal-layer");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function availableCrewForRole(roleId) {
  return state.crew.staff.filter((s) => s.roleId === roleId);
}

function findCrew(id) {
  return state.crew.staff.find((s) => s.id === id);
}

function startRun(activity, option, staffIds, repeatState) {
  if (!staffIds || !staffIds.length) {
    logEvent(Lexicon.get("errors.no_staff") || "No staff selected", "warn");
    return false;
  }

  if (option.maxConcurrentRuns) {
    const active = state.runs.filter((r) => r.optionId === option.id).length;
    if (active >= option.maxConcurrentRuns) {
      logEvent("Max concurrent runs reached", "warn");
      return false;
    }
  }

  if (!validateOptionRequirements(option, staffIds)) {
    logEvent(Lexicon.get("errors.requirements_not_met") || "Requirements not met", "warn");
    return false;
  }

  if (!hasInputs(option.inputs)) {
    logEvent(Lexicon.get("errors.insufficient_resources") || "Insufficient resources", "warn");
    return false;
  }

  const modifiers = computeModifiers(option, staffIds);
  const duration = Math.round(option.durationMs * (modifiers.durationMultiplier || 1));

  payInputs(option.inputs);

  const startedAt = Date.now();
  const runId = `run_${startedAt}_${Math.random().toString(16).slice(2, 6)}`;
  state.runs.push({
    runId,
    activityId: activity.id,
    optionId: option.id,
    startedAt,
    endsAt: startedAt + duration,
    assignedStaffIds: staffIds,
    snapshot: { inputsPaid: option.inputs || {}, plannedOutcomeId: null },
    modifiers
  });

  staffIds.forEach((id) => {
    const crew = findCrew(id);
    if (crew) crew.status = "busy";
  });

  if (option.repeatable && repeatState) {
    const remaining = repeatState.mode === "infinite" ? "infinite" : repeatState.count;
    state.repeatQueues[runId] = {
      activityId: activity.id,
      optionId: option.id,
      remaining,
      total: repeatState.mode === "infinite" ? "infinite" : repeatState.count,
      boundRunId: runId,
      staffIds
    };
  }

  const message =
    Lexicon.template("log_templates.run_started", { activityName: activity.name, optionName: option.name }) ||
    `Started: ${activity.name} -> ${option.name}`;
  logEvent(message, "info");
  renderStatusRail();
  renderActiveRuns();
  renderActivities();
  return true;
}

function validateOptionRequirements(option, staffIds) {
  const reqs = option.requirements?.staff || [];
  const counts = {};
  for (const id of staffIds) {
    const crew = findCrew(id);
    if (!crew) return false;
    counts[crew.roleId] = (counts[crew.roleId] || 0) + 1;
    if (crew.status !== "available") return false;
  }

  for (const req of reqs) {
    const need = req.count || 1;
    const have = counts[req.roleId] || 0;
    if (req.required === false) continue;
    if (have < need) return false;
    const matchedCrew = staffIds
      .map(findCrew)
      .filter((c) => c && c.roleId === req.roleId)
      .slice(0, need);
    if (matchedCrew.some((c) => getStars(c.roleId, c.xp) < (req.starsMin || 0))) return false;
  }
  return true;
}

function hasInputs(inputs = {}) {
  const resInputs = inputs.resources || {};
  const itemInputs = inputs.items || {};
  for (const [id, amount] of Object.entries(resInputs)) {
    if ((state.resources[id] || 0) < amount) return false;
  }
  for (const [id, amount] of Object.entries(itemInputs)) {
    if ((state.items[id] || 0) < amount) return false;
  }
  return true;
}

function payInputs(inputs = {}) {
  const resInputs = inputs.resources || {};
  const itemInputs = inputs.items || {};
  for (const [id, amount] of Object.entries(resInputs)) {
    state.resources[id] = (state.resources[id] || 0) - amount;
  }
  for (const [id, amount] of Object.entries(itemInputs)) {
    state.items[id] = (state.items[id] || 0) - amount;
  }
}

function computeModifiers(option, staffIds) {
  const base = {
    durationMultiplier: 1,
    outcomeWeightAdjustment: {},
    heatDeltaBonus: 0,
    heatDeltaMultiplier: 1,
    credDeltaBonus: 0,
    credDeltaMultiplier: 1
  };
  const modifiers = option.modifiers || [];
  modifiers.forEach((mod) => {
    if (mod.type === "staffStars") {
      const stars = staffIds
        .map(findCrew)
        .filter((c) => c && c.roleId === mod.roleId)
        .reduce((sum, c) => sum + getStars(c.roleId, c.xp), 0);
      if (mod.applyPerStar) {
        const adj = mod.applyPerStar.outcomeWeightAdjustment || null;
        if (adj) {
          Object.entries(adj).forEach(([outcomeId, delta]) => {
            base.outcomeWeightAdjustment[outcomeId] = (base.outcomeWeightAdjustment[outcomeId] || 0) + delta * stars;
          });
        }
        Object.entries(mod.applyPerStar).forEach(([key, delta]) => {
          if (key.endsWith("WeightDelta")) {
            const outcomeId = key.replace("WeightDelta", "");
            base.outcomeWeightAdjustment[outcomeId] = (base.outcomeWeightAdjustment[outcomeId] || 0) + delta * stars;
          }
        });
      }
    }
    if (mod.type === "staffRole") {
      const hasRole = staffIds.map(findCrew).some((c) => c && c.roleId === mod.roleId);
      if (hasRole && mod.effects) {
        if (mod.effects.durationMultiplier) base.durationMultiplier *= mod.effects.durationMultiplier;
        if (mod.effects.heatDeltaMultiplier) base.heatDeltaMultiplier *= mod.effects.heatDeltaMultiplier;
        if (mod.effects.credDeltaMultiplier) base.credDeltaMultiplier *= mod.effects.credDeltaMultiplier;
        if (mod.effects.credDeltaBonus) base.credDeltaBonus += mod.effects.credDeltaBonus;
        if (mod.effects.heatDeltaBonus) base.heatDeltaBonus += mod.effects.heatDeltaBonus;
        if (mod.effects.outcomeWeightAdjustment) {
          Object.entries(mod.effects.outcomeWeightAdjustment).forEach(([outcomeId, delta]) => {
            base.outcomeWeightAdjustment[outcomeId] = (base.outcomeWeightAdjustment[outcomeId] || 0) + delta;
          });
        }
      }
    }
  });
  return base;
}

function startLoop() {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    const deltaMs = now - lastTick;
    lastTick = now;
    state.now = now;
    decayHeat(deltaMs);
    releaseUnavailableCrew();
    processRuns(now);
    renderLive();
  }, TICK_MS);
}

function decayHeat(deltaMs) {
  const delta = (deltaMs / 1000) * HEAT_DECAY_PER_SECOND;
  state.resources.heat = Math.max(0, (state.resources.heat || 0) - delta);
}

function releaseUnavailableCrew() {
  const now = state.now;
  state.crew.staff.forEach((staff) => {
    if (staff.status === "unavailable" && now >= staff.unavailableUntil) {
      staff.status = "available";
      staff.unavailableUntil = 0;
    }
  });
}

function processRuns(now) {
  const completed = state.runs.filter((run) => now >= run.endsAt);
  if (!completed.length) return;
  completed.forEach((run) => resolveRun(run));
  state.runs = state.runs.filter((run) => now < run.endsAt);
  renderStatusRail();
  renderActiveRuns();
}

function resolveRun(run) {
  const activity = indexById.activities.get(run.activityId);
  const option = activity?.options.find((o) => o.id === run.optionId);
  if (!activity || !option) return;
  const outcome = rollOutcome(option, run);
  applyOutcome(outcome, option, run);
  awardXp(run.assignedStaffIds, option.xpRewards);
  markStaffAvailability(run, outcome);
  bumpCompletions(activity.id, option.id);
  handleRepeatQueue(run);
  renderActivities();
}

function rollOutcome(option, run) {
  const res = option.resolution || {};
  const modifiers = run.modifiers || {};
  if (res.type === "deterministic") {
    return { ...res, chosenOutcomeId: res.id || "deterministic" };
  }
  if (res.type === "ranged_outputs") {
    return {
      type: res.type,
      outputs: rollOutputs(res.outputs),
      heatDelta: rollRange(res.heatDelta),
      credDelta: rollRange(res.credDelta),
      effects: res.effects || [],
      chosenOutcomeId: res.id || "ranged"
    };
  }
  if (res.type === "weighted_outcomes") {
    const adjusted = (res.outcomes || []).map((o) => {
      const delta = modifiers.outcomeWeightAdjustment[o.id] || 0;
      return { ...o, weight: Math.max(0, (o.weight || 0) + delta) };
    });
    const total = adjusted.reduce((sum, o) => sum + o.weight, 0);
    const roll = Math.random() * total;
    let acc = 0;
    let chosen = adjusted[0];
    for (const outcome of adjusted) {
      acc += outcome.weight;
      if (roll <= acc) {
        chosen = outcome;
        break;
      }
    }
    return {
      ...chosen,
      outputs: rollOutputs(chosen.outputs),
      heatDelta: rollRange(chosen.heatDelta),
      credDelta: rollRange(chosen.credDelta),
      chosenOutcomeId: chosen.id
    };
  }
  return { type: "none", outputs: { resources: {}, items: {} }, chosenOutcomeId: "none" };
}

function rollOutputs(outputs = {}) {
  const res = {};
  const items = {};
  Object.entries(outputs.resources || {}).forEach(([id, val]) => {
    res[id] = rollRange(val);
  });
  Object.entries(outputs.items || {}).forEach(([id, val]) => {
    items[id] = rollRange(val);
  });
  return { resources: res, items };
}

function rollRange(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === "object") {
    const min = val.min ?? 0;
    const max = val.max ?? min;
    return Math.round(min + Math.random() * (max - min));
  }
  return val;
}

function applyOutcome(outcome, option, run) {
  const outputs = outcome.outputs || {};
  Object.entries(outputs.resources || {}).forEach(([id, amount]) => {
    state.resources[id] = (state.resources[id] || 0) + amount;
  });
  Object.entries(outputs.items || {}).forEach(([id, amount]) => {
    state.items[id] = (state.items[id] || 0) + amount;
  });

  let heatDelta = outcome.heatDelta ?? 0;
  let credDelta = outcome.credDelta ?? 0;
  const mods = run.modifiers || {};
  heatDelta = (heatDelta + (mods.heatDeltaBonus || 0)) * (mods.heatDeltaMultiplier || 1);
  credDelta = (credDelta + (mods.credDeltaBonus || 0)) * (mods.credDeltaMultiplier || 1);
  state.resources.heat = Math.max(0, (state.resources.heat || 0) + heatDelta);
  if (state.resources.cred !== undefined) {
    state.resources.cred = clamp((state.resources.cred || 0) + credDelta, 0, 100);
  }

  applyEffects(outcome.effects || []);

  const activity = indexById.activities.get(run.activityId);
  const message =
    Lexicon.template("log_templates.run_completed", { activityName: activity?.name || run.activityId, optionName: option.name }) ||
    `Completed: ${activity?.name || run.activityId} -> ${option.name}`;
  logEvent(message, "success");
}

function applyEffects(effects) {
  effects.forEach((effect) => {
    switch (effect.type) {
      case "revealBranch":
        state.reveals.branches[effect.branchId] = true;
        break;
      case "revealActivity":
        state.reveals.activities[effect.activityId] = true;
        break;
      case "revealResource":
        state.reveals.resources[effect.resourceId] = true;
        break;
      case "revealRole":
        state.reveals.roles[effect.roleId] = true;
        break;
      case "revealTab":
        state.reveals.tabs[effect.tabId] = true;
        break;
      case "setFlag":
        state.flags[effect.key] = effect.value;
        break;
      case "incFlagCounter":
        state.flags[effect.key] = (state.flags[effect.key] || 0) + 1;
        break;
      case "logMessage":
        logEvent(effect.message || "event", "info");
        break;
      default:
        break;
    }
  });
}

function awardXp(staffIds, xpRewards) {
  const xp = xpRewards?.onComplete || 0;
  if (!xp) return;
  staffIds.forEach((id) => {
    const crew = findCrew(id);
    if (crew) crew.xp += xp;
  });
}

function markStaffAvailability(run, outcome) {
  const jailDuration = outcome.jail?.durationMs;
  run.assignedStaffIds.forEach((id) => {
    const crew = findCrew(id);
    if (!crew) return;
    if (jailDuration) {
      crew.status = "unavailable";
      crew.unavailableUntil = Date.now() + jailDuration;
    } else {
      crew.status = "available";
      crew.unavailableUntil = 0;
    }
  });
}

function bumpCompletions(activityId, optionId) {
  state.completions.activity[activityId] = (state.completions.activity[activityId] || 0) + 1;
  state.completions.option[optionId] = (state.completions.option[optionId] || 0) + 1;
}

function handleRepeatQueue(run) {
  const queue = state.repeatQueues[run.runId];
  if (!queue) return;
  delete state.repeatQueues[run.runId];
  const remaining = queue.remaining === "infinite" ? "infinite" : Math.max(0, queue.remaining - 1);
  const shouldContinue = remaining === "infinite" || remaining > 0;
  if (!shouldContinue) {
    logEvent(Lexicon.get("log_templates.repeat_stopped") || "Repeat stopped", "info");
    return;
  }
  const activity = indexById.activities.get(queue.activityId);
  const option = activity?.options.find((o) => o.id === queue.optionId);
  if (!activity || !option) return;
  const success = startRun(activity, option, queue.staffIds, {
    mode: remaining === "infinite" ? "infinite" : "finite",
    count: remaining
  });
  if (!success) {
    logEvent(Lexicon.template("log_templates.repeat_stopped", { reason: "crew busy" }) || "Repeat stopped: crew busy", "warn");
  }
}

function renderCrew() {
  const container = document.getElementById("crew-list");
  container.innerHTML = "";
  state.crew.staff.forEach((staff) => {
    const stars = getStars(staff.roleId, staff.xp);
    const role = indexById.roles.get(staff.roleId);
    const card = document.createElement("div");
    card.className = "crew-card";
    card.innerHTML = `
      <div class="title-row"><div>${staff.name}</div><div class="badge">${staff.status.toUpperCase()}</div></div>
      <div class="meta">Role: ${role?.name || staff.roleId} | Stars: ${"*".repeat(stars)}</div>
      <div class="muted">XP: ${staff.xp}</div>
    `;
    container.appendChild(card);
  });
}

function renderResources() {
  const container = document.getElementById("resource-list");
  container.innerHTML = "";
  const revealed = dataStore.resources.filter((r) => state.reveals.resources[r.id]);
  revealed.forEach((res) => {
    const card = document.createElement("div");
    card.className = "resource-card";
    const value = formatNumber(state.resources[res.id] || 0);
    card.innerHTML = `
      <div class="title-row">
        <div>${res.name}</div>
        <div class="badge">${value}</div>
      </div>
      <div class="muted">${res.description || ""}</div>
    `;
    container.appendChild(card);
  });
}

function renderItems() {
  const container = document.getElementById("item-list");
  container.innerHTML = "";
  const items = dataStore.items;
  if (!items.length) {
    container.innerHTML = `<div class="muted">No items discovered.</div>`;
    return;
  }
  items.forEach((item) => {
    const amount = state.items[item.id] || 0;
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="title-row">
        <div>${item.name}</div>
        <div class="badge">${amount}</div>
      </div>
      <div class="muted">${item.description || ""}</div>
    `;
    container.appendChild(card);
  });
}

function renderActiveRuns() {
  const container = document.getElementById("active-runs");
  container.innerHTML = "";
  if (!state.runs.length) {
    container.innerHTML = `<div class="muted">No active runs.</div>`;
    return;
  }
  state.runs.forEach((run) => {
    const activity = indexById.activities.get(run.activityId);
    const option = activity?.options.find((o) => o.id === run.optionId);
    const progress = clamp((state.now - run.startedAt) / (run.endsAt - run.startedAt), 0, 1);
    const remainingMs = Math.max(0, run.endsAt - state.now);
    const queue = state.repeatQueues[run.runId];
    const bar = `
      <div class="progress">
        <div class="bar"><div class="bar-fill" style="width:${progress * 100}%"></div></div>
        <div class="bar-readout">[${progressBar(progress)}] ${Math.round(progress * 100)}% | ${formatDuration(remainingMs)}</div>
      </div>
    `;
    const card = document.createElement("div");
    card.className = "run-card";
    card.innerHTML = `
      <div class="header">
        <div>${activity?.name || run.activityId} / ${option?.name || run.optionId}</div>
        <div class="meta">
          <span>staff: ${run.assignedStaffIds.map((id) => findCrew(id)?.name || id).join(", ")}</span>
          ${queue ? `<span class="repeat-pill">${queue.remaining === "infinite" ? "∞" : `${queue.remaining} left`}</span>` : ""}
        </div>
      </div>
      ${bar}
    `;
    container.appendChild(card);
  });
}

function renderLogs() {
  const preview = document.getElementById("log-preview");
  const full = document.getElementById("log-full");
  const entries = state.log.slice(-20);
  preview.innerHTML = "";
  full.innerHTML = "";
  entries.slice(-6).forEach((entry) => {
    preview.appendChild(renderLogEntry(entry));
  });
  entries.forEach((entry) => {
    full.appendChild(renderLogEntry(entry));
  });
}

function renderLogEntry(entry) {
  const node = document.createElement("div");
  node.className = "log-entry";
  node.innerHTML = `<time>${entry.time}</time> — <span class="${entry.level}">${entry.message}</span>`;
  return node;
}

function renderLive() {
  renderStatusRail();
  renderActiveRuns();
}

function logEvent(message, level = "info") {
  const stamp = new Date().toLocaleTimeString();
  state.log.push({ message, level, time: stamp });
  if (state.log.length > 200) state.log.shift();
  renderLogs();
}

function progressBar(progress) {
  const blocks = 20;
  const filled = Math.round(progress * blocks);
  return `${"#".repeat(filled)}${"-".repeat(blocks - filled)}`;
}

function formatNumber(num) {
  return Math.round(num).toLocaleString();
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

document.addEventListener("DOMContentLoaded", boot);
