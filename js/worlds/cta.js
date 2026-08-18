import { FrameSequence } from "../engine/frameSequence.js";
import { updateCaptions } from "../engine/captions.js";
import { ParticleField } from "../engine/particles.js";
import { updatePointer } from "../engine/pointer.js";

export function initCta() {
  const track = document.getElementById("cta-track");
  const canvas = document.getElementById("cta-canvas");
  const captions = [...track.querySelectorAll(".caption")];

  const seq = new FrameSequence({
    canvas, track,
    manifestUrl: "frames/cta/manifest.json",
    baseUrl: "frames/cta/",
    onProgress: (p) => updateCaptions(captions, p),
  });

  const fx = document.getElementById("cta-fx");
  if (fx && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const field = new ParticleField(fx, { count: 90, colors: ["#eba6fc", "#ef669c", "#70fbff"], spread: 0.7, size: 0.065, speed: 0.01, parallax: 0.3 });
    const clock = { t: 0, last: performance.now() };
    const loop = (now) => {
      const dt = (now - clock.last) / 1000; clock.last = now; clock.t += dt;
      const p = updatePointer();
      field.update(clock.t, p.x, p.y);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  seq.load();
  return seq;
}
