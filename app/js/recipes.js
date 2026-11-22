// Rezeptbox: Zutatenzeilen verstehen, umrechnen, mit Vorrat abgleichen, Eiweiß schätzen.

const UNITS = {
  g: ['g', 'gr', 'gramm'], kg: ['kg'], ml: ['ml'], l: ['l', 'liter'], cl: ['cl'],
  EL: ['el', 'essl', 'esslöffel'], TL: ['tl', 'teel', 'teelöffel'], Prise: ['prise', 'prisen'], Msp: ['msp', 'messerspitze'],
  Zehe: ['zehe', 'zehen', 'zehe(n)'], Bund: ['bund', 'bd'], Handvoll: ['handvoll'], Dose: ['dose', 'dosen', 'dose(n)'],
  Pck: ['pck', 'pk', 'packung', 'packungen', 'päckchen', 'pkg'], Becher: ['becher'], Scheibe: ['scheibe', 'scheiben', 'scheibe(n)'],
  Stück: ['stück', 'stk', 'st'], Glas: ['glas', 'gläser'], Tasse: ['tasse', 'tassen'], Zweig: ['zweig', 'zweige', 'zweig(e)'], Blatt: ['blatt', 'blätter'],
};
const UNIT_OF = Object.fromEntries(Object.entries(UNITS).flatMap(([u, ws]) => ws.map(w => [w, u])));
const FRAC = { '½': .5, '¼': .25, '¾': .75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': .125 };

// "1 1/2 EL Olivenöl, extra vergine" → { qty: 1.5, unit: 'EL', name: 'Olivenöl, extra vergine', key: 'Olivenöl' }
export function parseLine(raw) {
  let s = String(raw).trim().replace(/\s+/g, ' ');
  let qty = null;
  const m = s.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?))?\s*/);
  if (m) {
    const v = m[1];
    if (FRAC[v]) qty = FRAC[v];
    else if (v.includes('/')) { const p = v.split(' '); const [a, b] = p.pop().split('/'); qty = (p.length ? Number(p[0]) : 0) + Number(a) / Number(b); }
    else qty = Number(v.replace(',', '.'));
    s = s.slice(m[0].length);
  }
  let unit = '';
  const um = s.match(/^([A-Za-zÄÖÜäöüß()]+)\.?(\s|$)/);
  if (um && UNIT_OF[um[1].toLowerCase()]) { unit = UNIT_OF[um[1].toLowerCase()]; s = s.slice(um[0].length); }
  const name = s.trim() || String(raw).trim();
  const key = name.replace(/\(.*?\)/g, '').split(',')[0].trim() || name;
  return { raw: String(raw), qty, unit, name, key };
}

const stem = w => { w = w.toLowerCase().replace(/[^a-zäöüß]/g, ''); if (w === 'eier') return 'ei'; return w.length > 4 ? w.replace(/(en|n|e|s)$/, '') : w; };
const tokens = s => s.toLowerCase().split(/[^a-zäöüß]+/).filter(t => t.length >= 2).map(stem);
const IGNORE_TOKENS = new Set(['tk', 'frisch', 'dose', 'getrocknet', 'gemahlen']);

// Passt ein Vorratsartikel zur Zutat? Alle wesentlichen Wörter des Vorratsnamens müssen in der Zutat vorkommen.
export function matchesStock(ingKey, stockName) {
  const it = tokens(ingKey), st = tokens(stockName).filter(t => !IGNORE_TOKENS.has(t) && t.length >= 3);
  if (!st.length) return false;
  return st.every(s => it.some(i => i === s || (s.length >= 4 && i.includes(s)) || (i.length >= 4 && s.includes(i))));
}

const BASICS = ['salz', 'pfeffer', 'öl', 'olivenöl', 'pflanzenöl', 'rapsöl', 'sonnenblumenöl', 'wasser', 'zucker', 'essig', 'brühe', 'gemüsebrühe', 'sojasauce', 'senf', 'honig', 'mehl', 'speisestärke', 'backpulver'];
export const isBasic = p => ['TL', 'Prise', 'Msp'].includes(p.unit) || tokens(p.key).some(t => BASICS.some(b => t === stem(b) || t.endsWith(stem(b))));

// Status je Zutat: 'da' | 'knapp' | 'fehlt' | 'grund'
export function checkAgainstStock(parsed, stock) {
  return parsed.map(p => {
    const st = stock.find(s => matchesStock(p.key, s.name));
    let status = 'fehlt';
    if (st) status = Number(st.qty) <= 0 ? 'fehlt' : Number(st.qty) < Number(st.min_qty) ? 'knapp' : 'da';
    else if (isBasic(p) || /^wasser/i.test(p.key)) status = 'grund';
    return { ...p, stock: st || null, status };
  });
}

// ---------- Menge formatieren / umrechnen ----------
export function scaleQty(q, f) { return q == null ? null : q * f; }
export function fmtQty(q, unit) {
  if (q == null) return unit || '';
  let v;
  if (['g', 'ml'].includes(unit) && q >= 20) v = String(Math.round(q / 5) * 5);
  else if (q >= 10) v = String(Math.round(q));
  else { const r = Math.round(q * 4) / 4; v = (r || Math.round(q * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }); }
  return `${v}${unit ? ' ' + unit : ''}`;
}

// ---------- Eiweiß-Schätzung ----------
// [Suchwort, Eiweiß g/100 g, kcal/100 g, Gewicht je Stück in g]
const NUTR = [
  ['basmati', 7.5, 350], ['reis', 7, 350], ['vollkornnudel', 13, 340], ['nudel', 12, 355], ['pasta', 12, 355], ['spaghetti', 12, 355], ['penne', 12, 355],
  ['rote linse', 24, 340], ['linse', 23, 330], ['kichererbse', 7, 120], ['kidney', 7.5, 105], ['bohne', 7, 100], ['edamame', 11, 120],
  ['erdnussbutter', 25, 600], ['erdnuss', 26, 570], ['mandel', 21, 600], ['cashew', 18, 580], ['walnuss', 15, 650], ['nuss', 16, 620], ['samen', 20, 560],
  ['haferflocke', 13.5, 370], ['quinoa', 14, 370], ['couscous', 12, 360], ['bulgur', 12, 340], ['mehl', 10, 350], ['brot', 8, 250], ['brötchen', 9, 260, 60], ['tortilla', 8, 300, 60], ['wrap', 8, 300, 60],
  ['süßkartoffel', 1.6, 86, 250], ['kartoffel', 2, 75, 120], ['tomatenmark', 4, 80], ['passierte', 1.3, 30], ['tomate', 0.9, 18, 100], ['zwiebel', 1.2, 40, 80], ['knoblauch', 6, 150, 4],
  ['paprika', 1, 30, 150], ['zucchini', 1.5, 20, 250], ['brokkoli', 3.5, 35, 400], ['spinat', 2.5, 20], ['möhre', 1, 36, 80], ['karotte', 1, 36, 80], ['champignon', 3, 22, 20], ['pilz', 3, 22, 20],
  ['aubergine', 1.2, 24, 300], ['gurke', 0.6, 12, 400], ['mais', 3, 80], ['erbse', 6, 80], ['avocado', 2, 200, 150], ['banane', 1.1, 90, 120], ['apfel', 0.3, 55, 150], ['petersilie', 3, 40], ['koriander', 2, 25],
  ['ei', 13, 155, 60], ['skyr', 11, 63], ['magerquark', 12, 70], ['quark', 12, 70], ['griechisch', 6, 120], ['joghurt', 4, 60], ['milch', 3.4, 64], ['sahne', 2.4, 300], ['schmand', 2.5, 240],
  ['frischkäse', 6, 240], ['feta', 17, 260], ['halloumi', 22, 320], ['mozzarella', 18, 250], ['parmesan', 32, 400], ['hüttenkäse', 12, 100], ['käse', 25, 350], ['butter', 0.7, 740],
  ['tofu', 15, 130], ['tempeh', 19, 190], ['seitan', 25, 150], ['hähnchen', 23, 110], ['huhn', 23, 110], ['pute', 24, 110], ['hack', 20, 250], ['rind', 21, 150], ['schwein', 21, 150],
  ['lachs', 20, 200], ['thunfisch', 24, 115], ['garnele', 20, 90], ['fisch', 19, 100], ['kokosmilch', 2, 200], ['öl', 0, 880], ['zucker', 0, 400], ['honig', 0, 300],
];
const UNIT_G = { g: 1, kg: 1000, ml: 1, l: 1000, cl: 10, EL: 12, TL: 4, Prise: 0.5, Msp: 0.5, Zehe: 4, Bund: 30, Handvoll: 25, Dose: 240, Pck: 250, Becher: 150, Scheibe: 25, Glas: 300, Tasse: 150, Zweig: 2, Blatt: 1 };
const nutrOf = key => { const k = key.toLowerCase(); return NUTR.find(([w]) => w.length <= 2 ? tokens(k).some(t => t === w || t === w + 'er') : k.includes(w)); };

// Liefert { protein, kcal, known } je Portion; known = Anteil der Zutaten, die erkannt wurden
export function estimate(parsed, servings) {
  let protein = 0, kcal = 0, known = 0, relevant = 0;
  for (const p of parsed) {
    if (/^wasser/i.test(p.key)) continue;
    relevant++;
    const n = nutrOf(p.key);
    if (!n || p.qty == null) continue;
    const grams = p.qty * (p.unit ? (UNIT_G[p.unit] ?? 100) : (n[3] ?? 100));
    protein += grams * n[1] / 100; kcal += grams * n[2] / 100; known++;
  }
  const s = Math.max(1, Number(servings) || 1);
  return { protein: Math.round(protein / s), kcal: Math.round(kcal / s / 10) * 10, known: relevant ? known / relevant : 0 };
}

// 🤰-Hinweise: grobe Stichwortliste, ersetzt keine ärztliche Beratung
const PREG = [['rohmilch', 'Rohmilchkäse meiden'], ['tatar', 'rohes Fleisch meiden'], ['carpaccio', 'rohes Fleisch meiden'], ['sushi', 'rohen Fisch meiden'], ['räucherlachs', 'kalt geräucherten Fisch meiden'], ['leber', 'Leber meiden (Vitamin A)'], ['mett', 'rohes Fleisch meiden'], ['eigelb, roh', 'rohe Eier meiden'], ['tiramisu', 'rohe Eier meiden']];
export const pregnancyWarnings = parsed => [...new Set(parsed.flatMap(p => PREG.filter(([w]) => p.raw.toLowerCase().includes(w)).map(([, t]) => t)))];

// Zutaten-Freitext → Zeilen
export const splitLines = txt => txt.split(/\n|;|•/).map(l => l.replace(/^[-*–\s]+/, '').trim()).filter(Boolean);
export const findUrl = txt => (String(txt).match(/https?:\/\/[^\s"'<>]+/) || [])[0] || '';

// Beispielrezept für den Demo-Modus (Struktur wie vom Import)
export const DEMO_RECIPE = {
  title: 'Kidneybohnen-Erdnuss-Eintopf', image: 'https://images.kptncook.com/59b68fc12c0000f905351266.jpg',
  url: 'https://app.kptncook.com/de/recipes/kidneybohnen-erdnuss-eintopf/22dd9a4f', servings: 2,
  ingredients: ['200 g Tomate', '120 g Basmati-Reis', '120 g Kidneybohne, Dose', '10 g Erdnussbutter', '10 g Petersilie', '1 Speisezwiebel', '100 ml Wasser', '2 Zehe(n) Knoblauch', '1 EL Pflanzenöl', '1 TL Sambal Oelek', '1/2 TL Kreuzkümmel (Cumin), gemahlen'],
};
