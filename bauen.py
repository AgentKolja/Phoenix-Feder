#!/usr/bin/env python3
"""Baut die Website aus inhalt/ nach docs/ (das veroeffentlicht GitHub Pages).

Aufruf:  python3 bauen.py            baut und prueft
         python3 bauen.py --streng   bricht zusaetzlich ab, solange Platzhalter [[...]] offen sind

Nur Python-Standardbibliothek. Der Build prueft am Ende jeden internen Link und jedes Bild;
ist etwas kaputt, endet er mit Fehlercode 1 und docs/ darf so nicht veroeffentlicht werden.
"""
import hashlib
import html
import json
import math
import re
import shutil
import sys
from datetime import date, datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from urllib.parse import quote, urlencode

WURZEL = Path(__file__).resolve().parent
INHALT = WURZEL / "inhalt"
AUSGABE = WURZEL / "docs"
E = json.loads((WURZEL / "einstellungen.json").read_text(encoding="utf-8"))
MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
          "September", "Oktober", "November", "Dezember"]
PLATZHALTER = re.compile(r"\[\[(.+?)\]\]")
NAVI = [("/blog/", "Artikel"), ("/gewohnheiten/", "Gewohnheiten"), ("/book-online/", "Begleitung"),
        ("/about/", "Über mich"), ("/#kontakt", "Kontakt")]
THEMEN = json.loads((INHALT / "themen.json").read_text(encoding="utf-8"))
UEBUNGEN = json.loads((INHALT / "uebungen.json").read_text(encoding="utf-8"))
UEBUNG = {u["slug"]: u for u in UEBUNGEN}
# Klartext-Erklaerung und Bereich je Uebung (Hand gepflegt, uebersteht einen neuen Habitica-Import)
ERKLAERUNGEN = json.loads((INHALT / "erklaerungen.json").read_text(encoding="utf-8"))
BEREICHE = ERKLAERUNGEN["bereiche"]
_fehlt = [u["slug"] for u in UEBUNGEN if u["slug"] not in ERKLAERUNGEN["uebungen"]]
if _fehlt:
    raise SystemExit(f"inhalt/erklaerungen.json: Erklärung fehlt für {_fehlt}")
for _u in UEBUNGEN:
    _u["erklaerung"] = ERKLAERUNGEN["uebungen"][_u["slug"]]["kurz"]
    _u["bereich"] = ERKLAERUNGEN["uebungen"][_u["slug"]]["bereich"]
ART = {"gewohnheit": "Gewohnheit", "taeglich": "Tägliche Aufgabe", "quest": "Quest"}
ANLIEGEN = ["Frage oder Feedback", "Feedback zu einem Artikel", "Habitica-Challenge", "Kostenloses Erstgespräch",
            "Persönliches Coaching", "Achtsamkeitstraining", "Yoga-Training", "Etwas anderes"]
# Beschriftungen rund um einen Artikel, je nach Sprache des Artikels
TEXTE = {
    "de": {"essenz": "Auf den Punkt", "probieren": "Zum Ausprobieren", "frage": "Frage an dich",
           "gewohnheit": "Mach eine Gewohnheit draus", "erfahrung": "Erfahrung teilen", "teilen": "Teilen",
           "kopiert": "Link kopiert ✓", "passend": "Passt dazu", "geschrieben": "Geschrieben von",
           "rolle": "Coach & Achtsamkeitstrainer", "erstgespraech": "Kostenloses Erstgespräch",
           "nachricht": "Zum Artikel „{}“: "},
    "en": {"essenz": "In essence", "probieren": "Try it", "frage": "A question for you",
           "gewohnheit": "Make it a habit (in German)", "erfahrung": "Share your experience", "teilen": "Share",
           "kopiert": "Link copied ✓", "passend": "Read next", "geschrieben": "Written by",
           "rolle": "coach & mindfulness trainer", "erstgespraech": "Free first conversation",
           "nachricht": "About the article “{}”: "},
}


# ---------------------------------------------------------------- Hilfen

def esc(text):
    return html.escape(str(text), quote=True)


def lesen(pfad):
    """Datei mit Kopfzeilen ('schluessel: wert' bis '---') -> (kopf, inhalt)."""
    text = pfad.read_text(encoding="utf-8")
    kopf_text, trenner, rumpf = text.partition("\n---\n")
    if not trenner:
        raise SystemExit(f"{pfad.relative_to(WURZEL)}: Kopfzeilen muessen mit einer Zeile '---' enden")
    kopf = {}
    for zeile in kopf_text.splitlines():
        if zeile.strip():
            schluessel, _, wert = zeile.partition(":")
            kopf[schluessel.strip()] = wert.strip()
    return kopf, rumpf


def datum_de(iso):
    d = date.fromisoformat(iso)
    return f"{d.day}. {MONATE[d.month - 1]} {d.year}"


def webp_masse(pfad):
    """Breite/Hoehe aus dem WebP-Kopf lesen (spart Pillow im Build)."""
    d = pfad.read_bytes()[:30]
    art = d[12:16]
    if art == b"VP8 ":
        return int.from_bytes(d[26:28], "little") & 0x3FFF, int.from_bytes(d[28:30], "little") & 0x3FFF
    if art == b"VP8L":
        b = int.from_bytes(d[21:25], "little")
        return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    if art == b"VP8X":
        return int.from_bytes(d[24:27], "little") + 1, int.from_bytes(d[27:30], "little") + 1
    raise SystemExit(f"{pfad.name}: kein gueltiges WebP")


def bild(name, alt, klasse="", groessen="(min-width: 900px) 50vw, 100vw", laden="lazy"):
    klein, gross = WURZEL / "bilder" / f"{name}-800.webp", WURZEL / "bilder" / f"{name}-1600.webp"
    if not klein.exists():
        raise SystemExit(f"Bild fehlt: bilder/{name}-800.webp (mit werkzeuge/bild.py anlegen)")
    b1, h1 = webp_masse(klein)
    b2, _ = webp_masse(gross)
    quellen = f"/bilder/{name}-800.webp {b1}w"
    if b2 > b1:
        quellen += f", /bilder/{name}-1600.webp {b2}w"
    k = f' class="{klasse}"' if klasse else ""
    prio = ' fetchpriority="high"' if laden == "eager" else ""
    return (f'<img{k} src="/bilder/{name}-800.webp" srcset="{quellen}" sizes="{groessen}" '
            f'width="{b1}" height="{h1}" alt="{esc(alt)}" loading="{laden}" decoding="async"{prio}>')


def buchung(link=""):
    return link or E["buchung_url"] or "/#kontakt"


def bilder_einsetzen(text):
    # {{bild name "Alternativtext" "css-klasse" "eager"}} - Klasse und "eager" (sofort laden) sind optional
    return re.sub(r'\{\{bild ([a-z0-9-]+) "([^"]*)"(?: "([^"]*)")?(?: "(eager)")?\}\}',
                  lambda m: bild(m.group(1), m.group(2), m.group(3) or "", laden=m.group(4) or "lazy"), text)


def kontakt_link(anliegen, nachricht=""):
    """Link zum Kontaktformular der Startseite, das Anliegen (und Nachricht) schon ausgefuellt."""
    werte = {"anliegen": anliegen, **({"nachricht": nachricht} if nachricht else {})}
    return "/?" + urlencode(werte, quote_via=quote) + "#kontakt"


# ---------------------------------------------------------------- Artikel

def artikel_laden():
    liste = []
    for pfad in sorted((INHALT / "artikel").glob("*.html")):
        kopf, rumpf = lesen(pfad)
        if kopf.get("entwurf", "").lower() in ("ja", "true"):
            continue
        woerter = len(re.sub(r"<[^>]+>", " ", rumpf).split())
        liste.append({**kopf, "slug": pfad.stem, "inhalt": rumpf, "minuten": max(1, math.ceil(woerter / 200))})
    return sorted(liste, key=lambda a: a["datum"], reverse=True)


def karte(a):
    sprache = ' <span class="marke" title="Artikel auf Englisch">EN</span>' if a.get("sprache") == "en" else ""
    bild_html = bild(a["bild"], a.get("bildtext", a["titel"]), groessen="(min-width: 700px) 360px, 100vw") if a.get("bild") else ""
    return f"""<article class="karte">
  <a class="karte-bild" href="/post/{a['slug']}/" tabindex="-1" aria-hidden="true">{bild_html}</a>
  <div class="karte-text">
    <p class="meta">{datum_de(a['datum'])} · {a['minuten']} Min. Lesezeit{sprache}</p>
    <h3><a href="/post/{a['slug']}/">{esc(a['titel'])}</a></h3>
    <p>{esc(a['beschreibung'])}</p>
  </div>
</article>"""


def raster(artikel):
    return '<div class="raster">\n' + "\n".join(karte(a) for a in artikel) + "\n</div>"


def passende_artikel(a, alle, anzahl=3):
    gleich = [x for x in alle if x is not a and x.get("thema") == a.get("thema")]
    rest = [x for x in alle if x is not a and x not in gleich]
    return (gleich + rest)[:anzahl]


def artikel_seite(a, alle):
    sprache = a.get("sprache", "de")
    t = TEXTE[sprache]
    titelbild = ""
    if a.get("bild") and a.get("titelbild") != "nein":
        titelbild = f'<figure class="titelbild">{bild(a["bild"], a.get("bildtext", a["titel"]), laden="eager", groessen="(min-width: 800px) 760px, 100vw")}</figure>'
    essenz = ""
    if a.get("essenz"):
        punkte = "".join(f"<li>{esc(p.strip())}</li>" for p in a["essenz"].split(" | "))
        essenz = f'<aside class="essenz"><p class="essenz-titel">{t["essenz"]}</p><ul>{punkte}</ul></aside>'
    mitnehmen = ""
    if a.get("uebung"):
        passend = UEBUNG.get(a.get("passend", ""))
        gewohnheit = (f'<p class="gewohnheit-link">{t["gewohnheit"]}: <a href="/gewohnheiten/#{passend["slug"]}">'
                      f'{passend["emoji"]} {esc(passend["titel"])}</a></p>') if passend else ""
        frage = f'<p class="frage"><strong>{t["frage"]}:</strong> {esc(a["frage"])}</p>' if a.get("frage") else ""
        mitnehmen = f"""<section class="mitnehmen">
    <h2>{t["probieren"]}</h2>
    <p>{esc(a["uebung"])}</p>
    {frage}
    {gewohnheit}
  </section>"""
    thema = next((th for th in THEMEN if th["slug"] == a.get("thema")), None)
    thema_link = f' · <a href="/thema/{thema["slug"]}/">{esc(thema["titel"])}</a>' if thema else ""
    feedback = kontakt_link("Feedback zu einem Artikel", t["nachricht"].format(a["titel"]))
    url = f"{E['domain']}/post/{a['slug']}/"
    whatsapp = "https://wa.me/?text=" + quote(f"{a['titel']} – {url}")
    ld = {
        "@context": "https://schema.org", "@type": "BlogPosting", "headline": a["titel"],
        "datePublished": a["datum"], "inLanguage": sprache,
        "author": {"@type": "Person", "name": E["autor"], "url": E["domain"] + "/about/"},
        "mainEntityOfPage": url, "description": a["beschreibung"],
    }
    if a.get("bild"):
        ld["image"] = f"{E['domain']}/bilder/{a['bild']}-1600.webp"
    inhalt = f"""<article class="beitrag huelle-schmal" lang="{sprache}">
  <header class="beitrag-kopf">
    <p class="meta" lang="de"><a href="/blog/">Artikel</a>{thema_link} · {datum_de(a['datum'])} · {a['minuten']} Min. Lesezeit</p>
    <h1>{esc(a['titel'])}</h1>
  </header>
  {titelbild}
  {essenz}
  <div class="fliesstext">
{bilder_einsetzen(a['inhalt'])}
  </div>
  {mitnehmen}
  <div class="interaktion">
    <a class="knopf" href="{esc(feedback)}">{t["erfahrung"]}</a>
    <button class="knopf zweit" type="button" data-teilen data-kopiert="{t["kopiert"]}" hidden>{t["teilen"]}</button>
    <a class="knopf zweit" href="{esc(whatsapp)}" rel="noopener">WhatsApp</a>
  </div>
  <p class="autor-zeile">{t["geschrieben"]} <a href="/about/">{esc(E['autor'])}</a>, {t["rolle"]} · <a href="{esc(buchung())}">{t["erstgespraech"]}</a></p>
</article>
<section class="huelle passend" lang="de">
  <h2>{t["passend"]}</h2>
  {raster(passende_artikel(a, alle))}
</section>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>"""
    return seite(a["titel"], a["beschreibung"], f"/post/{a['slug']}/", inhalt,
                 og_bild=a.get("bild"), og_typ="article")


# ---------------------------------------------------------------- Themen und Uebungen

def themen_chips(aktiv):
    chips = [("/blog/", "Alle", aktiv is None)] + [(f"/thema/{t['slug']}/", t["titel"], aktiv == t["slug"]) for t in THEMEN]
    return ('<nav class="chips" aria-label="Themen">'
            + "".join(f'<a href="{z}"' + (' aria-current="page"' if an else "") + f">{esc(x)}</a>" for z, x, an in chips)
            + "</nav>")


def themen_html():
    kacheln = []
    for t in THEMEN:
        anzahl = sum(a.get("thema") == t["slug"] for a in artikel_laden())
        kacheln.append(f"""<a class="thema-kachel" href="/thema/{t['slug']}/">
  {bild(t["bild"], "", groessen="(min-width: 900px) 270px, 100vw")}
  <span class="thema-text"><strong>{esc(t['titel'])}</strong><span>{esc(t['essenz'])}</span><span class="meta">{anzahl} Artikel →</span></span>
</a>""")
    return '<div class="themen">\n' + "\n".join(kacheln) + "\n</div>"


def thema_seite(t, artikel):
    liste = [a for a in artikel if a.get("thema") == t["slug"]]
    inhalt = f"""<section class="abschnitt">
  <div class="huelle">
    <div class="abschnitt-kopf">
      <p class="oberzeile">Thema</p>
      <h1>{esc(t['titel'])}</h1>
      <p>{esc(t['essenz'])}</p>
    </div>
    {themen_chips(t['slug'])}
    {raster(liste)}
    <p class="mehr"><a class="knopf zweit" href="/gewohnheiten/">Übungen für jeden Tag</a></p>
  </div>
</section>"""
    return seite(t["titel"], t["essenz"], f"/thema/{t['slug']}/", inhalt, og_bild=t["bild"])


def text_html(text):
    """Klartext aus Habitica (Absaetze, '- ' Listen, Links) -> HTML."""
    text = re.sub(r"(\n[-*] [^\n]*)\n\s*\n(?=[-*] )", r"\1\n", text)
    teile = []
    for block in re.split(r"\n\s*\n", text.strip()):
        zeilen, liste, absatz = block.split("\n"), [], []

        def absatz_abschliessen():
            if absatz:
                teile.append("<p>" + "<br>".join(absatz) + "</p>")
                absatz.clear()

        def liste_abschliessen():
            if liste:
                teile.append("<ul>" + "".join(f"<li>{z}</li>" for z in liste) + "</ul>")
                liste.clear()

        for zeile in zeilen:
            inhalt = esc(zeile.strip())
            inhalt = re.sub(r"(https?://[^\s<]+)", r'<a href="\1" target="_blank" rel="noopener">\1</a>', inhalt)
            if re.match(r"^[-*] ", zeile.strip()):
                absatz_abschliessen()
                liste.append(inhalt[2:].strip())
            else:
                liste_abschliessen()
                if inhalt:
                    absatz.append(inhalt)
        absatz_abschliessen()
        liste_abschliessen()
    return "\n".join(teile)


def uebung_karte(u):
    abhaken = (f'<label class="erledigt" hidden><input type="checkbox" data-quest="{u["slug"]}"> Erledigt</label>'
               if u["art"] == "quest" else "")
    return f"""<article class="uebung" id="{u['slug']}">
  <details>
    <summary><span class="uebung-emoji" aria-hidden="true">{u['emoji']}</span><span class="uebung-kopf"><span class="uebung-titel">{esc(u['titel'])}</span><span class="uebung-erklaerung">{esc(u['erklaerung'])}</span></span></summary>
    <div class="uebung-text">{text_html(u['text'])}
      <p><a class="in-app" href="/app/#neu={u['slug']}">{"Als Quest in der App starten" if u["art"] == "quest" else "In meine Routinen aufnehmen"} →</a></p>
    </div>
  </details>
  {abhaken}
</article>"""


def uebungen_html():
    gewohnheiten = [u for u in UEBUNGEN if u["art"] == "gewohnheit"]
    taeglich = [u for u in UEBUNGEN if u["art"] == "taeglich"]
    quests = [u for u in UEBUNGEN if u["art"] == "quest"]
    raster_ = lambda liste: '<div class="uebungen">' + "\n".join(uebung_karte(u) for u in liste) + "</div>"
    gruppen = list(dict.fromkeys(u["gruppe"] for u in quests))
    quest_html = "".join(f'<h3 class="gruppe">{esc(g)}</h3>' + raster_([u for u in quests if u["gruppe"] == g])
                         for g in gruppen)
    nach_bereich = "".join(
        f'<h3 class="gruppe">{b["emoji"]} {esc(b["titel"])} <span class="gruppe-text">– {esc(b["text"])}</span></h3>'
        + raster_([u for u in gewohnheiten if u["bereich"] == b["slug"]])
        for b in BEREICHE if any(u["bereich"] == b["slug"] for u in gewohnheiten))
    return f"""<h2 id="gewohnheiten-liste">{len(gewohnheiten)} Gewohnheiten</h2>
<p class="unterzeile">Keine Zusatzaufgaben, sondern ein Fokus darauf, <em>wie</em> du etwas tust. Fang mit einem Bereich an, der dich gerade anspricht. Tippe eine Gewohnheit an für Ideen und Hintergrund.</p>
{nach_bereich}
<h2 id="taeglich">{len(taeglich)} tägliche Aufgaben</h2>
<p class="unterzeile">Kleine tägliche Begleiter, die dir guttun – auch fünf Minuten zählen.</p>
{raster_(taeglich)}
<h2 id="quests">{len(quests)} Quests</h2>
<p class="unterzeile">Erlebnisse, die du dir vornehmen kannst, wann immer du magst. Hake ab, was du geschafft hast.</p>
<div class="fortschritt" data-fortschritt hidden>
  <p><strong data-erledigt>0</strong> von {len(quests)} Quests · <strong data-xp>0</strong> XP · Level <strong data-level>1</strong></p>
  <div class="balken"><span data-balken></span></div>
  <p class="klein">Dein Fortschritt bleibt nur in diesem Browser gespeichert. Nichts davon wird übertragen.</p>
</div>
{quest_html}"""


def impuls_html():
    pool = [u for u in UEBUNGEN if u["art"] in ("gewohnheit", "quest")]
    daten = [{"s": u["slug"], "a": ART[u["art"]] + (f" · {u['gruppe']}" if u["gruppe"] else ""), "e": u["emoji"],
              "t": u["titel"], "k": u["erklaerung"]} for u in pool]
    d = daten[date.today().toordinal() % len(daten)]
    json_text = json.dumps(daten, ensure_ascii=False).replace("</", "<\\/")
    return f"""<div class="impuls" data-impuls>
  <p class="impuls-art" data-feld="art">{esc(d['a'])}</p>
  <div class="impuls-emoji" data-feld="emoji" aria-hidden="true">{d['e']}</div>
  <h3 data-feld="titel">{esc(d['t'])}</h3>
  <p data-feld="kurz">{esc(d['k'])}</p>
  <div class="knopf-reihe">
    <a class="knopf" data-feld="app" href="/app/#neu={d['s']}">In meine Routinen</a>
    <a class="knopf zweit" data-feld="link" href="/gewohnheiten/#{d['s']}">Ganze Übung</a>
    <button class="knopf zweit" type="button" data-neu hidden>Anderer Impuls ↻</button>
  </div>
</div>
<script type="application/json" id="impuls-daten">{json_text}</script>"""


# ---------------------------------------------------------------- Bausteine fuer Seiten

def angebote_html():
    angebote = json.loads((INHALT / "angebote.json").read_text(encoding="utf-8"))
    teile = []
    for an in angebote:
        klasse = "angebot hervorgehoben" if an.get("hervorheben") else "angebot"
        bild_html = bild(an["bild"], an["titel"], "angebot-bild", "(min-width: 900px) 260px, 100vw") if an.get("bild") else ""
        knopf = "Termin buchen" if an.get("buchung") or E["buchung_url"] else "Anfragen"
        teile.append(f"""<article class="{klasse}">
  {bild_html}
  <div class="angebot-text">
    <h3>{esc(an['titel'])}</h3>
    <p class="preis"><span>{esc(an['dauer'])}</span><strong>{esc(an['preis'])}</strong></p>
    <p>{esc(an['text'])}</p>
    <a class="knopf{' zweit' if not an.get('hervorheben') else ''}" href="{esc(buchung(an.get('buchung')))}">{knopf}</a>
  </div>
</article>""")
    return '<div class="angebote">\n' + "\n".join(teile) + "\n</div>"


def kontakt_html(vorauswahl=""):
    if not E["formular_schluessel"]:
        wege = []
        if E.get("linkedin"):
            wege.append(f'<a href="{esc(E["linkedin"])}" rel="noopener">LinkedIn</a>')
        if E.get("instagram"):
            wege.append(f'<a href="{esc(E["instagram"])}" rel="noopener">Instagram</a>')
        return (f'<div class="hinweis"><p>Das Kontaktformular wird gerade eingerichtet. '
                f'Bis dahin erreichst du mich über {" oder ".join(wege)}.</p></div>')
    return f"""<form class="formular" action="https://api.web3forms.com/submit" method="POST" data-kontakt>
  <input type="hidden" name="access_key" value="{esc(E['formular_schluessel'])}">
  <input type="hidden" name="subject" value="Neue Anfrage über phoenix-feder.de">
  <input type="hidden" name="from_name" value="phoenix-feder.de">
  <input type="hidden" name="redirect" value="{E['domain']}/danke/">
  <input type="checkbox" name="botcheck" class="versteckt" tabindex="-1" autocomplete="off" aria-hidden="true">
  <div class="felder">
    <label><span>Vorname <span aria-hidden="true">*</span></span><input name="Vorname" required autocomplete="given-name"></label>
    <label><span>Nachname</span><input name="Nachname" autocomplete="family-name"></label>
    <label><span>E-Mail <span aria-hidden="true">*</span></span><input type="email" name="email" required autocomplete="email"></label>
    <label><span>Telefon</span><input type="tel" name="Telefon" autocomplete="tel"></label>
  </div>
  <label><span>Worum geht es?</span>
    <select name="Anliegen">
      {"".join(f"<option{' selected' if a == vorauswahl else ''}>{a}</option>" for a in ANLIEGEN)}
    </select>
  </label>
  <label><span>Nachricht <span aria-hidden="true">*</span></span><textarea name="message" rows="5" required></textarea></label>
  <p class="klein">Deine Angaben nutze ich nur, um deine Anfrage zu beantworten. Mehr dazu in der <a href="/datenschutz/">Datenschutzerklärung</a>.</p>
  <button class="knopf" type="submit">Nachricht senden</button>
  <p class="status" role="status" aria-live="polite"></p>
</form>
<script src="/kontakt.js" defer></script>"""


def bausteine_einsetzen(text, artikel):
    text = re.sub(r"<!--.*?-->\s*", "", text, flags=re.S)  # Notizen in Inhaltsdateien bleiben intern
    ersatz = {
        "{{angebote}}": angebote_html,
        "{{neueste_artikel}}": lambda: raster(artikel[:3]),
        "{{alle_artikel}}": lambda: raster(artikel),
        "{{impuls}}": impuls_html,
        "{{themen}}": themen_html,
        "{{themen_chips}}": lambda: themen_chips(None),
        "{{uebungen}}": uebungen_html,
        "{{habitica_url}}": lambda: esc(E["habitica_challenge"]),
        "{{buchung_url}}": lambda: esc(buchung()),
        "{{name}}": lambda: esc(E["name"]),
        "{{autor}}": lambda: esc(E["autor"]),
    }
    for marke, erzeuger in ersatz.items():
        if marke in text:
            text = text.replace(marke, erzeuger())
    text = re.sub(r"\{\{kontakt(?: ([^}]+))?\}\}", lambda m: kontakt_html(m.group(1) or ""), text)
    text = bilder_einsetzen(text)
    rest = re.findall(r"\{\{[^}]+\}\}", text)
    if rest:
        raise SystemExit(f"Unbekannter Baustein: {rest[0]}")
    return text


# ---------------------------------------------------------------- Seitengeruest

def seite(titel, beschreibung, pfad, inhalt, og_bild=None, og_typ="website", indexieren=True):
    voller_titel = E["name"] + " – " + E["untertitel"] if pfad == "/" else f"{titel} | {E['name']}"
    url = E["domain"] + pfad
    og = f"{E['domain']}/bilder/{og_bild or 'feder'}-1600.webp"
    navi = ""
    for ziel, text in NAVI:
        aktiv = pfad.startswith(ziel) or (ziel == "/blog/" and pfad.startswith(("/post/", "/thema/")))
        navi += f'<a href="{ziel}"' + (' aria-current="page"' if aktiv else "") + f">{text}</a>"
    kanonisch = f'<link rel="canonical" href="{url}">' if indexieren else '<meta name="robots" content="noindex">'
    jahr = date.today().year
    sozial = "".join(
        f'<a href="{esc(E[k])}" rel="noopener">{t}</a>' for k, t in (("instagram", "Instagram"), ("linkedin", "LinkedIn")) if E.get(k))
    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(voller_titel)}</title>
<meta name="description" content="{esc(beschreibung)}">
{kanonisch}
<meta property="og:type" content="{og_typ}">
<meta property="og:title" content="{esc(titel)}">
<meta property="og:description" content="{esc(beschreibung)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta property="og:site_name" content="{esc(E['name'])}">
<meta property="og:locale" content="de_DE">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#fbf7f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1b1613" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="{esc(E['name'])} – Artikel" href="/feed.xml">
<link rel="preload" href="/schriften/fraunces.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/stil.css">
<script src="/seite.js" defer></script>
</head>
<body>
<a class="sprung" href="#inhalt">Zum Inhalt springen</a>
<header class="kopf">
  <div class="huelle kopf-innen">
    <a class="logo" href="/" aria-label="{esc(E['name'])} – Startseite">
      <svg viewBox="0 0 32 32" aria-hidden="true"><use href="/favicon.svg#feder"/></svg>
      <span>{esc(E['name'])}</span>
    </a>
    <nav class="navi" aria-label="Hauptmenü">{navi}</nav>
    <a class="knopf klein-knopf kopf-knopf" href="/app/">Meine Routinen</a>
  </div>
</header>
<main id="inhalt">
{inhalt}
</main>
<footer class="fuss">
  <div class="huelle fuss-innen">
    <div>
      <p class="logo-text">{esc(E['name'])}</p>
      <p>{esc(E['untertitel'])}</p>
    </div>
    <nav aria-label="Fußzeile">
      <a href="/blog/">Artikel</a><a href="/gewohnheiten/">Gewohnheiten</a><a href="/app/">App: Meine Routinen</a><a href="/book-online/">Begleitung</a><a href="/about/">Über mich</a>
      <a href="/feed.xml">RSS</a>{sozial}
    </nav>
    <nav aria-label="Rechtliches">
      <a href="/impressum/">Impressum</a><a href="/datenschutz/">Datenschutz</a>
    </nav>
  </div>
  <p class="huelle klein">© {jahr} {esc(E['autor'])}</p>
</footer>
</body>
</html>
"""


def relativ(text, tiefe):
    """'/blog/' -> '../blog/' usw. So laeuft die Seite unter jeder Adresse: eigene Domain,
    github.io-Vorschau (Unterordner) oder lokal. Absolute Domain-Links (canonical, og) bleiben."""
    vorne = "../" * tiefe or "./"
    text = re.sub(r'((?:href|src)=")/(?!/)', lambda m: m.group(1) + vorne, text)
    return re.sub(r'srcset="([^"]+)"',
                  lambda m: 'srcset="' + re.sub(r"(^|,\s*)/(?!/)", lambda n: n.group(1) + vorne, m.group(1)) + '"', text)


def schreiben(pfad_url, text):
    ziel = AUSGABE / pfad_url.lstrip("/")
    if pfad_url.endswith("/"):
        ziel = ziel / "index.html"
        # 404.html wird unter beliebigen Adressen ausgeliefert, dort muessen Links absolut bleiben
        text = relativ(text, pfad_url.count("/") - 1)
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(text, encoding="utf-8")


def umleitung(alt, neu):
    """GitHub Pages kann keine Server-Umleitungen; alte Wix-Adressen leiten per HTML weiter."""
    schreiben(alt, f"""<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Weiterleitung</title><link rel="canonical" href="{E['domain']}{neu}">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url={"../" * (alt.count("/") - 1)}{neu.lstrip("/")}">
</head><body><p><a href="{neu}">Weiter</a></p></body></html>
""")


# ---------------------------------------------------------------- App "Meine Routinen"

def app_bauen():
    """Kopiert app/ nach docs/app/, schreibt die Uebungen als daten.json und versioniert den Service Worker."""
    ziel = AUSGABE / "app"
    shutil.copytree(WURZEL / "app", ziel)
    daten = {
        "uebungen": [{"slug": u["slug"], "art": u["art"], "gruppe": u["gruppe"], "emoji": u["emoji"],
                      "titel": u["titel"], "kurz": u["erklaerung"], "bereich": u["bereich"],
                      "html": text_html(u["text"])} for u in UEBUNGEN],
        "bereiche": BEREICHE,
        "habitica": E["habitica_challenge"],
    }
    (ziel / "daten.json").write_text(json.dumps(daten, ensure_ascii=False), encoding="utf-8")
    # Neue Version, sobald sich App-Dateien oder Daten aendern -> Service Worker laedt neu
    pruefsumme = hashlib.sha256()
    for datei in sorted(ziel.rglob("*")):
        if datei.is_file() and datei.name != "sw.js":
            pruefsumme.update(datei.read_bytes())
    sw = ziel / "sw.js"
    sw.write_text(sw.read_text(encoding="utf-8").replace("__VERSION__", pruefsumme.hexdigest()[:12]), encoding="utf-8")


# ---------------------------------------------------------------- Feed, Sitemap, Pruefung

def feed(artikel):
    eintraege = []
    for a in artikel[:20]:
        zeit = format_datetime(datetime.fromisoformat(a["datum"]).replace(hour=9, tzinfo=timezone.utc))
        url = f"{E['domain']}/post/{a['slug']}/"
        eintraege.append(f"""  <item>
    <title>{esc(a['titel'])}</title>
    <link>{url}</link>
    <guid>{url}</guid>
    <pubDate>{zeit}</pubDate>
    <description>{esc(a['beschreibung'])}</description>
  </item>""")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>{esc(E['name'])}</title>
  <link>{E['domain']}/</link>
  <description>{esc(E['beschreibung'])}</description>
  <language>de</language>
{chr(10).join(eintraege)}
</channel>
</rss>
"""


def sitemap(urls):
    zeilen = "".join(f"  <url><loc>{E['domain']}{u}</loc>{f'<lastmod>{d}</lastmod>' if d else ''}</url>\n" for u, d in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{zeilen}</urlset>\n'


def pruefen():
    """Jeder interne Link und jede Quelle muss auf eine vorhandene Datei in docs/ zeigen."""
    fehler, platzhalter = [], []
    for datei in AUSGABE.rglob("*.html"):
        text = datei.read_text(encoding="utf-8")
        rel = datei.relative_to(AUSGABE)
        for treffer in PLATZHALTER.findall(text):
            platzhalter.append(f"{rel}: [[{treffer}]]")
        ziele = re.findall(r'(?:href|src)="([^"]*)"', text)
        ziele += [teil.strip().split(" ")[0] for s in re.findall(r'srcset="([^"]+)"', text) for teil in s.split(",")]
        for ziel in ziele:
            ziel = ziel.split("#")[0].split("?")[0]
            if not ziel or re.match(r"^[a-z]+:|^//", ziel):
                continue  # extern, mailto oder reiner Sprung innerhalb der Seite
            pfad = AUSGABE / ziel.lstrip("/") if ziel.startswith("/") else datei.parent / ziel
            if ziel.endswith("/") or pfad.is_dir():
                pfad = pfad / "index.html"
            if not pfad.resolve().is_relative_to(AUSGABE) or not pfad.exists():
                fehler.append(f"{rel}: {ziel} fehlt")
    return fehler, platzhalter


# ---------------------------------------------------------------- Ablauf

def main():
    streng = "--streng" in sys.argv
    if AUSGABE.exists():
        shutil.rmtree(AUSGABE)
    AUSGABE.mkdir()
    artikel = artikel_laden()
    urls = []

    for pfad in sorted((INHALT / "seiten").glob("*.html")):
        kopf, rumpf = lesen(pfad)
        url = "/" if pfad.stem == "index" else f"/{pfad.stem}/"
        indexieren = kopf.get("indexieren", "ja") != "nein"
        text = seite(kopf["titel"], kopf.get("beschreibung", E["beschreibung"]), url,
                     bausteine_einsetzen(rumpf, artikel), og_bild=kopf.get("bild"), indexieren=indexieren)
        if pfad.stem == "404":
            schreiben("/404.html", text)
            continue
        schreiben(url, text)
        if indexieren:
            urls.append((url, None))

    for a in artikel:
        schreiben(f"/post/{a['slug']}/", artikel_seite(a, artikel))
        urls.append((f"/post/{a['slug']}/", a["datum"]))

    for t in THEMEN:
        schreiben(f"/thema/{t['slug']}/", thema_seite(t, artikel))
        urls.append((f"/thema/{t['slug']}/", None))
    unbekannt = sorted({a["thema"] for a in artikel if a.get("thema")} - {t["slug"] for t in THEMEN})
    unbekannt += sorted({a["passend"] for a in artikel if a.get("passend")} - set(UEBUNG))
    if unbekannt:
        raise SystemExit(f"Unbekanntes Thema/unbekannte Übung in Artikeln: {unbekannt}")

    for alt in ("/blog/page/2/", "/blog/page/3/", "/blog/page/4/"):
        umleitung(alt, "/blog/")
    for alt in ("/booking-calendar/", "/service-page/", "/services-4/"):
        umleitung(alt, "/book-online/")

    (AUSGABE / "feed.xml").write_text(feed(artikel), encoding="utf-8")
    shutil.copy(AUSGABE / "feed.xml", AUSGABE / "blog-feed.xml")  # alte Wix-Adresse des Feeds
    (AUSGABE / "sitemap.xml").write_text(sitemap(urls + [("/app/", None)]), encoding="utf-8")
    (AUSGABE / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {E['domain']}/sitemap.xml\n", encoding="utf-8")
    (AUSGABE / "CNAME").write_text(E["domain"].split("://")[1] + "\n", encoding="utf-8")
    (AUSGABE / ".nojekyll").write_text("", encoding="utf-8")
    for datei in ("stil.css", "kontakt.js", "seite.js", "favicon.svg"):
        shutil.copy(WURZEL / datei, AUSGABE / datei)
    shutil.copytree(WURZEL / "schriften", AUSGABE / "schriften")
    shutil.copytree(WURZEL / "bilder", AUSGABE / "bilder")
    app_bauen()

    fehler, platzhalter = pruefen()
    seiten = len(list(AUSGABE.rglob("*.html")))
    print(f"Gebaut: {seiten} Seiten, {len(artikel)} Artikel -> docs/")
    if platzhalter:
        print(f"\nOFFEN ({len(platzhalter)} Platzhalter - vor dem Livegang ausfuellen):")
        for p in sorted(set(platzhalter)):
            print("  " + p)
    for schluessel, zweck in (("formular_schluessel", "Kontaktformular"), ("buchung_url", "Online-Buchung")):
        if not E[schluessel]:
            print(f"HINWEIS: einstellungen.json -> {schluessel} ist leer ({zweck} noch nicht aktiv)")
    if fehler:
        print(f"\nFEHLER ({len(fehler)} kaputte Links):")
        for f in fehler:
            print("  " + f)
        sys.exit(1)
    if streng and platzhalter:
        sys.exit(1)


if __name__ == "__main__":
    main()
