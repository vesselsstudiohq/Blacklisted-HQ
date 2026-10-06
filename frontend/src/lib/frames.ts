/**
 * Streams the hero's 240 frames in passes: every 4th frame first (what the loader waits for),
 * then every 2nd, then the rest — so the scrub is usable after ~25% of the bytes.
 */
export type FrameSet = "d" | "m";

export interface FrameStore {
  set: FrameSet;
  count: number;
  /** Nearest decoded frame to `index` (never undefined once the first pass is done). */
  nearest(index: number): HTMLImageElement | undefined;
  /** Resolves when the first pass is decoded; reports 0..1 progress for it. */
  firstPass: Promise<void>;
}

export function pickSet(): FrameSet {
  return window.innerWidth / window.innerHeight < 0.9 ? "m" : "d";
}

function order(count: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const step of [4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
    }
  }
  return out;
}

export function loadFrames(count: number, onProgress: (p: number) => void): FrameStore {
  const set = pickSet();
  const frames: (HTMLImageElement | undefined)[] = new Array(count);
  const queue = order(count);
  const firstPassSize = Math.ceil(count / 4);
  let firstDone = 0;
  let resolveFirst!: () => void;
  const firstPass = new Promise<void>((r) => (resolveFirst = r));

  const url = (i: number) => `/frames/${set}/${String(i + 1).padStart(3, "0")}.webp`;

  const loadOne = async (i: number, inFirst: boolean) => {
    const img = new Image();
    img.decoding = "async";
    img.fetchPriority = "low"; // never compete with the poster frame (LCP)
    // Wait on `load`, not `decode()`: Chrome can leave decode() pending while the tab is hidden,
    // which stalled every lane (and the loader) for a visitor who opened the site in a background tab.
    const ok = await new Promise<boolean>((res) => {
      img.onload = () => res(true);
      img.onerror = () => res(false);
      img.src = url(i);
    });
    if (ok) {
      frames[i] = img;
      img.decode().catch(() => {}); // warm the decode cache; never block on it
    }
    /* a missing frame falls back to its nearest neighbour */
    if (inFirst) {
      firstDone++;
      onProgress(firstDone / firstPassSize);
      if (firstDone === firstPassSize) resolveFirst();
    }
  };

  // Six parallel lanes keep the connection busy without flooding it.
  let cursor = 0;
  const lane = async () => {
    while (cursor < queue.length) {
      const pos = cursor++;
      await loadOne(queue[pos], pos < firstPassSize);
    }
  };
  for (let l = 0; l < 6; l++) void lane();

  return {
    set,
    count,
    firstPass,
    nearest(index) {
      const i = Math.max(0, Math.min(count - 1, Math.round(index)));
      if (frames[i]) return frames[i];
      for (let d = 1; d < count; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
      }
      return undefined;
    },
  };
}
