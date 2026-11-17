// Sprüche, Level & Einkaufs-Gänge. Hier darf jederzeit nachgewürzt werden 🧀

export const pick = a => a[Math.floor(Math.random() * a.length)];

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
];
export const PRAISE_BIG = [
  ['🦸', 'Superheld*in im Haushalt', '„{t}“! Das war kein Haushalt mehr, das war Hochleistungssport.'],
  ['🏟️', 'Standing Ovations', 'Für „{t}“ erhebt sich das gesamte Mäusestadion von den Sitzen.'],
];
export const PARTNER = [
  'Kurze Info: Du wohnst mit einer absoluten Spitzenmaus zusammen. {me} hat gerade „{t}“ erledigt. 💛',
  '{me} hat „{t}“ erledigt. Eine Danke-Pfote wäre jetzt sehr angemessen. 🐾',
  'Glückwunsch! Deine {me} ist heute in Höchstform: „{t}“ ✔️',
  'Was für ein Fang! {me} hat „{t}“ einfach so erledigt. Du hast echt Glück. 😌',
  'Eilmeldung aus dem Mausbau: „{t}“ ist erledigt, und zwar von {me}. Applaus! 👏',
];
export const OVERDUE = ['Das ist ja zum Mäusemelken …', 'Die Wollmäuse werden langsam frech.', 'Piep. Das wartet schon eine Weile.'];

export const fill = (s, t, meName) => s.replaceAll('{t}', t).replaceAll('{me}', meName);

export const LEVELS = [
  [0, 'Babymaus'], [100, 'Hausmaus'], [300, 'Putzmunter-Maus'], [700, 'Meistermaus'],
  [1500, 'Mausterhafte Maus'], [3000, 'Legendäre Großmaus'], [6000, 'Käsekönigliche Hoheit'],
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
