# Kraftkladde – Produkt-Steckbrief

**In einem Satz:** Persönliches Trainingsbuch für einen Läufer, der Kraft- und Hybridtraining macht – passt sich dem Ganzkörperplan an (Studio und Zuhause), ist in Sekunden ausgefüllt, führt durch Intervall-Workouts und sagt, wann gesteigert werden kann.

## Rahmen
- Nur für André, Android, 2–3 Kraft-/Hybrid-Einheiten pro Woche, Muskelaufbau 8–12 Wdh.
- Laufen: Primär Garmin + Strava (bleibt Hauptauswertung). Kladde zeigt das Gesamtbild.
- Daten nur auf dem Handy + Backup. Keine persönlichen Trainingsdaten im Repository (Repo ist öffentlich).
- Nicht-Ziele: Social, Ernährung, eigene Laufaufzeichnung.

## Stufe 1 – Kern
1. **Training = Blöcke** mit Format: Sätze · Supersatz (A1/A2, Pause nach der Runde) · Zirkel/Intervall.
2. **Plan mit Plätzen** (hüftdominant, kniedominant, Drücken/Ziehen vertikal/horizontal, Core, Fuß) – je Platz Studio- und Zuhause-Übung, beim Start „Studio/Zuhause“ wählen, Austausch per Tipp.
3. **Messwerte** frei kombinierbar: Gewicht (bei Körpergewichtsübungen „+ kg“, leer = Körpergewicht), Wdh., Strecke, Zeit, Kalorien, **Miniband** (leicht / mittel / schwer / sehr schwer / Läuferband), **„erledigt ✓“** (Fuß-Reha).
4. Kurzhantel-Gewichte **pro Hand**.
5. Schnelles Eintragen: Vorher-Werte als Vorschlag, ✓ übernimmt.
6. **Chronik**: Farben für Kraft, Hybrid, Lauf.
7. **Import Gym Run (CSV)**, Regeln:
   - Format: `;`-getrennt, Datum `TT.MM.JJJJ`, Dezimalpunkt; Spalten Weight/Reps/Duration (Min.)/Distance (km); Type 1 = Gewicht×Wdh., 6 = Körpergewicht×Wdh., 3 = Zeit/Strecke.
   - Klimmzüge: eingetragenes Gewicht = Körpergewicht (72 kg) + Zusatzgewicht → umrechnen in „+ kg“ (72/72,5 → 0, 80 → +8).
   - Kurzhantel-Übungen: Gewicht = beide Hanteln → durch 2 teilen (44 → 22 pro Hand).
   - Mehrere Einträge am selben Tag = ein Training; Routine-Name = Trainingsname („Supersatz …“ → Supersätze erkennen).
8. **Studio-Check-ins nachtragen** als „Training (nicht erfasst)“, damit die Chronik vollständig ist (Daten gibt André in der App ein).

## Stufe 2 – Workout-Timer
- Geführte Intervalle: Belastung / Wechsel / Rundenpause, Countdown groß, nächste Station sichtbar, Ton + Vibration, Bildschirm an.
- Vorlage **Deadly Dozen HIIT**: 10 Stationen × 1:30 Belastung, 10 s Wechsel → 2:00 Pause → 10 Stationen × 1:00.
  Beispiel-Stationen: Ski Erg · Deadlift 32 kg · Ski Erg · KH Drücken über Kopf 12,5 kg · Ski Erg · Ausfallschritt around the world 16 kg · Ski Erg · KH Snatches 12,5 kg · Ski Erg · Burpees.
- Erfasst wird v. a. das Gewicht pro Station (Ski Erg „auf Zeit“, Meter freiwillig). Fortschritt: „14 → 16 kg ↑“.

## Stufe 3 – Coach
- **Doppelte Progression 8–12:** alle Sätze bei 12 → mehr Gewicht, wieder ab 8. Sonst Vorschlag „letztes Mal 10-9-8, heute 10-10-9“.
  Schritte: Kurzhantel +2 kg (pro Hand) · Langhantel +2,5 kg · Kettlebell erst Wdh., dann nächste Kugel · Klimmzüge bis 12 Wdh., dann +2,5 kg · Miniband nächste Stufe · Fuß-Reha nie.
- **Pausenvorschlag:** Grundübungen 90–120 s, übrige 60–90 s, Core 45–60 s, Supersatz nach der Runde.
- **Wochenziel** über alle Sportarten, Serie in Wochen.

## Stufe 4 – Ziele & Laufen
- Countdown (Wettkampf oder Comeback-Ziel, z. B. „erster Lauf ohne Schmerzen“), Bestzeiten 5 km / Halbmarathon.
- Strava-Import über `activities.csv` (Strava → Einstellungen → Daten herunterladen). Später optional automatischer Abgleich über Strava-API + Supabase Edge Function.

## Stufe 5 – Extras
- Aufwärm-Tipps passend zum Tagesplan, Läufer-Fokus (Hüfte, Waden, Sprunggelenk). Kein Ersatz für Physio.
- Packliste (Studio / Zuhause), Monatsrückblick.

## Design
- Dunkles Grafit, viel Ruhe, große klare Zahlen. Akzent **Salbei/Waldgrün**. Leuchten nur bei Erfolgen (Rekord, Steigerung, Wochenziel).
- Motivation: Wochenziel-Ring, ↑-Pfeile bei Steigerung, Rekord-Moment, ein ehrlicher Satz nach dem Training – kein Konfetti-Overkill.

## Stand
- Prototyp in `app/kraft/` (flexible Messwerte, Routinen, Pausen-Timer, Stoppuhr, Rekorde, Diagramme, Backup) – wird nach diesem Steckbrief umgebaut.
