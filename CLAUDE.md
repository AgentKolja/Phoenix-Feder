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
| `inhalt/uebungen.json` | 54 Gewohnheiten, tägliche Aufgaben und Quests (Seite `/gewohnheiten/`, Impuls auf der Startseite). Ursprünglich aus Nikolas’ Habitica-Challenge, seit Okt. 2026 von Hand gepflegt, Regeln unter „Übungstexte“ |
| `bilder/` | Nur WebP, immer als Paar `<name>-800.webp` + `<name>-1600.webp` |
| `stil.css`, `favicon.svg`, `schriften/` | Design, Icon, lokal gehostete Schriften |
| `kontakt.js` | Formular-Versand; füllt Anliegen/Nachricht aus `?anliegen=…&nachricht=…` vor |
| `seite.js` | Impuls für heute, Teilen-Knopf, Quests abhaken (localStorage), Sprungziele öffnen |
| `thema.js` | Hell/Dunkel-Knopf (◐, Wahl in localStorage, sonst folgt die Seite dem Gerät) und Handy-Menü („Menü“ unter 860 px). Das Thema setzt schon ein Inline-Skript im `<head>` (bauen.py, app/index.html), damit nichts aufblitzt |
| `app/` | Web-App „Probier’s heute“ / „Meine Routinen“ unter `/app/` (siehe unten) |
| `werkzeuge/habitica-import.py` | Alter Import Habitica-CSV → `uebungen.json`. Würde die Handpflege überschreiben, läuft darum nur mit `--ueberschreiben` |
| `werkzeuge/bild.py` | Bild vorbereiten (braucht `pip install pillow`) |
| `werkzeuge/werbung/erzeugen.py` | Seminar-Werbung aus `seminar.json`: Instagram-Beitrag, Story/Status, 12-s-Video, A4-Plakat mit QR-Code auf `/seminar/` (Kurzadresse, leitet zur Anmeldung). Nach neuem Termin neu erzeugen; braucht `pip install qrcode imageio-ffmpeg` |
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
`{{kontakt Feedback zu den Übungen}}` (mit Vorauswahl), `{{impuls}}`, `{{themen}}`, `{{themen_chips}}`, `{{uebungen}}`
(eingeklappte Liste aller Übungen), `{{richtungen}}` (Einstiegsfrage „Woran möchtest du arbeiten?“, Antworten
führen nach `/app/#bereich=<slug>`; Liste `RICHTUNGEN` in bauen.py),
`{{habitica_url}}`, `{{buchung_url}}`, `{{name}}`, `{{autor}}`, `{{bild name "Alt-Text" "klasse" "eager"}}`
(`{{bild …}}` geht auch in Artikeln).

Schreibstil (Nikolas’ Wunsch, Okt. 2026, gilt für Seiten, App, Quiz und Artikel): Keine Gedankenstriche (– oder —) im
sichtbaren Text, vor allem kein angehängter Satzteil am Satzende („… – zum Lesen, Ausprobieren und Dranbleiben“), weil
das nach KI klingt. Stattdessen Punkt, Komma, Doppelpunkt oder Klammer. Dreieraufzählungen sparsam: lieber zwei Dinge,
ein konkretes Beispiel, eine Frage oder ein persönlicher Satz. Auch Muster wie „nicht nur X, sondern Y“ meiden.
Erlaubt: Zahlenbereiche (2015–2024). Der Browsertest prüft alle Seiten auf Gedankenstriche.

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
  (Urheberrecht) – ohne Bild vom Nutzer `bild:` weglassen. Ausnahme nur auf ausdrücklichen Wunsch: selbst
  gezeichnete Illustration (eigenes SVG, keine Vorlage), im `bildtext` als „Illustration“ kennzeichnen
  (so bei „Die Realität sehen“ – durch ein eigenes Foto ersetzbar).
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
- Gesundheitsaussagen in Übungen ohne Prozentzahlen, Wirkung in Worten und so vorsichtig, wie die Belege es
  tragen („kann“, „im Schnitt etwas“, „die Belege sind noch dünn“). Eine Studie nur nennen, wenn sie geprüft ist
  (Autor und Jahr, z. B. „Gross und John 2003“), Zusammenhänge nicht als Beweis darstellen.

### Übungstexte (`inhalt/uebungen.json`, Okt. 2026 an das Prinzip der Seite angepasst)

- Ruhig und ehrlich wie der Rest der Seite: keine Habitica-Mechanik („+“ setzen, Punkte sammeln, Questreihe,
  Sonderchallenge, Bonusmaterial), keine Werbesätze mit Ausrufezeichen („… und erlebe, wie …!“), keine
  Gedankenstriche. bauen.py bricht bei diesen Resten ab.
- Nur Tipps, die nicht schaden und nichts versprechen, was die Forschung nicht trägt: kein Edelsteinwasser, kein
  „Lachen heilt“, Bienen beobachten statt streicheln, Berührung nur, wenn es für beide stimmt, Kerzen nicht
  unbeaufsichtigt. Ernährung an den Blue Zones orientiert (viel Pflanzliches, wenig rotes Fleisch, wenig Zucker).
- Realistischer Optimismus wie im Quiz: Affirmationen glaubwürdig formulieren (Wood, Perunovic und Lee 2009:
  unglaubwürdige Sätze drücken bei geringem Selbstwert die Stimmung), Ziele mit Hindernis und Plan (WOOP,
  Oettingen und Mayer 2002).
- Geprüfte Quellen in den Texten: Ulrich 1984 (Blick ins Grüne), Kardas, Kumar und Epley 2022 (tiefe Gespräche),
  Armstrong u. a. 2012 (Trinken), Cohen u. a. 2015 (Umarmungen), Gross und John 2003, Lieberman u. a. 2007 (Gefühle),
  Naska u. a. 2007 (Mittagsschlaf), Khoury u. a. 2015 (MBSR), Tackman u. a. 2019 („ich“ sagen), Seligman u. a. 2005
  (drei gute Dinge), Wood u. a. 2009 (Affirmationen).
- Titel, Lieder, Hörbuch- und App-Empfehlungen sind Nikolas’ eigene Auswahl und bleiben.

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
- Keine Punkte, Level oder Belohnungen in der App (ohne Konto wenig sinnvoll). Die Rollenspiel-App Habitica wird
  nirgends mehr beworben (Nikolas, Okt. 2026); die Übungen stammen ursprünglich aus der Habitica-Challenge.
- Eingaben (Abendreflexion, „Anpassen“) werden sofort gespeichert, nicht erst per Knopf. `laden()` nutzt ebenfalls
  `bereinigen()`. Installiert wird über `beforeinstallprompt` bzw. die Anleitung unter „Mehr“ (iPhone: eigener
  Speicher der Home-Bildschirm-App → Sicherung herunterladen/laden).
- „Probier’s heute“ und der Impuls auf der Startseite zeigen nur, was heute geht (`heute`, passender Monat).
  Der Impuls wechselt bei jedem Laden (nie zweimal derselbe hintereinander, `localStorage["phoenix-feder-impuls"]`). Die Wochen-Quest filtert nur nach Monat: Quests mit Planung (Ausflug, Lazy Day) passen in eine Woche. Andere Ideen sind per Link erreichbar und zeigen „Braucht etwas Zeit“ (Gewohnheit),
  „Braucht etwas Planung“ (Quest, abhakbar) oder „Gerade nicht die Jahreszeit“ (ohne Kalender-Optionen) plus `statt`.
- Jede Idee hat eine eigene Info-Seite `/gewohnheiten/<slug>/` (`idee_seite()` in bauen.py: Für heute / Braucht Zeit
  oder Planung, Knopf in die App, Ideen und Hintergrund, passende Artikel, mehr aus dem Bereich). Der Impuls auf der
  Startseite verlinkt „Mehr dazu“ dorthin; die App unter „Ideen und Hintergrund“ ebenso.
- Kalender ist der Hauptweg (`kalenderBlock()`): offen unter jeder Idee, Zeit mit „★ Passt gut“ vorgewählt (`zeit`),
  Dauer Einmal/2 Wochen/2 Monate/Dauerhaft (Quests: Einmal/wöchentlich 8×), Google-Link oder .ics. Der Termin erklärt
  sich selbst: Schritt für heute, `warum`, `wann`, „nie zweimal hintereinander auslassen“, Links zur Info-Seite und App.
  `warum`/`zeit`/`wann` stehen je Idee in `erklaerungen.json` (Pflicht, bauen.py bricht sonst ab). Eingetragenes merkt
  sich `Z.kalender` → „Passt noch etwas dazu?“ (je freie Tageszeit eine Idee), „📅 Mein Kalender“ unter Mehr (alles als
  eine Datei; gleiche UID je Idee + steigende SEQUENCE, damit ein erneuter Import aktualisiert), „Verlängern“-Hinweis,
  wenn 2 Wochen bzw. 2 Monate um sind. Website verlinkt `/app/#kalender=<slug>` (springt zum Kalender-Block).
- „Länger dranbleiben“ gibt es in zwei Wegen: ohne App per Kalender-Erinnerung oder mit der App (persönlich, Einträge nur
  auf diesem Gerät). Danach rät „Heute“ wöchentlich, die App auf den Startbildschirm zu legen (`Z.hinweise.app`), bis
  sie installiert läuft. Im privaten Fenster gibt es den App-Weg nicht (`speicherFehlt`).
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

## Realitätscheck „Wie realistisch ist dein Weltbild?“ (`/quiz/`)

Nach Hans Roslings Factfulness, Fragen und Zahlen in `inhalt/quiz.json`. Je Frage **4 Antworten** mit Richtung:
`r` richtig, `p` zu pessimistisch, `o` zu optimistisch. **Jede Frage hat mindestens eine `p`- und eine `o`-Antwort**, damit
jede falsche Antwort zeigt, in welche Richtung man danebenliegt (bauen.py prüft das). Damit ist die richtige nie die
düsterste oder rosigste Option; abwechselnd zwei `p` und ein `o` oder umgekehrt, damit „die mittlere“ nicht trägt.
Richtige Antwort je fünfmal auf A, B, C und D (Reihenfolge der Optionen bewusst gemischt; Browsertest prüft die
Verteilung). Falsche Antworten nah genug am echten Wert, dass man nachdenken muss. Fragen ohne klare Richtung
(z. B. Bevölkerungszahlen, Anteil Eingewanderter) nicht verwenden; bei Migration deshalb die Bildungsfrage
(Hochschulabschluss), die Wahrnehmungsstudie (Alesina u. a. 2023) steht in der Erklärung. Antworten eindeutig
formulieren, am besten als konkrete Werte; „um“ (Veränderung) und „auf“ (neuer Wert) nie mischen (bauen.py prüft das).
Erklärung mit Zahl und Jahr; Quelle mit Link; optional `studie` = [% falsch im Schnitt, % falsch Deutschland] aus der
Gapminder Misconception Study 2017, nur bei vergleichbarer Frage (Werte aus gapm.io/gms17d, Blatt „country percente per
question“). Neben den Factfulness-Klassikern auch Entwicklungen der letzten 5 bis 10 Jahre (Internet, KI mit Nutzen und
Risiko, erneuerbare Energie, Konten, Frühwarnsysteme), dazu Kinderarbeit, Atomwaffen und Klima (2024: +1,55 °C).
Einstieg: „Glaubst du an eine bessere Zukunft für die Welt?“. Auswertung in `quiz.js`: realistisch ab 60 % richtig,
sonst nach dem Überhang p minus o: ab 2 „eher“, ab 30 % der Fragen „deutlich“ pessimistisch/optimistisch, sonst
„mal zu düster, mal zu rosig“; Zeiger auf der Skala, Balken und Legende mit zu pessimistisch / richtig / zu optimistisch,
Schimpansen-Vergleich aus der Zahl der Antworten. Danach: Medien als Hauptursache des zu düsteren Bilds (Robertson u. a.
2023: jedes negative Wort +2,3 % Klicks), Negativitätseffekt, dann „Am gesündesten: realistischer Optimismus“
(Lazarus-Stressmodell, Schneider 2001, Nes und Segerstrom 2006, Rozanski u. a. 2019, Lee u. a. 2019, Oettingen und
Mayer 2002, Roslings „Possibilist“; alle Werte aus den Abstracts geprüft). Alle Antworten stehen offen darunter,
markiert blau (richtig) und orange gestrichelt (deine Antwort) plus ✓/✗ statt Rot/Grün, damit es auch bei
Farbsehschwäche klappt. Teaser und Einleitung verraten die Richtung nicht („9 von 10 nicht besser als ein Schimpanse,
lass dich überraschen“). Platz: eigener Abschnitt direkt über dem Impuls (kein Knopf im Kopfbereich). Dort steht die
Einstiegsfrage als Karte zum Antippen (`{{quiz_einstieg}}`); jede Antwort startet das Quiz über `/quiz/#weltbild=0|1|2`
direkt bei Frage 1. Nur belegte Zahlen
aus Primärquellen (Weltbank-API, UN WPP, WHO/UNICEF, EM-DAT über OWID, Destatis, IPCC, ITU, IRENA, WMO, ILO/UNICEF, FAS, Nobelpreis);
Stand und `version` pflegen, wenn Fragen oder Zahlen sich ändern. Ablauf in `quiz.js`: Bauchgefühl vorab, Fragen mit sofortiger Auflösung, dann die
Frage, ob die Antworten anonym beigesteuert werden (Einwilligung, nur bei „Ja“ → Web3Forms, Betreff „Quiz: anonyme
Antworten“, Feld `Daten` als JSON für die Auswertung). Datenschutzerklärung Abschnitt 4 beschreibt das. Auswertung:
Mails mit diesem Betreff (z. B. per Gmail-Suche) zusammenzählen. Web3Forms-Kontingent (Gratis: 250/Monat) teilt sich das
Quiz mit Kontakt und Seminar-Anmeldung – bei viel Andrang auf einen eigenen Schlüssel oder Speicher umziehen.

## Achtsamkeitsseminar (`/achtsamkeitsseminar/`)

Inhalt aus Nikolas’ Konzept-PDF (Drei Ebenen: Wahrnehmen, Dich selbst verstehen, Bewusst handeln). Die Seite soll
neugierig machen und nicht zu viel vorwegnehmen (Nikolas, Okt. 2026): keine Agenda mit Minuten, nur „Was dich
erwartet“ (Nachmittag in kleiner Runde, Teepause, Begleitbogen) und eine Liste der Methoden. Den Gefühlston
(angenehm/unangenehm/neutral) nicht auf der Seite beschreiben, der Teil wird noch überarbeitet. Leitsatz „Bewusst leben“,
Text „In diesem Pilotseminar schärfst du deine Wahrnehmung, lernst dich selbst besser kennen und übst, auch in
schwierigen Situationen bewusst zu handeln.“ (nach dem Pilot „Pilotseminar“ herausnehmen, auch in der Werbung).
Vorgeschmack-Übung nur mit Schokolade (keine Dattel). Hintergrund kurz: Kabat-Zinn, Lazarus, Hayes. Bilder `seminar-*` stammen aus
dem PDF. Termin nur in `inhalt/seminar.json` pflegen: Seite (Hinweis oben, Anmeldung `#anmelden`), Angebotskarte
(`"seminar": true`), Kalenderdatei `/achtsamkeitsseminar/termin.ics` und Bestätigungsseite `/angemeldet/` folgen daraus.
Anmeldung: nur Vorname + E-Mail über Web3Forms; Nikolas nimmt 2–3 Anmeldungen mehr an als Plätze (Absagen-Puffer)
und schickt am Vortag eine Erinnerungsmail. Pilot kostenlos gegen Feedback (Okt. 2026), Ort Warung Yoga Aachen. Seminar-Leitfaden mit Kursplan, Materialliste
und Druckvorlagen liegt als Claude-Doc bei Nikolas (nicht im Repo).
Format: 150 Minuten mit Pause, kleine Gruppe, drinnen (keine Gehmeditation, kein Schweigeessen – wetter- bzw.
zeitabhängig). Maslow: Mangelbedürfnisse lassen sich stillen, Selbstverwirklichung und Transzendenz sind Sehnsüchte,
die nie ganz gestillt werden.

