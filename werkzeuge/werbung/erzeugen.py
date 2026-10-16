#!/usr/bin/env python3
"""Werbung für das Achtsamkeitsseminar: Instagram-Beitrag, Story/WhatsApp-Status, Kurzvideo und Plakat.

Aufruf:  python3 werkzeuge/werbung/erzeugen.py [Ausgabeordner]
Ergebnis: instagram-beitrag.png (1080 × 1350), story-status.png (1080 × 1920), kurzvideo.mp4 (12 s, ohne Ton),
          plakat-a4.pdf (druckfertig, skaliert auch auf A3), plakat-a4.png (Vorschau) und og-seminar.jpg
          (Link-Vorschau 1200 × 630, wird auch nach bilder/ kopiert).

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
    pilot = s.get("art") == "Pilot"
    kosten = esc(f"Kostenlos, nur {s['plaetze']} Plätze" if kostenlos else f"{s['preis']}, {s['plaetze']} Plätze")
    # Pilot dezent, aber offen: Wo der Beschreibungstext „Pilotseminar“ nennt (Beitrag, Plakat), reicht beim Preis
    # „Dein Feedback hilft mir“; in Story und Video ohne Beschreibung steht „Pilotseminar“ beim Preis.
    kosten_mit_text = kosten + ("<br><i>Dein Feedback hilft mir</i>" if pilot else "")
    kosten_ohne_text = kosten + ("<br><i>Pilotseminar: Dein Feedback hilft mir</i>" if pilot else "")
    oberzeile = "Grundlagen der Meditation"
    h, m = map(int, s["beginn"].split(":"))
    h2, m2 = map(int, s["ende"].split(":"))
    minuten = (h2 * 60 + m2) - (h * 60 + m)

    # Plakat: wenig Text, große Schrift, kein Foto (Nikolas, Okt. 2026: „weniger Text, größer, nicht so typisch AI“)
    uhr = lambda t: t[:-3] if t.endswith(":00") else t
    plakat_tag = f"{TAGE[tag.weekday()]}, {tag.day}. {MONATE[tag.month - 1]}"
    plakat_zeit = f"{uhr(s['beginn'])} bis {uhr(s['ende'])} Uhr"
    plakat_ort = esc(o["name"]) + "<br>" + esc(o["strasse"]) + (f" ({esc(o['zusatz'])})" if o.get("zusatz") else "")
    plakat_preis = esc(f"Kostenlos, nur {s['plaetze']} Plätze" if kostenlos else f"{s['preis']}, {s['plaetze']} Plätze")
    feder = (WURZEL / "favicon.svg").read_text(encoding="utf-8").replace("<svg ", '<svg aria-hidden="true" ', 1)
    bild = (WURZEL / "bilder" / "achtsamkeit-1600.webp").as_uri()
    portrait = (WURZEL / "bilder" / "nikolas-portrait-800.webp").as_uri()
    qr = qr_svg(url)
    def fakten_html(preis):
        return f"""<div class="fakten">
  <div class="fakt"><b>Wann</b><span>{wann}</span></div>
  <div class="fakt"><b>Wo</b><span>{wo}</span></div>
  <div class="fakt"><b>Preis</b><span>{preis}</span></div>
</div>"""
    fakten = fakten_html(kosten_ohne_text)
    fakten_kurz = fakten_html(kosten_mit_text)
    leiter = f"""<div class="leiter"><img src="{portrait}" alt=""><span>Mit <strong>Nikolas Voth</strong>, Achtsamkeitstrainer und Coach</span></div>"""

    def anmelden(text="Jetzt anmelden"):
        return f"""<div class="anmelden"><div class="qr">{qr}</div><div><strong>{text}</strong><div class="adresse">{esc(kurz_url)}</div></div></div>"""

    titel = "Bewusst leben"
    motto = "Die Grundlagen der Meditation, für jeden Tag"
    beschreibung = (("In diesem Pilotseminar" if pilot else f"In {minuten} Minuten") + " schärfst du deine Wahrnehmung, lernst dich "
                    "selbst besser kennen und übst, auch in schwierigen Situationen bewusst zu handeln.")
    seiten = {
        "beitrag": f"""<div class="blatt post">
  <div class="bogen"><img src="{bild}" alt=""></div>
  <div class="kopf"><p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar</p></div>
  <div class="rechts"><p class="text">{esc(beschreibung)}</p>{leiter}</div>
  <div class="unten">{fakten_kurz}{anmelden()}</div>
</div>""",
        "story": f"""<div class="blatt story">
  <div class="bogen"><img src="{bild}" alt=""></div>
  <p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar</p>
  {fakten}
  {anmelden()}
</div>""",
        "plakat": f"""<div class="blatt plakat">
  <div class="sonne" aria-hidden="true"></div>
  <p class="absender">{feder}Phoenix Feder</p>
  <h1>Bewusst<br>leben</h1>
  <p class="unter">Achtsamkeitsseminar</p>
  <p class="zusatz">{esc(oberzeile)}</p>
  <div class="infos">
    <p class="gross">{esc(plakat_tag)}<br>{esc(plakat_zeit)}</p>
    <p>{plakat_ort}</p>
    <p>{plakat_preis}</p>
  </div>
  <div class="fuss">
    <div class="qr">{qr}</div>
    <p>Anmeldung<br><strong>{esc(kurz_url)}</strong><span class="klein">{"Ein Pilotseminar" if pilot else "Ein Seminar"} mit Nikolas Voth</span></p>
  </div>
</div>""",
        "vorschau": f"""<div class="blatt vorschau">
  <div class="bogen"><img src="{bild}" alt=""></div>
  <div><p class="oberzeile">{esc(oberzeile)}</p><h1>{titel}</h1><p class="unter">Achtsamkeitsseminar in {esc(o['stadt'])}</p>
  <div class="leiter"><img src="{portrait}" alt=""><span>Mit <strong>Nikolas Voth</strong> · {esc(kurz_url.split('/')[0])}</span></div></div>
</div>""",
        "video": f"""<div class="blatt reel">
  <div class="foto"><img src="{bild}" alt=""></div><div class="schleier"></div>
  <div class="szene s1"><h1>Ständig abgelenkt?</h1><p>Zu viel im Kopf, zu wenig im Moment.</p></div>
  <div class="szene s2"><h1>{titel}</h1><p>{esc(motto)}.</p></div>
  <div class="szene s3"><p class="oberzeile">In {esc(o['stadt'])}, {"kostenlos" if kostenlos else esc(s['preis'])}</p><h1>Achtsamkeits&shy;seminar</h1><p>{esc(kurz_tag)} · {esc(s['beginn'])} bis {esc(s['ende'])} Uhr</p></div>
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
    # Link-Vorschau der Seminarseite (og:image) gleich in die Website übernehmen
    import shutil
    shutil.copy(ziel / "og-seminar.jpg", WURZEL / "bilder" / "og-seminar.jpg")
    print("bilder/og-seminar.jpg aktualisiert (danach bauen.py und committen)")
    print(f"Fertig: {ziel}  (QR-Code → {url})")


if __name__ == "__main__":
    main()
