// Verträge: Fristberechnung, Kalenderdatei (.ics) und Wechselhilfe.
// Hinweis: allgemeine Infos, keine Rechtsberatung – im Zweifel die Vertragsunterlagen prüfen.

export const CATS = {
  strom: { e: '⚡', n: 'Strom', help: 'energie', def: { notice_months: 1, renewal_months: 0 } },
  gas: { e: '🔥', n: 'Gas', help: 'energie', def: { notice_months: 1, renewal_months: 0 } },
  internet: { e: '🌐', n: 'Internet', help: 'tk', def: { notice_months: 1, renewal_months: 0 } },
  handy: { e: '📱', n: 'Handyvertrag', help: 'tk', def: { notice_months: 1, renewal_months: 0 } },
  hausrat: { e: '🛋️', n: 'Hausrat', help: 'vers', def: { notice_months: 3, renewal_months: 12, billing: 'jahr' } },
  haftpflicht: { e: '🛡️', n: 'Haftpflicht', help: 'vers', def: { notice_months: 3, renewal_months: 12, billing: 'jahr' } },
  versicherung: { e: '☂️', n: 'Andere Versicherung', help: 'vers', def: { notice_months: 3, renewal_months: 12, billing: 'jahr' } },
  kfz: { e: '🚗', n: 'Kfz-Versicherung', help: 'kfz', def: { notice_months: 1, renewal_months: 12, billing: 'jahr' } },
  streaming: { e: '📺', n: 'Streaming / Abo', help: 'abo', def: { notice_months: 0, renewal_months: 0 } },
  sonstiges: { e: '📄', n: 'Sonstiges', help: 'abo', def: {} },
};
export const QUICK = [
  ['strom', 'Strom'], ['gas', 'Gas'], ['internet', 'Internet'], ['hausrat', 'Hausrat'], ['haftpflicht', 'Haftpflicht'],
  ['handy', 'Handyvertrag'], ['streaming', 'Amazon Prime'],
];

const ymd = d => d.toLocaleDateString('sv-SE');
const parse = s => new Date(s + 'T00:00:00');
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }; // sommerzeitsicher
export function addMonths(s, n) {
  const d = parse(s), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return ymd(d);
}
export const monthly = c => Number(c.cost || 0) / ({ monat: 1, quartal: 3, jahr: 12 }[c.billing] || 1);

// Liefert { kind, end, deadline, remind, days } – days = Tage bis zur Kündigungsfrist
export function contractStatus(c, today = ymd(new Date())) {
  if (!c.end_date) return { kind: 'unknown' };
  let end = c.end_date;
  const dl = e => addMonths(e, -Number(c.notice_months || 0));
  if (dl(end) < today) {
    if (!Number(c.renewal_months)) return { kind: 'flex', end }; // nach Mindestlaufzeit jederzeit kündbar
    while (dl(end) < today) end = addMonths(end, Number(c.renewal_months));
  }
  const deadline = dl(end);
  const days = Math.round((parse(deadline) - parse(today)) / 864e5);
  const remind = addDays(deadline, -Number(c.remind_weeks || 6) * 7);
  return { kind: days <= Number(c.remind_weeks || 6) * 7 ? 'trap' : days <= 90 ? 'soon' : 'ok', end, deadline, remind, days };
}
const fmt = s => parse(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
export function statusTag(c) {
  const s = contractStatus(c);
  if (s.kind === 'unknown') return ['', 'Laufzeit eintragen'];
  if (s.kind === 'flex') return ['green', Number(c.notice_months) ? `kündbar mit ${c.notice_months} Mon. Frist` : 'jederzeit kündbar'];
  if (s.kind === 'trap') return ['red', `🪤 kündbar bis ${fmt(s.deadline)}`];
  if (s.kind === 'soon') return ['cheese', `Frist ${fmt(s.deadline)}`];
  return ['green', `läuft bis ${fmt(s.end)}`];
}
export { fmt as fmtDate };

// ---------- Kalender (.ics) ----------
const icsEsc = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
const icsDay = s => s.replaceAll('-', '');
export function contractIcs(c) {
  const s = contractStatus(c);
  if (!s.deadline) return null;
  const today = ymd(new Date());
  const ev = (date, title, desc, uid) => [
    'BEGIN:VEVENT', `UID:${uid}@milzmaeuse`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${icsDay(date)}`, `DTEND;VALUE=DATE:${icsDay(addDays(date, 1))}`,
    `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'TRIGGER:PT9H', 'END:VALARM', 'END:VEVENT',
  ];
  const name = `${c.name}${c.provider ? ' (' + c.provider + ')' : ''}`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Die Milzmaeuse//DE', 'CALSCALE:GREGORIAN'];
  if (s.remind > today) lines.push(...ev(s.remind, `🐭 ${name}: Wechsel prüfen`, `Kündigungsfrist endet am ${fmt(s.deadline)}. Jetzt Tarife vergleichen – Wechselhilfe in der Milzmäuse-App.`, `${c.id}-remind-${s.deadline}`));
  lines.push(...ev(s.deadline, `🪤 Letzter Tag: ${name} kündigen`, `Heute endet die Kündigungsfrist für ${name}. Vertragsende: ${fmt(s.end)}.`, `${c.id}-deadline-${s.deadline}`));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ---------- Wechselhilfe ----------
const COMPARE = '<li>Vergleichen, z. B. bei <a href="https://www.check24.de" target="_blank" rel="noopener">Check24</a> oder <a href="https://www.verivox.de" target="_blank" rel="noopener">Verivox</a> – und das Ergebnis direkt beim Anbieter gegenprüfen.</li>';
export const HELP = {
  energie: `<h5>So wechselt ihr Strom/Gas entspannt</h5><ol>
    <li>Aktuellen Zählerstand und Jahresverbrauch (letzte Rechnung) bereitlegen.</li>
    ${COMPARE}
    <li>Filter setzen: Preisgarantie ≥ 12 Monate, Laufzeit ≤ 12 Monate, <b>keine Vorkasse/Kaution</b>. Einmal-Boni nicht überbewerten – auf den Preis im 2. Jahr schauen.</li>
    <li>Beim neuen Anbieter abschließen – der kündigt den alten Vertrag meistens für euch.</li>
    <li>Bei <b>Preiserhöhung</b> habt ihr ein Sonderkündigungsrecht zum Zeitpunkt der Erhöhung.</li>
    <li>Schlussrechnung des alten Anbieters prüfen (Zählerstand, Guthaben).</li></ol>`,
  tk: `<h5>Internet & Handy wechseln</h5><ol>
    <li>Nach der Mindestlaufzeit sind neuere Verträge <b>monatlich kündbar</b> (1 Monat Frist).</li>
    ${COMPARE}
    <li>Beim Internet: Verfügbarkeit an eurer Adresse prüfen. Der neue Anbieter übernimmt meist den Wechsel inkl. Kündigung.</li>
    <li>Handynummer mitnehmen: Rufnummernmitnahme beim neuen Anbieter beantragen.</li>
    <li>Gekündigt wird online über den Button „Verträge hier kündigen“ auf der Anbieterseite.</li></ol>`,
  vers: `<h5>Versicherung prüfen & wechseln</h5><ol>
    <li>Kündigung meist zum Ende des Versicherungsjahres, Frist oft 1–3 Monate – steht im Versicherungsschein.</li>
    ${COMPARE}
    <li>Nicht nur Preis vergleichen: Deckungssumme, Selbstbeteiligung, Leistungen.</li>
    <li>👶 <b>Mit Baby:</b> Haftpflicht auf „Familie“ umstellen (Kind meist automatisch mitversichert – prüfen!). Hausrat: Versicherungssumme an Neuanschaffungen anpassen.</li>
    <li>Neuen Vertrag erst abschließen, dann den alten kündigen – keine Lücke riskieren.</li></ol>`,
  kfz: `<h5>Kfz-Versicherung</h5><ol>
    <li>Stichtag: meist Kündigung bis 30.11. zum Jahresende.</li>${COMPARE}
    <li>Sonderkündigungsrecht bei Beitragserhöhung oder nach Schadensfall.</li></ol>`,
  abo: `<h5>Abo kündigen</h5><ol>
    <li>Brauchen wir das wirklich noch? Ehrliche Mäuse-Frage. 🐭</li>
    <li>Online über „Verträge hier kündigen“ bzw. in den Kontoeinstellungen kündigen.</li>
    <li>Kündigungsbestätigung aufheben (Screenshot reicht).</li></ol>`,
};
export const letter = c => `Kündigung ${c.name}${c.provider ? ' bei ' + c.provider : ''}
${c.customer_no ? 'Kunden-/Vertragsnummer: ' + c.customer_no + '\n' : ''}
Sehr geehrte Damen und Herren,

hiermit kündige ich den oben genannten Vertrag fristgerecht zum nächstmöglichen Zeitpunkt.
Bitte bestätigen Sie mir die Kündigung sowie das Vertragsende schriftlich.

Mit freundlichen Grüßen`;
