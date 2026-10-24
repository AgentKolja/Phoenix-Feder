"""Selbst gezeichnete Illustration fürs Foto-Plakat: ein Yogaraum nach dem Vorbild des Warung Yoga (Segeltücher
unter der Decke, Pflanzenwand, Fenster mit Vorhängen, heller Holzboden), vorne groß eine meditierende Person auf
einer Matte. Raum und Person im selben flachen Stil, damit nichts eingefügt wirkt (Nikolas, Okt. 2026).
Keine Vorlage abgezeichnet, kein Foto, kein Logo. Ergebnis: SVG 2400 × 1714 (Seitenverhältnis des Bildbereichs).
"""
import math
import random

B, H = 2400, 1714
HORIZONT = 1010  # Wandfuß


def blaetter(rng, anzahl, flaeche, farben):
    """Blätter, Farnwedel und ein paar Blüten, zufällig verteilt (fester Startwert, also immer gleich)."""
    x0, y0, x1, y1 = flaeche
    teile = []
    for _ in range(anzahl):
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        w, h, d = rng.uniform(26, 78), rng.uniform(10, 30), rng.uniform(0, 180)
        teile.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{w:.0f}" ry="{h:.0f}" transform="rotate({d:.0f} {x:.0f} {y:.0f})" fill="{rng.choice(farben)}"/>')
    for _ in range(anzahl // 6):  # Farne
        x, y, d, l = rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(-60, 60), rng.uniform(90, 170)
        fiedern = "".join(f'<path d="M0 {-i * l / 9:.0f} q{s * 26} {-8} {s * 40} {6}" stroke="#4f8a4d" stroke-width="7" fill="none" stroke-linecap="round"/>'
                          for i in range(1, 9) for s in (1, -1))
        teile.append(f'<g transform="translate({x:.0f} {y:.0f}) rotate({d:.0f})"><path d="M0 0 V{-l:.0f}" stroke="#3f7a44" stroke-width="6"/>{fiedern}</g>')
    for _ in range(anzahl // 48):  # Blüten
        x, y = rng.uniform(x0, x1), rng.uniform(y0, y1)
        teile.append(f'<g fill="#eab2bf">' + "".join(
            f'<ellipse cx="{x + 13 * math.cos(a):.0f}" cy="{y + 13 * math.sin(a):.0f}" rx="11" ry="6" transform="rotate({math.degrees(a):.0f} {x + 13 * math.cos(a):.0f} {y + 13 * math.sin(a):.0f})"/>'
            for a in [i * math.pi / 3 for i in range(6)]) + f'<circle cx="{x:.0f}" cy="{y:.0f}" r="5" fill="#d9849a"/></g>')
    return "".join(teile)


def person():
    """Meditierende Person von vorn im Schneidersitz, Licht von links (rechte Seite etwas dunkler).
    Koordinaten für eine Figur, deren Matte bei y = 1620 endet; skaliert wird im Aufruf."""
    haut, haut2, haar = "#e8bd9c", "#d7a582", "#4a3328"
    hemd, hemd2, hose, hose2 = "#f8f4ec", "#e4dccd", "#c98f45", "#a97333"
    return f"""
  <!-- Matte -->
  <ellipse cx="1000" cy="1630" rx="470" ry="40" fill="#5b4632" opacity=".18" filter="url(#weich)"/>
  <path d="M560 1606 L1440 1606 L1330 1372 L670 1372 Z" fill="url(#matte)"/>
  <path d="M560 1606 L1440 1606 L1440 1626 L560 1626 Z" fill="#5d7c66"/>
  <!-- Schatten der Person auf der Matte -->
  <ellipse cx="1010" cy="1478" rx="330" ry="48" fill="#3f5a48" opacity=".35" filter="url(#weich)"/>
  <!-- Beine im Schneidersitz -->
  <path d="M690 1452 C676 1366 742 1290 872 1276 L1128 1276 C1258 1290 1324 1366 1310 1452
           C1262 1492 1130 1484 1000 1466 C870 1484 738 1492 690 1452 Z" fill="url(#hose)"/>
  <path d="M720 1440 C820 1400 960 1386 1090 1398" stroke="{hose2}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".6"/>
  <path d="M905 1302 C965 1336 1050 1342 1120 1324" stroke="{hose2}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".4"/>
  <path d="M884 1452 C910 1432 960 1430 990 1442 C1000 1456 980 1466 950 1468 C915 1470 888 1466 884 1452 Z" fill="{haut2}"/>
  <path d="M1012 1402 C1050 1384 1112 1386 1140 1400 C1150 1414 1128 1426 1090 1428 C1048 1430 1018 1420 1012 1402 Z" fill="{haut}"/>
  <path d="M1124 1396 q10 4 12 12" stroke="{haut2}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <!-- Oberkörper: Hemd -->
  <path d="M878 906 C930 880 1070 880 1122 906 C1150 1000 1152 1170 1128 1290 C1050 1312 950 1312 872 1290 C848 1170 850 1000 878 906 Z" fill="url(#hemd)"/>
  <path d="M1000 990 V1300" stroke="{hemd2}" stroke-width="5"/>
  <circle cx="1000" cy="1050" r="6" fill="{hemd2}"/><circle cx="1000" cy="1130" r="6" fill="{hemd2}"/><circle cx="1000" cy="1210" r="6" fill="{hemd2}"/>
  <path d="M1032 1012 h62 v56 h-62 Z" fill="none" stroke="{hemd2}" stroke-width="5"/>
  <!-- Arme: Oberarm nach unten, Unterarm auf die Knie -->
  <path d="M886 938 C858 1010 842 1080 840 1150 C838 1210 796 1272 752 1316" stroke="url(#armL)" stroke-width="72" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M1114 938 C1142 1010 1158 1080 1160 1150 C1162 1210 1204 1272 1248 1316" stroke="url(#armR)" stroke-width="72" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M846 1120 C850 1160 840 1190 826 1210" stroke="#e2dacb" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M1154 1120 C1150 1160 1160 1190 1174 1210" stroke="#cfc4b2" stroke-width="5" fill="none" stroke-linecap="round"/>
  <!-- Hände, Daumen und Zeigefinger berühren sich -->
  <ellipse cx="736" cy="1338" rx="38" ry="24" transform="rotate(-24 736 1338)" fill="{haut}"/>
  <circle cx="716" cy="1324" r="10" fill="none" stroke="{haut2}" stroke-width="6"/>
  <ellipse cx="1264" cy="1338" rx="38" ry="24" transform="rotate(24 1264 1338)" fill="{haut2}"/>
  <circle cx="1284" cy="1324" r="10" fill="none" stroke="#c99472" stroke-width="6"/>
  <!-- Hals und Ausschnitt -->
  <path d="M966 836 H1034 V902 L1000 990 L966 902 Z" fill="url(#hautV)"/>
  <path d="M948 900 L1000 990 L1052 900" stroke="{hemd2}" stroke-width="10" fill="none" stroke-linejoin="round"/>
  <!-- Kopf -->
  <ellipse cx="1000" cy="770" rx="70" ry="86" fill="url(#gesicht)"/>
  <ellipse cx="928" cy="784" rx="12" ry="20" fill="{haut2}"/><ellipse cx="1072" cy="784" rx="12" ry="20" fill="{haut2}"/>
  <path d="M928 760 C926 690 966 664 1000 664 C1040 664 1076 690 1072 760 C1056 716 1030 702 1000 702 C968 702 944 716 928 760 Z" fill="{haar}"/>
  <circle cx="1000" cy="652" r="34" fill="{haar}"/>
  <!-- Augen geschlossen, leichtes Lächeln -->
  <path d="M960 784 q14 9 28 0" stroke="#6b4a3a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M1012 784 q14 9 28 0" stroke="#6b4a3a" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M984 826 q16 9 32 0" stroke="#b8735f" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="962" cy="808" rx="12" ry="7" fill="#e9a99a" opacity=".45"/><ellipse cx="1038" cy="808" rx="12" ry="7" fill="#e9a99a" opacity=".45"/>"""


def svg():
    rng = random.Random(14112026)
    gruen = ["#1f4a33", "#2a5c3d", "#346b45", "#3f7a4c", "#4c8752", "#2c5238", "#5a9257"]
    pflanzenwand = f"M1180 250 L{B} 206 L{B} {HORIZONT} L2210 {HORIZONT} C1940 900 1640 650 1180 470 Z"
    pflanzen_klein = "M120 292 L980 262 C850 380 720 500 610 590 C470 490 300 390 120 292 Z"
    dielen = "".join(f'<line x1="{1250 + (x - 1250) * 0.18:.0f}" y1="{HORIZONT}" x2="{x}" y2="{H}" stroke="#c3a985" stroke-width="3" opacity=".45"/>'
                     for x in range(-1400, 4000, 190))
    fugen = "".join(f'<line x1="0" y1="{y}" x2="{B}" y2="{y}" stroke="#c7ae8b" stroke-width="2" opacity=".35"/>' for y in (1080, 1180, 1320, 1500))
    falten = "".join(f'<path d="M{x} 400 C{x + 18} 600 {x - 14} 820 {x + 10} 1030" stroke="#ffffff" stroke-width="26" opacity=".55" fill="none"/>'
                     for x in range(70, 440, 62))
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {B} {H}" width="{B}" height="{H}">
<defs>
  <linearGradient id="wand" x1="0" x2="1"><stop offset="0" stop-color="#f8f3ea"/><stop offset="1" stop-color="#ebe3d6"/></linearGradient>
  <linearGradient id="decke" y1="0" y2="1" x1="0" x2="0"><stop offset="0" stop-color="#e9e3d9"/><stop offset="1" stop-color="#f4efe7"/></linearGradient>
  <linearGradient id="boden" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e3d2b8"/><stop offset="1" stop-color="#cdb492"/></linearGradient>
  <linearGradient id="segel" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e7e1d7"/></linearGradient>
  <linearGradient id="matte" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8eab93"/><stop offset="1" stop-color="#7a9a82"/></linearGradient>
  <linearGradient id="hose" x1="0" x2="1"><stop offset="0" stop-color="#d49a4f"/><stop offset=".55" stop-color="#c98f45"/><stop offset="1" stop-color="#a97333"/></linearGradient>
  <linearGradient id="hemd" x1="0" x2="1"><stop offset="0" stop-color="#fbf8f1"/><stop offset=".6" stop-color="#f3eee4"/><stop offset="1" stop-color="#ddd4c4"/></linearGradient>
  <linearGradient id="armL" x1="0" x2="1"><stop offset="0" stop-color="#fbf8f1"/><stop offset="1" stop-color="#efe9de"/></linearGradient>
  <linearGradient id="armR" x1="0" x2="1"><stop offset="0" stop-color="#e9e2d5"/><stop offset="1" stop-color="#d8cebd"/></linearGradient>
  <linearGradient id="gesicht" x1="0" x2="1"><stop offset="0" stop-color="#eec5a5"/><stop offset=".65" stop-color="#e5b996"/><stop offset="1" stop-color="#d4a07e"/></linearGradient>
  <linearGradient id="hautV" x1="0" x2="1"><stop offset="0" stop-color="#e8bd9c"/><stop offset="1" stop-color="#d6a582"/></linearGradient>
  <radialGradient id="licht" cx="0.12" cy="0.45" r="0.75"><stop offset="0" stop-color="#fff6e3" stop-opacity=".45"/><stop offset="1" stop-color="#fff6e3" stop-opacity="0"/></radialGradient>
  <clipPath id="wandclip"><path d="{pflanzenwand}"/></clipPath>
  <clipPath id="kleinclip"><path d="{pflanzen_klein}"/></clipPath>
  <filter id="weich" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="korn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .28  0 0 0 0 .2  0 0 0 .09 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
</defs>
<!-- Wand, Decke, Fenster mit Vorhängen links -->
<rect width="{B}" height="{HORIZONT}" fill="url(#wand)"/>
<path d="M0 0 H{B} V230 C1700 200 800 210 0 280 Z" fill="url(#decke)"/>
<rect x="40" y="380" width="420" height="640" fill="#fffaf0"/>
<rect x="40" y="380" width="420" height="640" fill="none" stroke="#e9e1d4" stroke-width="14"/>
<path d="M250 380 V1020 M40 700 H460" stroke="#e9e1d4" stroke-width="10"/>
<rect x="40" y="380" width="420" height="640" fill="#a9c8a0" opacity=".25"/>
{falten}
<!-- kleine Pflanzeninsel oben links und große Pflanzenwand rechts, ohne Leuchtstreifen -->
<path d="{pflanzen_klein}" fill="#173426"/>
<g clip-path="url(#kleinclip)">{blaetter(rng, 120, (120, 262, 980, 600), gruen)}</g>
<path d="{pflanzenwand}" fill="#173426"/>
<g clip-path="url(#wandclip)">{blaetter(rng, 520, (1180, 206, B, HORIZONT), gruen)}</g>
<!-- Segeltücher unter der Decke -->
<path d="M-40 120 C420 40 920 70 1320 170 L1290 262 C900 176 420 168 -40 246 Z" fill="url(#segel)"/>
<path d="M1060 50 C1520 4 2000 30 2460 110 L2460 226 C2000 150 1520 142 1100 186 Z" fill="url(#segel)"/>
<!-- Boden mit Dielen und Lichtfleck vom Fenster -->
<rect y="{HORIZONT}" width="{B}" height="{H - HORIZONT}" fill="url(#boden)"/>
{dielen}{fugen}
<rect y="{HORIZONT - 14}" width="{B}" height="16" fill="#e9e2d6"/>
<path d="M60 {HORIZONT + 10} L520 {HORIZONT + 10} L980 {H} L130 {H} Z" fill="#f5e7cf" opacity=".55"/>
<!-- Zimmerpflanze am Fenster -->
<g>
  <path d="M270 1010 L430 1010 L410 900 L290 900 Z" fill="#c4784a"/><path d="M282 900 H418 V880 H282 Z" fill="#b06a40"/>
  <path d="M350 885 C330 760 250 640 210 560 C290 610 350 720 362 880 Z" fill="#3f7a4c"/>
  <path d="M352 885 C360 720 420 600 500 540 C470 640 410 760 372 885 Z" fill="#2f6340"/>
  <path d="M348 885 C300 800 220 760 150 750 C230 720 320 760 362 870 Z" fill="#4c8752"/>
  <path d="M356 885 C400 790 480 740 560 730 C490 770 420 830 372 885 Z" fill="#346b45"/>
  <path d="M352 885 C350 760 356 640 370 520 C390 640 384 770 370 885 Z" fill="#2a5c3d"/>
</g>
<rect width="{B}" height="{H}" fill="url(#licht)"/>
<!-- Person auf der Matte, groß im Vordergrund -->
<g transform="translate(-235 -330) scale(1.24)">{person()}</g>
<rect width="{B}" height="{H}" filter="url(#korn)" fill="#fff"/>
</svg>"""


def erzeugen(ziel):
    ziel.write_text(svg(), encoding="utf-8")


if __name__ == "__main__":
    import sys
    from pathlib import Path
    erzeugen(Path(sys.argv[1]))
