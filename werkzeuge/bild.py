#!/usr/bin/env python3
"""Bereitet ein Bild fuer die Website vor.

Aufruf:  python3 werkzeuge/bild.py <quelle> <name>
Ergebnis: bilder/<name>-800.webp und bilder/<name>-1600.webp

Warum zwei Groessen: Karten und Handys laden die kleine Datei, grosse Bildschirme die grosse.
Metadaten (GPS, Kamera) fallen dabei weg. Braucht Pillow: pip install pillow
"""
import sys
from pathlib import Path

from PIL import Image, ImageOps

ZIEL = Path(__file__).resolve().parent.parent / "bilder"
BREITEN = (800, 1600)


def vorbereiten(quelle, name):
    bild = ImageOps.exif_transpose(Image.open(quelle)).convert("RGB")
    ZIEL.mkdir(exist_ok=True)
    for breite in BREITEN:
        kopie = bild.copy()
        if kopie.width > breite:
            kopie = kopie.resize((breite, round(kopie.height * breite / kopie.width)), Image.LANCZOS)
        ausgabe = ZIEL / f"{name}-{breite}.webp"
        kopie.save(ausgabe, "WEBP", quality=80, method=6)
        print(f"{ausgabe.name}: {kopie.width}x{kopie.height}, {ausgabe.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    vorbereiten(sys.argv[1], sys.argv[2])
