// Hell/Dunkel-Umschalter und Handy-Menü (Website und App).
// Ohne eigene Wahl folgt die Seite der Einstellung des Geräts. Die Wahl bleibt nur in diesem Browser (kein Cookie).
// Das Setzen von data-thema passiert schon im <head> (Inline-Skript), damit nichts aufblitzt.
(() => {
  const SCHLUESSEL = "phoenix-feder-thema";
  const wurzel = document.documentElement;
  const geraetDunkel = window.matchMedia("(prefers-color-scheme: dark)");
  const istDunkel = () => (wurzel.dataset.thema ? wurzel.dataset.thema === "dunkel" : geraetDunkel.matches);

  function anzeigen() {
    const dunkel = istDunkel();
    document.querySelectorAll("[data-thema-knopf]").forEach((k) => {
      k.setAttribute("aria-pressed", String(dunkel));
      k.setAttribute("aria-label", dunkel ? "Helles Design einschalten" : "Dunkles Design einschalten");
      k.title = k.getAttribute("aria-label");
    });
    const farbe = getComputedStyle(wurzel).getPropertyValue("--grund").trim();
    if (farbe) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", farbe));
  }

  document.querySelectorAll("[data-thema-knopf]").forEach((k) => {
    k.hidden = false;
    k.addEventListener("click", () => {
      const neu = istDunkel() ? "hell" : "dunkel";
      wurzel.dataset.thema = neu;
      try { localStorage.setItem(SCHLUESSEL, neu); } catch { /* privates Fenster: gilt dann nur für diese Seite */ }
      anzeigen();
    });
  });
  geraetDunkel.addEventListener?.("change", anzeigen);
  anzeigen();

  // Handy-Menü: Knopf klappt die Navigation auf; Escape oder ein Klick daneben schließt sie
  const kopf = document.querySelector(".kopf");
  const menue = document.querySelector("[data-menue-knopf]");
  if (kopf && menue) {
    const setzen = (offen) => { kopf.classList.toggle("offen", offen); menue.setAttribute("aria-expanded", String(offen)); };
    menue.addEventListener("click", () => setzen(!kopf.classList.contains("offen")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setzen(false); });
    document.addEventListener("click", (e) => { if (!kopf.contains(e.target)) setzen(false); });
    kopf.querySelectorAll(".navi a").forEach((a) => a.addEventListener("click", () => setzen(false)));
  }
})();
