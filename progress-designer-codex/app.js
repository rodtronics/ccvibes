const FILES = {
  activities: "activities.json",
  branches: "branches.json",
  resources: "resources.json",
  items: "items.json",
  roles: "roles.json"
};

const state = {
  serverOnline: false,
  dirty: false,
  activeTab: "activity",
  selectedActivityId: null,
  validation: [],
  data: {
    activities: [],
    branches: [],
    resources: [],
    items: [],
    roles: []
  }
};

const els = {
  serverDot: document.getElementById("serverDot"),
  serverText: document.getElementById("serverText"),
  searchInput: document.getElementById("searchInput"),
  refreshBtn: document.getElementById("refreshBtn"),
  saveBtn: document.getElementById("saveBtn"),
  newActivityBtn: document.getElementById("newActivityBtn"),
  activityList: document.getElementById("activityList"),
  activityCount: document.getElementById("activityCount"),
  sidebarStatus: document.getElementById("sidebarStatus"),
  activeTitle: document.getElementById("activeTitle"),
  activeBranchTag: document.getElementById("activeBranchTag"),
  copyJsonBtn: document.getElementById("copyJsonBtn"),
  validateBtn: document.getElementById("validateBtn"),
  tabs: document.getElementById("tabs"),
  tabActivity: document.getElementById("tab-activity"),
  tabUnlock: document.getElementById("tab-unlock"),
  tabBalance: document.getElementById("tab-balance"),
  tabValidate: document.getElementById("tab-validate"),
  tabRaw: document.getElementById("tab-raw"),
  difficultyKv: document.getElementById("difficultyKv"),
  depHint: document.getElementById("depHint"),
  depKv: document.getElementById("depKv"),
  inspectorStatus: document.getElementById("inspectorStatus")
};

function isServerContext() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function setStatus(el, message, kind = "") {
  el.className = `status show ${kind}`.trim();
  el.textContent = message;
}

function clearStatus(el) {
  el.className = "status";
  el.textContent = "";
}

function escapeHtml(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setServerPill(ok) {
  els.serverDot.className = `dot ${ok ? "ok" : "bad"}`;
  els.serverText.textContent = ok ? "Server online" : "Server offline";
}

function getSelectedActivity() {
  if (!state.selectedActivityId) return null;
  return state.data.activities.find((a) => a.id === state.selectedActivityId) || null;
}

function markDirty(nextDirty) {
  state.dirty = !!nextDirty;
  els.saveBtn.disabled = !state.serverOnline || !state.dirty;
  els.copyJsonBtn.disabled = !getSelectedActivity();
}

async function checkHealth() {
  if (!isServerContext()) return false;
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiGet(file) {
  const res = await fetch(`/api/data/${file}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPut(file, payload) {
  const res = await fetch(`/api/data/${file}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function branchLabel(branchId) {
  const b = state.data.branches.find((x) => x.id === branchId);
  return b ? b.name : branchId || "\u2014";
}

function ensureActivityShape(activity) {
  if (!activity.meta) activity.meta = {};
  if (!Array.isArray(activity.meta.tags)) activity.meta.tags = [];
  if (!Array.isArray(activity.visibleIf)) activity.visibleIf = [];
  if (!Array.isArray(activity.unlockIf)) activity.unlockIf = [];
  if (!activity.reveals) activity.reveals = { onReveal: [], onUnlock: [] };
  if (!Array.isArray(activity.options)) activity.options = [];
}

function createDefaultActivity(id) {
  const branchId = state.data.branches[0]?.id || "street";
  return {
    id,
    branchId,
    name: id,
    description: "",
    meta: { tags: [], icon: "" },
    visibleIf: [],
    unlockIf: [],
    reveals: { onReveal: [], onUnlock: [] },
    options: [
      {
        id: `${id}_default`,
        name: "default",
        description: "",
        visibleIf: [],
        unlockIf: [],
        requirements: { staff: [{ roleId: "player", count: 1, starsMin: 0 }], items: [], buildings: [] },
        inputs: { resources: {}, items: {} },
        durationMs: 10000,
        xpRewards: { onComplete: 1 },
        resolution: { type: "deterministic", outputs: { resources: {}, items: {} }, heatDelta: 0, effects: [] },
        modifiers: [],
        cooldownMs: 0
      }
    ]
  };
}

async function loadAll() {
  clearStatus(els.sidebarStatus);
  state.serverOnline = await checkHealth();
  setServerPill(state.serverOnline);

  if (!state.serverOnline) {
    setStatus(
      els.sidebarStatus,
      isServerContext()
        ? "Start the server (npm run dev:progress) to load/save."
        : "Open from http://localhost so the API works.",
      "warn"
    );
    markDirty(false);
    return;
  }

  try {
    const [activities, branches, resources, items, roles] = await Promise.all([
      apiGet(FILES.activities),
      apiGet(FILES.branches),
      apiGet(FILES.resources),
      apiGet(FILES.items).catch(() => []),
      apiGet(FILES.roles).catch(() => [])
    ]);

    state.data.activities = Array.isArray(activities) ? activities : [];
    state.data.branches = Array.isArray(branches) ? branches : [];
    state.data.resources = Array.isArray(resources) ? resources : [];
    state.data.items = Array.isArray(items) ? items : [];
    state.data.roles = Array.isArray(roles) ? roles : [];

    if (!state.selectedActivityId && state.data.activities[0]) {
      state.selectedActivityId = state.data.activities[0].id;
    }

    render();
    markDirty(false);
    setStatus(els.sidebarStatus, `Loaded ${state.data.activities.length} activities.`, "good");
    setTimeout(() => clearStatus(els.sidebarStatus), 1200);
  } catch (err) {
    setStatus(els.sidebarStatus, `Load failed: ${err.message}`, "bad");
  }
}

function render() {
  const activity = getSelectedActivity();
  if (activity) ensureActivityShape(activity);
  els.activeTitle.textContent = activity ? activity.id : "Select an activity";

  if (activity) {
    els.activeBranchTag.style.display = "inline-flex";
    els.activeBranchTag.textContent = branchLabel(activity.branchId);
  } else {
    els.activeBranchTag.style.display = "none";
  }

  renderActivityList2();
  renderTabActivity(activity);
  renderTabUnlock(activity);
  renderTabBalance(activity);
  renderTabValidate();
  renderTabRaw(activity);
  renderInspector(activity);
  setTab(state.activeTab);
  markDirty(state.dirty);
}

// Remaining tabs + editors will be added next.

function sortActivities(acts) {
  const order = new Map(state.data.branches.map((b) => [b.id, b.order || 0]));
  return (acts || [])
    .slice()
    .sort((a, b) => {
      const ao = order.get(a.branchId) ?? 9999;
      const bo = order.get(b.branchId) ?? 9999;
      if (ao !== bo) return ao - bo;
      return String(a.id).localeCompare(String(b.id));
    });
}

function activityMatchesSearch(activity, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const tags = Array.isArray(activity?.meta?.tags) ? activity.meta.tags.join(" ") : "";
  return (
    String(activity.id || "").toLowerCase().includes(s) ||
    String(activity.name || "").toLowerCase().includes(s) ||
    String(activity.description || "").toLowerCase().includes(s) ||
    tags.toLowerCase().includes(s)
  );
}

function setActiveActivity(activityId) {
  state.selectedActivityId = activityId;
  render();
}

function renderActivityList2() {
  const q = els.searchInput.value.trim();
  const filtered = sortActivities(state.data.activities).filter((a) => activityMatchesSearch(a, q));
  els.activityCount.textContent = String(filtered.length);

  els.activityList.innerHTML = filtered
    .map((a) => {
      const selected = a.id === state.selectedActivityId ? "selected" : "";
      const icon = a?.meta?.icon ? a.meta.icon : "\u2022";
      const tags = Array.isArray(a?.meta?.tags) ? a.meta.tags.slice(0, 2).join(", ") : "";
      return `
        <div class="item ${selected}" data-activity="${escapeHtml(a.id)}">
          <div class="itemTitle">
            <span style="width: 20px; display:inline-block;">${escapeHtml(icon)}</span>
            <span>${escapeHtml(a.id)}</span>
            ${tags ? `<span class="tag">${escapeHtml(tags)}</span>` : ""}
          </div>
          <div class="sub">${escapeHtml(branchLabel(a.branchId))} \u2022 ${escapeHtml(a.name || "")}</div>
        </div>
      `;
    })
    .join("");
}

function renderActivityList() {
  els.activityCount.textContent = "0";
  els.activityList.innerHTML = `<div class="hint">Loading…</div>`;
}

function branchOptions(selectedId) {
  const branches = state.data.branches.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  return branches
    .map((b) => `<option value="${escapeHtml(b.id)}" ${b.id === selectedId ? "selected" : ""}>${escapeHtml(b.name)} (${escapeHtml(b.id)})</option>`)
    .join("");
}

function resourceOptions(selectedId) {
  return state.data.resources
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((r) => `<option value="${escapeHtml(r.id)}" ${r.id === selectedId ? "selected" : ""}>${escapeHtml(r.id)} (${escapeHtml(r.category || "misc")})</option>`)
    .join("");
}

function renderGateEditor(kind, list) {
  const title = kind === "unlockIf" ? "Unlock If" : "Visible If";
  const rows = (list || []).map((c, idx) => renderGateRow(kind, c, idx)).join("");
  return `
    <div class="row" style="justify-content: space-between;">
      <strong>${title}</strong>
      <button class="ghost" data-addgate="${kind}">+ resourceGte</button>
    </div>
    <div style="height: 10px;"></div>
    <div>
      ${rows || `<div class="hint">No gates.</div>`}
    </div>
  `;
}

function renderGateRow(kind, cond, idx) {
  const c = cond || { type: "resourceGte", resourceId: "", value: 0 };
  const resourceId = c.resourceId || "";
  const value = c.value ?? 0;
  return `
    <div class="row" style="align-items: flex-end; margin-bottom: 10px;">
      <div style="flex: 1; min-width: 180px;">
        <div class="label">Resource</div>
        <select data-gate="${kind}" data-idx="${idx}" data-field="resourceId">
          <option value="">(pick)</option>
          ${resourceOptions(resourceId)}
        </select>
      </div>
      <div style="width: 140px;">
        <div class="label">Min</div>
        <input data-gate="${kind}" data-idx="${idx}" data-field="value" type="number" value="${escapeHtml(value)}" />
      </div>
      <div style="width: 120px;">
        <button class="danger" data-rmgate="${kind}" data-idx="${idx}">Remove</button>
      </div>
    </div>
  `;
}

function renderTabActivity(activity) {
  if (!activity) {
    els.tabActivity.innerHTML = `<h2>Activity</h2><div class="hint">Pick an activity from the left.</div>`;
    return;
  }

  const tags = Array.isArray(activity.meta?.tags) ? activity.meta.tags.join(", ") : "";
  const icon = activity.meta?.icon || "";

  const opt = activity.options?.[0];
  const duration = opt?.durationMs ?? 10000;
  const cooldown = opt?.cooldownMs ?? 0;
  const heat = typeof opt?.resolution?.heatDelta === "number" ? opt.resolution.heatDelta : 0;
  const xp = opt?.xpRewards?.onComplete ?? 0;
  const rType = opt?.resolution?.type || "deterministic";

  els.tabActivity.innerHTML = `
    <h2>Activity</h2>
    <div class="split" style="margin-top: 10px;">
      <div class="panel">
        <h3>Basics</h3>
        <div class="grid2">
          <div class="field">
            <div class="label">ID</div>
            <input type="text" value="${escapeHtml(activity.id)}" disabled />
          </div>
          <div class="field">
            <div class="label">Branch</div>
            <select id="a_branch">${branchOptions(activity.branchId)}</select>
          </div>
          <div class="field">
            <div class="label">Name</div>
            <input id="a_name" type="text" value="${escapeHtml(activity.name || "")}" />
          </div>
          <div class="field">
            <div class="label">Icon</div>
            <input id="a_icon" type="text" value="${escapeHtml(icon)}" placeholder=":)" />
          </div>
        </div>
        <div style="height: 10px;"></div>
        <div class="field">
          <div class="label">Description</div>
          <textarea id="a_desc" placeholder="What is this activity?">${escapeHtml(activity.description || "")}</textarea>
        </div>
        <div style="height: 10px;"></div>
        <div class="field">
          <div class="label">Tags (comma-separated)</div>
          <input id="a_tags" type="text" value="${escapeHtml(tags)}" placeholder="starter, street, ..." />
        </div>
      </div>

      <div class="panel">
        <h3>Gates</h3>
        <div class="hint">Unlock-driven progression. Current data mostly uses <span style="font-family: var(--mono)">resourceGte</span>.</div>
        <div style="height: 10px;"></div>
        ${renderGateEditor("unlockIf", activity.unlockIf)}
        <div style="height: 12px;"></div>
        ${renderGateEditor("visibleIf", activity.visibleIf)}
      </div>
    </div>

    <div style="height: 14px;"></div>
    <div class="panel">
      <h3>First Option (starter)</h3>
      <div class="hint">Next: rich editors for costs and outputs. For now: pacing + risk knobs.</div>
      <div style="height: 10px;"></div>
      <div class="grid3">
        <div class="field">
          <div class="label">Duration (ms)</div>
          <input id="o_duration" type="number" value="${escapeHtml(duration)}" />
        </div>
        <div class="field">
          <div class="label">Cooldown (ms)</div>
          <input id="o_cooldown" type="number" value="${escapeHtml(cooldown)}" />
        </div>
        <div class="field">
          <div class="label">Heat Delta</div>
          <input id="o_heat" type="number" value="${escapeHtml(heat)}" />
        </div>
        <div class="field">
          <div class="label">XP on Complete</div>
          <input id="o_xp" type="number" value="${escapeHtml(xp)}" />
        </div>
        <div class="field">
          <div class="label">Resolution Type</div>
          <select id="o_rtype">
            ${["deterministic", "ranged_outputs", "weighted_outcomes"].map((t) => `<option value="${t}" ${t === rType ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </div>
      </div>
    </div>
  `;

  wireActivityEditor(activity);
}

function wireActivityEditor(activity) {
  const root = els.tabActivity;
  const onChange = (fn) => () => {
    fn();
    markDirty(true);
    render();
  };

  const a_branch = root.querySelector("#a_branch");
  const a_name = root.querySelector("#a_name");
  const a_icon = root.querySelector("#a_icon");
  const a_desc = root.querySelector("#a_desc");
  const a_tags = root.querySelector("#a_tags");

  a_branch?.addEventListener("change", onChange(() => (activity.branchId = a_branch.value)));
  a_name?.addEventListener("input", onChange(() => (activity.name = a_name.value)));
  a_icon?.addEventListener("input", onChange(() => {
    activity.meta = activity.meta || {};
    activity.meta.icon = a_icon.value;
  }));
  a_desc?.addEventListener("input", onChange(() => (activity.description = a_desc.value)));
  a_tags?.addEventListener("input", onChange(() => {
    activity.meta = activity.meta || {};
    activity.meta.tags = a_tags.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }));

  root.querySelectorAll("[data-addgate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-addgate");
      activity[kind] = Array.isArray(activity[kind]) ? activity[kind] : [];
      activity[kind].push({ type: "resourceGte", resourceId: "", value: 0 });
      markDirty(true);
      render();
    });
  });

  root.querySelectorAll("[data-rmgate]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.getAttribute("data-rmgate");
      const idx = Number(btn.getAttribute("data-idx"));
      if (!Array.isArray(activity[kind])) return;
      activity[kind].splice(idx, 1);
      markDirty(true);
      render();
    });
  });

  root.querySelectorAll("[data-gate]").forEach((input) => {
    input.addEventListener("input", () => {
      const kind = input.getAttribute("data-gate");
      const idx = Number(input.getAttribute("data-idx"));
      const field = input.getAttribute("data-field");
      const cond = activity[kind]?.[idx];
      if (!cond) return;
      if (field === "value") cond.value = Number(input.value || 0);
      else cond[field] = input.value;
      markDirty(true);
      render();
    });
  });

  const opt = activity.options?.[0];
  if (!opt) return;

  const o_duration = root.querySelector("#o_duration");
  const o_cooldown = root.querySelector("#o_cooldown");
  const o_heat = root.querySelector("#o_heat");
  const o_xp = root.querySelector("#o_xp");
  const o_rtype = root.querySelector("#o_rtype");

  o_duration?.addEventListener("input", onChange(() => (opt.durationMs = Number(o_duration.value || 0))));
  o_cooldown?.addEventListener("input", onChange(() => (opt.cooldownMs = Number(o_cooldown.value || 0))));
  o_heat?.addEventListener("input", onChange(() => {
    opt.resolution = opt.resolution || {};
    opt.resolution.heatDelta = Number(o_heat.value || 0);
  }));
  o_xp?.addEventListener("input", onChange(() => {
    opt.xpRewards = opt.xpRewards || {};
    opt.xpRewards.onComplete = Number(o_xp.value || 0);
  }));
  o_rtype?.addEventListener("change", onChange(() => {
    opt.resolution = opt.resolution || {};
    opt.resolution.type = o_rtype.value;
    if (opt.resolution.type === "weighted_outcomes" && !Array.isArray(opt.resolution.outcomes)) opt.resolution.outcomes = [];
    if (opt.resolution.type !== "weighted_outcomes") delete opt.resolution.outcomes;
    if (!opt.resolution.outputs) opt.resolution.outputs = { resources: {}, items: {} };
    if (!Array.isArray(opt.resolution.effects)) opt.resolution.effects = [];
  }));
}

function setTab(tabId) {
  state.activeTab = tabId;

  Array.from(els.tabs.querySelectorAll(".tab")).forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === tabId);
  });

  const map = {
    activity: els.tabActivity,
    unlock: els.tabUnlock,
    balance: els.tabBalance,
    validate: els.tabValidate,
    raw: els.tabRaw
  };

  Object.entries(map).forEach(([id, panel]) => {
    panel.style.display = id === tabId ? "block" : "none";
  });
}

function renderTabUnlock(activity) {
  els.tabUnlock.innerHTML = `<h2>Unlocks</h2>`;
  if (!activity) {
    els.tabUnlock.innerHTML += `<div class="hint">Select an activity to see reveal/unlock effects.</div>`;
    return;
  }

  const effects = collectEffects(activity);
  if (!effects.length) {
    els.tabUnlock.innerHTML += `<div class="hint">No reveal/unlock effects found.</div>`;
    return;
  }

  const rows = effects
    .map((e) => {
      const detail = e.branchId || e.resourceId || e.activityId || "\u2014";
      return kvRow(e.type, detail);
    })
    .join("");

  els.tabUnlock.innerHTML += `<div class="hint">List view for now. Next: graph + reachability checks.</div><div style="height: 10px;"></div><div class="kv">${rows}</div>`;
}

function estimateOptionEv(option) {
  if (!option?.resolution) return { resources: {}, heat: 0 };
  const r = option.resolution;

  if (r.type === "deterministic") {
    return { resources: r.outputs?.resources || {}, heat: Number(r.heatDelta || 0) };
  }

  if (r.type === "ranged_outputs") {
    const out = {};
    const res = r.outputs?.resources || {};
    Object.entries(res).forEach(([k, v]) => {
      if (v && typeof v === "object") {
        const min = Number(v.min || 0);
        const max = Number(v.max || 0);
        out[k] = (min + max) / 2;
      }
    });
    return { resources: out, heat: Number(r.heatDelta || 0) };
  }

  if (r.type === "weighted_outcomes" && Array.isArray(r.outcomes) && r.outcomes.length) {
    const total = r.outcomes.reduce((s, o) => s + Number(o.weight || 0), 0) || 1;
    const out = {};
    let heat = 0;

    r.outcomes.forEach((o) => {
      const p = Number(o.weight || 0) / total;
      heat += p * Number(o.heatDelta || 0);
      const res = o.outputs?.resources || {};
      Object.entries(res).forEach(([k, v]) => {
        out[k] = (out[k] || 0) + p * Number(v || 0);
      });
      const cred = o.credDelta;
      if (cred && typeof cred === "object") {
        const ev = (Number(cred.min || 0) + Number(cred.max || 0)) / 2;
        out.cred = (out.cred || 0) + p * ev;
      }
    });

    return { resources: out, heat };
  }

  return { resources: {}, heat: Number(r.heatDelta || 0) };
}

function renderTabBalance(activity) {
  els.tabBalance.innerHTML = `<h2>Balance</h2>`;
  if (!activity) {
    els.tabBalance.innerHTML += `<div class="hint">Select an activity to see EV per run/min.</div>`;
    return;
  }

  const opt = activity.options?.[0];
  if (!opt) {
    els.tabBalance.innerHTML += `<div class="hint">No options found.</div>`;
    return;
  }

  const ev = estimateOptionEv(opt);
  const durationMs = Number(opt.durationMs || 0) || 1;
  const perMin = 60000 / durationMs;

  const outRows = Object.entries(ev.resources)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([k, v]) => kvRow(k, `${Number(v).toFixed(2)}/run \u2022 ${(Number(v) * perMin).toFixed(2)}/min`))
    .join("");

  els.tabBalance.innerHTML += `
    <div class="hint">EV uses simple averaging for ranged outputs and weight averages for weighted outcomes.</div>
    <div style="height: 10px;"></div>
    <div class="kv">
      ${kvRow("Duration", `${durationMs} ms`)}
      ${kvRow("Heat EV", `${ev.heat.toFixed(2)}/run \u2022 ${(ev.heat * perMin).toFixed(2)}/min`)}
      ${outRows || kvRow("Outputs", "\u2014")}
    </div>
  `;
}

function renderTabValidate() {
  els.tabValidate.innerHTML = `<h2>Validation</h2>`;
  if (!state.validation.length) {
    els.tabValidate.innerHTML += `<div class="hint">No issues (or not yet run).</div>`;
    return;
  }
  els.tabValidate.innerHTML += `<div class="hint">${state.validation.length} issue(s).</div><div style="height: 10px;"></div>`;
  els.tabValidate.innerHTML += `<div class="kv">${state.validation.map((e) => kvRow(`${e.kind}:${e.id}`, e.msg)).join("")}</div>`;
}

function renderTabRaw(activity) {
  els.tabRaw.innerHTML = `<h2>Raw JSON</h2>`;
  if (!activity) {
    els.tabRaw.innerHTML += `<div class="hint">Select an activity to view JSON.</div>`;
    return;
  }
  els.tabRaw.innerHTML += `<textarea readonly>${escapeHtml(JSON.stringify(activity, null, 2))}</textarea>`;
}

function kvRow(k, v) {
  return `<div class="kvRow"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`;
}

function collectEffects(activity) {
  const effects = [];
  const push = (e) => e && e.type && effects.push(e);
  (activity.reveals?.onReveal || []).forEach(push);
  (activity.reveals?.onUnlock || []).forEach(push);
  (activity.options || []).forEach((opt) => {
    (opt.resolution?.effects || []).forEach(push);
    (opt.resolution?.outcomes || []).forEach((out) => (out.effects || []).forEach(push));
  });
  return effects;
}

function deriveRequirements(activity) {
  const resources = new Set();
  (activity.unlockIf || []).forEach((c) => {
    if (c?.type === "resourceGte" && c.resourceId) resources.add(c.resourceId);
  });

  const staff = new Set();
  const opt = activity.options?.[0];
  (opt?.requirements?.staff || []).forEach((s) => s?.roleId && staff.add(s.roleId));

  const parts = [];
  if (resources.size) parts.push(`${resources.size} gate resource(s)`);
  if (staff.size) parts.push(`${staff.size} staff role(s)`);
  return parts.length ? parts.join(" \u2022 ") : "\u2014";
}

function deriveUnlockTargets(activity) {
  const effects = collectEffects(activity);
  const branches = new Set();
  const resources = new Set();
  const activities = new Set();

  effects.forEach((e) => {
    if (e.type === "revealBranch" && e.branchId) branches.add(e.branchId);
    if (e.type === "revealResource" && e.resourceId) resources.add(e.resourceId);
    if ((e.type === "revealActivity" || e.type === "unlockActivity") && e.activityId) activities.add(e.activityId);
  });

  const parts = [];
  if (branches.size) parts.push(`${branches.size} branch(es)`);
  if (resources.size) parts.push(`${resources.size} resource(s)`);
  if (activities.size) parts.push(`${activities.size} activity(ies)`);
  return parts.length ? parts.join(" \u2022 ") : "\u2014";
}

function computeDifficultyHint(activity) {
  const opt = activity.options?.[0];
  const durationMs = Number(opt?.durationMs || 0);
  const cooldownMs = Number(opt?.cooldownMs || 0);

  const gates = (activity.unlockIf || [])
    .filter((c) => c?.type === "resourceGte")
    .reduce((sum, c) => sum + Math.log10(1 + Number(c.value || 0)) * 3, 0);

  const costs = (() => {
    const inRes = opt?.inputs?.resources || {};
    return Object.values(inRes).reduce((sum, v) => sum + Math.log10(1 + Number(v || 0)) * 2, 0);
  })();

  const time = (() => {
    const base = durationMs > 0 ? Math.log10(1 + durationMs / 1000) * 2 : 0;
    const cd = cooldownMs > 0 ? Math.log10(1 + cooldownMs / 1000) * 1.2 : 0;
    return base + cd;
  })();

  const risk = (() => {
    const r = opt?.resolution || {};
    if (r.type === "weighted_outcomes" && Array.isArray(r.outcomes) && r.outcomes.length) {
      const total = r.outcomes.reduce((s, o) => s + Number(o.weight || 0), 0) || 1;
      const heatEv = r.outcomes.reduce((s, o) => s + (Number(o.weight || 0) / total) * Number(o.heatDelta || 0), 0);
      const jailEv = r.outcomes.reduce((s, o) => s + (Number(o.weight || 0) / total) * (o?.jail?.durationMs ? 1 : 0), 0);
      return heatEv * 1.6 + jailEv * 6;
    }
    return Number(r.heatDelta || 0) * 1.2;
  })();

  const score = gates + costs + time + risk;
  const label =
    score < 3 ? "Very Easy" :
    score < 6 ? "Easy" :
    score < 10 ? "Medium" :
    score < 14 ? "Hard" :
    "Very Hard";

  return { score, label, parts: { gates, costs, time, risk } };
}

function renderInspector(activity) {
  if (!activity) {
    els.difficultyKv.innerHTML = "";
    els.depKv.innerHTML = "";
    els.depHint.textContent = "Select an activity to see what it reveals/unlocks and what it requires.";
    return;
  }

  const hint = computeDifficultyHint(activity);
  els.difficultyKv.innerHTML = [
    kvRow("Suggested", `${hint.label} (${hint.score.toFixed(1)})`),
    kvRow("Gate score", hint.parts.gates.toFixed(1)),
    kvRow("Cost score", hint.parts.costs.toFixed(1)),
    kvRow("Time score", hint.parts.time.toFixed(1)),
    kvRow("Risk score", hint.parts.risk.toFixed(1))
  ].join("");

  els.depHint.textContent = "Quick read: what this activity needs, and what it reveals.";
  els.depKv.innerHTML = [
    kvRow("Requires", deriveRequirements(activity)),
    kvRow("Reveals", deriveUnlockTargets(activity))
  ].join("");
}

async function saveAll() {
  if (!state.serverOnline) {
    setStatus(els.sidebarStatus, "Server offline. Cannot save.", "bad");
    return;
  }

  try {
    await apiPut(FILES.activities, state.data.activities);
    markDirty(false);
    setStatus(els.sidebarStatus, "Saved activities.json", "good");
    setTimeout(() => clearStatus(els.sidebarStatus), 1200);
  } catch (err) {
    setStatus(els.sidebarStatus, `Save failed: ${err.message}`, "bad");
  }
}

function validateAll() {
  const errors = [];
  const activities = state.data.activities || [];
  const activityIds = new Set();
  const resourceIds = new Set((state.data.resources || []).map((r) => r.id));
  const branchIds = new Set((state.data.branches || []).map((b) => b.id));

  activities.forEach((a) => {
    if (!a?.id) {
      errors.push({ kind: "activity", id: "?", msg: "Missing activity id" });
      return;
    }

    if (activityIds.has(a.id)) errors.push({ kind: "activity", id: a.id, msg: "Duplicate activity id" });
    activityIds.add(a.id);

    if (a.branchId && !branchIds.has(a.branchId)) {
      errors.push({ kind: "activity", id: a.id, msg: `Unknown branchId: ${a.branchId}` });
    }

    (a.unlockIf || []).forEach((c) => {
      if (c?.type === "resourceGte" && c.resourceId && !resourceIds.has(c.resourceId)) {
        errors.push({ kind: "gate", id: a.id, msg: `unlockIf references unknown resource: ${c.resourceId}` });
      }
    });

    (a.visibleIf || []).forEach((c) => {
      if (c?.type === "resourceGte" && c.resourceId && !resourceIds.has(c.resourceId)) {
        errors.push({ kind: "gate", id: a.id, msg: `visibleIf references unknown resource: ${c.resourceId}` });
      }
    });

    (a.options || []).forEach((opt) => {
      const inRes = opt?.inputs?.resources || {};
      Object.keys(inRes).forEach((rid) => {
        if (!resourceIds.has(rid)) errors.push({ kind: "input", id: a.id, msg: `inputs.resources references unknown resource: ${rid}` });
      });

      const res = opt?.resolution;
      if (res?.type === "deterministic" || res?.type === "ranged_outputs") {
        const outRes = res.outputs?.resources || {};
        Object.keys(outRes).forEach((rid) => {
          if (rid !== "cred" && !resourceIds.has(rid)) errors.push({ kind: "output", id: a.id, msg: `outputs.resources references unknown resource: ${rid}` });
        });
      }

      if (res?.type === "weighted_outcomes" && Array.isArray(res.outcomes)) {
        res.outcomes.forEach((o) => {
          const outRes = o.outputs?.resources || {};
          Object.keys(outRes).forEach((rid) => {
            if (rid !== "cred" && !resourceIds.has(rid)) errors.push({ kind: "output", id: a.id, msg: `outcome output references unknown resource: ${rid}` });
          });
        });
      }
    });
  });

  return errors;
}

function wireEvents() {
  els.searchInput.addEventListener("input", renderActivityList2);
  els.refreshBtn.addEventListener("click", loadAll);
  els.saveBtn.addEventListener("click", saveAll);

  els.activityList.addEventListener("click", (e) => {
    const row = e.target.closest("[data-activity]");
    if (!row) return;
    setActiveActivity(row.getAttribute("data-activity"));
  });

  els.tabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    setTab(tab.dataset.tab);
  });

  els.newActivityBtn.addEventListener("click", () => {
    const id = prompt("New activity id (snake_case recommended):");
    if (!id) return;
    if (state.data.activities.some((a) => a.id === id)) {
      setStatus(els.sidebarStatus, `Activity already exists: ${id}`, "warn");
      return;
    }
    state.data.activities.push(createDefaultActivity(id));
    state.selectedActivityId = id;
    markDirty(true);
    render();
  });

  els.copyJsonBtn.addEventListener("click", async () => {
    const a = getSelectedActivity();
    if (!a) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(a, null, 2));
      setStatus(els.inspectorStatus, "Copied activity JSON.", "good");
      setTimeout(() => clearStatus(els.inspectorStatus), 900);
    } catch {
      setStatus(els.inspectorStatus, "Could not copy.", "bad");
    }
  });

  els.validateBtn.addEventListener("click", () => {
    state.validation = validateAll();
    render();
    setTab("validate");
    setStatus(
      els.inspectorStatus,
      state.validation.length ? `Validation: ${state.validation.length} issue(s).` : "Validation: OK.",
      state.validation.length ? "warn" : "good"
    );
    setTimeout(() => clearStatus(els.inspectorStatus), 1400);
  });
}

wireEvents();
loadAll();
