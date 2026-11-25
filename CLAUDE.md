# Die Milzmäuse – Haushalts-App

Gemeinsame Haushalts-App für ein Paar: **Püßmaus** (André, Android) und **Müßmaus** (Frau, iPhone).
Baby kommt im Juni 2027. Sprache der App: Deutsch, verspielt mit Mäuse-Wortspielen (nicht zu albern).

## Status
- `entwurf/index.html`: ursprünglicher Design-Entwurf (statisch, nur Referenz).
- **MVP in `app/`** (fertig, getestet im Demo-Modus): Login per E-Mail + Passwort (E-Mail-Vorlagen sind im Supabase-Free-Plan ohne eigenes SMTP nicht editierbar, daher kein OTP-Code; "Confirm email" aus), Haushalt gründen/beitreten (Einladungscode), Heute, Aufgaben + Gamification + Lob + Danke-Pfote, Käseladen/Wochenziel, Einkaufsliste (Gang-Erkennung), Vorrat (knapp → Liste, kochbar), Mauseloch-Infos, Tagebuch, Baby-Checkliste, Geburtstermin.
- Live unter https://abo2704.github.io/milzmaeuse/ (Supabase-Projekt azcsltcyybjpiflbnrhe). Deploy: Nutzer committet + pusht per GitHub Desktop.
- Verträge-Modul (`js/contracts.js`, Tabelle aus `supabase/002_vertraege.sql`): Fristberechnung, Mausefalle auf "Heute", .ics-Download, Wechselhilfe + Kündigungsvorlage. Fehlt die Tabelle, zeigt die App einen Hinweis statt abzustürzen (`OPTIONAL` in `loadAll`).
- Folgeaufgaben (`supabase/003_folgeaufgaben.sql`): `tasks.next_task_id`, `chained` (wartet auf Vorgänger; wartend = `done_at` gesetzt), `after_days`. Wäsche waschen (beide) → aufhängen (Müßmaus) → abhängen (Püßmaus, +1 Tag). Partner-Push nennt "Jetzt bist du dran".
- Pinnwand + Rezeptbox (`supabase/004_pinnwand_rezepte.sql`): Mauseloch hat Reiter (Pinnwand/Infos/Verträge/Tagebuch/Baby). Ideen mit Kategorien (inkl. Anschaffungen), Status idee/geplant/erledigt, "Pfote drauf" (`paws` text[]), → Aufgabe / → Tagebuch, "Idee der Woche" auf Heute.
- Rezeptbox im neuen Tab "Futter": Import über Edge Function `supabase/functions/recipe-import` (liest schema.org/Recipe JSON-LD; KptnCook-Teilen-Links leiten auf app.kptncook.com weiter, die Seite liefert JSON-LD mit Zutaten, aber ohne Nährwerte – keine inoffizielle API nötig). `js/recipes.js`: Zutaten parsen, auf 4 Portionen skalieren, Vorratsabgleich, Eiweiß-Schätzung über eigene Tabelle, 🤰-Hinweise. Android-Share-Target im Manifest; iOS: Link einfügen. "Gekocht" zieht Vorrat ab und gibt +15 🧀. Gespeichert werden nur Zutaten + Link, keine Kochschritte.
- Noch offen: echte Push-Benachrichtigungen bei geschlossener App (Supabase Edge Function + Web Push/VAPID), Kalender-Abo statt Einzel-.ics, Futter/Rezepte-Modul.

## Aufbau `app/`
- Kein Build-Schritt, kein Node nötig: Vanilla-JS-Module, supabase-js per CDN (gepinnt). Hosting: GitHub Pages via `.github/workflows/pages.yml` (veröffentlicht den Ordner `app/`).
- `config.js` leer → Demo-Modus (localStorage, Püß/Müß umschaltbar). `?demo` in der URL erzwingt Demo.
- `js/db.js` gleiche Schnittstelle für Supabase und Demo. `js/main.js` UI-Logik. `js/seed.js` Startdaten (werden beim Gründen eingefügt). `js/texts.js` Sprüche, Level, Gang-Erkennung.
- DB-Schema: `supabase/schema.sql` (RLS über `my_household()`). Spätere Änderungen als neue Datei `supabase/NNN_*.sql`, nie das Ursprungsskript ändern.
- Bei App-Änderungen `VERSION` in `app/sw.js` UND `APP_VERSION` in `app/js/main.js` hochzählen (Version steht unten im Mauseloch – hilft beim Prüfen, ob ein Handy aktuell ist). SW holt eigene Dateien mit `cache:'no-cache'` (GitHub Pages cached 10 Min.) und lädt bei neuer Version einmal automatisch neu.
- Lokal testen: `powershell -File .claude/serve.ps1 -Root app -Port 5180` → http://localhost:5180
- Kein Git installiert; Nutzer verwendet GitHub Desktop.
- Haushalts-App und Kraftkladde werden in getrennten Sessions im selben Repo gebaut → vor neuer Arbeit in GitHub Desktop „Fetch/Pull origin“; jede Session fasst nur ihren Bereich an (`app/` ohne `kraft/` bzw. `app/kraft/`). Versionskonflikte (v-Nummern) beim Merge: höhere Nummer +1 für beide Stellen.
- Android-Share-Target der Haushalts-App: `share_target.action` = `./index.html` (muss im `scope` liegen).

## Technik-Entscheidungen
- PWA (eine Codebasis für Android + iOS, Push ab iOS 16.4 bei Home-Bildschirm-Installation).
- Hosting: GitHub Pages. Backend: Supabase (Region Frankfurt) für DB, Magic-Link-Login, Realtime, Edge Functions (Web-Push, Kalender-ICS-Feed, Rezept-Link-Import).
- Keine laufenden Kosten: keine bezahlte KI-API. Rezepte = Startpool (~150, von Claude erzeugt) + Link-Import (schema.org/Recipe) + Rotationslogik.
- Erinnerungen: Püßmaus Push + Kalendereintrag (ICS-Abo), Müßmaus nur Push.

## Module
Heute · Aufgaben (Gamification) · Einkauf + Vorratskammer · Futter (Essensplanung) · Mauseloch (Infos, Tagebuch, Verträge, Baby-Checkliste)

## Fachliche Vorgaben
- Gamification kooperativ: Punkte = Käse 🧀, gemeinsames Wochenziel → selbst definierte Belohnung (Kaffee, Pizza, Restaurant). Streaks ("Tapser"), Level, Statistiken. Kein Wettkampf-Fokus.
- Nach erledigter Aufgabe: scherzhaft-übertriebenes Lob für den Erledigenden + Push an den Partner ("Was für eine Spitzenmaus…") mit "Danke-Pfote"-Reaktion.
- Schwangerschaftsmodus: schwere/chemische Aufgaben → Püßmaus; Rezepte schwangerschaftssicher (kein Rohmilchkäse, roher Fisch/Fleisch, Leber).
- Eiweißziele: Püßmaus 108 g/Tag (72 kg × 1,5), Müßmaus 90 g/Tag (60 kg × 1,5). Wenig Fleisch, sonst alles.
- Abendessen für 4–5 Portionen kochen (Reste = Mittagessen zum Mitnehmen).
- Einkauf meist Aldi (sonst Rewe/Edeka), Liste nach Gängen sortiert.
- Vorrat: Bestand + Mindestmenge → "wird knapp" → auf Einkaufsliste; "aus dem Vorrat kochbar". Abgehakte Einkäufe füllen den Vorrat auf.
- Verträge: Strom, Gas, Internet, Hausrat, Haftpflicht (gemeinsam) + personenbezogene (Handy, Amazon Prime), filterbar. Kündigungsfristen → Erinnerungen + Wechselhilfe.
- Erlebnistagebuch "Mäuse-Momente" mit "Heute vor einem Monat".
- Keine Vertragsnummern/Zugangsdaten in Chat oder Code; Daten nur in Supabase, Schlüssel nie committen.

# Kraftkladde – Trainings-App (André persönlich)

Eigene PWA in `app/kraft/` → live unter https://abo2704.github.io/milzmaeuse/kraft/ (wird mit `app/` veröffentlicht).
Bauplan: `docs/kraftkladde-steckbrief.md` (Stufe 1 fertig; nächste: Workout-Timer, Coach, Ziele/Strava, Extras).
- André ist primär Läufer (Garmin/Strava), macht Ganzkörper-Kraft (8–12 Wdh.) + Hybrid (Deadly Dozen, evtl. Hyrox).
- Nur für André, **keine Supabase-Anbindung**: Daten in localStorage (`kraftkladde-v2`), Backup/Restore JSON + CSV-Export. Repo ist öffentlich → **keine persönlichen Trainingsdaten committen**.
- Datenmodell: Übung `{group (Bewegungsmuster), equip (lh/kh/kb/ma/kg/band/cardio/sonst), fields}`; fields aus `w` kg, `r` Wdh., `d` m, `t` s, `c` kcal, `b` Miniband-Index (BANDS); leere Liste = nur abhaken. `equip:'kg'` → Gewicht = Zusatzgewicht (leer = Körpergewicht), kein 1RM/Volumen. Kurzhantel = kg pro Hand.
- Routine = Plätze `{slot, studio, home, sets, link}` (link = Supersatz mit nächstem Platz). Training `{kind: kraft|hybrid|lauf, location: studio|home, entries[{exId, fields, group (Supersatz-ID), slot, sets}]}`; `untracked` = Termin ohne Details; Läufe `run:{km, sec}`; `estimates` = geschätzte Monate.
- Supersatz: Pause erst nach der letzten Übung der Runde, sonst Sprung zur nächsten Übung.
- Stangengewicht: Übung `bar` (kg, nur equip `lh`). Gespeichert wird immer das **Gesamtgewicht** `w`; im Training zeigen Eingabe, Platzhalter und „Vorher“ nur die Scheiben (`w − bar`). Beim Ändern von `bar` optional alle bisherigen Einträge um die Differenz verschieben.
- Neue Seed-Routinen werden beim Laden nachgezogen (`removedSeedTpls` merkt gelöschte); unveränderte Seed-Routinen werden bei höherer `v` ersetzt (`edited` schützt eigene Änderungen). Nicht bearbeitete Seed-Übungen bekommen Name/Notiz/Stange aktuell (`edited` bei Formular/„als Standard“).
- Plätze können `alts` (Alternativen) haben; `multi` = mehrere gleichzeitig. Im Training Schalterzeile unter der ersten Übung des Platzes (`slotKey`): ohne `multi` tauschen, mit `multi` hinzufügen/entfernen → automatisch Zirkel (Gruppe `c-<slotKey>`, Pause nach der Runde).
- „Ganzkörper Kern“ (v3): Trap Bar (Stange 20) · Schrägbank KH + Klimmzüge (Supersatz) · Military (Stange 20; Alt.: KH-Schulterdrücken stehend/sitzend) · Core kombinierbar (Plank Pull-Through, Käfer, Russian Twist) · Finisher als Zirkel aus Kettlebell Halo, Überzug im Stehen, Kettlebell-Curls (je eigene kg/Wdh.) · Fuß.
- Gym-Run-Import (`js/import.js`): Satzart steht in Spalte **Book** (1 Gewicht, 6 Körpergewicht, 3 Zeit/Strecke in Min./km); Klimmzüge minus Körpergewicht, Kurzhantel ÷2 (per Seed `importHalve`/`importBodyweight`, in Vorschau umschaltbar); Supersätze aus zeitlicher Verzahnung erkannt.
- Übungswissen (`js/knowledge.js`): Wissenskarte je Seed-Übung (c Technik, f Fehler, l Läufer-Nutzen, e/h leichter/schwerer als IDs, optional rec); `recommendation()` leitet sonst aus Muster/Gerät ab. Neue Seed-Übungen immer mit Karte + ggf. `MUSCLE_OVERRIDES` anlegen (Prüfskript: alle IDs haben Karte, Verweise existieren).
- Dateien: `js/app.js` UI, `js/store.js`, `js/exercises.js` (113 Seeds mit Gym-Run-Aliasen, Muskeln), `js/stats.js`, `js/chart.js`, `js/import.js`, `js/util.js`.
- Design: Grafit + Salbei/Waldgrün; Gold nur für Rekorde. Arten-Farben `--k-kraft/--k-hybrid/--k-lauf` = Aqua/Orange/Blau aus der validierten Referenzpalette (dataviz-Skill, CVD-geprüft) – nicht durch Salbei-Töne ersetzen (Grün/Orange war für Rot-Grün-Schwäche nicht unterscheidbar).
- Fortschritt-Tab (`js/progress.js`): Konstanz (gestapelte Balken, Wochenziel `settings.weeklyGoal`, geschätzte Monate schraffiert), Kraftindex (Ø relative Steigerung der Hauptkennzahl je Übung), größte Steigerungen, Bewegungsmuster + Verhältnisse, Balance-Hinweise (Drücken/Ziehen, Knie/Hüfte, einbeinig, seitlicher Rumpf, Gesäß, Waden/Fuß), Muskelkarte (Zuordnung `musclesOf()` in `exercises.js`: Hauptmuskel 1, Hilfsmuskel ½). Kein 1RM bei Körpergewicht, Core, Fuß/Reha, Mobilität, Ausdauer.
- Intervall-Timer (`js/timer.js` Zeitplan, UI in `app.js`): Plan `{rounds:[s…], change, rest, prep}` an Routine (`timer`) oder spontan (`active.timerPlan`). Jede Übung = Station, jede Runde = Satz (Label R1/R2). Laufzeit über Zeitstempel (`active.timer.startedAt/pausedTotal`), abgeschlossene Belastungen tragen `t` + letztes Gewicht ein und haken ab; Wdh. trägt André nach. Ton/Vibration, Sprachansage (`settings.voice`). Kein Pausen-Timer bei Timer-Trainings. Cardio-Tausch per Alternativen-Schalter ändert alle gleichen, noch nicht gemachten Stationen.
- Coach (`js/coach.js` Regeln, Quellen `SOURCES`, Recherche in `docs/kraftkladde-coach-quellen.md`): doppelte Progression (`suggest`: Bereich 8–12, KB 8–15, Arme 10–15; Gewichtssprung je Gerät; Neuansetzen übers 1RM bei Bereichswechsel), schwere Phase 4–6 Wdh. nur für equip `lh` (`settings.coach.heavy`), Pausen `restFor` (Grundübungen 2–3 Min.), Wochenvolumen je Muskel (Richtwert 10), Fuß-Status 0–10 beim Start (`workout.foot`, > 5 → `FOOT_SWAP`), Knie-zur-Wand-Test (`D.mobility`, Ziel 12,7 cm), Gleichgewichtswochen, Rumpf-Check (McGill), Beschwerden → Nachbargelenke (`COMPLAINTS`). Jeder Hinweis zeigt „Prinzip … ↗“. Inhalte in eigenen Worten, nie als Aussage von Horschig/KRAFTWOHL ausgeben.
- Bei Änderungen `VERSION` in `app/kraft/sw.js` UND `APP_VERSION` in `app/kraft/js/app.js` hochzählen.
- Der Service Worker der Haushalts-App ignoriert `/kraft/` und löscht nur `mm-`-Caches (Kraftkladde nutzt `kk-`).
- Zwei installierbare Apps auf einer Domain: Manifeste mit fester `id` (`/milzmaeuse/` bzw. `/milzmaeuse/kraft/`); Haushalts-App hat `start_url`/`scope` = `./index.html`, damit `/kraft/` nicht in ihrem Bereich liegt (sonst ersetzt/übernimmt Android die App). Diese Werte nicht ändern.
