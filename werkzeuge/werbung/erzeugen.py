#!/usr/bin/env python3
"""Werbung für das Achtsamkeitsseminar: Instagram-Beitrag, Story/WhatsApp-Status, Kurzvideo und Plakat.

Aufruf:  python3 werkzeuge/werbung/erzeugen.py [Ausgabeordner]
Ergebnis: instagram-beitrag.png (1080 × 1350), story-status.png (1080 × 1920), kurzvideo.mp4 (12 s, ohne Ton),
          plakat-a4.pdf (druckfertig), plakat-a4-foto.pdf (zweite Fassung mit Foto und Preisfeld), plakat-a4.png (Vorschau) und og-seminar.jpg
          (Link-Vorschau 1200 × 630 im Plakat-Look, wird auch nach bilder/ kopiert).

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
    h, m = map(int, s["beginn"].split(":"))
    h2, m2 = map(int, s["ende"].split(":"))
    minuten = (h2 * 60 + m2) - (h * 60 + m)

    # Plakat: wenig Text, große Schrift, kein Foto (Nikolas, Okt. 2026: „weniger Text, größer, nicht so typisch AI“)
    uhr = lambda t: t[:-3] if t.endswith(":00") else t
    plakat_tag = f"{TAGE[tag.weekday()]}, {tag.day}. {MONATE[tag.month - 1]}"
    plakat_zeit = f"{uhr(s['beginn'])} bis {uhr(s['ende'])} Uhr"
    plakat_ort = esc(o["name"]) + "<br>" + esc(o["strasse"]) + (f" ({esc(o['zusatz'])})" if o.get("zusatz") else "")
    plakat_preis = esc(f"Kostenlos, nur {s['plaetze']} Plätze" if kostenlos else f"{s['preis']}, {s['plaetze']} Plätze")
    plakat_bild = (WURZEL / "bilder" / "seminar-wahrnehmung-1600.webp").as_uri()  # Hand im Kornfeld: Wahrnehmen
    try:
        # Das Original hat nur 580 px: sauber hochgerechnet und leicht nachgeschärft wirkt es im Druck klarer
        from PIL import Image, ImageFilter
        foto = Image.open(WURZEL / "bilder" / "seminar-wahrnehmung-1600.webp").convert("RGB")
        foto = foto.resize((foto.width * 3, foto.height * 3), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2.4, percent=70, threshold=3))
        foto.save(ziel / "_kornfeld.jpg", quality=92)
        plakat_bild = (ziel / "_kornfeld.jpg").as_uri()
    except ImportError:
        pass
    # Bild fürs Foto-Plakat: selbst gezeichnete Illustration eines Yogaraums nach dem Vorbild des Warung Yoga mit einer
    # meditierenden Person auf einer Matte; Raum und Person im selben Stil (Nikolas, Okt. 2026: Montage wirkte „eingefügt“)
    # Liegt ein echtes Foto als werkzeuge/werbung/plakat-foto.(jpg|png|webp) bereit, hat es Vorrang (Nikolas will ein
    # ultrarealistisches Bild; die Zeichnung ist nur der Platzhalter, bis das Foto da ist)
    foto_datei = next((HIER / f"plakat-foto.{e}" for e in ("jpg", "jpeg", "png", "webp") if (HIER / f"plakat-foto.{e}").exists()), None)
    if foto_datei:
        raum_bild = foto_datei.as_uri()
    else:
        sys.path.insert(0, str(HIER))
        import raum_illustration
        raum_illustration.erzeugen(ziel / "_raum.svg")
        raum_bild = (ziel / "_raum.svg").as_uri()
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

    motto = "Die Grundlagen der Meditation, für jeden Tag"
    beschreibung = (("In diesem Pilotseminar" if pilot else f"In {minuten} Minuten") + " schärfst du deine Wahrnehmung, lernst dich "
                    "selbst besser kennen und übst, auch in schwierigen Situationen bewusst zu handeln.")
    motto_neu = "Bewusster leben"  # Plakat, Social Media und Link-Vorschau (Nikolas, Okt. 2026); Website: „Bewusst leben“
    kreis = f'<div class="kreis" aria-hidden="true"><img src="{plakat_bild}" alt=""></div>'
    kopf = f'<h1>Achtsamkeits-<br>seminar</h1>\n  <p class="unter">{motto_neu}</p>'
    pilot_satz = ("Ein Pilotseminar" if pilot else "Ein Seminar") + " mit Nikolas Voth"
    unten = f"""<div class="unten">
    <p class="termin">{esc(plakat_tag)}<br>{esc(plakat_zeit)}</p>
    <p class="infos">{esc(o["name"])}<br>{plakat_preis}</p>
    <div class="anmelden-qr"><div class="qr">{qr}</div><p>Anmelden:<br><strong>{esc(kurz_url)}</strong><span class="klein">{pilot_satz}</span></p></div>
  </div>"""
    # Plakat (Okt. 2026, Feinschliff wie im Handel): das Angebot als runder Störer am Foto (Blickfang in zwei Sekunden),
    # Hürde senken („Keine Vorkenntnisse nötig“), Handlungsaufruf am QR-Code; Straße statt Stadt, das Plakat hängt in Aachen
    ort_plakat = esc(f"{o['name'].replace(' ' + o['stadt'], '')}, {o['strasse']}")
    stoerer = (f'<div class="stoerer" aria-hidden="true"><strong>{"Kostenlos" if kostenlos else esc(s["preis"])}</strong>'
               f'<span>nur {s["plaetze"]} Plätze</span></div>')
    unten_plakat = f"""<div class="unten">
    <p class="termin">{esc(plakat_tag)}<br>{esc(plakat_zeit)}</p>
    <p class="infos">{ort_plakat}<br>Keine Vorkenntnisse nötig</p>
    <div class="anmelden-qr"><div class="qr">{qr}</div><p>Jetzt Platz sichern:<br><strong>{esc(kurz_url)}</strong><span class="klein">{pilot_satz}</span></p></div>
  </div>"""
    schriftblatt = lambda klasse: f"""<div class="blatt {klasse}">
  {kreis}
  {stoerer if klasse == "plakat" else ""}
  {kopf}
  {unten_plakat if klasse == "plakat" else unten}
</div>"""
    # Zweite Plakat-Fassung (Nikolas, Okt. 2026, nach einem Entwurf aus Claude Design): Foto oben, Titel,
    # Preisfeld „0 €“, Termin und QR-Code unten. Preis danach und Anmeldeschluss optional in seminar.json.
    nach_preis = s.get("preis_danach", "")
    frist = s.get("anmeldeschluss", "")
    frist_text = ""
    if frist:
        f = date.fromisoformat(frist)
        frist_text = f" · Anmeldung bis {TAGE[f.weekday()][:2]}, {f.day}.{f.month}."
    preis_feld = "0 €" if kostenlos else esc(s["preis"])
    fett = "Kostenloses Pilotseminar." if kostenlos and pilot else "Kostenloses Seminar." if kostenlos else "Seminar in kleiner Runde."
    foto_plakat = f"""<div class="blatt plakat2">
  <div class="foto"><img src="{raum_bild}" alt=""></div>
  <div class="inhalt">
    <h1>Achtsamkeitsseminar</h1>
    <div class="angebot">
      <div class="preis">{preis_feld}</div>
      <div class="angebot-text">
        <p class="fett">{fett}</p>
        {f'<p>Danach kostet es {esc(nach_preis)}.</p>' if nach_preis else ""}
        <p class="band">Nur die ersten {s["plaetze"]}{esc(frist_text)}</p>
      </div>
    </div>
    <div class="fuss">
      <div class="fakten2">
        <p class="wann">{esc(TAGE[tag.weekday()][:2])}, {tag.day}. {esc(MONATE[tag.month - 1])} · {esc(uhr(s["beginn"]))}–{esc(s["ende"])} Uhr</p>
        <p>{esc(o["name"].replace(" " + o["stadt"], ""))}, {esc(o["strasse"])}{f" ({esc(o['zusatz'])})" if o.get("zusatz") else ""}</p>
        <p>Mit Nikolas Voth · keine Vorkenntnisse nötig</p>
      </div>
      <div class="qr-feld"><div class="qr">{qr}</div><strong>Platz sichern</strong><span>{esc(kurz_url)}</span></div>
    </div>
  </div>
</div>"""
    seiten = {
        "plakat-foto": foto_plakat,
        "beitrag": schriftblatt("post"),
        "story": schriftblatt("story"),
        "plakat": schriftblatt("plakat"),
        "vorschau": f"""<div class="blatt vorschau">
  {kreis}
  {kopf}
  <div class="unten">
    <p class="termin">{esc(plakat_tag)}, {esc(plakat_zeit)}</p>
    <p class="infos">{esc(o["name"])} · {plakat_preis}</p>
  </div>
</div>""",
        "video": f"""<div class="blatt reel">
  {kreis}
  <div class="szene s1"><p class="frage">Wann warst du zuletzt ganz im Moment?</p></div>
  <div class="szene s2">{kopf}</div>
  <div class="szene s3"><p class="termin">{esc(plakat_tag)}<br>{esc(plakat_zeit)}</p><p class="infos">{esc(o["name"])}<br>{plakat_preis}</p></div>
  <div class="ende">{kopf}
  {unten}</div>
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
    for f in [*ziel.glob("_*.html"), *ziel.glob("_*.jpg"), *ziel.glob("_*.svg")]:
        f.unlink()
    # Link-Vorschau der Seminarseite (og:image) gleich in die Website übernehmen
    import shutil
    shutil.copy(ziel / "og-seminar.jpg", WURZEL / "bilder" / "og-seminar.jpg")
    print("bilder/og-seminar.jpg aktualisiert (danach bauen.py und committen)")
    print(f"Fertig: {ziel}  (QR-Code → {url})")


if __name__ == "__main__":
    main()
