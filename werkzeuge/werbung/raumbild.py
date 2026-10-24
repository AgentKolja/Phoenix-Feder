"""Raumfoto fürs Foto-Plakat: echtes Foto des Veranstaltungsorts, heller und wärmer, optional mit einer
meditierenden Person (aus dem eigenen Bild bilder/seminar-meditation, freigestellt und eingesetzt).

Das Raumfoto wird beim Erzeugen von der Website des Studios geladen (Nutzung fürs Plakat mit Erlaubnis,
siehe seminar.json "plakat_foto") und landet nicht im öffentlichen Repo.
Braucht: pip install pillow numpy opencv-python-headless
"""
import io
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SEITENVERHAELTNIS = 1.4  # Bildbereich des Foto-Plakats: 198 × 141 mm


def raum_laden(url, x, y, breite):
    anfrage = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    foto = Image.open(io.BytesIO(urllib.request.urlopen(anfrage, timeout=30).read())).convert("RGB")
    return foto.crop((x, y, x + breite, y + round(breite / SEITENVERHAELTNIS)))


def aufhellen(raum):
    """Heller, Schatten angehoben, etwas wärmer, weiches Licht von links oben, leichte Vignette."""
    a = np.asarray(raum).astype(np.float32) / 255
    a = a ** 0.86
    a = a * np.array([1.05, 1.0, 0.92])
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    licht = np.clip(1.0 - ((xx - w * 0.25) ** 2 + (yy - h * 0.15) ** 2) ** 0.5 / (w * 1.25), 0, 1)
    a = a + 0.06 * licht[..., None] * np.array([1.0, 0.85, 0.6])
    rand = np.clip((xx - w / 2) ** 2 / (w * 0.75) ** 2 + (yy - h / 2) ** 2 / (h * 0.8) ** 2, 0, 1)
    a = a * (1 - 0.12 * rand[..., None])
    return ImageEnhance.Color(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))).enhance(1.08)


def person_freistellen(pfad):
    """Person aus seminar-meditation (537 × 563 px) per GrabCut freistellen. Die Hilfsflächen sind auf genau
    dieses Bild abgestimmt: sicher Person (Kopf, Oberkörper, Arme, Beine), sicher Wand und Boden daneben."""
    import cv2
    bild = Image.open(pfad).convert("RGB")
    src = cv2.cvtColor(np.asarray(bild), cv2.COLOR_RGB2BGR)
    h, w = src.shape[:2]
    m = np.full((h, w), cv2.GC_BGD, np.uint8)
    m[205:490, 140:432] = cv2.GC_PR_BGD
    cv2.ellipse(m, (298, 252), (22, 30), 0, 0, 360, cv2.GC_FGD, -1)
    cv2.rectangle(m, (285, 275), (312, 300), cv2.GC_FGD, -1)
    cv2.fillPoly(m, [np.array([[245, 300], [350, 300], [372, 420], [228, 420]], np.int32)], cv2.GC_FGD)
    cv2.ellipse(m, (295, 445), (100, 22), 0, 0, 360, cv2.GC_FGD, -1)
    cv2.line(m, (240, 330), (175, 405), cv2.GC_FGD, 14)
    cv2.line(m, (355, 330), (405, 405), cv2.GC_FGD, 14)
    cv2.ellipse(m, (298, 252), (30, 40), 0, 0, 360, cv2.GC_PR_FGD, 3)
    cv2.fillPoly(m, [np.array([[140, 205], [268, 205], [268, 282], [238, 298], [224, 384], [172, 396], [140, 396]], np.int32)], cv2.GC_BGD)
    cv2.fillPoly(m, [np.array([[330, 205], [432, 205], [432, 396], [412, 396], [374, 384], [360, 298], [328, 282]], np.int32)], cv2.GC_BGD)
    m[480:, :] = cv2.GC_BGD
    m[418:, :178] = cv2.GC_BGD
    m[418:, 412:] = cv2.GC_BGD
    cv2.grabCut(src, m, None, np.zeros((1, 65)), np.zeros((1, 65)), 10, cv2.GC_INIT_WITH_MASK)
    a = np.where((m == 1) | (m == 3), 255, 0).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(a)
    if n > 1:
        a = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    a = cv2.morphologyEx(a, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    maske = Image.fromarray(a).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    box = maske.getbbox()
    return bild.crop(box), maske.crop(box)


def person_einsetzen(raum, person, maske, cx, unten, skala):
    groesse = (round(person.width * skala), round(person.height * skala))
    person, maske = person.resize(groesse, Image.LANCZOS), maske.resize(groesse, Image.LANCZOS)
    person = ImageEnhance.Brightness(ImageEnhance.Contrast(person).enhance(0.92)).enhance(1.06)
    links, oben = cx - person.width // 2, unten - person.height
    # weicher Kontaktschatten und eine ganz schwache Spiegelung auf dem glänzenden Boden
    schatten = Image.new("L", raum.size, 0)
    ImageDraw.Draw(schatten).ellipse((links + person.width * 0.02, unten - person.height * 0.09,
                                      links + person.width * 0.98, unten + person.height * 0.05), fill=150)
    schatten = schatten.filter(ImageFilter.GaussianBlur(person.width * 0.05))
    raum = Image.composite(Image.new("RGB", raum.size, (60, 45, 35)), raum, schatten.point(lambda v: int(v * 0.6)))
    spiegel = person.transpose(Image.FLIP_TOP_BOTTOM).filter(ImageFilter.GaussianBlur(3))
    raum.paste(spiegel, (links, unten + int(person.height * 0.06)), maske.transpose(Image.FLIP_TOP_BOTTOM).point(lambda v: int(v * 0.10)))
    raum.paste(person, (links, oben), maske)
    return raum


def erzeugen(pf, person_bild, ziel):
    """pf = seminar.json "plakat_foto": url, x, y, breite, optional person {cx, unten, skala} (Pixel im Ausschnitt)."""
    raum = aufhellen(raum_laden(pf["url"], pf.get("x", 0), pf.get("y", 0), pf["breite"]))
    p = pf.get("person")
    if p:
        try:
            person, maske = person_freistellen(person_bild)
            raum = person_einsetzen(raum, person, maske, p["cx"], p["unten"], p["skala"])
        except ImportError:
            print("Achtung: opencv fehlt (pip install opencv-python-headless), Raumfoto ohne Person.")
    if raum.width < 2400:
        raum = raum.resize((2400, round(2400 / SEITENVERHAELTNIS)), Image.LANCZOS)
        raum = raum.filter(ImageFilter.UnsharpMask(radius=2, percent=45, threshold=3))
    raum.save(ziel, quality=93)
