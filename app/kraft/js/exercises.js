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
  E('trapbar', 'Kreuzheben mit Trap Bar', 'Hüftdominant', 'lh', WR, { rest: 150, bar: 20, aliases: ['Trap Bar Deadlift', 'Deadlift Trap Bar'] }),
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
  E('military', 'Military Press', 'Drücken vertikal', 'lh', WR, { bar: 20, aliases: ['Schulterdrücken Langhantel, Military (stehend)'] }),
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
  E('pull-through', 'Plank Pull-Through (Kurzhantel)', 'Core', 'kh', WR, { note: 'Wdh. = Züge gesamt (links + rechts)' }),
  E('kb-finisher', 'Kettlebell-Finisher (alles in einem)', 'Core', 'kb', WR, { note: 'Ältere Variante – neu: Halo, Überzug und Curls als einzelne Übungen' }),
  // Finisher-Bausteine: einzeln, damit jede Übung eigene kg und Wdh. hat
  E('kb-halo', 'Kettlebell Halo', 'Arme & Schultern', 'kb', WR, { perSide: true, note: 'Wdh. je Richtung (z. B. 8 links + 8 rechts → 8)' }),
  E('kb-pullover', 'Überzug im Stehen (Kettlebell)', 'Arme & Schultern', 'kb', WR),
  E('kb-curl', 'Bizeps-Curls (Kettlebell)', 'Arme & Schultern', 'kb', WR, { note: 'Im Finisher bis zur Erschöpfung – eigene Wdh.-Zahl (z. B. 30)', range: [15, 40] }),
  E('russian-twist', 'Russian Twist (Kettlebell)', 'Core', 'kb', WR, { note: 'Wdh. = Drehungen gesamt (links + rechts)' }),
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
  E('laufen', 'Laufen (Station)', 'Ausdauer', 'cardio', ['d', 't'], { note: 'Laufband oder draußen' }),
  E('seilspringen', 'Seilspringen', 'Ausdauer', 'kg', ['t']),
  // Mobilität
  E('warmup', 'Aufwärmen / Mobility', 'Mobilität', 'kg', []),
  E('wgs', "World's Greatest Stretch", 'Mobilität', 'kg', [], { perSide: true }),
  E('hip-flexor', 'Hüftbeuger-Dehnung (Halbkniestand)', 'Mobilität', 'kg', [], { perSide: true }),
  E('hip-9090', '90/90 Hüftrotation', 'Mobilität', 'kg', []),
  // --- Erweiterung: funktionell, läuferrelevant, Hybrid ---
  E('goblet', 'Goblet Squat', 'Kniedominant', 'kb', WR),
  E('frontkniebeuge', 'Frontkniebeuge', 'Kniedominant', 'lh', WR, { rest: 150 }),
  E('reverse-lunge', 'Ausfallschritt rückwärts', 'Kniedominant', 'kh', WR, { perSide: true }),
  E('split-squat', 'Split Squat (statisch)', 'Kniedominant', 'kh', WR, { perSide: true }),
  E('box-pistol', 'Einbeinige Kniebeuge auf Box', 'Kniedominant', 'kg', WR, { perSide: true }),
  E('wall-sit', 'Wandsitzen', 'Kniedominant', 'kg', ['w', 't']),
  E('sl-bridge', 'Glute Bridge einbeinig', 'Hüftdominant', 'kg', WR, { perSide: true }),
  E('nordic', 'Nordic Hamstring Curl', 'Hüftdominant', 'kg', ['r']),
  E('beinbeuger-geraet', 'Beinbeuger am Gerät', 'Hüftdominant', 'ma', WR),
  E('kb-clean', 'Kettlebell Clean', 'Hüftdominant', 'kb', WR, { perSide: true }),
  E('bankdruecken', 'Bankdrücken (Langhantel)', 'Drücken horizontal', 'lh', WR, { rest: 150 }),
  E('dips', 'Dips', 'Drücken horizontal', 'kg', WR, { importBodyweight: true }),
  E('liegestuetz-erhoeht', 'Liegestütze erhöht (Hände auf Bank)', 'Drücken horizontal', 'kg', ['r']),
  E('arnold', 'Arnold Press', 'Drücken vertikal', 'kh', WR),
  E('landmine', 'Landmine Press', 'Drücken vertikal', 'lh', WR, { perSide: true }),
  E('wand-handstand', 'Handstand an der Wand (halten)', 'Drücken vertikal', 'kg', ['t']),
  E('klimmzug-band', 'Klimmzüge mit Band-Unterstützung', 'Ziehen vertikal', 'band', ['b', 'r']),
  E('klimmzug-neg', 'Negative Klimmzüge', 'Ziehen vertikal', 'kg', ['r']),
  E('australian', 'Australian Pull-ups (tiefe Stange/Ringe)', 'Ziehen horizontal', 'kg', ['r']),
  E('bird-dog', 'Bird Dog', 'Core', 'kg', ['r'], { perSide: true }),
  E('hollow', 'Hollow Hold', 'Core', 'kg', ['t']),
  E('copenhagen', 'Copenhagen Plank', 'Core', 'kg', ['t'], { perSide: true }),
  E('ab-wheel', 'Ab Wheel', 'Core', 'kg', ['r']),
  E('shoulder-taps', 'Plank mit Schulter-Tippen', 'Core', 'kg', ['r']),
  E('tibialis', 'Tibialis Raises (Fußheber)', 'Fuß & Reha', 'kg', ['r']),
  E('short-foot', 'Kurzer Fuß (Short Foot)', 'Fuß & Reha', 'kg', ['t'], { perSide: true }),
  E('pogo', 'Pogo Jumps (Fußgelenks-Hüpfer)', 'Fuß & Reha', 'kg', ['r']),
  E('exz-waden', 'Exzentrisches Wadenheben', 'Fuß & Reha', 'kg', ['w', 'r'], { perSide: true }),
  E('knie-wand', 'Sprunggelenk-Mobilisation (Knie zur Wand)', 'Fuß & Reha', 'kg', [], { perSide: true }),
  E('hammer', 'Hammer Curls', 'Arme & Schultern', 'kh', WR),
  E('bank-dips', 'Trizeps-Dips an der Bank', 'Arme & Schultern', 'kg', ['r']),
  E('thruster', 'Thruster', 'Ganzkörper & Hybrid', 'kh', WR),
  E('kb-clean-press', 'Kettlebell Clean & Press', 'Ganzkörper & Hybrid', 'kb', WR, { perSide: true }),
  E('tgu', 'Turkish Get-up', 'Ganzkörper & Hybrid', 'kb', WR, { perSide: true, rest: 90 }),
  E('broad-jumps', 'Burpee Broad Jumps', 'Ganzkörper & Hybrid', 'kg', ['d']),
  E('sled-pull', 'Schlitten ziehen', 'Ganzkörper & Hybrid', 'sonst', ['w', 'd']),
  E('box-jumps', 'Box Jumps', 'Ganzkörper & Hybrid', 'kg', ['r']),
  E('mountain-climbers', 'Mountain Climbers', 'Ganzkörper & Hybrid', 'kg', ['t']),
  E('bear-crawl', 'Bärengang (Bear Crawl)', 'Ganzkörper & Hybrid', 'kg', ['d']),
  E('suitcase-carry', 'Suitcase Carry', 'Ganzkörper & Hybrid', 'kb', ['w', 'd'], { perSide: true }),
];

// Routinen bestehen aus Plätzen: je Platz eine Studio- und eine Zuhause-Übung (null = dort auslassen).
// link: true = mit dem nächsten Platz als Supersatz verbunden.
// alts = schnell wählbare Alternativen; multi = mehrere davon gleichzeitig (direkt hintereinander als Zirkel)
const CARDIO = ['rudergeraet', 'assault-bike', 'laufen'];
const I = (slot, studio, home, sets = 3, link = false, extra = {}) => ({ slot, studio, home, sets, link, ...extra });
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
  { id: 'tpl-gk-kern', v: 3, name: 'Ganzkörper Kern', kind: 'kraft', items: [
    I('Hüftdominant', 'trapbar', 'sl-rdl'),
    I('Drücken horizontal', 'schraeg-kh', 'liegestuetze', 3, true),
    I('Ziehen vertikal', 'klimmzuege-eng', 'klimmzuege-eng'),
    I('Drücken vertikal', 'military', 'pike', 3, false, { alts: ['schulter-kh-steh', 'schulter-kh-sitz'] }),
    I('Core', 'pull-through', 'pull-through', 3, false, { alts: ['kaefer', 'russian-twist'], multi: true }),
    I('Finisher: Halo', 'kb-halo', 'kb-halo', 1, true),
    I('Finisher: Überzug', 'kb-pullover', 'kb-pullover', 1, true),
    I('Finisher: Curls', 'kb-curl', 'kb-curl', 1),
    I('Fuß & Reha', 'fuss-reha', 'fuss-reha', 1),
  ] },
  // Deadly Dozen: Intervall-Timer statt Pausen-Timer. Jede Station = ein Platz, jede Runde = ein Satz.
  { id: 'tpl-dd', v: 2, name: 'Deadly Dozen HIIT', kind: 'hybrid', note: 'Timer starten und durchziehen – Wiederholungen kannst du danach nachtragen.',
    timer: { rounds: [90, 60], change: 10, rest: 120, prep: 10 }, items: [
    I('Station 1', 'ski-erg', 'ski-erg', 2, false, { alts: CARDIO }), I('Station 2', 'kb-deadlift-dd', 'kb-deadlift-dd', 2),
    I('Station 3', 'ski-erg', 'ski-erg', 2, false, { alts: CARDIO }), I('Station 4', 'schulter-kh-steh', 'schulter-kh-steh', 2),
    I('Station 5', 'ski-erg', 'ski-erg', 2, false, { alts: CARDIO }), I('Station 6', 'ausfall-atw', 'ausfall-atw', 2),
    I('Station 7', 'ski-erg', 'ski-erg', 2, false, { alts: CARDIO }), I('Station 8', 'kh-snatch', 'kh-snatch', 2),
    I('Station 9', 'ski-erg', 'ski-erg', 2, false, { alts: CARDIO }), I('Station 10', 'burpees', 'burpees', 2),
  ] },
];

// ---------- Muskeln ----------
// p = Hauptmuskeln (zählen voll), s = Hilfsmuskeln (zählen halb)
export const MUSCLES = {
  schultern: 'Schultern', brust: 'Brust', bizeps: 'Bizeps', trizeps: 'Trizeps', unterarme: 'Unterarme & Griff',
  bauch: 'Bauch', seitbauch: 'Seitliche Rumpfmuskeln', ruecken_oben: 'Oberer Rücken', lat: 'Latissimus',
  unterer_ruecken: 'Unterer Rücken', gesaess: 'Gesäß', quadrizeps: 'Oberschenkel vorn', beinbeuger: 'Oberschenkel hinten',
  waden: 'Waden', fuss: 'Fuß & Sprunggelenk',
};
const M = (p, s = []) => ({ p, s });
const GROUP_MUSCLES = {
  'Kniedominant': M(['quadrizeps', 'gesaess'], ['bauch', 'waden']),
  'Hüftdominant': M(['gesaess', 'beinbeuger'], ['unterer_ruecken', 'unterarme']),
  'Drücken horizontal': M(['brust'], ['schultern', 'trizeps']),
  'Drücken vertikal': M(['schultern'], ['trizeps', 'ruecken_oben', 'bauch']),
  'Ziehen horizontal': M(['ruecken_oben', 'lat'], ['bizeps', 'schultern']),
  'Ziehen vertikal': M(['lat'], ['bizeps', 'ruecken_oben', 'unterarme']),
  'Core': M(['bauch', 'seitbauch'], ['unterer_ruecken']),
  'Fuß & Reha': M(['fuss', 'waden']),
  'Arme & Schultern': M(['bizeps'], ['unterarme']),
  'Ganzkörper & Hybrid': M(['gesaess', 'quadrizeps'], ['schultern', 'bauch']),
  'Ausdauer': M(['quadrizeps'], ['waden']),
  'Mobilität': M([]),
};
const MUSCLE_OVERRIDES = {
  'liegestuetze': M(['brust'], ['trizeps', 'schultern', 'bauch']),
  'liegestuetz-griff': M(['brust'], ['trizeps', 'schultern', 'bauch']),
  'curls-kh': M(['bizeps'], ['unterarme']),
  'seitheben': M(['schultern']),
  'face-pulls': M(['schultern', 'ruecken_oben']),
  'trizeps-kabel': M(['trizeps']),
  'farmers-carry': M(['unterarme', 'ruecken_oben'], ['seitbauch', 'bauch', 'waden']),
  'offset-carry': M(['seitbauch', 'unterarme'], ['ruecken_oben', 'schultern']),
  'suitcase-carry': M(['seitbauch', 'unterarme'], ['ruecken_oben']),
  'ski-erg': M(['lat', 'trizeps'], ['bauch', 'schultern']),
  'burpees': M(['brust', 'quadrizeps'], ['schultern', 'bauch']),
  'kh-snatch': M(['gesaess', 'schultern'], ['beinbeuger', 'ruecken_oben']),
  'wall-balls': M(['quadrizeps', 'schultern'], ['gesaess']),
  'schlitten': M(['quadrizeps', 'gesaess'], ['waden']),
  'sandbag-lunges': M(['quadrizeps', 'gesaess'], ['seitbauch']),
  'ausfall-atw': M(['quadrizeps', 'gesaess'], ['seitbauch', 'schultern']),
  'kb-around': M(['seitbauch', 'schultern'], ['bauch']),
  'stuetz-ruder': M(['bauch', 'ruecken_oben'], ['seitbauch']),
  'seitstuetz': M(['seitbauch'], ['schultern']),
  'pallof': M(['seitbauch', 'bauch']),
  'leg-raises': M(['bauch'], ['unterarme']),
  'waden-1': M(['waden'], ['fuss']),
  'einbeinstand': M(['fuss'], ['waden', 'gesaess']),
  'monster-walk': M(['gesaess'], ['fuss']),
  'glute-bridge': M(['gesaess'], ['beinbeuger']),
  'hip-thrust': M(['gesaess'], ['beinbeuger']),
  'rudergeraet': M(['ruecken_oben', 'quadrizeps'], ['lat', 'beinbeuger']),
  'seilspringen': M(['waden', 'fuss']),
  'rudern-band': M(['ruecken_oben'], ['bizeps']),
  'schulter-kh-steh': M(['schultern'], ['trizeps', 'bauch']),
  'nordic': M(['beinbeuger']), 'beinbeuger-geraet': M(['beinbeuger']),
  'kb-clean': M(['gesaess', 'beinbeuger'], ['ruecken_oben', 'unterarme']),
  'dips': M(['brust', 'trizeps'], ['schultern']), 'bank-dips': M(['trizeps'], ['schultern']),
  'hammer': M(['bizeps', 'unterarme']), 'wand-handstand': M(['schultern'], ['trizeps', 'bauch']),
  'landmine': M(['schultern', 'brust'], ['trizeps', 'seitbauch']),
  'australian': M(['ruecken_oben', 'lat'], ['bizeps', 'bauch']),
  'bird-dog': M(['unterer_ruecken', 'gesaess'], ['bauch']), 'hollow': M(['bauch']),
  'copenhagen': M(['seitbauch'], ['gesaess']), 'ab-wheel': M(['bauch'], ['lat', 'schultern']),
  'shoulder-taps': M(['bauch', 'seitbauch'], ['schultern']),
  'tibialis': M(['fuss']), 'short-foot': M(['fuss']), 'pogo': M(['waden', 'fuss']),
  'exz-waden': M(['waden'], ['fuss']), 'knie-wand': M(['fuss'], ['waden']),
  'thruster': M(['quadrizeps', 'schultern'], ['gesaess', 'trizeps']),
  'kb-clean-press': M(['gesaess', 'schultern'], ['beinbeuger', 'trizeps', 'seitbauch']),
  'tgu': M(['schultern', 'seitbauch'], ['gesaess', 'bauch']),
  'broad-jumps': M(['quadrizeps', 'gesaess'], ['waden', 'brust']),
  'sled-pull': M(['ruecken_oben', 'beinbeuger'], ['unterarme', 'gesaess']),
  'box-jumps': M(['quadrizeps', 'gesaess'], ['waden']),
  'mountain-climbers': M(['bauch'], ['schultern', 'quadrizeps']),
  'bear-crawl': M(['schultern', 'bauch'], ['quadrizeps']),
  'wall-sit': M(['quadrizeps']), 'sl-bridge': M(['gesaess'], ['beinbeuger']),
  'box-pistol': M(['quadrizeps', 'gesaess'], ['waden', 'seitbauch']),
  'trapbar': M(['gesaess', 'quadrizeps'], ['beinbeuger', 'unterer_ruecken', 'ruecken_oben', 'unterarme']),
  'pull-through': M(['seitbauch', 'bauch'], ['schultern', 'ruecken_oben']),
  'kb-finisher': M(['schultern', 'bizeps'], ['seitbauch', 'bauch', 'lat', 'trizeps']),
  'russian-twist': M(['seitbauch'], ['bauch']),
  'kb-halo': M(['schultern'], ['seitbauch', 'trizeps']),
  'kb-pullover': M(['lat', 'schultern'], ['bauch', 'trizeps']),
  'kb-curl': M(['bizeps'], ['unterarme']),
};
export function musclesOf(ex) {
  return MUSCLE_OVERRIDES[ex.id] || ex.muscles || GROUP_MUSCLES[ex.group] || M([]);
}
