// „Und täglich grüßt der Löwe“ – ein Zeitschleifen-Abenteuer in Braunschweig.
import {
  T, W, H, PASS, PED, PARK, LANDMARKS, SPOTS, START, TRAM_PATH, VAN_PATH,
  tileAt, tileAtPx, drawMap, miniMapImage, ringPoint,
} from './map.js';
import { poll, setupTouch, pushHit, touch } from './input.js';
import * as inputMod from './input.js';
import { sfx, unlock, engineSound, toggleMute, isMuted } from './audio.js';
import * as S from './story.js';

const APP_VERSION = 'v1';
const coarse = matchMedia('(pointer: coarse)').matches;
const $ = id => document.getElementById(id);
const cv = $('game'), ctx = cv.getContext('2d');
let vw = 0, vh = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  vw = innerWidth; vh = innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
}
addEventListener('resize', resize); resize();

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const spotPx = id => ({ x: SPOTS[id].x * T, y: SPOTS[id].y * T });
const fmtClock = s => { s = Math.floor(s); const h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
const fmtDur = s => { s = Math.floor(s); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min ${s % 60} s`; };

// ---------- Spielstand ----------
const SAVE_KEY = 'bs-loewe-v1';
const fresh = () => ({ mem: {}, loops: 0, won: false, deliveries: 0, best: 0, play: 0, started: false });
let save = load();
function load() { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return fresh(); } }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* privates Fenster */ } }

// ---------- Kollision mit der Karte ----------
function blocked(x, y, r, mask) {
  const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if ((mask >> tileAt(tx, ty)) & 1) continue;
    const cx = clamp(x, tx * T, tx * T + T), cy = clamp(y, ty * T, ty * T + T);
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
  }
  return false;
}
function move(e, dx, dy) {
  let hx = false, hy = false;
  if (dx) { if (!blocked(e.x + dx, e.y, e.r, e.mask)) e.x += dx; else hx = true; }
  if (dy) { if (!blocked(e.x, e.y + dy, e.r, e.mask)) e.y += dy; else hy = true; }
  return [hx, hy];
}
function integrate(e, dt) {
  const [hx, hy] = move(e, e.vx * dt, e.vy * dt);
  let imp = 0;
  if (hx) { imp = Math.max(imp, Math.abs(e.vx)); e.vx *= -0.3; }
  if (hy) { imp = Math.max(imp, Math.abs(e.vy)); e.vy *= -0.3; }
  return imp;
}

// ---------- Fahrzeuge ----------
const CAR = { acc: 340, brk: 620, max: 360, grip: 10, turn: 2.7, r: 14, len: 40, wid: 20, mask: PASS.car };
const KINDS = {
  car: CAR,
  traffic: { ...CAR, max: 160 },
  amt: { ...CAR, max: 315, len: 41 },
  van: { ...CAR, acc: 270, brk: 500, max: 240, turn: 2.3, r: 16, len: 50, wid: 24 },
  boat: { acc: 150, brk: 200, max: 180, grip: 2.2, turn: 1.9, r: 14, len: 40, wid: 22, mask: PASS.boat },
};
const COLORS = ['#d94f4f', '#3b7dd8', '#f2c230', '#55b36b', '#e07b39', '#8e5bd1', '#2fb5b5', '#d94f8a', '#9aa0a6', '#f5f5f5', '#2d3436'];
function makeVeh(kind, x, y, a, color) {
  return { type: 'veh', kind, ...KINDS[kind], x, y, a, vx: 0, vy: 0, fs: 0, ls: 0, color: color || pick(COLORS), inv: kind === 'van' ? 0.6 : 1, stuck: 0, reverse: 0 };
}
function drive(c, steer, thr, hand, dt) {
  let fx = Math.cos(c.a), fy = Math.sin(c.a);
  let fs = c.vx * fx + c.vy * fy, ls = -c.vx * fy + c.vy * fx;
  const max = c.max * (c.kind !== 'boat' && tileAtPx(c.x, c.y) === PARK ? 0.55 : 1);
  if (thr > 0) fs += (fs < -5 ? c.brk : c.acc) * thr * dt;
  else if (thr < 0) fs -= (fs > 5 ? c.brk : c.acc * 0.6) * -thr * dt;
  else fs -= Math.sign(fs) * Math.min(Math.abs(fs), (c.kind === 'boat' ? 40 : 110) * dt);
  if (hand) fs -= Math.sign(fs) * Math.min(Math.abs(fs), 260 * dt);
  if (fs > max) fs = Math.max(max, fs - 500 * dt);
  if (fs < -max * 0.45) fs = -max * 0.45;
  c.a += steer * c.turn * clamp(fs / 140, -1, 1) * dt;
  ls *= Math.exp(-(hand ? 1.6 : c.grip) * dt);
  fx = Math.cos(c.a); fy = Math.sin(c.a);
  c.vx = fx * fs - fy * ls; c.vy = fy * fs + fx * ls;
  c.fs = fs; c.ls = ls;
}
// Einfacher Fahrer: lenkt zu einem Zielpunkt, setzt bei Feststecken zurück
function aiDrive(c, tx, ty, speed, dt) {
  const diff = wrap(Math.atan2(ty - c.y, tx - c.x) - c.a);
  let steer = clamp(diff * 2.2, -1, 1);
  let thr = c.fs < speed * (Math.abs(diff) > 0.9 ? 0.45 : 1) ? 1 : 0;
  if (c.reverse > 0) { c.reverse -= dt; steer = -steer; thr = -1; }
  else {
    if (Math.abs(c.fs) < 14 && thr > 0) c.stuck += dt; else c.stuck = Math.max(0, c.stuck - dt);
    if (c.stuck > 1.0) { c.reverse = 0.8; c.stuck = 0; }
  }
  return { steer, thr };
}

// ---------- Welt ----------
let loop, player, vehicles, peds, trams, bubbles, skids, amts, till, thief, flow, flowT = 0;
let cam = { x: START.x, y: START.y, zoom: 1 }, shake = 0, mode = 'title', flash = null, freeRoam = false;
let toastQ = [], toastT = 0;

const PARKED = [
  [116, 110.5, 0], [122, 110.5, Math.PI], [128, 110.5, 0], [111, 110.5, 0], [84, 42.5, Math.PI / 2],
  [19, 58, 0], [50, 82.3, 0], [104, 39.5, 0], [60, 32.3, Math.PI], [142.3, 30, Math.PI / 2],
  [100.5, 70, Math.PI / 2], [104, 36.2, 0], [26, 107, 0], [138, 62, Math.PI / 2],
];
const BOATS = [[80.5, 103.5, 0], [70.5, 18.5, Math.PI]];
const ringPath = s => { const p = []; for (let a = 0; a < Math.PI * 2; a += 0.04) { const [x, y] = ringPoint(a, s); p.push({ x: x * T + T / 2, y: y * T + T / 2 }); } return p; };
const PATHS = {
  cw: ringPath(0.94),
  ccw: ringPath(0.96).reverse(),
  outer: (() => { const c = [[22, 8], [140, 8], [140, 108], [22, 108], [22, 8]], p = []; for (let i = 0; i < 4; i++) { const [ax, ay] = c[i], [bx, by] = c[i + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / 3; for (let k = 0; k < n; k++) p.push({ x: (ax + (bx - ax) * k / n) * T + T / 2, y: (ay + (by - ay) * k / n) * T + T / 2 }); } return p; })(),
};
const VAN_PX = VAN_PATH.map(([x, y]) => ({ x: x * T, y: y * T }));

function makeTram(s, dir) {
  const pts = TRAM_PATH.map(([x, y]) => ({ x: x * T + T / 2, y: y * T + T / 2 }));
  const lens = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = dist(pts[i], pts[i + 1]); lens.push(l); total += l; }
  return { pts, lens, total, s, dir, wait: 0, x: 0, y: 0, a: 0, vx: 0, vy: 0 };
}
function tramPos(tr) {
  let s = clamp(tr.s, 0, tr.total);
  for (let i = 0; i < tr.lens.length; i++) {
    if (s <= tr.lens[i] || i === tr.lens.length - 1) {
      const a = tr.pts[i], b = tr.pts[i + 1], k = s / tr.lens[i];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: Math.atan2(b.y - a.y, b.x - a.x) };
    }
    s -= tr.lens[i];
  }
}

function resetLoop() {
  loop = {
    t: 0, n: save.loops + 1, van: null, vanSpawned: false, vanCaught: false, vanSearched: false,
    thief: null, thiefSpawned: false, thiefDone: false, synced: false, won: freeRoam,
    heat: 0, lastInfr: -99, deliveries: 0, job: null, jobCd: 2, kalleSeen: false, tick: -1,
  };
  player = { type: 'player', x: START.x, y: START.y, vx: 0, vy: 0, r: 9, inv: 1.5, mask: PASS.foot, in: null, face: -Math.PI / 2 };
  vehicles = PARKED.map(([x, y, a]) => makeVeh('car', x * T, y * T, a));
  BOATS.forEach(([x, y, a]) => { const b = makeVeh('boat', x * T, y * T, a, '#ffffff'); vehicles.push(b); });
  const addTraffic = (path, n, offset) => {
    for (let i = 0; i < n; i++) {
      const k = Math.floor((i / n) * path.length + offset) % path.length, p = path[k], q = path[(k + 1) % path.length];
      const c = makeVeh('traffic', p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x));
      c.path = path; c.pi = (k + 1) % path.length; c.driver = true; vehicles.push(c);
    }
  };
  addTraffic(PATHS.cw, 7, 3); addTraffic(PATHS.ccw, 5, 10); addTraffic(PATHS.outer, 5, 2);
  peds = []; bubbles = []; skids = []; amts = []; thief = null;
  trams = [makeTram(0, 1), makeTram(1600, -1)];
  till = { type: 'till', x: SPOTS.eule.x * T, y: SPOTS.eule.y * T, r: 9, inv: 0, vx: 0, vy: 0 };
  cam.x = player.x; cam.y = player.y;
}

// ---------- Erinnerungen, Hinweise ----------
function addMemory(id) {
  if (save.mem[id]) return;
  save.mem[id] = true; persist();
  sfx.memory(); toast('💡 Neue Erinnerung! (Tab / △)');
}
function toast(text, sec = 3) { toastQ.push({ text, sec }); }
function say(ent, text, t = 2.2) {
  const b = bubbles.find(b => b.ent === ent);
  if (b) { b.text = text; b.t = t; } else bubbles.push({ ent, text, t });
}
function infraction(amount) { loop.heat = Math.min(4.5, loop.heat + amount); loop.lastInfr = loop.t; }
const stars = () => (loop.heat >= 4 ? 3 : loop.heat >= 2.5 ? 2 : loop.heat >= 1 ? 1 : 0);

// ---------- Ordnungsamt: Wegekarte zum Spieler (Breitensuche über befahrbare Kacheln) ----------
function buildFlow(px, py) {
  const d = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H);
  const sx = clamp(Math.floor(px / T), 0, W - 1), sy = clamp(Math.floor(py / T), 0, H - 1);
  let h = 0, t = 0; q[t++] = sy * W + sx; d[sy * W + sx] = 0;
  while (h < t) {
    const c = q[h++], x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx; if (d[n] >= 0 || !((PASS.car >> tileAt(nx, ny)) & 1)) continue;
      d[n] = d[c] + 1; q[t++] = n;
    }
  }
  return d;
}
function flowTarget(c) {
  let x = Math.floor(c.x / T), y = Math.floor(c.y / T);
  for (let step = 0; step < 2; step++) {
    let best = flow[y * W + x], bx = x, by = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const v = flow[ny * W + nx]; if (v >= 0 && (best < 0 || v < best)) { best = v; bx = nx; by = ny; }
    }
    x = bx; y = by;
  }
  return { x: x * T + T / 2, y: y * T + T / 2 };
}
function spawnAmt() {
  const pos = pv();
  for (let i = 0; i < 300; i++) {
    const tx = Math.floor(rnd(0, W)), ty = Math.floor(rnd(0, H)), v = flow[ty * W + tx];
    if (v < 22 || v > 45 || tileAt(tx, ty) === PED) continue;
    const a = makeVeh('amt', tx * T + T / 2, ty * T + T / 2, Math.atan2(pos.y - ty * T, pos.x - tx * T), '#f4f6f8');
    amts.push(a); vehicles.push(a); sfx.siren(); return;
  }
}

// Spielerposition (zu Fuß oder im Fahrzeug)
const pv = () => (player.in || player);

// ---------- Spiellogik pro Schritt ----------
const STEP = 1 / 60;
function step(dt, inp, title = false) {
  if (!title) {
    loop.t += dt;
    events();
  }
  const me = pv();
  // Spieler steuern
  if (!title) {
    if (player.in) {
      const c = player.in;
      const thr = inp.gas - inp.brake;
      drive(c, inp.x, thr, inp.hand, dt);
      if (Math.abs(c.ls) > 110 || (inp.hand && Math.abs(c.fs) > 90)) {
        const bx = c.x - Math.cos(c.a) * 15, by = c.y - Math.sin(c.a) * 15;
        if (c.kind !== 'boat') skids.push({ x: bx, y: by, a: c.a, t: 12 });
        if (skids.length > 500) skids.shift();
      }
      // Fußgängerzone: Rasen gibt Ärger
      if (c.kind !== 'boat' && tileAtPx(c.x, c.y) === PED && Math.abs(c.fs) > 70) infraction(0.5 * dt);
    } else {
      let ix = inp.x, iy = inp.y; const l = Math.hypot(ix, iy);
      if (l > 1) { ix /= l; iy /= l; }
      const sp = inp.hand ? 205 : 150;
      player.vx = ix * sp; player.vy = iy * sp;
      if (l > 0.1) player.face = Math.atan2(iy, ix);
      player.walk = (player.walk || 0) + l * dt * 10;
    }
  }
  // Verkehr
  for (const c of vehicles) {
    if (c === player.in) continue;
    if (c.kind === 'traffic' && c.driver) {
      let tgt = c.path[c.pi];
      if (dist(c, tgt) < 70) { c.pi = (c.pi + 1) % c.path.length; tgt = c.path[c.pi]; }
      const nx = c.path[(c.pi + 1) % c.path.length];
      let { steer, thr } = aiDrive(c, (tgt.x + nx.x) / 2, (tgt.y + nx.y) / 2, 160, dt);
      // Hindernis voraus? Bremsen.
      const fx = Math.cos(c.a), fy = Math.sin(c.a);
      let blockedBy = null;
      for (const o of [me, ...vehicles, ...peds]) {
        if (o === c) continue;
        const dx = o.x - c.x, dy = o.y - c.y, ahead = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
        if (ahead > 0 && ahead < 95 && side < 24) { blockedBy = o; break; }
      }
      if (blockedBy) {
        thr = c.fs > 10 ? -1 : 0; c.stuck = 0;
        c.wait = (c.wait || 0) + dt;
        if (c.wait > 1.6 && blockedBy === me && !c.honked) { c.honked = true; sfx.honk(); say(c, 'Hup! Hup!'); }
        if (c.wait > 4) { c.reverse = 0.6; c.wait = 0; }
      } else { c.wait = 0; c.honked = false; }
      drive(c, steer, thr, false, dt);
    } else if (c.kind === 'van') {
      vanAI(c, dt);
    } else if (c.kind === 'amt') {
      amtAI(c, dt);
    } else {
      drive(c, 0, 0, true, dt); // abgestellt: rollt aus
    }
  }
  // Straßenbahnen
  for (const tr of trams) {
    const old = tramPos(tr);
    if (tr.wait > 0) tr.wait -= dt;
    else {
      // vor Hindernissen auf der Strecke kurz bremsen
      tr.s += tr.dir * 110 * dt;
      if (tr.s >= tr.total || tr.s <= 0) { tr.s = clamp(tr.s, 0, tr.total); tr.dir *= -1; tr.wait = 4; }
    }
    const p = tramPos(tr);
    tr.vx = (p.x - old.x) / dt; tr.vy = (p.y - old.y) / dt; tr.x = p.x; tr.y = p.y; tr.a = p.a;
  }
  // Fußgänger
  updatePeds(dt, me);
  if (thief) thiefAI(dt);

  // Bewegung
  for (const c of vehicles) {
    const imp = integrate(c, dt);
    if (c === player.in && imp > 140) { shake = Math.min(12, imp / 30); sfx.bump(); }
  }
  if (!player.in) integrate(player, dt);
  for (const p of peds) integrate(p, dt);
  if (thief) integrate(thief, dt);

  collisions();
  if (!title) {
    heatUpdate(dt);
    courier(dt);
    if (thief && !player.in && dist(player, thief) < player.r + thief.r + 5) catchThief();
  }
  for (const s of skids) s.t -= dt;
  while (skids.length && skids[0].t <= 0) skids.shift();
}

// ---------- Ereignisse der Schleife ----------
function events() {
  if (loop.won) return;
  if (!loop.vanSpawned && loop.t >= S.VAN_TIME) {
    loop.vanSpawned = true;
    const p = VAN_PX[0], q = VAN_PX[1];
    const v = makeVeh('van', p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), '#8d949b');
    v.pi = 1; v.rams = 0; v.stun = 0; v.ramCd = 0; loop.van = v; vehicles.push(v);
    if (dist(pv(), v) < 700) say(v, 'Brumm!');
  }
  if (!loop.thiefSpawned && loop.t >= S.THIEF_TIME) {
    loop.thiefSpawned = true;
    thief = { type: 'thief', x: 82 * T, y: 48.5 * T, vx: 0, vy: 0, r: 8, inv: 1.5, mask: PASS.thief, tauntT: 1, walk: 0, face: 0 };
  }
  if (thief && !loop.kalleSeen && dist(pv(), thief) < 330) { loop.kalleSeen = true; say(thief, 'Hehe! Gleich ist wieder 11:55!', 3); addMemory('kalle'); }
  // letzte 10 Sekunden ticken
  const sec = Math.floor(loop.t);
  if (sec !== loop.tick) { loop.tick = sec; if (sec >= S.LOOP_LEN - 10 && sec < S.LOOP_LEN) sfx.tick(); }
  if (loop.t >= S.LOOP_LEN) startFlash();
}

function vanAI(v, dt) {
  v.ramCd -= dt;
  if (loop.vanCaught) { drive(v, 0, 0, true, dt); return; }
  const tgt = VAN_PX[v.pi];
  if (dist(v, tgt) < 50) {
    v.pi++;
    if (v.pi >= VAN_PX.length) { // in der PTB verschwunden
      vehicles = vehicles.filter(x => x !== v); loop.van = null;
      if (dist(pv(), v) < 900) {
        toast('Der Lieferwagen verschwindet hinter Tor 2 der PTB!', 4);
        addMemory('tor2');
      }
      return;
    }
  }
  if (v.stun > 0) { v.stun -= dt; drive(v, 0, 0, false, dt); return; }
  const t2 = VAN_PX[Math.min(v.pi, VAN_PX.length - 1)];
  const { steer, thr } = aiDrive(v, t2.x, t2.y, v.max, dt);
  drive(v, steer, thr, false, dt);
}

function amtAI(a, dt) {
  if (a.leave > 0) {
    a.leave -= dt; drive(a, 0.3, 0.5, false, dt);
    if (a.leave <= 0) { vehicles = vehicles.filter(x => x !== a); amts = amts.filter(x => x !== a); }
    return;
  }
  const me = pv();
  const tgt = dist(a, me) < 220 || !flow ? me : flowTarget(a);
  const { steer, thr } = aiDrive(a, tgt.x, tgt.y, a.max, dt);
  drive(a, steer, thr, false, dt);
  a.siren = (a.siren || 0) - dt;
  if (a.siren <= 0 && dist(a, me) < 700) { a.siren = 1.6; sfx.siren(); }
}

function heatUpdate(dt) {
  const want = stars();
  if (want > 0) {
    flowT -= dt;
    if (flowT <= 0 || !flow) { const p = pv(); flow = buildFlow(p.x, p.y); flowT = 0.45; }
    const active = amts.filter(a => !a.leave);
    if (active.length < want && Math.random() < dt * 0.8) spawnAmt();
  } else if (amts.some(a => !a.leave)) {
    amts.forEach(a => { if (!a.leave) a.leave = 3; });
    toast('Das Ordnungsamt hat dich aus den Augen verloren.');
  }
  if (loop.t - loop.lastInfr > 6) {
    const near = amts.some(a => !a.leave && dist(a, pv()) < 450);
    loop.heat = Math.max(0, loop.heat - (near ? 0.05 : 0.2) * dt);
  }
}

function belehrung() {
  loop.t += 20; loop.heat = 0;
  amts.forEach(a => (a.leave = 3));
  shake = 8; sfx.fail();
  toast('Belehrung durch das Ordnungsamt: ' + pick(S.AMT_LINES) + ' (−20 Sekunden)', 4);
}

// ---------- Fußgänger ----------
function updatePeds(dt, me) {
  const viewR = Math.hypot(vw, vh) / 2 / cam.zoom;
  peds = peds.filter(p => dist(p, me) < viewR + 700);
  if (peds.length < 38) {
    for (let i = 0; i < 6; i++) {
      const a = rnd(0, Math.PI * 2), d = rnd(viewR + 40, viewR + 450);
      const x = me.x + Math.cos(a) * d, y = me.y + Math.sin(a) * d;
      if (!((PASS.ped >> tileAtPx(x, y)) & 1) || blocked(x, y, 7, PASS.ped)) continue;
      peds.push(makePed(x, y)); break;
    }
  }
  for (const p of peds) {
    if (p.down > 0) { p.down -= dt; p.vx *= Math.exp(-4 * dt); p.vy *= Math.exp(-4 * dt); if (p.down <= 0) say(p, pick(S.PED_SHOUT)); continue; }
    p.t -= dt; p.flee -= dt;
    // Schnelle Autos in der Nähe? Ausweichen!
    if (p.flee <= 0) {
      for (const c of vehicles) {
        const sp = Math.hypot(c.vx, c.vy); if (sp < 120) continue;
        const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy); if (d > 75) continue;
        if ((dx * c.vx + dy * c.vy) / (d * sp) < 0.4) continue;
        const side = Math.sign(-c.vy * dx + c.vx * dy) || 1;
        p.dir = Math.atan2(c.vx * side, -c.vy * side); p.speed = 170; p.flee = 0.5; p.t = 0.5;
        if (Math.random() < 0.5) say(p, pick(S.PED_SHOUT));
        break;
      }
    }
    if (p.t <= 0) { p.t = rnd(2, 5); p.dir = rnd(0, Math.PI * 2); p.speed = Math.random() < 0.2 ? 0 : rnd(30, 55); if (Math.random() < 0.04 && dist(p, me) < 400) say(p, pick(S.PED_IDLE)); }
    p.vx = Math.cos(p.dir) * p.speed; p.vy = Math.sin(p.dir) * p.speed;
    const px = p.x + p.vx * 0.3, py = p.y + p.vy * 0.3;
    if (p.speed && blocked(px, py, 7, PASS.ped)) { p.dir += Math.PI * rnd(0.5, 1.5); p.t = rnd(1, 3); }
    p.walk += dt * p.speed * 0.15;
  }
}
const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1', '#34495e', '#ff7eb6'];
const SKIN = ['#f5d0b5', '#e8b48f', '#c68c64', '#8d5b3e', '#f2c9a0'];
function makePed(x, y) {
  const eintracht = Math.random() < 0.15;
  return { type: 'ped', x, y, vx: 0, vy: 0, r: 7, inv: 2, mask: PASS.ped, dir: rnd(0, 7), speed: 40, t: rnd(0, 3), flee: 0, down: 0, walk: 0, shirt: eintracht ? '#f3c613' : pick(SHIRTS), trim: eintracht ? '#2f6fb3' : null, skin: pick(SKIN), hair: pick(['#3b2a20', '#111', '#a0522d', '#d9b26a', '#888']) };
}

// ---------- Kalle Klau ----------
function thiefAI(dt) {
  const k = thief, me = pv(), d = dist(k, me);
  k.tauntT -= dt;
  if (k.tauntT <= 0) { k.tauntT = rnd(3, 5); if (d < 500) say(k, pick(S.THIEF_TAUNT)); }
  // Vor Autos springt er zur Seite
  if (player.in && d < 55 && Math.hypot(me.vx, me.vy) > 40) {
    const sp = Math.hypot(me.vx, me.vy), nx = -me.vy / sp, ny = me.vx / sp;
    for (const s of [1, -1]) {
      const tx = k.x + nx * 50 * s, ty = k.y + ny * 50 * s;
      if (!blocked(tx, ty, k.r, k.mask)) { k.x = tx; k.y = ty; say(k, 'Hopp!'); break; }
    }
  }
  if (d < 260) {
    const away = Math.atan2(k.y - me.y, k.x - me.x), sp = d < 130 ? 168 : 135;
    for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3, 3]) {
      const a = away + off;
      if (!blocked(k.x + Math.cos(a) * 26, k.y + Math.sin(a) * 26, k.r, k.mask)) { k.vx = Math.cos(a) * sp; k.vy = Math.sin(a) * sp; k.face = a; break; }
    }
    k.walk += dt * 25;
  } else { k.vx *= 0.8; k.vy *= 0.8; }
}
function catchThief() {
  const t = thief; thief = null; loop.thief = null;
  if (loop.synced) {
    sfx.win();
    openPages(S.WIN, winGame);
  } else {
    sfx.fail();
    openPages(S.THIEF_UNSYNCED);
  }
  void t;
}

// ---------- Kollisionen zwischen Körpern ----------
function resolve(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 === 0) return -1;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = rr - d, sum = a.inv + b.inv;
  if (!sum) return -1;
  const push = (e, k) => { if (!e.inv) return; const f = (ov * e.inv) / sum * k; if (e.mask != null) move(e, nx * f, ny * f); else { e.x += nx * f; e.y += ny * f; } };
  push(a, -1); push(b, 1);
  const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rv < 0) {
    const j = (-1.3 * rv) / sum;
    a.vx -= j * a.inv * nx; a.vy -= j * a.inv * ny; b.vx += j * b.inv * nx; b.vy += j * b.inv * ny;
  }
  return Math.max(0, -rv);
}
function tramParts() {
  const parts = [];
  for (const tr of trams) for (const o of [-36, -12, 12, 36]) parts.push({ type: 'tram', x: tr.x + Math.cos(tr.a) * o, y: tr.y + Math.sin(tr.a) * o, r: 13, inv: 0, vx: tr.vx, vy: tr.vy });
  return parts;
}
function collisions() {
  const me = pv();
  const bodies = [...vehicles, ...peds, ...tramParts(), till];
  if (!player.in) bodies.push(player);
  if (thief) bodies.push(thief);
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (Math.abs(a.x - b.x) > 70 || Math.abs(a.y - b.y) > 70) continue;
      if (a.kind === 'boat' || b.kind === 'boat') { if (!(a.kind === 'boat' && b.kind === 'boat')) continue; }
      const imp = resolve(a, b);
      if (imp < 0) continue;
      onHit(a, b, imp, me); onHit(b, a, imp, me);
    }
  }
}
function onHit(a, b, imp, me) {
  // a trifft b
  if (a === me && a.type === 'veh') {
    if (b.kind === 'van' && !loop.vanCaught && imp > 55 && b.ramCd <= 0) {
      b.ramCd = 0.5; b.rams++; b.stun = 0.7; shake = 8; sfx.ram();
      if (b.rams >= 3) { loop.vanCaught = true; say(b, 'Mist!'); openPages(S.VAN_CAUGHT); }
      else toast(`Rumms! ${b.rams}/3`, 1.5);
    } else if (b.kind === 'traffic' && imp > 90) { infraction(0.25); if (b.driver) say(b, pick(S.PED_SHOUT)); sfx.bump(); }
    else if (b.kind === 'amt' && !b.leave && stars() > 0) belehrung();
  }
  if (a.kind === 'amt' && !a.leave && b === me && stars() > 0) belehrung();
  if (b.type === 'ped' && a.type === 'veh' && imp > 70 && b.down <= 0) {
    b.down = 1.8; sfx.bump();
    if (a === me) infraction(0.7);
  }
}

// ---------- Kurier-Aufträge ----------
function courier(dt) {
  const me = pv();
  if (!loop.job) {
    loop.jobCd -= dt;
    if (loop.jobCd <= 0) {
      const from = pick(S.COURIER_SPOTS.filter(s => dist(spotPx(s), me) > 500));
      const to = pick(S.COURIER_SPOTS.filter(s => s !== from));
      loop.job = { from, to, item: pick(S.PARCELS), stage: 'pickup', left: 0 };
    }
    return;
  }
  const j = loop.job;
  const tgt = spotPx(j.stage === 'pickup' ? j.from : j.to);
  if (j.stage === 'deliver') {
    j.left -= dt;
    if (j.left <= 0) { toast('📦 Zu spät – der Kunde ist sauer.'); sfx.fail(); loop.job = null; loop.jobCd = 4; return; }
  }
  if (dist(me, tgt) < 48) {
    if (j.stage === 'pickup') {
      j.stage = 'deliver'; j.left = dist(spotPx(j.from), spotPx(j.to)) / 190 + 18; sfx.pickup();
      toast(`📦 Okerkurier: Bring ${j.item} zum Ziel: ${SPOTS[j.to].name}!`);
    } else {
      loop.deliveries++; save.deliveries++; save.best = Math.max(save.best, loop.deliveries); persist();
      sfx.deliver(); toast(`📦 Geliefert! ${loop.deliveries} in dieser Schleife (Rekord ${save.best})`);
      loop.job = null; loop.jobCd = 3;
    }
  }
}

// ---------- Interaktion ----------
const keyName = () => (inputMod.device === 'pad' ? '✕' : inputMod.device === 'touch' || (coarse && inputMod.device === 'key') ? '✋' : 'E');
const INFO_SPOTS = ['loewe', 'dom', 'schloss', 'rizzi', 'altrathaus', 'magni', 'hbf', 'stadion', 'burg'];
function nearestAction() {
  if (player.in) {
    const c = player.in;
    if (c.kind === 'boat') return { label: 'Ans Ufer', fn: exitVehicle };
    return { label: 'Aussteigen', fn: exitVehicle };
  }
  const opts = [];
  const add = (d, max, label, fn) => { if (d < max) opts.push({ d, label, fn }); };
  add(dist(player, till), 46, 'Mit Till reden', talkTill);
  add(dist(player, spotPx('gauss')), 60, 'Gravur lesen', talkGauss);
  add(dist(player, spotPx('ptb')), 60, 'Tor 2: Code eingeben', talkPtb);
  for (const s of INFO_SPOTS) add(dist(player, spotPx(s)), 50, 'Umschauen: ' + S.SPOT_INFO[s][0].name, () => openPages(S.SPOT_INFO[s]));
  if (loop.van && loop.vanCaught) add(dist(player, loop.van), 46, 'Lieferwagen durchsuchen', searchVan);
  for (const c of vehicles) {
    if (c.kind === 'amt' || c.kind === 'van') continue;
    const max = c.kind === 'boat' ? 100 : 42;
    add(dist(player, c) + 20, max + 20, c.kind === 'boat' ? 'Tretboot fahren' : c.driver ? 'Auto „ausleihen“' : 'Einsteigen', () => enterVehicle(c));
  }
  opts.sort((a, b) => a.d - b.d);
  return opts[0] || null;
}
function enterVehicle(c) {
  if (c.driver) {
    c.driver = false;
    const p = makePed(c.x - Math.sin(c.a) * 22, c.y + Math.cos(c.a) * 22);
    if (!blocked(p.x, p.y, p.r, p.mask)) { peds.push(p); say(p, pick(S.HIJACK), 3); }
    c.kind = 'car'; Object.assign(c, { max: CAR.max });
    infraction(1.2);
  }
  player.in = c; sfx.door();
}
function exitVehicle() {
  const c = player.in;
  const tries = [];
  for (let r = 22; r <= 110; r += 8) for (let k = 0; k < 12; k++) { const a = c.a + Math.PI / 2 + (k * Math.PI) / 6; tries.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r]); }
  for (const [x, y] of tries) {
    if (!blocked(x, y, player.r, PASS.foot)) {
      player.x = x; player.y = y; player.vx = player.vy = 0; player.in = null; sfx.door();
      c.vx *= 0.5; c.vy *= 0.5; return;
    }
  }
  toast(c.kind === 'boat' ? 'Hier ist kein Ufer in der Nähe.' : 'Hier kannst du nicht aussteigen.');
}
function talkTill() {
  const pages = S.tillTalk(save.mem, loop).slice();
  pages.push({ name: 'Till Eulenspiegel', text: 'Noch was?', choices: [{ label: 'Erzähl einen Witz', fn: () => openPages([{ name: 'Till Eulenspiegel', text: pick(S.TILL_JOKES) }]) }, { label: 'Tschüss, Till', fn: null }] });
  openPages(pages);
}
function talkGauss() {
  openPages(S.GAUSS_TEXT, () => openCode({
    name: 'Gauß-Denkmal', text: S.GAUSS_QUESTION, hint: S.GAUSS_HINT,
    check: c => c === S.CODE,
    onOk: () => { sfx.memory(); openPages([{ name: 'Gauß-Denkmal', text: 'Richtig: 5050! Gauß guckt fast ein bisschen stolz. Merk dir die Zahl.', memory: 'code' }]); },
    wrong: 'Die bronzene Augenbraue von Gauß hebt sich. Nochmal?',
  }));
}
function talkPtb() {
  openPages(S.PTB_TEXT, () => openCode({
    name: 'PTB, Tor 2', text: save.mem.code ? 'Code eingeben (du erinnerst dich: 5050)' : 'Code eingeben',
    check: c => c === S.CODE,
    onOk: () => {
      const first = !save.mem.ptb;
      openPages(first ? S.PTB_FIRST : S.PTB_AGAIN, () => openSync(() => {
        loop.synced = true; sfx.win();
        openPages(first ? S.PTB_DONE_FIRST : S.PTB_DONE_AGAIN);
      }));
    },
    wrong: 'Bööp. Falscher Code. Das Tastenfeld blinkt rot.',
  }));
}
function searchVan() {
  if (loop.vanSearched) return openPages([{ name: 'Lieferwagen', text: 'Leer. Bis auf den Zettel mit „Gauß’ Lieblingssumme“.' }]);
  loop.vanSearched = true;
  openPages(save.mem.zettel ? S.VAN_SEARCH_AGAIN : S.VAN_SEARCH);
}

function handleWorldHits(inp) {
  const h = inp.hits;
  if (h.has('act')) { const a = nearestAction(); if (a) a.fn(); }
  if (h.has('menu')) openMenu();
  if (h.has('mem')) openMemories();
  if (h.has('mute')) toast(toggleMute() ? '🔇 Ton aus' : '🔊 Ton an');
  if (h.has('reset')) confirmReset();
}

// ---------- Dialoge ----------
let dlg = null;
const dlgEl = $('dialog');
function hintNext() { return inputMod.device === 'pad' ? 'Weiter: ✕' : inputMod.device === 'touch' ? 'Tippen zum Weiterlesen' : 'Weiter: E / Enter / Leertaste'; }
function openPages(pages, onDone) {
  dlg = { kind: 'pages', pages, i: 0, onDone, sel: 0 };
  showPage();
}
function showPage() {
  const p = dlg.pages[dlg.i];
  if (p.memory) addMemory(p.memory);
  dlgEl.className = '';
  $('dlgName').textContent = p.name || '';
  if (p.html) $('dlgText').innerHTML = p.html; else $('dlgText').textContent = p.text;
  const ex = $('dlgExtra'); ex.innerHTML = '';
  dlg.sel = 0;
  if (p.choices) {
    p.choices.forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'choice'; b.textContent = c.label;
      b.onclick = e => { e.stopPropagation(); choose(i); };
      ex.appendChild(b);
    });
    markSel();
    $('dlgHint').textContent = inputMod.device === 'pad' ? 'Auswählen: Steuerkreuz · Bestätigen: ✕' : 'Auswählen: ↑/↓ · Bestätigen: E/Enter';
  } else $('dlgHint').textContent = hintNext();
}
function markSel() { [...$('dlgExtra').querySelectorAll('.choice')].forEach((b, i) => b.classList.toggle('sel', i === dlg.sel)); }
function nextPage() {
  const p = dlg.pages[dlg.i];
  if (p.choices) return choose(dlg.sel);
  dlg.i++;
  if (dlg.i >= dlg.pages.length) { const f = dlg.onDone; closeDlg(); if (f) f(); }
  else showPage();
}
function choose(i) { const c = dlg.pages[dlg.i].choices[i]; closeDlg(); if (c.fn) c.fn(); }
function closeDlg() { dlg = null; dlgEl.className = 'hidden'; }
dlgEl.addEventListener('click', () => { if (dlg && dlg.kind === 'pages' && !dlg.pages[dlg.i].choices) nextPage(); });

function openCode(o) {
  dlg = { kind: 'code', digits: ['0', '0', '0', '0'], pos: 0, ...o };
  dlgEl.className = '';
  $('dlgName').textContent = o.name; $('dlgText').textContent = o.text;
  const ex = $('dlgExtra');
  ex.innerHTML = `<div class="code">${[0, 1, 2, 3].map(i => `<div class="digit" data-i="${i}"><button class="up">▲</button><span></span><button class="dn">▼</button></div>`).join('')}</div>
    <div class="code-msg" id="codeMsg"></div>
    <div class="row"><button class="choice" id="codeOk">OK</button>${o.hint ? '<button class="choice" id="codeHint">Tipp</button>' : ''}<button class="choice" id="codeCancel">Abbrechen</button></div>`;
  ex.querySelectorAll('.digit').forEach(el => {
    const i = +el.dataset.i;
    el.querySelector('.up').onclick = e => { e.stopPropagation(); dlg.pos = i; digit(1); };
    el.querySelector('.dn').onclick = e => { e.stopPropagation(); dlg.pos = i; digit(-1); };
    el.querySelector('span').onclick = e => { e.stopPropagation(); dlg.pos = i; renderCode(); };
  });
  $('codeOk').onclick = e => { e.stopPropagation(); submitCode(); };
  $('codeCancel').onclick = e => { e.stopPropagation(); closeDlg(); };
  if (o.hint) $('codeHint').onclick = e => { e.stopPropagation(); $('codeMsg').textContent = o.hint; };
  $('dlgHint').textContent = inputMod.device === 'pad' ? 'Ziffer: Steuerkreuz ↑↓ · Stelle: ←→ · OK: ✕ · Tipp: △ · Abbrechen: Options'
    : 'Ziffern tippen oder ↑↓ · Stelle: ←→ · OK: Enter · Abbrechen: Esc';
  renderCode();
}
function renderCode() {
  dlgEl.querySelectorAll('.digit').forEach((el, i) => { el.querySelector('span').textContent = dlg.digits[i]; el.classList.toggle('sel', i === dlg.pos); });
}
function digit(d) { const v = (+dlg.digits[dlg.pos] + d + 10) % 10; dlg.digits[dlg.pos] = String(v); sfx.tick(); renderCode(); }
function submitCode() {
  const code = dlg.digits.join('');
  if (dlg.check(code)) { const f = dlg.onOk; closeDlg(); sfx.ok(); f(); }
  else { sfx.fail(); $('codeMsg').textContent = dlg.wrong || 'Falsch.'; const c = dlgEl.querySelector('.code'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
}

function openSync(onOk) {
  dlg = { kind: 'sync', hits: 0, t: 0, speed: 2.2, zone: rnd(0.25, 0.75), w: 0.17, flash: 0, onOk };
  dlgEl.className = '';
  $('dlgName').textContent = 'Atomuhr synchronisieren';
  $('dlgText').textContent = 'Drück genau dann, wenn der Zeiger im grünen Feld ist – dreimal hintereinander!';
  $('dlgExtra').innerHTML = '<canvas id="syncCv" width="600" height="110"></canvas><div class="row"><button class="choice" id="syncBtn">Jetzt!</button><button class="choice" id="syncCancel">Abbrechen</button></div>';
  $('syncBtn').onclick = e => { e.stopPropagation(); syncPress(); };
  $('syncCancel').onclick = e => { e.stopPropagation(); closeDlg(); };
  $('syncCv').onclick = e => { e.stopPropagation(); syncPress(); };
  $('dlgHint').textContent = inputMod.device === 'pad' ? 'Drücken: ✕ oder □' : 'Drücken: Leertaste / E / Tippen';
}
const syncPos = () => (Math.sin(dlg.t * dlg.speed) + 1) / 2;
function syncPress() {
  const p = syncPos();
  if (Math.abs(p - dlg.zone) < dlg.w / 2) {
    dlg.hits++; sfx.ok(); dlg.flash = 0.3; dlg.good = true;
    if (dlg.hits >= 3) { const f = dlg.onOk; closeDlg(); f(); return; }
    dlg.speed += 0.9; dlg.w -= 0.03; dlg.zone = rnd(0.15, 0.85);
  } else { dlg.hits = 0; dlg.speed = 2.2; dlg.w = 0.17; dlg.zone = rnd(0.25, 0.75); sfx.fail(); dlg.flash = 0.3; dlg.good = false; }
}
function drawSync(dt) {
  dlg.t += dt; dlg.flash = Math.max(0, dlg.flash - dt);
  const c = $('syncCv'); if (!c) return;
  const g = c.getContext('2d'), w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#1d2733'; g.fillRect(0, 20, w, 50);
  g.fillStyle = '#39d98a'; g.fillRect((dlg.zone - dlg.w / 2) * w, 20, dlg.w * w, 50);
  if (dlg.flash > 0) { g.fillStyle = dlg.good ? 'rgba(57,217,138,0.35)' : 'rgba(255,80,80,0.4)'; g.fillRect(0, 20, w, 50); }
  const x = syncPos() * w;
  g.fillStyle = '#fff'; g.fillRect(x - 3, 10, 6, 70);
  for (let i = 0; i < 3; i++) { g.fillStyle = i < dlg.hits ? '#39d98a' : '#55606e'; g.beginPath(); g.arc(w / 2 - 40 + i * 40, 95, 10, 0, 7); g.fill(); }
}

function handleDlgInput(inp, dt) {
  const h = inp.hits;
  if (dlg.kind === 'pages') {
    const p = dlg.pages[dlg.i];
    if (p.choices) {
      if (h.has('up')) { dlg.sel = (dlg.sel + p.choices.length - 1) % p.choices.length; markSel(); }
      if (h.has('down')) { dlg.sel = (dlg.sel + 1) % p.choices.length; markSel(); }
      if (h.has('act') || h.has('space')) choose(dlg.sel);
      else if ((h.has('menu') || h.has('back')) && p.closable !== false) closeDlg();
    } else if (h.has('act') || h.has('space') || h.has('back')) nextPage();
    else if (h.has('menu') && p.closable) closeDlg();
  } else if (dlg.kind === 'code') {
    for (const a of inp.seq) {
      if (!dlg || dlg.kind !== 'code') break;
      if (/^d\d$/.test(a)) { dlg.digits[dlg.pos] = a[1]; dlg.pos = Math.min(3, dlg.pos + 1); sfx.tick(); renderCode(); }
      else if (a === 'left') { dlg.pos = Math.max(0, dlg.pos - 1); renderCode(); }
      else if (a === 'right') { dlg.pos = Math.min(3, dlg.pos + 1); renderCode(); }
      else if (a === 'up') digit(1);
      else if (a === 'down') digit(-1);
      else if (a === 'back') { dlg.digits[dlg.pos] = '0'; dlg.pos = Math.max(0, dlg.pos - 1); renderCode(); }
      else if (a === 'mem' && dlg.hint) $('codeMsg').textContent = dlg.hint;
      else if (a === 'act') submitCode();
      else if (a === 'menu') closeDlg();
    }
  } else if (dlg.kind === 'sync') {
    if (h.has('act') || h.has('space')) syncPress();
    else if (h.has('menu')) closeDlg();
    if (dlg && dlg.kind === 'sync') drawSync(dt);
  }
}

function openMenu() {
  openPages([{
    name: 'Pause', text: `Schleife ${loop.n} · ${fmtClock(S.LOOP_START + loop.t)} Uhr`, closable: true,
    choices: [
      { label: 'Weiterspielen', fn: null },
      { label: 'Erinnerungen', fn: openMemories },
      { label: 'Steuerung', fn: showControls },
      { label: isMuted() ? 'Ton einschalten' : 'Ton ausschalten', fn: () => toast(toggleMute() ? '🔇 Ton aus' : '🔊 Ton an') },
      ...(loop.won ? [] : [{ label: 'Schleife neu starten', fn: confirmReset }]),
      { label: 'Zum Titelbild', fn: toTitle },
    ],
  }]);
}
function openMemories() {
  const ids = Object.keys(S.MEMORIES).filter(k => save.mem[k]);
  const html = ids.length ? '<ul class="mem">' + ids.map(k => `<li>${S.MEMORIES[k]}</li>`).join('') + '</ul>' : '<p>Noch keine Erinnerungen. Sei gespannt, was um 12 passiert …</p>';
  openPages([{ name: `Erinnerungen (Schleife ${loop.n})`, html: html + `<p class="obj">👉 ${S.objective(save.mem, loop).text}</p>`, closable: true }]);
}
function showControls() {
  openPages([{ name: 'Steuerung', closable: true, html: `
    <table class="ctl">
      <tr><th></th><th>Tastatur</th><th>Controller</th></tr>
      <tr><td>Laufen / Lenken</td><td>WASD / Pfeile</td><td>linker Stick</td></tr>
      <tr><td>Gas / Bremse</td><td>W / S</td><td>R2 / L2</td></tr>
      <tr><td>Ein-, aussteigen, reden</td><td>E</td><td>✕</td></tr>
      <tr><td>Handbremse / Sprinten</td><td>Leertaste</td><td>□</td></tr>
      <tr><td>Erinnerungen</td><td>Tab</td><td>△</td></tr>
      <tr><td>Menü</td><td>Esc</td><td>Options</td></tr>
      <tr><td>Schleife neu starten</td><td>R</td><td>Share</td></tr>
      <tr><td>Ton an/aus</td><td>M</td><td>–</td></tr>
    </table>
    <p class="small">Am Handy: links Joystick (hoch = Gas, runter = Bremse), rechts die Knöpfe.</p>` }]);
}
function confirmReset() {
  if (loop.won) return;
  openPages([{ name: 'Schleife neu starten?', text: 'Du schnippst mit den Fingern und landest wieder um 11:55 am Hauptbahnhof. Erinnerungen bleiben.', closable: true,
    choices: [{ label: 'Ja, neu starten', fn: startFlash }, { label: 'Nein', fn: null }] }]);
}

// ---------- Blitz / neue Schleife ----------
function startFlash() {
  if (flash) return;
  flash = { t: 0, reset: false };
  sfx.flash(); closeDlg();
}
function updateFlash(dt) {
  flash.t += dt;
  if (!flash.reset && flash.t >= 0.8) {
    flash.reset = true;
    save.loops++; persist();
    const first = !save.mem.blitz;
    resetLoop();
    flash.after = first ? 'first' : 'toast';
  }
  if (flash.t >= 1.8) {
    const after = flash.after; flash = null;
    if (after === 'first') openPages(S.FIRST_LOOP.map((p, i, a) => (i === a.length - 1 ? { ...p, memory: 'blitz' } : p)));
    else toast(`⟲ Schleife ${loop.n} – zurück auf 11:55`);
  }
}

// ---------- Sieg ----------
function winGame() {
  const firstWin = !save.won;
  save.won = true; persist();
  mode = 'win';
  $('touch').className = 'hidden';
  engineSound(false, 0);
  $('winStats').innerHTML = `
    <div><b>${loop.n}</b><span>Schleifen</span></div>
    <div><b>${save.deliveries}</b><span>Pakete geliefert</span></div>
    <div><b>${fmtDur(save.play)}</b><span>Spielzeit</span></div>`;
  $('winText').textContent = firstWin ? 'Braunschweig hat wieder ein Morgen. Und der Löwe bleibt, wo er ist.' : 'Nochmal geschafft – die Schleife ist gebrochen!';
  $('win').className = '';
}
$('winContinue').onclick = () => { $('win').className = 'hidden'; if (coarse) $('touch').className = ''; freeRoam = true; loop.won = true; mode = 'play'; toast('Freie Fahrt durch Braunschweig! Kurier-Aufträge gibt’s weiterhin.'); };
$('winNew').onclick = () => { $('win').className = 'hidden'; toTitle(); };

// ---------- Titel ----------
function toTitle() {
  closeDlg(); mode = 'title'; engineSound(false, 0); freeRoam = false;
  resetLoop();
  $('title').className = '';
  $('touch').className = 'hidden';
  $('btnContinue').style.display = save.started ? '' : 'none';
  $('btnNew').textContent = save.started ? 'Neues Spiel' : 'Spiel starten';
  $('titleInfo').textContent = save.started ? `Bisher: ${save.loops} Schleifen · ${Object.keys(save.mem).length} von ${Object.keys(S.MEMORIES).length} Erinnerungen${save.won ? ' · geschafft! 🦁' : ''}` : '';
}
function startGame(isNew) {
  unlock();
  if (isNew && save.started && !confirm('Wirklich neu anfangen? Alle Erinnerungen gehen verloren.')) return;
  if (isNew || !save.started) { save = fresh(); save.started = true; persist(); }
  $('title').className = 'hidden';
  if (coarse) $('touch').className = '';
  freeRoam = false;
  resetLoop();
  mode = 'play';
  if (isNew || save.loops === 0) openPages(S.INTRO);
  else toast(`Schleife ${loop.n} – Erinnerungen mit Tab / △`);
}
$('btnNew').onclick = () => startGame(true);
$('btnContinue').onclick = () => startGame(false);

// ---------- Zeichnen ----------
let titleAng = 0;
function render(dt) {
  const me = pv();
  // Kamera
  const base = clamp(Math.min(vw, vh) / 640, 0.55, 1.5);
  let tz = base, tx = me.x, ty = me.y;
  if (mode === 'title') {
    titleAng += dt * 0.05;
    tx = 80 * T + Math.cos(titleAng) * 900; ty = 52 * T + Math.sin(titleAng) * 600; tz = base * 0.9;
  } else if (player.in) {
    tz = base * (0.92 - clamp(Math.abs(player.in.fs) / 360, 0, 1) * 0.22);
    tx += player.in.vx * 0.45; ty += player.in.vy * 0.45;
  }
  const k = 1 - Math.exp(-dt * 4);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.zoom += (tz - cam.zoom) * k;
  shake = Math.max(0, shake - dt * 25);
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  const z = cam.zoom;
  const vx0 = cam.x - vw / 2 / z, vy0 = cam.y - vh / 2 / z, vx1 = cam.x + vw / 2 / z, vy1 = cam.y + vh / 2 / z;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#6f5a4c'; ctx.fillRect(0, 0, vw, vh);
  ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - cam.x * z + sx), dpr * (vh / 2 - cam.y * z + sy));
  ctx.imageSmoothingEnabled = true;
  drawMap(ctx, vx0, vy0, vx1, vy1);
  const vis = (e, m = 80) => e.x > vx0 - m && e.x < vx1 + m && e.y > vy0 - m && e.y < vy1 + m;

  // Bremsspuren
  ctx.fillStyle = 'rgba(20,20,20,0.28)';
  for (const s of skids) {
    if (!vis(s)) continue;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.globalAlpha = Math.min(1, s.t / 3) * 0.8;
    ctx.fillRect(-2, -9, 4, 3); ctx.fillRect(-2, 6, 4, 3); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // Schienen
  ctx.strokeStyle = 'rgba(200,200,200,0.35)'; ctx.lineWidth = 2;
  for (const off of [-6, 6]) {
    ctx.beginPath();
    const P = TRAM_PATH.map(([x, y]) => [x * T + T / 2, y * T + T / 2]);
    P.forEach(([x, y], i) => {
      const n = P[Math.min(i + 1, P.length - 1)], pr = P[Math.max(i - 1, 0)];
      const a = Math.atan2(n[1] - pr[1], n[0] - pr[0]);
      const ox = -Math.sin(a) * off, oy = Math.cos(a) * off;
      if (i) ctx.lineTo(x + ox, y + oy); else ctx.moveTo(x + ox, y + oy);
    });
    ctx.stroke();
  }

  // Ziel- und Paketmarker auf dem Boden
  const t = performance.now() / 1000;
  const obj = mode === 'play' ? objectiveTarget() : null;
  if (obj && vis(obj)) ring(obj.x, obj.y, '#ff4d4d', t);
  if (mode === 'play' && loop.job) {
    const j = loop.job, p = spotPx(j.stage === 'pickup' ? j.from : j.to);
    if (vis(p)) ring(p.x, p.y, '#ffcf33', t, j.stage === 'pickup' ? '📦' : '🏁');
  }

  // Denkmäler
  for (const l of LANDMARKS) {
    if (!l.statue) continue;
    const [x0, y0, x1, y1] = l.rect, cx = (x0 + x1) / 2 * T, cy = (y0 + y1) / 2 * T;
    if (!vis({ x: cx, y: cy })) continue;
    if (l.id === 'brunnen') {
      ctx.fillStyle = '#9bb'; ctx.beginPath(); ctx.arc(cx, cy, 28, 0, 7); ctx.fill();
      ctx.fillStyle = '#5fb2e0'; ctx.beginPath(); ctx.arc(cx, cy, 23, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, 6 + ((t * 12 + i * 6) % 17), 0, 7); ctx.stroke(); }
      ctx.fillStyle = '#7a8a8a'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(cx - 22, cy - 18, 48, 44);
      ctx.fillStyle = '#b8ab92'; ctx.fillRect(cx - 24, cy - 22, 48, 44);
      ctx.fillStyle = '#d6cbb4'; ctx.fillRect(cx - 20, cy - 18, 40, 36);
      ctx.font = `${l.id === 'loewe' ? 34 : 26}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(l.id === 'loewe' ? '🦁' : '🎓', cx, cy + 2);
    }
  }

  // Figuren
  for (const p of peds) if (vis(p)) drawPerson(p, p.shirt, p.skin, p.hair, p.down > 0);
  drawTill(till);
  for (const c of vehicles) if (vis(c)) drawVehicle(c);
  for (const tr of trams) if (vis(tr, 140)) drawTram(tr);
  if (thief && vis(thief)) drawThief(thief);
  if (!player.in && mode !== 'title') drawPlayer(player);

  // Beschriftungen (feste Bildschirmgröße)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.font = `700 ${Math.round(13 / z)}px system-ui, sans-serif`;
  for (const l of LANDMARKS) {
    const [x0, y0, x1, y1] = l.rect, cx = (x0 + x1) / 2 * T, cy = (l.statue ? y0 - 0.6 : (y0 + y1) / 2) * T;
    if (!vis({ x: cx, y: cy }, 200)) continue;
    ctx.lineWidth = 4 / z; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.fillStyle = '#fff';
    ctx.strokeText(l.name, cx, cy); ctx.fillText(l.name, cx, cy);
  }
  // Sprechblasen
  ctx.font = `600 ${Math.round(13 / z)}px system-ui, sans-serif`;
  bubbles = bubbles.filter(b => (b.t -= dt) > 0 && (b.ent === till || b.ent === thief || peds.includes(b.ent) || vehicles.includes(b.ent)));
  for (const b of bubbles) {
    if (!vis(b.ent)) continue;
    const w = ctx.measureText(b.text).width + 14 / z, h = 22 / z, x = b.ent.x, y = b.ent.y - 30 / z - 10;
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5 / z;
    roundRect(x - w / 2, y - h / 2, w, h, 8 / z); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillText(b.text, x, y + 1 / z);
  }

  // Bildschirm-Ebene
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (obj) edgeArrow(obj, '#ff4d4d', vx0, vy0, z);
  if (mode === 'play' && loop.job) { const j = loop.job; edgeArrow(spotPx(j.stage === 'pickup' ? j.from : j.to), '#ffcf33', vx0, vy0, z, true); }
  // Letzte 30 Sekunden: roter Rand
  if (mode === 'play' && !loop.won && loop.t > S.LOOP_LEN - 30) {
    const a = 0.25 + 0.2 * Math.sin(t * 6);
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,40,40,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }
  if (flash) {
    const a = flash.t < 0.8 ? flash.t / 0.8 : Math.max(0, 1 - (flash.t - 0.8) / 1.0);
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, vw, vh);
    if (flash.t > 0.3) {
      ctx.fillStyle = `rgba(30,40,60,${Math.min(1, a * 1.2)})`; ctx.textAlign = 'center';
      ctx.font = '800 42px system-ui, sans-serif'; ctx.fillText(flash.reset ? '11:55' : '12:00', vw / 2, vh / 2);
    }
  }
  drawMini();
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function ring(x, y, col, t, icon) {
  const r = 26 + Math.sin(t * 4) * 4;
  ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.globalAlpha = 0.25; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  if (icon) { ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon, x, y - 40 - Math.sin(t * 4) * 4); }
}
function edgeArrow(p, col, vx0, vy0, z, small) {
  const sx = (p.x - vx0) * z, sy = (p.y - vy0) * z, m = small ? 34 : 46;
  const on = sx > m && sx < vw - m && sy > m && sy < vh - m;
  const meters = Math.round(dist(p, pv()) / 3.2);
  if (on) return;
  const cx = vw / 2, cy = vh / 2, a = Math.atan2(sy - cy, sx - cx);
  const k = Math.min((vw / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (vh / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
  const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
  const s = small ? 0.75 : 1;
  ctx.beginPath(); ctx.moveTo(18 * s, 0); ctx.lineTo(-10 * s, -13 * s); ctx.lineTo(-4 * s, 0); ctx.lineTo(-10 * s, 13 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.font = `700 ${small ? 11 : 13}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = '#fff';
  const tx = x - Math.cos(a) * 30, ty = y - Math.sin(a) * 30;
  ctx.strokeText(meters + ' m', tx, ty); ctx.fillText(meters + ' m', tx, ty);
}
function drawVehicle(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a);
  const L = c.len, Wd = c.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(-L / 2 + 3, -Wd / 2 + 3, L, Wd, 5); ctx.fill();
  if (c.kind === 'boat') {
    ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.ellipse(0, 0, L / 2, Wd / 2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2b6aa0'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff8c42'; ctx.fillRect(-6, -6, 10, 12);
    // Schwanenkopf
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L / 2 - 6, 0); ctx.quadraticCurveTo(L / 2 + 6, -2, L / 2 + 2, -10); ctx.stroke();
    ctx.fillStyle = '#ff8c42'; ctx.beginPath(); ctx.arc(L / 2 + 3, -11, 2.5, 0, 7); ctx.fill();
    ctx.restore(); return;
  }
  ctx.fillStyle = c.color; roundRect(-L / 2, -Wd / 2, L, Wd, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  if (c.kind === 'van') {
    ctx.fillStyle = '#6d747b'; ctx.fillRect(-L / 2 + 2, -Wd / 2 + 2, L * 0.62, Wd - 4);
    ctx.fillStyle = '#e0aa22'; ctx.font = '700 7px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('LÖWEN-LOGISTIK', -L * 0.08, 0);
    ctx.fillStyle = '#9fd3ff'; ctx.fillRect(L / 2 - 10, -Wd / 2 + 3, 5, Wd - 6);
  } else {
    ctx.fillStyle = 'rgba(160,210,255,0.85)'; ctx.fillRect(L / 2 - 14, -Wd / 2 + 3, 7, Wd - 6); ctx.fillRect(-L / 2 + 4, -Wd / 2 + 3, 4, Wd - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-L / 2 + 10, -Wd / 2 + 3, L - 26, Wd - 6);
    if (c.kind === 'amt') {
      ctx.fillStyle = '#2f6fb3'; ctx.fillRect(-L / 2, -1.5, L, 3);
      const on = Math.floor(performance.now() / 180) % 2;
      ctx.fillStyle = c.leave ? '#777' : on ? '#3fa9ff' : '#ffd23f'; ctx.fillRect(-3, -Wd / 2 + 2, 5, 5);
      ctx.fillStyle = c.leave ? '#777' : on ? '#ffd23f' : '#3fa9ff'; ctx.fillRect(-3, Wd / 2 - 7, 5, 5);
    }
  }
  // Scheinwerfer
  ctx.fillStyle = '#fff8c0'; ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 2, 3); ctx.fillRect(L / 2 - 2, Wd / 2 - 5, 2, 3);
  ctx.restore();
}
function drawTram(tr) {
  ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.a);
  const L = 104, Wd = 26;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(-L / 2 + 4, -Wd / 2 + 4, L, Wd, 8); ctx.fill();
  ctx.fillStyle = '#e8e8e8'; roundRect(-L / 2, -Wd / 2, L, Wd, 8); ctx.fill();
  ctx.fillStyle = '#c8102e'; ctx.fillRect(-L / 2 + 4, -Wd / 2, L - 8, 6); ctx.fillRect(-L / 2 + 4, Wd / 2 - 6, L - 8, 6);
  ctx.fillStyle = '#9aa'; for (const o of [-26, 0, 26]) ctx.fillRect(o - 1, -Wd / 2, 2, Wd);
  ctx.fillStyle = '#333'; ctx.fillRect(-6, -3, 12, 6);
  ctx.restore();
}
function drawPerson(p, shirt, skin, hair, down, trim) {
  ctx.save(); ctx.translate(p.x, p.y);
  if (down) {
    ctx.rotate(0.6); ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, 7); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(12, 0, 4.5, 0, 7); ctx.fill();
    ctx.restore(); ctx.font = '12px system-ui'; ctx.fillText('💫', p.x, p.y - 14); return;
  }
  const a = Math.atan2(p.vy, p.vx) || p.face || 0, sw = Math.sin(p.walk || 0) * 3;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, 3, 8, 6, 0, 0, 7); ctx.fill();
  ctx.rotate(a);
  ctx.fillStyle = '#333'; ctx.fillRect(sw - 2, -5, 5, 3); ctx.fillRect(-sw - 2, 2, 5, 3);
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 8, 0, 0, 7); ctx.fill();
  if (trim || p.trim) { ctx.strokeStyle = trim || p.trim; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.fillStyle = hair || '#3b2a20'; ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, 7); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(1.5, 0, 3, 0, 7); ctx.fill();
  ctx.restore();
}
function drawPlayer(p) {
  ctx.save(); ctx.translate(p.x, p.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();
  ctx.restore();
  drawPerson({ ...p, vx: p.vx, vy: p.vy, walk: p.walk }, '#27ae60', '#f2c9a0', '#5a3b22', false, '#fff');
}
function drawTill(t) {
  drawPerson({ x: t.x, y: t.y, vx: 0, vy: 1, face: Math.PI / 2 }, '#2ecc71', '#f5d0b5', '#c0392b', false, '#f1c40f');
  // Narrenkappe
  ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.moveTo(t.x - 7, t.y - 3); ctx.lineTo(t.x - 12, t.y - 12); ctx.lineTo(t.x - 2, t.y - 5); ctx.fill();
  ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.moveTo(t.x + 7, t.y - 3); ctx.lineTo(t.x + 12, t.y - 12); ctx.lineTo(t.x + 2, t.y - 5); ctx.fill();
  ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(t.x - 12, t.y - 12, 2, 0, 7); ctx.arc(t.x + 12, t.y - 12, 2, 0, 7); ctx.fill();
}
function drawThief(k) {
  drawPerson(k, '#222', '#e8b48f', '#111', false, '#eee');
  ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(k.x - 8, k.y + 6, 4, 0, 7); ctx.fill(); // Beutel
  ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(k.x + 7, k.y - 7, 2.5 + Math.sin(performance.now() / 120), 0, 7); ctx.fill(); // blinkender Auslöser
}

// Übersichtskarte
const miniBase = miniMapImage();
const mini = $('mini'), mg = mini.getContext('2d');
function drawMini() {
  const w = mini.width, h = mini.height, sx = w / (W * T), sy = h / (H * T);
  mg.imageSmoothingEnabled = false;
  mg.drawImage(miniBase, 0, 0, w, h);
  const dot = (p, col, r = 3) => { mg.fillStyle = col; mg.beginPath(); mg.arc(p.x * sx, p.y * sy, r, 0, 7); mg.fill(); };
  const t = performance.now() / 1000;
  if (mode === 'play') {
    const obj = objectiveTarget();
    if (obj) { mg.strokeStyle = '#ff4d4d'; mg.lineWidth = 2; mg.beginPath(); mg.arc(obj.x * sx, obj.y * sy, 5 + Math.sin(t * 5) * 2, 0, 7); mg.stroke(); dot(obj, '#ff4d4d', 3); }
    if (loop.job) dot(spotPx(loop.job.stage === 'pickup' ? loop.job.from : loop.job.to), '#ffcf33', 3.5);
    for (const a of amts) dot(a, Math.floor(t * 4) % 2 ? '#3fa9ff' : '#ffd23f', 2.5);
    if (loop.van) dot(loop.van, '#ddd', 3);
  }
  for (const tr of trams) dot(tr, '#c8102e', 2);
  const me = pv();
  dot(me, '#fff', 4); dot(me, '#27ae60', 2.5);
}
function objectiveTarget() {
  const o = S.objective(save.mem, loop);
  if (!o.target) return null;
  if (o.target === 'van') return loop.van || spotPx('loewe');
  if (o.target === 'thief') return thief || spotPx('loewe');
  if (o.target === 'eule') return till;
  return spotPx(o.target);
}

// ---------- HUD ----------
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setHtml(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).innerHTML = v; } }
function updateHud(dt) {
  const play = mode === 'play';
  $('hud').style.display = play ? '' : 'none';
  if (!play) return;
  const clock = S.LOOP_START + loop.t;
  setText('clock', fmtClock(clock));
  $('clock').classList.toggle('late', !loop.won && loop.t > S.LOOP_LEN - 30);
  setText('loopNo', loop.won ? 'Schleife gebrochen 🦁' : `Schleife ${loop.n}`);
  const st = stars();
  setHtml('stars', st ? `Ordnungsamt <span>${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>` : '');
  setText('objective', S.objective(save.mem, loop).text);
  const j = loop.job;
  setText('courier', j ? (j.stage === 'pickup' ? `📦 Abholen: ${j.item} – ${SPOTS[j.from].name}` : `📦 Bring ${j.item} → ${SPOTS[j.to].name} (${Math.ceil(j.left)} s)`) : '');
  const a = dlg || flash ? null : nearestAction();
  setText('prompt', a ? `${keyName()}  ${a.label}` : '');
  $('prompt').style.display = a ? '' : 'none';
  // Meldungen
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
  else if (toastQ.length) { const m = toastQ.shift(); $('toast').textContent = m.text; $('toast').classList.add('show'); toastT = m.sec; }
  // Motor
  engineSound(!!player.in && !dlg && !flash, player.in ? player.in.fs : 0);
}

// ---------- Hauptschleife ----------
let last = performance.now(), acc = 0, saveT = 0;
const IDLE = { x: 0, y: 0, gas: 0, brake: 0, hand: false, hits: new Set() };
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const inp = poll();
  if (mode === 'title') {
    if (inp.hits.has('act') || inp.hits.has('space')) startGame(!save.started);
    acc += dt; let n = 0; while (acc >= STEP && n < 4) { step(STEP, IDLE, true); acc -= STEP; n++; }
    if (n === 4) acc = 0;
  } else if (mode === 'win') {
    if (inp.hits.has('act')) $('winContinue').click();
  } else {
    if (dlg) handleDlgInput(inp, dt);
    else if (!flash) handleWorldHits(inp);
    if (!dlg && !flash) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 5) { step(STEP, inp); acc -= STEP; n++; if (dlg || flash) break; }
      if (n === 5) acc = 0;
      save.play += dt;
    } else acc = 0;
    if (flash) updateFlash(dt);
    saveT += dt; if (saveT > 10) { saveT = 0; persist(); }
  }
  if (mode !== 'win') render(dt);
  updateHud(dt);
  requestAnimationFrame(frame);
}

// ---------- Touch-Bedienung ----------
if (coarse) {
  setupTouch($('stick'), $('knob'));
  const tap = (id, a) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); unlock(); touch.active = true; pushHit(a); });
  tap('tAct', 'act'); tap('tMenu', 'menu'); tap('tMem', 'mem');
  const b = $('tBrake');
  b.addEventListener('pointerdown', e => { e.preventDefault(); touch.active = true; touch.brake = true; pushHit('space'); });
  b.addEventListener('pointerup', () => (touch.brake = false));
  b.addEventListener('pointercancel', () => (touch.brake = false));
}
addEventListener('pointerdown', unlock, { once: true });
addEventListener('keydown', unlock, { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { persist(); engineSound(false, 0); } });

$('version').textContent = APP_VERSION;
mini.addEventListener('click', () => { if (mode === 'play' && !dlg) openMemories(); });
toTitle();
requestAnimationFrame(frame);

// Für Tests: window.__spiel
window.__spiel = { get thief() { return thief; }, get loop() { return loop; }, get save() { return save; }, get player() { return player; }, get vehicles() { return vehicles; }, startFlash, get dlg() { return dlg; } };
