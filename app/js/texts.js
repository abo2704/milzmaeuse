// Sprüche, Level & Einkaufs-Gänge. Hier darf jederzeit nachgewürzt werden 🧀

export const pick = a => a[Math.floor(Math.random() * a.length)];
// Gleicher Spruch für den ganzen Tag (flackert nicht bei Live-Updates), morgen ein neuer
export function daily(a, salt = '') {
  const s = new Date().toLocaleDateString('sv-SE') + salt; let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return a[Math.abs(h) % a.length];
}

// Begrüßung oben, {n} = Name
export const GREET = {
  morgens: ['Mausgeschlafen, {n}? ☀️', 'Moin {n} 🐾', 'Guten Morgen, du Frühaufsteh-Maus! ☕', 'Piep piep, {n}! Neuer Tag, neuer Käse 🧀', 'Raus aus dem Mauseloch, {n}! 🌤️'],
  tags: ['Moin {n} 🐾', 'Na, du Spitzenmaus? 🐭', 'Schön, dass du da bist, {n} 🧀', 'Servus, Schnurrhaar! 👋', 'Alles mausgezeichnet, {n}?', 'Hallo {n}, alles im grünen Käse? 🧀'],
  abends: ['Feierabend im Mausbau, {n} 🌙', 'Na, {n}, mausemüde? 😴', 'Guten Abend, Abendmäuschen 🌆', 'Zeit fürs Mäusekino, {n} 🍿', 'Pfoten hoch, {n}, du hast es dir verdient 🛋️'],
  nachts: ['Psst, {n}, alle Mäuschen schlafen schon 🌜', 'Nachtmaus {n} unterwegs 🦉', 'Mäuschenstille im Bau, {n} 🤫'],
};
export function greeting(n) {
  const h = new Date().getHours();
  const a = h < 5 || h >= 23 ? GREET.nachts : h < 11 ? GREET.morgens : h < 18 ? GREET.tags : GREET.abends;
  return daily(a, 'g' + h).replaceAll('{n}', n);
}

// Leere Listen: lieber ein Witz als gähnende Leere
export const EMPTY = {
  today: ['Alles erledigt. Mäuschenstill! 😴', 'Nix mehr fällig. Pfoten hochlegen! 🛋️', 'Heute ist alles weggenagt. Mausgezeichnet! ✨', 'Leer gefegt, und zwar mausblank. 🧹', 'Keine Aufgaben mehr. Ab ins Mäusekino! 🍿'],
  tasks: ['Nichts fällig. Mäuschenstill! 😴', 'Alles weggenagt, bis auf den letzten Krümel. 🧀', 'Hier gibt es gerade nichts zu tun. Mausgezeichnet! ✨', 'Piepegal, was kommt: Gerade ist alles geschafft. 🐭'],
  none: ['Keine Aufgaben hier.', 'Hier ist es mausleer. 🕳️'],
  future: ['Dieser Tag kommt erst noch. 🐭', 'Die Zukunft ist noch käsefrei. 🔮'],
  pastDay: ['An diesem Tag war Mäuschenstille. 😴', 'Ruhetag im Mausbau. Auch Mäuse brauchen Pause. 🛌', 'Da hat keine Maus einen Finger gerührt. Auch mal schön. 😌'],
  week: ['Diese Woche ist noch nichts erledigt. Zeit für einen Quick Win! ⚡', 'Noch kein Käse diese Woche. Der Mäusezahn wartet schon hungrig. 🦷', 'Die Woche ist noch jung, die Mäuse noch frisch. Auf geht\'s! 🐾'],
  shop: ['Liste ist leer. Der Kühlschrank lacht dich an. 🧀', 'Nichts zu kaufen. Da beißt die Maus keinen Faden ab. 🧵', 'Alles da! Die Speisekammer ist mausgesättigt. 😋', 'Keine Einkäufe. Das spart Mäuse! 💶'],
  stockOk: ['Alles gut gefüllt. Die Vorratskammer ist mäuserich! 🐭', 'Nichts wird knapp. Hier lebt man wie die Made, äh, Maus im Speck. 🥓', 'Vorräte bis unters Mauseloch. Mausgezeichnet! ✨'],
  stock: ['Noch nichts im Vorrat. Die Kammer ist so leer wie ein Mauseloch ohne Maus.', 'Noch nichts im Vorrat. Oben auf „+ Neu“ tippen und Hamstern, äh, Mausern beginnen. 🐹'],
  rewards: ['Noch keine Belohnungen. Wofür nagt ihr denn so fleißig? 🧀'],
  contracts: ['Noch keine Verträge. Oben antippen und loslegen. Hier geht es um eure Mäuse! 💶'],
  ideas: ['Noch keine offenen Ideen. Was wolltet ihr schon immer mal machen? 💡', 'Die Pinnwand ist leer. Zeit für ein paar Mausideen! 💡', 'Keine Ideen? Ach du dickes Mäuschen! Pinnt was an. 📌'],
  recipes: ['Noch keine Rezepte. Teile eins aus KptnCook oder füge einen Link ein. 🍳', 'Die Rezeptbox ist mausleer. Zeit für Futter-Nachschub! 🍳'],
  diary: ['Noch keine Momente. Der erste schöne Moment wartet schon! ✨', 'Das Tagebuch ist noch blank. Schreibt eure erste Mausgeschichte! 📖'],
  baby: ['Alles erledigt. Mini-Maus kann kommen! 👶', 'Checkliste leer, Mäuseschühchen bereit. Mini-Maus, wir sind so weit! 👟'],
};

// Kurze Rückmeldungen
export const TOAST = {
  undo: ['Rückgängig gemacht. Passiert den besten Mäusen.', 'Zurückgespult. Kleiner Mausrutscher, kein Ding. 🐭', 'Rückgängig. Auch Spitzenmäuse verklicken sich mal.'],
  cartDone: ['Alles im Korb! Ab nach Hause, Mäuse 🐭', 'Einkauf komplett. Mausgezeichnet eingekauft! 🛒', 'Alles drin! Jetzt flott zurück ins Mauseloch. 🏃'],
  onList: ['Steht schon auf der Liste 👍', 'Schon notiert. Doppelt hält nicht besser, nur voller. 😉'],
  redeemed: ['🎉 Eingelöst! Viel Spaß, ihr Mäuse!', '🎉 Eingelöst! Lasst es euch mauswohl ergehen!', '🎉 Eingelöst! Ihr habt euch das so was von ernagt!'],
  diary: ['📖 Moment festgehalten', '📖 Für die Ewigkeit notiert. Mausgezeichnet!', '📖 Ab ins Mäuse-Archiv damit'],
  baby: ['👶 Abgehakt! Mini-Maus wäre stolz.', '👶 Abgehakt! Ein Mäuseschühchen näher am großen Tag.', '👶 Erledigt! Die Elternmäuse sind mausbereit.'],
  thanks: ['💛 Danke-Pfote an {n} verschickt (+2 🧀)', '💛 Pfötchen-Dank ist bei {n} unterwegs (+2 🧀)', '💛 Ein dickes Mausküsschen für {n} (+2 🧀)'],
  gotThanks: ['💛 {n} hat dir eine Danke-Pfote geschickt!', '💛 Pfötchen-Post von {n}: Danke!', '💛 {n} findet dich mausgezeichnet. Danke-Pfote!'],
  goal: ['Neues Wochenziel: {r}', 'Neues Wochenziel: {r}. Mäuse, nagt los! 🦷', 'Neues Wochenziel: {r}. Der Käse ist gesetzt! 🧀'],
  error: ['Hoppla: ', 'Ach du dickes Mäuschen: ', 'Da hat es im Gebälk gepiept: '],
};

// "Während du weg warst"
export const AWAY = ['Was für eine Spitzenmaus!', 'Da bist du ja ganz aus dem Mäuschen, oder?', 'Mausgezeichnet, oder?', 'Fleißig wie ein Mäusezahn im Käselaib.', 'Da kann man nur den Schnurrbart ziehen.'];

// Wochenziel-Untertitel
export const GOAL_REACHED = ['Ziel erreicht! 🎉 Tippen zum Einlösen', 'Ganz aus dem Mäuschen: Ziel erreicht! 🎉 Tippen zum Einlösen', 'Mausgezeichnet, Ziel geknackt! 🎉 Tippen zum Einlösen'];
export const GOAL_REDEEMED = ['Eingelöst ✓ Genießt es!', 'Eingelöst ✓ Lasst es euch schmecken, ihr Mäuse!', 'Eingelöst ✓ Ihr habt es euch ernagt!'];

// {t} = Aufgabe, {me} = wer es erledigt hat
export const PRAISE = [
  ['🏆', 'Historischer Moment!', '„{t}“ ist erledigt. Historiker werden später von diesem Tag erzählen.'],
  ['📈', 'Breaking News', '{me} hat „{t}“ erledigt. Die Käsebörse reagiert euphorisch.'],
  ['👑', 'Maus des Moments', 'Bei „{t}“ hast du Profi-Arbeit abgeliefert. Die Krone steht dir.'],
  ['🐭', 'Respekt aus dem Untergrund', 'Selbst die Wollmäuse unterm Sofa ziehen den Hut. „{t}“: erledigt.'],
  ['🧀', 'Käse-Imperium', 'Wenn Fleiß Käse wäre, wärst du nach „{t}“ ein Emmentaler-Großkonzern.'],
  ['🎺', 'Tusch, bitte!', '„{t}“ erledigt. Irgendwo spielt gerade ein kleines Mäuseorchester nur für dich.'],
  ['🏅', 'Das Komitee tagt', 'Das Komitee für außergewöhnliche Mäuseleistungen prüft eine Medaille für „{t}“.'],
  ['✨', 'Mausgezeichnet!', '„{t}“? Erledigt. Mit einer Eleganz, von der andere Mäuse nur träumen.'],
  ['📸', 'Fürs Familienalbum', 'Dieser Moment, in dem du „{t}“ erledigt hast, gehört eingerahmt.'],
  ['🎉', 'Ganz aus dem Mäuschen!', '„{t}“ ist erledigt, und der ganze Mausbau steht kopf vor Freude.'],
  ['🦷', 'Biss bewiesen', 'Mit Mäusezahn-Präzision hast du dich durch „{t}“ genagt.'],
  ['👟', 'Große Mäuseschuhe', 'Nach „{t}“ müssen andere erst mal in deine Mäuseschuhe reinwachsen.'],
  ['🌸', 'Du hast dich gemausert', 'Von der Hausmaus zur Heldenmaus in einer Aufgabe: „{t}“ ✔️'],
  ['🧵', 'Da beißt die Maus keinen Faden ab', '„{t}“ ist erledigt. Punkt. Ende. Mausgezeichnet.'],
  ['🎯', 'Auf das Schnurrhaar genau', '„{t}“ erledigt, präzise bis in die Schwanzspitze.'],
  ['🍀', 'Maus gehabt!', 'Wer mit dir zusammenwohnt, hat echt Maus gehabt. „{t}“: erledigt.'],
  ['📰', 'Nager-Nachrichten', 'Exklusiv: {me} erledigt „{t}“. Die Käseblätter drucken Sonderausgaben.'],
  ['🎬', 'Ganz großes Mäusekino', '„{t}“ erledigt. Das war Oscar-reif. Popcorn für alle!'],
  ['💪', 'Kleine Maus, große Wirkung', 'Wer hätte gedacht, dass so viel Kraft in einer Maus steckt? „{t}“ ✔️'],
  ['🧀', 'Käsehoch-Leistung', 'Für „{t}“ gibt es eine Extraportion Respekt. Und Käse.'],
  ['🕵️', 'Mäuschen gespielt', 'Wir haben heimlich zugeschaut: „{t}“ war eine glatte Eins mit Sternchen.'],
  ['🥇', 'Mausterschüler*in', 'Lehrbuchreif! „{t}“ wird ab sofort an der Mäuse-Akademie unterrichtet.'],
  ['🎈', 'Piep, piep, hurra!', '„{t}“ ist erledigt. Der Mausbau feiert mit Luftschlangen.'],
  ['🐾', 'Pfotenabdruck hinterlassen', 'Nach „{t}“ hast du dir einen Stern auf dem Mäuse-Walk-of-Fame verdient.'],
  ['🧹', 'Nagelneu, äh, nagerneu', 'Nach „{t}“ glänzt hier alles wie frisch genagt.'],
  ['🏰', 'Hoheitlicher Erlass', 'Die Käsekönigin verkündet: Für „{t}“ gilt ab heute ein Feiertag zu deinen Ehren.'],
];
export const PRAISE_BIG = [
  ['🦸', 'Superheld*in im Haushalt', '„{t}“! Das war kein Haushalt mehr, das war Hochleistungssport.'],
  ['🏟️', 'Standing Ovations', 'Für „{t}“ erhebt sich das gesamte Mäusestadion von den Sitzen.'],
  ['🚀', 'Mausimum erreicht!', '„{t}“! Mehr geht nicht. Die Wissenschaft rätselt noch, wie du das geschafft hast.'],
  ['🌋', 'Ein Mammut-Mäusejob', '„{t}“ war eigentlich ein Job für zehn Mäuse. Du hast es allein gestemmt.'],
  ['🏛️', 'Ins Mäusemuseum damit', '„{t}“ wird als Meisterwerk ausgestellt. Eintritt: ein Stück Käse.'],
];
export const PARTNER = [
  'Kurze Info: Du wohnst mit einer absoluten Spitzenmaus zusammen. {me} hat gerade „{t}“ erledigt. 💛',
  '{me} hat „{t}“ erledigt. Eine Danke-Pfote wäre jetzt sehr angemessen. 🐾',
  'Glückwunsch! Deine {me} ist heute in Höchstform: „{t}“ ✔️',
  'Was für ein Fang! {me} hat „{t}“ einfach so erledigt. Du hast echt Glück. 😌',
  'Eilmeldung aus dem Mausbau: „{t}“ ist erledigt, und zwar von {me}. Applaus! 👏',
  'Du wirst ganz aus dem Mäuschen sein: {me} hat „{t}“ erledigt! 🎉',
  'Mausgezeichnete Nachrichten: „{t}“ ist erledigt. Gezeichnet, {me}. ✍️',
  '{me} hat sich zur Spitzenmaus gemausert: „{t}“ ✔️ Ein Pfötchen-Dank wäre schön. 🐾',
  'Psst, Mäuschen gespielt: {me} hat gerade heimlich „{t}“ erledigt. 🕵️',
  'Maus gehabt! Deine {me} hat „{t}“ für euch beide erledigt. 🍀',
  'Nager-Nachrichten: „{t}“ ist durch. {me} nimmt Glückwünsche in Käseform entgegen. 🧀',
  '{me} ist heute in Mäuseschuhen unterwegs, die drei Nummern zu groß sind: „{t}“ erledigt! 👟',
];
export const OVERDUE = [
  'Das ist ja zum Mäusemelken …', 'Die Wollmäuse werden langsam frech.', 'Piep. Das wartet schon eine Weile.',
  'Hier nagt der Zahn der Zeit. Oder war es ein Mäusezahn? 🦷', 'Da schnappt gleich die Mausefalle zu. 🪤',
  'Die Wollmäuse gründen schon einen Verein.', 'Graue Mäuse werden hier langsam grauer.',
];

export const fill = (s, t, meName) => s.replaceAll('{t}', t).replaceAll('{me}', meName);

export const LEVELS = [
  [0, 'Mäusezähnchen'], [100, 'Hausmaus'], [300, 'Putzmunter-Maus'], [700, 'Meistermaus'],
  [1500, 'Mausterhafte Maus'], [3000, 'Legendäre Großmaus'], [6000, 'Käsekönigliche Hoheit'], [10000, 'Mausimum'],
];
export function levelOf(points) {
  let i = 0; while (i + 1 < LEVELS.length && points >= LEVELS[i + 1][0]) i++;
  const [from, name] = LEVELS[i];
  const next = LEVELS[i + 1];
  return { n: i + 1, name, next: next?.[1], toNext: next ? next[0] - points : 0, pct: next ? (points - from) / (next[0] - from) : 1 };
}

// Reihenfolge wie bei einem typischen Aldi-Rundgang
export const AISLES = ['Obst & Gemüse', 'Brot & Backwaren', 'Kühlregal', 'Fleisch & Fisch', 'Tiefkühl', 'Trockenware', 'Konserven', 'Süßes & Snacks', 'Getränke', 'Drogerie & Haushalt', 'Sonstiges'];
// Prüf-Reihenfolge: spezifische Gänge zuerst (z. B. "TK-Spinat" → Tiefkühl, "Passierte Tomaten" → Konserven)
const KEYWORDS = {
  'Tiefkühl': 'tk tiefkühl tiefkühlpizza eiscreme',
  'Konserven': 'dose kichererbsen bohnen kidney mais passierte tomatenmark kokosmilch',
  'Drogerie & Haushalt': 'klopapier toilettenpapier zahnpasta shampoo duschgel spülmittel waschmittel müllbeutel küchenrolle tabs windel feuchttücher',
  'Obst & Gemüse': 'apfel äpfel banane birne orange zitrone limette beere traube kiwi mango avocado tomate gurke paprika zucchini aubergine karotte möhre zwiebel knoblauch kartoffel süßkartoffel salat spinat brokkoli blumenkohl kohl lauch porree pilz champignon ingwer kräuter petersilie basilikum radieschen sellerie kürbis',
  'Brot & Backwaren': 'brot brötchen toast baguette wrap tortilla knäcke',
  'Kühlregal': 'milch joghurt skyr quark käse feta mozzarella butter sahne schmand frischkäse eier ei tofu hummus hüttenkäse aufschnitt',
  'Fleisch & Fisch': 'hähnchen huhn pute rind hack schwein lachs fisch thunfisch garnelen wurst schinken',
  'Trockenware': 'nudel vollkornnudel pasta spaghetti reis linsen haferflocken mehl zucker müsli couscous bulgur quinoa nüsse mandel samen öl essig gewürz salz pfeffer brühe',
  'Süßes & Snacks': 'schoko keks chips gummi riegel kuchen',
  'Getränke': 'wasser saft tee kaffee limo bier wein sprudel',
};
export function guessAisle(name) {
  const tokens = name.toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
  // kurze Wörter nur am Wortanfang ("ei" soll nicht "Reis" treffen), lange auch mittendrin ("Babyspinat")
  const hit = w => tokens.some(t => t.startsWith(w) || (w.length >= 5 && t.includes(w)));
  for (const [a, words] of Object.entries(KEYWORDS)) if (words.split(' ').some(hit)) return a;
  return 'Sonstiges';
}
