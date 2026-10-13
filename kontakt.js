// Schickt Kontakt- und Anmeldeformulare ohne Seitenwechsel ab. Ohne JavaScript funktioniert es trotzdem
// (normaler POST, Web3Forms leitet danach auf /danke/ bzw. /angemeldet/ weiter).
// data-erfolg: eigener Danke-Text; data-danach: id eines Blocks, der nach dem Absenden erscheint (z. B. Kalender).
// Links wie /?anliegen=Feedback%20zu%20einem%20Artikel&nachricht=...#kontakt füllen das Formular vor.
const vorgaben = new URLSearchParams(location.search);

document.querySelectorAll("form[data-kontakt]").forEach((formular) => {
  const anliegen = formular.querySelector("select[name=Anliegen]");
  const option = anliegen && [...anliegen.options].find((o) => o.text === vorgaben.get("anliegen"));
  if (option) anliegen.value = option.value;
  const nachricht = formular.querySelector("textarea[name=message]");
  if (nachricht && vorgaben.get("nachricht") && !nachricht.value) nachricht.value = vorgaben.get("nachricht");

  const status = formular.querySelector(".status");
  const knopf = formular.querySelector("button[type=submit]");
  formular.addEventListener("submit", async (ereignis) => {
    ereignis.preventDefault();
    knopf.disabled = true;
    status.className = "status";
    status.textContent = "Wird gesendet …";
    try {
      const antwort = await fetch(formular.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(formular),
      });
      const daten = await antwort.json();
      if (!antwort.ok || !daten.success) throw new Error(daten.message || antwort.status);
      formular.reset();
      status.classList.add("ok");
      status.textContent = formular.dataset.erfolg || "Danke! Deine Nachricht ist angekommen. Ich melde mich persönlich bei dir.";
      const danach = formular.dataset.danach && document.getElementById(formular.dataset.danach);
      if (danach) { danach.hidden = false; danach.scrollIntoView({ block: "nearest" }); }
    } catch (fehler) {
      status.classList.add("fehler");
      status.textContent = "Das hat leider nicht geklappt. Bitte versuch es gleich noch einmal oder schreib mir über LinkedIn.";
    } finally {
      knopf.disabled = false;
    }
  });
});
