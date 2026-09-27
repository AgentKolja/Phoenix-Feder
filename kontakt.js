// Schickt das Kontaktformular ohne Seitenwechsel ab. Ohne JavaScript funktioniert es trotzdem
// (normaler POST, Web3Forms leitet danach auf /danke/ weiter).
document.querySelectorAll("form[data-kontakt]").forEach((formular) => {
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
      status.textContent = "Danke! Deine Nachricht ist angekommen. Ich melde mich persönlich bei dir.";
    } catch (fehler) {
      status.classList.add("fehler");
      status.textContent = "Das hat leider nicht geklappt. Bitte versuch es gleich noch einmal oder schreib mir über LinkedIn.";
    } finally {
      knopf.disabled = false;
    }
  });
});
