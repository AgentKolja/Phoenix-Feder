#!/usr/bin/env python3
"""Werbung für das Achtsamkeitsseminar: Instagram-Beitrag, Story/WhatsApp-Status, Kurzvideo und Plakat.

Aufruf:  python3 werkzeuge/werbung/erzeugen.py [Ausgabeordner]
Ergebnis: instagram-beitrag.png (1080 × 1350), story-status.png (1080 × 1920), kurzvideo.mp4 (12 s, ohne Ton),
          plakat-a4.pdf (druckfertig, skaliert auch auf A3) und plakat-a4.png (Vorschau).

Termin, Ort und Plätze kommen aus inhalt/seminar.json, also nach einem neuen Termin einfach neu erzeugen.
Der QR-Code führt auf <domain>/seminar/ (leitet zur Anmeldung weiter, siehe bauen.py).
Braucht: pip install qrcode pillow imageio-ffmpeg (ffmpeg fürs Video) und Playwright mit Chromium.
"""
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

import qrcode
import qrcode.image.svg

WURZEL = Path(__file__).resolve().parents[2]
HIER = Path(__file__).resolve().parent
TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober",
          "November", "Dezember"]


def esc(t):
    return str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def qr_svg(url):
    """QR-Code als SVG ohne feste Größe (skaliert mit dem Kasten), Fehlerkorrektur Q für Druck und Display."""
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, border=1,
                         image_factory=qrcode.image.svg.SvgPathImage)
    code.add_data(url)
    code.make(fit=True)
    svg = code.make_image().to_string(encoding="unicode")
    # feste mm-Angaben entfernen, viewBox bleibt
    import re
    svg = re.sub(r'\s(width|height)="[^"]*mm"', "", svg, count=2)
    return svg.replace("<svg ", '<svg fill="#2a211c" ', 1)


def main():
    ziel = Path(sys.argv[1] if len(sys.argv) > 1 else WURZEL / "werbung-ausgabe").resolve()
    ziel.mkdir(parents=True, exist_ok=True)
    s = json.loads((WURZEL / "inhalt" / "seminar.json").read_text(encoding="utf-8"))
    e = json.loads((WURZEL / "einstellungen.json").read_text(encoding="utf-8"))
    tag = date.fromisoformat(s["datum"])
    if tag < date.today():
        print(f"Achtung: Der Termin in seminar.json ({s['datum']}) liegt in der Vergangenheit.")
    url = e["domain"].rstrip("/") + "/seminar/"
    kurz_url = url.replace("https://", "").replace("www.", "").rstrip("/")
    kurz_tag = f"{TAGE[tag.weekday()][:2]}, {tag.day}. {MONATE[tag.month - 1]}"
    wann = f"{TAGE[tag.weekday()]}, {tag.day}. {MONATE[tag.month - 1]} {tag.year}<br><i>{s['beginn']} bis {s['ende']} Uhr</i>"
    o = s["ort"]
    wo = f"{esc(o['name'])}<br><i>{esc(o['strasse'])}" + (f" ({esc(o['zusatz'])})" if o.get("zusatz") else "") + "</i>"
    kostenlos = s["preis"].strip().lower() == "kostenlos"
    kosten = (f"Kostenlos, nur {s['plaetze']} Plätze" if kostenlos else f"{s['preis']}, {s['plaetze']} Plätze")
    oberzeile = ("Kostenloses Pilot-Seminar" if kostenlos and s.get("art") == "Pilot"
                 else "Kostenloses Seminar" if kostenlos else "Seminar") + f" in {o['stadt']}"
    h, m = map(int, s["beginn"].split(":"))
    h2, m2 = map(int, s["ende"].split(":"))
    minuten = (h2 * 60 + m2) - (h * 60 + m)

    bild = (WURZEL / "bilder" / "achtsamkeit-1600.webp").as_uri()
    portrait = (WURZEL / "bilder" / "nikolas-portrait-800.webp").as_uri()
    qr = qr_svg(url)
    fakten = f"""<div class="fakten">
  <div class="fakt"><b>Wann</b><span>{wann}</span></div>
  <div class="fakt"><b>Wo</b><span>{wo}</span></div>
  <div class="fakt"><b>Preis</b><span>{esc(kosten)}</span></div>
</div>"""
    leiter = f"""<div class="leiter"><img src="{portrait}" alt=""><span>Mit <strong>Nikolas Voth</strong>, Achtsamkeitstrainer und Coach</span></div>"""

    def anmelden(text="Jetzt anmelden"):
        return f"""<div class="anmelden"><div class="qr">{qr}</div><div><strong>{text}</strong><div class="adresse">{esc(kurz_url)}</div></div></div>"""

    titel = "Mehr Gelassenheit.<br>Mehr du."
    beschreibung = (f"In {minuten} Minuten durch drei Ebenen der Achtsamkeit, vom Wahrnehmen bis zum bewussten Handeln. "
                    "Mit Übungen, die du direkt in deinen Alltag mitnimmst.")
    seiten = {
        "beitrag": f"""<div class="blatt post">
  <div class="bogen"><img src="{bild}" alt=""></div>
  <div class="kopf"><p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar</p></div>
  <div class="rechts"><p class="text">{esc(beschreibung)}</p>{leiter}</div>
  <div class="unten">{fakten}{anmelden()}</div>
</div>""",
        "story": f"""<div class="blatt story">
  <div class="bogen"><img src="{bild}" alt=""></div>
  <p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar</p>
  {fakten}
  {anmelden()}
</div>""",
        "plakat": f"""<div class="blatt plakat">
  <div class="bogen"><img src="{bild}" alt=""></div>
  <p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar</p>
  <p class="text">{esc(beschreibung)}</p>
  <div class="unten"><div>{fakten}{leiter}</div>{anmelden("Scannen und anmelden")}</div>
</div>""",
        "video": f"""<div class="blatt reel">
  <div class="foto"><img src="{bild}" alt=""></div><div class="schleier"></div>
  <div class="szene s1"><h1>Ständig abgelenkt?</h1><p>Zu viel im Kopf, zu wenig im Moment.</p></div>
  <div class="szene s2"><h1>{titel}</h1><p>Achtsamkeit kannst du üben.</p></div>
  <div class="szene s3"><p class="oberzeile">{esc(oberzeile)}</p><h1>Achtsamkeits&shy;seminar</h1><p>{esc(kurz_tag)} · {esc(s['beginn'])} bis {esc(s['ende'])} Uhr</p></div>
  <div class="ende"><p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar</p>{fakten}{anmelden()}</div>
</div>""",
    }
    vorlage = (HIER / "vorlage.html").read_text(encoding="utf-8")
    for name, inhalt in seiten.items():
        html = vorlage.replace("{{wurzel}}", WURZEL.as_uri()).replace("{{inhalt}}", inhalt)
        (ziel / f"_{name}.html").write_text(html, encoding="utf-8")

    umgebung = dict(os.environ)
    try:
        import imageio_ffmpeg
        umgebung["FFMPEG"] = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    if "PW" not in umgebung:
        umgebung["PW"] = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip() + "/playwright"
    subprocess.run(["node", str(HIER / "rendern.js"), str(ziel)], check=True, env=umgebung)
    for f in ziel.glob("_*.html"):
        f.unlink()
    print(f"Fertig: {ziel}  (QR-Code → {url})")


if __name__ == "__main__":
    main()
