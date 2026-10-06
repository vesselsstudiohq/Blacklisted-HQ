/*!
 * Vessels Glass — SIDSTACK's 4-layer glass GUI kit.
 * Builds on liquid-glass.js by Deepika Rao (MIT, https://github.com/deepika-builds/liquid-glass):
 * every refraction stage uses its displacement-map method (field, adapted below) and its tuned
 * front-glass values. liquid-glass.js itself stays unmodified for single-surface use. See NOTICE.
 *
 *   <link rel="stylesheet" href="vessels-glass.css">
 *   <script src="vessels-glass.js"></script>
 *   <button data-vg="button" data-vg-size="md" data-vg-intensity="0.7">Book a table</button>
 *   VesselsGlass.mount();                 // upgrades every [data-vg] on the page
 *
 * The four layers, back to front, and where each is drawn:
 *   4 base  — edge distortion: rim-only refraction with a wide RGB stagger (chromatic aberration)
 *   3 frost — backdrop blur + saturation, plus a fine grain overlay (.vg-grain)
 *   2 echo  — the liquid-glass refraction again with the displacement inverted (pinch, not bulge)
 *   1 front — the liquid-glass refraction (its map and values) + a pointer-following specular (.vg-l1)
 * All four render in ONE backdrop pass on .vg-under: `blur() saturate() url(#vg-glass-N)`, where the
 * edge, echo and front refractions are three separate displacement fields summed into one map
 * (layeredMap). The chromatic edge is painted in CSS (.vg-l1::after) unless fringe:"filter".
 * Measured on an Intel UHD 620 laptop GPU (2026-09-30), six 320x160 cards over a moving background:
 * four stacked backdrop layers froze the tab; three chained displacements ran 17-29 fps; blur plus
 * one summed displacement runs at 60. SKILL.md has the numbers and the per-screen budget.
 *
 * Quality: "full" (Chromium), "lite" (frost + grain + highlight: Safari/Firefox, weak devices, or
 * when the frame monitor measures slow frames), "solid" (prefers-reduced-transparency).
 * prefers-reduced-motion turns off the pointer highlight and the CSS transitions.
 */
(function (global) {
  "use strict";

  const doc = global.document;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const mq = (q) => !!(global.matchMedia && global.matchMedia(q).matches);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mounted = new Map(); // element -> handle
  let uid = 0;
  let defs = null;

  function refractionSupported() {
    const ua = navigator.userAgent;
    if ((/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) || /Firefox/.test(ua)) return false;
    return !!(global.CSS && CSS.supports("backdrop-filter", "url(#vg)"));
  }

  function detectQuality() {
    if (mq("(prefers-reduced-transparency: reduce)")) return "solid";
    if (!refractionSupported()) return "lite";
    if ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2) return "lite";
    return "full";
  }
  let quality = detectQuality();

  function ensureDefs() {
    if (defs) return defs;
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    defs = doc.createElementNS(SVG_NS, "defs");
    svg.appendChild(defs);
    doc.body.appendChild(svg);
    return defs;
  }
  const node = (tag, attrs, parent) => {
    const n = doc.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  // Displacement field, adapted from liquid-glass.js (MIT, Deepika Rao): a red ramp encodes X, a blue
  // ramp Y; a blurred neutral-gray inset keeps the interior still, so the bend lives at the rim.
  // Returns the raw pixels; `sumFields` adds several into one map. `make(w, h)` returns a canvas, so
  // the same code runs here and in the map worker (it is sent there as source: keep it self-contained).
  function fieldPixels(make, w, h, radius, border, mapBlur) {
    const c = make(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const gx = ctx.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, "rgb(0,0,0)");
    gx.addColorStop(1, "rgb(255,0,0)");
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, w, h);
    const gy = ctx.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, "rgb(0,0,0)");
    gy.addColorStop(1, "rgb(0,0,255)");
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = gy;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    const inset = border * Math.min(w, h);
    ctx.filter = "blur(" + mapBlur + "px)";
    ctx.fillStyle = "rgba(128,128,128,0.93)";
    ctx.beginPath();
    ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, Math.max(radius - inset, 2));
    ctx.fill();
    return ctx.getImageData(0, 0, w, h).data;
  }

  // The refraction layers as ONE map. Each layer is its own displacement field with its own signed
  // strength; displacement vectors add, so their sum drives a single feDisplacementMap: one GPU
  // displacement per element instead of three (measured: 29 -> 58 fps for six cards on a UHD 620).
  // Self-contained for the same reason (the field function comes in as an argument: a minifier
  // renames the reference, and the worker only has what it was sent).
  function sumFields(make, fieldFn, w, h, radius, layers) {
    const fields = layers.map((l) => fieldFn(make, w, h, radius, l.border, l.mapBlur));
    const total = layers.reduce((a, l) => a + Math.abs(l.scale), 0) || 1;
    const o = new Uint8ClampedArray(w * h * 4);
    for (let p = 0; p < o.length; p += 4) {
      let dx = 0, dy = 0;
      for (let k = 0; k < layers.length; k++) {
        dx += ((fields[k][p] - 128) / 255) * layers[k].scale;
        dy += ((fields[k][p + 2] - 128) / 255) * layers[k].scale;
      }
      o[p] = 128 + (dx / total) * 255;
      o[p + 2] = 128 + (dy / total) * 255;
      o[p + 3] = 255;
    }
    return o;
  }

  const docCanvas = (w, h) => {
    const c = doc.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  const field = (w, h, radius, border, mapBlur) => fieldPixels(docCanvas, w, h, radius, border, mapBlur);

  function toHref(w, h, pixels) {
    const c = docCanvas(w, h);
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(w, h);
    img.data.set(pixels);
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  // Building a map is a per-pixel pass plus a PNG encode (measured 2026-10-01 on the studio home:
  // 35 ms per card on the laptop, 826 ms of main-thread work for six cards under Lighthouse's 4x CPU).
  // So maps are built in a worker on an OffscreenCanvas; each surface shows its frost until its map
  // arrives, then refracts. Where a worker is not allowed (a CSP without worker-src blob:) or fails,
  // the same code runs here. Maps are built at half size: every field is a blurred ramp, and feImage
  // stretches the map back to the element (measured: max 7/255 difference on screen). Same-size
  // surfaces, such as a grid of cards, share one map.
  const MAP_SCALE = 0.5;
  const maps = new Map(); // key -> { href, scale, waiting }
  const pending = new Map(); // request id -> { finish, here }
  let mapWorker; // undefined: not tried yet · null: unavailable
  let requests = 0;

  function worker() {
    if (mapWorker !== undefined) return mapWorker;
    mapWorker = null;
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || !global.Blob || !global.URL) return null;
    const src =
      "const fieldFn = " + fieldPixels + ";\n" +
      "const sumFn = " + sumFields + ";\n" +
      "onmessage = async (e) => {\n" +
      "  const { id, w, h, radius, layers } = e.data;\n" +
      "  try {\n" +
      "    const make = (cw, ch) => new OffscreenCanvas(cw, ch);\n" +
      "    const c = make(w, h);\n" +
      "    c.getContext('2d').putImageData(new ImageData(sumFn(make, fieldFn, w, h, radius, layers), w, h), 0, 0);\n" +
      "    const href = new FileReaderSync().readAsDataURL(await c.convertToBlob());\n" +
      "    postMessage({ id, href });\n" +
      "  } catch (err) {\n" +
      "    postMessage({ id, error: String(err) });\n" +
      "  }\n" +
      "};\n";
    try {
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      mapWorker = new Worker(url);
      URL.revokeObjectURL(url);
    } catch (e) {
      return (mapWorker = null);
    }
    mapWorker.onmessage = (e) => {
      const job = pending.get(e.data.id);
      if (!job) return;
      pending.delete(e.data.id);
      if (e.data.href) job.finish(e.data.href);
      else job.here();
    };
    // blocked by a CSP, or it died: build whatever it still owes here, and never ask it again
    mapWorker.onerror = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      mapWorker = null;
      const owed = [...pending.values()];
      pending.clear();
      owed.forEach((job) => job.here());
    };
    return mapWorker;
  }

  /** Calls done({ href, scale }) once the map for this size exists: at once when it is cached. */
  function layeredMap(fw, fh, fradius, layers, done) {
    const key = [fw, fh, fradius.toFixed(1)].concat(layers.map((l) => l.border + "/" + l.mapBlur + "/" + l.scale.toFixed(2))).join(",");
    const hit = maps.get(key);
    if (hit && hit.href) return done(hit);
    if (hit) return void hit.waiting.push(done);
    const entry = { href: null, scale: layers.reduce((a, l) => a + Math.abs(l.scale), 0) || 1, waiting: [done] };
    if (maps.size >= 32) for (const [k, m] of maps) if (m.href) { maps.delete(k); break; }
    maps.set(key, entry);
    const w = Math.max(2, Math.round(fw * MAP_SCALE)), h = Math.max(2, Math.round(fh * MAP_SCALE)), radius = fradius * MAP_SCALE;
    const small = layers.map((l) => ({ border: l.border, mapBlur: l.mapBlur * MAP_SCALE, scale: l.scale }));
    const finish = (href) => {
      entry.href = href;
      entry.waiting.splice(0).forEach((f) => f(entry));
    };
    const here = () => finish(toHref(w, h, sumFields(docCanvas, fieldPixels, w, h, radius, small)));
    const wk = worker();
    if (!wk) return here();
    const id = ++requests;
    pending.set(id, { finish, here });
    wk.postMessage({ id, w, h, radius, layers: small });
  }

  function displacementFilter(id) {
    const f = node("filter", { id, x: "0", y: "0", width: "100%", height: "100%", "color-interpolation-filters": "sRGB" }, ensureDefs());
    const img = node("feImage", { x: "0", y: "0", result: "map", preserveAspectRatio: "none" }, f);
    const disp = node("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: 0, xChannelSelector: "R", yChannelSelector: "B" }, f);
    return { f, img, disp };
  }

  // Optional (fringe:"filter"): the edge's colour split computed for real, liquid-glass.js's prism
  // method: three staggered displacements recombined per channel. About 2x the GPU cost of the whole
  // default stack, so it is for one hero element on a strong GPU, never for every button.
  function prismFilter(id, scale, chroma) {
    const f = node("filter", { id, x: "0", y: "0", width: "100%", height: "100%", "color-interpolation-filters": "sRGB" }, ensureDefs());
    const img = node("feImage", { x: "0", y: "0", result: "map", preserveAspectRatio: "none" }, f);
    const keep = ["1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0", "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0", "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"];
    for (let i = 0; i < 3; i++) {
      node("feDisplacementMap", { in: "SourceGraphic", in2: "map", scale: scale + i * chroma, xChannelSelector: "R", yChannelSelector: "B", result: "d" + i }, f);
      node("feColorMatrix", { in: "d" + i, type: "matrix", values: keep[i], result: "c" + i }, f);
    }
    node("feBlend", { in: "c0", in2: "c1", mode: "screen", result: "c01" }, f);
    node("feBlend", { in: "c01", in2: "c2", mode: "screen" }, f);
    return { f, img };
  }

  function buildStack(el) {
    // loose text (a button's label) would paint under the absolutely positioned stack: wrap it, so
    // every piece of content is an element that the CSS lifts above the glass
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const label = doc.createElement("span");
        label.className = "vg-label";
        n.replaceWith(label);
        label.append(n);
      }
    }
    let stack = el.querySelector(":scope > .vg-stack");
    if (!stack) {
      stack = doc.createElement("span");
      stack.className = "vg-stack";
      stack.setAttribute("aria-hidden", "true");
      stack.innerHTML = '<span class="vg-under"></span><span class="vg-grain"></span><span class="vg-l1"></span>';
      el.prepend(stack);
    }
    return { under: stack.children[0], grain: stack.children[1], front: stack.children[2] };
  }

  function radiusOf(el, w, h) {
    const raw = getComputedStyle(el).borderTopLeftRadius || "0px";
    const v = parseFloat(raw) || 0;
    return raw.trim().endsWith("%") ? (v / 100) * Math.min(w, h) : v;
  }

  /**
   * Turn one element into Vessels Glass.
   * @param {Element} el
   * @param {{intensity?: number, size?: "sm"|"md"|"lg", quality?: "auto"|"full"|"lite"|"solid", fringe?: "css"|"filter"}} [opts]
   *   fringe "css" (default) paints the chromatic edge; "filter" computes it (about 2x the GPU cost; hero only)
   */
  function glass(el, opts) {
    if (mounted.has(el)) mounted.get(el).destroy();
    // data-vg-tier="lite" asks for a lighter tier on one element (big panels behind the hero glass)
    const o = Object.assign({ intensity: parseFloat(el.dataset.vgIntensity || "0.7"), size: el.dataset.vgSize || "md", quality: el.dataset.vgTier || "auto", fringe: el.dataset.vgFringe || "css" }, opts);
    const i = clamp(isNaN(o.intensity) ? 0.7 : o.intensity, 0, 1);
    // a requested tier never raises quality above what the device supports
    const rank = { solid: 0, lite: 1, full: 2 };
    const q = o.quality === "auto" ? quality : (rank[o.quality] > rank[quality] && quality !== "full" ? quality : o.quality);
    el.dataset.vgSize = o.size;
    el.dataset.vgIntensity = String(i);
    el.dataset.vgQuality = q;
    el.style.setProperty("--vg-i", String(i));
    el.dataset.vgFringe = o.fringe;
    const L = buildStack(el);
    const frost = "blur(" + (4 + 10 * i).toFixed(1) + "px) saturate(1.45)";

    let glassF = null, prism = null, ro = null, timer = 0, refreshMaps = null, alive = true;
    if (q === "full") {
      const id = ++uid;
      // The three refraction layers, each its own field, back to front. The frost sits between the
      // edge and the echo in the stack; in the pass it is applied first, because a uniform blur and a
      // rim-only bend commute closely enough to look identical, and it keeps the pass to one displacement.
      const layers = [
        { name: "edge", border: 0.012, mapBlur: 5, scale: -(40 + 70 * i) },  // 4 base: rim-only, strong
        { name: "echo", border: 0.1, mapBlur: 16, scale: 20 + 45 * i },      // 2 echo: inverted, soft, wide
        { name: "front", border: 0.07, mapBlur: 12, scale: -(50 + 90 * i) }, // 1 front: liquid-glass defaults
      ];
      glassF = displacementFilter("vg-glass-" + id);
      if (o.fringe === "filter") prism = prismFilter("vg-prism-" + id, -(20 + 30 * i), 4 + 10 * i);
      let sized = "";
      // frost alone until the map exists: a filter pointing at an empty feImage would shift the backdrop
      L.under.style.backdropFilter = frost;
      const refresh = (refreshMaps = (force) => {
        const w = L.under.offsetWidth, h = L.under.offsetHeight;
        // maps depend only on size: skip the ResizeObserver's first call and any same-size call
        if (!w || !h || (!force && sized === w + "x" + h)) return;
        const size = (sized = w + "x" + h);
        const r = radiusOf(el, w, h);
        layeredMap(w, h, r, layers, (m) => {
          if (!alive || sized !== size) return; // destroyed, or resized again while it was building
          glassF.img.setAttribute("href", m.href);
          glassF.disp.setAttribute("scale", m.scale.toFixed(1));
          glassF.img.setAttribute("width", w);
          glassF.img.setAttribute("height", h);
          if (prism) {
            prism.img.setAttribute("href", toHref(w, h, field(w, h, r, 0.012, 5)));
            prism.img.setAttribute("width", w);
            prism.img.setAttribute("height", h);
          }
          // all four layers in one backdrop pass: the frost, then the summed edge + echo + front refraction
          L.under.style.backdropFilter = frost + " url(#vg-glass-" + id + ")" + (prism ? " url(#vg-prism-" + id + ")" : "");
        });
      });
      refresh();
      ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(refresh, 120); });
      ro.observe(L.under);
    } else if (q === "lite") {
      L.under.style.backdropFilter = frost;
      L.under.style.webkitBackdropFilter = frost;
    } else {
      L.under.style.backdropFilter = "none";
    }

    // specular highlight follows the pointer (never under reduced motion)
    let move = null;
    if (!mq("(prefers-reduced-motion: reduce)") && q !== "solid") {
      let frame = 0;
      move = (e) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const r = el.getBoundingClientRect();
          L.front.style.setProperty("--vg-mx", ((e.clientX - r.left) / r.width) * 100 + "%");
          L.front.style.setProperty("--vg-my", ((e.clientY - r.top) / r.height) * 100 + "%");
        });
      };
      el.addEventListener("pointermove", move);
    }

    const handle = {
      el, quality: q, intensity: i,
      update(next) { return glass(el, Object.assign({ intensity: i, size: o.size, quality: o.quality, fringe: o.fringe }, next)); },
      refresh() { if (refreshMaps) refreshMaps(true); },
      destroy() {
        alive = false;
        if (ro) ro.disconnect();
        clearTimeout(timer);
        if (glassF) glassF.f.remove();
        if (prism) prism.f.remove();
        L.under.style.backdropFilter = "";
        L.under.style.webkitBackdropFilter = "";
        if (move) el.removeEventListener("pointermove", move);
        mounted.delete(el);
      },
    };
    mounted.set(el, handle);
    return handle;
  }

  const behaviours = {
    toggle(el) {
      if (!el.querySelector(".vg-thumb")) {
        const t = doc.createElement("span");
        t.className = "vg-thumb";
        t.setAttribute("aria-hidden", "true");
        el.append(t);
      }
      el.setAttribute("role", "switch");
      if (!el.hasAttribute("aria-checked")) el.setAttribute("aria-checked", "false");
      if (!el.dataset.vgBound) {
        el.dataset.vgBound = "1";
        el.addEventListener("click", () => {
          const on = el.getAttribute("aria-checked") !== "true";
          el.setAttribute("aria-checked", String(on));
          el.dispatchEvent(new CustomEvent("vg:toggle", { bubbles: true, detail: { on } }));
        });
      }
    },
  };

  /** Upgrade every [data-vg] element inside root (default: the document). */
  function mount(root, opts) {
    const scope = root || doc;
    const out = [];
    scope.querySelectorAll("[data-vg]").forEach((el) => {
      if (behaviours[el.dataset.vg]) behaviours[el.dataset.vg](el);
      out.push(glass(el, opts));
    });
    return out;
  }

  /** Open a [data-vg="modal"] <dialog>; its maps are rebuilt once it has a size. */
  function openModal(dialog) {
    dialog.showModal();
    requestAnimationFrame(() => mounted.has(dialog) && glass(dialog, { intensity: mounted.get(dialog).intensity }));
  }

  function setQuality(q) {
    quality = q;
    // a snapshot: update() re-mounts each element, which re-adds it to the Map, and Map.forEach would
    // visit it again forever (2026-09-30: this froze any page whose monitor downgraded to lite).
    // The re-mounts run in slices of about 12 ms, yielding between them, so an upgrade to "full"
    // never holds the main thread for one long task however many surfaces the page has.
    const queue = [...mounted.values()];
    const slice = () => {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 12) {
        const h = queue.shift();
        if (mounted.get(h.el) === h) h.update({ quality: "auto" });
      }
      if (queue.length) return setTimeout(slice, 0);
      doc.dispatchEvent(new CustomEvent("vg:quality", { detail: { quality } }));
    };
    slice();
  }

  /**
   * Watches real frame times while the page animates; if the median frame is slower than
   * `threshold` ms, every glass element drops to "lite" (the 60 fps floor). The window is bounded by
   * time as well as frames, and one frame longer than `stall` ms downgrades at once: on a GPU that
   * cannot keep up, frames arrive seconds apart and a frame count alone would never finish
   * (measured 2026-09-30: the full demo over a moving background stalled a UHD 620 tab for minutes).
   */
  function monitor(options) {
    const o = Object.assign({ frames: 90, maxMs: 2500, threshold: 20, stall: 250 }, options);
    return new Promise((resolve) => {
      const times = [];
      const start = performance.now();
      let last = start, done = false;
      const finish = (why) => {
        if (done) return;
        done = true;
        const sorted = (times.length > 8 ? times.slice(5) : times).sort((a, b) => a - b);
        const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : Infinity;
        const p90 = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : Infinity;
        const slow = why === "stall" || median > o.threshold;
        if (slow && quality === "full") setQuality("lite");
        resolve({ median, p90, fps: 1000 / median, downgraded: slow, reason: slow ? why : "ok" });
      };
      // a timer, not a frame, ends the window: it still fires when frames stop coming
      const guard = setTimeout(() => finish(times.length < 10 ? "stall" : "median"), o.maxMs + 500);
      function tick(now) {
        if (done) return;
        const dt = now - last;
        last = now;
        times.push(dt);
        if (dt > o.stall && times.length > 3) { clearTimeout(guard); return finish("stall"); }
        if (times.length < o.frames && now - start < o.maxMs) return requestAnimationFrame(tick);
        clearTimeout(guard);
        finish("median");
      }
      requestAnimationFrame(tick);
    });
  }

  global.VesselsGlass = {
    mount, glass, openModal, setQuality, monitor,
    get quality() { return quality; },
    get count() { return mounted.size; },
  };
})(window);
