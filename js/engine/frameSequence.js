/**
 * FrameSequence — canvas WebP image-sequence scrubber.
 * Scroll position (mapped from a tall "track" element) drives which frame
 * is drawn. Frame blobs are fetched up front (small, compressed); only a
 * sliding window around the playhead is decoded to ImageBitmaps so RAM
 * stays sane on mobile. A time-based lerp smooths fast flicks.
 *
 * Adapted from the scroll-site-generator skill's proven vanilla engine,
 * generalized to run multiple independent instances on one page.
 */
export class FrameSequence {
  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.track - tall element whose scroll range maps to [0,1]
   * @param {string} opts.manifestUrl - relative path to manifest.json {count, pattern}
   * @param {string} opts.baseUrl - directory the pattern is relative to
   * @param {(p:number)=>void} [opts.onProgress] - called every tick with raw progress [0,1]
   * @param {number} [opts.fillAlpha] - contain-fit scale multiplier (default 1.02, hides letterbox seam)
   * @param {string} [opts.bgColor]
   */
  constructor({ canvas, track, manifestUrl, baseUrl, onProgress, fillAlpha = 1.02, bgColor = "#050505" }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.track = track;
    this.manifestUrl = manifestUrl;
    this.baseUrl = baseUrl;
    this.onProgress = onProgress;
    this.fillAlpha = fillAlpha;
    this.bgColor = bgColor;

    this.blobs = [];
    this.bitmaps = new Map();
    this.decoding = new Set();
    this.count = 0;
    this.pattern = "";
    this.current = -1;
    this.target = 0;
    this.smooth = 0;
    this.dir = 1;
    this.ready = false;
    this.destroyed = false;

    this.KEEP = 100;
    this.AHEAD = 26;

    this._resize = this._resize.bind(this);
    this._tick = this._tick.bind(this);
    window.addEventListener("resize", this._resize);
    this._resize();
  }

  async load() {
    try {
      const res = await fetch(this.manifestUrl);
      const m = await res.json();
      this.count = m.count;
      this.pattern = m.pattern;
      this.blobs = new Array(m.count).fill(null);
      requestAnimationFrame(this._tick);

      const EAGER = Math.min(Math.ceil(m.count * 0.3), 60);
      let done = 0;
      await Promise.all(
        Array.from({ length: EAGER }, (_, i) =>
          this._fetchBlob(i).then(() => { done++; this._onLoadProgress?.(done / EAGER); })
        )
      );
      await this._decode(0);
      this.ready = true;
      this._onReady?.();

      let next = EAGER;
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (next < this.count) {
            const i = next++;
            try { await this._fetchBlob(i); } catch { /* retried on demand */ }
          }
        })
      );
    } catch (e) {
      console.warn("[FrameSequence] failed to load", this.manifestUrl, e);
    }
  }

  onLoadProgress(fn) { this._onLoadProgress = fn; return this; }
  onReady(fn) { this._onReady = fn; return this; }

  _frameURL(i) {
    return this.baseUrl + this.pattern.replace("%04d", String(i + 1).padStart(4, "0"));
  }

  async _fetchBlob(i) {
    if (this.blobs[i]) return this.blobs[i];
    const res = await fetch(this._frameURL(i));
    this.blobs[i] = await res.blob();
    return this.blobs[i];
  }

  async _decode(i) {
    if (this.bitmaps.has(i) || this.decoding.has(i) || !this.blobs[i]) return;
    this.decoding.add(i);
    try {
      const bmp = await createImageBitmap(this.blobs[i]);
      this.bitmaps.set(i, bmp);
    } catch { /* fallback: skip, retried next tick */ }
    this.decoding.delete(i);
  }

  _manageWindow(center) {
    for (let d = 0; d <= this.AHEAD; d++) {
      const fwd = center + d * this.dir;
      const back = center - Math.min(d, 8) * this.dir;
      if (fwd >= 0 && fwd < this.count) this._decode(fwd);
      if (back >= 0 && back < this.count) this._decode(back);
    }
    if (this.bitmaps.size > this.KEEP * 2) {
      for (const [idx, bmp] of this.bitmaps) {
        if (Math.abs(idx - center) > this.KEEP) {
          bmp.close();
          this.bitmaps.delete(idx);
        }
      }
    }
  }

  _nearestDecoded(i) {
    if (this.bitmaps.has(i)) return i;
    for (let d = 1; d < this.count; d++) {
      if (this.bitmaps.has(i - d)) return i - d;
      if (this.bitmaps.has(i + d)) return i + d;
    }
    return -1;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.current = -1;
  }

  _drawFrame(i) {
    const j = this._nearestDecoded(i);
    if (j < 0) return;
    const bmp = this.bitmaps.get(j);
    const cw = this.canvas.width, ch = this.canvas.height;
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, cw, ch);
    // portrait / narrow viewports (mobile): cover-fit so there's no letterbox
    // seam to hide — the vignette is tuned for landscape contain-fit only.
    const isPortrait = ch / cw > 1.05;
    const s = (isPortrait ? Math.max(cw / bmp.width, ch / bmp.height) : Math.min(cw / bmp.width, ch / bmp.height)) * this.fillAlpha;
    const w = bmp.width * s, h = bmp.height * s;
    this.ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h);
    this.current = j;
  }

  /** progress ∈ [0,1] from the track's scroll range */
  progress() {
    const rect = this.track.getBoundingClientRect();
    const max = this.track.offsetHeight - window.innerHeight;
    if (max <= 0) return 0;
    const scrolled = -rect.top;
    return Math.min(1, Math.max(0, scrolled / max));
  }

  _tick(now) {
    if (this.destroyed) return;
    if (!this._lastT) this._lastT = now;
    const dt = Math.min((now - this._lastT) / 1000, 0.5) || 0.016;
    this._lastT = now;

    if (this.ready) {
      const p = this.progress();
      const prevTarget = this.target;
      this.target = p * (this.count - 1);
      if (this.target !== prevTarget) this.dir = this.target >= prevTarget ? 1 : -1;
      const k = 1 - Math.exp(-dt * 14);
      this.smooth += (this.target - this.smooth) * k;
      if (Math.abs(this.target - this.smooth) < 0.5) this.smooth = this.target;
      const i = Math.round(this.smooth);
      this._manageWindow(i);
      if (i !== this.current) this._drawFrame(i);
      this.onProgress?.(p);
    }
    requestAnimationFrame(this._tick);
  }

  destroy() {
    this.destroyed = true;
    window.removeEventListener("resize", this._resize);
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();
  }
}
