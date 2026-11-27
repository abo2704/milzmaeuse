// Stadtplan: frei nachgebautes, stark vereinfachtes Braunschweig (nicht maßstabsgetreu).
// Die Karte besteht aus Kacheln (T Pixel groß). Alles, was nicht Straße/Platz/Park/Wasser ist, sind Häuser.

export const T = 32;            // Pixel pro Kachel
export const W = 160, H = 120;  // Kartengröße in Kacheln
export const BUILD = 0, ROAD = 1, WALK = 2, PED = 3, PARK = 4, WATER = 5, BRIDGE = 6, LAND = 7;

// Wer darf wo hin? (Bitmasken über die Kacheltypen)
const m = (...t) => t.reduce((a, b) => a | (1 << b), 0);
export const PASS = {
  foot: m(ROAD, WALK, PED, PARK, BRIDGE),
  car: m(ROAD, WALK, PED, PARK, BRIDGE),
  boat: m(WATER, BRIDGE),
  ped: m(WALK, PED, PARK),
  thief: m(WALK, PED),
};

export const grid = new Uint8Array(W * H);
export const landAt = new Int16Array(W * H).fill(-1);

// Okerumflut: Wasserring um die Innenstadt
export const RING = { cx: 80, cy: 60, rx: 52, ry: 42 };
const ringR = (x, y) => Math.hypot((x - RING.cx) / RING.rx, (y - RING.cy) / RING.ry);

// Wahrzeichen: rect = [x0, y0, x1, y1) in Kacheln
export const LANDMARKS = [
  { id: 'burg', name: 'Burg Dankwarderode', rect: [70, 41, 75, 48], color: '#c2a878', roof: '#8e7350' },
  { id: 'dom', name: 'Dom St. Blasii', rect: [84, 51, 94, 57], color: '#9b958d', roof: '#6c6862' },
  { id: 'loewe', name: 'Burglöwe', rect: [78, 44, 80, 46], color: '#e0aa22', roof: '#a87a10', statue: true },
  { id: 'altrathaus', name: 'Altstadtrathaus', rect: [48, 49, 55, 53], color: '#cf9160', roof: '#9a5f36' },
  { id: 'brunnen', name: 'Eulenspiegelbrunnen', rect: [55, 40, 57, 42], color: '#7cc0e4', roof: '#3d88b3', statue: true },
  { id: 'rathaus', name: 'Rathaus', rect: [86, 60, 94, 67], color: '#b3aca2', roof: '#7d766c' },
  { id: 'schloss', name: 'Schloss', rect: [100, 42, 113, 55], color: '#efe8d8', roof: '#b8ad94' },
  { id: 'rizzi', name: 'Happy-Rizzi-Haus', rect: [108, 61, 113, 66], color: '#ff6fa3', roof: '#ffd23f', rizzi: true },
  { id: 'magni', name: 'Magnikirche', rect: [102, 68, 107, 72], color: '#a1958a', roof: '#6f655c' },
  { id: 'gauss', name: 'Gauß-Denkmal', rect: [47, 87, 49, 89], color: '#6f9484', roof: '#3f6456', statue: true },
  { id: 'ptb', name: 'PTB', rect: [1, 47, 16, 73], color: '#8ea2b6', roof: '#5e7389' },
  { id: 'hbf', name: 'Hauptbahnhof', rect: [106, 112, 132, 119], color: '#bcc2c8', roof: '#848c94' },
  { id: 'stadion', name: 'Eintracht-Stadion', rect: [143, 11, 158, 24], color: '#2f6fb3', roof: '#f3c613', stadium: true },
];

// Orte zum Ansprechen/Untersuchen (Kachelkoordinaten, liegen auf begehbaren Kacheln)
export const SPOTS = {
  eule: { x: 58, y: 43, name: 'Eulenspiegelbrunnen' },
  loewe: { x: 81, y: 46, name: 'Burgplatz' },
  gauss: { x: 50, y: 88, name: 'Gauß-Denkmal' },
  ptb: { x: 17.5, y: 60.5, name: 'PTB, Tor 2' },
  dom: { x: 89, y: 58, name: 'Dom' },
  rizzi: { x: 110.5, y: 60.3, name: 'Happy-Rizzi-Haus' },
  schloss: { x: 106, y: 39.5, name: 'Schlossplatz' },
  hbf: { x: 119, y: 110.6, name: 'Hauptbahnhof' },
  stadion: { x: 142.3, y: 17, name: 'Eintracht-Stadion' },
  magni: { x: 104, y: 73.5, name: 'Magniviertel' },
  altrathaus: { x: 52, y: 56, name: 'Altstadtmarkt' },
  burg: { x: 76, y: 49.5, name: 'Burg Dankwarderode' },
  prinz: { x: 150, y: 40, name: 'Prinz-Albrecht-Park' },
  buerger: { x: 60, y: 114, name: 'Bürgerpark' },
  kohlmarkt: { x: 66, y: 59, name: 'Kohlmarkt' },
};

export const START = { x: 119 * T, y: 110.8 * T }; // Hauptbahnhof, Vorplatz

// Straßenbahn-Strecke (Kachelkoordinaten), wird hin und zurück gefahren
export const TRAM_PATH = [[126, 108], [118, 108], [96, 86], [96, 9]];
// Lieferwagen-Route vom Burgplatz zur PTB
export const VAN_PATH = [[82, 47], [80, 36], [80, 34], [94, 34], [96, 37], [96, 77], [94, 80], [49, 80], [46, 77], [46, 63], [43, 60], [17.5, 60]];

// ---------- Karte bauen ----------
const idx = (x, y) => y * W + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const tileAt = (tx, ty) => (inMap(tx, ty) ? grid[idx(tx, ty)] : BUILD);
export const tileAtPx = (px, py) => tileAt(Math.floor(px / T), Math.floor(py / T));

function rect(x0, y0, x1, y1, type) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inMap(x, y)) grid[idx(x, y)] = type;
}
// Dicke Linie aus Kacheln. Straßen über Wasser werden zu Brücken.
function line(ax, ay, bx, by, w, type) {
  const r = (w - 1) / 2 + 0.01;
  const minx = Math.floor(Math.min(ax, bx) - r - 1), maxx = Math.ceil(Math.max(ax, bx) + r + 1);
  const miny = Math.floor(Math.min(ay, by) - r - 1), maxy = Math.ceil(Math.max(ay, by) + r + 1);
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
    if (!inMap(x, y)) continue;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d > r) continue;
    const i = idx(x, y);
    if (type === ROAD) grid[i] = (grid[i] === WATER || grid[i] === BRIDGE) ? BRIDGE : ROAD;
    else grid[i] = type;
  }
}
function poly(points, w, type) {
  for (let i = 0; i < points.length - 1; i++) line(...points[i], ...points[i + 1], w, type);
}
export function ringPoint(a, s) { return [RING.cx + Math.cos(a) * RING.rx * s, RING.cy + Math.sin(a) * RING.ry * s]; }

function build() {
  grid.fill(BUILD);
  // Grüne Wallanlagen + Okerumflut
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const r = ringR(x + 0.5, y + 0.5);
    if (r >= 0.87 && r < 1.0) grid[idx(x, y)] = PARK;
    else if (r >= 1.0 && r < 1.07) grid[idx(x, y)] = WATER;
    else if (r >= 1.07 && r < 1.11) grid[idx(x, y)] = PARK;
  }
  // Oker: Zufluss im Süden, Abfluss im Norden
  poly([[71, 102], [70, 110], [72, 119]], 3, WATER);
  poly([[60, 21], [58, 10], [55, 0]], 3, WATER);
  // Parks
  rect(40, 110, 100, 120, PARK);     // Bürgerpark
  rect(143, 27, 158, 52, PARK);      // Prinz-Albrecht-Park
  rect(42, 83, 54, 93, PARK);        // Gaußberg
  rect(24, 76, 34, 100, PARK);       // Grün im Westen
  poly([[71, 102], [70, 110], [72, 119]], 3, WATER);

  // Straßen (alle 3 Kacheln breit)
  const ring = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.04) ring.push(ringPoint(a, 0.95));
  poly(ring, 3, ROAD);                                   // Wallring
  poly([[42, 34], [118, 34]], 3, ROAD);                  // Lange Straße / Hagenmarkt
  poly([[96, 8], [96, 108]], 3, ROAD);                   // Bohlweg (mit Straßenbahn)
  poly([[46, 34], [46, 80]], 3, ROAD);                   // Güldenstraße
  poly([[16, 60], [46, 60]], 3, ROAD);                   // Bundesallee → PTB
  poly([[46, 80], [124, 80]], 3, ROAD);                  // Südstraße
  poly([[80, 34], [80, 40]], 3, ROAD);                   // Zufahrt Burgplatz
  poly([[96, 58], [140, 58]], 3, ROAD);                  // Ackerhof → Osten
  poly([[96, 86], [118, 108]], 3, ROAD);                 // Kurt-Schumacher-Straße
  poly([[22, 8], [140, 8], [140, 108], [22, 108], [22, 8]], 3, ROAD); // äußerer Ring

  // Plätze und Fußgängerzone (Fußgängerzone = Ärger mit dem Ordnungsamt, wenn man rast)
  rect(70, 40, 87, 51, PED);    // Burgplatz
  rect(53, 36, 60, 46, PED);    // Bäckerklint
  rect(55, 46, 58, 54, PED);
  rect(49, 54, 61, 63, PED);    // Altstadtmarkt
  rect(61, 56, 63, 60, PED);    // Schuhstraße
  rect(63, 55, 71, 63, PED);    // Kohlmarkt
  rect(66, 48, 71, 55, PED);    // Sack
  rect(71, 57, 84, 60, PED);
  rect(84, 57, 95, 60, PED);    // Platz der Deutschen Einheit
  rect(98, 37, 115, 42, WALK);  // Schlossplatz
  rect(99, 66, 116, 75, WALK);  // Magniviertel
  rect(16, 56, 22, 65, WALK);   // Vorplatz PTB
  rect(104, 110, 134, 112, WALK); // Bahnhofsvorplatz

  // Gehwege neben Straßen
  const copy = grid.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (copy[idx(x, y)] !== BUILD) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const t = inMap(x + dx, y + dy) ? copy[idx(x + dx, y + dy)] : BUILD;
      if (t === ROAD || t === BRIDGE) { near = true; break; }
    }
    if (near) grid[idx(x, y)] = WALK;
  }
  // Wahrzeichen
  LANDMARKS.forEach((l, i) => {
    const [x0, y0, x1, y1] = l.rect;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { grid[idx(x, y)] = LAND; landAt[idx(x, y)] = i; }
  });
}
build();

// ---------- Zeichnen ----------
const COL = {
  [ROAD]: '#4b4f57', [WALK]: '#cfc9bc', [PED]: '#dccaa2', [PARK]: '#86b86a',
  [WATER]: '#4f93c9', [BRIDGE]: '#62666e',
};
const ROOFS = ['#b5654a', '#c47a55', '#9c5a45', '#8a8f96', '#a3a7ad', '#b88d5e', '#7d6a5c', '#c9a26b', '#9a7a62'];
function hash(x, y) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const lotOf = (x, y) => (Math.floor((x + (Math.floor(y / 4) % 2) * 2) / 4) * 1000 + Math.floor(y / 4));

function drawTile(g, x, y, px, py) {
  const t = tileAt(x, y);
  if (t === BUILD) {
    const lot = lotOf(x, y);
    g.fillStyle = ROOFS[Math.floor(hash(lot, 7) * ROOFS.length)];
    g.fillRect(px, py, T, T);
    // Dachfirst andeuten
    g.fillStyle = 'rgba(255,255,255,0.07)';
    g.fillRect(px, py, T, T / 2);
    g.strokeStyle = 'rgba(40,25,20,0.45)'; g.lineWidth = 2;
    const edge = (nx, ny) => tileAt(nx, ny) !== BUILD || lotOf(nx, ny) !== lot;
    g.beginPath();
    if (edge(x, y - 1)) { g.moveTo(px, py + 1); g.lineTo(px + T, py + 1); }
    if (edge(x, y + 1)) { g.moveTo(px, py + T - 1); g.lineTo(px + T, py + T - 1); }
    if (edge(x - 1, y)) { g.moveTo(px + 1, py); g.lineTo(px + 1, py + T); }
    if (edge(x + 1, y)) { g.moveTo(px + T - 1, py); g.lineTo(px + T - 1, py + T); }
    g.stroke();
    return;
  }
  if (t === LAND) {
    const l = LANDMARKS[landAt[idx(x, y)]];
    if (l.rizzi) {
      const c = ['#ff6fa3', '#ffd23f', '#3fc1ff', '#7ee081', '#b388ff'];
      g.fillStyle = c[(x + y * 2) % c.length]; g.fillRect(px, py, T, T);
      g.fillStyle = '#222'; g.beginPath(); g.arc(px + 10, py + 12, 3, 0, 7); g.arc(px + 22, py + 12, 3, 0, 7); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.arc(px + 16, py + 17, 7, 0.2, Math.PI - 0.2); g.stroke();
    } else if (l.stadium) {
      const [x0, y0, x1, y1] = l.rect;
      const inner = x > x0 + 2 && x < x1 - 3 && y > y0 + 2 && y < y1 - 3;
      g.fillStyle = inner ? '#3c9a4c' : ((x + y) % 2 ? l.color : l.roof);
      g.fillRect(px, py, T, T);
      if (inner) { g.fillStyle = 'rgba(255,255,255,0.12)'; if (x % 2) g.fillRect(px, py, T, T); }
    } else if (l.statue) {
      g.fillStyle = '#d8ccb0'; g.fillRect(px, py, T, T);
    } else {
      // großes Dach mit hellem Rand an den Außenkanten
      g.fillStyle = l.roof; g.fillRect(px, py, T, T);
      const [x0, y0, x1, y1] = l.rect;
      g.fillStyle = l.color;
      if (y === y0) g.fillRect(px, py, T, 7);
      if (y === y1 - 1) g.fillRect(px, py + T - 7, T, 7);
      if (x === x0) g.fillRect(px, py, 7, T);
      if (x === x1 - 1) g.fillRect(px + T - 7, py, 7, T);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      if ((x + y) % 2) g.fillRect(px, py, T, T);
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    const [x0, y0, x1, y1] = l.rect;
    g.beginPath();
    if (y === y0) { g.moveTo(px, py + 1); g.lineTo(px + T, py + 1); }
    if (y === y1 - 1) { g.moveTo(px, py + T - 1); g.lineTo(px + T, py + T - 1); }
    if (x === x0) { g.moveTo(px + 1, py); g.lineTo(px + 1, py + T); }
    if (x === x1 - 1) { g.moveTo(px + T - 1, py); g.lineTo(px + T - 1, py + T); }
    g.stroke();
    return;
  }
  g.fillStyle = COL[t]; g.fillRect(px, py, T, T);
  const h = hash(x, y);
  if (t === WALK) {
    g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1;
    g.strokeRect(px + 0.5, py + 0.5, T / 2, T / 2); g.strokeRect(px + T / 2 + 0.5, py + T / 2 + 0.5, T / 2 - 1, T / 2 - 1);
  } else if (t === PED) {
    g.fillStyle = 'rgba(120,90,50,0.18)';
    for (let i = 0; i < 6; i++) g.fillRect(px + hash(x * 7 + i, y) * 28, py + hash(x, y * 5 + i) * 28, 4, 3);
  } else if (t === ROAD) {
    g.fillStyle = 'rgba(255,255,255,0.03)'; if (h < 0.5) g.fillRect(px, py, T, T);
    // Bordstein
    g.fillStyle = '#9a968e';
    const curb = (nx, ny) => { const n = tileAt(nx, ny); return n !== ROAD && n !== BRIDGE; };
    if (curb(x, y - 1)) g.fillRect(px, py, T, 2);
    if (curb(x, y + 1)) g.fillRect(px, py + T - 2, T, 2);
    if (curb(x - 1, y)) g.fillRect(px, py, 2, T);
    if (curb(x + 1, y)) g.fillRect(px + T - 2, py, 2, T);
  } else if (t === PARK) {
    g.fillStyle = 'rgba(40,90,30,0.15)'; if (h < 0.4) g.fillRect(px + h * 20, py + 6, 8, 6);
  } else if (t === WATER) {
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
    g.beginPath(); const wy = py + 8 + h * 16; g.moveTo(px + 4, wy); g.quadraticCurveTo(px + 10, wy - 4, px + 16, wy); g.quadraticCurveTo(px + 22, wy + 4, px + 28, wy); g.stroke();
  } else if (t === BRIDGE) {
    g.fillStyle = '#c4beb2';
    const w = (nx, ny) => { const n = tileAt(nx, ny); return n !== ROAD && n !== BRIDGE; };
    if (w(x, y - 1)) g.fillRect(px, py, T, 4);
    if (w(x, y + 1)) g.fillRect(px, py + T - 4, T, 4);
    if (w(x - 1, y)) g.fillRect(px, py, 4, T);
    if (w(x + 1, y)) g.fillRect(px + T - 4, py, 4, T);
  }
}

// Schatten der Häuser auf Boden + Bäume
function drawOverlay(g, x, y, px, py) {
  const t = tileAt(x, y);
  if (t === BUILD || t === LAND) return;
  const solid = (nx, ny) => { const n = tileAt(nx, ny); return n === BUILD || (n === LAND && !LANDMARKS[landAt[idx(nx, ny)]].statue); };
  g.fillStyle = 'rgba(0,0,0,0.18)';
  if (solid(x, y - 1)) g.fillRect(px, py, T, 7);
  if (solid(x - 1, y)) g.fillRect(px, py, 6, T);
  if (t === PARK) {
    const h = hash(x * 3, y * 11);
    const nearRoad = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => { const n = tileAt(x + dx, y + dy); return n === ROAD || n === BRIDGE || n === WATER; });
    if (h < 0.33 && !nearRoad) {
      const cx = px + 8 + hash(x, y) * 16, cy = py + 8 + hash(y, x) * 16, r = 9 + h * 12;
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.arc(cx + 4, cy + 4, r, 0, 7); g.fill();
      g.fillStyle = h < 0.15 ? '#3f7d3a' : '#4f9346'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(cx - r / 3, cy - r / 3, r / 2.5, 0, 7); g.fill();
    }
  }
}

// Karte in Stücken (Chunks) vorzeichnen und zwischenspeichern
const CH = 16, CHPX = CH * T, cache = new Map();
function chunk(cx, cy) {
  const key = cx + ',' + cy;
  let c = cache.get(key);
  if (c) { cache.delete(key); cache.set(key, c); return c; }
  c = document.createElement('canvas'); c.width = c.height = CHPX;
  const g = c.getContext('2d');
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) drawTile(g, cx * CH + x, cy * CH + y, x * T, y * T);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) drawOverlay(g, cx * CH + x, cy * CH + y, x * T, y * T);
  cache.set(key, c);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return c;
}
export function drawMap(ctx, vx0, vy0, vx1, vy1) {
  const c0 = Math.max(0, Math.floor(vx0 / CHPX)), c1 = Math.min(Math.ceil(W / CH) - 1, Math.floor(vx1 / CHPX));
  const r0 = Math.max(0, Math.floor(vy0 / CHPX)), r1 = Math.min(Math.ceil(H / CH) - 1, Math.floor(vy1 / CHPX));
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) ctx.drawImage(chunk(cx, cy), cx * CHPX, cy * CHPX);
}

// Kleine Übersichtskarte (1 Pixel je Kachel)
export function miniMapImage() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H);
  const MC = { [BUILD]: [150, 110, 90], [ROAD]: [70, 74, 82], [WALK]: [200, 195, 185], [PED]: [225, 205, 160], [PARK]: [120, 175, 95], [WATER]: [70, 140, 200], [BRIDGE]: [90, 94, 100] };
  for (let i = 0; i < W * H; i++) {
    let col = MC[grid[i]];
    if (grid[i] === LAND) { const hex = LANDMARKS[landAt[i]].color; col = [1, 3, 5].map(k => parseInt(hex.substr(k, 2), 16)); }
    img.data.set([...col, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  return c;
}

export const tilesOfPath = (path) => path.map(([x, y]) => [x * T, y * T]);
