/**
 * Touch screens have no cursor, but the names section is driven by where the pointer sits on a word.
 * This shows a small sphere under the finger from the first touch frame and removes it on the very
 * frame the finger lifts (no fade), so it reads as a cursor that only exists while you touch.
 * Touch events, not pointer events: pointer events stop as soon as the page starts scrolling.
 */
export function initTouchCursor() {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  const dot = document.createElement("div");
  dot.setAttribute("aria-hidden", "true");
  dot.className =
    "pointer-events-none fixed top-0 left-0 z-[70] hidden size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bone/70 bg-radial-[at_35%_30%] from-bone/90 via-moss/70 to-meadow/80 shadow-[0_2px_10px_rgb(13_20_17/0.5)]";
  document.body.append(dot);
  const at = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    dot.style.transform = `translate3d(${t.clientX}px, ${t.clientY}px, 0)`;
    dot.classList.remove("hidden");
  };
  const off = () => dot.classList.add("hidden");
  window.addEventListener("touchstart", at, { passive: true });
  window.addEventListener("touchmove", at, { passive: true });
  window.addEventListener("touchend", off, { passive: true });
  window.addEventListener("touchcancel", off, { passive: true });
}
