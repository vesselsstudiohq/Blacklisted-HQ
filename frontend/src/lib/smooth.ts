import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Lenis feeding ScrollTrigger — the scrub reads as one gimbal move. Off for reduced motion. */
export function initSmooth(): Lenis | null {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

/** Content is visible by default; this only adds the rise when motion is allowed. */
export function initReveals() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((group) => {
    const items = group.querySelectorAll<HTMLElement>("[data-reveal-item]");
    gsap.from(items.length ? items : [group], {
      y: 24,
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
      stagger: 0.08,
      scrollTrigger: { trigger: group, start: "top 80%", once: true },
    });
  });
}
