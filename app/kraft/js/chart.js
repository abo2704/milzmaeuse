// Schlichtes Liniendiagramm als SVG – ohne externe Bibliothek.
import { esc } from './util.js';

export function lineChart(points, fmtY, fmtX) {
  if (!points.length) return '<p class="muted small">Noch keine Daten für diese Kennzahl.</p>';
  const W = 340, H = 180, pl = 10, pr = 10, pt = 26, pb = 24;
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= Math.abs(y0) * 0.1 || 1; y1 += Math.abs(y1) * 0.1 || 1; }
  const pad = (y1 - y0) * 0.12; y0 = Math.max(0, y0 - pad); y1 += pad;
  const X = x => x1 === x0 ? W / 2 : pl + (x - x0) / (x1 - x0) * (W - pl - pr);
  const Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const pts = points.map(p => [X(p.x), Y(p.y)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${pts.at(-1)[0].toFixed(1)} ${H - pb} L${pts[0][0].toFixed(1)} ${H - pb} Z`;
  const data = points.map((p, i) => ({ x: +pts[i][0].toFixed(1), y: +pts[i][1].toFixed(1), t: `${fmtX(p.x)} · ${fmtY(p.y)}` }));
  const maxI = ys.indexOf(Math.max(...ys));
  return `<div class="chart" data-points="${esc(JSON.stringify(data))}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf">
      <defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" class="axis"/>
      <line x1="${pl}" x2="${W - pr}" y1="${Y(Math.max(...ys)).toFixed(1)}" y2="${Y(Math.max(...ys)).toFixed(1)}" class="grid"/>
      ${points.length > 1 ? `<path d="${area}" fill="url(#cg)"/><path d="${line}" class="line"/>` : ''}
      ${pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" class="dot${i === maxI ? ' best' : ''}"/>`).join('')}
      <text x="${pl}" y="${H - 6}" class="lbl">${esc(fmtX(x0))}</text>
      ${x1 !== x0 ? `<text x="${W - pr}" y="${H - 6}" class="lbl" text-anchor="end">${esc(fmtX(x1))}</text>` : ''}
      <circle class="hl" r="7" cx="-20" cy="-20"/>
    </svg>
    <div class="chart-tip">Tippe auf einen Punkt · Bestwert ${esc(fmtY(Math.max(...ys)))}</div>
  </div>`;
}

export function mountChart(root) {
  root.querySelectorAll('.chart').forEach(ch => {
    const data = JSON.parse(ch.dataset.points);
    const svg = ch.querySelector('svg'), hl = ch.querySelector('.hl'), tip = ch.querySelector('.chart-tip');
    const show = ev => {
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * 340;
      let best = data[0];
      for (const d of data) if (Math.abs(d.x - x) < Math.abs(best.x - x)) best = d;
      hl.setAttribute('cx', best.x); hl.setAttribute('cy', best.y);
      tip.textContent = best.t;
    };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', e => { if (e.buttons) show(e); });
  });
}
