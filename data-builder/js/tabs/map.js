import { store, on, emit, getBranchColor } from '../state.js';

let container = null;
let canvas = null;
let ctx = null;

const graph = { nodes: [], connections: [] };
const camera = { x: 0, y: 0, zoom: 1 };

let dragging = null;
let panning = false;
let panStart = { x: 0, y: 0 };
let camStart = { x: 0, y: 0 };

const NODE_COLORS = {
  resource: '#7dd3fc',
  branch: '#a78bfa',
  activity: '#34d399',
  milestone: '#fbbf24'
};

const CONN_COLORS = {
  produces: '#34d399',
  consumes: '#f87171',
  reveals: '#a78bfa',
  unlocks: '#fbbf24',
  requires: '#7dd3fc'
};

export function init(el) {
  container = el;
  container.innerHTML = `
    <div style="position:relative;width:100%;height:100%">
      <canvas id="mapCanvas" style="width:100%;height:100%;display:block;background:#0a0f18"></canvas>
      <div style="position:absolute;top:10px;left:10px;display:flex;gap:6px;flex-wrap:wrap">
        <button class="small" onclick="_map.resetView()">Reset View</button>
        <button class="small" onclick="_map.autoLayout()">Auto Layout</button>
        <button class="small" onclick="_map.spreadOut()">Spread Out</button>
      </div>
      <div style="position:absolute;bottom:10px;left:10px;font-size:0.8rem;color:#94a3b8">
        Nodes: <strong id="mapNodeCount">0</strong> | Connections: <strong id="mapConnCount">0</strong>
      </div>
    </div>
  `;

  canvas = document.getElementById('mapCanvas');
  ctx = canvas.getContext('2d');

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel);
  canvas.addEventListener('dblclick', onDblClick);

  on('data-loaded', buildGraph);
  on('activity-changed', buildGraph);
  on('save-complete', buildGraph);

  window._map = { resetView, autoLayout, spreadOut };
}

export function activate() {
  resizeCanvas();
  if (store.loaded && graph.nodes.length === 0) buildGraph();
  render();
}

export function deactivate() {}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function buildGraph() {
  graph.nodes = [];
  graph.connections = [];
  const nodeMap = new Map();

  function getOrCreate(id, name, type) {
    if (nodeMap.has(id)) return nodeMap.get(id);
    const node = { id, name: name || id, type, x: (Math.random() - 0.5) * 800, y: (Math.random() - 0.5) * 600 };
    graph.nodes.push(node);
    nodeMap.set(id, node);
    return node;
  }

  store.resources.forEach(r => getOrCreate(r.id, r.name, 'resource'));
  store.branches.forEach(b => getOrCreate(b.id, b.name, 'branch'));

  store.activities.forEach(act => {
    const actNode = getOrCreate(act.id, act.name, 'activity');

    (act.visibleIf || []).forEach(c => {
      if (c.type === 'resourceGte' && c.resourceId) {
        graph.connections.push({ from: getOrCreate(c.resourceId, c.resourceId, 'resource'), to: actNode, type: 'unlocks', threshold: c.value });
      }
    });

    (act.unlockIf || []).forEach(c => {
      if (c.type === 'resourceGte' && c.resourceId) {
        graph.connections.push({ from: getOrCreate(c.resourceId, c.resourceId, 'resource'), to: actNode, type: 'requires', threshold: c.value });
      }
    });

    const addEffects = (effects) => {
      (effects || []).forEach(e => {
        if (e.type === 'revealBranch' && e.branchId) graph.connections.push({ from: actNode, to: getOrCreate(e.branchId, e.branchId, 'branch'), type: 'reveals' });
        if (e.type === 'revealResource' && e.resourceId) graph.connections.push({ from: actNode, to: getOrCreate(e.resourceId, e.resourceId, 'resource'), type: 'reveals' });
        if ((e.type === 'revealActivity' || e.type === 'unlockActivity') && e.activityId) graph.connections.push({ from: actNode, to: getOrCreate(e.activityId, e.activityId, 'activity'), type: 'reveals' });
      });
    };

    addEffects(act.reveals?.onReveal);
    addEffects(act.reveals?.onUnlock);

    (act.options || []).forEach(opt => {
      if (opt.inputs?.resources) {
        Object.keys(opt.inputs.resources).forEach(rid => {
          graph.connections.push({ from: actNode, to: getOrCreate(rid, rid, 'resource'), type: 'consumes' });
        });
      }

      const addOutputs = (outputs) => {
        if (outputs?.resources) {
          Object.keys(outputs.resources).forEach(rid => {
            const exists = graph.connections.some(c => c.from === actNode && c.to.id === rid && c.type === 'produces');
            if (!exists) graph.connections.push({ from: actNode, to: getOrCreate(rid, rid, 'resource'), type: 'produces' });
          });
        }
      };

      if (opt.resolution?.type === 'weighted_outcomes') {
        (opt.resolution.outcomes || []).forEach(out => {
          addOutputs(out.outputs);
          addEffects(out.effects);
        });
      } else if (opt.resolution) {
        addOutputs(opt.resolution.outputs);
        addEffects(opt.resolution.effects);
      }
    });
  });

  const nc = document.getElementById('mapNodeCount');
  const cc = document.getElementById('mapConnCount');
  if (nc) nc.textContent = graph.nodes.length;
  if (cc) cc.textContent = graph.connections.length;

  if (graph.nodes.length > 0) autoLayout();
  render();
}

function autoLayout() {
  const iterations = 100;
  for (let i = 0; i < iterations; i++) {
    // Repulsion
    for (let a = 0; a < graph.nodes.length; a++) {
      for (let b = a + 1; b < graph.nodes.length; b++) {
        const dx = graph.nodes[b].x - graph.nodes[a].x;
        const dy = graph.nodes[b].y - graph.nodes[a].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 5000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        graph.nodes[a].x -= fx;
        graph.nodes[a].y -= fy;
        graph.nodes[b].x += fx;
        graph.nodes[b].y += fy;
      }
    }

    // Attraction along connections
    graph.connections.forEach(c => {
      const dx = c.to.x - c.from.x;
      const dy = c.to.y - c.from.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 150) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      c.from.x += fx;
      c.from.y += fy;
      c.to.x -= fx;
      c.to.y -= fy;
    });
  }
  render();
}

function spreadOut() {
  if (!graph.nodes.length) return;
  const minDist = 120, push = 20;
  for (let i = 0; i < graph.nodes.length; i++) {
    for (let j = i + 1; j < graph.nodes.length; j++) {
      const dx = graph.nodes[j].x - graph.nodes[i].x;
      const dy = graph.nodes[j].y - graph.nodes[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist > 0) {
        const px = (dx / dist) * push;
        const py = (dy / dist) * push;
        graph.nodes[i].x -= px;
        graph.nodes[i].y -= py;
        graph.nodes[j].x += px;
        graph.nodes[j].y += py;
      }
    }
  }
  render();
}

function resetView() {
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  render();
}

function render() {
  if (!ctx || !canvas) return;
  resizeCanvas();
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + camera.x, h / 2 + camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  // Connections
  graph.connections.forEach(c => {
    ctx.beginPath();
    ctx.moveTo(c.from.x, c.from.y);
    ctx.lineTo(c.to.x, c.to.y);
    ctx.strokeStyle = CONN_COLORS[c.type] || '#555';
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Arrow
    const angle = Math.atan2(c.to.y - c.from.y, c.to.x - c.from.x);
    const mx = (c.from.x + c.to.x) / 2;
    const my = (c.from.y + c.to.y) / 2;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fillStyle = CONN_COLORS[c.type] || '#555';
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.restore();
  });

  // Nodes
  graph.nodes.forEach(node => {
    const r = 18;
    const color = NODE_COLORS[node.type] || '#94a3b8';
    const isSelected = node.id === store.selectedActivityId;

    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = isSelected ? 0.9 : 0.6;
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = node.name.length > 14 ? node.name.slice(0, 12) + '..' : node.name;
    ctx.fillText(label, node.x, node.y + r + 4);
  });

  ctx.restore();
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - canvas.width / 2 - camera.x) / camera.zoom,
    y: (sy - canvas.height / 2 - camera.y) / camera.zoom
  };
}

function findNode(wx, wy) {
  for (let i = graph.nodes.length - 1; i >= 0; i--) {
    const n = graph.nodes[i];
    const dx = wx - n.x, dy = wy - n.y;
    if (dx * dx + dy * dy < 18 * 18) return n;
  }
  return null;
}

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  const { x, y } = screenToWorld(sx, sy);
  const node = findNode(x, y);

  if (node) {
    dragging = { node, offsetX: x - node.x, offsetY: y - node.y };
  } else {
    panning = true;
    panStart = { x: e.clientX, y: e.clientY };
    camStart = { x: camera.x, y: camera.y };
  }
}

function onMouseMove(e) {
  if (dragging) {
    const rect = canvas.getBoundingClientRect();
    const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    dragging.node.x = x - dragging.offsetX;
    dragging.node.y = y - dragging.offsetY;
    render();
  } else if (panning) {
    camera.x = camStart.x + (e.clientX - panStart.x);
    camera.y = camStart.y + (e.clientY - panStart.y);
    render();
  }
}

function onMouseUp() {
  dragging = null;
  panning = false;
}

function onWheel(e) {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  camera.zoom = Math.max(0.1, Math.min(5, camera.zoom * factor));
  render();
}

function onDblClick(e) {
  const rect = canvas.getBoundingClientRect();
  const { x, y } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const node = findNode(x, y);
  if (node && node.type === 'activity') {
    store.selectedActivityId = node.id;
    emit('activity-selected', node.id);
    // Switch to workshop tab
    const wsBtn = document.querySelector('[data-tab="workshop"]');
    if (wsBtn) wsBtn.click();
  }
}
