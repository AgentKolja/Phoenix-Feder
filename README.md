# phoenix-feder.de

Die Website von Nikolas Voth – umgezogen von Wix auf eine schlanke, statische Seite.
Kosten: nur noch die Domain. Pflege: Claude (Anweisungen in `CLAUDE.md`).

## So änderst du etwas

Schreib Claude in einer Sitzung mit diesem Repository, was du willst, zum Beispiel:

- „Neuer Artikel: *Titel* – hier der Text … (Bild hängt an)“
- „Preis fürs Coaching auf 50 € ändern“
- „Neue Quest für die Challenge: …“ oder „Hier ist der neue Habitica-Export“ (CSV anhängen)
- „Im Artikel *Der Engelskreis* den zweiten Absatz ersetzen durch …“

Claude ändert die Dateien, prüft den Build und pusht. Eine Minute später ist es live.
Jede Änderung ist im Verlauf sichtbar und lässt sich zurücknehmen.

Kleine Tippfehler kannst du auch selbst direkt auf github.com in `inhalt/` korrigieren – die Seite baut sich danach von allein neu.

## Stand

Der Umzug von Wix ist abgeschlossen: Domain bei IONOS (DNS auf GitHub Pages), HTTPS erzwungen,
Kontaktformular über Web3Forms, Buchung über Cal.com, Wix gekündigt.

Optional: [Google Search Console](https://search.google.com/search-console) → Domain hinzufügen →
`sitemap.xml` einreichen. Die Datei zur Bestätigung legt Claude ins Repo.

## Technik in einem Satz

`python3 bauen.py` baut aus `inhalt/` den Ordner `docs/`, prüft alle Links und Bilder, und GitHub Actions
veröffentlicht das Ergebnis (bei jedem Push und einmal pro Woche). Keine Datenbank, kein CMS, keine Cookies,
kein Tracking. `werkzeuge/browsertest.js` prüft Website und App im Browser.
