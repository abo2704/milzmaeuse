// Messwerte, Bewegungsmuster, Geräte und Start-Übungen.
// Jede Übung hat "fields" = die Werte, die du pro Satz einträgst. Leere Liste = nur abhaken ("erledigt").
export const FIELDS = {
  w: { label: 'Gewicht', col: 'kg', example: '22 kg' },
  r: { label: 'Wiederholungen', col: 'Wdh.', example: '10 Wdh.' },
  d: { label: 'Strecke', col: 'Meter', example: '40 m' },
  t: { label: 'Zeit', col: 'Zeit', example: '1:30' },
  c: { label: 'Kalorien', col: 'kcal', example: '20 kcal' },
  b: { label: 'Miniband', col: 'Band', example: 'mittel' },
};
export const FIELD_ORDER = ['w', 'b', 'r', 'd', 'c', 't'];
export const sortFields = fs => FIELD_ORDER.filter(f => (fs || []).includes(f));

export const BANDS = ['leicht', 'mittel', 'schwer', 'sehr schwer', 'Läuferband'];

// Bewegungsmuster = Gruppen = Plätze im Plan
export const GROUPS = [
  'Kniedominant', 'Hüftdominant', 'Drücken horizontal', 'Drücken vertikal', 'Ziehen horizontal', 'Ziehen vertikal',
  'Core', 'Fuß & Reha', 'Arme & Schultern', 'Ganzkörper & Hybrid', 'Ausdauer', 'Mobilität',
];

export const EQUIP = {
  lh: 'Langhantel', kh: 'Kurzhantel', kb: 'Kettlebell', ma: 'Maschine / Kabel', kg: 'Körpergewicht', band: 'Band', cardio: 'Cardio-Gerät', sonst: 'Sonstiges',
};
// Spaltenkopf fürs Gewicht je nach Gerät
export const weightCol = equip => equip === 'kg' ? '+kg' : equip === 'kh' ? 'kg/Hand' : 'kg';

export const KINDS = {
  kraft: { label: 'Kraft', icon: '🏋️' },
  hybrid: { label: 'Hybrid', icon: '⚡' },
  lauf: { label: 'Lauf', icon: '🏃' },
};

const E = (id, name, group, equip, fields, extra = {}) => ({ id, name, group, equip, fields, perSide: false, note: '', rest: null, seed: true, aliases: [], ...extra });
const WR = ['w', 'r'];

export const SEED_EXERCISES = [
  // Kniedominant
  E('kniebeuge', 'Kniebeuge (Langhantel)', 'Kniedominant', 'lh', WR, { rest: 150, aliases: ['Kniebeuge Langhantel Schulterauflage (stehend)'] }),
  E('kniebeuge-geraet', 'Kniebeuge am Gerät', 'Kniedominant', 'ma', WR, { aliases: ['Kniebeuge am Gerät (positiv)'] }),
  E('beinpresse', 'Beinpresse', 'Kniedominant', 'ma', WR, { aliases: ['Beinpresse am Gerät'] }),
  E('ausfall-lh', 'Ausfallschritte (Langhantel)', 'Kniedominant', 'lh', WR, { aliases: ['Ausfallschritte Langhantel'] }),
  E('ausfall-kh', 'Ausfallschritte (Kurzhantel)', 'Kniedominant', 'kh', WR, { aliases: ['Ausfallschritte Kurzhantel'], importHalve: true }),
  E('bulgarian', 'Bulgarian Split Squat', 'Kniedominant', 'kh', WR, { perSide: true }),
  E('ausfall-atw', 'Ausfallschritt around the world', 'Kniedominant', 'sonst', WR),
  E('step-ups', 'Step-ups', 'Kniedominant', 'kh', WR, { perSide: true }),
  // Hüftdominant
  E('rdl', 'Rumänisches Kreuzheben', 'Hüftdominant', 'lh', WR, { aliases: ['Romanian Deadlift'] }),
  E('kb-deadlift', 'Kettlebell Deadlift', 'Hüftdominant', 'kb', WR, { note: 'Gewicht pro Kugel', importHalve: true }),
  E('kreuzheben-kh', 'Kreuzheben (Kurzhantel)', 'Hüftdominant', 'kh', WR, { aliases: ['Kreuzheben Kurzhantel'], importHalve: true }),
  E('kb-swings', 'Kettlebell Swings', 'Hüftdominant', 'kb', WR),
  E('hip-thrust', 'Hip Thrust', 'Hüftdominant', 'lh', WR),
  E('glute-bridge', 'Glute Bridge', 'Hüftdominant', 'kg', ['r', 'b']),
  E('sl-rdl', 'Einbeiniges Kreuzheben', 'Hüftdominant', 'kh', WR, { perSide: true }),
  // Drücken horizontal
  E('schraeg-kh', 'Schrägbankdrücken (Kurzhantel)', 'Drücken horizontal', 'kh', WR, { aliases: ['Schrägbankdrücken Kurzhantel (positiv)'], importHalve: true }),
  E('schraeg-lh', 'Schrägbankdrücken (Langhantel)', 'Drücken horizontal', 'lh', WR, { aliases: ['Schrägbankdrücken Langhantel (positiv)'] }),
  E('schraeg-geraet', 'Schrägbankdrücken am Gerät', 'Drücken horizontal', 'ma', WR, { aliases: ['Schrägbankdrücken am Gerät (positiv)'] }),
  E('flach-kh', 'Flachbankdrücken (Kurzhantel)', 'Drücken horizontal', 'kh', WR, { aliases: ['Flachbankdrücken Kurzhantel'], importHalve: true }),
  E('flach-geraet', 'Flachbankdrücken am Gerät', 'Drücken horizontal', 'ma', WR),
  E('liegestuetze', 'Liegestütze', 'Drücken horizontal', 'kg', ['r']),
  E('liegestuetz-griff', 'Liegestütze an Griffen', 'Drücken horizontal', 'kg', ['r'], { aliases: ['Liegestütz an Griff'] }),
  // Drücken vertikal
  E('military', 'Military Press', 'Drücken vertikal', 'lh', WR, { aliases: ['Schulterdrücken Langhantel, Military (stehend)'] }),
  E('schulter-kh-sitz', 'Schulterdrücken (Kurzhantel, sitzend)', 'Drücken vertikal', 'kh', WR, { aliases: ['Schulterdrücken Kurzhantel (sitzend)'], importHalve: true }),
  E('schulter-kh-steh', 'Schulterdrücken (Kurzhantel, stehend)', 'Drücken vertikal', 'kh', WR, { aliases: ['Schulterdrücken KH stehend'] }),
  E('pike', 'Pike Push-ups', 'Drücken vertikal', 'kg', ['r']),
  // Ziehen vertikal
  E('klimmzuege-eng', 'Klimmzüge enger Untergriff', 'Ziehen vertikal', 'kg', WR, { rest: 120, importBodyweight: true }),
  E('klimmzuege', 'Klimmzüge (Obergriff)', 'Ziehen vertikal', 'kg', WR, { rest: 120, importBodyweight: true }),
  E('latziehen', 'Latziehen', 'Ziehen vertikal', 'ma', WR),
  // Ziehen horizontal
  E('rudern-seil', 'Rudern am Seilzug (sitzend)', 'Ziehen horizontal', 'ma', WR),
  E('rudern-geraet', 'Rudern am Gerät (sitzend)', 'Ziehen horizontal', 'ma', WR),
  E('rudern-kh', 'Rudern Kurzhantel vorgebeugt', 'Ziehen horizontal', 'kh', WR, { aliases: ['Rudern Kurzhantel vorgebeugt (stehend)'] }),
  E('rudern-kh-1', 'Kurzhantelrudern einarmig', 'Ziehen horizontal', 'kh', WR, { perSide: true }),
  E('rudern-band', 'Rudern mit Miniband', 'Ziehen horizontal', 'band', ['b', 'r']),
  // Core
  E('kaefer', 'Käfer (Dead Bug)', 'Core', 'kg', ['r'], { aliases: ['Käfer'] }),
  E('kb-around', 'Kettlebell other way around', 'Core', 'kb', WR),
  E('stuetz-ruder', 'Stütz mit Rudern', 'Core', 'kh', WR, { aliases: ['Stütz mit Ruder'] }),
  E('plank', 'Plank', 'Core', 'kg', ['w', 't']),
  E('seitstuetz', 'Seitstütz', 'Core', 'kg', ['t'], { perSide: true }),
  E('leg-raises', 'Hängendes Beinheben', 'Core', 'kg', ['r']),
  E('pallof', 'Pallof Press', 'Core', 'ma', WR, { perSide: true }),
  // Fuß & Reha
  E('fuss-reha', 'Fußgelenk-Übungen', 'Fuß & Reha', 'kg', [], { note: 'Neuroathletik / Physio' }),
  E('waden-1', 'Wadenheben einbeinig', 'Fuß & Reha', 'kg', ['w', 'r'], { perSide: true }),
  E('einbeinstand', 'Einbeinstand instabil', 'Fuß & Reha', 'kg', ['t'], { perSide: true }),
  E('monster-walk', 'Monster Walk (Miniband)', 'Fuß & Reha', 'band', ['b', 'r']),
  // Arme & Schultern
  E('curls-kh', 'Bizeps-Curls (Kurzhantel)', 'Arme & Schultern', 'kh', WR, { aliases: ['Bizeps-Curls Kurzhantel abwechselnd (stehend)'] }),
  E('seitheben', 'Seitheben', 'Arme & Schultern', 'kh', WR),
  E('face-pulls', 'Face Pulls', 'Arme & Schultern', 'ma', WR),
  E('trizeps-kabel', 'Trizepsdrücken am Kabel', 'Arme & Schultern', 'ma', WR),
  // Ganzkörper & Hybrid
  E('ski-erg', 'Ski Erg', 'Ganzkörper & Hybrid', 'cardio', ['t']),
  E('burpees', 'Burpees', 'Ganzkörper & Hybrid', 'kg', ['r']),
  E('kh-snatch', 'Kurzhantel Snatches', 'Ganzkörper & Hybrid', 'kh', WR, { perSide: true }),
  E('kb-deadlift-dd', 'Kreuzheben (Kettlebell, schwer)', 'Ganzkörper & Hybrid', 'kb', WR),
  E('farmers-carry', 'Farmers Carry', 'Ganzkörper & Hybrid', 'kh', ['w', 'd'], { rest: 120 }),
  E('offset-carry', 'Offset Carry', 'Ganzkörper & Hybrid', 'kb', ['w', 'd']),
  E('wall-balls', 'Wall Balls', 'Ganzkörper & Hybrid', 'sonst', WR),
  E('schlitten', 'Schlitten schieben', 'Ganzkörper & Hybrid', 'sonst', ['w', 'd']),
  E('sandbag-lunges', 'Sandsack-Ausfallschritte', 'Ganzkörper & Hybrid', 'sonst', ['w', 'd']),
  // Ausdauer
  E('rudergeraet', 'Rudergerät', 'Ausdauer', 'cardio', ['d', 't']),
  E('assault-bike', 'Assault Bike', 'Ausdauer', 'cardio', ['c', 't']),
  E('seilspringen', 'Seilspringen', 'Ausdauer', 'kg', ['t']),
  // Mobilität
  E('warmup', 'Aufwärmen / Mobility', 'Mobilität', 'kg', []),
];

// Routinen bestehen aus Plätzen: je Platz eine Studio- und eine Zuhause-Übung (null = dort auslassen).
// link: true = mit dem nächsten Platz als Supersatz verbunden.
const I = (slot, studio, home, sets = 3, link = false) => ({ slot, studio, home, sets, link });
export const SEED_TEMPLATES = [
  { id: 'tpl-gk', name: 'Ganzkörper', kind: 'kraft', items: [
    I('Kniedominant', 'kniebeuge', 'bulgarian'),
    I('Hüftdominant', 'kb-deadlift', 'sl-rdl'),
    I('Ziehen vertikal', 'klimmzuege-eng', 'klimmzuege-eng', 3, true),
    I('Drücken vertikal', 'military', 'pike'),
    I('Drücken horizontal', 'schraeg-kh', 'liegestuetze', 3, true),
    I('Ziehen horizontal', 'rudern-seil', 'rudern-band'),
    I('Core', 'kaefer', 'kaefer', 3),
    I('Fuß & Reha', 'fuss-reha', 'fuss-reha', 1),
  ] },
  { id: 'tpl-dd', name: 'Deadly Dozen HIIT', kind: 'hybrid', note: 'Runde 1: je 1:30 · Runde 2: je 1:00 · 10 s Wechsel · 2:00 Pause dazwischen', items: [
    I('Station 1', 'ski-erg', 'ski-erg', 2), I('Station 2', 'kb-deadlift-dd', 'kb-deadlift-dd', 2), I('Station 3', 'ski-erg', 'ski-erg', 2),
    I('Station 4', 'schulter-kh-steh', 'schulter-kh-steh', 2), I('Station 5', 'ski-erg', 'ski-erg', 2), I('Station 6', 'ausfall-atw', 'ausfall-atw', 2),
    I('Station 7', 'ski-erg', 'ski-erg', 2), I('Station 8', 'kh-snatch', 'kh-snatch', 2), I('Station 9', 'ski-erg', 'ski-erg', 2),
    I('Station 10', 'burpees', 'burpees', 2),
  ] },
];
