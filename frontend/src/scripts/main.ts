import { loadFrames } from "../lib/frames";
import { initScrub } from "../lib/scrub";
import { createProgress, finishLoader } from "../lib/loader";
import { initSmooth, initReveals } from "../lib/smooth";
import { initBlacklist } from "../lib/blacklist";
import { idleSpin } from "../lib/chromeSpin";
import { initLoop } from "../lib/loop";
import { initTouchCursor } from "../lib/touchCursor";
import { categories } from "../data/products";
import { site } from "../data/site";

declare global {
  interface Window {
    VesselsGlass?: { mount: (root?: Element) => void; monitor: (o?: object) => void };
  }
}

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const $$ = <T extends Element>(sel: string) => Array.from(document.querySelectorAll<T>(sel));

const loaderEls = {
  root: $<HTMLElement>("#loader"),
  svg: $<SVGSVGElement>("#loader-asterisk"),
  arms: $$("#loader-asterisk .ast-arm"),
  percent: $<HTMLElement>("#loader-percent"),
  credit: document.querySelector<HTMLElement>(".loader-credit"),
  canvas: $<HTMLCanvasElement>("#asterisk-canvas"),
  particles: $<HTMLCanvasElement>("#loader-particles"),
  navSlot: $<HTMLElement>("#nav-logo"),
  navImg: $<HTMLElement>("#nav-logo-img"),
};

// Desktop (mouse + keyboard) gets the full Google Maps address; phones keep Sid's short link.
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  $$<HTMLAnchorElement>("a[data-maps-desktop]").forEach((a) => (a.href = a.dataset.mapsDesktop!));
}

const progress = createProgress(loaderEls);
initTouchCursor();
const idle = (fn: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => fn(), { timeout: 1500 });
  else setTimeout(fn, 200);
};

// Start streaming frames only once the poster frame (the LCP image) has painted, so the
// low-priority frames never compete with it for bandwidth.
const poster = $<HTMLImageElement>("#hero picture img");
const posterReady = poster.complete
  ? Promise.resolve()
  : new Promise<void>((r) => {
      poster.addEventListener("load", () => r(), { once: true });
      poster.addEventListener("error", () => r(), { once: true });
    });

posterReady
  .then(() => {
    const store = loadFrames(site.heroFrames, progress.set);
    return store.firstPass.then(() => store);
  })
  .then(async (store) => {
    initSmooth();
    initScrub(store, {
      section: $<HTMLElement>("#hero"),
      canvas: $<HTMLCanvasElement>("#hero-canvas"),
      lights: $<HTMLElement>("#lights-out"),
      intro: $$<HTMLElement>("[data-hero-intro]"),
      dock: $<HTMLElement>("#hero-dock"),
    });
    // Below-the-fold work runs in idle time, in small tasks (TBT budget).
    idle(() =>
      initBlacklist(categories, {
        rows: $$<HTMLButtonElement>(".bl-row"),
        card: $<HTMLElement>("#bl-card"),
        canvas: $<HTMLCanvasElement>("#bl-canvas"),
        label: $<HTMLElement>("#bl-label"),
        meta: $<HTMLElement>("#bl-meta"),
      }),
    );
    idle(() =>
      initLoop({
        toggles: $$<HTMLButtonElement>("[data-bl-view]"),
        list: $<HTMLElement>("#bl-list"),
        stage: $<HTMLElement>("#bl-loop"),
        ring: $<HTMLElement>("#bl-ring"),
        slides: $$<HTMLElement>(".bl-slide"),
        slots: $$<HTMLElement>(".bl-slot"),
      }),
    );
    idle(initReveals);
    // Mount only the glass seen at reveal (hero tile, nav) while the loader still covers the page;
    // everything below the fold mounts after the loader, outside the critical window.
    idle(() => {
      window.VesselsGlass?.mount($("#hero"));
      window.VesselsGlass?.mount($("header"));
    });
    await progress.done;
    await finishLoader(loaderEls);
    idle(() => void idleSpin($<HTMLCanvasElement>("#visit-spin")));
    idle(() => {
      window.VesselsGlass?.mount($("#blacklist"));
      window.VesselsGlass?.mount($("#visit"));
      window.VesselsGlass?.monitor();
    });
  });
