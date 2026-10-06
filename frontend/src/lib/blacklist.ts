import { gsap } from "gsap";
import type { Category } from "../data/products";

const COLS = 6;
const ROWS = 8;

/**
 * Renders an image into the card canvas in pixel blocks: a coarse mosaic first, then each block
 * resolves to full detail in random order. Images are cover-cropped to the card's 3:4.
 */
class PixelRender {
  private ctx: CanvasRenderingContext2D;
  private low = document.createElement("canvas");
  private order: number[] = [];
  private revealed = 0;
  private img: HTMLImageElement | null = null;
  private crop = { x: 0, y: 0, w: 1, h: 1 };
  private tween: gsap.core.Tween | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.low.width = 12;
    this.low.height = 16;
  }

  show(img: HTMLImageElement, duration: number) {
    this.img = img;
    const target = this.canvas.width / this.canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    this.crop = iw / ih > target ? { x: (iw - ih * target) / 2, y: 0, w: ih * target, h: ih } : { x: 0, y: (ih - iw / target) / 2, w: iw, h: iw / target };
    const c = this.crop;
    this.low.getContext("2d")!.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, this.low.width, this.low.height);
    this.order = Array.from({ length: COLS * ROWS }, (_, i) => i).sort(() => Math.random() - 0.5);
    this.tween?.kill();
    const state = { n: duration ? 0 : COLS * ROWS };
    this.revealed = state.n;
    this.draw();
    if (!duration) return;
    this.tween = gsap.to(state, {
      n: COLS * ROWS,
      duration,
      ease: "none",
      onUpdate: () => {
        this.revealed = Math.floor(state.n);
        this.draw();
      },
    });
  }

  private draw() {
    if (!this.img) return;
    const { width: w, height: h } = this.canvas;
    const c = this.crop;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.low, 0, 0, w, h);
    this.ctx.imageSmoothingEnabled = true;
    const bw = w / COLS;
    const bh = h / ROWS;
    const sw = c.w / COLS;
    const sh = c.h / ROWS;
    for (let k = 0; k < this.revealed; k++) {
      const cell = this.order[k];
      const cx = cell % COLS;
      const cy = Math.floor(cell / COLS);
      this.ctx.drawImage(this.img, c.x + cx * sw, c.y + cy * sh, sw, sh, cx * bw, cy * bh, Math.ceil(bw), Math.ceil(bh));
    }
  }
}

const cache = new Map<string, Promise<HTMLImageElement>>();
function load(src: string) {
  if (!cache.has(src)) {
    cache.set(
      src,
      new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = src;
      }),
    );
  }
  return cache.get(src)!;
}

interface BlacklistEls {
  rows: HTMLButtonElement[];
  card: HTMLElement;
  canvas: HTMLCanvasElement;
  label: HTMLElement;
  meta: HTMLElement;
}

/**
 * Each word is split left→right into equal zones, one per product: where the cursor sits on the
 * word decides which product renders. The card exists only while the pointer is on the word.
 */
export function initBlacklist(cats: Category[], els: BlacklistEls) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const renderer = new PixelRender(els.canvas);
  const xTo = gsap.quickTo(els.card, "x", { duration: 0.45, ease: "power3.out" });
  const yTo = gsap.quickTo(els.card, "y", { duration: 0.45, ease: "power3.out" });
  let cat = -1;
  let zone = -1;
  let shown = false;
  let pointer = { x: -1, y: -1 };

  // Warm the images once the section is close, so the first hover renders instantly.
  const warm = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      cats.forEach((c) => c.items.forEach((i) => void load(i.src)));
      warm.disconnect();
    }
  }, { rootMargin: "600px" });
  warm.observe(els.rows[0]);

  const show = async (c: number, z: number) => {
    if (c === cat && z === zone && shown) return;
    const firstOpen = !shown || c !== cat;
    cat = c;
    zone = z;
    const item = cats[c].items[z];
    els.label.textContent = item.label;
    els.meta.textContent = `${z + 1} / ${cats[c].items.length}`;
    els.canvas.setAttribute("aria-label", item.alt);
    if (!shown) {
      shown = true;
      gsap.to(els.card, { autoAlpha: 1, scale: 1, duration: 0.22, ease: "power2.out", overwrite: "auto" });
    }
    const img = await load(item.src);
    if (cat !== c || zone !== z || !shown) return;
    renderer.show(img, reduced ? 0 : firstOpen ? 0.5 : 0.32);
  };

  const hide = () => {
    if (!shown) return;
    shown = false;
    cat = -1;
    zone = -1;
    gsap.to(els.card, { autoAlpha: 0, scale: 0.96, duration: 0.18, ease: "power2.in", overwrite: "auto" });
  };

  const zoneAt = (row: HTMLElement, clientX: number, c: number) => {
    const r = row.getBoundingClientRect();
    const f = Math.min(Math.max((clientX - r.left) / r.width, 0), 0.9999);
    return Math.floor(f * cats[c].items.length);
  };

  const placeAt = (x: number, y: number) => {
    const r = els.card.getBoundingClientRect();
    xTo(Math.min(Math.max(x + 28, 16), window.innerWidth - r.width - 16));
    yTo(Math.min(Math.max(y - r.height / 2, 16), window.innerHeight - r.height - 16));
  };

  if (fine) {
    window.addEventListener("pointermove", (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      placeAt(e.clientX, e.clientY);
    });
  }

  // Touch behaves like a hovering cursor: no tapping. Touch events keep firing while the page scrolls
  // (pointer events stop at the first scroll), so whichever word is under the finger shows the product
  // for the zone the finger is on, sliding across it walks the products, and lifting the finger hides it.
  const placeAbove = (x: number, y: number) => {
    const r = els.card.getBoundingClientRect();
    xTo(Math.min(Math.max(x - r.width / 2, 12), window.innerWidth - r.width - 12));
    yTo(Math.min(Math.max(y - r.height - 44, 12), window.innerHeight - r.height - 12));
  };
  const onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const row = document.elementFromPoint(t.clientX, t.clientY)?.closest<HTMLButtonElement>(".bl-row");
    const c = row ? els.rows.indexOf(row) : -1;
    if (!row || c < 0) return hide();
    placeAbove(t.clientX, t.clientY);
    void show(c, zoneAt(row, t.clientX, c));
  };
  window.addEventListener("touchstart", onTouch, { passive: true });
  window.addEventListener("touchmove", onTouch, { passive: true });
  window.addEventListener("touchend", hide, { passive: true });
  window.addEventListener("touchcancel", hide, { passive: true });

  els.rows.forEach((row, c) => {
    // Mouse: hover picks the zone, leaving the word hides the card.
    // Touch: touching or sliding a finger across the word picks the zone; the card stays docked
    // until the page scrolls or you tap elsewhere.
    row.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" || e.pointerType === "pen") void show(c, zoneAt(row, e.clientX, c));
    });
    row.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") hide();
    });
    row.addEventListener("focus", () => {
      if (row.matches(":focus-visible")) void show(c, 0);
    });
    row.addEventListener("blur", hide);
    row.addEventListener("keydown", (e) => {
      if (cat !== c) return;
      const n = cats[c].items.length;
      if (e.key === "ArrowRight") void show(c, (zone + 1) % n);
      if (e.key === "ArrowLeft") void show(c, (zone - 1 + n) % n);
      if (e.key === "Escape") hide();
    });
  });

  // Scrolling moves the words out from under a still mouse cursor: drop the card unless the pointer
  // is still on a word. (The old card stuck to the cursor all the way back up the page.)
  window.addEventListener(
    "scroll",
    () => {
      if (!shown || !fine) return;
      const under = pointer.x >= 0 ? document.elementFromPoint(pointer.x, pointer.y) : null;
      if (!under || !under.closest(".bl-row")) hide();
    },
    { passive: true },
  );
}
