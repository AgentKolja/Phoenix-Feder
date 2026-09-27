#!/usr/bin/env python3
"""Baut die Website aus inhalt/ nach docs/ (das veroeffentlicht GitHub Pages).

Aufruf:  python3 bauen.py            baut und prueft
         python3 bauen.py --streng   bricht zusaetzlich ab, solange Platzhalter [[...]] offen sind

Nur Python-Standardbibliothek. Der Build prueft am Ende jeden internen Link und jedes Bild;
ist etwas kaputt, endet er mit Fehlercode 1 und docs/ darf so nicht veroeffentlicht werden.
"""
import html
import json
import math
import re
import shutil
import sys
from datetime import date, datetime, timezone
from email.utils import format_datetime
from pathlib import Path

WURZEL = Path(__file__).resolve().parent
INHALT = WURZEL / "inhalt"
AUSGABE = WURZEL / "docs"
E = json.loads((WURZEL / "einstellungen.json").read_text(encoding="utf-8"))
MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
          "September", "Oktober", "November", "Dezember"]
PLATZHALTER = re.compile(r"\[\[(.+?)\]\]")
NAVI = [("/blog/", "Artikel"), ("/book-online/", "Angebote"), ("/about/", "Über mich"), ("/#kontakt", "Kontakt")]


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


def artikel_seite(a, alle):
    i = alle.index(a)
    neuer, aelter = (alle[i - 1] if i > 0 else None), (alle[i + 1] if i + 1 < len(alle) else None)
    weiter = ""
    if neuer or aelter:
        weiter = '<nav class="weiter" aria-label="Weitere Artikel">'
        if aelter:
            weiter += f'<a href="/post/{aelter["slug"]}/"><span>Älterer Artikel</span>{esc(aelter["titel"])}</a>'
        if neuer:
            weiter += f'<a class="rechts" href="/post/{neuer["slug"]}/"><span>Neuerer Artikel</span>{esc(neuer["titel"])}</a>'
        weiter += "</nav>"
    titelbild = ""
    if a.get("bild"):
        titelbild = f'<figure class="titelbild">{bild(a["bild"], a.get("bildtext", a["titel"]), laden="eager", groessen="(min-width: 800px) 760px, 100vw")}</figure>'
    ld = {
        "@context": "https://schema.org", "@type": "BlogPosting", "headline": a["titel"],
        "datePublished": a["datum"], "inLanguage": a.get("sprache", "de"),
        "author": {"@type": "Person", "name": E["autor"], "url": E["domain"] + "/about/"},
        "mainEntityOfPage": f"{E['domain']}/post/{a['slug']}/", "description": a["beschreibung"],
    }
    if a.get("bild"):
        ld["image"] = f"{E['domain']}/bilder/{a['bild']}-1600.webp"
    inhalt = f"""<article class="beitrag huelle-schmal" lang="{a.get('sprache', 'de')}">
  <header class="beitrag-kopf">
    <p class="meta"><a href="/blog/">Artikel</a> · {datum_de(a['datum'])} · {a['minuten']} Min. Lesezeit</p>
    <h1>{esc(a['titel'])}</h1>
  </header>
  {titelbild}
  <div class="fliesstext">
{a['inhalt']}
  </div>
</article>
<aside class="huelle-schmal autor" lang="de">
  {bild('nikolas-portrait', 'Nikolas Voth', 'autor-bild', groessen='96px')}
  <div>
    <p class="autor-name">{esc(E['autor'])}</p>
    <p>Coach, Achtsamkeitstrainer und Autor. Wenn dich dieser Artikel berührt hat und du tiefer einsteigen möchtest: Das erste Gespräch ist kostenlos.</p>
    <a class="knopf" href="{esc(buchung())}">Kostenloses Erstgespräch</a>
  </div>
</aside>
<div class="huelle-schmal">{weiter}</div>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>"""
    return seite(a["titel"], a["beschreibung"], f"/post/{a['slug']}/", inhalt,
                 og_bild=a.get("bild"), og_typ="article")


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


def kontakt_html():
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
    <label>Vorname <span aria-hidden="true">*</span><input name="Vorname" required autocomplete="given-name"></label>
    <label>Nachname<input name="Nachname" autocomplete="family-name"></label>
    <label>E-Mail <span aria-hidden="true">*</span><input type="email" name="email" required autocomplete="email"></label>
    <label>Telefon<input type="tel" name="Telefon" autocomplete="tel"></label>
  </div>
  <label>Worum geht es?
    <select name="Anliegen">
      <option>Kostenloses Erstgespräch</option><option>Persönliches Coaching</option>
      <option>Achtsamkeitstraining</option><option>Yoga-Training</option><option>Etwas anderes</option>
    </select>
  </label>
  <label>Nachricht <span aria-hidden="true">*</span><textarea name="message" rows="5" required></textarea></label>
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
        "{{kontakt}}": kontakt_html,
        "{{buchung_url}}": lambda: esc(buchung()),
        "{{name}}": lambda: esc(E["name"]),
        "{{autor}}": lambda: esc(E["autor"]),
    }
    for marke, erzeuger in ersatz.items():
        if marke in text:
            text = text.replace(marke, erzeuger())
    # {{bild name "Alternativtext" "css-klasse" "eager"}} - Klasse und "eager" (sofort laden) sind optional
    text = re.sub(r'\{\{bild ([a-z0-9-]+) "([^"]*)"(?: "([^"]*)")?(?: "(eager)")?\}\}',
                  lambda m: bild(m.group(1), m.group(2), m.group(3) or "", laden=m.group(4) or "lazy"), text)
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
        aktiv = pfad.startswith(ziel) or (ziel == "/blog/" and pfad.startswith("/post/"))
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
    <a class="knopf klein-knopf kopf-knopf" href="{esc(buchung())}">Erstgespräch</a>
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
      <a href="/blog/">Artikel</a><a href="/book-online/">Angebote</a><a href="/about/">Über mich</a>
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

    for alt in ("/blog/page/2/", "/blog/page/3/", "/blog/page/4/"):
        umleitung(alt, "/blog/")
    for alt in ("/booking-calendar/", "/service-page/", "/services-4/"):
        umleitung(alt, "/book-online/")

    (AUSGABE / "feed.xml").write_text(feed(artikel), encoding="utf-8")
    shutil.copy(AUSGABE / "feed.xml", AUSGABE / "blog-feed.xml")  # alte Wix-Adresse des Feeds
    (AUSGABE / "sitemap.xml").write_text(sitemap(urls), encoding="utf-8")
    (AUSGABE / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {E['domain']}/sitemap.xml\n", encoding="utf-8")
    (AUSGABE / "CNAME").write_text(E["domain"].split("://")[1] + "\n", encoding="utf-8")
    (AUSGABE / ".nojekyll").write_text("", encoding="utf-8")
    for datei in ("stil.css", "kontakt.js", "favicon.svg"):
        shutil.copy(WURZEL / datei, AUSGABE / datei)
    shutil.copytree(WURZEL / "schriften", AUSGABE / "schriften")
    shutil.copytree(WURZEL / "bilder", AUSGABE / "bilder")

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
