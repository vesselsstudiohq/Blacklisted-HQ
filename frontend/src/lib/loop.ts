import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface LoopEls {
  toggles: HTMLButtonElement[];
  list: HTMLElement;
  stage: HTMLElement;
  ring: HTMLElement;
  slides: HTMLElement[];
  slots: HTMLElement[];
}

/**
 * LIST / LOOP for The Blacklist. LOOP puts every product on a 3D ring (the KIRO loop reference):
 * it turns on its own, scrolling speeds it up, the cursor tilts it, and the gaps show the far side.
 * Runs only while the loop is shown and on screen.
 */
export function initLoop(els: LoopEls) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const n = els.slides.length;
  let radius = 0;
  let angle = 0;
  let boost = 0;
  let tiltX = 0;
  let tiltY = 0;
  let active = false;
  let onScreen = false;

  const layout = () => {
    const w = els.slides[0].offsetWidth;
    const gap = w * 0.14;
    radius = (w + gap) / (2 * Math.tan(Math.PI / n));
    // Rotate first, then push out: GSAP always composes translate before rotate, which would stack
    // every card in one spot, so each slot gets its ring placement as a plain transform string.
    els.slots.forEach((slot, i) => (slot.style.transform = `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`));
  };

  const tick = (_: number, dt: number) => {
    if (!active || !onScreen) return;
    const v = ScrollTrigger.getAll()[0]?.getVelocity?.() ?? 0;
    boost += (Math.min(Math.abs(v) / 40, 60) - boost) * 0.08;
    angle -= (reduced ? 0 : 9 + boost) * (dt / 1000);
    gsap.set(els.ring, { rotateY: angle, rotateX: -6 + tiltY, rotateZ: tiltX, z: -radius * 0.55 });
  };
  gsap.ticker.add(tick);

  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting)).observe(els.stage);
  els.stage.addEventListener("pointermove", (e) => {
    const r = els.stage.getBoundingClientRect();
    tiltX = ((e.clientX - r.left) / r.width - 0.5) * 6;
    tiltY = -((e.clientY - r.top) / r.height - 0.5) * 14;
  });
  els.stage.addEventListener("pointerleave", () => {
    tiltX = 0;
    tiltY = 0;
  });

  // The swap itself is instant; animation only dresses the entrance. (Before, the swap waited on an
  // exit tween's onComplete, so anything that interrupted it left the toggle stuck.)
  const show = (view: "list" | "loop") => {
    els.toggles.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.blView === view)));
    if (view === "loop" && !active) {
      active = true;
      els.list.classList.add("hidden");
      els.stage.classList.remove("hidden");
      layout();
      gsap.fromTo(els.slides, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: "power3.out", stagger: 0.03, overwrite: true });
      ScrollTrigger.refresh();
    } else if (view === "list" && active) {
      active = false;
      els.stage.classList.add("hidden");
      els.list.classList.remove("hidden");
      gsap.fromTo(els.list, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", overwrite: true });
      ScrollTrigger.refresh();
    }
  };
  els.toggles.forEach((t) => t.addEventListener("click", () => show(t.dataset.blView as "list" | "loop")));
  window.addEventListener("resize", () => active && layout());
}
