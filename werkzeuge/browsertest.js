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
  pruefe("Gewohnheiten beginnt mit der Frage", (await p.textContent("h1")).includes("Woran möchtest du arbeiten?"));
  pruefe("… mit Antworten, die in die App führen", (await p.getAttribute(".richtung", "href")).endsWith("app/#bereich=ruhe"));
  pruefe("… lange Liste eingeklappt, Seite oben", !(await p.evaluate(() => document.querySelector("#alle").open)) && (await p.evaluate(() => scrollY)) === 0);
  await p.goto(`${B}/gewohnheiten/#waldbaden`, { waitUntil: "load" });
  pruefe("Alter Link /gewohnheiten/#waldbaden öffnet Liste und Übung",
    await p.evaluate(() => document.querySelector("#alle").open && document.querySelector("#waldbaden details").open));
  await p.check('input[data-quest="poet"]');
  await p.reload({ waitUntil: "load" });
  pruefe("Quest abhaken bleibt gespeichert", await p.isChecked('input[data-quest="poet"]'));

  const roh = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  await p.goto(`${B}/`, { waitUntil: "load" });
  // vorab gerenderter Titel, HTML-Maskierung (z. B. &#x27;) aufgelöst
  const vorab = await p.evaluate((s) => { const t = document.createElement("textarea"); t.innerHTML = s; return t.value; }, roh.match(/data-feld="titel">([^<]*)</)[1]);
  pruefe("Impuls: vorab gerenderte Idee = Idee nach JavaScript (kein Springen)", (await p.textContent('[data-feld="titel"]')) === vorab, vorab);
  const impulse = JSON.parse(roh.match(/id="impuls-daten">([^<]*)</)[1]).map((x) => x.s);
  pruefe("Impuls schlägt nur Ideen für heute vor", !impulse.some((s) => NICHT_HEUTE.includes(s)));
  pruefe("Startseite ohne Rollenspiel-Kasten, mit „Über mich“", !(await p.$(".habitica")) && Boolean(await p.$("#ueber-mich")));
  const bilder = await p.$$eval("main img", (l) => l.map((i) => i.getAttribute("src")));
  pruefe("Kein Bild doppelt auf der Startseite", new Set(bilder).size === bilder.length);

  await p.goto(`${B}/post/mindful-listening/`, { waitUntil: "load" });
  pruefe("Artikel verlinkt die Gewohnheit direkt in die App", (await p.getAttribute(".gewohnheit-link a", "href")).includes("app/#idee="));
  await p.click(".interaktion a.knopf");
  await p.waitForLoadState("load");
  pruefe("„Erfahrung teilen“ füllt das Formular vor", (await p.inputValue("select[name=Anliegen]")) === "Feedback zu einem Artikel");

  await p.goto(`${B}/book-online/`, { waitUntil: "load" });
  pruefe("Angebot enthält das Seminar", (await p.getAttribute('.angebot a[href*="achtsamkeitsseminar"]', "href")) !== null);
  await p.goto(`${B}/achtsamkeitsseminar/`, { waitUntil: "load" });
  pruefe("Seminar-Seite erreichbar", (await p.textContent("h1")) === "Achtsamkeitsseminar");
  // Seminar-Anmeldung: Formular mit zwei Pflichtfeldern, danach Kalender-Knöpfe (Web3Forms wird im Test simuliert)
  if (await p.$('form[data-danach="seminar-kalender"]')) {
    const pflicht = await p.$$eval('form[data-danach] [required]', (l) => l.map((x) => x.name));
    pruefe("Seminar-Anmeldung: nur Vorname und E-Mail sind Pflicht", pflicht.join(",") === "Vorname,email");
    const ics = await p.evaluate(async () => (await fetch(document.querySelector('a[href$="termin.ics"]').href)).text());
    pruefe("Kalenderdatei mit Erinnerung am Vortag", ics.includes("TRIGGER:-P1D") && ics.split("\r\n").every((z) => new TextEncoder().encode(z).length <= 75));
    const ld = await p.$$eval('script[type="application/ld+json"]', (l) => l.map((x) => JSON.parse(x.textContent)).find((x) => x["@type"] === "Event"));
    pruefe("Termin als schema.org-Event für Suchmaschinen", Boolean(ld?.startDate && ld.location?.address?.streetAddress), ld?.startDate);
    const og = await p.getAttribute('meta[property="og:image"]', "content");
    pruefe("Vorschaubild für WhatsApp & Co. als JPG", og.endsWith(".jpg") && fs.existsSync(path.join(DOCS, new URL(og).pathname)));
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
  await web.close();

  // ------------------------------------------------------------ App: Probier's heute
  const app = await mobil();
  p = await seite(app, OKTOBER);
  await p.goto(`${B}/app/`, { waitUntil: "networkidle" });
  pruefe("App beginnt mit der Frage, ohne Menüleiste", (await p.textContent("#app h1")).includes("Woran") && !(await p.isVisible(".app-navi")));
  await p.click('[data-aktion="frage"][data-slug="ruhe"]');
  const ruhe = await p.evaluate(() => { const s = new Set(); for (let i = 0; i < 150; i++) { AKTIONEN["andere-idee"](); s.add(idee); } return [...s].map((x) => [x, U[x].bereich, heuteMoeglich(U[x])]); });
  pruefe("„Zur Ruhe kommen“ zeigt nur Ruhe-Ideen für heute", ruhe.every(([, b, h]) => b === "ruhe" && h), `${ruhe.length} verschiedene`);
  await p.click('[data-aktion="neu-fragen"]');
  pruefe("„Andere Richtung wählen“ führt zur Frage zurück", (await p.textContent("#app h1")).includes("Woran"));
  await p.click('[data-aktion="frage"][data-slug="alle"]');
  const alle = await p.evaluate(() => { const s = new Set(); for (let i = 0; i < 400; i++) { AKTIONEN["andere-idee"](); s.add(idee); } return [...s]; });
  pruefe("„Überrasch mich“: nie etwas, das heute nicht geht (auch keine Bienen im Oktober)",
    !alle.some((s) => NICHT_HEUTE.includes(s) || s === "bee-love"), `${alle.length} verschiedene`);

  await p.click('[data-aktion="ausprobiert"]');
  const geloggt = await p.evaluate(() => { const u = U[idee]; return u.art === "quest" ? questsLaden().has(idee) : erledigt(tag(), idee); });
  pruefe("„Hab ich ausprobiert“ wird gespeichert", geloggt);
  await p.click(".optionen details.option > summary");
  await p.click('[data-aktion="kal-zeit"][data-wert="08:00"]');
  const google = new URL(await p.getAttribute('.option a[href*="calendar.google"]', "href")).searchParams;
  pruefe("Kalender bleibt offen, Google-Link 14 Tage", await p.evaluate(() => document.querySelector("details.option").open)
    && google.get("recur") === "RRULE:FREQ=DAILY;COUNT=14" && google.get("dates").startsWith("20261014T080000"), google.get("dates"));
  await p.click('[data-aktion="kal-dauer"][data-wert="1"]');
  const [download] = await Promise.all([p.waitForEvent("download"), p.click('[data-aktion="ics-idee"]')]);
  const ics = fs.readFileSync(await download.path(), "utf8");
  pruefe("ICS-Datei einmalig, ohne Wiederholung", ics.includes("BEGIN:VEVENT") && !ics.includes("RRULE"));

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
  pruefe("Link #bereich=erlebnis zeigt eine Quest", await p.evaluate(() => U[idee].art === "quest"));

  await p.click('[data-aktion="laenger"]');
  await p.waitForTimeout(200);
  pruefe("„Länger ausprobieren“ öffnet „Heute“ mit Menüleiste", (await p.evaluate(() => ansicht)) === "heute" && await p.isVisible(".app-navi"));
  // ohne aktive Quest, sonst zeigt questKarte() nur diese und schlägt nichts vor
  const questVorschlaege = await p.evaluate(() => { Z.quest = null; const s = new Set(); for (let i = 0; i < 300; i++) { questVorschlag = null; questKarte(); s.add(questVorschlag); } return [...s]; });
  pruefe("Wochen-Quest schlägt im Oktober keine Bienen vor", questVorschlaege.length > 10 && !questVorschlaege.includes("bee-love"), `${questVorschlaege.length} verschiedene`);
  await app.close();

  const sommer = await mobil();
  p = await seite(sommer, JULI);
  await p.goto(`${B}/app/#idee=bee-love`, { waitUntil: "networkidle" });
  pruefe("Bienen im Juli: ganz normal ausprobierbar", Boolean(await p.$('[data-aktion="ausprobiert"]')) && Boolean(await p.$(".optionen")));
  await sommer.close();

  // ------------------------------------------------------------ App: alte daten.json aus dem Cache
  const alt = await mobil();
  p = await seite(alt, OKTOBER);
  await p.route("**/app/daten.json", async (route) => {
    const d = JSON.parse(fs.readFileSync(path.join(DOCS, "app", "daten.json"), "utf8"));
    d.uebungen.forEach((u) => { delete u.heute; delete u.statt; delete u.monate; });
    delete d.richtungen;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(d) });
  });
  await p.goto(`${B}/app/`, { waitUntil: "networkidle" });
  await p.click('[data-aktion="frage"]');
  pruefe("Alte daten.json ohne neue Felder: App läuft weiter", Boolean(await p.$(".idee h1")));
  await alt.close();

  // ------------------------------------------------------------ App: Routinen, Reflexion, offline, Gerätewechsel
  const routine = await mobil();
  p = await seite(routine, OKTOBER);
  await p.goto(`${B}/app/#start`, { waitUntil: "networkidle" });
  for (const s of ["freude", "koerper"]) await p.click(`[data-aktion="start-bereich"][data-slug="${s}"]`);
  await p.click('[data-aktion="start-weiter"]');
  for (const s of ["naturfreund", "wasserbaendiger"]) await p.click(`[data-aktion="start-wahl"][data-slug="${s}"]`);
  await p.click('[data-aktion="start-weiter"]');
  await p.click('[data-aktion="start-fertig"]');
  await p.click('[data-aktion="abhaken"][data-slug="naturfreund"]');
  pruefe("Auswahl → Heute → Abhaken", (await p.getAttribute('[data-aktion="abhaken"][data-slug="naturfreund"]', "aria-pressed")) === "true");
  await p.click('.punkt-text[data-aktion="reflexion"]');
  await p.click('.stimmung [data-wert="4"]');
  await p.fill('[data-gut="0"]', "Sonne; Tee, Ruhe");
  await p.click('[data-aktion="reflexion-speichern"]');
  pruefe("Abendreflexion wird gespeichert", await p.evaluate(() => Z.log[tag()].stimmung === 4));
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
  pruefe("Übertragungslink: Gewohnheiten auf zweitem Gerät", await p2.evaluate(() => Z.gewohnheiten.length === 2));
  // Präparierter Link: darf kein HTML/JavaScript einschleusen
  const boese = '"><img src=x onerror="window.__xss=1">';
  const giftLink = await p.evaluate(async (b) => `${location.origin}${location.pathname}#import=${await packen({ quests: [b],
    app: { version: 1, start: "2026-10-01", modus: "routine", quest: b, gewohnheiten: [{ slug: "naturfreund", anker: b, seit: b }, { slug: b }],
      log: { "2026-10-12": { erledigt: [b], stimmung: b, gutes: [b], wort: b }, [b]: {} }, erinnerung: { morgen: b, abend: b },
      belohnungen: [{ id: b, name: b, kosten: b }, { id: "1", name: b, kosten: 50 }], hinweise: { [b]: b } } })}`, boese);
  for (const ziel of ["", "#heute", "#fortschritt", "#mehr"]) {
    await p2.goto(ziel ? `${B}/app/${ziel}` : giftLink, { waitUntil: "networkidle" });
    await p2.waitForTimeout(200);
  }
  pruefe("Präparierter Übertragungslink schleust nichts ein", await p2.evaluate(() => !window.__xss && !document.querySelector("#app img")
    && Z.gewohnheiten.length === 1 && Z.erinnerung.morgen === "07:30"));
  await zweites.close();
  await routine.close();

  pruefe("Keine JavaScript-Fehler", jsFehler.length === 0, jsFehler.slice(0, 5).join(" | "));
  await browser.close();
  srv.close();
  console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Prüfung(en) fehlgeschlagen` : "\nAlles in Ordnung");
  process.exit(fehlgeschlagen ? 1 : 0);
})();
