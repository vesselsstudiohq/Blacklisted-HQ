import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { FrameStore } from "./frames";

gsap.registerPlugin(ScrollTrigger);

/** Omni eased into the shot: frames 0–48 barely move. Give them only the first 6% of the walk. */
export function remap(q: number, count: number): number {
  const slow = 48;
  const share = 0.06;
  if (q < share) return (q / share) * slow;
  return slow + ((q - share) / (1 - share)) * (count - 1 - slow);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

interface ScrubEls {
  section: HTMLElement;
  canvas: HTMLCanvasElement;
  lights: HTMLElement;
  intro: HTMLElement[];
  dock: HTMLElement | null;
}

/** Pinned scroll-scrub: 91% of the pin walks the 240 frames, the last 9% is a short "lights out". */
export function initScrub(store: FrameStore, els: ScrubEls) {
  const ctx = els.canvas.getContext("2d", { alpha: false })!;
  let current = 0;
  let drawn = -1;

  // The video generators' marks sat in the bottom-right of every frame: desktop 16:9 at 90.6% / 83.4%
  // (plus a second mark that slid off the right edge in the first ~60 frames), mobile 9:16 at
  // 83.3% / 90.7%. They are blurred out of the frames; the glass tile covers that whole corner.
  const MARK = store.set === "m" ? { fw: 9, fh: 16, x: 0.833, y: 0.907 } : { fw: 16, fh: 9, x: 0.93, y: 0.85 };
  const pinDock = () => {
    const dock = els.dock;
    if (!dock) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const s = Math.max(W / MARK.fw, H / MARK.fh);
    const cx = (W - MARK.fw * s) / 2 + MARK.x * MARK.fw * s;
    const cy = (H - MARK.fh * s) / 2 + MARK.y * MARK.fh * s;
    const w = dock.offsetWidth;
    const h = dock.offsetHeight;
    const m = 12;
    gsap.set(dock, {
      left: Math.min(Math.max(cx - w / 2, m), W - w - m),
      top: Math.min(Math.max(cy - h / 2, m), H - h - m),
    });
  };

  const resize = () => {
    pinDock();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    els.canvas.width = Math.round(window.innerWidth * dpr);
    els.canvas.height = Math.round(window.innerHeight * dpr);
    drawn = -1;
    render();
  };

  const render = () => {
    const img = store.nearest(current);
    if (!img) return;
    const key = Math.round(current);
    if (key === drawn && img.complete) return;
    drawCover(ctx, img, els.canvas.width, els.canvas.height);
    drawn = key;
  };

  const st = ScrollTrigger.create({
    trigger: els.section,
    start: "top top",
    end: "+=440%",
    pin: true,
    scrub: 0.6,
    onUpdate(self) {
      const p = self.progress;
      const walk = Math.min(p / 0.91, 1);
      current = remap(walk, store.count);
      render();
      const lights = p <= 0.91 ? 0 : (p - 0.91) / 0.09; // a short fade, not a screen of dead dark
      gsap.set(els.lights, { opacity: lights });
      if (els.dock) gsap.set(els.dock, { autoAlpha: 1 - lights }); // nothing to cover once the frames go dark
      const fade = 1 - Math.min(p / 0.04, 1);
      els.intro.forEach((el) => gsap.set(el, { opacity: fade }));
    },
  });

  // Late frames keep arriving after the first pass: repaint when idle so the canvas sharpens.
  const sharpen = window.setInterval(() => {
    drawn = -1;
    render();
  }, 500);

  window.addEventListener("resize", resize);
  resize();
  return () => {
    st.kill();
    window.clearInterval(sharpen);
    window.removeEventListener("resize", resize);
  };
}
