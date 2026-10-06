/**
 * Nano retract: the loader's dark surface erodes along an organic, paper-like edge (no fire, no glow)
 * and every eroded fleck streams toward a moving target — the chrome asterisk on its way to the nav,
 * like a nano-suit retracting into its core. Erosion starts at the point farthest from the target and
 * finishes where it lands. Canvas 2D: the surface only ever has cells cleared (never repainted whole),
 * and flecks are capped, so the cost per frame stays small.
 */
interface Target {
  x: number;
  y: number;
}

const MEADOW = "#0d1411";
const RIM = "rgba(58, 81, 72, 0.55)"; // Moonlit Moss: the eroding edge reads as a thin worn rim

/** Smooth 2D value noise on a coarse lattice (two octaves), deterministic per page load. */
function makeNoise(cols: number, rows: number) {
  const lattice = (c: number, r: number) => Array.from({ length: (c + 1) * (r + 1) }, () => Math.random());
  const a = lattice(cols, rows);
  const b = lattice(cols * 3, rows * 3);
  const s = (t: number) => t * t * (3 - 2 * t);
  const sample = (g: number[], c: number, x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = s(x - x0);
    const ty = s(y - y0);
    const at = (i: number, j: number) => g[j * (c + 1) + i];
    const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const bot = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return top * (1 - ty) + bot * ty;
  };
  return (u: number, v: number) =>
    0.7 * sample(a, cols, u * cols * 0.999, v * rows * 0.999) + 0.3 * sample(b, cols * 3, u * cols * 3 * 0.999, v * rows * 3 * 0.999);
}

export function nanoDissolve(canvas: HTMLCanvasElement, target: () => Target, duration = 1.8): Promise<void> {
  // Everything below works in whole DEVICE pixels. Cells sized in CSS px and scaled by the pixel
  // ratio landed on fractional device pixels, and clearRect left hairline slivers between cells:
  // the "blank lines" over the hero at the very end of the old dissolve.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const W = Math.round(window.innerWidth * dpr);
  const H = Math.round(window.innerHeight * dpr);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = MEADOW;
  ctx.fillRect(0, 0, W, H);

  // Fleck layer on its own canvas so the surface never needs a full repaint.
  const fx = document.createElement("canvas");
  fx.width = W;
  fx.height = H;
  fx.className = canvas.className;
  canvas.after(fx);
  const fctx = fx.getContext("2d")!;

  const CELL = Math.max(4, Math.round((window.innerWidth < 768 ? 4 : 5) * dpr)); // integer device px
  const cols = Math.ceil(W / CELL);
  const rows = Math.ceil(H / CELL);
  const noise = makeNoise(5, 3);
  const tgt = () => {
    const p = target();
    return { x: p.x * dpr, y: p.y * dpr };
  };
  const t0 = tgt();
  const maxD = Math.hypot(Math.max(t0.x, W - t0.x), Math.max(t0.y, H - t0.y));

  // Erosion order: far from the landing spot first, shaped by noise, with grain for a crumbly edge.
  const n = cols * rows;
  const key = new Float32Array(n);
  const bcols = Math.ceil(cols / 3);
  const blockNoise = new Float32Array(bcols * Math.ceil(rows / 3)).fill(NaN);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      const far = Math.hypot(x - t0.x, y - t0.y) / maxD;
      // The noise is smooth, so one sample per 3x3 block of cells is visually identical and 9x cheaper.
      const bi = Math.floor(r / 3) * bcols + Math.floor(c / 3);
      if (Number.isNaN(blockNoise[bi])) blockNoise[bi] = noise(x / W, y / H);
      key[r * cols + c] = 0.5 * (1 - far) + 0.42 * blockNoise[bi] + 0.08 * Math.random();
    }
  }
  // Order cells by key with a linear bucket sort: a comparator sort over tens of thousands of cells
  // was one long main-thread task (it showed up in Lighthouse's blocking time).
  const B = 2048;
  let kmin = Infinity;
  let kmax = -Infinity;
  for (let i = 0; i < n; i++) {
    if (key[i] < kmin) kmin = key[i];
    if (key[i] > kmax) kmax = key[i];
  }
  const span = kmax - kmin || 1;
  const bucketOf = (i: number) => Math.min(B - 1, Math.floor(((key[i] - kmin) / span) * B));
  const counts = new Uint32Array(B + 1);
  for (let i = 0; i < n; i++) counts[bucketOf(i) + 1]++;
  for (let b = 0; b < B; b++) counts[b + 1] += counts[b];
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[counts[bucketOf(i)]++] = i;

  type Fleck = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number };
  const flecks: Fleck[] = [];
  const MAX_FLECKS = 5000;
  const SPEED = dpr; // fleck motion is authored in CSS px
  const RIM_LEAD = Math.round(n * 0.025);

  return new Promise((resolve) => {
    const start = performance.now();
    let last = start;
    let cleared = 0;
    let rimmed = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1000 / duration, 1);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      // Ease the erosion so it starts gently and finishes decisively.
      const goal = Math.floor(n * (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2));

      // A worn rim runs just ahead of the erosion front.
      ctx.fillStyle = RIM;
      const rimGoal = Math.min(n, goal + RIM_LEAD);
      for (; rimmed < rimGoal; rimmed++) {
        const i = order[rimmed];
        ctx.fillRect((i % cols) * CELL, Math.floor(i / cols) * CELL, CELL, CELL);
      }
      // Erode, and lift a fleck from most of what erodes.
      for (; cleared < goal; cleared++) {
        const i = order[cleared];
        const x = (i % cols) * CELL;
        const y = Math.floor(i / cols) * CELL;
        ctx.clearRect(x, y, CELL, CELL);
        if (flecks.length < MAX_FLECKS && (cleared & 1) === 0) {
          const a = Math.random() * Math.PI * 2;
          flecks.push({ x, y, vx: Math.cos(a) * 40 * SPEED, vy: Math.sin(a) * 40 * SPEED, age: 0, life: 0.45 + Math.random() * 0.35, size: (1 + Math.random() * 2.2) * SPEED });
        }
      }

      // Flecks drift, then get pulled into the moving logo and shrink away as they arrive.
      const tg = tgt();
      fctx.clearRect(0, 0, W, H);
      fctx.fillStyle = MEADOW;
      for (let k = flecks.length - 1; k >= 0; k--) {
        const f = flecks[k];
        f.age += dt;
        const p = f.age / f.life;
        if (p >= 1) {
          flecks[k] = flecks[flecks.length - 1];
          flecks.pop();
          continue;
        }
        const pull = 2.2 + p * 9;
        f.vx += ((tg.x - f.x) * pull - f.vx * 1.6) * dt;
        f.vy += ((tg.y - f.y) * pull - f.vy * 1.6) * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        // Absorbed on arrival and thinned as they close in: pulled flecks otherwise overshoot, orbit
        // the parked logo and pile up into a dark clump at the very end of the dissolve.
        const dist = Math.hypot(tg.x - f.x, tg.y - f.y);
        const near = 28 * SPEED;
        if (dist < near * 0.5) {
          flecks[k] = flecks[flecks.length - 1];
          flecks.pop();
          continue;
        }
        const s = f.size * (1 - p * 0.85) * Math.min(1, dist / near);
        fctx.globalAlpha = (1 - p * p) * Math.min(1, dist / (near * 2));
        fctx.fillRect(f.x, f.y, s, s);
      }
      fctx.globalAlpha = 1;

      // The erosion is complete at t = 1: wipe the whole surface so no sliver can survive.
      if (t >= 1 && cleared >= n) ctx.clearRect(0, 0, W, H);
      if (t < 1 || flecks.length) requestAnimationFrame(tick);
      else {
        fx.remove();
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}
