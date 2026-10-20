// Browser-Test für Website und App (Playwright, Chromium).
//
// Aufruf:  python3 bauen.py && PW=$(npm root -g)/playwright node werkzeuge/browsertest.js
// Startet einen kleinen Webserver auf docs/, prüft die wichtigsten Wege und endet mit Code 1, wenn etwas fehlschlägt.
// Datum ist für die App fest auf den 13. Oktober (keine Bienen-Quest), für den Sommer-Test auf den 15. Juli gestellt.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.PW || "playwright");

const DOCS = path.join(__dirname, "..", "docs");
const ARTEN = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml",
  ".webmanifest": "application/manifest+json" };
const NICHT_HEUTE = ["nachtfalter", "ausflug", "lazy-day", "abschluss-reflektion", "community-challenge"];
const OKTOBER = new Date("2026-10-13T10:00:00");
const JULI = new Date("2026-07-15T10:00:00");

let fehlgeschlagen = 0;
const pruefe = (name, ok, info = "") => {
  if (!ok) fehlgeschlagen += 1;
  console.log(`${ok ? "✓" : "✗"} ${name}${info ? ` – ${info}` : ""}`);
};

function server() {
  return http.createServer((anfrage, antwort) => {
    let datei = path.join(DOCS, decodeURIComponent(anfrage.url.split("?")[0]));
    if (fs.existsSync(datei) && fs.statSync(datei).isDirectory()) datei = path.join(datei, "index.html");
    if (!datei.startsWith(DOCS) || !fs.existsSync(datei)) { antwort.writeHead(404); antwort.end(); return; }
    antwort.writeHead(200, { "Content-Type": ARTEN[path.extname(datei)] || "application/octet-stream" });
    fs.createReadStream(datei).pipe(antwort);
  }).listen(0);
}

(async () => {
  const srv = server();
  const B = `http://localhost:${srv.address().port}`;
  const browser = await chromium.launch();
  const jsFehler = [];
  const seite = async (ctx, datum) => {
    const p = await ctx.newPage();
    if (datum) await p.clock.setFixedTime(datum);
    p.on("pageerror", (e) => jsFehler.push(`${p.url()}: ${e.message}`));
    p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && jsFehler.push(`${p.url()}: ${m.text()}`));
    p.on("dialog", (d) => d.accept());
    return p;
  };
  const mobil = () => browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });

  // ------------------------------------------------------------ Website
  const web = await mobil();
  let p = await seite(web);
  const sitemap = fs.readFileSync(path.join(DOCS, "sitemap.xml"), "utf8");
  const pfade = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+([^<]*)<\/loc>/g)].map((m) => m[1]).filter((x) => x !== "/app/");
  const zuBreit = [];
  for (const pfad of pfade) {
    await p.goto(B + pfad, { waitUntil: "load" });
    const ueber = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (ueber > 0) zuBreit.push(`${pfad} (+${ueber}px)`);
  }
  pruefe(`${pfade.length} Seiten laden, keine ist auf dem Handy zu breit`, zuBreit.length === 0, zuBreit.join(", "));

  await p.goto(`${B}/gewohnheiten/`, { waitUntil: "load" });
  pruefe("Gewohnheiten beginnt mit „Was möchtest du verändern?“ und einem Suchfeld", (await p.textContent("h1")).includes("Was möchtest du verändern?")
    && (await p.getAttribute("form.suche", "action")) === "/app/" && Boolean(await p.$('form.suche input[name="suche"]')));
  pruefe("… fertige Routinen (u. a. Digital Detox) führen in die App zum Kalender", (await p.$$(".routine-karte")).length >= 6
    && (await p.getAttribute("#routine-digital-detox a", "href")).endsWith("app/#routine=digital-detox"));
  pruefe("… darunter die Bereiche, deren Antworten in die App führen", (await p.getAttribute(".richtung", "href")).endsWith("app/#bereich=ruhe"));
  await p.fill("form.suche input", "weniger am Handy");
  await Promise.all([p.waitForURL(/app\/#probieren/), p.click("form.suche button")]);
  await p.waitForSelector('[data-aktion="routine-zeigen"]');
  pruefe("Suchfeld der Website: „weniger am Handy“ zeigt in der App die Routine Digital Detox",
    (await p.getAttribute('[data-aktion="routine-zeigen"]', "data-slug")) === "digital-detox" && !p.url().includes("?"));
  await p.goto(`${B}/gewohnheiten/`, { waitUntil: "load" });
  pruefe("… lange Liste eingeklappt, Seite oben", !(await p.evaluate(() => document.querySelector("#alle").open)) && (await p.evaluate(() => scrollY)) === 0);
  await p.goto(`${B}/gewohnheiten/#waldbaden`, { waitUntil: "load" });
  pruefe("Alter Link /gewohnheiten/#waldbaden öffnet Liste und Übung",
    await p.evaluate(() => document.querySelector("#alle").open && document.querySelector("#waldbaden details").open));
  await p.check('input[data-quest="poet"]');
  await p.reload({ waitUntil: "load" });
  pruefe("Quest abhaken bleibt gespeichert", await p.isChecked('input[data-quest="poet"]'));

  const roh = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  await p.goto(`${B}/`, { waitUntil: "load" });
  const impulsTitel = [await p.textContent('[data-feld="titel"]')];
  for (let i = 0; i < 3; i++) { await p.reload({ waitUntil: "load" }); impulsTitel.push(await p.textContent('[data-feld="titel"]')); }
  pruefe("Impuls: bei jedem Laden ein anderer", impulsTitel.every((t, i) => i === 0 || t !== impulsTitel[i - 1]), impulsTitel.join(" → "));
  const infoLink = await p.getAttribute('[data-feld="info"]', "href");
  const impulsJetzt = await p.textContent('[data-feld="titel"]');
  await p.click('[data-feld="info"]');
  await p.waitForLoadState("load");
  pruefe("Impuls „Mehr dazu“ führt zur Info-Seite genau dieser Idee", (await p.textContent("h1")).includes(impulsJetzt)
    && Boolean(await p.$('.idee-heute a[href*="app/#kalender="]')) && (await p.textContent(".idee-heute")).includes("Warum es guttut")
    && Boolean(await p.$(".idee-text p, .idee-text li")), infoLink);
  await p.goto(`${B}/`, { waitUntil: "load" });
  const impulse = JSON.parse(roh.match(/id="impuls-daten">([^<]*)</)[1]).map((x) => x.s);
  pruefe("Impuls schlägt nur Ideen für heute vor", !impulse.some((s) => NICHT_HEUTE.includes(s)));
  pruefe("Startseite ohne Rollenspiel-App, mit „Über mich“", !(await p.textContent("main")).includes("Habitica") && Boolean(await p.$("#ueber-mich")));
  pruefe("Startseite: Wege im Kopfbereich und „Meine Learnings“ mit Artikeln je Thema",
    (await p.$$(".held .weg")).length >= 2 && (await p.$$(".learning")).length === 4 && (await p.$$(".learning-artikel a[href*='post/']")).length >= 4);
  pruefe("Impuls: Aktionen als Knöpfe, „Mehr über diese Idee“ getrennt darunter",
    Boolean(await p.$('.impuls .knopf-reihe [data-feld="kalender"]')) && Boolean(await p.$('.impuls-fuss [data-feld="info"]')));
  const bilder = await p.$$eval("main img", (l) => l.map((i) => i.getAttribute("src")));
  pruefe("Kein Bild doppelt auf der Startseite", new Set(bilder).size === bilder.length);
  // Handy: Navigation hinter „Menü“, klappt mit Kontakt und „Probier’s heute“ auf, Escape schließt
  const navZu = !(await p.isVisible("#hauptmenue"));
  await p.click("[data-menue-knopf]");
  const navOffen = await p.isVisible('#hauptmenue a[href$="#kontakt"]') && await p.isVisible("#hauptmenue .navi-app");
  await p.keyboard.press("Escape");
  pruefe("Handy-Menü: zu, klappt mit Kontakt und App auf, Escape schließt", navZu && navOffen && !(await p.isVisible("#hauptmenue"))
    && (await p.getAttribute("[data-menue-knopf]", "aria-expanded")) === "false");
  // Hell/Dunkel: Knopf schaltet um, die Wahl bleibt nach dem Neuladen
  const grund = () => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const hell = await grund();
  await p.click("[data-thema-knopf]");
  const dunkel = await grund();
  await p.reload({ waitUntil: "load" });
  pruefe("Hell/Dunkel-Knopf schaltet um und merkt sich die Wahl", hell !== dunkel && (await grund()) === dunkel
    && (await p.getAttribute("html", "data-thema")) === "dunkel");
  await p.evaluate(() => localStorage.removeItem("phoenix-feder-thema"));
  // Angebote: Handy eine Spalte, Desktop alle normalen Karten in einer Reihe (keine Karte allein in einer Zeile)
  const spalten = (s) => s.$$eval(".angebot:not(.breit)", (l) => new Set(l.map((a) => Math.round(a.getBoundingClientRect().top))).size);
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pd = await seite(desk);
  await pd.goto(`${B}/`, { waitUntil: "load" });
  const reihenDesktop = await spalten(pd);
  await pd.setViewportSize({ width: 768, height: 1000 });
  const reihenTablet = await spalten(pd);
  const anzahl = (await p.$$(".angebot:not(.breit)")).length;
  pruefe("Angebote: Handy untereinander, Tablet je zwei, Desktop eine Reihe", (await spalten(p)) === anzahl && reihenTablet === Math.ceil(anzahl / 2)
    && reihenDesktop === 1, `${anzahl} Karten, Tablet ${reihenTablet} Reihen, Desktop ${reihenDesktop}`);
  await desk.close();
  // Schreibstil: keine Gedankenstriche im sichtbaren Text (Zahlenbereiche wie 2015–2024 sind erlaubt)
  const mitStrich = [];
  const alleSeiten = (ordner) => fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? alleSeiten(path.join(ordner, e.name)) : e.name.endsWith(".html") ? [path.join(ordner, e.name)] : []);
  for (const datei of alleSeiten(DOCS)) {
    const text = fs.readFileSync(datei, "utf8").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<title>[\s\S]*?<\/title>/g, "").replace(/<[^>]+>/g, " ");
    const fund = text.match(/.{0,30}(?<!\d\s?)[–—](?!\s?\d).{0,30}/);
    if (fund) mitStrich.push(`${path.relative(DOCS, datei)}: ${fund[0].trim()}`);
  }
  pruefe("Kein Gedankenstrich im sichtbaren Text", mitStrich.length === 0, mitStrich.slice(0, 3).join(" | "));

  await p.goto(`${B}/post/mindful-listening/`, { waitUntil: "load" });
  pruefe("Artikel verlinkt die Gewohnheit direkt in die App", (await p.getAttribute(".gewohnheit-link a", "href")).includes("app/#idee="));
  await p.click(".interaktion a.knopf");
  await p.waitForLoadState("load");
  pruefe("„Erfahrung teilen“ füllt das Formular vor", (await p.inputValue("select[name=Anliegen]")) === "Feedback zu einem Artikel");

  await p.goto(`${B}/book-online/`, { waitUntil: "load" });
  pruefe("Angebot enthält das Seminar", (await p.getAttribute('.angebot a[href*="achtsamkeitsseminar"]', "href")) !== null);
  await p.goto(`${B}/achtsamkeitsseminar/`, { waitUntil: "load" });
  pruefe("Seminar-Seite erreichbar", (await p.textContent("h1")) === "Achtsamkeitsseminar");
  pruefe("Seminar-Seite schlank: Kurzinfo und Anmeldung ganz oben, Methoden verlinkt, keine Schokoladen-Übung",
    Boolean(await p.$("#anmelden h1")) && (await p.$$("#anmelden .termin-daten li, #anmelden form")).length >= 1
    && (await p.$$(".methoden a")).length >= 6 && !(await p.textContent("main")).includes("Schokolade"));
  // Seminar-Anmeldung: Formular mit zwei Pflichtfeldern, danach Kalender-Knöpfe (Web3Forms wird im Test simuliert)
  if (await p.$('form[data-danach="seminar-kalender"]')) {
    const pflicht = await p.$$eval('form[data-danach] [required]', (l) => l.map((x) => x.name));
    pruefe("Seminar-Anmeldung: nur Vorname und E-Mail sind Pflicht", pflicht.join(",") === "Vorname,email");
    const ics = await p.evaluate(async () => (await fetch(document.querySelector('a[href$="termin.ics"]').href)).text());
    pruefe("Kalenderdatei mit Erinnerung am Vortag", ics.includes("TRIGGER:-P1D") && ics.split("\r\n").every((z) => new TextEncoder().encode(z).length <= 75));
    const ld = await p.$$eval('script[type="application/ld+json"]', (l) => l.map((x) => JSON.parse(x.textContent)).find((x) => x["@type"] === "Event"));
    pruefe("Termin als schema.org-Event für Suchmaschinen", Boolean(ld?.startDate && ld.location?.address?.streetAddress), ld?.startDate);
    const og = await p.getAttribute('meta[property="og:image"]', "content");
    pruefe("Vorschaubild für WhatsApp & Co. als JPG, mit Fassung in der Adresse", new URL(og).pathname.endsWith(".jpg") && /\?v=[0-9a-f]{8}$/.test(og) && fs.existsSync(path.join(DOCS, new URL(og).pathname)));
    await p.route("https://api.web3forms.com/**", (route) => route.fulfill({ contentType: "application/json", body: '{"success":true}' }));
    await p.fill('form[data-danach] [name="Vorname"]', "Test");
    await p.fill('form[data-danach] [name="email"]', "test@example.org");
    await p.click('form[data-danach] button[type="submit"]');
    await p.waitForSelector("#seminar-kalender:not([hidden])", { timeout: 5000 }).catch(() => {});
    pruefe("Nach der Anmeldung erscheinen die Kalender-Knöpfe", await p.isVisible("#seminar-kalender"));
    await p.goto(`${B}/book-online/`, { waitUntil: "load" });
    pruefe("Angebotskarte: „Platz sichern“ mit Termin", (await p.textContent('.angebot a[href*="achtsamkeitsseminar"]')).includes("Platz sichern"));
  } else {
    pruefe("Kein Seminartermin geplant: Anfrageformular statt Anmeldung", (await p.inputValue("#anmelden select[name=Anliegen]")) === "Achtsamkeitsseminar");
  }
  // Quiz: sofortige Auflösung mit Quelle; Antworten nur nach ausdrücklichem Ja (Web3Forms simuliert)
  const gesendet = [];
  await p.route("https://api.web3forms.com/**", async (route) => {
    gesendet.push(route.request().postData() || "");
    await route.fulfill({ contentType: "application/json", body: '{"success":true}' });
  });
  await p.goto(`${B}/`, { waitUntil: "load" });
  pruefe("Startseite: Realitätscheck-Quiz über dem Impuls, ohne vorab zu verraten, wohin man sich verschätzt",
    !(await p.$('.held a[href*="quiz/"]')) && Boolean(await p.$('#realitaetscheck ~ #impuls'))
    && Boolean(await p.$('#realitaetscheck .quiz-teaser a[href*="quiz/"]')) && !/düster|pessimistisch eing|zu pessimistisch/i.test(await p.textContent("#realitaetscheck")));
  const lern = await p.$eval(".learnings", (l) => ({ h: l.getBoundingClientRect().height, wischen: l.scrollWidth > l.clientWidth }));
  pruefe("Handy: Learnings als Wischleiste statt langer Liste", lern.wischen && lern.h < 700, `${Math.round(lern.h)}px hoch`);
  await p.click("#realitaetscheck .quiz-probe .quiz-antwort >> nth=0");
  await p.waitForSelector(".quiz-kopf");
  pruefe("Startseite: Antwort auf die Einstiegsfrage startet das Quiz direkt bei Frage 1",
    (await p.textContent(".quiz-kopf")).includes("Frage 1 von") && !p.url().includes("#"));
  const umleitung = await (await p.context().request.get(`${B}/post/sehen-was-ist/`)).text();
  pruefe("Umbenannter Artikel: alte Adresse leitet weiter", umleitung.includes("die-realitaet-sehen/"));
  const kurz = await (await p.context().request.get(`${B}/seminar/`)).text();
  pruefe("Kurzadresse /seminar/ (QR-Code) führt zur Anmeldung", kurz.includes("achtsamkeitsseminar/#anmelden"));
  await p.goto(`${B}/quiz/`, { waitUntil: "load" });
  const QD = JSON.parse(await p.textContent("#quiz-daten"));
  const N = QD.fragen.length;
  let studienZeilen = 0;
  const quizRunde = async (beitragen) => {
    await p.click('[data-quiz-aktion="weltbild"][data-wert="2"]');
    let mitQuelle = true;
    studienZeilen = 0;
    for (let i = 0; i < N; i++) {
      // immer die erste zu pessimistische Antwort (sonst die erste falsche) → Ergebnis „eher pessimistisch“
      const a = QD.fragen[i].antworten;
      const wahl = a.findIndex((x) => x[1] === "p") >= 0 ? a.findIndex((x) => x[1] === "p") : a.findIndex((x) => x[1] !== "r");
      await p.click(`[data-quiz-aktion="antwort"][data-wert="${wahl}"]`);
      mitQuelle &&= Boolean(await p.$('.quiz-aufloesung a[href^="https://"]')) && (await p.textContent(".quiz-urteil")).length > 0;
      if (await p.$(".quiz-studie")) studienZeilen += 1;
      await p.click('[data-quiz-aktion="weiter"]');
    }
    if (beitragen !== null) await p.click(`[data-quiz-aktion="beitragen"][data-wert="${beitragen}"]`);
    await p.waitForTimeout(300);
    return mitQuelle;
  };
  const mitQuelle = await quizRunde("nein");
  pruefe(`Quiz: ${N} Fragen, jede sofort aufgelöst mit Quelle, Ergebnis mit Schimpansen-Vergleich`,
    N >= 18 && mitQuelle && (await p.textContent(".quiz-zahl")).includes(`von ${N}`) && (await p.textContent(".quiz-ergebnis")).includes("Schimpanse"));
  const positionen = QD.fragen.map((f) => f.antworten.findIndex((a) => a[1] === "r"));
  pruefe("Quiz: Antworten von düster nach rosig, richtige nie ganz außen, B und C etwa gleich oft", positionen.every((x) => x === 1 || x === 2)
    && [1, 2].every((k) => positionen.filter((x) => x === k).length >= N / 3));
  pruefe("Quiz: jede Frage hat vier Antworten, darunter eine zu pessimistische und eine zu optimistische",
    QD.fragen.every((f) => f.antworten.length === 4 && f.antworten.some((a) => a[1] === "p") && f.antworten.some((a) => a[1] === "o")));
  pruefe("Quiz: Wert aus Roslings Studie bei jeder vergleichbaren Frage", studienZeilen === QD.fragen.filter((f) => f.studie).length && studienZeilen > 0);
  const zeiger = await p.$eval(".quiz-zeiger-punkt", (z) => parseFloat(z.style.left));
  pruefe("Quiz: Einordnung des Weltbilds mit Skala, Zeiger und Verteilung (nur zu pessimistisch → deutlich pessimistisch)",
    (await p.textContent(".quiz-typ")) === "Deutlich pessimistisch" && (await p.textContent(".quiz-skala .aktiv")) === "Pessimistisch"
    && zeiger < 10 && Boolean(await p.$(".quiz-verteilung .v-p")) && (await p.textContent(".quiz-verteilung-legende")).includes(`${N} zu pessimistisch`), `Zeiger ${zeiger} %`);
  pruefe("Quiz: Abschnitt „realistischer Optimismus“ mit Quellen",
    (await p.textContent(".quiz-optimismus h3")).includes("realistischer Optimismus") && (await p.$$('.quiz-optimismus a[href*="pubmed"]')).length >= 4);
  pruefe("Quiz: Übersicht zeigt alle Antwortmöglichkeiten, die richtige und die eigene",
    (await p.$$(".quiz-optionen > li")).length === QD.fragen.reduce((s, f) => s + f.antworten.length, 0) && (await p.$$(".quiz-optionen li.ok")).length === N && (await p.$$(".quiz-optionen li.du")).length > 0);
  pruefe("Quiz: „Nur Ergebnis zeigen“ sendet nichts", gesendet.length === 0);
  const artikelLink = await p.getAttribute('.knopf-reihe a[href*="/post/"]', "href");
  pruefe("Quiz: Ergebnis verlinkt einen vorhandenen Artikel", Boolean(artikelLink) && (await (await p.context().request.get(`${B}${artikelLink}`)).ok()));
  await p.click('[data-quiz-aktion="neu"]');
  await quizRunde("ja");
  const daten = gesendet[0] && JSON.parse(gesendet[0].match(/name="Daten"\r\n\r\n(.*)\r\n/)[1]);
  pruefe("Quiz: „Ja“ sendet anonym Antworten und Bauchgefühl, ohne Name und E-Mail", gesendet.length === 1 && daten.a.length === N && daten.w === 2 && daten.t === "pessimistisch"
    && !/name="(email|Vorname|Name)"/.test(gesendet[0]) && (await p.textContent(".quiz-status")).includes("Danke"));
  await p.click('[data-quiz-aktion="neu"]');
  await quizRunde(null);
  pruefe("Quiz: wer schon beigetragen hat, wird nicht doppelt gezählt", gesendet.length === 1 && Boolean(await p.$(".quiz-ergebnis")));
  await web.close();

  // ------------------------------------------------------------ App: Probier's heute
  const app = await mobil();
  p = await seite(app, OKTOBER);
  await p.goto(`${B}/app/`, { waitUntil: "networkidle" });
  pruefe("App beginnt mit „Was möchtest du verändern?“ und den Bereichen, ohne Menüleiste", (await p.textContent("#app h1")).includes("verändern")
    && Boolean(await p.$('[data-form="suche"]')) && Boolean(await p.$('[data-aktion="frage"][data-slug="ruhe"]')) && !(await p.isVisible(".app-navi")));
  // Freitext: passende Routine und Ideen; Unbekanntes führt zum Kontaktformular
  const treffer = await p.evaluate(() => Object.fromEntries(["Digital Detox", "weniger am Handy hängen", "ich schlafe schlecht",
    "Stress bei der Arbeit", "fühle mich einsam", "mehr Sport"].map((q) => [q, suchen(q).routinen[0]?.slug])));
  pruefe("Suche findet die passende Routine", treffer["Digital Detox"] === "digital-detox" && treffer["weniger am Handy hängen"] === "digital-detox"
    && treffer["ich schlafe schlecht"] === "besser-schlafen" && treffer["Stress bei der Arbeit"] === "weniger-stress"
    && treffer["fühle mich einsam"] === "mehr-naehe" && treffer["mehr Sport"] === "mehr-energie", JSON.stringify(treffer));
  await p.fill('[data-form="suche"] input', "xyzqq");
  await p.click('[data-form="suche"] button');
  pruefe("… ohne Treffer: Hinweis, fertige Routinen und Link „Schreib Nikolas, was du suchst“",
    (await p.textContent("#app h1")).includes("noch nichts") && Boolean(await p.$('a[href*="nachricht="][href*="xyzqq"]')));
  await p.click('[data-aktion="routine-zeigen"][data-slug="digital-detox"]');
  await p.fill('[data-feld="routine-zeit"][data-i="3"]', "22:00");
  await p.dispatchEvent('[data-feld="routine-zeit"][data-i="3"]', "change");
  const routineLinks = await p.$$eval('#kalender a[target="_blank"]', (l) => l.map((a) => new URL(a.href).searchParams));
  const schlafLink = await p.$$eval('#kalender a[target="_blank"]', (l) => new URL(l[l.length - 1].href).searchParams.get("dates"));
  const [routineDl] = await Promise.all([p.waitForEvent("download"), p.click('[data-aktion="ics-routine"]')]);
  const routineIcs = fs.readFileSync(await routineDl.path(), "utf8");
  pruefe("Routine: je Schritt ein Google-Termin, eigene Zeit übernommen, alle als eine Datei (einmaliger Schritt ohne Wiederholung)",
    routineLinks.length === 5 && schlafLink.includes("T220000") && (routineIcs.match(/BEGIN:VEVENT/g) || []).length === 5
    && (routineIcs.match(/RRULE:FREQ=DAILY;COUNT=14/g) || []).length === 4 && routineIcs.includes("UID:routine-digital-detox-1@")
    && routineIcs.split("\r\n").every((z) => Buffer.byteLength(z) <= 75));
  await p.click('[data-aktion="routine-zurueck"]');
  await p.click('[data-aktion="suche-weg"]');
  await p.click('[data-aktion="frage"][data-slug="ruhe"]');
  pruefe("Zweite Frage: Wie viel Zeit?", (await p.textContent("#app h1")).includes("Zeit"));
  await p.click('[data-aktion="zeit"][data-slug="kurz"]');
  const ruhe = await p.$$eval('[data-aktion="idee-zeigen"]', (l) => l.map((x) => x.dataset.slug));
  const ruheOk = await p.evaluate((l) => l.every((s) => U[s].bereich === "ruhe" && heuteMoeglich(U[s]) && U[s].art !== "quest"), ruhe);
  pruefe("Ruhe + wenig Zeit: Liste aller passenden Ideen statt einer Zufallsidee", ruhe.length >= 4 && ruheOk, `${ruhe.length} Ideen`);
  await p.click('[data-aktion="neu-fragen"]');
  pruefe("„Fragen neu beantworten“ führt zur ersten Frage", Boolean(await p.$('[data-aktion="frage"][data-slug="alle"]')));
  await p.click('[data-aktion="frage"][data-slug="alle"]');
  await p.click('[data-aktion="zeit"][data-slug="egal"]');
  const alle = await p.$$eval('[data-aktion="idee-zeigen"]', (l) => l.map((x) => x.dataset.slug));
  pruefe("Alle Bereiche: nie etwas, das heute nicht geht (auch keine Bienen im Oktober)",
    alle.length > 30 && !alle.some((s) => NICHT_HEUTE.includes(s) || s === "bee-love" || s === "reflektion"), `${alle.length} Ideen`);
  await p.click('[data-aktion="idee-zeigen"][data-slug="naturfreund"]');
  await p.click('[data-aktion="ausprobiert"]');
  pruefe("„Hab ich ausprobiert“ wird gespeichert", await p.evaluate(() => erledigt(tag(), "naturfreund")));
  const titel = await p.evaluate(() => U.naturfreund.titel);
  await p.reload({ waitUntil: "networkidle" });
  pruefe("App geschlossen und neu geöffnet: geht an derselben Stelle weiter", (await p.textContent(".idee h1")).includes(titel));
  await p.click('[data-aktion="zur-auswahl"]');
  pruefe("… zurück zur Auswahl, Ausprobiertes ist markiert",
    (await p.textContent('[data-aktion="idee-zeigen"][data-slug="naturfreund"]')).includes("✓ Ausprobiert"));
  await p.click('[data-aktion="idee-zeigen"][data-slug="naturfreund"]');
  pruefe("Kalender ist der Hauptweg: gleich sichtbar, passende Zeit vorgewählt", await p.isVisible("#kalender")
    && (await p.getAttribute('#kalender [data-aktion="kal-zeit"][aria-pressed="true"]', "data-wert")) === "12:30");
  await p.click('[data-aktion="kal-zeit"][data-wert="08:00"]');
  const googleLink = async () => new URL(await p.getAttribute('.kalender-aktion a[href*="calendar.google"]', "href")).searchParams;
  const google = await googleLink();
  pruefe("Google-Termin 14 Tage, mit „Warum es guttut“, „Passt gut“ und Link zur Info-Seite", google.get("recur") === "RRULE:FREQ=DAILY;COUNT=14"
    && google.get("dates").startsWith("20261014T080000") && google.get("details").includes("Warum es guttut:")
    && google.get("details").includes("Passt gut:") && google.get("details").includes("/gewohnheiten/naturfreund/"), google.get("dates"));
  await p.click('[data-aktion="kal-dauer"][data-wert="60"]');
  pruefe("„2 Monate“ = 60 tägliche Termine, „Dauerhaft“ ohne Ende", (await googleLink()).get("recur") === "RRULE:FREQ=DAILY;COUNT=60"
    && (await p.click('[data-aktion="kal-dauer"][data-wert="0"]').then(googleLink)).get("recur") === "RRULE:FREQ=DAILY");
  await p.click('[data-aktion="kal-dauer"][data-wert="1"]');
  const [download] = await Promise.all([p.waitForEvent("download"), p.click('[data-aktion="ics-idee"]')]);
  const ics = fs.readFileSync(await download.path(), "utf8");
  pruefe("ICS einmalig, Zeilen höchstens 75 Bytes, Beschreibung vollständig, Hinweis zum Öffnen", ics.includes("BEGIN:VEVENT") && !ics.includes("RRULE")
    && ics.includes("UID:naturfreund@") && ics.split("\r\n").every((z) => new TextEncoder().encode(z).length <= 75)
    && ics.replace(/\r\n /g, "").includes("Warum es guttut:") && (await p.textContent("[data-toast]")).includes("Kalenderdatei"));
  const folge = await p.$$eval('#kalender [data-aktion="kalender-zeigen"]', (l) => l.map((x) => x.dataset.slug));
  const folgeZeiten = await p.evaluate((l) => l.map((s) => U[s].zeit), folge);
  pruefe("Danach: „Passt noch etwas dazu?“ – Ideen zu anderen Tageszeiten", (await p.textContent("#kalender")).includes("Im Kalender")
    && folge.length >= 2 && folgeZeiten.every((z) => z.slice(0, 2) !== "08"), folge.join(", "));
  await p.click(`#kalender [data-aktion="kalender-zeigen"][data-slug="${folge[0]}"]`);
  pruefe("… ein Tipp öffnet die nächste Idee direkt beim Kalender, mit ihrer passenden Zeit", (await p.evaluate(() => idee)) === folge[0]
    && (await p.getAttribute('#kalender [data-aktion="kal-zeit"][aria-pressed="true"]', "data-wert")) === folgeZeiten[0]);
  await p.goto(`${B}/app/#mehr`, { waitUntil: "networkidle" });
  const [alleDl] = await Promise.all([p.waitForEvent("download"), p.click('[data-aktion="ics-alle"]')]);
  pruefe("„Mein Kalender“ listet Eingetragenes, alles als eine Datei", (await p.textContent(".kalender-liste")).includes("Naturfreund")
    && fs.readFileSync(await alleDl.path(), "utf8").includes("UID:naturfreund@"));
  await p.goto(`${B}/`); await p.goto(`${B}/app/#kalender=digital-health`, { waitUntil: "networkidle" });
  pruefe("Link #kalender= öffnet die Idee beim Kalender, 21.00 vorgewählt",
    (await p.getAttribute('#kalender [data-aktion="kal-zeit"][aria-pressed="true"]', "data-wert")) === "21:00"
    && await p.evaluate(() => { const r = document.querySelector("#kalender").getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  await p.goto(`${B}/app/#entdecken`, { waitUntil: "networkidle" });
  pruefe("„Alle Ideen“ nach Bereichen, zum Stöbern ohne Aufnehmen-Knöpfe",
    (await p.locator(".gruppe-app").count()) >= 5 && !(await p.$('#app [data-aktion="hinzufuegen"]')));

  await p.goto(`${B}/`); await p.goto(`${B}/app/#idee=nachtfalter`, { waitUntil: "networkidle" });
  pruefe("Nachtfalter: „Braucht etwas Zeit“, kein Abhaken, Ideen für heute",
    (await p.textContent(".oberzeile")).includes("Braucht etwas Zeit") && !(await p.$('[data-aktion="ausprobiert"]'))
    && (await p.locator('[data-aktion="idee-zeigen"]').count()) === 2);
  await p.click('[data-aktion="idee-zeigen"][data-slug="digital-health"]');
  pruefe("… Alternative öffnet sich mit „Hab ich ausprobiert“", (await p.textContent(".idee h1")).includes("Digital Health") && Boolean(await p.$('[data-aktion="ausprobiert"]')));
  await p.goto(`${B}/`); await p.goto(`${B}/app/#idee=lazy-day`, { waitUntil: "networkidle" });
  pruefe("Lazy Day: „Braucht etwas Planung“, abhakbar", (await p.textContent(".oberzeile")).includes("Planung")
    && (await p.textContent('[data-aktion="ausprobiert"]')).includes("Hab ich gemacht"));
  await p.goto(`${B}/`); await p.goto(`${B}/app/#idee=bee-love`, { waitUntil: "networkidle" });
  pruefe("Bienen im Oktober: keine Kalender-/Routinen-Optionen", (await p.textContent(".oberzeile")).includes("Jahreszeit") && !(await p.$(".optionen")));
  await p.goto(`${B}/`); await p.goto(`${B}/app/#bereich=erlebnis`, { waitUntil: "networkidle" });
  const erlebnisse = await p.$$eval('[data-aktion="idee-zeigen"]', (l) => l.map((x) => x.dataset.slug));
  pruefe("Link #bereich=erlebnis zeigt nur Quests", erlebnisse.length > 5 && await p.evaluate((l) => l.every((s) => U[s].art === "quest"), erlebnisse));

  await p.click('[data-aktion="idee-zeigen"]');
  pruefe("Zwei Wege zum Dranbleiben: zuerst Kalender, dann die App mit Hinweis aufs Gerät",
    Boolean(await p.$("#kalender + .optionen")) && (await p.textContent(".optionen")).includes("nur auf diesem Gerät"));
  await p.click('[data-aktion="laenger"]');
  await p.waitForTimeout(200);
  pruefe("„Länger ausprobieren“ öffnet „Heute“ mit Menüleiste", (await p.evaluate(() => ansicht)) === "heute" && await p.isVisible(".app-navi"));
  pruefe("Danach: Hinweis, die App auf den Startbildschirm zu legen", (await p.textContent(".hinweis-karte")).includes("Startbildschirm"));
  pruefe("„Heute“ legt nichts ungefragt an: keine festen Täglich-Punkte, Abendreflexion nur als Angebot",
    !(await p.$('[data-slug="bewegung"]')) && !(await p.$('.punkt-text[data-aktion="reflexion"]')) && Boolean(await p.$('[data-aktion="reflexion-wahl"]')));
  // ohne aktive Quest, sonst zeigt questKarte() nur diese und schlägt nichts vor
  const questVorschlaege = await p.evaluate(() => { Z.quest = null; const s = new Set(); for (let i = 0; i < 300; i++) { questVorschlag = null; questKarte(); s.add(questVorschlag); } return [...s]; });
  pruefe("Wochen-Quest schlägt im Oktober keine Bienen vor", questVorschlaege.length > 10 && !questVorschlaege.includes("bee-love"), `${questVorschlaege.length} verschiedene`);
  await p.goto(`${B}/app/#fortschritt`, { waitUntil: "networkidle" });
  pruefe("Fortschritt ohne Punkte und Belohnungen, ohne Werbung für Habitica",
    !(await p.$('[data-aktion="einloesen"], .stufe, [data-federn]')) && !(await p.textContent("#app")).includes("Habitica"));
  await app.close();

  const sommer = await mobil();
  p = await seite(sommer, JULI);
  await p.goto(`${B}/app/#idee=bee-love`, { waitUntil: "networkidle" });
  pruefe("Bienen im Juli: ganz normal ausprobierbar", Boolean(await p.$('[data-aktion="ausprobiert"]')) && Boolean(await p.$(".optionen")));
  await sommer.close();

  // ------------------------------------------------------------ App: alte daten.json aus dem Cache, alter Zustand
  const alt = await mobil();
  p = await seite(alt, OKTOBER);
  await p.route("**/app/daten.json", async (route) => {
    const d = JSON.parse(fs.readFileSync(path.join(DOCS, "app", "daten.json"), "utf8"));
    d.uebungen.forEach((u) => { delete u.heute; delete u.statt; delete u.monate; delete u.bereich; });
    delete d.richtungen;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(d) });
  });
  await p.goto(`${B}/app/`, { waitUntil: "networkidle" });
  await p.click('[data-aktion="frage"]');
  await p.click('[data-aktion="zeit"]');
  await p.click('[data-aktion="idee-zeigen"]');
  pruefe("Alte daten.json ohne neue Felder: App läuft weiter", Boolean(await p.$(".idee h1")));
  await p.unroute("**/app/daten.json");
  await p.evaluate(() => localStorage.setItem("phoenix-feder-app", JSON.stringify({ version: 1, start: "2026-10-01", modus: "routine",
    gewohnheiten: [{ slug: "naturfreund", anker: "", seit: "2026-10-01" }], log: { "2026-10-05": { erledigt: ["bewegung", "naturfreund"], stimmung: 3 } },
    belohnungen: [{ id: "1", name: "Kino", kosten: 100 }], eingeloest: [], hinweise: {}, erinnerung: { morgen: "07:30", abend: "21:00" } })));
  await p.goto(`${B}/app/`, { waitUntil: "networkidle" });
  pruefe("Alter Zustand: Genutztes aus „Täglich“ bleibt als eigene Auswahl, Belohnungen entfallen", await p.evaluate(() =>
    Z.gewohnheiten.map((g) => g.slug).join() === "naturfreund,bewegung" && Z.reflexion === true && !("belohnungen" in Z)));
  await p.evaluate(() => localStorage.setItem("phoenix-feder-app", JSON.stringify({ version: 1, start: "2026-09-01", modus: "probieren", reflexion: null,
    gewohnheiten: [], log: {}, hinweise: {}, kalender: { "digital-health": { zeit: "21:00", dauer: "14", datum: "2026-09-20" } } })));
  await p.goto(`${B}/app/`, { waitUntil: "networkidle" });
  const auslauf = Boolean(await p.$('[data-aktion="verlaengern"]'));
  await p.click('[data-aktion="verlaengern"]');
  pruefe("Erinnerung nach 2 Wochen ausgelaufen: „Verlängern“ schlägt 2 Monate vor", auslauf
    && (await p.getAttribute('#kalender [data-aktion="kal-dauer"][aria-pressed="true"]', "data-wert")) === "60");
  await alt.close();

  // ------------------------------------------------------------ App: Routinen, Reflexion, offline, Gerätewechsel
  const routine = await mobil();
  p = await seite(routine, OKTOBER);
  await p.goto(`${B}/app/#start`, { waitUntil: "networkidle" });
  for (const s of ["freude", "koerper"]) await p.click(`[data-aktion="start-bereich"][data-slug="${s}"]`);
  await p.click('[data-aktion="start-weiter"]');
  pruefe("Eigene Auswahl: Bewegung ist eine normale Wahl bei „Körper“", Boolean(await p.$('[data-aktion="start-wahl"][data-slug="bewegung"]')));
  for (const s of ["naturfreund", "wasserbaendiger"]) await p.click(`[data-aktion="start-wahl"][data-slug="${s}"]`);
  await p.click('[data-aktion="start-weiter"]');
  await p.click('[data-aktion="start-fertig"]');
  await p.click('[data-aktion="abhaken"][data-slug="naturfreund"]');
  pruefe("Auswahl → Heute → Abhaken", (await p.getAttribute('[data-aktion="abhaken"][data-slug="naturfreund"]', "aria-pressed")) === "true");
  pruefe("„Heute“ zeigt nur die zwei gewählten Gewohnheiten", (await p.locator('.liste [data-aktion="abhaken"]').count()) === 2);
  await p.click('[data-aktion="reflexion-wahl"][data-wert="ja"]');
  await p.click('.punkt-text[data-aktion="reflexion"]');
  await p.click('.stimmung [data-wert="4"]');
  await p.fill('[data-gut="0"]', "Sonne; Tee, Ruhe");
  pruefe("Abendreflexion wird sofort gespeichert (auch ohne „Fertig“)", await p.evaluate(() => Z.log[tag()].stimmung === 4
    && JSON.parse(localStorage.getItem("phoenix-feder-app")).log[tag()].gutes[0] === "Sonne; Tee, Ruhe"));
  await p.click('[data-aktion="reflexion-speichern"]');
  await p.waitForTimeout(800);
  await routine.setOffline(true);
  await p.reload({ waitUntil: "load" });
  await p.waitForTimeout(500);
  pruefe("Offline startet die App aus dem Cache", (await p.textContent("#app h1")).startsWith("Heute"));
  await routine.setOffline(false);
  const link = await p.evaluate(async () => `${location.origin}${location.pathname}#import=${await packen(sicherung())}`);
  const zweites = await mobil();
  const p2 = await seite(zweites, OKTOBER);
  await p2.goto(link, { waitUntil: "networkidle" });
  await p2.waitForTimeout(400);
  pruefe("Übertragungslink: Gewohnheiten und Abendreflexion auf zweitem Gerät", await p2.evaluate(() => Z.gewohnheiten.length === 2 && Z.reflexion === true));
  // Präparierter Link: darf kein HTML/JavaScript einschleusen
  const boese = '"><img src=x onerror="window.__xss=1">';
  const giftLink = await p.evaluate(async (b) => `${location.origin}${location.pathname}#import=${await packen({ quests: [b],
    app: { version: 1, start: "2026-10-01", modus: "routine", quest: b, gewohnheiten: [{ slug: "naturfreund", anker: b, seit: b }, { slug: b }],
      log: { "2026-10-12": { erledigt: [b], stimmung: b, gutes: [b], wort: b }, [b]: {} }, erinnerung: { morgen: b, abend: b },
      belohnungen: [{ id: b, name: b, kosten: b }, { id: "1", name: b, kosten: 50 }], hinweise: { [b]: b },
      reflexion: b, probieren: { bereich: b, zeit: "toString", idee: b } } })}`, boese);
  for (const ziel of ["", "#heute", "#fortschritt", "#mehr", "#probieren"]) {
    await p2.goto(ziel ? `${B}/app/${ziel}` : giftLink, { waitUntil: "networkidle" });
    await p2.waitForTimeout(200);
  }
  pruefe("Präparierter Übertragungslink schleust nichts ein", await p2.evaluate(() => !window.__xss && !document.querySelector("#app img")
    && Z.gewohnheiten.length === 1 && Z.erinnerung.morgen === "07:30" && Z.reflexion === null && Z.probieren.zeit === ""));
  await zweites.close();
  await routine.close();

  pruefe("Keine JavaScript-Fehler", jsFehler.length === 0, jsFehler.slice(0, 5).join(" | "));
  await browser.close();
  srv.close();
  console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen` : "\nAlles in Ordnung");
  process.exit(fehlgeschlagen ? 1 : 0);
})();
