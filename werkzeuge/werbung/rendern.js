// Rendert die von erzeugen.py geschriebenen Seiten: Bilder, Plakat-PDF und Kurzvideo (Einzelbilder → ffmpeg).
const { chromium } = require(process.env.PW || "playwright");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ziel = process.argv[2];
const datei = (name) => "file://" + path.join(ziel, `_${name}.html`);
const FPS = 25;
const SEKUNDEN = 12;

async function bereit(seite) {
  await seite.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; }))));
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });

  for (const [name, breite, hoehe, aus] of [["beitrag", 1080, 1350, "instagram-beitrag.png"], ["story", 1080, 1920, "story-status.png"]]) {
    const seite = await browser.newPage({ viewport: { width: breite, height: hoehe } });
    await seite.goto(datei(name));
    await bereit(seite);
    await seite.screenshot({ path: path.join(ziel, aus) });
    await seite.close();
    console.log("✓", aus);
  }

  const plakat = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2 });
  await plakat.goto(datei("plakat"));
  await bereit(plakat);
  await plakat.pdf({ path: path.join(ziel, "plakat-a4.pdf"), format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await plakat.screenshot({ path: path.join(ziel, "plakat-a4.png") });
  await plakat.close();
  console.log("✓ plakat-a4.pdf");

  if (!process.env.FFMPEG) {
    console.log("Kein ffmpeg gefunden (pip install imageio-ffmpeg) – Kurzvideo übersprungen.");
  } else {
    const ordner = fs.mkdtempSync(path.join(ziel, "_bilder-"));
    const video = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await video.goto(datei("video"));
    await bereit(video);
    for (let i = 0; i < FPS * SEKUNDEN; i++) {
      await video.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), (i * 1000) / FPS);
      await video.screenshot({ path: path.join(ordner, `${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    }
    await video.close();
    execFileSync(process.env.FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(ordner, "%04d.jpg"),
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", path.join(ziel, "kurzvideo.mp4")]);
    fs.rmSync(ordner, { recursive: true, force: true });
    console.log("✓ kurzvideo.mp4");
  }
  await browser.close();
})();
