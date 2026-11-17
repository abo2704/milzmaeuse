// Startdaten, die beim Gründen des Haushalts einmalig angelegt werden.
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };

export const SEED = {
  tasks: [
    { name: 'Spülmaschine ausräumen', points: 5, minutes: 4, assignee: 'b', repeat_days: 1, due: addDays(0) },
    { name: 'Müll & Altpapier raus', points: 5, minutes: 3, assignee: 'p', repeat_days: 3, due: addDays(0) },
    { name: 'Pflanzen gießen', points: 5, minutes: 3, assignee: 'm', repeat_days: 4, due: addDays(1) },
    { name: 'Kühlschrank & Vorrat checken', points: 5, minutes: 5, assignee: 'b', repeat_days: 7, due: addDays(2) },
    { name: 'Wäsche waschen', points: 10, minutes: 5, assignee: 'b', repeat_days: 3, due: addDays(0) },
    { name: 'Wäsche aufhängen', points: 10, minutes: 10, assignee: 'p', repeat_days: 3, due: addDays(0) },
    { name: 'Wäsche abhängen & falten', points: 10, minutes: 10, assignee: 'b', repeat_days: 3, due: addDays(1) },
    { name: 'Wohnung saugen', points: 20, minutes: 25, assignee: 'p', repeat_days: 7, due: addDays(2) },
    { name: 'Küche wischen', points: 15, minutes: 15, assignee: 'b', repeat_days: 7, due: addDays(3) },
    { name: 'Bad putzen', points: 30, minutes: 35, assignee: 'p', repeat_days: 7, due: addDays(4), heavy: true },
    { name: 'Bettwäsche wechseln', points: 15, minutes: 15, assignee: 'b', repeat_days: 14, due: addDays(5) },
    { name: 'Getränkekisten schleppen', points: 15, minutes: 10, assignee: 'p', repeat_days: 14, due: addDays(6), heavy: true },
  ],
  stock_items: [
    { name: 'Haferflocken', qty: 3, unit: 'Pck.', min_qty: 2, area: 'Trockenware' },
    { name: 'Rote Linsen', qty: 1, unit: 'Pck.', min_qty: 2, area: 'Trockenware' },
    { name: 'Reis', qty: 2, unit: 'Pck.', min_qty: 1, area: 'Trockenware' },
    { name: 'Vollkornnudeln', qty: 2, unit: 'Pck.', min_qty: 2, area: 'Trockenware' },
    { name: 'Kichererbsen', qty: 2, unit: 'Dosen', min_qty: 2, area: 'Konserven' },
    { name: 'Kidneybohnen', qty: 0, unit: 'Dosen', min_qty: 2, area: 'Konserven' },
    { name: 'Passierte Tomaten', qty: 2, unit: 'Pck.', min_qty: 2, area: 'Konserven' },
    { name: 'Kokosmilch', qty: 1, unit: 'Dosen', min_qty: 1, area: 'Konserven' },
    { name: 'Eier', qty: 6, unit: 'Stk.', min_qty: 6, area: 'Kühlschrank' },
    { name: 'Skyr', qty: 1, unit: 'Becher', min_qty: 3, area: 'Kühlschrank' },
    { name: 'Magerquark', qty: 1, unit: 'Becher', min_qty: 2, area: 'Kühlschrank' },
    { name: 'TK-Spinat', qty: 1, unit: 'Pck.', min_qty: 1, area: 'Tiefkühler' },
    { name: 'Toilettenpapier', qty: 6, unit: 'Rollen', min_qty: 4, area: 'Drogerie' },
  ],
  rewards: [
    { emoji: '☕', name: 'Kaffee trinken gehen', cost: 150 },
    { emoji: '🍕', name: 'Pizza / Essen bestellen', cost: 250 },
    { emoji: '🍽️', name: 'Restaurantbesuch', cost: 500 },
  ],
  baby_todos: [
    { sort: 1, name: 'Hebamme suchen', hint: 'Viele sind früh ausgebucht. Am besten jetzt anfragen.', due_label: 'jetzt!', urgent: true },
    { sort: 2, name: 'Geburtsklinik anschauen & anmelden', hint: 'Infoabende nutzen, Anmeldung meist ab der 20.–30. SSW', due_label: 'bis Feb.' },
    { sort: 3, name: 'Kita-Platz anmelden', hint: 'Wartelisten sind lang, Anmeldung oft schon vor der Geburt möglich', due_label: 'bald' },
    { sort: 4, name: 'Elternzeit beim Arbeitgeber beantragen', hint: 'spätestens 7 Wochen vor Beginn, schriftlich', due_label: 'bis April' },
    { sort: 5, name: 'Kinderarzt/-ärztin suchen', hint: 'U2 findet meist noch in der Klinik statt, ab U3 beim Kinderarzt', due_label: 'bis Mai' },
    { sort: 6, name: 'Erstausstattung planen', hint: 'Kinderwagen, Babyschale, Bettchen, Wickelplatz', due_label: 'bis April' },
    { sort: 7, name: 'Kliniktasche packen', hint: 'Mäuseschühchen nicht vergessen 👟', due_label: 'ab Mai' },
    { sort: 8, name: 'Elterngeld & Kindergeld vorbereiten', hint: 'Anträge nach der Geburt, Unterlagen vorher sammeln', due_label: 'vor Juni' },
  ],
  notes: [
    { emoji: '📶', title: 'WLAN für Gäste', body: 'Name & Passwort hier eintragen', pinned: true },
    { emoji: '🔑', title: 'Ersatzschlüssel', body: 'Wer hat welchen Schlüssel?' },
  ],
};

// Gerichte für "Aus dem Vorrat kochbar" (Namen müssen zu Vorratsartikeln passen).
// Wird mit dem Rezept-Modul später durch echte Rezepte ersetzt.
export const DISHES = [
  { e: '🍛', n: 'Linsen-Dal mit Spinat', p: 34, need: ['Rote Linsen', 'Kokosmilch', 'TK-Spinat', 'Passierte Tomaten'] },
  { e: '🍳', n: 'Shakshuka mit Kichererbsen', p: 29, need: ['Eier', 'Passierte Tomaten', 'Kichererbsen'] },
  { e: '🌶️', n: 'Chili sin Carne', p: 31, need: ['Kidneybohnen', 'Passierte Tomaten', 'Reis'] },
  { e: '🥣', n: 'Protein-Overnight-Oats', p: 30, need: ['Haferflocken', 'Skyr'] },
  { e: '🍝', n: 'Spinat-Nudeln mit Ei', p: 27, need: ['Vollkornnudeln', 'TK-Spinat', 'Eier'] },
  { e: '🥞', n: 'Quark-Haferflocken-Pfannkuchen', p: 32, need: ['Haferflocken', 'Magerquark', 'Eier'] },
];
