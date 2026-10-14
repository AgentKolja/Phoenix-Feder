// Realitätscheck „Wie realistisch ist dein Weltbild?“ – nach Hans Roslings Factfulness, mit aktuellen Zahlen.
// Ablauf: Bauchgefühl vorab, Fragen mit sofortiger Auflösung, Quelle und Wert aus Roslings Studie, dann Ergebnis
// mit Einordnung (pessimistisch / realistisch / optimistisch).
// Antworten gehen nur nach ausdrücklichem Ja anonym über Web3Forms an Nikolas (ohne Namen, ohne E-Mail, ohne Cookies).
(() => {
  const wurzel = document.querySelector("[data-quiz]");
  const datenEl = document.getElementById("quiz-daten");
  if (!wurzel || !datenEl) return;
  const Q = JSON.parse(datenEl.textContent);
  const BUCHSTABEN = ["A", "B", "C", "D"];
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

  // Einordnung: realistisch ab 60 % richtig; sonst entscheidet der Überhang der Fehler in eine Richtung
  // (p minus o), ab 2 Fragen „eher“, ab 30 % der Fragen „deutlich“. Jede Frage hat eine zu pessimistische und eine
  // zu optimistische Antwort, darum zeigt jede falsche Antwort eine Richtung.
  const TYPEN = {
    pessimistisch: ["Pessimistisch", "Die Welt ist besser als dein Bild von ihr. So geht es den meisten, und eigentlich ist das eine gute Nachricht."],
    realistisch: ["Realistisch", "Du siehst die Welt ziemlich so, wie sie ist. Das schaffen die wenigsten."],
    optimistisch: ["Optimistisch", "Du schätzt die Welt zu rosig ein. Das ist selten. Bei manchen Themen lohnt es sich, genauer hinzusehen."],
    gemischt: ["Mal zu düster, mal zu rosig", "Deine Fehler halten sich die Waage, ohne klaren Hang in eine Richtung."]
  };
  const typVon = (e) => {
    const n = Q.fragen.length;
    const hang = e.pessimistisch - e.optimistisch;
    if (e.richtig >= Math.ceil(n * 0.6)) return "realistisch";
    return hang >= 2 ? "pessimistisch" : hang <= -2 ? "optimistisch" : "gemischt";
  };
  function einordnung(e) {
    const n = Q.fragen.length;
    const typ = typVon(e);
    const hang = e.pessimistisch - e.optimistisch;
    const deutlich = Math.abs(hang) >= Math.ceil(n * 0.3);
    let titel = TYPEN[typ][0];
    let text = TYPEN[typ][1];
    if (typ === "pessimistisch" || typ === "optimistisch") titel = `${deutlich ? "Deutlich" : "Eher"} ${titel.toLowerCase()}`;
    if (typ === "realistisch" && Math.abs(hang) >= 2) text += ` Wenn du danebenlagst, dann eher zu ${hang > 0 ? "düster" : "rosig"}.`;
    // Zeiger immer im Feld des Ergebnisses (Drittel der Skala), je stärker der Hang, desto weiter außen
    const staerke = Math.min(1, Math.abs(hang) / (n / 2));
    const zeiger = typ === "pessimistisch" ? 30 - 26 * staerke : typ === "optimistisch" ? 70 + 26 * staerke
      : 50 - Math.sign(hang) * Math.min(14, 14 * staerke * 2);
    return { typ, titel, text, zeiger };
  }

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
    form.append("Weltbild", einordnung(e).titel);
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
    // Ein Schimpanse tippt zufällig: im Schnitt eine richtige Antwort pro Anzahl der Möglichkeiten
    const affe = Math.round(Q.fragen.reduce((summe, f) => summe + 1 / f.antworten.length, 0));
    const vergleich = e.richtig > affe + 1 ? "Damit liegst du vor dem Schimpansen. Das schaffen viele nicht."
      : e.richtig >= affe - 1 ? "Damit liegst du etwa gleichauf mit dem Schimpansen. So geht es den meisten."
        : "Damit liegt der Schimpanse vorn. Keine Sorge, so geht es vielen. Unser Kopf liebt Dramatik.";
    const ein = einordnung(e);
    const skala = ["pessimistisch", "realistisch", "optimistisch"].map((t) => `<span${t === ein.typ ? ' class="aktiv"' : ""}>${t[0].toUpperCase()}${t.slice(1)}</span>`).join("");
    const teil = (anzahl, klasse, text) => (anzahl ? `<span class="${klasse}" style="flex-grow:${anzahl}" title="${anzahl} ${text}"></span>` : "");
    wurzel.innerHTML = `<div class="quiz-ergebnis">
      <p class="oberzeile">Dein Weltbild</p>
      <p class="quiz-typ" data-typ="${ein.typ}">${ein.titel}</p>
      <div class="quiz-zeiger" role="img" aria-label="Einordnung auf der Skala von pessimistisch über realistisch bis optimistisch: ${ein.titel}">
        <div class="quiz-skala">${skala}</div><span class="quiz-zeiger-punkt" style="left:${ein.zeiger}%"></span></div>
      <p>${ein.text}</p>
      <p class="quiz-zahl"><strong>${e.richtig}</strong> von ${n} richtig</p>
      <div class="quiz-verteilung" aria-hidden="true">${teil(e.pessimistisch, "v-p", "zu pessimistisch")}${teil(e.richtig, "v-r", "richtig")}${teil(e.optimistisch, "v-o", "zu optimistisch")}</div>
      <ul class="quiz-verteilung-legende">
        <li><span class="v-p"></span><strong>${e.pessimistisch}</strong> zu pessimistisch</li>
        <li><span class="v-r"></span><strong>${e.richtig}</strong> richtig</li>
        <li><span class="v-o"></span><strong>${e.optimistisch}</strong> zu optimistisch</li>
      </ul>
      <p>Ein Schimpanse, der zufällig tippt, schafft im Schnitt ${affe} von ${n}. ${vergleich}</p>
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
    <div class="quiz-warum quiz-optimismus">
      <h3>Am gesündesten: realistischer Optimismus</h3>
      <p class="quiz-kern">Die Welt so sehen, wie sie ist, und trotzdem darauf vertrauen, dass sich etwas verbessern lässt.</p>
      <p>Realistischer Optimismus ist keine rosa Brille. Er verbindet einen klaren Blick auf die Fakten mit der Zuversicht, dass sich Probleme lösen lassen, auch durch dein eigenes Handeln. Die Psychologin Sandra Schneider unterscheidet dabei zwischen Optimismus, der zu den Fakten passt, und Selbsttäuschung, bei der man sich Wunschdenken ohne Realitätscheck einredet. Hans Rosling nannte sich deshalb lieber einen „Possibilisten“: jemand, der weder ohne Grund hofft noch ohne Grund fürchtet.</p>
      <h4>Warum er bei Stress hilft</h4>
      <p>Wie sehr uns etwas stresst, hängt nach dem Stressmodell von Richard Lazarus, der Grundlage vieler Stressmanagement-Programme, von zwei Einschätzungen ab: Wie bedrohlich ist die Lage? Und habe ich, was ich brauche, um damit umzugehen? Genau hier wirkt dein Weltbild. Wer zu pessimistisch ist, sieht überall Gefahr und wenig Möglichkeiten. Das hält in Alarmbereitschaft und lähmt eher, als dass es hilft. Wer zu rosig sieht, unterschätzt echte Risiken und bereitet sich nicht vor. Realistische Optimisten sehen das Problem klar und trauen sich zu, etwas zu tun. So wird aus einer Bedrohung eher eine Herausforderung.</p>
      <p>Das zeigt sich im Verhalten: Eine Auswertung von 50 Studien mit über 11.000 Menschen fand, dass optimistische Menschen Probleme häufiger aktiv angehen und ihnen seltener ausweichen (Nes und Segerstrom 2006). Und sie passen ihr Vorgehen eher an das an, was die jeweilige Lage verlangt. Das ist der realistische Teil.</p>
      <h4>Was er für die Gesundheit bedeutet</h4>
      <p>In einer Übersichtsarbeit über 15 Studien mit rund 229.000 Menschen war Optimismus mit einem um 35&nbsp;% geringeren Risiko für Herz-Kreislauf-Ereignisse wie Herzinfarkt und Schlaganfall verbunden (Rozanski u. a. 2019). In zwei großen Langzeitstudien lebten die optimistischsten Frauen im Schnitt knapp 15&nbsp;% länger als die am wenigsten optimistischen, bei Männern war es ähnlich (Lee u. a. 2019). Das sind Zusammenhänge und noch kein Beweis, dass Optimismus allein gesund macht. Die Forschenden halten Optimismus aber für veränderbar, also für etwas, das sich üben lässt.</p>
      <h4>Warum nicht einfach positiv denken?</h4>
      <p>Reines Wunschdenken kann sogar bremsen. Die Psychologin Gabriele Oettingen hat Menschen über Wochen bis zu zwei Jahre begleitet, etwa bei der Jobsuche oder nach einer Hüftoperation. Wer sich die Zukunft vor allem in schönen Tagträumen ausmalte, strengte sich weniger an und kam schlechter voran. Wer dagegen erwartete, dass es wahrscheinlich klappt, hatte mehr Erfolg (Oettingen und Mayer 2002). Realistischer Optimismus heißt deshalb, das Ziel im Blick zu behalten und die Hindernisse auf dem Weg ehrlich zu benennen.</p>
      <h4>So übst du es im Alltag</h4>
      <p>Wenn dich eine Nachricht beunruhigt, frag dich zuerst: Wie ist die Lage wirklich, und wie hat sie sich entwickelt? Und dann: Was kann ich selbst beitragen, und sei es noch so wenig? Achtsamkeit hilft, den Moment zu bemerken, in dem dein Kopf dramatisiert. Genau dort beginnt ein realistischer Blick.</p>
      <p class="klein">Quellen: <a href="https://pubmed.ncbi.nlm.nih.gov/11315251/" target="_blank" rel="noopener">Schneider 2001</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/16859439/" target="_blank" rel="noopener">Nes und Segerstrom 2006</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/31560385/" target="_blank" rel="noopener">Rozanski u. a. 2019</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/31451635/" target="_blank" rel="noopener">Lee u. a. 2019</a> · <a href="https://pubmed.ncbi.nlm.nih.gov/12416922/" target="_blank" rel="noopener">Oettingen und Mayer 2002</a> · Lazarus und Folkman, „Stress, Appraisal, and Coping“ (1984) · Rosling, „Factfulness“ (2018)</p>
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
          try { await navigator.share({ title: document.title, text: `Mein Weltbild: ${einordnung(e).titel.toLowerCase()}, ${e.richtig} von ${Q.fragen.length} richtig. Wie realistisch ist deins?`, url }); } catch { /* abgebrochen */ }
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

  // Start von der Startseite: Antwort auf die Einstiegsfrage steckt in #weltbild=0|1|2, weiter direkt mit Frage 1
  const start = location.hash.match(/^#weltbild=([0-2])$/);
  if (start) {
    weltbild = Number(start[1]);
    schritt = 0;
    history.replaceState(null, "", location.pathname + location.search);
  }
  zeichnen();
  if (start) scrollTo({ top: wurzel.getBoundingClientRect().top + scrollY - 90 });
})();
