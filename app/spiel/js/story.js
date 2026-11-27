// Geschichte, Erinnerungen und Texte von „Und täglich grüßt der Löwe“.

export const LOOP_START = 11 * 3600 + 55 * 60; // 11:55:00
export const LOOP_LEN = 300;                    // 5 Minuten
export const VAN_TIME = 60;                     // 11:56:00
export const THIEF_TIME = 210;                  // 11:58:30
export const CODE = '5050';

// Erinnerungen bleiben über alle Schleifen erhalten
export const MEMORIES = {
  blitz: 'Um 12:00 blitzt es im Westen – und alles beginnt um 11:55 am Hauptbahnhof von vorn.',
  eule: 'Till Eulenspiegel (Brunnen am Bäckerklint) erinnert sich auch. Sein Tipp: Um 11:56 fährt ein grauer Lieferwagen vom Burgplatz los.',
  tor2: 'Der Lieferwagen verschwindet im Tor 2 der PTB, ganz im Westen an der Bundesallee.',
  zettel: 'Zettel aus dem Lieferwagen: „Tor 2 – Code = Gauß’ Lieblingssumme (1 bis 100)“.',
  code: 'Am Gauß-Denkmal gelöst: 1 + 2 + … + 100 = 5050.',
  ptb: 'Dr. Sekunde (PTB): Atomuhr synchronisieren UND dem Täter den Funkauslöser abnehmen – beides in derselben Schleife.',
  kalle: 'Kalle Klau taucht um 11:58:30 am Burglöwen auf. Zu Fuß kriegt man ihn – vor Autos springt er weg.',
  fern: 'Kalle geschnappt, aber die Atomuhr war nicht synchron. Erst zur PTB, dann zu Kalle!',
};

// Aktuelles Ziel aus den Erinnerungen ableiten → { text, target: Spot-Name | 'van' | 'thief' }
export function objective(mem, loop) {
  if (loop.won) return { text: 'Geschafft! Fahr frei herum oder liefere Pakete aus.', target: null };
  if (loop.synced) return { text: 'Uhr ist synchron! Schnapp dir Kalle am Burglöwen (ab 11:58:30) – zu Fuß!', target: loop.thief ? 'thief' : 'loewe' };
  if (!mem.blitz) return { text: 'Triff Jonas um 12:00 am Burglöwen.', target: 'loewe' };
  if (!mem.eule) return { text: 'Was war das?! Vielleicht weiß der Narr am Eulenspiegelbrunnen mehr.', target: 'eule' };
  if (mem.code && mem.ptb) return { text: 'Erst Atomuhr synchronisieren (PTB, Code 5050), dann Kalle am Burglöwen schnappen.', target: 'ptb' };
  if (mem.code) return { text: 'Code 5050 – ab zur PTB, Tor 2, ganz im Westen!', target: 'ptb' };
  if (mem.zettel) return { text: '„Gauß’ Lieblingssumme“? Das Gauß-Denkmal steht am Gaußberg im Südwesten.', target: 'gauss' };
  if (loop.vanCaught) return { text: 'Durchsuch den Lieferwagen!', target: 'van' };
  if (mem.tor2) return { text: 'Ramm den Lieferwagen 3×, bevor er in der PTB verschwindet – vielleicht hat der Fahrer den Code dabei.', target: loop.van ? 'van' : 'loewe' };
  return { text: 'Um 11:56 fährt der Lieferwagen vom Burgplatz los. Halt ihn auf: 3× rammen!', target: loop.van ? 'van' : 'loewe' };
}

export const INTRO = [
  { name: 'Braunschweig, 11:55 Uhr', text: 'Ein ganz normaler Tag am Hauptbahnhof. Dein Handy vibriert.' },
  { name: 'Jonas', text: '„Treffen um 12 am Burglöwen! Und sei pünktlich, du Schnarchnase 🦁“' },
  { name: 'Tipp', text: 'Der Pfeil am Bildschirmrand und die Karte unten rechts zeigen dir dein Ziel. Autos stehen am Bahnhof genug herum – einsteigen mit E.' },
];

export const FIRST_LOOP = [
  { name: '12:00 Uhr', text: 'Ein greller Blitz aus dem Westen …' },
  { name: '11:55 Uhr?!', text: 'Du stehst wieder am Hauptbahnhof. Die Uhr zeigt 11:55. Dein Handy vibriert – dieselbe Nachricht von Jonas.' },
  { name: 'Moment mal', text: 'Du steckst in einer Zeitschleife! Alles, was du herausfindest, merkst du dir trotzdem: Erinnerungen mit Tab (Controller: Dreieck).' },
];

// Till Eulenspiegel
export function tillTalk(mem, loop) {
  const T = 'Till Eulenspiegel';
  if (loop.won) return [{ name: T, text: 'Du hast es geschafft! Endlich gibt’s wieder ein Morgen. Ich werd’s mit Unsinn füllen.' }];
  if (!mem.blitz) return [{ name: T, text: 'Moin! Till Eulenspiegel, Narr von Beruf. Du willst zum Löwen? Dann geh doch hin, der kommt ja nicht zu dir. Obwohl … heute weiß man nie. Sprich mich nach zwölf nochmal an.' }];
  if (!mem.eule) return [
    { name: T, text: 'Du auch?! Endlich! Ich dachte schon, ich bin der Einzige, der sich an jede Runde erinnert. Ich häng hier seit 347 Schleifen fest.' },
    { name: T, text: 'Als Narr nehm ich nix ernst – wahrscheinlich hat mich die Zeit deshalb vergessen. Hehe.' },
    { name: T, text: 'Hör zu: Jedes Mal um 11:56 fährt ein grauer Lieferwagen vom Burgplatz los. „Löwen-Logistik“ steht drauf. Der ist mir nicht geheuer.' },
    { name: T, text: 'Halt ihn auf! Drei beherzte Stupser mit einem Auto sollten reichen. Und guck auf die Uhr oben – die tickt!', memory: 'eule' },
  ];
  if (loop.synced) return [{ name: T, text: 'Die Uhr ist synchron? Dann nix wie zum Löwen! Kalle ist flink, aber zu Fuß kriegst du ihn. Im Auto springt er dir weg wie ein Floh.' }];
  if (mem.ptb) return [{ name: T, text: 'Uhr synchronisieren UND Kalle den Auslöser abnehmen – in einer Runde. Ich drück dir die Narrenkappe.' }];
  if (mem.code) return [{ name: T, text: '5050? Klingt wie die Wahrscheinlichkeit, dass ich heute ernst bleibe. Ab zur PTB, ganz im Westen, Tor 2!' }];
  if (mem.zettel) return [{ name: T, text: '„Gauß’ Lieblingssumme“? Der kleine Carl Friedrich hat in der Schule mal alle Zahlen von 1 bis 100 zusammengezählt – in Sekunden! Am Gauß-Denkmal im Südwesten steht’s bestimmt.' }];
  if (mem.tor2) return [{ name: T, text: 'Ins PTB-Tor 2 ist er gefahren? Da kommst du nur mit Code rein. Ich wette, der Fahrer hat ihn sich aufgeschrieben – so einer merkt sich nix. Ramm ihn, bevor er ankommt!' }];
  return [{ name: T, text: 'Na? Der Lieferwagen, 11:56, Burgplatz. Drei kräftige Stupser! Und wenn’s nicht klappt: Morgen ist auch noch heute.' }];
}
export const TILL_JOKES = [
  'Ein Bäcker hier am Klint wollte mal, dass ich „Eulen und Meerkatzen“ backe. Hab ich gemacht – aus Teig. Er war nicht begeistert. Wörtlich nehmen ist eine Kunst!',
  'Weißt du, warum ich bergauf lache und bergab weine? Bergab weiß ich schon, dass es gleich wieder bergauf geht. Wie in der Schleife.',
  'Ich hab heute schon 347-mal „Guten Morgen“ gesagt. Und es war jedes Mal gelogen – es ist ja Mittag.',
  'Rat mal, wie spät es ist. Richtig: gleich wieder 11:55.',
  'Wenn dir einer sagt, „geh mir aus den Augen“, dann stell dich hinter ihn. Hat bei mir immer funktioniert.',
  'Die Okerumflut ist wie die Zeitschleife: Man fährt im Kreis und kommt trotzdem nirgends an.',
];

// Infotexte an Orten
export const SPOT_INFO = {
  loewe: [{ name: 'Burglöwe', text: 'Heinrich der Löwe ließ ihn um 1166 aufstellen – als Zeichen seiner Macht. Psst: Das hier ist eine Kopie. Das Original steht nebenan in der Burg Dankwarderode.' }],
  dom: [{ name: 'Dom St. Blasii', text: 'Hier liegen Heinrich der Löwe und seine Frau Mathilde begraben. Ziemlich ruhig für einen Löwen.' }],
  schloss: [{ name: 'Residenzschloss', text: 'Vorne Schloss, hinten Einkaufszentrum. Oben drauf eine riesige Quadriga: vier Pferde, null Parkplatzprobleme.' }],
  rizzi: [{ name: 'Happy-Rizzi-Haus', text: 'Bunt, schief, fröhlich – entworfen vom Pop-Art-Künstler James Rizzi. Hier kann selbst eine Zeitschleife nicht schlecht gelaunt machen.' }],
  altrathaus: [{ name: 'Altstadtmarkt', text: 'Das Altstadtrathaus – Gotik vom Feinsten und ein paar Jahrhunderte älter als deine Zeitschleife.' }],
  magni: [{ name: 'Magniviertel', text: 'Fachwerk, Kopfsteinpflaster, kleine Cafés. Wer hier hetzt, ist selbst schuld. Du hetzt. Du bist selbst schuld.' }],
  hbf: [{ name: 'Hauptbahnhof', text: 'Dein Startpunkt. Immer. Wieder. Immer wieder.' }],
  stadion: [{ name: 'Eintracht-Stadion', text: 'Von drinnen hört man „Eintracht! Eintracht!“ – obwohl gar kein Spiel ist. Vielleicht auch eine Zeitschleife.' }],
  burg: [{ name: 'Burg Dankwarderode', text: 'Hier drin steht der echte Burglöwe aus Bronze. Gut bewacht – sagen sie.' }],
};

export const GAUSS_TEXT = [
  { name: 'Gauß-Denkmal', text: 'Carl Friedrich Gauß, geboren 1777 in Braunschweig, der „Fürst der Mathematiker“. Auf dem Sockel eine Gravur:' },
];
export const GAUSS_QUESTION = 'Wie viel ist 1 + 2 + 3 + … + 100?';
export const GAUSS_HINT = 'Tipp: 1 + 100 = 101, 2 + 99 = 101, 3 + 98 = 101 … Wie viele solcher Paare gibt es?';

export const PTB_TEXT = [{ name: 'PTB, Tor 2', text: 'Physikalisch-Technische Bundesanstalt. Hier ticken die Atomuhren, nach denen sich ganz Deutschland richtet. Am Tor ein Tastenfeld: „Code eingeben“.' }];
export const PTB_FIRST = [
  { name: 'Tor 2', text: 'Bzzzt – das Tor öffnet sich. Eine Frau im weißen Kittel kommt angerannt.' },
  { name: 'Dr. Hertha Sekunde', text: 'Sie kennen den Code? Moment … Sie erinnern sich auch an die Schleife?!' },
  { name: 'Dr. Hertha Sekunde', text: 'Jemand hat unsere Atomuhr manipuliert: Ein Funkauslöser setzt um Punkt 12 die Zeit zurück. Immer wieder. Immer wieder.' },
  { name: 'Dr. Hertha Sekunde', text: 'Ich kann die Uhr neu synchronisieren. Helfen Sie mir: Drücken Sie genau dann, wenn der Zeiger im grünen Feld ist. Dreimal!' },
];
export const PTB_AGAIN = [{ name: 'Dr. Hertha Sekunde', text: 'Sie schon wieder? Ich glaub’s Ihnen ja. Los, synchronisieren!' }];
export const PTB_DONE_FIRST = [
  { name: 'Dr. Hertha Sekunde', text: 'Perfekt synchron! Jetzt fehlt nur noch der Auslöser. Laut Peilung schaltet sich der Sender um 11:58:30 am Burglöwen ein.' },
  { name: 'Dr. Hertha Sekunde', text: 'Nehmen Sie ihn dem Täter ab, bevor es zwölf ist – in DIESER Schleife. Sonst ist die Synchronisation futsch.', memory: 'ptb' },
];
export const PTB_DONE_AGAIN = [{ name: 'Dr. Hertha Sekunde', text: 'Synchron! Burglöwe, 11:58:30 – schnell!' }];

export const VAN_CAUGHT = [{ name: 'Kalle Klau', text: '„Ihr kriegt mich nie! Um zwölf ist eh alles vergessen!“ – Der Fahrer springt raus und flitzt davon.' }];
export const VAN_SEARCH = [
  { name: 'Lieferwagen', text: 'Hinten im Laderaum: ein leerer Holzsockel mit Löwen-Pfotenabdrücken. Verdächtig.' },
  { name: 'Lieferwagen', text: 'Im Handschuhfach ein Zettel: „Tor 2 – Code = Gauß’ Lieblingssumme (1 bis 100). Bin schlecht in Mathe, drum aufgeschrieben.“', memory: 'zettel' },
];
export const VAN_SEARCH_AGAIN = [{ name: 'Lieferwagen', text: 'Wieder derselbe Zettel: „Code = Gauß’ Lieblingssumme“. Kalle lernt auch nix dazu.' }];

export const THIEF_UNSYNCED = [
  { name: 'Kalle Klau', text: 'He, lass los! … Ach, egal. Ohne synchronisierte Uhr springt eh alles zurück. Hehe!' },
  { name: 'Kalle Klau', text: 'Er reißt sich los und verschwindet in der Menge.', memory: 'fern' },
];
export const WIN = [
  { name: 'Kalle Klau', text: 'Nein! Mein schöner Auslöser!' },
  { name: '11:59 Uhr', text: 'Du drückst auf „Aus“. Ein leises Piepen. Irgendwo in der PTB jubelt Dr. Sekunde.' },
  { name: 'Kalle Klau', text: 'Ich wollte doch nur den Löwen klauen! Jede Runde hab ich’s versucht, aber das Ding ist SCHWER.' },
  { name: '12:00 Uhr', text: 'Die Turmuhren schlagen zwölf. Kein Blitz. Kein Hauptbahnhof. Nur Mittag.' },
  { name: 'Jonas', text: 'Da bist du ja! Pünktlich wie die Atomuhr. … Warum guckst du so? Und wer ist der Typ?' },
];

export const PED_SHOUT = ['Hömma!', 'Pass doch auf!', 'Ey!', 'Fußgängerzone!', 'Spinnst du?', 'Mein Spargel!', 'Rowdy!', 'Hallo?!'];
export const PED_IDLE = ['Moin!', 'Eintracht!', 'Schietwetter heute.', 'Gleich Mittagspause.', 'Wo ist hier Aldi?', 'Löwen, Löwen!', 'Schon wieder Baustelle…', 'Kennst du Till?'];
export const HIJACK = ['Ey! Mein Auto!', 'Halt! Dieb!', 'Das ist ein Leasingwagen!', 'Ich ruf das Ordnungsamt!'];
export const THIEF_TAUNT = ['Hehe!', 'Fang mich doch!', 'Gleich ist wieder 11:55!', 'Zu langsam!'];
export const AMT_LINES = [
  '„Fußgängerzone heißt FUSS-gängerzone!“',
  '„Das gibt eine Belehrung. Eine lange.“',
  '„Haben Sie das Schild nicht gesehen? Welches Schild? Na eben!“',
];

// Kurier-Aufträge („Okerkurier“)
export const PARCELS = [
  'eine Kiste Mumme', 'Braunschweiger Mettwurst', 'frischen Spargel', 'einen Eintracht-Schal',
  'ein Löwen-Plüschtier', 'Gauß’ vergessene Hausaufgaben', 'ein Tretboot-Ersatzpedal',
  'eine Narrenkappe für Till', 'eine Torte vom Bäckerklint', 'einen Stadtplan (veraltet)',
];
export const COURIER_SPOTS = ['altrathaus', 'schloss', 'rizzi', 'magni', 'dom', 'hbf', 'stadion', 'prinz', 'buerger', 'kohlmarkt', 'burg', 'gauss'];
