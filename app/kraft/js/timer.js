// Intervall-Timer: berechnet aus Plan + Stationen einen Zeitplan aus Abschnitten.
// Alles läuft über Zeitstempel – der Timer bleibt auch nach Neuladen oder gesperrtem Bildschirm korrekt.
// plan = { rounds: [Sekunden Belastung je Runde], change: Wechsel s, rest: Rundenpause s, prep: Vorlauf s }

export const DEFAULT_PLAN = { rounds: [60, 60, 60], change: 15, rest: 60, prep: 10 };

export function buildSchedule(plan, ids) {
  const segs = [];
  let t = 0;
  const push = (type, dur, extra) => { if (dur > 0) { segs.push({ type, dur, start: t, end: t + dur, ...extra }); t += dur; } };
  push('prep', plan.prep ?? 10, { next: 0, r: 0 });
  plan.rounds.forEach((work, r) => {
    ids.forEach((id, i) => {
      push('work', work, { i, r, id });
      const lastStation = i === ids.length - 1;
      if (!lastStation) push('change', plan.change, { next: i + 1, r });
      else if (r < plan.rounds.length - 1) push('rest', plan.rest, { next: 0, r: r + 1 });
    });
  });
  return { segs, total: t };
}

export function elapsed(T, now = Date.now()) {
  if (!T?.startedAt) return 0;
  const paused = T.pausedTotal + (T.pausedAt ? now - T.pausedAt : 0);
  return Math.max(0, (now - T.startedAt - paused) / 1000);
}

export function current(T, sched, now = Date.now()) {
  const el = elapsed(T, now);
  if (el >= sched.total) return { done: true, el, idx: sched.segs.length };
  const idx = sched.segs.findIndex(s => el < s.end);
  const seg = sched.segs[idx];
  return { done: false, el, idx, seg, left: seg.end - el, inSeg: el - seg.start };
}

export const planSummary = p => `${p.rounds.length} ${p.rounds.length === 1 ? 'Runde' : 'Runden'} · ${p.rounds.map(fmt).join(' / ')} je Station · Wechsel ${fmt(p.change)} · Pause ${fmt(p.rest)}`;
function fmt(s) { const m = Math.floor(s / 60), x = s % 60; return `${m}:${String(x).padStart(2, '0')}`; }
