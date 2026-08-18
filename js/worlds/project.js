import { FrameSequence } from "../engine/frameSequence.js";
import { updateCaptions } from "../engine/captions.js";

export function initProject() {
  const track = document.getElementById("project-track");
  const canvas = document.getElementById("project-canvas");
  const captions = [...track.querySelectorAll(".caption")];

  const seq = new FrameSequence({
    canvas, track,
    manifestUrl: "frames/project/manifest.json",
    baseUrl: "frames/project/",
    onProgress: (p) => updateCaptions(captions, p),
  });
  seq.load();
  return seq;
}
