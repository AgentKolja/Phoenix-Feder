// Kleine Extras ohne Tracking: Impuls für heute, Teilen, Quest-Fortschritt, Sprungziele öffnen.
// Ohne JavaScript bleibt alles lesbar; die Knöpfe dafür sind dann ausgeblendet.
(() => {
  const speicher = {
    lesen(schluessel, standard) {
      try { return JSON.parse(localStorage.getItem(schluessel)) ?? standard; } catch { return standard; }
    },
    schreiben(schluessel, wert) {
      try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privater Modus: dann eben nicht */ }
    },
  };

  // Impuls für heute: jeden Tag ein anderer, auf Wunsch ein neuer
  const karte = document.querySelector("[data-impuls]");
  const daten = document.getElementById("impuls-daten");
  if (karte && daten) {
    const monat = new Date().getMonth() + 1;
    const liste = JSON.parse(daten.textContent).filter((u) => !u.m || u.m.includes(monat));
    const feld = (name) => karte.querySelector(`[data-feld="${name}"]`);
    const appBasis = feld("app").getAttribute("href").split("#")[0];
    let index = Math.floor(Date.now() / 864e5) % liste.length;
    const zeigen = () => {
      const u = liste[index];
      feld("art").textContent = u.a;
      feld("emoji").textContent = u.e;
      feld("titel").textContent = u.t;
      feld("kurz").textContent = u.k;
      feld("app").setAttribute("href", `${appBasis}#idee=${u.s}`);
    };
    zeigen();
    const neu = karte.querySelector("[data-neu]");
    neu.hidden = false;
    neu.addEventListener("click", () => {
      let naechster = index;
      while (liste.length > 1 && naechster === index) naechster = Math.floor(Math.random() * liste.length);
      index = naechster;
      zeigen();
      karte.classList.remove("blaettern");
      void karte.offsetWidth; // Animation neu starten
      karte.classList.add("blaettern");
    });
  }

  // Teilen: Teilen-Menü des Handys, sonst Link kopieren
  document.querySelectorAll("[data-teilen]").forEach((knopf) => {
    knopf.hidden = false;
    knopf.addEventListener("click", async () => {
      if (navigator.share) {
        try { await navigator.share({ title: document.title, url: location.href }); } catch { /* abgebrochen */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(location.href);
        knopf.textContent = knopf.dataset.kopiert;
      } catch { /* Zwischenablage gesperrt */ }
    });
  });

  // Quests abhaken: Fortschritt bleibt nur in diesem Browser
  const fortschritt = document.querySelector("[data-fortschritt]");
  if (fortschritt) {
    const SCHLUESSEL = "phoenix-feder-quests";
    const erledigt = new Set(speicher.lesen(SCHLUESSEL, []));
    const boxen = [...document.querySelectorAll("input[data-quest]")];
    const zeigen = () => {
      const anzahl = boxen.filter((b) => b.checked).length;
      fortschritt.querySelector("[data-erledigt]").textContent = anzahl;
      fortschritt.querySelector("[data-xp]").textContent = anzahl * 10;
      fortschritt.querySelector("[data-level]").textContent = Math.floor(anzahl / 5) + 1;
      fortschritt.querySelector("[data-balken]").style.width = `${(100 * anzahl) / boxen.length}%`;
    };
    boxen.forEach((box) => {
      const karteQuest = box.closest(".uebung");
      box.checked = erledigt.has(box.dataset.quest);
      karteQuest.classList.toggle("geschafft", box.checked);
      box.closest("label").hidden = false;
      box.addEventListener("change", () => {
        if (box.checked) erledigt.add(box.dataset.quest);
        else erledigt.delete(box.dataset.quest);
        karteQuest.classList.toggle("geschafft", box.checked);
        speicher.schreiben(SCHLUESSEL, [...erledigt]);
        zeigen();
      });
    });
    fortschritt.hidden = false;
    zeigen();
  }

  // Alte Sprungziele wie /gewohnheiten/#waldbaden: Übung und eingeklappte Liste öffnen
  const oeffnen = () => {
    const ziel = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const details = ziel && (ziel.matches("details") ? ziel : ziel.querySelector("details") || ziel.closest("details"));
    if (!details) return;
    details.open = true;
    for (let d = details.parentElement?.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
    ziel.scrollIntoView({ block: "start" });
  };
  oeffnen();
  addEventListener("hashchange", oeffnen);
})();
