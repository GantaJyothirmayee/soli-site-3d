import { FrameSequence } from "../engine/frameSequence.js";
import { updateCaptions, bindScrollCue } from "../engine/captions.js";
import { ParticleField } from "../engine/particles.js";
import { updatePointer } from "../engine/pointer.js";

export function initHero({ onProgress: reportGlobal, onLoadProgress, onReady } = {}) {
  const track = document.getElementById("hero-track");
  const canvas = document.getElementById("hero-canvas");
  const captions = [...track.querySelectorAll(".caption")];
  const cue = document.getElementById("scroll-cue");

  const seq = new FrameSequence({
    canvas, track,
    manifestUrl: "frames/hero/manifest.json",
    baseUrl: "frames/hero/",
    onProgress: (p) => {
      updateCaptions(captions, p);
      reportGlobal?.(p);
    },
  });

  bindScrollCue(track, cue);

  const fx = document.getElementById("hero-fx");
  let field = null;
  if (fx && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    field = new ParticleField(fx, { count: 160, colors: ["#70fbff", "#ac7de6", "#eba6fc"], spread: 0.9, size: 0.085, speed: 0.015, parallax: 0.5 });
    const clock = { t: 0, last: performance.now() };
    const loop = (now) => {
      const dt = (now - clock.last) / 1000; clock.last = now; clock.t += dt;
      const p = updatePointer();
      field.update(clock.t, p.x, p.y);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  if (onLoadProgress) seq.onLoadProgress(onLoadProgress);
  seq.onReady(() => {
    onReady?.();
    const h1 = document.getElementById("hero-h1");
    if (h1 && window.gsap) {
      window.gsap.fromTo(h1, { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, ease: "power3.out", delay: 0.15 });
    }
  });
  seq.load();
  return seq;
}
