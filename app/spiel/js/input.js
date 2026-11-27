// Eingabe: Tastatur, Gamepad (z. B. PS4-Controller am PC) und Touch.
// poll() liefert pro Bild einen Zustand { x, y, gas, brake, hand, hits:Set } – hits sind frisch gedrückte Aktionen.

const down = new Set(), hits = new Set();
let seq = []; // gedrückte Aktionen in Reihenfolge (für Codeeingabe)
const KEYMAP = {
  KeyE: 'act', Enter: 'act', NumpadEnter: 'act', Space: 'space',
  Escape: 'menu', KeyP: 'menu', Tab: 'mem', KeyI: 'mem', KeyR: 'reset',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', Backspace: 'back', KeyM: 'mute',
};
for (let i = 0; i <= 9; i++) { KEYMAP['Digit' + i] = 'd' + i; KEYMAP['Numpad' + i] = 'd' + i; }

export let device = 'key';
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace'].includes(e.code)) e.preventDefault();
  if (!e.repeat && KEYMAP[e.code]) { hits.add(KEYMAP[e.code]); seq.push(KEYMAP[e.code]); }
  down.add(e.code); device = 'key';
});
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', () => down.clear());

// Gamepad (Standard-Belegung: 0 Kreuz, 1 Kreis, 2 Quadrat, 3 Dreieck, 6 L2, 7 R2, 8 Share, 9 Options, 12–15 Steuerkreuz)
const PADMAP = { 0: 'act', 1: 'back', 2: 'space', 3: 'mem', 8: 'reset', 9: 'menu', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
let padPrev = [];
export let padName = '';

// Touch-Steuerung
export const touch = { active: false, jx: 0, jy: 0, brake: false };
export function pushHit(a) { hits.add(a); seq.push(a); }

export function poll() {
  const k = c => down.has(c);
  const s = { x: 0, y: 0, gas: 0, brake: 0, hand: false, hits: new Set(hits), seq };
  hits.clear(); seq = [];
  const kx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
  const ky = (k('KeyS') || k('ArrowDown') ? 1 : 0) - (k('KeyW') || k('ArrowUp') ? 1 : 0);
  s.x = kx; s.y = ky; s.gas = ky < 0 ? 1 : 0; s.brake = ky > 0 ? 1 : 0; s.hand = k('Space');

  const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
  const pad = pads.find(p => p && p.connected);
  if (pad) {
    padName = pad.id;
    const dz = v => (Math.abs(v) < 0.18 ? 0 : v);
    const ax = dz(pad.axes[0] || 0), ay = dz(pad.axes[1] || 0);
    const b = i => pad.buttons[i] || { pressed: false, value: 0 };
    const r2 = b(7).value || (b(7).pressed ? 1 : 0), l2 = b(6).value || (b(6).pressed ? 1 : 0);
    if (ax || ay || r2 > 0.05 || l2 > 0.05 || pad.buttons.some(x => x.pressed)) device = 'pad';
    if (Math.abs(ax) > Math.abs(s.x)) s.x = ax;
    if (Math.abs(ay) > Math.abs(s.y)) s.y = ay;
    s.gas = Math.max(s.gas, r2);
    s.brake = Math.max(s.brake, l2);
    s.hand = s.hand || b(2).pressed;
    pad.buttons.forEach((btn, i) => {
      if (btn.pressed && !padPrev[i] && PADMAP[i]) { s.hits.add(PADMAP[i]); s.seq.push(PADMAP[i]); }
      padPrev[i] = btn.pressed;
    });
  }
  if (touch.active) {
    if (Math.abs(touch.jx) > Math.abs(s.x)) s.x = touch.jx;
    if (Math.abs(touch.jy) > Math.abs(s.y)) s.y = touch.jy;
    // Joystick nach oben = Gas, nach unten = Bremse/Rückwärts
    if (touch.jy < -0.25) s.gas = Math.max(s.gas, Math.min(1, -touch.jy * 1.3));
    if (touch.jy > 0.35) s.brake = Math.max(s.brake, touch.jy);
    if (!touch.jx && !touch.jy) { /* nichts */ }
    s.hand = s.hand || touch.brake;
  }
  return s;
}

// Virtueller Joystick
export function setupTouch(stick, knob) {
  let id = null, cx = 0, cy = 0;
  const R = 50;
  stick.addEventListener('pointerdown', e => {
    id = e.pointerId; stick.setPointerCapture(id);
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(e); touch.active = true; device = 'touch';
  });
  const move = e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    touch.jx = dx / R; touch.jy = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  stick.addEventListener('pointermove', move);
  const end = e => { if (e.pointerId !== id) return; id = null; touch.jx = touch.jy = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}
