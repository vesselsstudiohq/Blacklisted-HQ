import { gsap } from "gsap";
import { loadChromeSpin, SPIN_FILL } from "./chromeSpin";
import { nanoDissolve } from "./dissolve";

interface LoaderEls {
  root: HTMLElement;
  svg: SVGSVGElement;
  arms: Element[];
  percent: HTMLElement;
  credit: HTMLElement | null;
  canvas: HTMLCanvasElement;
  particles: HTMLCanvasElement;
  navSlot: HTMLElement;
  navImg: HTMLElement;
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Never rush the loader: progress shows at most this fast, even when frames come from cache. */
const MIN_LOAD_MS = 3200;

/**
 * Displayed progress eases toward the real progress but never faster than MIN_LOAD_MS for the full
 * fill; the five arms light in order. `done` resolves when both the frames and the minimum are met.
 */
export function createProgress(els: LoaderEls) {
  let real = 0;
  let shown = 0;
  const start = performance.now();
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));
  const tick = (now: number) => {
    const cap = Math.min((now - start) / MIN_LOAD_MS, 1);
    const target = Math.min(real, cap);
    shown += (target - shown) * 0.08;
    if (target >= 1 && shown > 0.995) shown = 1;
    const on = Math.floor(shown * 5 + 1e-6);
    els.arms.forEach((a, i) => a.classList.toggle("is-on", i < on));
    els.percent.textContent = `${String(Math.round(shown * 100)).padStart(3, "0")}%`;
    if (shown >= 1) resolveDone();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    set: (p: number) => (real = Math.max(real, Math.min(p, 1))),
    done,
  };
}

/** Place the sprite canvas so its asterisk covers `rect` exactly (the sprite has margin round it). */
function cover(canvas: HTMLCanvasElement, rect: DOMRect) {
  const size = rect.width / SPIN_FILL;
  gsap.set(canvas, {
    width: size,
    height: size,
    x: rect.left + rect.width / 2 - size / 2,
    y: rect.top + rect.height / 2 - size / 2,
  });
}

/**
 * The handoff: the filled asterisk crossfades into the chrome model, which turns once in the empty
 * dark space, then flies to the nav. While it travels, the dark screen nano-retracts into it,
 * revealing the hero's first frame. Falls back to a plain fade when motion is off or frames fail.
 */
export async function finishLoader(els: LoaderEls) {
  const done = () => {
    document.documentElement.classList.remove("is-loading");
    els.root.remove();
  };
  const fallback = async () => {
    await gsap.to(els.root, { opacity: 0, duration: 0.6 });
    gsap.set(els.navImg, { opacity: 1 });
    done();
  };

  if (reduced()) return fallback();
  let spin;
  try {
    spin = await loadChromeSpin(els.canvas);
  } catch {
    return fallback();
  }

  const from = els.svg.getBoundingClientRect();
  cover(els.canvas, from);
  const state = { turn: 0 };
  const paint = () => spin.draw(state.turn);
  paint();

  const slot = els.navSlot.getBoundingClientRect();
  const scale = slot.width / from.width;
  const dx = slot.left + slot.width / 2 - (from.left + from.width / 2);
  const dy = slot.top + slot.height / 2 - (from.top + from.height / 2);
  // Where the logo is right now (the flecks stream toward it as it flies).
  const logoCentre = () => {
    const r = els.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const intro = gsap.timeline({ onUpdate: paint });
  intro
    .to(els.svg, { opacity: 0, duration: 0.6, ease: "power1.inOut" })
    .to(els.credit ? [els.percent, els.credit] : els.percent, { opacity: 0, duration: 0.4 }, 0)
    .to(els.canvas, { opacity: 1, duration: 0.6, ease: "power1.inOut" }, 0) // in place: no zoom (Sid)
    .to(state, { turn: 1, duration: 2.6, ease: "sine.inOut" }, 0.5);
  await intro;

  // Hand the dark surface to the dissolve canvas, then fly while it retracts into the logo.
  const retract = nanoDissolve(els.particles, logoCentre, 1.9);
  gsap.set(els.root, { backgroundColor: "transparent" });
  const fly = gsap.to(els.canvas, { x: `+=${dx}`, y: `+=${dy}`, scaleX: scale, scaleY: scale, transformOrigin: "50% 50%", duration: 1.6, ease: "power3.inOut", delay: 0.15 });
  await Promise.all([fly, retract]);
  done();

  // Settled in the nav: re-cover the slot on resize; one spin when the logo is hovered.
  const settle = () => {
    gsap.set(els.canvas, { scaleX: 1, scaleY: 1 }); // both axes: `scale` alone left scaleX behind
    cover(els.canvas, els.navSlot.getBoundingClientRect());
  };
  settle();
  window.addEventListener("resize", settle);
  els.navSlot.addEventListener("mouseenter", () => {
    if (gsap.isTweening(state)) return;
    gsap.fromTo(state, { turn: 0 }, { turn: 1, duration: 1, ease: "power2.inOut", onUpdate: paint });
  });
}
