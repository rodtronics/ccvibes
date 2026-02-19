import { store, on, emit, getBranchColor } from '../state.js';

export function init() {
  on('data-loaded', render);
  on('scenario-selected', render);
  on('scenario-changed', render);
  on('save-complete', render);
}

export function render() {
  const svg = document.getElementById('minimapSvg');
  if (!svg) return;

  const w = svg.clientWidth || 260;
  const h = svg.clientHeight || 164;

  if (!store.loaded || !store.scenarios.length) {
    svg.innerHTML = `<text x="${w/2}" y="${h/2}" fill="#94a3b8" text-anchor="middle" font-size="11" font-family="sans-serif">Loading...</text>`;
    return;
  }

  const branches = store.branches.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const grouped = new Map();
  store.scenarios.forEach(act => {
    const bid = act.branchId || 'unassigned';
    if (!grouped.has(bid)) grouped.set(bid, []);
    grouped.get(bid).push(act);
  });

  // Only show branches with scenarios
  const activeBranches = branches.filter(b => grouped.has(b.id));
  if (!activeBranches.length) {
    svg.innerHTML = `<text x="${w/2}" y="${h/2}" fill="#94a3b8" text-anchor="middle" font-size="11" font-family="sans-serif">No scenarios</text>`;
    return;
  }

  const padX = 16, padY = 14;
  const laneH = (h - padY * 2) / activeBranches.length;
  const positions = new Map();

  let html = '';

  // Draw lane labels and position nodes
  activeBranches.forEach((branch, row) => {
    const y = padY + row * laneH + laneH / 2;
    const color = getBranchColor(branch.id);
    const acts = grouped.get(branch.id) || [];

    // Lane label
    html += `<text x="${padX - 4}" y="${y + 3}" fill="${color}" font-size="7" font-family="sans-serif" text-anchor="end" opacity="0.6">${branch.id.slice(0, 3)}</text>`;

    // Lane line
    html += `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" stroke="${color}" stroke-opacity="0.1" stroke-width="1"/>`;

    // Position scenario nodes
    const spacing = (w - padX * 2) / (acts.length + 1);
    acts.forEach((act, col) => {
      const x = padX + spacing * (col + 1);
      positions.set(act.id, { x, y, color });
    });
  });

  // Draw connections
  store.scenarios.forEach(act => {
    const from = positions.get(act.id);
    if (!from) return;

    const drawConn = (effects) => {
      (effects || []).forEach(e => {
        if ((e.type === 'revealActivity' || e.type === 'unlockActivity') && e.scenarioId) {
          const to = positions.get(e.scenarioId);
          if (to) {
            const midY = (from.y + to.y) / 2 - 8;
            html += `<path d="M${from.x},${from.y} Q${(from.x+to.x)/2},${midY} ${to.x},${to.y}" fill="none" stroke="#a78bfa" stroke-opacity="0.25" stroke-width="1"/>`;
          }
        }
      });
    };

    drawConn(act.reveals?.onReveal);
    drawConn(act.reveals?.onUnlock);
    (act.variants || []).forEach(opt => {
      drawConn(opt.resolution?.effects);
      (opt.resolution?.outcomes || []).forEach(out => drawConn(out.effects));
    });
  });

  // Draw nodes
  positions.forEach(({ x, y, color }, actId) => {
    const isSelected = actId === store.selectedActivityId;
    const r = isSelected ? 5 : 3.5;
    const opacity = isSelected ? 1 : 0.7;

    html += `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}" data-id="${actId}" style="cursor:pointer"/>`;

    if (isSelected) {
      html += `<circle cx="${x}" cy="${y}" r="${r + 3}" fill="none" stroke="${color}" stroke-opacity="0.4" stroke-width="1"/>`;
    }
  });

  svg.innerHTML = html;

  // Click handler
  svg.onclick = (e) => {
    const id = e.target.dataset?.id;
    if (id) {
      store.selectedActivityId = id;
      emit('scenario-selected', id);
    }
  };
}
