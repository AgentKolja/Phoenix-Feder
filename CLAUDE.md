# phoenix-feder.de – Hinweise für Claude

Statische Website von Nikolas Voth (Coaching, Achtsamkeit, Blog). Kein Framework, keine Abhängigkeiten:
`bauen.py` (nur Python-Standardbibliothek) erzeugt aus `inhalt/` den Ordner `docs/`, GitHub Actions
veröffentlicht ihn bei jedem Push auf `main` über GitHub Pages.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `einstellungen.json` | Name, Domain, Buchungslink (Cal.com), Web3Forms-Schlüssel, Social-Links |
| `inhalt/artikel/<slug>.html` | Ein Blogartikel. URL wird `/post/<slug>/` (entspricht den alten Wix-Adressen) |
| `inhalt/seiten/<name>.html` | Seiten. `index` → `/`, sonst `/<name>/`; `404` → `/404.html` |
| `inhalt/angebote.json` | Angebote mit Dauer, Preis, Text, Bild, optional eigenem Buchungslink |
| `inhalt/themen.json` | Die vier Themen (Slug, Titel, Essenz, Bild). Jedes bekommt eine Seite `/thema/<slug>/` |
| `inhalt/uebungen.json` | 54 Gewohnheiten, tägliche Aufgaben und Quests der Habitica-Challenge (Seite `/gewohnheiten/`, Impuls auf der Startseite) |
| `bilder/` | Nur WebP, immer als Paar `<name>-800.webp` + `<name>-1600.webp` |
| `stil.css`, `favicon.svg`, `schriften/` | Design, Icon, lokal gehostete Schriften |
| `kontakt.js` | Formular-Versand; füllt Anliegen/Nachricht aus `?anliegen=…&nachricht=…` vor |
| `seite.js` | Impuls für heute, Teilen-Knopf, Quests abhaken (localStorage), Sprungziele öffnen |
| `app/` | Web-App „Meine Routinen“ unter `/app/` (siehe unten) |
| `werkzeuge/habitica-import.py` | Habitica-CSV → `uebungen.json`, entfernt unbelegte Studienzahlen und persönliche Angebote |
| `werkzeuge/bild.py` | Bild vorbereiten (braucht `pip install pillow`) |
| `werkzeuge/wix-export.py` | Einmaliger Umzug von Wix, erledigt. Nicht erneut nötig |

Inhaltsdateien beginnen mit Kopfzeilen `schluessel: wert`, dann eine Zeile `---`, dann HTML.
Artikel: `titel`, `datum` (JJJJ-MM-TT), `sprache` (`de`/`en`), `beschreibung` (≤ 160 Zeichen, für Google
und Karten), `bild` (Name ohne Endung), `bildtext`, optional `entwurf: ja` (wird nicht gebaut).
Zusätzlich je Artikel: `thema` (Slug aus themen.json), `essenz` (2–4 Punkte, getrennt durch ` | `),
`uebung` (eine konkrete Übung), `frage` (Reflexionsfrage), `passend` (Slug einer Übung aus uebungen.json),
optional `titelbild: nein` (Bild nur für Karten/Vorschau). Essenz, Übung und Frage in der Sprache des Artikels
und nah am Text – nichts hinzuerfinden. Der Build bricht ab, wenn `thema` oder `passend` nicht existieren.
Seiten: `titel`, `beschreibung`, optional `bild`, `indexieren: nein`.

Bausteine in Seiten: `{{angebote}}`, `{{neueste_artikel}}`, `{{alle_artikel}}`, `{{kontakt}}` bzw.
`{{kontakt Habitica-Challenge}}` (mit Vorauswahl), `{{impuls}}`, `{{themen}}`, `{{themen_chips}}`, `{{uebungen}}`,
`{{habitica_url}}`, `{{buchung_url}}`, `{{name}}`, `{{autor}}`, `{{bild name "Alt-Text" "klasse" "eager"}}`
(`{{bild …}}` geht auch in Artikeln).

Ausrichtung: Die Seite stellt Achtsamkeit und die Essenz der Texte in den Vordergrund, nicht die Person.
Besucher sollen mit Inhalten interagieren können (Impuls, Übungen, Quests, Teilen, Feedback) – die
Buchung ist ein Angebot unter mehreren, nicht das Ende jeder Seite.
HTML-Kommentare in Inhaltsdateien werden nicht veröffentlicht.

## Arbeitsweise

1. Ändern, dann **immer** `python3 bauen.py` ausführen. Er prüft jeden internen Link und jedes Bild und
   endet bei Fehlern mit Code 1 – dann nicht pushen, sondern reparieren.
2. Sichtprüfung bei Design-Änderungen: `cd docs && python3 -m http.server` und Screenshot
   (Playwright, Chromium unter `/opt/pw-browsers`) in Desktop- und Handybreite, hell und dunkel.
3. Commit mit deutscher, verständlicher Nachricht, push auf `main` → nach ca. 1 Minute live.

### Neuer Artikel
- Text als sauberes HTML (`<p>`, `<h2>`, `<h3>`, `<ul>`, `<blockquote>`, `<strong>`, `<em>`, `<a>`), keine
  Inline-Styles. Datei `inhalt/artikel/<slug>.html`, Slug klein mit Bindestrichen.
- Titelbild: `python3 werkzeuge/bild.py <datei> <slug>`. Kein Bild erfinden oder aus dem Netz nehmen
  (Urheberrecht) – ohne Bild vom Nutzer `bild:` weglassen.
- Texte des Autors nicht inhaltlich umschreiben. Tippfehler korrigieren ist ok, im Commit nennen.

### Recht
- Impressum und Datenschutz enthalten Platzhalter `[[...]]`. `python3 bauen.py --streng` schlägt fehl,
  solange welche offen sind. **Vor dem Domain-Umzug müssen sie gefüllt sein.**
- Neue Dienste (Tracking, Einbettungen wie YouTube-Player, Newsletter) nur mit Ergänzung der
  Datenschutzerklärung. Die Seite ist bewusst cookie- und trackingfrei; so braucht sie kein Cookie-Banner.
- Keine Schriften, Skripte oder Bilder von fremden Servern einbinden (DSGVO), alles lokal.
- Gesundheitsaussagen nur ohne erfundene Zahlen: Studienangaben mit Prozenten nicht übernehmen, wenn die
  Quelle nicht belegt ist.

## App „Meine Routinen“ (`app/`)

Installierbare Web-App (PWA) ohne Konto und ohne Server. `bauen.py` kopiert `app/` nach `docs/app/`,
schreibt `daten.json` (Übungen inkl. fertigem HTML) und setzt in `sw.js` eine neue Version, sobald sich
App-Dateien oder Daten ändern.

- `app.js`: alles in einer Datei, kein Framework. Zustand in `localStorage["phoenix-feder-app"]`,
  erledigte Quests in `localStorage["phoenix-feder-quests"]` (gemeinsam mit `/gewohnheiten/`).
- Konzepte: Tiny Habits (Anker, sofort feiern), Wenn-dann-Pläne, „nie zweimal hintereinander auslassen“
  (Kette mit Nachsicht), Abendreflexion mit Stimmung und drei guten Dingen, Auswertung „Was dir wirklich hilft“
  (Stimmung an Tagen mit/ohne Gewohnheit, ab 7 Reflexionen), Automatik-Check alle 14 Tage, Neustart-Hinweise
  montags/Monatsanfang, Federn + Stufen + eigene Belohnungen, Feedback nach 14 Tagen (Kontaktformular vorausgefüllt).
- Erinnerungen über Kalender (Google-Link oder .ics), Gerätewechsel über Sicherungsdatei oder Link
  (`#import=…`, Daten gzip+base64 im Fragment – erreicht nie den Server).
- Von der Website verlinken: `/app/#neu=<slug>` nimmt eine Gewohnheit auf bzw. startet eine Quest.
- Datenformat nur abwärtskompatibel ändern (`version: 1`); neue Felder in `neuerZustand()` mit Standardwert.
- Testen mit Playwright: frischer Kontext → Auswahl → Abhaken → Reflexion → Quest → Fortschritt, außerdem
  offline (`context.setOffline(true)`) und Übertragungslink in zweitem Kontext. Nach `localStorage`-Änderungen
  im Test die Seite neu laden (reiner Hash-Wechsel lädt nicht neu).
- Google-Anmeldung/Sync gibt es bewusst noch nicht: bräuchte eine OAuth-Client-ID (Google Cloud) und würde
  Daten im Drive-App-Ordner des Nutzers ablegen. Erst bauen, wenn die Client-ID existiert, und dann mit ihr testen.

