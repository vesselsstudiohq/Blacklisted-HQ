/**
 * The polished chrome asterisk, pre-rendered in Blender (Cycles) as a 72-frame transparent spin.
 * Replaces a runtime three.js scene: same model, better reflections, near-zero main-thread cost
 * (three.js parse + shader compile alone blew the 200 ms TBT budget under Lighthouse throttling).
 */
export const SPIN_FRAMES = 72;
/** Share of the sprite's width the asterisk occupies when facing the camera (measured on frame 1). */
export const SPIN_FILL = 0.829;

export interface ChromeSpin {
  /** Draw the spin at `turn` (0..1 = one revolution), blending the two nearest frames. */
  draw(turn: number): void;
}

const cache: { frames?: Promise<HTMLImageElement[]> } = {};
function frames() {
  cache.frames ??= Promise.all(
    Array.from(
      { length: SPIN_FRAMES },
      (_, i) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = `/media/chrome-spin/${String(i + 1).padStart(3, "0")}.webp`;
        }),
    ),
  );
  return cache.frames;
}

export async function loadChromeSpin(canvas: HTMLCanvasElement): Promise<ChromeSpin> {
  const imgs = await frames();
  const ctx = canvas.getContext("2d")!;
  canvas.width = imgs[0].naturalWidth;
  canvas.height = imgs[0].naturalHeight;
  let last = -1;
  return {
    draw(turn) {
      const f = (((turn % 1) + 1) % 1) * SPIN_FRAMES;
      if (Math.abs(f - last) < 0.02) return;
      last = f;
      const i = Math.floor(f) % SPIN_FRAMES;
      const t = f - Math.floor(f);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.drawImage(imgs[i], 0, 0);
      if (t > 0.04) {
        ctx.globalAlpha = t; // 5° apart: a light crossfade reads as motion, not as steps
        ctx.drawImage(imgs[(i + 1) % SPIN_FRAMES], 0, 0);
        ctx.globalAlpha = 1;
      }
    },
  };
}

/** A slow, continuous turn for a second logo placement (the Visit section); runs only on screen. */
export async function idleSpin(canvas: HTMLCanvasElement, secondsPerTurn = 7) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    (await loadChromeSpin(canvas)).draw(0);
    return;
  }
  const spin = await loadChromeSpin(canvas);
  let visible = false;
  let turn = 0;
  let last = performance.now();
  const tick = (now: number) => {
    turn += (now - last) / 1000 / secondsPerTurn;
    last = now;
    spin.draw(turn);
    if (visible) requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    const was = visible;
    visible = e.isIntersecting;
    if (visible && !was) {
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }).observe(canvas);
  spin.draw(0);
}
