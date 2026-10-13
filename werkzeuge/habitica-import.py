#!/usr/bin/env python3
"""Uebernimmt die Habitica-Challenge (CSV-Export) nach inhalt/uebungen.json.

Aufruf:  python3 -I werkzeuge/habitica-import.py <export.csv>

Bereinigt dabei, was auf einer oeffentlichen Website nicht stehen soll:
- Studienangaben mit Prozentzahlen, die sich nicht belegen lassen
- persoenliche Angebote an Challenge-Teilnehmende ("wende dich an Kolja", Preise)
- Tippfehler
Handbearbeitungen in uebungen.json gehen bei einem erneuten Import verloren - dann lieber
die Ersetzungen unten ergaenzen.
"""
import csv
import json
import re
import sys
from pathlib import Path

ZIEL = Path(__file__).resolve().parent.parent / "inhalt" / "uebungen.json"

ARTEN = {"habit": "gewohnheit", "daily": "taeglich", "todo": "quest"}
QUESTGRUPPEN = {"Achtsamkeitsquest": "Achtsamkeit", "Digitalquest": "Digital", "Ernährungsquest": "Ernährung",
                "Glücksquest": "Glück", "Homequest": "Zuhause", "Naturquest": "Natur", "Socialquest": "Miteinander",
                "Final Quest": "Abschluss", "Follow-Up Quest": "Abschluss"}

# Ganze Zeilen, die ersetzt (oder mit "" entfernt) werden. Schluessel = Zeilenanfang.
ZEILEN = {
    "Fakt 2: In vielen Krankenhausstudien": "Fakt 2: In Krankenhausstudien erholten sich Patientinnen und Patienten "
                                            "mit Blick ins Grüne schneller.",
    "Count the acts of kindness": "Zähle die freundlichen Taten, die du heute beobachtet oder verschenkt hast.",
    "Die Well Good Studien": "In den Blue Zones – Regionen, in denen Menschen besonders lange und gesund leben – "
                             "gehört ein Nickerchen vielerorts zum Alltag. Mögliche Vorteile:",
    "- Regelmäßiger Mittagsschlaf kann das Risiko": "",
    "Die Ernährungstipps stammen aus den Blue Ocean": "Die Tipps sind inspiriert von der Ernährung in den Blue Zones – "
                                                      "Regionen, in denen Menschen besonders lange und gesund leben.",
    "Dies ist nachweislich eine Achtsamkeitsübung": "Langsames, bewusstes Atmen aktiviert dein parasympathisches "
                                                    "Nervensystem – den Teil, der für Entspannung und Erholung zuständig ist.",
    "Dies spricht für eine Korrelation": "",
    "Beispielbild:": "",
    "R. Kelly": "",
}
# Ersetzungen innerhalb einer Zeile
TEXT = {
    "Küsse. Ab 6 Sekunden verdoppelt sich der Serotonin-Ausstoß": "Küsse",
    ", um Strahlung zu reduzieren": ", damit es dich nachts nicht ablenkt",
    "Obachltosen": "Obdachlosen", "beoachten": "beobachten", "Schlafgemacht": "Schlafgemach",
    "Gehstock auswählen#": "Gehstock auswählen", "Stresshornons": "Stresshormons", " 1 Jahr gratis.": "",
    "Sprich also mit bedacht.": "Sprich also mit Bedacht.",
    "Questionnaire )aus": "Questionnaire) aus",
}


def slug(text):
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def titel_zerlegen(roh):
    art, _, rest = roh.partition(":")
    rest = rest.strip()
    gruppe = ""
    treffer = re.match(r"(\w+quest \d+|Final Quest|Follow-Up Quest)\s*", rest)
    if treffer:
        gruppe = QUESTGRUPPEN[re.sub(r" \d+$", "", treffer.group(1))]
        rest = rest[treffer.end():]
    emoji = re.match(r"([^\w\s'’]+)", rest)
    name = re.sub(r"[^\w\s'’!?&.-]", "", rest)
    name = re.sub(r"\s+", " ", name).strip()
    return ARTEN[art.strip()], gruppe, (emoji.group(1) if emoji else "✨"), name


def text_bereinigen(notiz):
    zeilen = []
    for zeile in notiz.replace("\r", "").split("\n"):
        zeile = zeile.rstrip()
        for alt, neu in TEXT.items():
            zeile = zeile.replace(alt, neu)
        if zeile.endswith("(einfach googlen"):
            zeile += ")"
        ersatz = next((neu for anfang, neu in ZEILEN.items() if zeile.strip().startswith(anfang)), None)
        if ersatz is not None:
            if ersatz:
                zeilen.append(ersatz)
            continue
        # Satzweise raus: persoenliche Angebote an Challenge-Teilnehmende ("Kolja") und
        # Studienangaben mit Prozentzahlen, die sich nicht belegen lassen
        saetze = re.split(r"(?<=[.!?])\s+", zeile)
        behalten = [s for s in saetze if "Kolja" not in s and not re.search(r"\bStudie\b|Stanford-Studie", s)]
        if saetze and not behalten:
            continue
        zeilen.append(" ".join(behalten) if len(behalten) != len(saetze) else zeile)
    text = "\n".join(zeilen).strip()
    return re.sub(r"\n{3,}", "\n\n", text)


def main(pfad):
    with open(pfad, encoding="utf-8-sig", newline="") as datei:
        zeilen = list(csv.reader(datei))
    daten = zeilen[1]
    uebungen = []
    for i in range(3, len(daten) - 3, 4):
        roh, notiz = daten[i], daten[i + 2]
        if roh.strip():
            art, gruppe, emoji, name = titel_zerlegen(roh)
            uebungen.append({"art": art, "gruppe": gruppe, "emoji": emoji, "titel": name, "text": text_bereinigen(notiz)})
    reihenfolge = {"gewohnheit": 0, "taeglich": 1, "quest": 2}
    gruppen = list(dict.fromkeys(["", "Achtsamkeit", "Natur", "Glück", "Miteinander", "Zuhause", "Ernährung",
                                  "Digital", "Abschluss"]))
    uebungen.sort(key=lambda u: (reihenfolge[u["art"]], gruppen.index(u["gruppe"])))
    gesehen = set()
    for u in uebungen:
        kennung = slug(u["titel"])
        if kennung in gesehen:  # z. B. Reflektion als taegliche Aufgabe und als Abschluss-Quest
            kennung = slug(u["gruppe"] + " " + u["titel"])
        gesehen.add(kennung)
        u["slug"] = kennung
    uebungen = [{"slug": u.pop("slug"), **u} for u in uebungen]
    ZIEL.write_text(json.dumps(uebungen, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    zaehlung = {a: sum(u["art"] == a for u in uebungen) for a in reihenfolge}
    print(f"{len(uebungen)} Übungen -> {ZIEL.relative_to(ZIEL.parent.parent)}: {zaehlung}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
