// Phoenix Feder – Probier's heute / Meine Routinen
//
// Zwei Stufen: Zuerst nur "Probier's heute" – zwei kurze Fragen (Woran arbeiten? Wie viel Zeit?), dann alle
// passenden Ideen für heute zur Auswahl. Gefällt eine, kann man sie als Kalender-Erinnerung mitnehmen oder
// "länger ausprobieren" – erst dann erscheinen Heute, Fortschritt & Co.
// Kein Konto, kein Server: Alles liegt im localStorage dieses Geräts. Nichts wird ungefragt angelegt;
// Punkte, Level und Belohnungen überlässt die App bewusst Habitica.
// Die Ideen dahinter, kurz:
// - Tiny Habits (BJ Fogg): klein anfangen, an einen festen Anker im Alltag koppeln, sofort feiern
// - Wenn-dann-Pläne (Gollwitzer) bzw. WOOP (Oettingen): Hindernis vorher benennen, Plan B festlegen
// - "Nie zweimal hintereinander auslassen": Ein verpasster Tag bricht keine Kette
// - Selbstbeobachtung: Abendreflexion mit Stimmung und "Drei gute Dinge" (Seligman), auf Wunsch
// - Was hilft dir wirklich? Stimmung an Tagen mit vs. ohne Gewohnheit
// - Automatik-Check alle zwei Wochen statt starrer "21 Tage"
// - Neustart-Momente: Wochenbeginn, Monatsanfang (Fresh-Start-Effekt)
"use strict";

const SPEICHER = "phoenix-feder-app";
const QUESTS = "phoenix-feder-quests"; // gemeinsam mit der Seite /gewohnheiten/
// Früher fest unter „Täglich“, ohne zu fragen; alte Zustände übernehmen sie als normale Gewohnheiten
const FRUEHER_TAEGLICH = ["bewegung", "meditation-und-atmung"];
const ZEIT = {
  kurz: ["⏱️", "Wenig – es soll nebenbei gehen", "Kleine Ideen für deinen Alltag, meist ein paar Minuten."],
  lang: ["🗺️", "Gern etwas mehr", "Ein kleines Erlebnis – eine Stunde, ein Nachmittag oder ein Abend."],
  egal: ["✨", "Zeig mir beides", ""],
};
const ANKER = ["Nach dem Aufstehen", "Nach dem ersten Kaffee oder Tee", "In der Mittagspause", "Unterwegs",
  "Zum Feierabend", "Beim Abendessen", "Vor dem Schlafengehen"];
const WOERTER = ["Ruhe", "Fokus", "Freude", "Geduld", "Klarheit", "Mut", "Leichtigkeit", "Dankbarkeit"];
const STIMMUNGEN = [["😣", "schwer"], ["😕", "durchwachsen"], ["😐", "okay"], ["🙂", "gut"], ["😄", "richtig gut"]];
const AUTOMATIK = ["gar nicht", "kaum", "teils", "meistens", "ganz von allein"];
const LOB = ["Schön! 🪶", "Das tat dir gut.", "Genau so.", "Ein Funke mehr.", "Yes – weiter so!",
  "Dein zukünftiges Ich dankt dir.", "Stark. Spür kurz nach, wie sich das anfühlt."];

let D = { uebungen: [] }; // daten.json
const U = {}; // Übungen nach Slug
let Z; // Zustand
let speicherFehlt = false;
let ansicht = "heute";
let tagVersatz = 0; // 0 = heute, -1 = gestern nachtragen
let filter = "gewohnheit";
let questVorschlag = null;
let startBereiche = [];
let startAuswahl = [];
let startSchritt = 1;
let startAnker = {};
let installEreignis = null;
// "Probier's heute": Antworten und gewählte Idee (in Z.probieren gespeichert, damit nach dem Schließen nichts fehlt)
let idee = null;
let ideeFilter = null; // „Woran möchtest du arbeiten?“ – Bereich oder "alle" (null = noch nicht gefragt)
let ideeZeit = null; // „Wie viel Zeit hast du?“ – kurz | lang | egal
let reflexionWarDa = false;
let kalZeit = "19:00";
let kalDauer = "14";
const ZEITEN = [["08:00", "Morgens"], ["12:30", "Mittags"], ["19:00", "Abends"]];

// ---------------------------------------------------------------- Hilfen

const $ = (auswahl, wurzel = document) => wurzel.querySelector(auswahl);
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
const tag = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const verschieben = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return tag(d); };
const tageZwischen = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
const datumLang = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
const zahl = (x) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];
const routineModus = () => Z.modus === "routine" || Z.gewohnheiten.length > 0;
const appleGeraet = () => /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);
const alsAppGestartet = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// Ideen = alle Übungen außer der Habitica-Aufgabe „Reflektion“ (dafür gibt es die Abendreflexion)
const istIdee = (u) => u.slug !== "reflektion";

function info(slug) {
  const u = U[slug] || {};
  return { slug, emoji: u.emoji || "✨", titel: u.titel || slug, art: u.art, html: u.html, kurz: u.kurz, bereich: u.bereich,
    heute: u.heute ?? "", statt: u.statt ?? [], monate: u.monate ?? [] };
}

// ---------------------------------------------------------------- Speicher

function neuerZustand() {
  return { version: 1, start: tag(), gewohnheiten: [], log: {}, quest: null, questDaten: {}, automatik: {},
    hinweise: {}, erinnerung: { morgen: "07:30", abend: "21:00" }, modus: "probieren",
    reflexion: null, // Abendreflexion: null = noch nicht gefragt, true/false = Antwort
    probieren: { bereich: "", zeit: "", idee: "" } };
}

function laden() {
  let roh = null;
  try { roh = localStorage.getItem(SPEICHER); } catch { speicherFehlt = true; }
  if (!roh) return neuerZustand();
  try { return bereinigen(JSON.parse(roh)); } catch { /* unerwartete Form: lieber unverändert übernehmen als verlieren */ }
  try { return { ...neuerZustand(), ...JSON.parse(roh) }; } catch { return neuerZustand(); }
}

function speichern() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(Z)); } catch { speicherFehlt = true; }
}

// Browser sollen die Einträge nicht bei Platzmangel aufräumen (wirkt v. a. bei installierter App)
function dauerhaftSpeichern() {
  navigator.storage?.persist?.().catch(() => {});
}

// Antworten und Idee merken: Wer die App schließt und wieder öffnet, landet an derselben Stelle
function merken() {
  Z.probieren = { bereich: ideeFilter || "", zeit: ideeZeit || "", idee: idee || "" };
  speichern();
}

function questsLaden() {
  try { return new Set(JSON.parse(localStorage.getItem(QUESTS)) || []); } catch { return new Set(); }
}

function questsSpeichern(menge) {
  try { localStorage.setItem(QUESTS, JSON.stringify([...menge])); } catch { speicherFehlt = true; }
}

const eintrag = (d) => (Z.log[d] ||= { erledigt: [] });
const erledigt = (d, slug) => Boolean(Z.log[d]?.erledigt?.includes(slug));

// ---------------------------------------------------------------- Auswertung

function seit(slug) {
  return Z.gewohnheiten.find((g) => g.slug === slug)?.seit || Z.start;
}

// Kette mit Nachsicht: Erst zwei verpasste Tage hintereinander beenden sie.
function kette(slug) {
  let d = tag();
  let anzahl = 0;
  let luecke = 0;
  if (!erledigt(d, slug)) d = verschieben(d, -1);
  while (d >= seit(slug)) {
    if (erledigt(d, slug)) { anzahl += 1; luecke = 0; } else if (++luecke >= 2) break;
    d = verschieben(d, -1);
  }
  return anzahl;
}

function gesternVerpasst(slug) {
  const gestern = verschieben(tag(), -1);
  return gestern >= seit(slug) && !erledigt(gestern, slug) && !erledigt(tag(), slug);
}

// Stimmung an Tagen mit vs. ohne Gewohnheit – ein Hinweis, kein Beweis
function erkenntnisse() {
  const tage = Object.entries(Z.log).filter(([, e]) => e.stimmung);
  if (tage.length < 7) return { genug: false, tage: tage.length };
  const schnitt = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const liste = Z.gewohnheiten.map((g) => g.slug).map((slug) => {
    const mit = [];
    const ohne = [];
    for (const [d, e] of tage) if (d >= seit(slug)) (e.erledigt?.includes(slug) ? mit : ohne).push(e.stimmung);
    if (mit.length < 3 || ohne.length < 3) return null;
    return { slug, mit: schnitt(mit), ohne: schnitt(ohne), diff: schnitt(mit) - schnitt(ohne), n: mit.length };
  }).filter(Boolean).sort((a, b) => b.diff - a.diff);
  return { genug: true, tage: tage.length, liste };
}

function automatikFaellig() {
  const heute = tag();
  return Z.gewohnheiten.find((g) => {
    const letzte = (Z.automatik[g.slug] || []).at(-1)?.datum || g.seit;
    return tageZwischen(letzte, heute) >= 14;
  });
}

function anzahlImMonat(slug, monat) {
  return Object.entries(Z.log).filter(([d, e]) => d.startsWith(monat) && e.erledigt?.includes(slug)).length;
}

// ---------------------------------------------------------------- Rückmeldung

function toast(text) {
  const t = $("[data-toast]");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.uhr);
  toast.uhr = setTimeout(() => { t.hidden = true; }, 2600);
}

function feiern(text = zufall(LOB)) {
  toast(text);
  navigator.vibrate?.(12);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 6; i += 1) {
    const f = document.createElement("span");
    f.className = "feder-flug";
    f.textContent = "🪶";
    f.style.left = `${15 + Math.random() * 70}%`;
    f.style.animationDelay = `${i * 70}ms`;
    document.body.append(f);
    setTimeout(() => f.remove(), 1800);
  }
}

// ---------------------------------------------------------------- Ansichten

function render() {
  const einfach = !routineModus();
  document.body.classList.toggle("einfach", einfach);
  $(".app-kopf .logo span").textContent = einfach ? "Probier’s heute" : "Meine Routinen";
  document.querySelectorAll("[data-tab]").forEach((a) => {
    const aktiv = a.dataset.tab === ansicht || (a.dataset.tab === "probieren" && ansicht === "entdecken");
    if (aktiv) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const ansichten = { start: ansichtStart, probieren: ansichtProbieren, heute: ansichtHeute, entdecken: ansichtEntdecken, fortschritt: ansichtFortschritt, mehr: ansichtMehr };
  $("#app").innerHTML = (speicherFehlt ? '<p class="hinweis-app">Dein Browser erlaubt hier kein Speichern (privates Fenster?). Deine Einträge gehen beim Schließen verloren.</p>' : "")
    + ansichten[ansicht]();
}

// ---------------------------------------------------------------- Probier's heute

// Nur, was man heute wirklich ausprobieren kann (z. B. nicht „feste Schlafenszeiten“, keine Bienen im Winter).
const passtZurJahreszeit = (u) => !u.monate.length || u.monate.includes(new Date().getMonth() + 1);
const heuteMoeglich = (u) => Boolean(u.heute) && passtZurJahreszeit(u);
const richtungen = () => D.richtungen;
const passtZurZeit = (u) => !ideeZeit || ideeZeit === "egal" || (ideeZeit === "lang") === (u.art === "quest");
const passtZumBereich = (u) => !ideeFilter || ideeFilter === "alle" || u.bereich === ideeFilter;
const fussZeile = `<p class="klein fuss-app">Kein Konto, keine Anmeldung – alles bleibt auf diesem Gerät.<br>
  <a href="#entdecken">Alle Ideen nach Bereichen</a> · <a href="#mehr">Als App installieren</a> · <a href="../">Zur Website</a></p>`;

// Alle Ideen für heute, die zu den beiden Antworten passen (passt nichts, dann wenigstens der Bereich)
function ideenPool() {
  const alle = D.uebungen.filter((u) => istIdee(u) && heuteMoeglich(u));
  const passend = alle.filter((u) => passtZumBereich(u) && passtZurZeit(u));
  if (passend.length) return passend;
  const bereich = alle.filter(passtZumBereich);
  return bereich.length ? bereich : alle;
}

function ausprobiertHeute(slug) {
  return U[slug]?.art === "quest" ? questsLaden().has(slug) : erledigt(tag(), slug);
}

function erinnerungStart(zeit) {
  // heute, wenn bis dahin noch mindestens 15 Minuten sind, sonst morgen
  const [h, m] = zeit.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d - new Date() < 15 * 60000) d.setDate(d.getDate() + 1);
  return d;
}

function kalenderZeit(d) {
  return `${tag(d).replaceAll("-", "")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
}

function ideeTermin(slug) {
  const u = info(slug);
  const start = erinnerungStart(kalZeit);
  const link = `${location.origin}${location.pathname}#idee=${slug}`;
  return { id: slug, titel: `${u.emoji} ${u.titel}`, text: `${u.heute || u.kurz}\n\nIdeen und Hintergrund: ${link}`, url: link,
    start: kalenderZeit(start), ende: kalenderZeit(new Date(start.getTime() + 15 * 60000)),
    regel: kalDauer === "14" ? "RRULE:FREQ=DAILY;COUNT=14" : "" };
}

function googleKalender(t) {
  const p = new URLSearchParams({ action: "TEMPLATE", text: t.titel, details: t.text, dates: `${t.start}/${t.ende}`, ctz: "Europe/Berlin" });
  if (t.regel) p.set("recur", t.regel);
  return `https://calendar.google.com/calendar/render?${p}`;
}

// Der eigentliche Export: deutlich als Aktion erkennbar, mit Erklärung, was danach passiert.
// Auf Apple-Geräten zuerst die Kalenderdatei (öffnet direkt den Apple-Kalender), sonst zuerst Google.
function kalenderAktion(googleLink, icsAktion) {
  const google = `<a class="knopf kalender-knopf${appleGeraet() ? " zweit" : ""}" target="_blank" rel="noopener" href="${esc(googleLink)}" data-aktion="google-geoeffnet">📅 In Google Kalender eintragen</a>`;
  const datei = `<button class="knopf kalender-knopf${appleGeraet() ? "" : " zweit"}" data-aktion="${icsAktion}">📥 In Apple- oder Outlook-Kalender</button>`;
  return `<div class="kalender-aktion">
    <div class="knopf-reihe">${appleGeraet() ? datei + google : google + datei}</div>
    <p class="klein"><strong>Google</strong> öffnet sich mit dem fertigen Termin – dort nur noch „Speichern“ tippen.
    <strong>Apple und Outlook</strong> bekommen eine Kalenderdatei: öffnen, „Hinzufügen“ – fertig. Die Erinnerung kommt dann von deinem Kalender.</p>
  </div>`;
}

// Frage 1: Woran möchtest du arbeiten?
function ansichtFrage() {
  const antworten = [...D.bereiche, { slug: "alle", emoji: "🎲", titel: "Weiß ich noch nicht", text: "Zeig mir Ideen aus allen Bereichen." }];
  return `<section class="willkommen">
  <p class="oberzeile">Probier’s heute · Frage 1 von 2</p>
  <h1>Woran möchtest du arbeiten?</h1>
  <p>Zwei kurze Fragen – dann siehst du alle Ideen, die zu dir passen und die du heute ausprobieren kannst.</p>
</section>
<div class="wahl-liste">${antworten.map((r) => wahlZeile("frage", r.slug, r.emoji, r.titel, r.text, false, true)).join("")}</div>
${fussZeile}`;
}

// Frage 2: Wie viel Zeit hast du heute?
function ansichtZeit() {
  return `<section class="willkommen">
  <p class="oberzeile">Probier’s heute · Frage 2 von 2</p>
  <h1>Wie viel Zeit hast du heute dafür?</h1>
</section>
<div class="wahl-liste">${Object.entries(ZEIT).map(([slug, [emoji, titel, text]]) => wahlZeile("zeit", slug, emoji, titel, text, false, true)).join("")}</div>
<p><button class="link-knopf" data-aktion="neu-fragen">← Zurück</button></p>`;
}

// Alle passenden Ideen zur Auswahl – keine Zufallsidee
function ansichtVorschlaege() {
  const pool = ideenPool();
  const richtung = richtungen().find((r) => r.slug === ideeFilter);
  const zeit = ZEIT[ideeZeit];
  return `<section class="willkommen">
  <p class="oberzeile">${[richtung && ideeFilter !== "alle" ? `${richtung.emoji} ${esc(richtung.titel)}` : "Alle Bereiche", zeit ? esc(zeit[1]) : ""].filter(Boolean).join(" · ")}</p>
  <h1>Ideen für dich</h1>
  <p>${pool.length === 1 ? "Eine Idee" : `${pool.length} Ideen`}, die du heute ausprobieren kannst. Such dir eine aus, die dich anlacht – tipp sie an für alle Details.</p>
  <div class="knopf-reihe"><button class="knopf zweit klein-knopf" data-aktion="ueberrasch">🎲 Überrasch mich</button><button class="link-knopf" data-aktion="neu-fragen">Fragen neu beantworten</button></div>
</section>
<div class="wahl-liste">${pool.map((u) => wahlZeile("idee-zeigen", u.slug, u.emoji, u.titel,
    `${ausprobiertHeute(u.slug) ? "✓ Ausprobiert · " : ""}${u.heute}`, false, true)).join("")}</div>
${fussZeile}`;
}

function ansichtProbieren() {
  if (idee && !U[idee]) idee = null;
  if (!idee) {
    if (!ideeFilter) return ansichtFrage();
    if (!ideeZeit) return ansichtZeit();
    return ansichtVorschlaege();
  }
  const u = info(idee);
  const geschafft = ausprobiertHeute(idee);
  const heute = heuteMoeglich(u);
  const saison = passtZurJahreszeit(u);
  // Nicht für heute (Gewohnheit braucht Wochen, Quest braucht Planung, falsche Jahreszeit): erklären und Ideen für heute anbieten
  const grund = !saison ? "Gerade nicht die Jahreszeit dafür."
    : u.art === "quest" ? "Dafür brauchst du etwas Zeit oder Planung – nimm es dir für einen passenden Tag vor."
      : "Das wirkt erst, wenn du es ein paar Wochen machst – am besten mit Erinnerung (unten).";
  const stattdessen = heute ? "" : `<p class="klein">${grund}${u.statt.length ? " Für heute passt:" : ""}</p>
    ${u.statt.map((s) => info(s)).map((s) => wahlZeile("idee-zeigen", s.slug, s.emoji, s.titel, s.heute, false, true)).join("")}`;
  const abhaken = heute || (saison && u.art === "quest");
  const dabei = Z.gewohnheiten.some((g) => g.slug === idee) || Z.quest === idee;
  return `<p><button class="link-knopf" data-aktion="zur-auswahl">← Alle Ideen für dich</button></p>
<section class="probieren">
  <p class="oberzeile">${!saison ? "Gerade nicht die Jahreszeit" : !heute ? (u.art === "quest" ? "Braucht etwas Planung" : "Braucht etwas Zeit") : u.art === "quest" ? "Ein kleines Erlebnis für dich" : "Probier es heute"}</p>
  <div class="karte-app idee">
    <div class="idee-emoji" aria-hidden="true">${u.emoji}</div>
    <h1>${esc(u.titel)}</h1>
    <p class="erklaerung-gross">${esc(heute ? u.heute : u.kurz)}</p>
    ${stattdessen}
    <div class="knopf-reihe">
      ${!abhaken ? "" : geschafft ? `<span class="marke-app geschafft-marke">✓ ${u.art === "quest" ? "Geschafft" : "Heute ausprobiert"}</span>` : `<button class="knopf" data-aktion="ausprobiert">✓ ${heute ? "Hab ich ausprobiert" : "Hab ich gemacht"}</button>`}
    </div>
    <details class="aufklapp"><summary>Ideen und Hintergrund</summary><div class="uebung-text">${u.html || ""}</div>
      <p><a href="../gewohnheiten/${esc(idee)}/">Alles dazu auf einer Seite →</a></p></details>
  </div>
</section>
${!saison ? "" : `<section class="optionen">
  <h2>Gefällt dir die Idee? Zwei Wege, dranzubleiben</h2>
  <details class="option">
    <summary><span class="option-emoji" aria-hidden="true">📅</span><span><strong>Ohne App: Erinnerung im Kalender</strong><span class="klein">Einmal oder zwei Wochen lang täglich – dein Kalender erinnert dich.</span></span></summary>
    <p class="schritt">1 · Wann?</p>
    <div class="chips-app">${ZEITEN.map(([z, t]) => `<button data-aktion="kal-zeit" data-wert="${z}" aria-pressed="${kalZeit === z}">${t} · ${z.replace(":", ".")}</button>`).join("")}</div>
    <p class="schritt">2 · Wie oft?</p>
    <div class="chips-app"><button data-aktion="kal-dauer" data-wert="1" aria-pressed="${kalDauer === "1"}">Einmal</button><button data-aktion="kal-dauer" data-wert="14" aria-pressed="${kalDauer === "14"}">2 Wochen täglich</button></div>
    <p class="schritt">3 · Jetzt eintragen</p>
    ${kalenderAktion(googleKalender(ideeTermin(idee)), "ics-idee")}
  </details>
  <div class="option">
    <div class="option-kopf"><span class="option-emoji" aria-hidden="true">🌱</span><span><strong>Mit der App: täglich abhaken</strong><span class="klein">Abhaken, abends kurz zurückschauen und sehen, was dir wirklich hilft – persönlich für dich.</span></span></div>
    ${speicherFehlt ? '<p class="klein">In diesem Fenster kann die App nichts speichern (privates Fenster?). Öffne sie in einem normalen Browserfenster, um dranzubleiben.</p>'
      : `<p class="klein">Ohne Konto: Deine Einträge bleiben nur auf diesem Gerät. Am besten legst du die App danach auf deinen Startbildschirm – dann ist sie mit einem Tipp da${alsAppGestartet() ? "" : " und deine Einträge sind sicher"}.</p>
    <div class="knopf-reihe"><button class="knopf zweit" data-aktion="laenger">${dabei ? "Zu meinen Routinen" : u.art === "quest" ? "Als Quest starten" : "In meine Routinen"}</button>
    ${routineModus() ? "" : '<a class="link-knopf" href="#start">eigene Auswahl zusammenstellen</a>'}</div>`}
  </div>
</section>`}
${fussZeile}`;
}

// Auswahlzeile: mit Haken zum An-/Abwählen oder mit Pfeil für „weiter zu …“
function wahlZeile(aktion, wert, emoji, titel, text, gewaehlt, pfeil = false) {
  return `<button class="wahl-zeile" data-aktion="${aktion}" data-slug="${wert}"${pfeil ? "" : ` aria-pressed="${gewaehlt}"`}>
  <span class="wahl-emoji" aria-hidden="true">${emoji}</span><span class="wahl-text"><strong>${esc(titel)}</strong>${text ? `<span>${esc(text)}</span>` : ""}</span>
  ${pfeil ? '<span class="wahl-pfeil" aria-hidden="true">→</span>' : '<span class="wahl-haken" aria-hidden="true">✓</span>'}</button>`;
}

function ansichtStart() {
  if (startSchritt === 1) {
    return `<section class="willkommen">
  <p class="oberzeile">Schritt 1 von 3</p>
  <h1>Was wünschst du dir gerade?</h1>
  <p>Wähle einen oder zwei Bereiche. Danach zeige ich dir nur die passenden Gewohnheiten.</p>
</section>
<div class="wahl-liste">${D.bereiche.map((b) => wahlZeile("start-bereich", b.slug, b.emoji, b.titel, b.text, startBereiche.includes(b.slug))).join("")}</div>
<p class="klein">Kein Konto nötig. Alles bleibt auf diesem Gerät.</p>
<div class="leiste-unten"><button class="knopf" data-aktion="start-weiter" ${startBereiche.length ? "" : "disabled"}>Weiter</button></div>`;
  }
  if (startSchritt === 2) {
    const passend = D.uebungen.filter((u) => istIdee(u) && u.art !== "quest" && startBereiche.includes(u.bereich));
    return `<section class="willkommen">
  <p class="oberzeile">Schritt 2 von 3</p>
  <h1>Wähle bis zu drei Gewohnheiten</h1>
  <p>Es sind keine Zusatzaufgaben – eher ein Fokus darauf, <em>wie</em> du deinen Tag lebst.</p>
</section>
<div class="wahl-liste">${passend.map((u) => wahlZeile("start-wahl", u.slug, u.emoji, u.titel, u.kurz, startAuswahl.includes(u.slug))).join("")}</div>
${startAuswahl.length > 3 ? '<p class="klein">Tipp: Mit drei startet es sich leichter. Mehr kannst du jederzeit dazunehmen.</p>' : ""}
<div class="leiste-unten"><button class="knopf zweit" data-aktion="start-zurueck">Zurück</button><button class="knopf" data-aktion="start-weiter" ${startAuswahl.length ? "" : "disabled"}>Weiter${startAuswahl.length ? ` mit ${startAuswahl.length}` : ""}</button></div>`;
  }
  return `<section class="willkommen">
  <p class="oberzeile">Schritt 3 von 3</p>
  <h1>Wann passt es in deinen Tag?</h1>
  <p>Am besten hängst du eine Gewohnheit an etwas, das du ohnehin tust. Das kannst du später jederzeit ändern.</p>
</section>
${startAuswahl.map((slug) => {
    const u = info(slug);
    return `<label class="karte-app anker-wahl"><span><strong>${u.emoji} ${esc(u.titel)}</strong><span class="klein">${esc(u.kurz)}</span></span>
  <select data-start-anker="${slug}"><option value="">Wann es passt</option>${ANKER.map((a) => `<option ${startAnker[slug] === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>`;
  }).join("")}
<div class="leiste-unten"><button class="knopf zweit" data-aktion="start-zurueck">Zurück</button><button class="knopf" data-aktion="start-fertig">Los geht’s</button></div>`;
}

const guteDinge = (n) => (n === 1 ? "1 gutes Ding" : `${n} gute Dinge`);

function gruss() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend";
}

function punktZeile(slug, d, anker = "") {
  const u = info(slug);
  const fertig = erledigt(d, slug);
  const k = kette(slug);
  const zusatz = [anker, k > 1 ? `🔥 ${k} Tage` : ""].filter(Boolean).join(" · ");
  const sanft = tagVersatz === 0 && !fertig && gesternVerpasst(slug) ? '<span class="sanft">Gestern ausgelassen – kein Problem. Heute zählt.</span>' : "";
  return `<li class="punkt${fertig ? " fertig" : ""}">
  <button class="haken" data-aktion="abhaken" data-slug="${slug}" aria-pressed="${fertig}" aria-label="${esc(u.titel)} ${fertig ? "erledigt" : "abhaken"}">✓</button>
  <button class="punkt-text" data-aktion="details" data-slug="${slug}">
    <span class="punkt-titel"><span aria-hidden="true">${u.emoji}</span> ${esc(u.titel)}</span>
    <span class="punkt-erklaerung">${esc(u.kurz || "")}</span>
    ${zusatz ? `<span class="punkt-meta">${esc(zusatz)}</span>` : ""}${sanft}
  </button>
</li>`;
}

// Höchstens ein Hinweis auf einmal – der wichtigste zuerst
function hinweisKarten() {
  const heute = tag();
  // Wer dranbleiben will, braucht die App griffbereit – und auf dem iPhone ist sie dort auch vor dem Löschen sicher
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!alsAppGestartet() && (!Z.hinweise.app || tageZwischen(Z.hinweise.app, heute) >= 7)) {
    return `<div class="karte-app hinweis-karte"><p><strong>Damit du dranbleibst:</strong> Leg die App auf deinen Startbildschirm. Dann ist sie mit einem Tipp da${ios ? " – und Safari kann deine Einträge nicht mehr löschen, wenn du die Seite eine Woche nicht öffnest" : ""}.</p>
      <div class="knopf-reihe">${installEreignis ? '<button class="knopf klein-knopf" data-aktion="installieren">📲 Jetzt installieren</button>' : '<a class="knopf klein-knopf" href="#mehr">So geht’s</a>'}<button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="app">Später</button></div></div>`;
  }
  const faellig = automatikFaellig();
  if (faellig) {
    const u = info(faellig.slug);
    return `<div class="karte-app hinweis-karte"><p><strong>Kurzer Check:</strong> Wie sehr läuft <strong>${u.emoji} ${esc(u.titel)}</strong> schon von allein?</p>
      <div class="chips-app">${AUTOMATIK.map((t, i) => `<button data-aktion="automatik" data-slug="${faellig.slug}" data-wert="${i + 1}">${t}</button>`).join("")}</div></div>`;
  }
  if (tageZwischen(Z.start, heute) >= 14 && !Z.hinweise.feedback14) {
    return `<div class="karte-app hinweis-karte"><p><strong>Zwei Wochen dabei! 🎉</strong> Magst du erzählen, was dir hilft und was dir schwerfällt? Ich lese jede Nachricht persönlich.</p>
      <div class="knopf-reihe"><a class="knopf klein-knopf" href="${esc(feedbackLink())}" data-aktion="hinweis-weg" data-wert="feedback14">Erfahrung teilen</a><button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="feedback14">Später</button></div></div>`;
  }
  if (Z.hinweise[`neustart-${heute}`]) return "";
  if (new Date().getDate() === 1) {
    return `<div class="karte-app hinweis-karte"><p><strong>Neuer Monat, frischer Start 🌱</strong> Magst du kurz zurückschauen, was gut lief?</p>
      <div class="knopf-reihe"><a class="knopf klein-knopf" href="#fortschritt">Rückschau ansehen</a><button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="neustart-${heute}">Später</button></div></div>`;
  }
  if (new Date().getDay() === 1) {
    return `<div class="karte-app hinweis-karte"><p><strong>Neue Woche, frischer Start 🌱</strong> Passt deine Auswahl noch? Zu viel oder zu wenig – nimm etwas dazu oder weg.</p>
      <div class="knopf-reihe"><a class="knopf klein-knopf" href="#entdecken">Anpassen</a><button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="neustart-${heute}">Passt so</button></div></div>`;
  }
  return "";
}

function wortKarte(d) {
  const e = Z.log[d];
  if (e?.wort) return `<p class="wort">Dein Wort für heute: <strong>${esc(e.wort)}</strong> <button class="link-knopf" data-aktion="wort" data-wert="">ändern</button></p>`;
  if (new Date().getHours() >= 14 || Z.hinweise[`wort-${d}`]) return "";
  return `<div class="wort-wahl"><span>Dein Wort für heute?</span>
  <div class="chips-app">${WOERTER.slice(0, 5).map((w) => `<button data-aktion="wort" data-wert="${w}">${w}</button>`).join("")}<button class="link-knopf" data-aktion="hinweis-weg" data-wert="wort-${d}">heute nicht</button></div></div>`;
}

function questKarte() {
  const fertig = questsLaden();
  if (Z.quest && fertig.has(Z.quest)) Z.quest = null;
  if (Z.quest) {
    const u = info(Z.quest);
    return `<div class="karte-app quest"><p class="oberzeile">Quest${U[Z.quest]?.gruppe ? ` · ${esc(U[Z.quest].gruppe)}` : ""}</p>
      <h3>${u.emoji} ${esc(u.titel)}</h3><p>${esc(u.kurz)}</p>
      <div class="knopf-reihe"><button class="knopf" data-aktion="quest-fertig">✓ Geschafft</button><button class="knopf zweit" data-aktion="details" data-slug="${Z.quest}">Details</button><button class="link-knopf" data-aktion="quest-weg">andere</button></div></div>`;
  }
  const alleOffen = D.uebungen.filter((u) => u.art === "quest" && !fertig.has(u.slug) && passtZurJahreszeit(u));
  // Abschluss-Quests (Reflexion der Reise, Community) erst, wenn alle anderen geschafft sind
  const offen = alleOffen.some((u) => u.gruppe !== "Abschluss") ? alleOffen.filter((u) => u.gruppe !== "Abschluss") : alleOffen;
  if (!offen.length) return '<div class="karte-app"><p>Du hast alle Quests geschafft. Großartig! 🏆 Lust auf mehr? Die Challenge auf Habitica bekommt neue Ideen.</p></div>';
  if (!questVorschlag || fertig.has(questVorschlag)) questVorschlag = zufall(offen).slug;
  const u = info(questVorschlag);
  return `<div class="karte-app quest"><p class="oberzeile">Vorschlag – nur wenn du magst</p>
    <h3>${u.emoji} ${esc(u.titel)}</h3><p>${esc(u.kurz)}</p>
    <div class="knopf-reihe"><button class="knopf" data-aktion="quest-annehmen" data-slug="${questVorschlag}">Annehmen</button><button class="knopf zweit" data-aktion="quest-andere">Andere Quest ↻</button></div></div>`;
}

function ansichtHeute() {
  const d = verschieben(tag(), tagVersatz);
  const e = Z.log[d] || {};
  const reflexion = Z.reflexion === true ? `<h2>Am Abend</h2>
<ul class="liste"><li class="punkt${e.stimmung ? " fertig" : ""}">
  <button class="haken" data-aktion="reflexion" aria-pressed="${Boolean(e.stimmung)}" aria-label="Abendreflexion">✓</button>
  <button class="punkt-text" data-aktion="reflexion">
    <span class="punkt-titel"><span aria-hidden="true">🙏</span> Abendreflexion</span>
    <span class="punkt-erklaerung">${e.stimmung ? `${STIMMUNGEN[e.stimmung - 1][0]} · ${guteDinge((e.gutes || []).filter(Boolean).length)} notiert` : "Wie war dein Tag? Und drei Dinge, die schön waren."}</span>
  </button>
</li></ul>`
    // nur ein Angebot – angelegt wird erst, wenn man Ja sagt
    : Z.reflexion === null ? `<div class="karte-app hinweis-karte"><p><strong>🙏 Abendreflexion dazunehmen?</strong> Abends eine Minute: Wie war dein Tag, und was war schön?
  Nach ein paar Abenden zeigt dir die App, an welchen Tagen es dir besser ging – und was dir wirklich hilft.</p>
  <div class="knopf-reihe"><button class="knopf klein-knopf" data-aktion="reflexion-wahl" data-wert="ja">Ja, gern</button><button class="knopf zweit klein-knopf" data-aktion="reflexion-wahl" data-wert="nein">Nein, danke</button></div></div>` : "";
  return `<section class="tag-kopf">
  <p class="oberzeile">${tagVersatz === 0 ? gruss() : "Nachtragen"}</p>
  <h1>${tagVersatz === 0 ? "Heute" : "Gestern"}, ${datumLang(d)}</h1>
  <div class="umschalter"><button data-aktion="tag" data-wert="0" aria-pressed="${tagVersatz === 0}">Heute</button><button data-aktion="tag" data-wert="-1" aria-pressed="${tagVersatz === -1}">Gestern nachtragen</button></div>
</section>
${tagVersatz === 0 ? hinweisKarten() + wortKarte(d) : ""}
<h2>Deine Gewohnheiten</h2>
${Z.gewohnheiten.length ? `<p class="klein">Hake ab, worauf du ${tagVersatz === 0 ? "heute" : "gestern"} geachtet hast. Tippe auf den Namen für Ideen.</p>
<ul class="liste">${Z.gewohnheiten.map((g) => punktZeile(g.slug, d, g.anker)).join("")}</ul>` : '<p class="klein">Noch keine – such dir eine aus, die dich anspricht.</p>'}
<a class="link-knopf" href="#entdecken">+ Gewohnheit hinzufügen</a>
${reflexion}
${tagVersatz === 0 ? `<h2>${Z.quest ? "Deine Quest" : "Lust auf eine Quest?"}</h2>${questKarte()}` : ""}`;
}

function ansichtEntdecken() {
  const dabei = new Set(Z.gewohnheiten.map((g) => g.slug));
  const fertig = questsLaden();
  const knopf = (u) => {
    if (u.art === "quest") {
      if (fertig.has(u.slug)) return '<span class="marke-app">✓ geschafft</span>';
      if (!routineModus()) return "";
      return Z.quest === u.slug ? '<span class="marke-app">aktiv</span>' : `<button class="knopf zweit klein-knopf" data-aktion="quest-annehmen" data-slug="${u.slug}">Starten</button>`;
    }
    if (!routineModus()) return ""; // im einfachen Modus nur zum Stöbern; Details per Antippen
    return dabei.has(u.slug) ? `<button class="knopf klein-knopf" data-aktion="entfernen" data-slug="${u.slug}" aria-pressed="true">✓ dabei</button>`
      : `<button class="knopf zweit klein-knopf" data-aktion="hinzufuegen" data-slug="${u.slug}">+ Aufnehmen</button>`;
  };
  const zeile = (u) => `<li class="karte-app eintrag">
  <button class="eintrag-text" data-aktion="details" data-slug="${u.slug}"><span class="eintrag-titel"><span aria-hidden="true">${u.emoji}</span> ${esc(u.titel)}</span><span class="punkt-erklaerung">${esc(u.kurz)}</span></button>
  ${knopf(u)}</li>`;
  const gruppen = filter === "quest"
    ? [...new Set(D.uebungen.filter((u) => u.art === "quest").map((u) => u.gruppe))].map((g) => [g, "", D.uebungen.filter((u) => u.art === "quest" && u.gruppe === g)])
    : D.bereiche.map((b) => [`${b.emoji} ${b.titel}`, b.text, D.uebungen.filter((u) => istIdee(u) && u.art !== "quest" && u.bereich === b.slug)]);
  return `<p><a class="link-knopf" href="#probieren">← Zurück zu „Probier’s heute“</a></p>
<h1>Alle Ideen</h1>
<p>Zum Stöbern, nach Bereichen sortiert. Tipp eine Idee an für alle Details und Hintergründe.</p>
<div class="umschalter"><button data-aktion="filter" data-wert="gewohnheit" aria-pressed="${filter === "gewohnheit"}">Gewohnheiten</button><button data-aktion="filter" data-wert="quest" aria-pressed="${filter === "quest"}">Quests (${fertig.size}/${D.uebungen.filter((u) => u.art === "quest").length})</button></div>
<p class="klein">${filter === "quest" ? "Kleine Erlebnisse, die du dir vornehmen kannst, wann immer du magst." : "Tipp: Lieber drei Gewohnheiten wirklich leben als zehn halb."}</p>
${gruppen.map(([titel, text, liste]) => `<h2 class="gruppe-app">${esc(titel)}</h2>${text ? `<p class="klein">${esc(text)}</p>` : ""}<ul class="entdecken">${liste.map(zeile).join("")}</ul>`).join("")}`;
}

function punkteReihe(slug) {
  let html = "";
  for (let i = 27; i >= 0; i -= 1) {
    const d = verschieben(tag(), -i);
    const klasse = d < seit(slug) ? "vor" : erledigt(d, slug) ? "ja" : "nein";
    html += `<span class="tagpunkt ${klasse}" title="${d}"></span>`;
  }
  return `<div class="tagpunkte" aria-hidden="true">${html}</div>`;
}

function ansichtFortschritt() {
  const monat = tag().slice(0, 7);
  const vormonat = verschieben(`${monat}-01`, -1).slice(0, 7);
  const e = erkenntnisse();
  const fertig = questsLaden();
  const stimmungen = Object.entries(Z.log).filter(([d, x]) => d.startsWith(monat) && x.stimmung).map(([, x]) => x.stimmung);
  const gutes = Object.entries(Z.log).filter(([, x]) => (x.gutes || []).some(Boolean)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 4);
  const hilft = e.genug ? e.liste.filter((x) => x.diff >= 0.3).slice(0, 3) : [];
  const alle = Z.gewohnheiten.map((g) => g.slug);
  const abgehakt = Object.values(Z.log).reduce((n, x) => n + (x.erledigt?.length || 0), 0);
  const reflexionen = Object.values(Z.log).filter((x) => x.stimmung).length;
  return `<h1>Fortschritt</h1>
<div class="karte-app ueberblick"><p class="oberzeile">Dabei seit ${datumLang(Z.start)}</p>
  <p><strong>${abgehakt}</strong>× abgehakt${reflexionen ? ` · <strong>${reflexionen}</strong> Abendreflexionen` : ""} · <strong>${fertig.size}</strong> Quests geschafft</p></div>

<h2>Was dir wirklich hilft</h2>
${Z.reflexion !== true && !e.tage ? '<p class="klein">Das zeigt dir die Abendreflexion: Wer abends kurz notiert, wie der Tag war, sieht hier nach ein paar Tagen, an welchen Tagen es besser lief. Einschalten kannst du sie unter „Mehr“.</p>'
    : !e.genug ? `<p class="klein">Mach an ein paar Abenden die Abendreflexion. Ab 7 Tagen zeige ich dir hier, an welchen Tagen es dir besser ging (bisher: ${e.tage}).</p>`
    : hilft.length ? `<ul class="erkenntnisse">${hilft.map((x) => { const u = info(x.slug); return `<li><strong>${u.emoji} ${esc(u.titel)}</strong>: An diesen Tagen lag deine Stimmung bei Ø ${zahl(x.mit)} statt ${zahl(x.ohne)} <span class="klein">(${x.n} Tage)</span></li>`; }).join("")}</ul>
      <p class="klein">Ein Zusammenhang, kein Beweis – aber ein guter Hinweis, was du beibehalten solltest. Je mehr Tage, desto aussagekräftiger.</p>`
      : '<p class="klein">Noch zeigt sich kein deutlicher Unterschied. Bleib dran – nach ein paar Wochen wird das Bild klarer.</p>'}

<h2>Deine Ketten</h2>
${alle.length ? `<p class="klein">Ein verpasster Tag bricht keine Kette – nur zwei hintereinander.</p>
<ul class="ketten">${alle.map((slug) => { const u = info(slug); const a = (Z.automatik[slug] || []).at(-1); return `<li class="karte-app">
  <p class="eintrag-titel"><span aria-hidden="true">${u.emoji}</span> ${esc(u.titel)} <span class="punkt-meta">🔥 ${kette(slug)} · ${anzahlImMonat(slug, monat)}× diesen Monat${a ? ` · läuft ${AUTOMATIK[a.wert - 1]}` : ""}</span></p>
  ${punkteReihe(slug)}</li>`; }).join("")}</ul>` : '<p class="klein">Sobald du eine Gewohnheit aufnimmst, siehst du hier, wie sie wächst.</p>'}

<details class="aufklapp"><summary>Monatsrückschau</summary>
<div class="karte-app"><table class="rueckschau"><thead><tr><th></th><th>diesen Monat</th><th>Vormonat</th></tr></thead><tbody>
  ${alle.map((slug) => { const u = info(slug); return `<tr><td>${u.emoji} ${esc(u.titel)}</td><td>${anzahlImMonat(slug, monat)}</td><td>${anzahlImMonat(slug, vormonat)}</td></tr>`; }).join("")}
  <tr><td>🙏 Reflexionen</td><td>${stimmungen.length}</td><td>${Object.entries(Z.log).filter(([d, x]) => d.startsWith(vormonat) && x.stimmung).length}</td></tr>
  <tr><td>🗺️ Quests</td><td>${Object.values(Z.questDaten).filter((d) => d.startsWith(monat)).length}</td><td>${Object.values(Z.questDaten).filter((d) => d.startsWith(vormonat)).length}</td></tr>
</tbody></table>
${stimmungen.length ? `<p class="klein">Ø Stimmung diesen Monat: ${zahl(stimmungen.reduce((a, b) => a + b, 0) / stimmungen.length)} von 5</p>` : ""}</div></details>

${gutes.length ? `<details class="aufklapp"><summary>Deine guten Dinge</summary><ul class="gutes">${gutes.map(([d, x]) => `<li><span class="klein">${datumLang(d)}</span>${x.gutes.filter(Boolean).map((g) => `<span>✨ ${esc(g)}</span>`).join("")}</li>`).join("")}</ul></details>` : ""}

<h2>Quests</h2>
<p>${fertig.size} von ${D.uebungen.filter((u) => u.art === "quest").length} geschafft. <a href="#entdecken" data-aktion="filter" data-wert="quest">Alle ansehen</a></p>

<h2>Lieber mit Punkten und Belohnungen?</h2>
<p class="klein">Punkte, Level und selbst gewählte Belohnungen kann Habitica besser – mit Konto, auf allen Geräten und gemeinsam mit anderen.
Alle Ideen gibt es dort als kostenlose Challenge: <a href="${esc(D.habitica)}" rel="noopener" target="_blank">„Stressfrei“ in Habitica</a>.</p>`;
}

function kalenderLink(titel, zeit, text) {
  const [h, m] = zeit.split(":");
  const morgen = verschieben(tag(), 1).replaceAll("-", "");
  const start = `${morgen}T${h}${m}00`;
  const ende = `${morgen}T${h}${String(Math.min(59, Number(m) + 5)).padStart(2, "0")}00`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: titel, details: `${text} ${location.origin}${location.pathname}`, dates: `${start}/${ende}`, ctz: "Europe/Berlin", recur: "RRULE:FREQ=DAILY" });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function installierenHtml() {
  if (alsAppGestartet()) return '<p>✓ Läuft bereits als App. Deine Einträge liegen auf diesem Gerät.</p>';
  return `<p class="klein">Geht auf Handy und Computer – kostenlos, ohne App-Store und ohne Konto. Danach startet sie wie jede andere App, auch offline.</p>
${installEreignis ? `<button class="knopf" data-aktion="installieren">📲 Jetzt installieren</button>
<p class="klein">Am Computer öffnet sich die App danach in einem eigenen Fenster; dein Browser-Tab wandert dorthin mit. Deine Einträge sind dort weiter da.</p>` : ""}
<ul class="install-liste">
  <li><strong>iPhone und iPad:</strong> in Safari unten auf <strong>Teilen</strong> (Quadrat mit Pfeil) → <strong>„Zum Home-Bildschirm“</strong>.
    Die installierte App hat dort ihren eigenen Speicher. Hast du schon Einträge in Safari: hier unten „Sicherung herunterladen“, danach in der installierten App unter „Mehr“ → „Sicherung laden“.</li>
  <li><strong>Android:</strong> in Chrome oben rechts auf <strong>⋮</strong> → <strong>„App installieren“</strong> oder „Zum Startbildschirm hinzufügen“.</li>
  <li><strong>Computer:</strong> in Chrome oder Edge rechts in der Adressleiste auf das Installieren-Symbol.</li>
</ul>`;
}

function ansichtMehr() {
  const r = Z.erinnerung;
  const zurueck = routineModus() ? "" : '<p><a class="link-knopf" href="#probieren">← Zurück zu „Probier’s heute“</a></p>';
  return `${zurueck}<h1>Mehr</h1>
<h2>Als App installieren</h2>
${installierenHtml()}

${routineModus() ? `<h2>Abendreflexion</h2>
<p class="klein">Abends eine Minute: Stimmung und drei gute Dinge. Daraus zeigt dir „Fortschritt“, was dir wirklich hilft.</p>
<div class="umschalter"><button data-aktion="reflexion-wahl" data-wert="ja" aria-pressed="${Z.reflexion === true}">An</button><button data-aktion="reflexion-wahl" data-wert="nein" aria-pressed="${Z.reflexion !== true}">Aus</button></div>

<h2>Erinnerungen</h2>
<p class="klein">Ohne Konto und ohne Server: Die Erinnerungen kommen über deinen Kalender – täglich, bis du sie dort löschst.</p>
<div class="zeiten"><label>Morgens <input type="time" data-feld="morgen" value="${r.morgen}"></label>${Z.reflexion === true ? `<label>Abends <input type="time" data-feld="abend" value="${r.abend}"></label>` : ""}</div>
${kalenderAktion(kalenderLink("🪶 Dein Wort für heute", r.morgen, "Kurz innehalten: Was zählt heute?"), "ics")}
${Z.reflexion === true ? `<p class="klein">Google trägt so die Morgen-Erinnerung ein; für den Abend: <a target="_blank" rel="noopener" href="${esc(kalenderLink("🪶 Abendreflexion", r.abend, "Wie war dein Tag? Drei gute Dinge."))}" data-aktion="google-geoeffnet">Abendreflexion in Google Kalender eintragen</a>. Die Kalenderdatei enthält beide.</p>` : ""}` : ""}

<h2>Deine Daten</h2>
<p class="klein">Deine Einträge – auch die von gestern und den Wochen davor – speichert die App nur hier im Browser auf diesem Gerät. Kein Konto, kein Server: Nichts wird an mich oder Dritte übertragen. Sie bleiben, bis du die Browserdaten löschst. Für ein anderes Gerät oder als Sicherung:</p>
<div class="knopf-reihe"><button class="knopf zweit klein-knopf" data-aktion="link-teilen">Auf anderes Gerät übertragen</button>
<button class="knopf zweit klein-knopf" data-aktion="export">Sicherung herunterladen</button>
<label class="knopf zweit klein-knopf datei">Sicherung laden<input type="file" accept="application/json,.json" data-aktion-datei="import" hidden></label></div>
<p class="klein">Der Übertragungs-Link enthält deine Einträge. Schick ihn nur an dich selbst.</p>
<button class="link-knopf gefahr" data-aktion="zuruecksetzen">Alles zurücksetzen</button>

<h2>Mitmachen</h2>
<ul class="mehr-links">
  <li><a href="${esc(feedbackLink())}">💬 Erfahrung oder Idee an Nikolas schicken</a></li>
  <li><a href="${esc(D.habitica)}" rel="noopener" target="_blank">🎮 Die Challenge als Rollenspiel in Habitica – mit Punkten und Belohnungen</a></li>
  <li><a href="../gewohnheiten/">📖 Alle Übungen zum Nachlesen</a></li>
  <li><a href="../">🪶 Zur Website</a> · <a href="../datenschutz/">Datenschutz</a></li>
</ul>`;
}

// ---------------------------------------------------------------- Detailblatt

function blattOeffnen(html) {
  const huelle = $("[data-blatt]");
  $(".blatt", huelle).innerHTML = `<button class="blatt-zu" data-aktion="schliessen" aria-label="Schließen">✕</button>${html}`;
  huelle.hidden = false;
  document.body.classList.add("blatt-offen");
  $(".blatt", huelle).focus?.();
}

function blattSchliessen() {
  $("[data-blatt]").hidden = true;
  document.body.classList.remove("blatt-offen");
}

function details(slug) {
  const u = info(slug);
  const g = Z.gewohnheiten.find((x) => x.slug === slug);
  const bereich = D.bereiche.find((b) => b.slug === u.bereich);
  let aktion = "";
  if (u.art === "quest") {
    aktion = questsLaden().has(slug) ? '<p class="marke-app">✓ geschafft</p>'
      : Z.quest === slug ? '<button class="knopf" data-aktion="quest-fertig">✓ Geschafft</button>'
        : `<button class="knopf" data-aktion="quest-annehmen" data-slug="${slug}">Als Quest starten</button>`;
  } else if (!g && istIdee(u)) {
    aktion = `<button class="knopf" data-aktion="hinzufuegen" data-slug="${slug}">In meine Routinen aufnehmen</button>`;
  }
  // Aus der Liste „Alle Ideen“: direkt zur Idee mit „Hab ich ausprobiert“ und Kalender-Erinnerung
  if (!g && istIdee(u) && ansicht !== "probieren" && Z.quest !== slug && !(u.art === "quest" && questsLaden().has(slug))) {
    aktion += `<button class="knopf zweit" data-aktion="idee-zeigen" data-slug="${slug}">💡 Heute ausprobieren</button>`;
  }
  if (aktion) aktion = `<div class="knopf-reihe">${aktion}</div>`;
  const anpassen = g ? `<details class="aufklapp" data-gewohnheit="${slug}"><summary>Anpassen: Zeitpunkt, Mini-Version, Plan B</summary>
<label>Wann? <select data-feld="anker"><option value="">Wann es passt</option>${ANKER.map((a) => `<option ${g.anker === a ? "selected" : ""}>${esc(a)}</option>`).join("")}${g.anker && !ANKER.includes(g.anker) ? `<option selected>${esc(g.anker)}</option>` : ""}</select></label>
<label>Mini-Version für schwere Tage <input data-feld="mini" value="${esc(g.mini || "")}" placeholder="z. B. nur 1 Minute, nur 1 Glas Wasser" maxlength="80"></label>
<p class="klein">Plan B: Was könnte dich hindern – und was tust du dann?</p>
<label>Wenn … <input data-feld="wenn" value="${esc(g.wenn || "")}" placeholder="z. B. ich abends zu müde bin" maxlength="80"></label>
<label>… dann <input data-feld="dann" value="${esc(g.dann || "")}" placeholder="z. B. mache ich die Mini-Version" maxlength="80"></label>
<div class="knopf-reihe"><button class="knopf" data-aktion="speichern-gewohnheit" data-slug="${slug}">Speichern</button><button class="link-knopf gefahr" data-aktion="entfernen" data-slug="${slug}">Entfernen</button></div>
</details>` : "";
  const eigenes = [g?.anker && `Wann: ${g.anker}`, g?.mini && `Mini-Version: ${g.mini}`, g?.wenn && g?.dann && `Wenn ${g.wenn}, dann ${g.dann}.`].filter(Boolean);
  blattOeffnen(`<p class="oberzeile">${u.art === "quest" ? `Quest${U[slug]?.gruppe ? ` · ${esc(U[slug].gruppe)}` : ""}` : `Gewohnheit${bereich ? ` · ${esc(bereich.titel)}` : ""}`}</p>
<h2>${u.emoji} ${esc(u.titel)}</h2>
<p class="erklaerung-gross">${esc(u.kurz || "")}</p>
${eigenes.length ? `<div class="plan">${eigenes.map((x) => `<p>${esc(x)}</p>`).join("")}</div>` : ""}
${aktion}
<details class="aufklapp"><summary>Ideen und Hintergrund</summary><div class="uebung-text">${u.html || ""}</div></details>
${anpassen}`);
}

// Alles wird sofort gespeichert – schließt jemand die App mittendrin, fehlt nichts
function reflexionOeffnen(neu = true) {
  const d = verschieben(tag(), tagVersatz);
  const e = Z.log[d] || {};
  const gutes = e.gutes || [];
  if (neu) reflexionWarDa = Boolean(e.stimmung);
  blattOeffnen(`<p class="oberzeile">${tagVersatz === 0 ? "Heute" : "Gestern"}</p><h2>🙏 Abendreflexion</h2>
<p>Wie war dein Tag?</p>
<div class="stimmung">${STIMMUNGEN.map(([emoji, wort], i) => `<button data-aktion="stimmung" data-wert="${i + 1}" aria-pressed="${e.stimmung === i + 1}" aria-label="${wort}"><span aria-hidden="true">${emoji}</span><span class="klein">${wort}</span></button>`).join("")}</div>
<p>Drei gute Dinge – was war heute schön?</p>
${[0, 1, 2].map((i) => `<input data-gut="${i}" value="${esc(gutes[i] || "")}" placeholder="${["z. B. die warme Dusche", "z. B. ein Lachen mit jemandem", "z. B. der Himmel am Abend"][i]}" maxlength="120">`).join("")}
${Z.gewohnheiten.length ? `<p>Worauf hast du ${tagVersatz === 0 ? "heute" : "gestern"} geachtet?</p>
<ul class="liste">${Z.gewohnheiten.map((g) => g.slug).map((slug) => { const u = info(slug); const f = erledigt(d, slug); return `<li class="punkt${f ? " fertig" : ""}"><button class="haken" data-aktion="abhaken" data-slug="${slug}" data-im-blatt="1" aria-pressed="${f}" aria-label="${esc(u.titel)}">✓</button><span class="punkt-titel">${u.emoji} ${esc(u.titel)}</span></li>`; }).join("")}</ul>` : ""}
<button class="knopf" data-aktion="reflexion-speichern">Fertig</button>`);
}

// ---------------------------------------------------------------- Aktionen

function feedbackLink() {
  const monat = tag().slice(0, 7);
  const zeilen = Z.gewohnheiten.map((g) => { const u = info(g.slug); return `- ${u.titel}: ${anzahlImMonat(g.slug, monat)}× diesen Monat`; });
  const text = `Meine Erfahrung mit der Routinen-App (seit ${tageZwischen(Z.start, tag()) + 1} Tagen):\n${zeilen.join("\n")}\n\nDas hilft mir am meisten: \nDas fällt mir schwer: \nMeine Idee: `;
  return `../?${new URLSearchParams({ anliegen: "Habitica-Challenge", nachricht: text })}#kontakt`;
}

function abhaken(slug, imBlatt) {
  const d = verschieben(tag(), tagVersatz);
  const e = eintrag(d);
  if (e.erledigt.includes(slug)) {
    e.erledigt = e.erledigt.filter((s) => s !== slug);
  } else {
    e.erledigt.push(slug);
    feiern();
  }
  speichern();
  if (imBlatt) reflexionOeffnen(false); // Stimmung und gute Dinge sind schon gespeichert
  render();
}

function hinzufuegen(slug) {
  if (!Z.gewohnheiten.some((g) => g.slug === slug) && U[slug]) {
    Z.gewohnheiten.push({ slug, anker: "", seit: tag() });
    speichern();
    dauerhaftSpeichern();
    const u = info(slug);
    toast(`${u.emoji} ${u.titel} ist jetzt in deinen Routinen.`);
  }
}

function questAnnehmen(slug) {
  Z.quest = slug;
  speichern();
  const u = info(slug);
  toast(`Quest gestartet: ${u.emoji} ${u.titel}`);
}

function questFertig() {
  if (!Z.quest) return;
  const fertig = questsLaden();
  fertig.add(Z.quest);
  questsSpeichern(fertig);
  Z.questDaten[Z.quest] = tag();
  Z.quest = null;
  questVorschlag = null;
  speichern();
  feiern("Quest geschafft! 🏆");
}

function icsText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDatei(termine, name) {
  const jetzt = `${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Phoenix Feder//Probiers heute//DE", "CALSCALE:GREGORIAN"];
  for (const t of termine) {
    zeilen.push("BEGIN:VEVENT", `UID:${t.id}-${Date.now()}@phoenix-feder.de`, `DTSTAMP:${jetzt}`, `DTSTART:${t.start}`,
      `DTEND:${t.ende}`, ...(t.regel ? [t.regel] : []), `SUMMARY:${icsText(t.titel)}`, `DESCRIPTION:${icsText(t.text)}`,
      `URL:${t.url}`, "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(t.titel)}`, "END:VALARM", "END:VEVENT");
  }
  zeilen.push("END:VCALENDAR");
  herunterladen(zeilen.join("\r\n"), name, "text/calendar");
  toast("📥 Kalenderdatei geladen – öffne sie, dann landet die Erinnerung in deinem Kalender.");
}

function ics() {
  const url = `${location.origin}${location.pathname}`;
  const termin = (id, zeit, titel, text) => {
    const start = erinnerungStart(zeit);
    return { id, titel, text: `${text} ${url}`, url, start: kalenderZeit(start),
      ende: kalenderZeit(new Date(start.getTime() + 5 * 60000)), regel: "RRULE:FREQ=DAILY" };
  };
  icsDatei([termin("morgen", Z.erinnerung.morgen, "🪶 Dein Wort für heute", "Kurz innehalten: Was zählt heute?"),
    ...(Z.reflexion === true ? [termin("abend", Z.erinnerung.abend, "🪶 Abendreflexion", "Wie war dein Tag? Drei gute Dinge.")] : [])],
  "phoenix-feder-erinnerungen.ics");
}

function herunterladen(inhalt, name, typ) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const sicherung = () => ({ app: Z, quests: [...questsLaden()], exportiert: tag() });

// Daten von außen (Sicherungsdatei, Übertragungslink) nur in der erwarteten Form übernehmen:
// Ein präparierter Link darf weder HTML einschleusen noch die App zum Absturz bringen.
function bereinigen(z) {
  if (!z || typeof z !== "object") z = {};
  const text = (x, max) => (typeof x === "string" ? x.slice(0, max) : "");
  const slugOk = (x) => typeof x === "string" && /^[a-z0-9-]{1,60}$/.test(x);
  const datumOk = (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const zeitOk = (x) => typeof x === "string" && /^\d{2}:\d{2}$/.test(x);
  const liste = (x) => (Array.isArray(x) ? x : []);
  const eintraege = (x) => Object.entries(x && typeof x === "object" ? x : {});
  const n = neuerZustand();
  const log = {};
  for (const [d, e] of eintraege(z.log)) {
    if (!datumOk(d) || !e || typeof e !== "object") continue;
    log[d] = { erledigt: liste(e.erledigt).filter(slugOk) };
    if (Number.isInteger(e.stimmung) && e.stimmung >= 1 && e.stimmung <= STIMMUNGEN.length) log[d].stimmung = e.stimmung;
    if (Array.isArray(e.gutes)) log[d].gutes = e.gutes.slice(0, 3).map((g) => text(g, 120));
    if (typeof e.wort === "string") log[d].wort = text(e.wort, 40);
  }
  const gewohnheiten = liste(z.gewohnheiten).filter((g) => slugOk(g?.slug)).map((g) => ({ slug: g.slug, seit: datumOk(g.seit) ? g.seit : n.start,
    anker: text(g.anker, 80), mini: text(g.mini, 80), wenn: text(g.wenn, 80), dann: text(g.dann, 80) }));
  let reflexion = typeof z.reflexion === "boolean" ? z.reflexion : null;
  if (!("reflexion" in z)) {
    // Zustand von vor Oktober 2026: „Täglich“ (Bewegung, Meditation, Abendreflexion) war fest dabei.
    // Wer es genutzt hat, behält es – jetzt als ganz normale, selbst gewählte Einträge.
    const tage = Object.keys(log).sort();
    for (const slug of FRUEHER_TAEGLICH) {
      const erster = tage.find((d) => log[d].erledigt.includes(slug));
      if (erster && !gewohnheiten.some((g) => g.slug === slug)) gewohnheiten.push({ slug, seit: erster, anker: "", mini: "", wenn: "", dann: "" });
    }
    if (tage.some((d) => log[d].stimmung)) reflexion = true;
  }
  const p = z.probieren && typeof z.probieren === "object" ? z.probieren : {};
  return {
    ...n,
    start: datumOk(z.start) ? z.start : n.start,
    modus: z.modus === "routine" ? "routine" : "probieren",
    gewohnheiten,
    log,
    quest: slugOk(z.quest) ? z.quest : null,
    questDaten: Object.fromEntries(eintraege(z.questDaten).filter(([q, d]) => slugOk(q) && datumOk(d))),
    automatik: Object.fromEntries(eintraege(z.automatik).filter(([g]) => slugOk(g)).map(([g, l]) => [g,
      liste(l).filter((x) => datumOk(x?.datum) && Number.isInteger(x.wert) && x.wert >= 1 && x.wert <= AUTOMATIK.length)
        .map((x) => ({ datum: x.datum, wert: x.wert }))])),
    hinweise: Object.fromEntries(eintraege(z.hinweise).filter(([k, d]) => /^[a-z0-9-]{1,40}$/.test(k) && datumOk(d))),
    erinnerung: { morgen: zeitOk(z.erinnerung?.morgen) ? z.erinnerung.morgen : n.erinnerung.morgen,
      abend: zeitOk(z.erinnerung?.abend) ? z.erinnerung.abend : n.erinnerung.abend },
    reflexion,
    probieren: { bereich: slugOk(p.bereich) ? p.bereich : "", zeit: typeof p.zeit === "string" && Object.prototype.hasOwnProperty.call(ZEIT, p.zeit) ? p.zeit : "", idee: slugOk(p.idee) ? p.idee : "" },
  };
}

function uebernehmen(daten) {
  if (!daten?.app || daten.app.version !== 1 || !Array.isArray(daten.app.gewohnheiten)) throw new Error("ungültig");
  Z = bereinigen(daten.app);
  Z.gewohnheiten = Z.gewohnheiten.filter((g) => U[g.slug]);
  questsSpeichern(new Set((Array.isArray(daten.quests) ? daten.quests : []).filter((q) => U[q])));
  speichern();
  wiederherstellen();
}

// Gemerkte Antworten aus dem Zustand übernehmen (beim Start, nach Import, bei Änderung in einem anderen Tab)
function wiederherstellen() {
  ideeFilter = Z.probieren.bereich || null;
  ideeZeit = Z.probieren.zeit || null;
  idee = U[Z.probieren.idee] ? Z.probieren.idee : null;
}

function base64url(bytes) {
  let binaer = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binaer += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binaer).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function ausBase64url(text) {
  const binaer = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binaer, (z) => z.charCodeAt(0));
}

async function packen(objekt) {
  const bytes = new TextEncoder().encode(JSON.stringify(objekt));
  if (!("CompressionStream" in window)) return `j${base64url(bytes)}`;
  const strom = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return `z${base64url(new Uint8Array(await new Response(strom).arrayBuffer()))}`;
}

async function entpacken(text) {
  const bytes = ausBase64url(text.slice(1));
  if (text[0] === "j") return JSON.parse(new TextDecoder().decode(bytes));
  const strom = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(strom).text());
}

async function linkTeilen() {
  const link = `${location.origin}${location.pathname}#import=${await packen(sicherung())}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Meine Routinen übertragen", url: link }); return; } catch { /* abgebrochen */ }
  }
  try {
    await navigator.clipboard.writeText(link);
    toast("Link kopiert – öffne ihn auf dem anderen Gerät.");
  } catch {
    prompt("Kopiere diesen Link und öffne ihn auf dem anderen Gerät:", link);
  }
}

async function importAusLink(text) {
  history.replaceState(null, "", `${location.pathname}#heute`);
  try {
    const daten = await entpacken(text);
    if (confirm("Daten von deinem anderen Gerät übernehmen? Die bisherigen Einträge auf diesem Gerät werden ersetzt.")) {
      uebernehmen(daten);
      toast("Übernommen. Willkommen zurück! 🪶");
    }
  } catch {
    toast("Der Link ist unvollständig oder beschädigt.");
  }
  route();
}

const AKTIONEN = {
  "start-bereich": (el, slug) => {
    startBereiche = startBereiche.includes(slug) ? startBereiche.filter((s) => s !== slug) : [...startBereiche, slug];
    render();
  },
  "start-wahl": (el, slug) => {
    startAuswahl = startAuswahl.includes(slug) ? startAuswahl.filter((s) => s !== slug) : [...startAuswahl, slug];
    render();
  },
  "start-weiter": () => {
    if (startSchritt === 1) startAuswahl = startAuswahl.filter((s) => startBereiche.includes(U[s]?.bereich));
    startSchritt += 1;
    render();
    scrollTo(0, 0);
  },
  "start-zurueck": () => { startSchritt -= 1; render(); scrollTo(0, 0); },
  "start-fertig": () => {
    document.querySelectorAll("[data-start-anker]").forEach((feld) => { startAnker[feld.dataset.startAnker] = feld.value; });
    startAuswahl.forEach((slug) => Z.gewohnheiten.push({ slug, anker: startAnker[slug] || "", seit: tag() }));
    Z.modus = "routine";
    speichern();
    dauerhaftSpeichern();
    if (location.hash === "#heute") route(); else location.hash = "#heute";
    feiern("Los geht’s! Deine Reise beginnt. 🪶");
  },
  tag: (el, slug, wert) => { tagVersatz = Number(wert); render(); },
  abhaken: (el, slug) => abhaken(slug, el.dataset.imBlatt),
  details: (el, slug) => details(slug),
  reflexion: () => reflexionOeffnen(),
  stimmung: (el, slug, wert) => {
    el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
    eintrag(verschieben(tag(), tagVersatz)).stimmung = Number(wert);
    speichern();
  },
  "reflexion-speichern": () => {
    const e = Z.log[verschieben(tag(), tagVersatz)];
    if (!e?.stimmung) { toast("Wähle kurz, wie dein Tag war."); return; }
    blattSchliessen();
    render();
    feiern(reflexionWarDa ? "Gespeichert." : "Danke für deinen Tag. 🙏");
    reflexionWarDa = true;
  },
  "reflexion-wahl": (el, slug, wert) => {
    Z.reflexion = wert === "ja";
    speichern();
    render();
    toast(Z.reflexion ? "Schön! Die Abendreflexion steht ab jetzt unter „Heute“. 🙏" : "Alles klar – du kannst sie unter „Mehr“ jederzeit einschalten.");
  },
  wort: (el, slug, wert) => { eintrag(tag()).wort = wert; speichern(); render(); if (wert) feiern(`Heute: ${wert}`); },
  "hinweis-weg": (el, slug, wert) => { Z.hinweise[wert] = tag(); speichern(); if (el.tagName !== "A") render(); },
  automatik: (el, slug, wert) => {
    (Z.automatik[slug] ||= []).push({ datum: tag(), wert: Number(wert) });
    speichern();
    render();
    toast(Number(wert) >= 4 ? "Wunderbar – das sitzt! Vielleicht ist Platz für eine neue Gewohnheit." : "Danke. Dranbleiben lohnt sich – oft dauert es rund zwei Monate.");
  },
  "quest-annehmen": (el, slug) => { questAnnehmen(slug); blattSchliessen(); render(); },
  "quest-andere": () => { questVorschlag = null; render(); },
  "quest-weg": () => { Z.quest = null; questVorschlag = null; speichern(); render(); },
  "quest-fertig": () => { questFertig(); blattSchliessen(); render(); },
  filter: (el, slug, wert) => { filter = wert; if (ansicht !== "entdecken") location.hash = "#entdecken"; else render(); },
  hinzufuegen: (el, slug) => { hinzufuegen(slug); blattSchliessen(); render(); },
  entfernen: (el, slug) => {
    if (!confirm(`${info(slug).titel} aus deinen Routinen entfernen? Deine bisherigen Einträge bleiben erhalten.`)) return;
    Z.gewohnheiten = Z.gewohnheiten.filter((g) => g.slug !== slug);
    speichern();
    blattSchliessen();
    render();
  },
  "speichern-gewohnheit": (el, slug) => {
    const g = Z.gewohnheiten.find((x) => x.slug === slug);
    for (const feld of ["anker", "mini", "wenn", "dann"]) g[feld] = $(`.blatt [data-feld=${feld}]`).value.trim();
    speichern();
    blattSchliessen();
    render();
    toast("Gespeichert.");
  },
  installieren: async () => {
    if (!installEreignis) return;
    installEreignis.prompt();
    const { outcome } = await installEreignis.userChoice;
    installEreignis = null;
    if (outcome === "accepted") dauerhaftSpeichern();
    render();
  },
  "google-geoeffnet": () => toast("Google Kalender öffnet sich – dort noch auf „Speichern“ tippen."),
  ics: () => ics(),
  "ics-idee": () => icsDatei([ideeTermin(idee)], `phoenix-feder-${idee}.ics`),
  "kal-zeit": (el, slug, wert) => { kalZeit = wert; offenLassen("details", render); },
  "kal-dauer": (el, slug, wert) => { kalDauer = wert; offenLassen("details", render); },
  ueberrasch: () => {
    const pool = ideenPool().filter((u) => !ausprobiertHeute(u.slug));
    AKTIONEN["idee-zeigen"](null, zufall(pool.length ? pool : ideenPool()).slug);
  },
  "idee-zeigen": (el, slug) => {
    if (!U[slug]) return;
    idee = slug;
    // Kommt man aus „Alle Ideen“, passen die Antworten zur Idee – so führt „Zurück“ zu ähnlichen Ideen
    if (!ideeFilter || !ideeZeit) { ideeFilter = U[slug].bereich || "alle"; ideeZeit = U[slug].art === "quest" ? "lang" : "kurz"; }
    merken();
    blattSchliessen();
    if (ansicht !== "probieren") { location.hash = "#probieren"; return; }
    render();
    scrollTo(0, 0);
    $(".idee")?.classList.add("blaettern");
  },
  "zur-auswahl": () => { idee = null; merken(); render(); scrollTo(0, 0); },
  frage: (el, slug) => { ideeFilter = slug; ideeZeit = null; idee = null; merken(); render(); scrollTo(0, 0); },
  zeit: (el, slug) => { ideeZeit = slug; idee = null; merken(); render(); scrollTo(0, 0); },
  "neu-fragen": () => { ideeFilter = null; ideeZeit = null; idee = null; merken(); render(); scrollTo(0, 0); },
  ausprobiert: () => {
    const u = info(idee);
    if (u.art === "quest") {
      const fertig = questsLaden();
      fertig.add(idee);
      questsSpeichern(fertig);
      Z.questDaten[idee] = tag();
    } else {
      const e = eintrag(tag());
      if (!e.erledigt.includes(idee)) e.erledigt.push(idee);
    }
    speichern();
    offenLassen("details", render);
    feiern("Schön! 🪶 Spür kurz nach, wie sich das angefühlt hat.");
  },
  laenger: () => {
    const u = info(idee);
    if (u.art === "quest") { if (!questsLaden().has(idee)) Z.quest = idee; } else hinzufuegen(idee);
    Z.modus = "routine";
    speichern();
    dauerhaftSpeichern();
    if (location.hash === "#heute") route(); else location.hash = "#heute";
    toast("Willkommen! Hake hier täglich ab, was dir gelungen ist. 🌱");
  },
  export: () => herunterladen(JSON.stringify(sicherung(), null, 1), `phoenix-feder-routinen-${tag()}.json`, "application/json"),
  "link-teilen": () => linkTeilen(),
  zuruecksetzen: () => {
    if (!confirm("Wirklich alles löschen? Gewohnheiten, Einträge und Quests auf diesem Gerät sind dann weg.")) return;
    Z = neuerZustand();
    questsSpeichern(new Set());
    speichern();
    startBereiche = [];
    startAuswahl = [];
    startSchritt = 1;
    wiederherstellen();
    history.replaceState(null, "", `${location.pathname}#heute`);
    route();
  },
  schliessen: () => blattSchliessen(),
};

// ---------------------------------------------------------------- Start

// Offene Aufklapper nach dem Neuzeichnen offen lassen (z. B. beim Wählen der Uhrzeit)
function offenLassen(auswahl, zeichnen) {
  const offen = [...document.querySelectorAll(auswahl)].map((d) => d.open === true);
  zeichnen();
  document.querySelectorAll(auswahl).forEach((d, i) => { if (offen[i]) d.open = true; });
}

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("import=")) { importAusLink(h.slice(7)); return; }
  if (h.startsWith("bereich=")) {
    // Von der Seite /gewohnheiten/: erste Frage schon beantwortet („Ein kleines Erlebnis“ beantwortet auch die zweite)
    const wahl = h.slice(8);
    if (richtungen().some((r) => r.slug === wahl)) {
      [ideeFilter, ideeZeit] = wahl === "erlebnis" ? ["alle", "lang"] : [wahl, null];
      idee = null;
      merken();
    }
    history.replaceState(null, "", `${location.pathname}#probieren`);
    route();
    return;
  }
  if (h.startsWith("idee=") || h.startsWith("neu=")) {
    // Links von der Website: erst die Idee zeigen, statt gleich eine Routine anzulegen
    const slug = h.slice(h.indexOf("=") + 1);
    if (U[slug]) {
      idee = slug;
      ideeFilter = U[slug].bereich || "alle";
      ideeZeit = U[slug].art === "quest" ? "lang" : "kurz";
      merken();
    }
    history.replaceState(null, "", `${location.pathname}#probieren`);
    route();
    return;
  }
  const bekannt = ["start", "probieren", "heute", "entdecken", "fortschritt", "mehr"];
  ansicht = bekannt.includes(h) ? h : routineModus() ? "heute" : "probieren";
  if (ansicht === "heute" && !routineModus()) ansicht = "probieren";
  blattSchliessen();
  render();
  scrollTo(0, 0);
}

document.addEventListener("click", (ereignis) => {
  const el = ereignis.target.closest("[data-aktion]");
  if (el && AKTIONEN[el.dataset.aktion]) {
    if (el.tagName === "BUTTON") ereignis.preventDefault();
    AKTIONEN[el.dataset.aktion](el, el.dataset.slug, el.dataset.wert);
  } else if (ereignis.target.matches("[data-blatt]")) {
    blattSchliessen();
  }
});

document.addEventListener("change", (ereignis) => {
  const feld = ereignis.target;
  if (feld.dataset.feld === "morgen" || feld.dataset.feld === "abend") {
    Z.erinnerung[feld.dataset.feld] = feld.value;
    speichern();
    render();
  }
  // „Anpassen“ einer Gewohnheit: sofort speichern, nicht erst beim Knopf
  const gewohnheit = feld.closest("[data-gewohnheit]") && Z.gewohnheiten.find((g) => g.slug === feld.closest("[data-gewohnheit]").dataset.gewohnheit);
  if (gewohnheit && ["anker", "mini", "wenn", "dann"].includes(feld.dataset.feld)) {
    gewohnheit[feld.dataset.feld] = feld.value.trim();
    speichern();
  }
  if (feld.dataset.aktionDatei === "import" && feld.files[0]) {
    feld.files[0].text().then((text) => {
      if (!confirm("Sicherung laden? Die bisherigen Einträge auf diesem Gerät werden ersetzt.")) return;
      uebernehmen(JSON.parse(text));
      toast("Sicherung geladen. 🪶");
      route();
    }).catch(() => toast("Diese Datei ist keine gültige Sicherung."));
  }
});

// Drei gute Dinge: jede Eingabe sofort speichern
document.addEventListener("input", (ereignis) => {
  if (!ereignis.target.matches("[data-gut]")) return;
  eintrag(verschieben(tag(), tagVersatz)).gutes = [...document.querySelectorAll("[data-gut]")].map((i) => i.value.trim());
  speichern();
});

document.addEventListener("keydown", (ereignis) => {
  if (ereignis.key === "Escape") blattSchliessen();
});

addEventListener("hashchange", route);
// Andere Tabs (z. B. die Seite /gewohnheiten/) haben etwas geändert -> neu einlesen statt überschreiben
addEventListener("storage", (ereignis) => {
  if (ereignis.key !== SPEICHER && ereignis.key !== QUESTS) return;
  Z = laden();
  render();
});
addEventListener("beforeinstallprompt", (ereignis) => {
  ereignis.preventDefault();
  installEreignis = ereignis;
  if (ansicht === "mehr" || ansicht === "heute") render();
});
addEventListener("appinstalled", () => toast("Installiert! Du findest „Probier’s heute“ jetzt bei deinen Apps. 🪶"));

async function starten() {
  Z = laden();
  try {
    D = await (await fetch("daten.json")).json();
  } catch {
    $("#app").innerHTML = '<p class="hinweis-app">Die Übungen konnten nicht geladen werden. Prüfe deine Verbindung und lade die Seite neu.</p>';
    return;
  }
  // Eine ältere daten.json aus dem Cache kennt neuere Felder nicht: hier einmal ergänzen statt überall abfragen
  D.uebungen.forEach((u) => { u.heute ??= u.kurz; u.statt ??= []; u.monate ??= []; u.bereich ??= ""; U[u.slug] = u; });
  D.richtungen ??= [...D.bereiche, { slug: "alle", emoji: "🎲", titel: "Überrasch mich", text: "" }];
  Z.gewohnheiten = Z.gewohnheiten.filter((g) => U[g.slug]); // falls eine Übung umbenannt wurde
  wiederherstellen();
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

starten();
