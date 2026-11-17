# Die Milzmäuse – Haushalts-App

Gemeinsame Haushalts-App für ein Paar: **Püßmaus** (André, Android) und **Müßmaus** (Frau, iPhone).
Baby kommt im Juni 2027. Sprache der App: Deutsch, verspielt mit Mäuse-Wortspielen (nicht zu albern).

## Status
- `entwurf/index.html`: ursprünglicher Design-Entwurf (statisch, nur Referenz).
- **MVP in `app/`** (fertig, getestet im Demo-Modus): Login per E-Mail + Passwort (E-Mail-Vorlagen sind im Supabase-Free-Plan ohne eigenes SMTP nicht editierbar, daher kein OTP-Code; "Confirm email" aus), Haushalt gründen/beitreten (Einladungscode), Heute, Aufgaben + Gamification + Lob + Danke-Pfote, Käseladen/Wochenziel, Einkaufsliste (Gang-Erkennung), Vorrat (knapp → Liste, kochbar), Mauseloch-Infos, Tagebuch, Baby-Checkliste, Geburtstermin.
- Live unter https://abo2704.github.io/milzmaeuse/ (Supabase-Projekt azcsltcyybjpiflbnrhe). Deploy: Nutzer committet + pusht per GitHub Desktop.
- Verträge-Modul (`js/contracts.js`, Tabelle aus `supabase/002_vertraege.sql`): Fristberechnung, Mausefalle auf "Heute", .ics-Download, Wechselhilfe + Kündigungsvorlage. Fehlt die Tabelle, zeigt die App einen Hinweis statt abzustürzen (`OPTIONAL` in `loadAll`).
- Noch offen: echte Push-Benachrichtigungen bei geschlossener App (Supabase Edge Function + Web Push/VAPID), Kalender-Abo statt Einzel-.ics, Futter/Rezepte-Modul.

## Aufbau `app/`
- Kein Build-Schritt, kein Node nötig: Vanilla-JS-Module, supabase-js per CDN (gepinnt). Hosting: GitHub Pages via `.github/workflows/pages.yml` (veröffentlicht den Ordner `app/`).
- `config.js` leer → Demo-Modus (localStorage, Püß/Müß umschaltbar). `?demo` in der URL erzwingt Demo.
- `js/db.js` gleiche Schnittstelle für Supabase und Demo. `js/main.js` UI-Logik. `js/seed.js` Startdaten (werden beim Gründen eingefügt). `js/texts.js` Sprüche, Level, Gang-Erkennung.
- DB-Schema: `supabase/schema.sql` (RLS über `my_household()`). Spätere Änderungen als neue Datei `supabase/NNN_*.sql`, nie das Ursprungsskript ändern.
- Bei App-Änderungen `VERSION` in `app/sw.js` hochzählen.
- Lokal testen: `powershell -File .claude/serve.ps1 -Root app -Port 5180` → http://localhost:5180
- Kein Git installiert; Nutzer verwendet GitHub Desktop.

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
