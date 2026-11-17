# 🐭 Die Milzmäuse – Einrichtung

Dauer: ca. 30–45 Minuten, einmalig. Du brauchst nur einen Browser.
**Passwörter und geheime Schlüssel nie in den Chat mit Claude schreiben.**

---

## 1. Supabase (Datenbank, Login, Live-Sync)

1. Auf **supabase.com** → *Start your project* → mit GitHub anmelden (oder E-Mail).
2. **New project**:
   - Name: `milzmaeuse`
   - Database Password: *Generate* klicken und im Passwortmanager speichern (brauchst du im Alltag nicht)
   - Region: **Central EU (Frankfurt)**
   - Plan: Free
3. Warten, bis das Projekt bereit ist (1–2 Min.).
4. Links **SQL Editor** → *New query* → den kompletten Inhalt von `supabase/schema.sql` einfügen → **Run**.
   Es sollte „Success. No rows returned“ erscheinen.
5. Links **Authentication → Sign In / Providers → Email**:
   - *Enable Email provider*: an
   - *Confirm email*: **aus** (dann seid ihr nach „Konto anlegen“ sofort drin, ohne Bestätigungsmail –
     die kostenlose Supabase-Mail schafft nur wenige Mails pro Stunde)
   - Speichern. E-Mail-Vorlagen müsst ihr **nicht** anpassen.
6. *(später, wenn ihr beide drin seid)*: unter **Authentication → Sign In / Providers** die Option
   *Allow new users to sign up* ausschalten – dann kann sich niemand Fremdes mehr registrieren.
7. **Project Settings → API Keys** (bzw. *API*): Kopiere
   - die **Project URL** (`https://….supabase.co`)
   - den **Publishable key** (beginnt mit `sb_publishable_`) – *oder* bei älteren Projekten den **anon public** Key.
   ⚠️ Den **secret / service_role** Key niemals verwenden.
8. Beide Werte in `app/config.js` eintragen (oder Claude sagen „trag die Supabase-Werte ein“ und sie
   dann selbst in die Datei kopieren – der Publishable Key ist nicht geheim, das ist okay).

## 2. GitHub (Code + Hosting)

1. Konto auf **github.com** anlegen.
2. **GitHub Desktop** installieren (desktop.github.com) und mit dem Konto anmelden.
3. In GitHub Desktop: *File → Add local repository* → `C:\Users\andre\Projekte\milzmaeuse` wählen →
   „create a repository“ bestätigen → **Publish repository**.
   - Haken bei *Keep this code private* **entfernen**: GitHub Pages funktioniert bei kostenlosen
     Konten nur mit öffentlichen Repos (siehe Hinweis unten).
4. Auf github.com im Repo: **Settings → Pages → Source: GitHub Actions**.
5. Nach dem nächsten Hochladen (*Push origin* in GitHub Desktop) baut GitHub die App.
   Unter **Actions** siehst du den Fortschritt, danach ist sie erreichbar unter
   `https://DEIN-NAME.github.io/milzmaeuse/`.

> **Öffentlich oder privat?** Im Repo liegt nur der App-Code, keine eurer Daten – die stecken
> geschützt in Supabase. Ein öffentliches Repo ist deshalb unbedenklich. Wer es trotzdem privat will:
> statt GitHub Pages kostenlos **Cloudflare Pages** oder **Netlify** mit dem Ordner `app` verbinden.

## 3. Supabase die App-Adresse mitteilen

**Authentication → URL Configuration**:
- *Site URL*: `https://DEIN-NAME.github.io/milzmaeuse/`

## 4. Auf die Handys bringen

**Android (Püßmaus):** Adresse in Chrome öffnen → Menü ⋮ → *Zum Startbildschirm hinzufügen / App installieren*.

**iPhone (Müßmaus):** Adresse in **Safari** öffnen → Teilen-Symbol → *Zum Home-Bildschirm*.
Dann die App **vom Home-Bildschirm** starten (nicht in Safari weiterbenutzen).

**Erster Start:**
1. Püßmaus: *Konto anlegen* → E-Mail + eigenes Passwort → „Püßmaus“ → *Neuer Haushalt*.
2. Im **Mauseloch → Einstellungen** steht der **Einladungscode**.
3. Müßmaus: *Konto anlegen* → E-Mail + eigenes Passwort → „Müßmaus“ → *Mit Code beitreten* → Einladungscode eingeben.
Fertig – ab jetzt ist alles live geteilt. 🧀

---

## Später: Neue Funktionen

Claude Code im Ordner `milzmaeuse` öffnen und beschreiben, was ihr wollt. Danach in GitHub Desktop
*Commit* + *Push origin* – ein paar Minuten später haben beide Handys die neue Version.
Datenbank-Änderungen kommen als zusätzliche SQL-Datei in `supabase/` und werden einmal im SQL Editor
ausgeführt; eure Daten bleiben dabei erhalten.

## Ausprobieren ohne Konten

Solange `app/config.js` leer ist, läuft die App im **Demo-Modus**: Daten bleiben nur auf dem Gerät,
und oben kann man zwischen Püß und Müß wechseln, um beide Sichten zu testen.
