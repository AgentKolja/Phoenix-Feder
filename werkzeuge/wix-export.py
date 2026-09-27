#!/usr/bin/env python3
"""Einmaliger Umzug: holt alle Blogartikel von der Wix-Seite und legt sie als
inhalt/artikel/<slug>.html ab (Kopfzeilen + sauberes HTML), Titelbilder nach bilder/.

Aufruf:  python3 werkzeuge/wix-export.py
Braucht Netzzugang und Pillow. Laeuft nur, solange die Wix-Seite noch online ist.
Vorhandene Artikeldateien werden nicht ueberschrieben (Handarbeit bleibt erhalten).
"""
import html
import json
import re
import sys
import tempfile
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bild import vorbereiten  # noqa: E402

WURZEL = Path(__file__).resolve().parent.parent
SEITE = "https://www.phoenix-feder.de"
AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

# Wix nutzt Ueberschriften als Schriftgroessen; auf der neuen Seite zaehlt nur die Gliederung.
UEBERSCHRIFT = {"h1": "h2", "h2": "h2", "h3": "h3", "h4": "h3", "h5": "h3", "h6": "h4"}
BEHALTEN = {"p", "ul", "ol", "li", "strong", "em", "blockquote", "br", "a"}
UMBENENNEN = {"b": "strong", "i": "em", "u": "em"}
LEER = {"br", "img", "hr", "input", "meta", "link", "source", "wbr"}


def laden(url):
    anfrage = urllib.request.Request(url, headers={"User-Agent": AGENT})
    with urllib.request.urlopen(anfrage, timeout=60) as antwort:
        return antwort.read()


def link_saeubern(href):
    """Tracking-Parameter weg, kaputte Wix-Autolinks raus. None = Link entfernen, Text bleibt."""
    href = html.unescape(href)
    teile = urlsplit(href)
    host = teile.netloc.lower()
    if "phoenix-feder.de" in host and "/hashtags/" in teile.path:
        return None
    if "." not in host or host.split(".")[-1] not in ("de", "com", "be", "org", "net", "io"):
        return None  # z. B. "http://again.You" - Wix hat Satzenden fuer Links gehalten
    if "amazon." in host:
        treffer = re.search(r"/(?:dp|gp/product)/([A-Z0-9]{10})", teile.path)
        if treffer:
            return f"https://www.amazon.de/dp/{treffer.group(1)}"
    if host.endswith("youtu.be") or "etsy.com" in host or "weberbuero.de" in host:
        return urlunsplit((teile.scheme, teile.netloc, teile.path, "", ""))
    return href


class Wandler(HTMLParser):
    """Wix-Ricos-HTML -> schlichtes HTML mit einer kleinen Tag-Whitelist."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.teile, self.stapel, self.bilder, self.bildtexte = [], [], [], []
        self.ignorieren = 0
        self.in_bildtext = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in LEER:
            if self.ignorieren:
                return
            if tag == "img" and self.bilder and a.get("alt"):
                self.bildtexte.append(a["alt"])
            if tag == "br" and self._in_absatz():
                self.teile.append("<br>")  # sonst Wix-Leerzeile; Abstaende regelt das CSS
            return
        if tag in ("svg", "button", "style", "script"):
            self.ignorieren += 1
        if self.ignorieren:
            self.stapel.append(None)
            return
        if tag == "wow-image" and a.get("id"):
            self.bilder.append(a["id"])
        if tag == "figcaption":
            self.in_bildtext = True
        ziel = UEBERSCHRIFT.get(tag) or UMBENENNEN.get(tag) or (tag if tag in BEHALTEN else None)
        if ziel == "a":
            href = link_saeubern(a.get("href", ""))
            if href is None:
                ziel = None
            else:
                extern = not href.startswith(SEITE)
                zusatz = ' target="_blank" rel="noopener"' if extern else ""
                self.teile.append(f'<a href="{html.escape(href)}"{zusatz}>')
                self.stapel.append("a")
                return
        if ziel:
            self.teile.append(f"<{ziel}>")
        self.stapel.append(ziel)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in LEER:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in LEER:
            return
        if tag == "figcaption":
            self.in_bildtext = False
        if not self.stapel:
            return
        ziel = self.stapel.pop()
        if tag in ("svg", "button", "style", "script"):
            self.ignorieren -= 1
        if ziel and not self.ignorieren:
            self.teile.append(f"</{ziel}>")

    def handle_data(self, daten):
        if self.ignorieren:
            return
        if self.in_bildtext:
            self.bildtexte.append(daten.strip())
            return
        self.teile.append(html.escape(daten, quote=False))

    def _in_absatz(self):
        return any(t in ("p", "li", "h2", "h3", "h4", "blockquote") for t in self.stapel if t)


def aufraeumen(inhalt):
    inhalt = inhalt.replace(" ", " ").replace("​", "")
    inhalt = re.sub(r"<(strong|em)>(\s*)</\1>", r"\2", inhalt)
    inhalt = re.sub(r"</(strong|em)><\1>", "", inhalt)
    for _ in range(3):
        inhalt = re.sub(r"<(p|h2|h3|h4|li|blockquote|strong|em)>\s*(?:<br>\s*)*</\1>", "", inhalt)
    inhalt = re.sub(r"<br>\s*</(p|li|h2|h3|h4|blockquote)>", r"</\1>", inhalt)
    inhalt = re.sub(r"[ \t]+", " ", inhalt)
    inhalt = re.sub(r"\s*(</?(?:p|h2|h3|h4|ul|ol|li|blockquote)>)\s*", r"\1", inhalt)
    inhalt = re.sub(r"(</(?:p|h2|h3|h4|ul|ol|blockquote)>)", r"\1\n", inhalt)
    inhalt = re.sub(r"(<(?:ul|ol)>)", r"\1\n", inhalt)
    inhalt = re.sub(r"(</li>)", r"\1\n", inhalt)
    return inhalt.strip() + "\n"


def sprache(text):
    woerter = re.findall(r"[a-zäöüß]+", text.lower())
    de = sum(w in {"und", "der", "die", "das", "ist", "nicht", "du", "ich", "mit", "zu"} for w in woerter)
    en = sum(w in {"and", "the", "is", "not", "you", "your", "with", "to", "of", "it"} for w in woerter)
    return "de" if de >= en else "en"


def kurztext(text, laenge=155):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= laenge:
        return text
    return text[:laenge].rsplit(" ", 1)[0].rstrip(",;:-–") + " …"


def artikel_exportieren(slug):
    ziel = WURZEL / "inhalt" / "artikel" / f"{slug}.html"
    if ziel.exists():
        print(f"{slug}: existiert schon, uebersprungen")
        return
    seite = laden(f"{SEITE}/post/{slug}").decode("utf-8")
    meta = dict(re.findall(r'<meta (?:property|name)="([^"]+)" content="([^"]*)"', seite))
    titel = html.unescape(meta["og:title"])
    datum = meta["article:published_time"][:10]
    anfang = seite.index('data-id="content-viewer"')
    ende = seite.index('data-hook="post-footer"', anfang)
    wandler = Wandler()
    wandler.feed(seite[seite.index(">", anfang) + 1:ende])
    inhalt = aufraeumen("".join(wandler.teile))
    klartext = html.unescape(re.sub(r"<[^>]+>", " ", inhalt))

    absaetze = html.unescape(" ".join(re.sub(r"<[^>]+>", "", a) for a in re.findall(r"<p>(.*?)</p>", inhalt)))
    kopf = {"titel": titel, "datum": datum, "sprache": sprache(klartext), "beschreibung": kurztext(absaetze or klartext)}
    if wandler.bilder:
        # Das (einzige) Bild im Wix-Artikel ist das Titelbild.
        with tempfile.NamedTemporaryFile(suffix=Path(wandler.bilder[0]).suffix) as datei:
            datei.write(laden(f"https://static.wixstatic.com/media/{wandler.bilder[0]}"))
            datei.flush()
            vorbereiten(datei.name, slug)
        kopf["bild"] = slug
        bildtext = next((t for t in wandler.bildtexte if t and not re.search(r"\.(png|jpe?g)$", t, re.I)), "")
        kopf["bildtext"] = bildtext or titel
    zeilen = [f"{k}: {v}" for k, v in kopf.items()]
    ziel.write_text("\n".join(zeilen) + "\n---\n" + inhalt, encoding="utf-8")
    print(f"{slug}: {len(klartext.split())} Woerter, {kopf['sprache']}, {datum}")


def alle_slugs():
    slugs = []
    for pfad in ("/blog", "/blog/page/2", "/blog/page/3", "/blog/page/4"):
        try:
            seite = laden(SEITE + pfad).decode("utf-8")
        except Exception:
            continue
        for slug in re.findall(r"phoenix-feder\.de/post/([a-z0-9-]+)", seite):
            if slug not in slugs:
                slugs.append(slug)
    return slugs


if __name__ == "__main__":
    for slug in sys.argv[1:] or alle_slugs():
        artikel_exportieren(slug)
    print(json.dumps({"fertig": True}))
