// Coach: Regeln aus der Trainingsforschung und von Coaches – Quellen siehe docs/kraftkladde-coach-quellen.md.
// Reine Rechenfunktionen, die Oberfläche steckt in app.js.
import { musclesOf } from './exercises.js';

const DAY = 86400000;

// ---------- Quellen ----------
export const SOURCES = {
  progression: { label: 'Doppelte Progression', by: 'Plotkin et al. 2022 · ACSM 2009', url: 'https://pubmed.ncbi.nlm.nih.gov/36199287/' },
  rir: { label: '1–3 Wdh. in Reserve', by: 'Refalo et al. 2023', url: 'https://pubmed.ncbi.nlm.nih.gov/36334240/' },
  volume: { label: 'Wochenvolumen je Muskel', by: 'Schoenfeld et al. 2017', url: 'https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324_Dose-response_relationship_between_weekly_resistance_training_volume_and_increases_in_muscle_mass_A_systematic_review_and_meta-analysis/links/59dc0269458515e9ab4527d6/Dose-response-relationship-between-weekly-resistance-training-volume-and-increases-in-muscle-mass-A-systematic-review-and-meta-analysis.pdf' },
  rest: { label: 'Längere Pausen bei Grundübungen', by: 'Schoenfeld et al. 2016', url: 'https://pubmed.ncbi.nlm.nih.gov/26605807/' },
  runners: { label: 'Krafttraining für Läufer', by: 'Blagrove et al. 2018', url: 'https://nrl.northumbria.ac.uk/id/eprint/33750' },
  heavy: { label: 'Schwere Lasten für die Laufökonomie', by: 'Meta-Analyse, Sports Medicine 2024', url: 'https://doi.org/10.1007/s40279-023-01978-y' },
  concurrent: { label: 'Kraft und Ausdauer kombinieren', by: 'Meta-Analyse 2021 · HSS', url: 'https://doi.org/10.1007/s40279-021-01587-7' },
  kneewall: { label: 'Knie-zur-Wand-Test', by: 'Dr. Aaron Horschig, Squat University', url: 'https://squatuniversity.com/2015/11/05/the-squat-fix-ankle-mobility-pt-1/' },
  balance: { label: 'Gleichgewichtstraining nach Umknicken', by: 'Reviews 2008, 2015, 2023', url: 'https://pubmed.ncbi.nlm.nih.gov/24831756/' },
  pain: { label: 'Schmerz-Ampel (max. 5/10)', by: 'Thomeé; Silbernagel 2007', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7249277' },
  joint: { label: 'Gelenk-für-Gelenk-Prinzip', by: 'Dr. Aaron Horschig, Squat University', url: 'https://squatuniversity.com/2015/10/22/the-joint-by-joint-concept/' },
  cause: { label: 'Ursache statt Symptom', by: 'KRAFTWOHL – Dr. Christopher Krupke', url: 'https://kraftwohl.de/' },
  core: { label: 'Rumpf: Bewegung verhindern statt erzeugen', by: 'Stuart McGill (Big 3)', url: 'https://www.health.harvard.edu/staying-healthy/three-moves-for-better-spine-health' },
};

// ---------- Schwere Phase ----------
export const MAIN_HEAVY_NOTE = 'Gilt für Langhantel-Grundübungen (z. B. Trap Bar, Kniebeuge, Military Press, Bankdrücken).';
export function heavyPhase(settings, now = Date.now()) {
  const h = settings.coach?.heavy;
  if (!h) return null;
  const end = h.start + h.weeks * 7 * DAY;
  if (now >= end) return null;
  return { ...h, end, week: Math.floor((now - h.start) / (7 * DAY)) + 1 };
}
export const isMainLift = ex => ex.equip === 'lh';

// Wiederholungsbereich je Übung (null = keine Steigerungs-Vorschläge)
export function rangeFor(ex, settings) {
  if (!ex || !(ex.fields || []).includes('r')) return null;
  if (['Core', 'Fuß & Reha', 'Mobilität', 'Ausdauer', 'Ganzkörper & Hybrid'].includes(ex.group)) return null;
  if (ex.range) return { lo: ex.range[0], hi: ex.range[1] }; // eigener Bereich, z. B. Curls im Finisher bis zur Erschöpfung
  if (heavyPhase(settings) && isMainLift(ex)) return { lo: 4, hi: 6, heavy: true };
  if (ex.equip === 'kb') return { lo: 8, hi: 15 };
  if (ex.group === 'Arme & Schultern') return { lo: 10, hi: 15 };
  return { lo: 8, hi: 12 };
}

// Pause: Grundübungen länger (Schoenfeld 2016), in der schweren Phase 3 Min.
export function restFor(ex, settings) {
  if (ex.rest) return heavyPhase(settings) && isMainLift(ex) ? Math.max(ex.rest, 180) : ex.rest;
  if (isMainLift(ex)) return heavyPhase(settings) ? 180 : 150;
  if (['Kniedominant', 'Hüftdominant', 'Drücken horizontal', 'Drücken vertikal', 'Ziehen horizontal', 'Ziehen vertikal'].includes(ex.group)) return Math.max(settings.rest || 90, 120);
  return settings.rest;
}

// Gewichtssprung je Gerät
export function incFor(ex, w = 0) {
  switch (ex.equip) {
    case 'kh': return w < 10 ? 1 : 2;
    case 'kb': return 4;
    case 'lh': return 2.5;
    case 'ma': return 2.5;
    case 'kg': return 2.5;
    default: return 2;
  }
}
const roundTo = (x, step) => Math.max(step, Math.round(x / step) * step);
const e1rm = s => s.w * (1 + s.r / 30);

// ---------- Steigerung: Vorschlag fürs nächste Mal ----------
// prev = { sets, fields } vom letzten Training dieser Übung
export function suggest(ex, prev, settings) {
  const range = rangeFor(ex, settings);
  if (!range || !prev) return null;
  const sets = prev.sets.filter(s => !s.warm && s.r > 0);
  if (!sets.length) return null;
  const { lo, hi } = range;
  const hasW = prev.fields.includes('w');
  const W = Math.max(...sets.map(s => s.w || 0));
  const top = sets.filter(s => (s.w || 0) === W);
  const reps = top.map(s => s.r);
  const avg = reps.reduce((a, b) => a + b, 0) / reps.length;
  const base = { range, src: range.heavy ? 'heavy' : 'progression' };

  // Bereich hat sich geändert (z. B. schwere Phase): Gewicht über das geschätzte 1RM neu ansetzen
  if (hasW && W > 0 && ex.equip !== 'kg' && (avg > hi + 2 || avg < lo - 1)) {
    const best = Math.max(...top.map(e1rm));
    const mid = Math.round((lo + hi) / 2);
    const nw = roundTo(best / (1 + mid / 30), incFor(ex, W));
    return { ...base, type: 'anchor', w: nw, target: `${lo}–${hi}`, why: `Neuer Bereich ${lo}–${hi} Wdh.: Startgewicht aus deinem geschätzten Maximalgewicht berechnet.` };
  }
  // Oberes Ende in allen Arbeitssätzen erreicht → schwerer
  if (reps.every(r => r >= hi)) {
    if (ex.equip === 'band' || prev.fields.includes('b')) return { ...base, type: 'up', target: `${lo}–${lo + 2}`, band: true, why: `Alle Sätze bei ${hi}+: nächstes Mal ein stärkeres Band.` };
    if (!hasW) return { ...base, type: 'harder', why: `Alle Sätze bei ${hi}+: schwerere Variante wählen oder Zusatzgewicht nehmen.` };
    const nw = (W || 0) + incFor(ex, W);
    return { ...base, type: 'up', w: nw, target: `${lo}–${Math.min(hi, lo + 2)}`, why: `Alle Sätze bei ${hi}+ Wdh. geschafft – Zeit für mehr Gewicht. Danach wieder ab ${lo} Wdh. aufbauen.` };
  }
  // Mehrheit unter dem Bereich → Gewicht halten (oder leicht runter)
  if (reps.filter(r => r < lo).length > reps.length / 2) {
    return { ...base, type: 'hold', w: W, target: reps.map(r => Math.max(r, lo)).join('-'), why: `Mehrere Sätze unter ${lo} Wdh.: Gewicht halten und sauber in den Bereich kommen. Klappt das zweimal nicht, etwas leichter.` };
  }
  // Im Bereich → je Satz eine Wiederholung mehr
  const target = reps.map(r => Math.max(r, Math.min(hi, r + 1)));
  return { ...base, type: 'reps', w: W, target: target.join('-'), why: `Im Bereich ${lo}–${hi}: gleiches Gewicht, je Satz eine Wiederholung mehr. Wenn alle Sätze ${hi} erreichen, geht es hoch.` };
}

// ---------- Wochenvolumen (letzte 7 Tage) ----------
export function weekMuscleSets(workouts, exById, now = Date.now()) {
  const from = now - 7 * DAY, out = {};
  for (const w of workouts) {
    if (w.start < from || !w.entries?.length || (w.kind || 'kraft') === 'lauf') continue;
    for (const e of w.entries) {
      const n = e.sets.filter(s => !s.warm).length;
      const mu = musclesOf(exById(e.exId));
      for (const k of mu.p) out[k] = (out[k] || 0) + n;
      for (const k of mu.s) out[k] = (out[k] || 0) + n / 2;
    }
  }
  return out;
}

// Krafteinheiten pro Woche (Ø der letzten 4 Wochen)
export function strengthPerWeek(workouts, now = Date.now()) {
  const n = workouts.filter(w => w.start >= now - 28 * DAY && (w.kind || 'kraft') !== 'lauf').length;
  return n / 4;
}

// Gleichgewichts-/Fußtraining in den letzten 6 Wochen
const BALANCE_IDS = new Set(['einbeinstand', 'sl-rdl', 'short-foot', 'monster-walk', 'box-pistol', 'pogo', 'copenhagen']);
export function balanceSessions(workouts, exById, now = Date.now()) {
  return workouts.filter(w => w.start >= now - 42 * DAY && (w.entries || []).some(e => BALANCE_IDS.has(e.exId) || exById(e.exId).group === 'Fuß & Reha')).length;
}

// Rumpf: Anteil Beuge-/Rotationsübungen mit Last (McGill: lieber Bewegung verhindern)
const FLEX_ROT = new Set(['russian-twist', 'leg-raises']);
export function coreCheck(workouts, exById, now = Date.now()) {
  let anti = 0, flex = 0;
  for (const w of workouts) {
    if (w.start < now - 28 * DAY) continue;
    for (const e of w.entries || []) {
      if (exById(e.exId).group !== 'Core') continue;
      const n = e.sets.filter(s => !s.warm).length;
      FLEX_ROT.has(e.exId) ? (flex += n) : (anti += n);
    }
  }
  return { anti, flex, share: anti + flex ? flex / (anti + flex) : 0 };
}

// Lauf in den letzten 24 h?
export const recentRun = (workouts, now = Date.now()) => workouts.filter(w => (w.kind === 'lauf') && w.start >= now - DAY && w.start <= now).at(-1) || null;

// ---------- Fuß-Status: Tausch bei Beschwerden ----------
export const FOOT_SWAP = {
  pogo: 'einbeinstand', 'box-jumps': 'step-ups', 'broad-jumps': 'mountain-climbers', burpees: 'mountain-climbers',
  seilspringen: 'assault-bike', laufen: 'assault-bike', 'ausfall-atw': 'split-squat', 'sandbag-lunges': 'split-squat',
  'wall-balls': 'goblet', 'ausfall-lh': 'split-squat', 'ausfall-kh': 'split-squat', 'reverse-lunge': 'split-squat',
};

// ---------- Beschwerden: Nachbargelenke prüfen ----------
export const COMPLAINTS = {
  knie: { label: 'Knie', check: ['Sprunggelenk: Knie-zur-Wand-Test – fehlt Beweglichkeit, muss das Knie ausweichen', 'Hüfte: Beweglichkeit (90/90) und Kraft des Gesäßes (Knie fällt nach innen?)'],
    ex: ['knie-wand', 'hip-9090', 'monster-walk', 'sl-bridge'] },
  ruecken: { label: 'Unterer Rücken', check: ['Hüfte: Hüftbeuger und Rotation – steife Hüften holen sich Bewegung aus dem Rücken', 'Brustwirbelsäule: Drehung und Streckung', 'Rumpf: Stabilität statt Beugen/Drehen unter Last'],
    ex: ['hip-flexor', 'hip-9090', 'wgs', 'bird-dog', 'seitstuetz'] },
  schulter: { label: 'Schulter', check: ['Brustwirbelsäule: fehlende Streckung/Drehung belastet die Schulter', 'Schulterblatt: Stabilität durch Rudern und Face Pulls'],
    ex: ['wgs', 'face-pulls', 'rudern-band', 'kb-halo'] },
  huefte: { label: 'Hüfte/Leiste', check: ['Rumpf: Stabilität (Lendenwirbelsäule soll stabil sein)', 'Sprunggelenk: Beweglichkeit', 'Adduktoren: Copenhagen Plank'],
    ex: ['bird-dog', 'copenhagen', 'knie-wand', 'hip-9090'] },
  fuss: { label: 'Fuß/Sprunggelenk', check: ['Fuß: Stabilität und Gewölbe (Kurzer Fuß, Einbeinstand)', 'Sprunggelenk: Beweglichkeit (Knie zur Wand)', 'Hüfte: Gesäßkraft stabilisiert das Bein von oben'],
    ex: ['short-foot', 'einbeinstand', 'knie-wand', 'monster-walk'] },
  nacken: { label: 'Nacken', check: ['Brustwirbelsäule: Beweglichkeit', 'Schulterblatt: Kraft im oberen Rücken'],
    ex: ['wgs', 'face-pulls', 'rudern-band'] },
};

export const KNEE_WALL_TARGET = 12.7; // cm (5 Inch, Squat University)
