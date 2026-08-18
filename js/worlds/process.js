import { updateCaptions } from "../engine/captions.js";
import { driveTrack } from "../engine/scrollDriver.js";

const STAGES = [
  "img/still-valley-wide.webp",
  "img/still-seam-glow.webp",
  "img/still-arches-water.webp",
  "img/still-pavilion-close.webp",
];

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function initProcess() {
  const track = document.getElementById("process-track");
  const canvas = document.getElementById("process-canvas");
  if (!track || !canvas) return;
  const ctx = canvas.getContext("2d");
  const captions = [...track.querySelectorAll(".caption")];

  const images = await Promise.all(STAGES.map(loadImage));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  window.addEventListener("resize", resize);
  resize();

  function drawCover(img, alpha, zoom, px, py) {
    if (!img) return;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.width, ch / img.height) * zoom;
    const w = img.width * s, h = img.height * s;
    const x = (cw - w) / 2 + px, y = (ch - h) / 2 + py;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.globalAlpha = 1;
  }

  const BOUNDS = [0, 0.25, 0.5, 0.75, 1.0];
  const FADE = 0.10;

  driveTrack(track, ({ t, progress, pointer }) => {
    const cw = canvas.width, ch = canvas.height;
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, cw, ch);

    // figure out which stage(s) are active and their blend weight
    let stage = 0;
    for (let i = 0; i < STAGES.length; i++) {
      if (progress >= BOUNDS[i]) stage = i;
    }
    const zoom = 1.06 + Math.sin(t * 0.06) * 0.01 + progress * 0.05;
    const px = pointer.x * 14, py = pointer.y * 8;

    drawCover(images[stage], 1, zoom, px, py);

    // crossfade into next stage near the upper boundary
    const nextBound = BOUNDS[stage + 1];
    if (nextBound !== undefined && images[stage + 1]) {
      const fadeStart = nextBound - FADE;
      if (progress > fadeStart) {
        const a = Math.min(1, (progress - fadeStart) / FADE);
        drawCover(images[stage + 1], a, zoom, px, py);
      }
    }

    updateCaptions(captions, progress);
  });
}
