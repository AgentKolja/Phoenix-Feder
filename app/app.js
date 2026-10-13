// Phoenix Feder – Meine Routinen
//
// Kein Konto, kein Server: Alles liegt im localStorage dieses Geräts.
// Die Ideen dahinter, kurz:
// - Tiny Habits (BJ Fogg): klein anfangen, an einen festen Anker im Alltag koppeln, sofort feiern
// - Wenn-dann-Pläne (Gollwitzer) bzw. WOOP (Oettingen): Hindernis vorher benennen, Plan B festlegen
// - "Nie zweimal hintereinander auslassen": Ein verpasster Tag bricht keine Kette
// - Selbstbeobachtung: Abendreflexion mit Stimmung und "Drei gute Dinge" (Seligman)
// - Was hilft dir wirklich? Stimmung an Tagen mit vs. ohne Gewohnheit
// - Automatik-Check alle zwei Wochen statt starrer "21 Tage"
// - Neustart-Momente: Wochenbeginn, Monatsanfang (Fresh-Start-Effekt)
"use strict";

const SPEICHER = "phoenix-feder-app";
const QUESTS = "phoenix-feder-quests"; // gemeinsam mit der Seite /gewohnheiten/
const PUNKTE = { gewohnheit: 10, taeglich: 5, reflexion: 10, quest: 30 };
const TAEGLICH = [
  { slug: "bewegung", titel: "Bewegung", emoji: "🤸" },
  { slug: "meditation-und-atmung", titel: "Meditation", emoji: "🧘" },
];
const ANKER = ["Nach dem Aufstehen", "Nach dem ersten Kaffee oder Tee", "In der Mittagspause", "Unterwegs",
  "Zum Feierabend", "Beim Abendessen", "Vor dem Schlafengehen"];
const WOERTER = ["Ruhe", "Fokus", "Freude", "Geduld", "Klarheit", "Mut", "Leichtigkeit", "Dankbarkeit"];
const STIMMUNGEN = [["😣", "schwer"], ["😕", "durchwachsen"], ["😐", "okay"], ["🙂", "gut"], ["😄", "richtig gut"]];
const AUTOMATIK = ["gar nicht", "kaum", "teils", "meistens", "ganz von allein"];
const LOB = ["Schön! 🪶", "Das tat dir gut.", "Genau so.", "Ein Funke mehr.", "Yes – weiter so!",
  "Dein zukünftiges Ich dankt dir.", "Stark. Spür kurz nach, wie sich das anfühlt."];
const STUFEN = ["Funke", "Glut", "Flamme", "Feuer", "Phönix"];

let D = { uebungen: [] }; // daten.json
const U = {}; // Übungen nach Slug
let Z; // Zustand
let speicherFehlt = false;
let ansicht = "heute";
let tagVersatz = 0; // 0 = heute, -1 = gestern nachtragen
let filter = "gewohnheit";
let questVorschlag = null;
let startAuswahl = [];
let startSchritt = 1;
let startAnker = {};
let installEreignis = null;

// ---------------------------------------------------------------- Hilfen

const $ = (auswahl, wurzel = document) => wurzel.querySelector(auswahl);
const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
const tag = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const verschieben = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return tag(d); };
const tageZwischen = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 864e5);
const datumLang = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
const zahl = (x) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });
const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];
const istTaeglich = (slug) => TAEGLICH.some((t) => t.slug === slug);

function info(slug) {
  const t = TAEGLICH.find((x) => x.slug === slug);
  const u = U[slug] || {};
  return { slug, emoji: t?.emoji || u.emoji || "✨", titel: t?.titel || u.titel || slug, art: u.art, html: u.html, kurz: u.kurz };
}

// ---------------------------------------------------------------- Speicher

function neuerZustand() {
  return { version: 1, start: tag(), gewohnheiten: [], log: {}, quest: null, questDaten: {}, automatik: {},
    belohnungen: [], eingeloest: [], hinweise: {}, erinnerung: { morgen: "07:30", abend: "21:00" } };
}

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    return roh ? { ...neuerZustand(), ...JSON.parse(roh) } : neuerZustand();
  } catch {
    speicherFehlt = true;
    return neuerZustand();
  }
}

function speichern() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(Z)); } catch { speicherFehlt = true; }
  $("[data-federn]").textContent = `🪶 ${federnVerfuegbar()}`;
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

function federnGesamt() {
  let summe = questsLaden().size * PUNKTE.quest;
  for (const e of Object.values(Z.log)) {
    for (const slug of e.erledigt || []) summe += istTaeglich(slug) ? PUNKTE.taeglich : PUNKTE.gewohnheit;
    if (e.stimmung) summe += PUNKTE.reflexion;
  }
  return summe;
}

const federnVerfuegbar = () => federnGesamt() - Z.eingeloest.reduce((s, x) => s + x.kosten, 0);

function stufe(federn) {
  let n = 1;
  while (federn >= 50 * n * (n + 1)) n += 1;
  return { n, name: STUFEN[(n - 1) % STUFEN.length], von: 50 * (n - 1) * n, bis: 50 * n * (n + 1) };
}

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
  const liste = [...Z.gewohnheiten.map((g) => g.slug), ...TAEGLICH.map((t) => t.slug)].map((slug) => {
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
  document.querySelectorAll("[data-tab]").forEach((a) => {
    if (a.dataset.tab === ansicht) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const ansichten = { start: ansichtStart, heute: ansichtHeute, entdecken: ansichtEntdecken, fortschritt: ansichtFortschritt, mehr: ansichtMehr };
  $("#app").innerHTML = (speicherFehlt ? '<p class="hinweis-app">Dein Browser erlaubt hier kein Speichern (privates Fenster?). Deine Einträge gehen beim Schließen verloren.</p>' : "")
    + ansichten[ansicht]();
  $("[data-federn]").textContent = `🪶 ${federnVerfuegbar()}`;
}

function ansichtStart() {
  if (startSchritt === 1) {
    const auswahl = D.uebungen.filter((u) => u.art === "gewohnheit" && !istTaeglich(u.slug));
    return `<section class="willkommen">
  <p class="oberzeile">Stressfrei – die Kunst, das Leben zu genießen</p>
  <h1>Sei der Hauptcharakter deines Lebens.</h1>
  <p>Wähle <strong>drei Gewohnheiten</strong>, die dich ansprechen. Es sind keine Zusatzaufgaben, sondern ein Fokus darauf, <em>wie</em> du etwas tust. 1 bis 10 Minuten am Tag genügen.</p>
  <p class="klein">Kein Konto nötig. Alles bleibt auf diesem Gerät.</p>
</section>
<div class="wahl-raster">${auswahl.map((u) => `<button class="wahl" data-aktion="start-wahl" data-slug="${u.slug}" aria-pressed="${startAuswahl.includes(u.slug)}">
  <span class="wahl-emoji" aria-hidden="true">${u.emoji}</span><span>${esc(u.titel)}</span></button>`).join("")}</div>
${startAuswahl.length > 3 ? '<p class="klein">Tipp: Mit drei startet es sich leichter. Mehr kannst du jederzeit dazunehmen.</p>' : ""}
<div class="leiste-unten"><button class="knopf" data-aktion="start-weiter" ${startAuswahl.length ? "" : "disabled"}>Weiter${startAuswahl.length ? ` mit ${startAuswahl.length}` : ""}</button></div>`;
  }
  return `<section class="willkommen">
  <p class="oberzeile">Schritt 2 von 2</p>
  <h1>Wann passt es in deinen Tag?</h1>
  <p>Gewohnheiten halten am besten, wenn sie an etwas hängen, das du ohnehin tust: <em>„Nach dem Kaffee …“</em></p>
</section>
${startAuswahl.map((slug) => {
    const u = info(slug);
    return `<div class="karte-app"><h3>${u.emoji} ${esc(u.titel)}</h3><div class="chips-app">${ANKER.map((a) => `<button data-aktion="start-anker" data-slug="${slug}" data-wert="${esc(a)}" aria-pressed="${startAnker[slug] === a}">${esc(a)}</button>`).join("")}</div></div>`;
  }).join("")}
<div class="leiste-unten"><button class="knopf zweit" data-aktion="start-zurueck">Zurück</button><button class="knopf" data-aktion="start-fertig">Los geht’s</button></div>`;
}

function gruss() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 17 ? "Hallo" : "Guten Abend";
}

function punktZeile(slug, d, meta = "") {
  const u = info(slug);
  const fertig = erledigt(d, slug);
  const k = kette(slug);
  const zusatz = [meta, k > 1 ? `🔥 ${k}` : ""].filter(Boolean).join(" · ");
  const sanft = tagVersatz === 0 && !fertig && gesternVerpasst(slug) ? '<span class="sanft">Gestern ausgelassen – kein Problem. Heute zählt.</span>' : "";
  return `<li class="punkt${fertig ? " fertig" : ""}">
  <button class="haken" data-aktion="abhaken" data-slug="${slug}" aria-pressed="${fertig}" aria-label="${esc(u.titel)} ${fertig ? "erledigt" : "abhaken"}">✓</button>
  <button class="punkt-text" data-aktion="details" data-slug="${slug}">
    <span class="punkt-titel"><span aria-hidden="true">${u.emoji}</span> ${esc(u.titel)}</span>
    ${zusatz ? `<span class="punkt-meta">${esc(zusatz)}</span>` : ""}${sanft}
  </button>
</li>`;
}

function hinweisKarten() {
  const heute = tag();
  const karten = [];
  const wochentag = new Date().getDay();
  if (new Date().getDate() === 1 && !Z.hinweise[`neustart-${heute}`]) {
    karten.push(`<div class="karte-app hinweis-karte"><p><strong>Neuer Monat, frischer Start 🌱</strong> Zeit für deine Monatsrückschau: Was lief gut, was willst du anpassen?</p>
      <div class="knopf-reihe"><a class="knopf klein-knopf" href="#fortschritt">Rückschau ansehen</a><button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="neustart-${heute}">Später</button></div></div>`);
  } else if (wochentag === 1 && !Z.hinweise[`neustart-${heute}`]) {
    karten.push(`<div class="karte-app hinweis-karte"><p><strong>Neue Woche, frischer Start 🌱</strong> Passt deine Auswahl noch zu dir? Zu leicht oder zu schwer – nimm etwas dazu oder weg.</p>
      <div class="knopf-reihe"><a class="knopf klein-knopf" href="#entdecken">Anpassen</a><button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="neustart-${heute}">Passt so</button></div></div>`);
  }
  const faellig = automatikFaellig();
  if (faellig) {
    const u = info(faellig.slug);
    karten.push(`<div class="karte-app hinweis-karte"><p><strong>Kurzer Check:</strong> Wie automatisch läuft <strong>${u.emoji} ${esc(u.titel)}</strong> inzwischen?</p>
      <div class="chips-app">${AUTOMATIK.map((t, i) => `<button data-aktion="automatik" data-slug="${faellig.slug}" data-wert="${i + 1}">${t}</button>`).join("")}</div></div>`);
  }
  if (tageZwischen(Z.start, heute) >= 14 && !Z.hinweise.feedback14) {
    karten.push(`<div class="karte-app hinweis-karte"><p><strong>Zwei Wochen dabei! 🎉</strong> Magst du erzählen, was dir hilft und was dir schwerfällt? Ich lese jede Nachricht persönlich.</p>
      <div class="knopf-reihe"><a class="knopf klein-knopf" href="${esc(feedbackLink())}" data-aktion="hinweis-weg" data-wert="feedback14">Erfahrung teilen</a><button class="knopf zweit klein-knopf" data-aktion="hinweis-weg" data-wert="feedback14">Später</button></div></div>`);
  }
  return karten.join("");
}

function wortKarte(d) {
  const e = Z.log[d];
  if (e?.wort) return `<p class="wort">Dein Wort für heute: <strong>${esc(e.wort)}</strong> <button class="link-knopf" data-aktion="wort" data-wert="">ändern</button></p>`;
  if (new Date().getHours() >= 14) return "";
  return `<div class="karte-app"><h3>Dein Wort für heute</h3>
  <p class="klein">Was zählt heute? Ein Wort als Kompass für deinen Tag.</p>
  <div class="chips-app">${WOERTER.map((w) => `<button data-aktion="wort" data-wert="${w}">${w}</button>`).join("")}</div>
  <div class="eigene-eingabe"><input data-feld="wort" placeholder="Eigenes Wort" maxlength="30"><button class="knopf klein-knopf" data-aktion="wort-eigen">Festlegen</button></div></div>`;
}

function questKarte() {
  const fertig = questsLaden();
  if (Z.quest && fertig.has(Z.quest)) Z.quest = null;
  if (Z.quest) {
    const u = info(Z.quest);
    return `<div class="karte-app quest"><p class="oberzeile">Quest${U[Z.quest]?.gruppe ? ` · ${esc(U[Z.quest].gruppe)}` : ""}</p>
      <h3>${u.emoji} ${esc(u.titel)}</h3><p>${esc(u.kurz)}</p>
      <div class="knopf-reihe"><button class="knopf" data-aktion="quest-fertig">Geschafft! +${PUNKTE.quest} 🪶</button><button class="knopf zweit" data-aktion="details" data-slug="${Z.quest}">Details</button><button class="link-knopf" data-aktion="quest-weg">andere</button></div></div>`;
  }
  const alleOffen = D.uebungen.filter((u) => u.art === "quest" && !fertig.has(u.slug));
  // Abschluss-Quests (Reflexion der Reise, Community) erst, wenn alle anderen geschafft sind
  const offen = alleOffen.some((u) => u.gruppe !== "Abschluss") ? alleOffen.filter((u) => u.gruppe !== "Abschluss") : alleOffen;
  if (!offen.length) return '<div class="karte-app"><p>Du hast alle Quests geschafft. Großartig! 🏆 Lust auf mehr? Die Challenge auf Habitica bekommt neue Ideen.</p></div>';
  if (!questVorschlag || fertig.has(questVorschlag)) questVorschlag = zufall(offen).slug;
  const u = info(questVorschlag);
  return `<div class="karte-app quest"><p class="oberzeile">Vorschlag für diese Woche</p>
    <h3>${u.emoji} ${esc(u.titel)}</h3><p>${esc(u.kurz)}</p>
    <div class="knopf-reihe"><button class="knopf" data-aktion="quest-annehmen" data-slug="${questVorschlag}">Annehmen</button><button class="knopf zweit" data-aktion="quest-andere">Andere Quest ↻</button></div></div>`;
}

function ansichtHeute() {
  const d = verschieben(tag(), tagVersatz);
  const e = Z.log[d] || {};
  const reflexion = `<li class="punkt${e.stimmung ? " fertig" : ""}">
  <button class="haken" data-aktion="reflexion" aria-pressed="${Boolean(e.stimmung)}" aria-label="Abendreflexion">✓</button>
  <button class="punkt-text" data-aktion="reflexion">
    <span class="punkt-titel"><span aria-hidden="true">🙏</span> Abendreflexion</span>
    <span class="punkt-meta">${e.stimmung ? `${STIMMUNGEN[e.stimmung - 1][0]} · ${(e.gutes || []).filter(Boolean).length} gute Dinge` : "Stimmung und drei gute Dinge · 2 Minuten"}</span>
  </button>
</li>`;
  return `<section class="tag-kopf">
  <p class="oberzeile">${tagVersatz === 0 ? gruss() : "Nachtragen"}</p>
  <h1>${tagVersatz === 0 ? "Heute" : "Gestern"}, ${datumLang(d)}</h1>
  <div class="umschalter"><button data-aktion="tag" data-wert="0" aria-pressed="${tagVersatz === 0}">Heute</button><button data-aktion="tag" data-wert="-1" aria-pressed="${tagVersatz === -1}">Gestern nachtragen</button></div>
</section>
${tagVersatz === 0 ? hinweisKarten() + wortKarte(d) : ""}
<h2>Deine Gewohnheiten</h2>
<p class="klein">Kein Abarbeiten: Lebe deinen Tag und hake ab, worauf du geachtet hast.</p>
<ul class="liste">${Z.gewohnheiten.map((g) => punktZeile(g.slug, d, g.anker)).join("")}</ul>
<a class="link-knopf" href="#entdecken">+ Gewohnheit hinzufügen</a>
<h2>Täglich</h2>
<ul class="liste">${TAEGLICH.map((t) => punktZeile(t.slug, d, "auch 5 Minuten zählen")).join("")}${reflexion}</ul>
${tagVersatz === 0 ? `<h2>Deine Quest</h2>${questKarte()}` : ""}`;
}

function ansichtEntdecken() {
  const dabei = new Set(Z.gewohnheiten.map((g) => g.slug));
  const fertig = questsLaden();
  const liste = D.uebungen.filter((u) => u.art === filter);
  const knopf = (u) => {
    if (u.art === "quest") {
      if (fertig.has(u.slug)) return '<span class="marke-app">✓ geschafft</span>';
      return Z.quest === u.slug ? '<span class="marke-app">aktiv</span>' : `<button class="knopf zweit klein-knopf" data-aktion="quest-annehmen" data-slug="${u.slug}">Starten</button>`;
    }
    if (istTaeglich(u.slug) || u.slug === "reflektion") return '<span class="marke-app">täglich dabei</span>';
    return dabei.has(u.slug) ? `<button class="knopf klein-knopf" data-aktion="entfernen" data-slug="${u.slug}" aria-pressed="true">✓ dabei</button>`
      : `<button class="knopf zweit klein-knopf" data-aktion="hinzufuegen" data-slug="${u.slug}">+ Aufnehmen</button>`;
  };
  return `<h1>Entdecken</h1>
<div class="umschalter"><button data-aktion="filter" data-wert="gewohnheit" aria-pressed="${filter === "gewohnheit"}">Gewohnheiten</button><button data-aktion="filter" data-wert="quest" aria-pressed="${filter === "quest"}">Quests (${fertig.size}/${D.uebungen.filter((u) => u.art === "quest").length})</button></div>
<p class="klein">${filter === "quest" ? "Quests sind Erlebnisse, die du dir vornehmen kannst, wann immer du magst." : "Tipp: Lieber drei Gewohnheiten wirklich leben als zehn halb."}</p>
<ul class="entdecken">${liste.map((u) => `<li class="karte-app eintrag">
  <button class="eintrag-text" data-aktion="details" data-slug="${u.slug}"><span class="eintrag-titel"><span aria-hidden="true">${u.emoji}</span> ${esc(u.titel)}</span>${u.gruppe ? `<span class="punkt-meta">${esc(u.gruppe)}</span>` : ""}<span class="klein">${esc(u.kurz)}</span></button>
  ${knopf(u)}</li>`).join("")}</ul>`;
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
  const gesamt = federnGesamt();
  const s = stufe(gesamt);
  const anteil = Math.round((100 * (gesamt - s.von)) / (s.bis - s.von));
  const monat = tag().slice(0, 7);
  const vormonat = verschieben(`${monat}-01`, -1).slice(0, 7);
  const e = erkenntnisse();
  const fertig = questsLaden();
  const stimmungen = Object.entries(Z.log).filter(([d, x]) => d.startsWith(monat) && x.stimmung).map(([, x]) => x.stimmung);
  const gutes = Object.entries(Z.log).filter(([, x]) => (x.gutes || []).some(Boolean)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 4);
  const hilft = e.genug ? e.liste.filter((x) => x.diff >= 0.3).slice(0, 3) : [];
  const alle = [...Z.gewohnheiten.map((g) => g.slug), ...TAEGLICH.map((t) => t.slug)];
  return `<h1>Fortschritt</h1>
<div class="karte-app stufe"><p class="oberzeile">Stufe ${s.n}</p><h2>${s.name}</h2>
  <div class="balken"><span style="width:${anteil}%"></span></div>
  <p class="klein">${gesamt} Federn gesammelt · noch ${s.bis - gesamt} bis Stufe ${s.n + 1} · ${federnVerfuegbar()} zum Einlösen</p></div>

<h2>Was dir wirklich hilft</h2>
${!e.genug ? `<p class="klein">Mach an ein paar Abenden die Abendreflexion. Ab 7 Tagen zeige ich dir hier, an welchen Tagen es dir besser ging (bisher: ${e.tage}).</p>`
    : hilft.length ? `<ul class="erkenntnisse">${hilft.map((x) => { const u = info(x.slug); return `<li><strong>${u.emoji} ${esc(u.titel)}</strong>: An diesen Tagen lag deine Stimmung bei Ø ${zahl(x.mit)} statt ${zahl(x.ohne)} <span class="klein">(${x.n} Tage)</span></li>`; }).join("")}</ul>
      <p class="klein">Ein Zusammenhang, kein Beweis – aber ein guter Hinweis, was du beibehalten solltest. Je mehr Tage, desto aussagekräftiger.</p>`
      : '<p class="klein">Noch zeigt sich kein deutlicher Unterschied. Bleib dran – nach ein paar Wochen wird das Bild klarer.</p>'}

<h2>Deine Ketten</h2>
<p class="klein">Ein verpasster Tag bricht keine Kette – nur zwei hintereinander.</p>
<ul class="ketten">${alle.map((slug) => { const u = info(slug); const a = (Z.automatik[slug] || []).at(-1); return `<li class="karte-app">
  <p class="eintrag-titel"><span aria-hidden="true">${u.emoji}</span> ${esc(u.titel)} <span class="punkt-meta">🔥 ${kette(slug)} · ${anzahlImMonat(slug, monat)}× diesen Monat${a ? ` · läuft ${AUTOMATIK[a.wert - 1]}` : ""}</span></p>
  ${punkteReihe(slug)}</li>`; }).join("")}</ul>

<h2>Monatsrückschau</h2>
<div class="karte-app"><table class="rueckschau"><thead><tr><th></th><th>diesen Monat</th><th>Vormonat</th></tr></thead><tbody>
  ${alle.map((slug) => { const u = info(slug); return `<tr><td>${u.emoji} ${esc(u.titel)}</td><td>${anzahlImMonat(slug, monat)}</td><td>${anzahlImMonat(slug, vormonat)}</td></tr>`; }).join("")}
  <tr><td>🙏 Reflexionen</td><td>${stimmungen.length}</td><td>${Object.entries(Z.log).filter(([d, x]) => d.startsWith(vormonat) && x.stimmung).length}</td></tr>
  <tr><td>🗺️ Quests</td><td>${Object.values(Z.questDaten).filter((d) => d.startsWith(monat)).length}</td><td>${Object.values(Z.questDaten).filter((d) => d.startsWith(vormonat)).length}</td></tr>
</tbody></table>
${stimmungen.length ? `<p class="klein">Ø Stimmung diesen Monat: ${zahl(stimmungen.reduce((a, b) => a + b, 0) / stimmungen.length)} von 5</p>` : ""}</div>

${gutes.length ? `<h2>Gute Dinge</h2><ul class="gutes">${gutes.map(([d, x]) => `<li><span class="klein">${datumLang(d)}</span>${x.gutes.filter(Boolean).map((g) => `<span>✨ ${esc(g)}</span>`).join("")}</li>`).join("")}</ul>` : ""}

<h2>Belohnungen</h2>
<p class="klein">Gönn dir etwas – ohne schlechtes Gewissen. Belohnungen ziehen nichts von deinen Gewohnheiten ab.</p>
<ul class="belohnungen">${Z.belohnungen.map((b) => `<li class="karte-app eintrag"><span>${esc(b.name)} <span class="punkt-meta">${b.kosten} 🪶</span></span>
  <span class="knopf-reihe"><button class="knopf klein-knopf" data-aktion="einloesen" data-wert="${b.id}" ${federnVerfuegbar() < b.kosten ? "disabled" : ""}>Einlösen</button><button class="link-knopf" data-aktion="belohnung-weg" data-wert="${b.id}" aria-label="${esc(b.name)} löschen">✕</button></span></li>`).join("")}</ul>
<div class="eigene-eingabe"><input data-feld="belohnung" placeholder="z. B. Massage, Lieblingsessen, Kino" maxlength="60"><input data-feld="kosten" type="number" min="10" step="10" value="100" aria-label="Federn"><button class="knopf klein-knopf" data-aktion="belohnung-neu">+</button></div>

<h2>Quests</h2>
<p>${fertig.size} von ${D.uebungen.filter((u) => u.art === "quest").length} geschafft. <a href="#entdecken" data-aktion="filter" data-wert="quest">Alle ansehen</a></p>`;
}

function kalenderLink(titel, zeit, text) {
  const [h, m] = zeit.split(":");
  const morgen = verschieben(tag(), 1).replaceAll("-", "");
  const start = `${morgen}T${h}${m}00`;
  const ende = `${morgen}T${h}${String(Math.min(59, Number(m) + 5)).padStart(2, "0")}00`;
  const p = new URLSearchParams({ action: "TEMPLATE", text: titel, details: `${text} ${location.origin}${location.pathname}`, dates: `${start}/${ende}`, ctz: "Europe/Berlin", recur: "RRULE:FREQ=DAILY" });
  return `https://calendar.google.com/calendar/render?${p}`;
}

function ansichtMehr() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  const r = Z.erinnerung;
  return `<h1>Mehr</h1>
<h2>Als App installieren</h2>
${installEreignis ? '<button class="knopf" data-aktion="installieren">Auf den Startbildschirm</button>'
    : ios ? '<p>Tippe in Safari auf <strong>Teilen</strong> und dann auf <strong>„Zum Home-Bildschirm“</strong>.</p>'
      : '<p class="klein">Öffne das Browser-Menü und wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“. Danach startet die App wie jede andere – auch offline.</p>'}

<h2>Erinnerungen</h2>
<p class="klein">Ohne Konto und ohne Server: Die Erinnerungen kommen über deinen Kalender.</p>
<div class="zeiten"><label>Morgens <input type="time" data-feld="morgen" value="${r.morgen}"></label><label>Abends <input type="time" data-feld="abend" value="${r.abend}"></label></div>
<div class="knopf-reihe"><a class="knopf zweit klein-knopf" target="_blank" rel="noopener" href="${esc(kalenderLink("🪶 Dein Wort für heute", r.morgen, "Kurz innehalten: Was zählt heute?"))}">Morgens → Google Kalender</a>
<a class="knopf zweit klein-knopf" target="_blank" rel="noopener" href="${esc(kalenderLink("🪶 Abendreflexion", r.abend, "Wie war dein Tag? Drei gute Dinge."))}">Abends → Google Kalender</a>
<button class="knopf zweit klein-knopf" data-aktion="ics">Beide als Kalenderdatei (Apple, Outlook)</button></div>

<h2>Deine Daten</h2>
<p class="klein">Alles bleibt auf diesem Gerät. Nichts wird an mich oder Dritte übertragen. Für ein anderes Gerät oder als Sicherung:</p>
<div class="knopf-reihe"><button class="knopf zweit klein-knopf" data-aktion="link-teilen">Auf anderes Gerät übertragen</button>
<button class="knopf zweit klein-knopf" data-aktion="export">Sicherung herunterladen</button>
<label class="knopf zweit klein-knopf datei">Sicherung laden<input type="file" accept="application/json,.json" data-aktion-datei="import" hidden></label></div>
<p class="klein">Der Übertragungs-Link enthält deine Einträge. Schick ihn nur an dich selbst.</p>
<button class="link-knopf gefahr" data-aktion="zuruecksetzen">Alles zurücksetzen</button>

<h2>Mitmachen</h2>
<ul class="mehr-links">
  <li><a href="${esc(feedbackLink())}">💬 Erfahrung oder Idee an Nikolas schicken</a></li>
  <li><a href="${esc(D.habitica)}" rel="noopener" target="_blank">🎮 Die Challenge als Rollenspiel in Habitica</a></li>
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
  let unten = "";
  if (g) {
    unten = `<h3>Deine Version</h3>
<label>Wann? <select data-feld="anker"><option value="">– jederzeit –</option>${ANKER.map((a) => `<option ${g.anker === a ? "selected" : ""}>${esc(a)}</option>`).join("")}${g.anker && !ANKER.includes(g.anker) ? `<option selected>${esc(g.anker)}</option>` : ""}</select></label>
<label>Mini-Version für schwere Tage <input data-feld="mini" value="${esc(g.mini || "")}" placeholder="z. B. nur 1 Minute, nur 1 Glas Wasser" maxlength="80"></label>
<p class="klein">Wenn-dann-Plan: Was könnte dich hindern – und was tust du dann?</p>
<label>Wenn … <input data-feld="wenn" value="${esc(g.wenn || "")}" placeholder="z. B. ich abends zu müde bin" maxlength="80"></label>
<label>… dann <input data-feld="dann" value="${esc(g.dann || "")}" placeholder="z. B. mache ich die Mini-Version" maxlength="80"></label>
<div class="knopf-reihe"><button class="knopf" data-aktion="speichern-gewohnheit" data-slug="${slug}">Speichern</button><button class="link-knopf gefahr" data-aktion="entfernen" data-slug="${slug}">Aus meinen Routinen entfernen</button></div>`;
  } else if (u.art === "quest") {
    unten = questsLaden().has(slug) ? '<p class="marke-app">✓ geschafft</p>'
      : Z.quest === slug ? `<button class="knopf" data-aktion="quest-fertig">Geschafft! +${PUNKTE.quest} 🪶</button>`
        : `<button class="knopf" data-aktion="quest-annehmen" data-slug="${slug}">Als Quest starten</button>`;
  } else if (!istTaeglich(slug) && slug !== "reflektion") {
    unten = `<button class="knopf" data-aktion="hinzufuegen" data-slug="${slug}">In meine Routinen aufnehmen</button>`;
  }
  const plan = g?.wenn && g?.dann ? `<p class="plan">Wenn ${esc(g.wenn)}, dann ${esc(g.dann)}.</p>` : "";
  blattOeffnen(`<p class="oberzeile">${u.art === "quest" ? "Quest" : istTaeglich(slug) ? "Täglich" : "Gewohnheit"}</p>
<h2>${u.emoji} ${esc(u.titel)}</h2>${g?.mini ? `<p class="plan">Mini-Version: ${esc(g.mini)}</p>` : ""}${plan}
<div class="uebung-text">${u.html || ""}</div>${unten}`);
}

function reflexionOeffnen() {
  const d = verschieben(tag(), tagVersatz);
  const e = Z.log[d] || {};
  const gutes = e.gutes || [];
  blattOeffnen(`<p class="oberzeile">${tagVersatz === 0 ? "Heute" : "Gestern"}</p><h2>🙏 Abendreflexion</h2>
<p>Wie war dein Tag?</p>
<div class="stimmung">${STIMMUNGEN.map(([emoji, wort], i) => `<button data-aktion="stimmung" data-wert="${i + 1}" aria-pressed="${e.stimmung === i + 1}" aria-label="${wort}"><span aria-hidden="true">${emoji}</span><span class="klein">${wort}</span></button>`).join("")}</div>
<p>Drei gute Dinge – was war heute schön?</p>
${[0, 1, 2].map((i) => `<input data-gut="${i}" value="${esc(gutes[i] || "")}" placeholder="${["z. B. die warme Dusche", "z. B. ein Lachen mit jemandem", "z. B. der Himmel am Abend"][i]}" maxlength="120">`).join("")}
<p>Worauf hast du heute geachtet?</p>
<ul class="liste">${[...Z.gewohnheiten.map((g) => g.slug), ...TAEGLICH.map((t) => t.slug)].map((slug) => { const u = info(slug); const f = erledigt(d, slug); return `<li class="punkt${f ? " fertig" : ""}"><button class="haken" data-aktion="abhaken" data-slug="${slug}" data-im-blatt="1" aria-pressed="${f}" aria-label="${esc(u.titel)}">✓</button><span class="punkt-titel">${u.emoji} ${esc(u.titel)}</span></li>`; }).join("")}</ul>
<button class="knopf" data-aktion="reflexion-speichern">Speichern</button>`);
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
  if (imBlatt) {
    reflexionOeffnenBehalten();
  }
  render();
}

// Beim Abhaken im Reflexionsblatt Eingaben behalten
function reflexionOeffnenBehalten() {
  const stimmung = $(".stimmung [aria-pressed=true]")?.dataset.wert;
  const gute = [...document.querySelectorAll("[data-gut]")].map((i) => i.value);
  reflexionOeffnen();
  if (stimmung) $(`.stimmung [data-wert="${stimmung}"]`).setAttribute("aria-pressed", "true");
  document.querySelectorAll("[data-gut]").forEach((i, n) => { i.value = gute[n]; });
}

function hinzufuegen(slug) {
  if (!Z.gewohnheiten.some((g) => g.slug === slug) && !istTaeglich(slug)) {
    Z.gewohnheiten.push({ slug, anker: "", seit: tag() });
    speichern();
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
  feiern(`Quest geschafft! +${PUNKTE.quest} 🪶`);
}

function ics() {
  const jetzt = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const morgen = verschieben(tag(), 1).replaceAll("-", "");
  const url = `${location.origin}${location.pathname}`;
  const termin = (id, zeit, titel, text) => [
    "BEGIN:VEVENT", `UID:${id}-${Date.now()}@phoenix-feder.de`, `DTSTAMP:${jetzt}`,
    `DTSTART:${morgen}T${zeit.replace(":", "")}00`, "DURATION:PT5M", "RRULE:FREQ=DAILY",
    `SUMMARY:${titel}`, `DESCRIPTION:${text} ${url}`, `URL:${url}`,
    "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${titel}`, "END:VALARM", "END:VEVENT"];
  const zeilen = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Phoenix Feder//Meine Routinen//DE", "CALSCALE:GREGORIAN",
    ...termin("morgen", Z.erinnerung.morgen, "🪶 Dein Wort für heute", "Kurz innehalten: Was zählt heute?"),
    ...termin("abend", Z.erinnerung.abend, "🪶 Abendreflexion", "Wie war dein Tag? Drei gute Dinge."),
    "END:VCALENDAR"];
  herunterladen(zeilen.join("\r\n"), "phoenix-feder-erinnerungen.ics", "text/calendar");
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

function uebernehmen(daten) {
  if (!daten?.app || daten.app.version !== 1 || !Array.isArray(daten.app.gewohnheiten)) throw new Error("ungültig");
  Z = { ...neuerZustand(), ...daten.app };
  questsSpeichern(new Set(daten.quests || []));
  speichern();
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
  "start-wahl": (el, slug) => {
    startAuswahl = startAuswahl.includes(slug) ? startAuswahl.filter((s) => s !== slug) : [...startAuswahl, slug];
    render();
  },
  "start-weiter": () => { startSchritt = 2; render(); scrollTo(0, 0); },
  "start-zurueck": () => { startSchritt = 1; render(); },
  "start-anker": (el, slug, wert) => { startAnker[slug] = startAnker[slug] === wert ? "" : wert; render(); },
  "start-fertig": () => {
    startAuswahl.forEach((slug) => Z.gewohnheiten.push({ slug, anker: startAnker[slug] || "", seit: tag() }));
    speichern();
    if (location.hash === "#heute") route(); else location.hash = "#heute";
    feiern("Los geht’s! Deine Reise beginnt. 🪶");
  },
  tag: (el, slug, wert) => { tagVersatz = Number(wert); render(); },
  abhaken: (el, slug) => abhaken(slug, el.dataset.imBlatt),
  details: (el, slug) => details(slug),
  reflexion: () => reflexionOeffnen(),
  stimmung: (el) => {
    el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
  },
  "reflexion-speichern": () => {
    const wert = Number($(".stimmung [aria-pressed=true]")?.dataset.wert);
    if (!wert) { toast("Wähle kurz, wie dein Tag war."); return; }
    const e = eintrag(verschieben(tag(), tagVersatz));
    const neu = !e.stimmung;
    e.stimmung = wert;
    e.gutes = [...document.querySelectorAll("[data-gut]")].map((i) => i.value.trim());
    speichern();
    blattSchliessen();
    render();
    feiern(neu ? `Danke für deinen Tag. +${PUNKTE.reflexion} 🪶` : "Gespeichert.");
  },
  wort: (el, slug, wert) => { eintrag(tag()).wort = wert; speichern(); render(); if (wert) feiern(`Heute: ${wert}`); },
  "wort-eigen": () => { const w = $("[data-feld=wort]").value.trim(); if (w) AKTIONEN.wort(null, null, w); },
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
  "belohnung-neu": () => {
    const name = $("[data-feld=belohnung]").value.trim();
    const kosten = Math.max(10, Number($("[data-feld=kosten]").value) || 100);
    if (!name) return;
    Z.belohnungen.push({ id: String(Date.now()), name, kosten });
    speichern();
    render();
  },
  einloesen: (el, slug, wert) => {
    const b = Z.belohnungen.find((x) => x.id === wert);
    if (!b || federnVerfuegbar() < b.kosten) return;
    Z.eingeloest.push({ id: b.id, datum: tag(), kosten: b.kosten });
    speichern();
    render();
    feiern(`${b.name} – genieß es, ohne schlechtes Gewissen! 🎁`);
  },
  "belohnung-weg": (el, slug, wert) => { Z.belohnungen = Z.belohnungen.filter((x) => x.id !== wert); speichern(); render(); },
  installieren: async () => { installEreignis.prompt(); await installEreignis.userChoice; installEreignis = null; render(); },
  ics: () => ics(),
  export: () => herunterladen(JSON.stringify(sicherung(), null, 1), `phoenix-feder-routinen-${tag()}.json`, "application/json"),
  "link-teilen": () => linkTeilen(),
  zuruecksetzen: () => {
    if (!confirm("Wirklich alles löschen? Gewohnheiten, Einträge, Federn und Quests auf diesem Gerät sind dann weg.")) return;
    Z = neuerZustand();
    questsSpeichern(new Set());
    speichern();
    startAuswahl = [];
    startSchritt = 1;
    history.replaceState(null, "", `${location.pathname}#heute`);
    route();
  },
  schliessen: () => blattSchliessen(),
};

// ---------------------------------------------------------------- Start

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (h.startsWith("import=")) { importAusLink(h.slice(7)); return; }
  if (h.startsWith("neu=")) {
    const slug = h.slice(4);
    history.replaceState(null, "", `${location.pathname}#heute`);
    if (U[slug]?.art === "quest") questAnnehmen(slug);
    else if (U[slug]) hinzufuegen(slug);
    route();
    if (U[slug] && U[slug].art !== "quest" && Z.gewohnheiten.some((g) => g.slug === slug)) details(slug);
    return;
  }
  const bekannt = ["heute", "entdecken", "fortschritt", "mehr"];
  ansicht = bekannt.includes(h) ? h : "heute";
  if (!Z.gewohnheiten.length && ansicht === "heute") ansicht = "start";
  blattSchliessen();
  render();
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
  if (feld.dataset.aktionDatei === "import" && feld.files[0]) {
    feld.files[0].text().then((text) => {
      if (!confirm("Sicherung laden? Die bisherigen Einträge auf diesem Gerät werden ersetzt.")) return;
      uebernehmen(JSON.parse(text));
      toast("Sicherung geladen. 🪶");
      route();
    }).catch(() => toast("Diese Datei ist keine gültige Sicherung."));
  }
});

document.addEventListener("keydown", (ereignis) => {
  if (ereignis.key === "Escape") blattSchliessen();
  if (ereignis.key === "Enter" && ereignis.target.dataset.feld === "wort") AKTIONEN["wort-eigen"]();
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
  if (ansicht === "mehr") render();
});

async function starten() {
  Z = laden();
  try {
    D = await (await fetch("daten.json")).json();
  } catch {
    $("#app").innerHTML = '<p class="hinweis-app">Die Übungen konnten nicht geladen werden. Prüfe deine Verbindung und lade die Seite neu.</p>';
    return;
  }
  D.uebungen.forEach((u) => { U[u.slug] = u; });
  Z.gewohnheiten = Z.gewohnheiten.filter((g) => U[g.slug]); // falls eine Übung umbenannt wurde
  route();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

starten();
