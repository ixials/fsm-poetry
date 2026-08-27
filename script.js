// ======== TEXT -> FSM REPRESENTATION ========

function textToFSM(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { states: [], transitions: [] };

  const states = [];
  const idByWord = {}; // Reuse a state if the word repeats

  const hasRepeats =
    new Set(words.map((w) => w.toLowerCase())).size !== words.length;

  words.forEach((word, i) => {
    const key = word.toLowerCase();
    if (!(key in idByWord)) {
      idByWord[key] = "s" + (states.length + 1);
      states.push({
        id: idByWord[key],
        label: word,
        start: i === 0,
        accept: false,
      });
    }
  });

  // Mark the state for the last word as accepting
  const lastId = idByWord[words[words.length - 1].toLowerCase()];
  states.find((s) => s.id === lastId).accept = true;

  const transitions = [];
  for (let i = 0; i < words.length - 1; i++) {
    const from = idByWord[words[i].toLowerCase()];
    const to = idByWord[words[i + 1].toLowerCase()];
    transitions.push({ from, to });
  }

  return { states, transitions, hasRepeats };
}

// ======== SVG RENDERING ========

const RADIUS = 42;
const PADDING = 90;

function layoutStates(states, transitions, hasRepeats) {
  const n = states.length;
  if (n === 0) return {};

  if (n === 1) {
    const only = states[0];
    return { [only.id]: { ...only, x: PADDING + 100, y: PADDING + 100 } };
  }

  // If no repeated words, force a circle layout
  if (!hasRepeats) {
    const radius = Math.max(180, n * 35);
    const centerX = radius + PADDING;
    const centerY = radius + PADDING;

    const positioned = {};

    states.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;

      positioned[s.id] = {
        ...s,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    return positioned;
  }

  const AREA_W = 700,
    AREA_H = 560;
  const k = Math.max(
    130,
    Math.min(260, Math.sqrt((AREA_W * AREA_H) / n) * 0.75),
  );

  const pos = {};
  states.forEach((s, i) => {
    const angle = (2 * Math.PI * i) / n;
    pos[s.id] = {
      x: AREA_W / 2 + Math.cos(angle) * (AREA_W / 3),
      y: AREA_H / 2 + Math.sin(angle) * (AREA_H / 3),
    };
  });

  const realEdges = transitions.filter(
    (t) => t.from !== t.to && pos[t.from] && pos[t.to],
  );

  let temperature = AREA_W / 10;
  const iterations = 300;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = {};
    states.forEach((s) => {
      disp[s.id] = { x: 0, y: 0 };
    });

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = states[i].id,
          b = states[j].id;
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force,
          fy = (dy / dist) * force;
        disp[a].x += fx;
        disp[a].y += fy;
        disp[b].x -= fx;
        disp[b].y -= fy;
      }
    }

    realEdges.forEach((t) => {
      const dx = pos[t.from].x - pos[t.to].x;
      const dy = pos[t.from].y - pos[t.to].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force,
        fy = (dy / dist) * force;
      disp[t.from].x -= fx;
      disp[t.from].y -= fy;
      disp[t.to].x += fx;
      disp[t.to].y += fy;
    });

    states.forEach((s) => {
      disp[s.id].x += (AREA_W / 2 - pos[s.id].x) * 0.01;
      disp[s.id].y += (AREA_H / 2 - pos[s.id].y) * 0.01;
    });

    states.forEach((s) => {
      const d = disp[s.id];
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const limited = Math.min(dist, temperature);
      pos[s.id].x += (d.x / dist) * limited;
      pos[s.id].y += (d.y / dist) * limited;
    });

    temperature *= 0.97;
  }

  const xs = Object.values(pos).map((p) => p.x);
  const ys = Object.values(pos).map((p) => p.y);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);

  const positioned = {};
  states.forEach((s) => {
    positioned[s.id] = {
      ...s,
      x: pos[s.id].x - minX + PADDING,
      y: pos[s.id].y - minY + PADDING,
    };
  });
  return positioned;
}

function computeSvgSize(positionedStates) {
  const vals = Object.values(positionedStates);
  if (vals.length === 0) return { width: 800, height: 720 };
  const maxX = Math.max(...vals.map((s) => s.x)) + PADDING;
  const maxY = Math.max(...vals.map((s) => s.y)) + PADDING;
  return {
    width: Math.max(800, maxX),
    height: Math.max(720, maxY),
  };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

let baseContentSize = { width: 800, height: 720 };

function renderFSM(fsm) {
  const host = document.getElementById("svgHost");
  const zoomControls = document.getElementById("zoomControls");
  host.innerHTML = "";

  const states = fsm.states || [];
  const transitions = fsm.transitions || [];
  const hasRepeats = fsm.hasRepeats;

  if (states.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.id = "emptyHint";
    hint.textContent = "your fsm will appear here";
    host.appendChild(hint);
    zoomControls.style.display = "none";
    return;
  }

  const positioned = layoutStates(states, transitions, hasRepeats);
  const { width, height } = computeSvgSize(positioned);
  baseContentSize = { width, height };

  const svg = svgEl("svg", {
    width: "100%",
    height: "100%",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
  });

  const defs = svgEl("defs", {});
  const marker = svgEl("marker", {
    id: "arrowhead",
    viewBox: "0 0 10 10",
    refX: 9,
    refY: 5,
    markerWidth: 7,
    markerHeight: 7,
    orient: "auto-start-reverse",
    markerUnits: "strokeWidth",
  });
  marker.appendChild(
    svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#6b6b6b" }),
  );
  defs.appendChild(marker);
  svg.appendChild(defs);

  const pairCounts = {};

  transitions.forEach((t) => {
    const from = positioned[t.from];
    const to = positioned[t.to];
    if (!from || !to) return;

    if (t.from === t.to) {
      drawSelfLoop(svg, from, t.label);
      return;
    }

    const key = [t.from, t.to].sort().join("|");
    pairCounts[key] = (pairCounts[key] || 0) + 1;
    const idx = pairCounts[key];

    drawEdge(svg, from, to, t.label, idx);
  });

  states.forEach((s) => {
    const p = positioned[s.id];
    drawNode(svg, p);
  });

  host.appendChild(svg);
  zoomControls.style.display = "flex";
  attachZoomPan(svg);
}

function drawNode(svg, p) {
  svg.appendChild(
    svgEl("circle", {
      class: "node-circle",
      cx: p.x,
      cy: p.y,
      r: RADIUS,
      fill: "#eeeeee",
      stroke: "#6b6b6b",
      "vector-effect": "non-scaling-stroke",
      "stroke-width": 1.5,
    }),
  );
  if (p.accept) {
    svg.appendChild(
      svgEl("circle", {
        class: "node-circle-inner",
        cx: p.x,
        cy: p.y,
        r: RADIUS - 7,
        fill: "none",
        stroke: "#6b6b6b",
        "vector-effect": "non-scaling-stroke",
        "stroke-width": 1.5,
      }),
    );
  }

  const maxFontSize = 16;
  const minFontSize = 6;
  const maxWidth = RADIUS * 1.5;

  const estimatedWidth = p.label.length * maxFontSize * 0.6;

  const fontSize =
    estimatedWidth > maxWidth
      ? Math.max(minFontSize, maxFontSize * (maxWidth / estimatedWidth))
      : maxFontSize;

  const label = svgEl("text", {
    class: "node-label",
    x: p.x,
    y: p.y + 1,
    fill: "#6b6b6b",
    "font-family": "'Jetbrains Mono', monospace",
    "font-size": fontSize,
    "text-anchor": "middle",
    "dominant-baseline": "middle",
  });
  label.textContent = p.label;
  svg.appendChild(label);
}

function edgePoint(p, angle) {
  return {
    x: p.x + RADIUS * Math.cos(angle),
    y: p.y + RADIUS * Math.sin(angle),
  };
}

function drawEdge(svg, from, to, label, fanIndex) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);

  const start = edgePoint(from, angle);
  const end = edgePoint(to, angle + Math.PI);

  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;

  const curveAmount = 30 + (fanIndex - 1) * 24;
  const cx = mx;
  const cy = my - curveAmount;

  const path = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  svg.appendChild(
    svgEl("path", {
      class: "edge-path",
      d: path,
      fill: "none",
      stroke: "#6b6b6b",
      "stroke-width": 1.5,
      "vector-effect": "non-scaling-stroke",
      "marker-end": "url(#arrowhead)",
    }),
  );

  if (label) {
    const t = svgEl("text", {
      class: "edge-label",
      x: cx,
      y: cy - 6,
      fill: "#6b6b6b",
      "font-family": "'Jetbrains Mono', monospace",
      "font-size": 11,
      "text-anchor": "middle",
    });
    t.textContent = label;
    svg.appendChild(t);
  }
}

function drawSelfLoop(svg, p, label) {
  const loopR = 26;
  const topX = p.x;
  const topY = p.y - RADIUS;
  const path = `M ${topX - 18} ${topY + 4}
                      C ${topX - 18} ${topY - loopR}, ${topX + 18} ${topY - loopR}, ${topX + 18} ${topY + 4}`;
  svg.appendChild(
    svgEl("path", {
      class: "edge-path",
      d: path,
      fill: "none",
      stroke: "#6b6b6b",
      "stroke-width": 1.5,
      "vector-effect": "non-scaling-stroke",
      "marker-end": "url(#arrowhead)",
    }),
  );
  if (label) {
    const t = svgEl("text", {
      class: "edge-label",
      x: topX,
      y: topY - loopR - 4,
      fill: "#6b6b6b",
      "font-family": "'Jetbrains Mono', monospace",
      "font-size": 11,
      "text-anchor": "middle",
    });
    t.textContent = label;
    svg.appendChild(t);
  }
}

// ======== ZOOM & PAN ========

const MIN_ZOOM_REL = 0.15;
const MAX_ZOOM_REL = 2;

function svgPointFromEvent(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function applyZoom(svg, factor, centerX, centerY) {
  const vb = svg.viewBox.baseVal;
  const currentRel = vb.width / baseContentSize.width;
  const clampedRel = Math.min(
    Math.max(currentRel * factor, MIN_ZOOM_REL),
    MAX_ZOOM_REL,
  );
  const actualFactor = clampedRel / currentRel;
  if (actualFactor === 1) return;

  const newWidth = vb.width * actualFactor;
  const newHeight = vb.height * actualFactor;
  const newX = centerX - (centerX - vb.x) * actualFactor;
  const newY = centerY - (centerY - vb.y) * actualFactor;
  svg.setAttribute("viewBox", `${newX} ${newY} ${newWidth} ${newHeight}`);
}

function attachZoomPan(svg) {
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const point = svgPointFromEvent(svg, e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      applyZoom(svg, factor, point.x, point.y);
    },
    { passive: false },
  );

  let isPanning = false;
  let panStartClient = null;
  let panStartViewBox = null;

  svg.addEventListener("pointerdown", (e) => {
    isPanning = true;
    svg.setPointerCapture(e.pointerId);
    panStartClient = { x: e.clientX, y: e.clientY };
    const vb = svg.viewBox.baseVal;
    panStartViewBox = {
      x: vb.x,
      y: vb.y,
      width: vb.width,
      height: vb.height,
    };
  });

  svg.addEventListener("pointermove", (e) => {
    if (!isPanning) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = panStartViewBox.width / rect.width;
    const scaleY = panStartViewBox.height / rect.height;
    const dx = (e.clientX - panStartClient.x) * scaleX;
    const dy = (e.clientY - panStartClient.y) * scaleY;
    svg.setAttribute(
      "viewBox",
      `${panStartViewBox.x - dx} ${panStartViewBox.y - dy} ${panStartViewBox.width} ${panStartViewBox.height}`,
    );
  });

  const endPan = () => {
    isPanning = false;
  };
  svg.addEventListener("pointerup", endPan);
  svg.addEventListener("pointerleave", endPan);
  svg.addEventListener("pointercancel", endPan);
}

document.getElementById("zoomInBtn").addEventListener("click", () => {
  const svg = document.querySelector("#canvasPanel svg");
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  applyZoom(svg, 0.8, vb.x + vb.width / 2, vb.y + vb.height / 2);
});

document.getElementById("zoomOutBtn").addEventListener("click", () => {
  const svg = document.querySelector("#canvasPanel svg");
  if (!svg) return;
  const vb = svg.viewBox.baseVal;
  applyZoom(svg, 1.25, vb.x + vb.width / 2, vb.y + vb.height / 2);
});

let currentFSM = null;

function setStatus(msg, isError) {
  const el = document.getElementById("status");
  el.textContent = msg || "";
  el.className = "status" + (isError ? " error" : "");
}

document.getElementById("createBtn").addEventListener("click", () => {
  const text = document.getElementById("textInput").innerText;
  const words = text.trim().split(/\s+/).filter(Boolean);
  try {
    if (words.length > MAX_WORDS) {
      throw new Error(`word limit exceeded (${words.length} / ${MAX_WORDS})`);
    }

    const fsm = textToFSM(text);
    if (!fsm || !Array.isArray(fsm.states) || !Array.isArray(fsm.transitions)) {
      throw new Error("textToFSM must return { states: [], transitions: [] }");
    }
    currentFSM = fsm;
    renderFSM(fsm);
    setStatus(
      fsm.states.length === 0
        ? "no states returned"
        : `rendered ${fsm.states.length} state(s), ${fsm.transitions.length} transition(s)`,
    );
  } catch (err) {
    console.error(err);
    setStatus("error: " + err.message, true);
  }
});

// ======== WORD LIMIT ========

const MAX_WORDS = 2000;
const textInput = document.getElementById("textInput");
const wordCount = document.getElementById("wordCount");

let updatingText = false;

function updateWordLimit() {
  const text = textInput.innerText;
  const words = text.trim().split(/\s+/).filter(Boolean);

  wordCount.textContent = `${words.length} / ${MAX_WORDS}`;

  if (words.length > MAX_WORDS) {
    wordCount.classList.add("limit-exceeded");
  } else {
    wordCount.classList.remove("limit-exceeded");
  }
}

textInput.addEventListener("input", () => {
  updateWordLimit();
});
