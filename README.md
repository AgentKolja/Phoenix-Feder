# phoenix-feder.de

Die Website von Nikolas Voth – umgezogen von Wix auf eine schlanke, statische Seite.
Kosten: nur noch die Domain. Pflege: Claude (Anweisungen in `CLAUDE.md`).

## So änderst du etwas

Schreib Claude in einer Sitzung mit diesem Repository, was du willst, zum Beispiel:

- „Neuer Artikel: *Titel* – hier der Text … (Bild hängt an)“
- „Preis fürs Coaching auf 50 € ändern“
- „Im Artikel *Der Engelskreis* den zweiten Absatz ersetzen durch …“

Claude ändert die Dateien, prüft den Build und pusht. Eine Minute später ist es live.
Jede Änderung ist im Verlauf sichtbar und lässt sich zurücknehmen.

Kleine Tippfehler kannst du auch selbst direkt auf github.com in `inhalt/` korrigieren – die Seite baut sich danach von allein neu.

## Umzug von Wix – deine Schritte

Alles andere ist erledigt. Reihenfolge einhalten, dann gibt es keine Ausfallzeit.

1. **GitHub Pages einschalten** (1 Min.): Repo → *Settings* → *Pages* → *Source*: **GitHub Actions**.
   Danach ist die Vorschau unter `https://agentkolja.github.io/phoenix-feder/` erreichbar.
2. **Daten fürs Impressum** an Claude schicken: Anschrift, E-Mail, ob Kleinunternehmer (§ 19 UStG).
3. **Kontaktformular** (2 Min.): auf [web3forms.com](https://web3forms.com) E-Mail eintragen, den
   Schlüssel aus der Mail an Claude geben.
4. **Online-Buchung** (10 Min.): Konto bei [cal.com](https://cal.com) (Anmeldung mit Google), Google-Kalender
   verbinden, Termintyp „Erstgespräch, 30 Min.“ anlegen, Link an Claude geben. Bezahlte Termine optional
   über die Stripe-App in Cal.com.
5. **Domain umziehen** (15 Min. + Wartezeit):
   - GitHub: *Settings* → *Pages* → *Custom domain*: `www.phoenix-feder.de` eintragen.
   - Wix: *Einstellungen* → *Domains* → Domain → *Von Wix wegtransferieren* → Auth-Code kommt per Mail.
   - Neuer Anbieter (z. B. INWX, netcup, IONOS): Domain-Transfer mit Auth-Code bestellen und dabei
     gleich diese DNS-Einträge setzen:

     | Typ | Name | Wert |
     |---|---|---|
     | A | @ | 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153 |
     | AAAA | @ | 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153 |
     | CNAME | www | agentkolja.github.io |

   - Wenn die Seite unter www.phoenix-feder.de erscheint: in GitHub *Enforce HTTPS* anhaken.
6. **Wix kündigen** – erst wenn alles läuft: Kontakte/Formulareinträge in Wix als CSV exportieren, dann
   Premium-Abo kündigen (automatische Verlängerung aus).
7. Optional: [Google Search Console](https://search.google.com/search-console) → Domain hinzufügen →
   `sitemap.xml` einreichen. Die Datei zur Bestätigung legt Claude ins Repo.

## Technik in einem Satz

`python3 bauen.py` baut aus `inhalt/` den Ordner `docs/`, prüft alle Links und Bilder, und GitHub Actions
veröffentlicht das Ergebnis. Keine Datenbank, kein CMS, keine Cookies, kein Tracking.
