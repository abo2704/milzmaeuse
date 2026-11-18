// Messwerte, Muskelgruppen und Start-Übungen.
// Jede Übung hat eine Liste "fields" – das sind die Werte, die du pro Satz einträgst.
export const FIELDS = {
  w: { label: 'Gewicht', col: 'kg', example: '32 kg' },
  r: { label: 'Wiederholungen', col: 'Wdh.', example: '10 Wdh.' },
  d: { label: 'Strecke', col: 'Meter', example: '40 m' },
  t: { label: 'Zeit', col: 'Zeit', example: '1:30' },
};
export const FIELD_ORDER = ['w', 'r', 'd', 't'];
export const sortFields = fs => FIELD_ORDER.filter(f => (fs || []).includes(f));

export const GROUPS = ['Brust', 'Rücken', 'Schultern', 'Beine', 'Po', 'Arme', 'Core', 'Ganzkörper', 'Ausdauer', 'Sonstiges'];

const E = (id, name, group, fields, extra = {}) => ({ id, name, group, fields, perSide: false, note: '', rest: null, seed: true, ...extra });
const WR = ['w', 'r'];

export const SEED_EXERCISES = [
  E('bankdruecken', 'Bankdrücken (Langhantel)', 'Brust', WR, { rest: 150 }),
  E('schraegbank-kh', 'Schrägbankdrücken (Kurzhantel)', 'Brust', WR),
  E('liegestuetze', 'Liegestütze', 'Brust', ['r']),
  E('dips', 'Dips', 'Brust', ['r']),
  E('kreuzheben', 'Kreuzheben', 'Rücken', WR, { rest: 180 }),
  E('langhantelrudern', 'Langhantelrudern', 'Rücken', WR),
  E('kh-rudern', 'Kurzhantelrudern einarmig', 'Rücken', WR, { perSide: true }),
  E('klimmzuege', 'Klimmzüge', 'Rücken', ['r']),
  E('latziehen', 'Latziehen', 'Rücken', WR),
  E('kniebeuge', 'Kniebeuge (Langhantel)', 'Beine', WR, { rest: 180 }),
  E('beinpresse', 'Beinpresse', 'Beine', WR),
  E('rdl', 'Rumänisches Kreuzheben', 'Beine', WR),
  E('ausfallschritte', 'Ausfallschritte', 'Beine', WR, { perSide: true }),
  E('bulgarian', 'Bulgarian Split Squat', 'Beine', WR, { perSide: true }),
  E('wadenheben', 'Wadenheben', 'Beine', WR),
  E('hip-thrust', 'Hip Thrust', 'Po', WR),
  E('schulterdruecken', 'Schulterdrücken', 'Schultern', WR),
  E('seitheben', 'Seitheben', 'Schultern', WR),
  E('face-pulls', 'Face Pulls', 'Schultern', WR),
  E('bizepscurls', 'Bizepscurls', 'Arme', WR),
  E('hammercurls', 'Hammer Curls', 'Arme', WR),
  E('trizeps-kabel', 'Trizepsdrücken am Kabel', 'Arme', WR),
  E('plank', 'Plank', 'Core', ['t']),
  E('seitstuetz', 'Seitstütz', 'Core', ['t'], { perSide: true }),
  E('leg-raises', 'Hängendes Beinheben', 'Core', ['r']),
  E('ab-wheel', 'Ab Wheel', 'Core', ['r']),
  E('pallof', 'Pallof Press', 'Core', WR, { perSide: true }),
  E('farmers-carry', 'Farmers Carry', 'Ganzkörper', ['w', 'd'], { note: 'Gewicht = pro Hand', rest: 120 }),
  E('suitcase-carry', 'Suitcase Carry', 'Ganzkörper', ['w', 'd'], { perSide: true }),
  E('kb-swings', 'Kettlebell Swings', 'Ganzkörper', WR),
  E('schlitten', 'Schlitten schieben', 'Ganzkörper', ['w', 'd']),
  E('burpees', 'Burpees', 'Ganzkörper', ['r']),
  E('rudergeraet', 'Rudergerät', 'Ausdauer', ['d', 't']),
  E('laufen', 'Laufen', 'Ausdauer', ['d', 't']),
  E('seilspringen', 'Seilspringen', 'Ausdauer', ['t']),
];

export const SEED_TEMPLATES = [
  { id: 'tpl-beispiel', name: 'Beispiel: Ganzkörper', items: [
    { exId: 'kniebeuge', sets: 3 }, { exId: 'bankdruecken', sets: 3 }, { exId: 'langhantelrudern', sets: 3 },
    { exId: 'farmers-carry', sets: 3 }, { exId: 'plank', sets: 2 },
  ] },
];
