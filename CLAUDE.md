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
| `bilder/` | Nur WebP, immer als Paar `<name>-800.webp` + `<name>-1600.webp` |
| `stil.css`, `kontakt.js`, `favicon.svg`, `schriften/` | Design, Formular-Versand, Icon, lokal gehostete Schriften |
| `werkzeuge/bild.py` | Bild vorbereiten (braucht `pip install pillow`) |
| `werkzeuge/wix-export.py` | Einmaliger Umzug von Wix, erledigt. Nicht erneut nötig |

Inhaltsdateien beginnen mit Kopfzeilen `schluessel: wert`, dann eine Zeile `---`, dann HTML.
Artikel: `titel`, `datum` (JJJJ-MM-TT), `sprache` (`de`/`en`), `beschreibung` (≤ 160 Zeichen, für Google
und Karten), `bild` (Name ohne Endung), `bildtext`, optional `entwurf: ja` (wird nicht gebaut).
Seiten: `titel`, `beschreibung`, optional `bild`, `indexieren: nein`.

Bausteine in Seiten: `{{angebote}}`, `{{neueste_artikel}}`, `{{alle_artikel}}`, `{{kontakt}}`,
`{{buchung_url}}`, `{{name}}`, `{{autor}}`, `{{bild name "Alt-Text" "klasse" "eager"}}`.
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
