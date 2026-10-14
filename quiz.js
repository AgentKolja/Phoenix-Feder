// Realitätscheck „Wie realistisch ist dein Weltbild?“ – nach Hans Roslings Factfulness, mit aktuellen Zahlen.
// Ablauf: Bauchgefühl vorab, Fragen mit sofortiger Auflösung, Quelle und Wert aus Roslings Studie, dann Ergebnis
// mit Einordnung (pessimistisch / realistisch / optimistisch).
// Antworten gehen nur nach ausdrücklichem Ja anonym über Web3Forms an Nikolas (ohne Namen, ohne E-Mail, ohne Cookies).
(() => {
  const wurzel = document.querySelector("[data-quiz]");
  const datenEl = document.getElementById("quiz-daten");
  if (!wurzel || !datenEl) return;
  const Q = JSON.parse(datenEl.textContent);
  const BUCHSTABEN = ["A", "B", "C"];
  const GEMERKT = "phoenix-feder-quiz"; // nur: Version, zu der schon beigetragen wurde (keine Doppelzählung)
  // Zahl und Prozentzeichen nicht trennen (" %" → geschütztes Leerzeichen)
  const esc = (t) => String(t).replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z])).replace(/ %/g, "\u00a0%");
  let weltbild = null;
  let antworten = [];
  let schritt = "weltbild"; // weltbild | 0..n-1 | beitragen | ergebnis
  let gesendet = null; // null | "ok" | "fehler" | "aus"

  const gemerkt = () => { try { return localStorage.getItem(GEMERKT); } catch { return null; } };
  const merken = () => { try { localStorage.setItem(GEMERKT, Q.version); } catch { /* privates Fenster */ } };

  const fortschritt = (i) => `<div class="quiz-kopf"><span>${i === null ? "Vorab" : i >= Q.fragen.length ? "Fertig" : `Frage ${i + 1} von ${Q.fragen.length}`}</span>
    <span class="quiz-balken"><span style="width:${i === null ? 0 : Math.round((100 * Math.min(i, Q.fragen.length)) / Q.fragen.length)}%"></span></span></div>`;

  const knopf = (aktion, wert, text, klasse = "") => `<button type="button" class="${klasse}" data-quiz-aktion="${aktion}" data-wert="${wert}">${text}</button>`;

  function zeichneWeltbild() {
    wurzel.innerHTML = `${fortschritt(null)}
      <h2 class="quiz-frage">${esc(Q.weltbild.frage)}</h2>
      <div class="quiz-antworten">${Q.weltbild.antworten.map((a, i) => knopf("weltbild", i, `<b>${BUCHSTABEN[i]}</b> ${esc(a)}`, "quiz-antwort")).join("")}</div>
      <p class="klein">Hier gibt es kein Richtig oder Falsch. Es geht um deinen Eindruck.</p>`;
  }

  function zeichneFrage(i) {
    const f = Q.fragen[i];
    const gewaehlt = antworten[i];
    const beantwortet = gewaehlt !== undefined;
    const richtig = f.antworten.findIndex((a) => a[1] === "r");
    wurzel.innerHTML = `${fortschritt(i)}
      <p class="oberzeile">${esc(f.thema)}</p>
      <h2 class="quiz-frage">${esc(f.frage)}</h2>
      <div class="quiz-antworten">${f.antworten.map(([text], j) => {
        const klasse = !beantwortet ? "" : j === richtig ? " richtig" : j === gewaehlt ? " falsch" : " still";
        const zeichen = !beantwortet ? "" : j === richtig ? '<span class="quiz-zeichen">✓</span>' : j === gewaehlt ? '<span class="quiz-zeichen">✗</span>' : "";
        return `<button type="button" class="quiz-antwort${klasse}" data-quiz-aktion="antwort" data-wert="${j}"${beantwortet ? " disabled" : ""}><b>${BUCHSTABEN[j]}</b> <span>${esc(text)}</span>${zeichen}</button>`;
      }).join("")}</div>
      ${beantwortet ? `<div class="quiz-aufloesung">
        <p class="quiz-urteil" tabindex="-1">${gewaehlt === richtig ? "✓ Richtig!" : `Nicht ganz. Richtig ist ${BUCHSTABEN[richtig]}.`}</p>
        <p>${esc(f.erklaerung)}</p>
        ${studie(f)}
        <p class="klein">Quelle: <a href="${esc(f.quelle[1])}" target="_blank" rel="noopener">${esc(f.quelle[0])}</a></p>
        ${knopf("weiter", "", i + 1 < Q.fragen.length ? "Weiter" : "Zum Ergebnis", "knopf")}
      </div>` : ""}`;
  }

  // Gapminder Misconception Study 2017: Anteil falscher Antworten (Schnitt aus 14 Ländern / Deutschland)
  const studie = (f) => (f.studie ? `<p class="quiz-studie">In Roslings Studie 2017 lagen bei einer ähnlichen Frage <strong>${f.studie[0]} %</strong> falsch (Deutschland: ${f.studie[1]} %).</p>` : "");

  const TYPEN = {
    pessimistisch: ["Eher pessimistisch", "Die Welt ist besser als dein Bild von ihr. So geht es den meisten, und eigentlich ist das eine gute Nachricht."],
    realistisch: ["Realistisch", "Du siehst die Welt ziemlich so, wie sie ist. Das schaffen die wenigsten."],
    optimistisch: ["Eher optimistisch", "Du schätzt die Welt eher zu rosig ein. Das ist selten. Bei manchen Themen lohnt es sich, genauer hinzusehen."],
    gemischt: ["Mal zu düster, mal zu rosig", "Deine Fehler halten sich die Waage, ohne klaren Hang in eine Richtung."]
  };
  const typVon = (e) => (e.richtig >= Math.ceil((Q.fragen.length * 2) / 3) ? "realistisch"
    : e.pessimistisch > e.optimistisch ? "pessimistisch" : e.optimistisch > e.pessimistisch ? "optimistisch" : "gemischt");

  function zeichneBeitragen() {
    if (gemerkt() === Q.version || !Q.schluessel) { gesendet = "aus"; zeichneErgebnis(); return; }
    wurzel.innerHTML = `${fortschritt(Q.fragen.length)}
      <h2 class="quiz-frage">Geschafft! Magst du mithelfen?</h2>
      <p>Ich sammle, wie Menschen die Welt heute einschätzen, und veröffentliche die Auswertung hier. Deine Antworten gehen dafür <strong>anonym</strong> an mich, ohne Namen oder E-Mail-Adresse und ohne Cookies.</p>
      <label class="quiz-alter"><span>Altersgruppe (freiwillig)</span>
        <select data-quiz-alter><option value="">keine Angabe</option><option>unter 25</option><option>25–39</option><option>40–59</option><option>60 und älter</option></select></label>
      <div class="knopf-reihe">${knopf("beitragen", "ja", "Ja, anonym beisteuern und Ergebnis zeigen", "knopf")}${knopf("beitragen", "nein", "Nur Ergebnis zeigen", "knopf zweit")}</div>
      <p class="klein">Mehr dazu in der <a href="${esc(new URL("../datenschutz/", location.href).pathname)}">Datenschutzerklärung</a>.</p>`;
  }

  function auswertung() {
    let richtig = 0;
    let pessimistisch = 0;
    let optimistisch = 0;
    Q.fragen.forEach((f, i) => {
      const r = f.antworten[antworten[i]]?.[1];
      if (r === "r") richtig += 1;
      if (r === "p") pessimistisch += 1;
      if (r === "o") optimistisch += 1;
    });
    return { richtig, pessimistisch, optimistisch };
  }

  async function senden(alter) {
    const e = auswertung();
    const form = new FormData();
    form.append("access_key", Q.schluessel);
    form.append("subject", `Quiz: anonyme Antworten (${e.richtig} von ${Q.fragen.length})`);
    form.append("from_name", "phoenix-feder.de Quiz");
    form.append("Quiz-Version", Q.version);
    form.append("Richtig", `${e.richtig} von ${Q.fragen.length}`);
    form.append("Zu pessimistisch", String(e.pessimistisch));
    form.append("Zu optimistisch", String(e.optimistisch));
    form.append("Weltbild", TYPEN[typVon(e)][0]);
    form.append("Bauchgefühl vorab", Q.weltbild.antworten[weltbild]);
    form.append("Altersgruppe", alter || "keine Angabe");
    form.append("Antworten", Q.fragen.map((f, i) => `${i + 1}. ${f.thema}: ${BUCHSTABEN[antworten[i]]}${f.antworten[antworten[i]][1] === "r" ? " ✓" : ""}`).join("\n"));
    form.append("Daten", JSON.stringify({ v: Q.version, w: weltbild, a: antworten, r: e.richtig, p: e.pessimistisch, o: e.optimistisch, t: typVon(e), alter: alter || "" }));
    try {
      const antwort = await fetch("https://api.web3forms.com/submit", { method: "POST", headers: { Accept: "application/json" }, body: form });
      const daten = await antwort.json();
      if (!antwort.ok || !daten.success) throw new Error(daten.message || antwort.status);
      merken();
      gesendet = "ok";
    } catch {
      gesendet = "fehler";
    }
    const status = wurzel.querySelector("[data-quiz-status]");
    if (status) status.outerHTML = statusHtml();
  }

  const statusHtml = () => (gesendet === "ok" ? '<p class="quiz-status ok" data-quiz-status>Danke! Deine Antworten sind anonym angekommen.</p>'
    : gesendet === "fehler" ? '<p class="quiz-status" data-quiz-status>Deine Antworten konnten gerade nicht übermittelt werden. Dein Ergebnis siehst du trotzdem.</p>'
      : gesendet === "laeuft" ? '<p class="quiz-status" data-quiz-status>Wird anonym übermittelt …</p>' : "");

  function zeichneErgebnis() {
    const e = auswertung();
    const n = Q.fragen.length;
    const affe = Math.round(n / 3);
    const vergleich = e.richtig > affe + 1 ? "Damit liegst du vor dem Schimpansen. Das schaffen viele nicht."
      : e.richtig >= affe - 1 ? "Damit liegst du etwa gleichauf mit dem Schimpansen. So geht es den meisten."
        : "Damit liegt der Schimpanse vorn. Keine Sorge, so geht es vielen. Unser Kopf liebt Dramatik.";
    const richtung = e.pessimistisch > e.optimistisch
      ? `Bei <strong>${e.pessimistisch}</strong> ${e.pessimistisch === 1 ? "Frage" : "Fragen"} hast du die Welt schlechter eingeschätzt, als sie ist${e.optimistisch ? `, bei ${e.optimistisch} besser` : ""}.`
      : e.optimistisch > e.pessimistisch ? `Bei <strong>${e.optimistisch}</strong> ${e.optimistisch === 1 ? "Frage" : "Fragen"} hast du die Welt besser eingeschätzt, als sie ist${e.pessimistisch ? `, bei ${e.pessimistisch} schlechter` : ""}.`
        : e.pessimistisch ? `Du lagst gleich oft zu pessimistisch wie zu optimistisch (je ${e.pessimistisch}-mal).` : "";
    const typ = typVon(e);
    const skala = ["pessimistisch", "realistisch", "optimistisch"].map((t) => `<span${t === typ ? ' class="aktiv"' : ""}>${t[0].toUpperCase()}${t.slice(1)}</span>`).join("");
    wurzel.innerHTML = `<div class="quiz-ergebnis">
      <p class="oberzeile">Dein Weltbild</p>
      <p class="quiz-typ" data-typ="${typ}">${TYPEN[typ][0]}</p>
      <div class="quiz-skala" aria-hidden="true">${skala}</div>
      <p>${TYPEN[typ][1]}</p>
      <p class="quiz-zahl"><strong>${e.richtig}</strong> von ${n} richtig</p>
      <p>Ein Schimpanse, der zufällig tippt, schafft im Schnitt ${affe} von ${n}. ${vergleich}</p>
      ${richtung ? `<p>${richtung}</p>` : ""}
      <p class="klein">Dein Bauchgefühl vorab: „${esc(Q.weltbild.antworten[weltbild])}“.</p>
      ${statusHtml()}
    </div>
    <div class="quiz-warum">
      <h3>Warum wir die Welt düsterer sehen, als sie ist</h3>
      <p class="quiz-kern">Der größte Verzerrer sind die Medien.</p>
      <p>Nachrichten berichten über das, was schiefgeht. Ein Flugzeugabsturz ist eine Meldung, Millionen sichere Landungen sind keine. Langsame Verbesserungen wie die sinkende Kindersterblichkeit passieren an keinem einzelnen Tag und schaffen es deshalb kaum in die Schlagzeilen. Online verstärkt sich das: Schlechte Nachrichten werden öfter angeklickt. In einer Studie mit rund 105.000 Varianten von Schlagzeilen steigerte jedes zusätzliche negative Wort die Klickrate um 2,3&nbsp;%, positive Wörter senkten sie (Robertson u. a., Nature Human Behaviour 2023). Und was oft geklickt wird, landet öfter vor unseren Augen.</p>
      <p>Dass das bei uns so gut funktioniert, hat einen alten Grund. Unser Gehirn ist für ein Leben in der Natur gemacht. Dort war es überlebenswichtig, Gefahren sofort zu bemerken: Wer ein Rascheln im Gras einmal zu oft für eine Schlange hielt, verlor wenig. Wer es einmal übersah, vielleicht sein Leben. Darum wiegt Schlechtes für uns schwerer als Gutes: Wir bemerken es schneller und reagieren stärker darauf. Die Psychologie nennt das den Negativitätseffekt („Bad is stronger than good“, Baumeister u. a. 2001).</p>
      <p>Hans Rosling nennt es den Negativitäts-Instinkt. Dazu kommt: Wir erinnern die Vergangenheit schöner, als sie war. Und es fühlt sich herzlos an zu sagen, dass etwas besser wird, solange es noch schlecht ist.</p>
      <p>Was uns in der Natur geschützt hat, verzerrt heute unser Bild, denn über die Medien erreichen uns die Gefahren der ganzen Welt rund um die Uhr. Was hilft? Nachrichten bewusst dosieren und bei einer schlimmen Meldung kurz fragen: Ist das typisch oder die Ausnahme? Genau hier hilft Achtsamkeit. Wer bemerkt, wie der eigene Kopf bewertet, sieht klarer und lebt gelassener.</p>
    </div>
    <section class="quiz-uebersicht"><h3>Alle Fragen und Antworten</h3>
    <p class="quiz-legende"><span class="zeichen-ok">✓ Richtig</span> <span class="zeichen-du">✗ Deine Antwort</span></p><ol>${Q.fragen.map((f, i) => {
      const optionen = f.antworten.map(([text, art], j) => {
        const du = antworten[i] === j;
        const ok = art === "r";
        const klasse = [ok && "ok", du && "du"].filter(Boolean).join(" ");
        const marken = (ok ? '<span class="zeichen-ok">✓ Richtig</span>' : "") + (du ? `<span class="zeichen-du">${ok ? "Deine Antwort" : "✗ Deine Antwort"}</span>` : "");
        return `<li${klasse ? ` class="${klasse}"` : ""}><b>${BUCHSTABEN[j]}</b><span>${esc(text)}</span>${marken ? `<span class="marken">${marken}</span>` : ""}</li>`;
      }).join("");
      const studieText = f.studie ? `Studie 2017: ${f.studie[0]} % falsch (Deutschland ${f.studie[1]} %) · ` : "";
      return `<li><strong>${esc(f.frage)}</strong><ul class="quiz-optionen">${optionen}</ul>
        <span class="klein">${studieText}<a href="${esc(f.quelle[1])}" target="_blank" rel="noopener">Quelle</a></span></li>`;
    }).join("")}</ol><p class="klein">Stand der Zahlen: ${esc(Q.stand)}. Studienwerte: Gapminder Misconception Study 2017 mit rund 12.000 Menschen in 14 Ländern, dort teils mit den damaligen Zahlen gefragt (<a href="https://www.gapminder.org/ignorance/studies/gms/" target="_blank" rel="noopener">Gapminder</a>). Inspiriert durch das Buch „Factfulness“ von Hans Rosling, Ola Rosling und Anna Rosling Rönnlund.</p></section>
    <div class="knopf-reihe">${knopf("teilen", "", "Quiz teilen", "knopf")}${knopf("neu", "", "Noch einmal", "knopf zweit")}<a class="knopf zweit" href="${esc(new URL("../post/die-realitaet-sehen/", location.href).pathname)}">Artikel: Die Realität sehen</a></div>`;
  }

  function zeichnen() {
    if (schritt === "weltbild") zeichneWeltbild();
    else if (typeof schritt === "number") zeichneFrage(schritt);
    else if (schritt === "beitragen") zeichneBeitragen();
    else zeichneErgebnis();
  }

  function oben() {
    const y = wurzel.getBoundingClientRect().top + scrollY - 90;
    if (wurzel.getBoundingClientRect().top < 60) scrollTo({ top: y });
  }

  wurzel.addEventListener("click", async (ereignis) => {
    const el = ereignis.target.closest("[data-quiz-aktion]");
    if (!el) return;
    const wert = el.dataset.wert;
    switch (el.dataset.quizAktion) {
      case "weltbild":
        weltbild = Number(wert);
        schritt = 0;
        zeichnen();
        oben();
        break;
      case "antwort":
        antworten[schritt] = Number(wert);
        zeichnen();
        wurzel.querySelector(".quiz-urteil")?.focus({ preventScroll: true });
        wurzel.querySelector(".quiz-aufloesung")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        break;
      case "weiter":
        schritt = schritt + 1 < Q.fragen.length ? schritt + 1 : "beitragen";
        zeichnen();
        oben();
        break;
      case "beitragen": {
        const alter = wurzel.querySelector("[data-quiz-alter]")?.value || "";
        schritt = "ergebnis";
        gesendet = wert === "ja" ? "laeuft" : "aus";
        zeichnen();
        oben();
        if (wert === "ja") await senden(alter);
        break;
      }
      case "teilen": {
        const url = location.href.split("#")[0];
        const e = auswertung();
        if (navigator.share) {
          try { await navigator.share({ title: document.title, text: `Mein Weltbild: ${TYPEN[typVon(e)][0].toLowerCase()}, ${e.richtig} von ${Q.fragen.length} richtig. Wie realistisch ist deins?`, url }); } catch { /* abgebrochen */ }
        } else {
          try { await navigator.clipboard.writeText(url); el.textContent = "Link kopiert ✓"; } catch { /* Zwischenablage gesperrt */ }
        }
        break;
      }
      case "neu":
        weltbild = null;
        antworten = [];
        gesendet = null;
        schritt = "weltbild";
        zeichnen();
        oben();
        break;
      default:
    }
  });

  zeichnen();
})();
