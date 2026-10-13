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
| `inhalt/angebote.json` | Angebote mit Dauer, Preis, Text, Bild, optional eigenem Buchungslink, `seite` (Knopf „Mehr erfahren“ statt Buchung) und `breit` (Karte über die ganze Zeile) |
| `inhalt/seminar.json` | Nächster Seminartermin: `art` (z. B. „Pilot“, leer = normal), Datum, Zeit, Ort (Name, Straße, PLZ, Stadt), Mitbringen, Plätze, Preis (`kostenlos` → Knopf „Kostenlos anmelden“, sonst „Anmelden“). Ist er vorbei oder leer, zeigt die Seite automatisch „Termin in Planung“ mit Anfrageformular |
| `inhalt/themen.json` | Die vier Themen (Slug, Titel, Essenz, Bild). Jedes bekommt eine Seite `/thema/<slug>/` |
| `inhalt/erklaerungen.json` | Je Übung eine Zeile Klartext („Bei Alltäglichem singen …“), der Bereich (Ruhe, Körper, Miteinander, Freude, Stärke – auch für Quests, damit sie zur Einstiegsfrage passen) und `heute`: konkreter Schritt für heute (Text), `true` (Klartext passt schon) oder `false` (nicht spontan: Gewohnheit wirkt erst über Wochen, z. B. feste Schlafenszeiten; Quest braucht Planung, z. B. Ausflug). Optional `statt` (Ideen für heute, wenn diese nicht geht) und `monate` (z. B. Bienen nur April–September). Von Hand gepflegt; der Build bricht ab, wenn `kurz` oder `heute` fehlt |
| `inhalt/uebungen.json` | 54 Gewohnheiten, tägliche Aufgaben und Quests der Habitica-Challenge (Seite `/gewohnheiten/`, Impuls auf der Startseite) |
| `bilder/` | Nur WebP, immer als Paar `<name>-800.webp` + `<name>-1600.webp` |
| `stil.css`, `favicon.svg`, `schriften/` | Design, Icon, lokal gehostete Schriften |
| `kontakt.js` | Formular-Versand; füllt Anliegen/Nachricht aus `?anliegen=…&nachricht=…` vor |
| `seite.js` | Impuls für heute, Teilen-Knopf, Quests abhaken (localStorage), Sprungziele öffnen |
| `app/` | Web-App „Probier’s heute“ / „Meine Routinen“ unter `/app/` (siehe unten) |
| `werkzeuge/habitica-import.py` | Habitica-CSV → `uebungen.json`, entfernt unbelegte Studienzahlen und persönliche Angebote |
| `werkzeuge/bild.py` | Bild vorbereiten (braucht `pip install pillow`) |
| `werkzeuge/browsertest.js` | Browser-Test für Website und App (Playwright), siehe Arbeitsweise |
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
`{{kontakt Habitica-Challenge}}` (mit Vorauswahl), `{{impuls}}`, `{{themen}}`, `{{themen_chips}}`, `{{uebungen}}`
(eingeklappte Liste aller Übungen), `{{richtungen}}` (Einstiegsfrage „Woran möchtest du arbeiten?“, Antworten
führen nach `/app/#bereich=<slug>`; Liste `RICHTUNGEN` in bauen.py),
`{{habitica_url}}`, `{{buchung_url}}`, `{{name}}`, `{{autor}}`, `{{bild name "Alt-Text" "klasse" "eager"}}`
(`{{bild …}}` geht auch in Artikeln).

Ausrichtung: Die Seite stellt Achtsamkeit und die Essenz der Texte in den Vordergrund. Nikolas kommt kurz vor:
ein Abschnitt „Über mich“ auf der Startseite direkt vor der Begleitung (sein Wunsch, Okt. 2026; Text ist die
Kurzfassung von `/about/` – bei Änderungen beide anpassen). Besucher sollen mit Inhalten interagieren können
(Impuls, Übungen, Quests, Teilen, Feedback) – die Buchung ist ein Angebot unter mehreren, nicht das Ende jeder Seite.
Leicht anfangen: Seiten beginnen mit einer einfachen Frage oder einer Idee, lange Listen sind eingeklappt.
Interne Links nie auf `/gewohnheiten/#<übung>` (landet mitten in der Seite), sondern auf `/app/#idee=<übung>`.
Kein Bild doppelt auf einer Seite (Themen-Kacheln weichen automatisch aus, wenn „Neu im Blog“ ihr Bild zeigt).
HTML-Kommentare in Inhaltsdateien werden nicht veröffentlicht.

## Arbeitsweise

1. Ändern, dann **immer** `python3 bauen.py --streng` ausführen. Er prüft jeden internen Link und jedes Bild,
   meldet ungenutzte Bilder und endet bei Fehlern mit Code 1 – dann nicht pushen, sondern reparieren.
2. Bei Änderungen an App, Skripten oder Seitenaufbau: `PW=$(npm root -g)/playwright node werkzeuge/browsertest.js`
   (startet selbst einen Server auf `docs/`, Datum fest eingestellt). Neue Funktionen dort mit einer Prüfung ergänzen.
3. Sichtprüfung bei Design-Änderungen: Screenshot (Playwright, Chromium unter `/opt/pw-browsers`) in Desktop-
   und Handybreite, hell und dunkel.
4. Commit mit deutscher, verständlicher Nachricht, push auf `main` → nach ca. 1 Minute live. Zusätzlich baut
   GitHub Actions jeden Morgen neu (Jahreszeit-Ideen, Seminar nach dem Termin auf „in Planung“).
   Achtung: GitHub pausiert zeitgesteuerte Läufe, wenn 60 Tage lang niemand ins Repo pusht – dann einmal pushen
   oder unter Actions wieder aktivieren.

### Neuer Artikel
- Text als sauberes HTML (`<p>`, `<h2>`, `<h3>`, `<ul>`, `<blockquote>`, `<strong>`, `<em>`, `<a>`), keine
  Inline-Styles. Datei `inhalt/artikel/<slug>.html`, Slug klein mit Bindestrichen.
- Titelbild: `python3 werkzeuge/bild.py <datei> <slug>`. Kein Bild erfinden oder aus dem Netz nehmen
  (Urheberrecht) – ohne Bild vom Nutzer `bild:` weglassen.
- Texte des Autors nicht inhaltlich umschreiben. Tippfehler korrigieren ist ok, im Commit nennen.

### Recht
- Impressum und Datenschutz sind ausgefüllt (Stand Okt. 2026). Platzhalter `[[...]]` lässt `--streng` scheitern.
- Preise: Nikolas ist kein Kleinunternehmer. Ob die Preise brutto sind, ist nicht geklärt – vor einer
  Preisänderung fragen und ggf. „inkl. MwSt.“ ergänzen (Preisangabenverordnung).
- Zitate: Belegte Zitate bevorzugen (z. B. Kabat-Zinn, „Wherever You Go, There You Are“; Epiktet, Handbüchlein
  der Moral 5). Ist eine Zuschreibung nicht wörtlich belegt (z. B. „Zwischen Reiz und Reaktion …“ bei Viktor Frankl,
  „Das Geheimnis der Gesundheit …“ bei Buddha, „Bis du das Unbewusste …“ bei C. G. Jung), dann „inspiriert durch …“
  schreiben – sparsam, höchstens einmal pro Seite.
- Neue Dienste (Tracking, Einbettungen wie YouTube-Player, Newsletter) nur mit Ergänzung der
  Datenschutzerklärung. Die Seite ist bewusst cookie- und trackingfrei; so braucht sie kein Cookie-Banner.
- Keine Schriften, Skripte oder Bilder von fremden Servern einbinden (DSGVO), alles lokal.
- Gesundheitsaussagen ohne Prozentzahlen: Wirkung in Worten („merklich“, „erheblich“, „nachhaltig“). Eine
  Universität oder Studie nur nennen, wenn es die Forschung nachweislich gibt (Tabelle `STUDIEN` in
  `werkzeuge/habitica-import.py`; der Import bricht ab, wenn noch „%“ oder „Studie der …“ im Text steht).

## App „Probier’s heute“ → „Meine Routinen“ (`app/`)

Zwei Stufen: Wer neu ist, sieht nur „Probier’s heute“ (`#probieren`): zwei kurze Fragen („Woran möchtest du
arbeiten?“ → Bereich oder „alle“; „Wie viel Zeit hast du?“ → `kurz` = Gewohnheiten, `lang` = Quests, `egal`), dann
die Liste ALLER passenden Ideen für heute (keine einzelne Zufallsidee; „Überrasch mich“ nur als Knopf). Antippen →
Idee mit Klartext, „Hab ich ausprobiert“ und „← Alle Ideen für dich“. Antworten und Idee liegen in `Z.probieren`:
Wer die App schließt, landet beim nächsten Öffnen an derselben Stelle. Ohne Menüleiste (`body.einfach`);
`#entdecken` zeigt alle Ideen nach Bereichen zum Stöbern.
Optional darunter: als Erinnerung in den Kalender (Schritte Wann → Wie oft → Eintragen; einmal oder 14 Tage
täglich, Google-Link oder .ics, auf Apple-Geräten .ics zuerst; danach ein Hinweis, was zu tun ist) oder
„Länger ausprobieren“ → nimmt die Idee als Routine auf, setzt `Z.modus = "routine"` und zeigt `#heute` mit
voller Navigation. Routinemodus gilt auch, sobald mindestens eine Gewohnheit gewählt ist.

Installierbare Web-App (PWA) ohne Konto und ohne Server. `bauen.py` kopiert `app/` nach `docs/app/`,
schreibt `daten.json` (Übungen inkl. fertigem HTML) und setzt in `sw.js` eine neue Version, sobald sich
App-Dateien oder Daten ändern.

- `app.js`: alles in einer Datei, kein Framework. Zustand in `localStorage["phoenix-feder-app"]`,
  erledigte Quests in `localStorage["phoenix-feder-quests"]` (gemeinsam mit `/gewohnheiten/`).
- Konzepte: Tiny Habits (Anker, sofort feiern), Wenn-dann-Pläne, „nie zweimal hintereinander auslassen“
  (Kette mit Nachsicht), Abendreflexion mit Stimmung und drei guten Dingen, Auswertung „Was dir wirklich hilft“
  (Stimmung an Tagen mit/ohne Gewohnheit, ab 7 Reflexionen), Automatik-Check alle 14 Tage, Neustart-Hinweise
  montags/Monatsanfang, Feedback nach 14 Tagen (Kontaktformular vorausgefüllt).
- Erinnerungen über Kalender (Google-Link oder .ics), Gerätewechsel über Sicherungsdatei oder Link
  (`#import=…`, Daten gzip+base64 im Fragment – erreicht nie den Server).
- Nichts ungefragt anlegen: keine festen „Täglich“-Punkte (Bewegung ist eine normale Gewohnheit im Bereich Körper),
  die Abendreflexion nur nach Ja (`Z.reflexion`: null = noch nicht gefragt). Alte Zustände ohne `reflexion`
  übernehmen genutzte Täglich-Punkte als eigene Gewohnheiten (`bereinigen()`).
- Keine Punkte, Level oder Belohnungen in der App (ohne Konto wenig sinnvoll) – dafür verweist sie auf Habitica.
- Eingaben (Abendreflexion, „Anpassen“) werden sofort gespeichert, nicht erst per Knopf. `laden()` nutzt ebenfalls
  `bereinigen()`. Installiert wird über `beforeinstallprompt` bzw. die Anleitung unter „Mehr“ (iPhone: eigener
  Speicher der Home-Bildschirm-App → Sicherung herunterladen/laden).
- „Probier’s heute“ und der Impuls auf der Startseite zeigen nur, was heute geht (`heute`, passender Monat).
  Der Impuls wechselt bei jedem Laden (nie zweimal derselbe hintereinander, `localStorage["phoenix-feder-impuls"]`). Die Wochen-Quest filtert nur nach Monat: Quests mit Planung (Ausflug, Lazy Day) passen in eine Woche. Andere Ideen sind per Link erreichbar und zeigen „Braucht etwas Zeit“ (Gewohnheit),
  „Braucht etwas Planung“ (Quest, abhakbar) oder „Gerade nicht die Jahreszeit“ (ohne Kalender-Optionen) plus `statt`.
- Von der Website verlinken: `/app/#idee=<slug>` zeigt genau diese Idee (legt nichts an; alte `#neu=`-Links
  ebenso), `/app/#bereich=<slug>` beantwortet die erste Frage (`ruhe`, `koerper`, …, `alle`); `erlebnis` beantwortet beide (alle Bereiche, Quests).
- Sicherungsdatei und Übertragungslink kommen von außen: `bereinigen()` übernimmt nur bekannte Felder in der
  erwarteten Form. Neue Felder im Zustand dort ergänzen, sonst gehen sie beim Gerätewechsel verloren.
- Fehlen in einer alten, zwischengespeicherten `daten.json` neue Felder, muss die App weiterlaufen: Standardwerte
  in `starten()` ergänzen (eine Stelle), nicht an jeder Lesestelle.
- Datenformat nur abwärtskompatibel ändern (`version: 1`); neue Felder in `neuerZustand()` mit Standardwert.
- Testen: `werkzeuge/browsertest.js` (siehe Arbeitsweise). Zum Öffnen eines `#idee=`-Links im Test erst eine
  andere Seite laden, sonst ist es nur ein Hash-Wechsel; nach `localStorage`-Änderungen neu laden.
- Google-Anmeldung/Sync gibt es bewusst noch nicht: bräuchte eine OAuth-Client-ID (Google Cloud) und würde
  Daten im Drive-App-Ordner des Nutzers ablegen. Erst bauen, wenn die Client-ID existiert, und dann mit ihr testen.
- Weniger ist mehr: Verspielte Namen (Singvogel, Superhiero …) nie ohne Erklärzeile zeigen. Lange Texte,
  Einstellungen und Statistiken hinter „Aufklappen“, höchstens ein Hinweis gleichzeitig. Einstieg:
  zwei Fragen, dann die passenden Ideen; eigene Auswahl (`#start`: Bereich → Gewohnheiten → Zeitpunkt) nur auf Wunsch.

## Achtsamkeitsseminar (`/achtsamkeitsseminar/`)

Inhalt aus Nikolas’ Konzept-PDF (Drei Ebenen: Wahrnehmen, Dich selbst verstehen, Bewusst handeln; Ablauf in fünf
Schritten mit Minuten und „Methodik“ (MBSR, Body Scan, PMR nach Jacobson, ACT-Defusion, Wertespiel);
Dattel-/Schokoladen-Übung; Hintergrund mit Kabat-Zinn, Lazarus, Hayes, Brewer). Bilder `seminar-*` stammen aus
dem PDF. Termin nur in `inhalt/seminar.json` pflegen: Seite (Hinweis oben, Anmeldung `#anmelden`), Angebotskarte
(`"seminar": true`), Kalenderdatei `/achtsamkeitsseminar/termin.ics` und Bestätigungsseite `/angemeldet/` folgen daraus.
Anmeldung: nur Vorname + E-Mail über Web3Forms; Nikolas nimmt 2–3 Anmeldungen mehr an als Plätze (Absagen-Puffer)
und schickt am Vortag eine Erinnerungsmail. Pilot kostenlos gegen Feedback (Okt. 2026), Ort Warung Yoga Aachen. Seminar-Leitfaden mit Kursplan, Materialliste
und Druckvorlagen liegt als Claude-Doc bei Nikolas (nicht im Repo).
Format: 150 Minuten mit Pause, kleine Gruppe, drinnen (keine Gehmeditation, kein Schweigeessen – wetter- bzw.
zeitabhängig). Maslow: Mangelbedürfnisse lassen sich stillen, Selbstverwirklichung und Transzendenz sind Sehnsüchte,
die nie ganz gestillt werden.

