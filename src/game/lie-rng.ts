import { LIE_SEGMENT_SEED, LIE_PROBABILITY } from '../config/game';

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// Each call produces an independent generator from a composed seed so that
// segment indices never share state and the output is fully deterministic.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  // Force unsigned 32-bit to keep arithmetic stable across JS engines
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ---------------------------------------------------------------------------
// Seed composition helpers
// Each purpose (lie-flag, lie-cue, truth-cue) uses a different mixing
// constant so that segment 0 of one table never aliases segment 0 of another.
// ---------------------------------------------------------------------------

const SEED_LIE_FLAG  = 0x9e3779b9; // golden-ratio fractional constant
const SEED_LIE_CUE   = 0x4b7a9f1c;
const SEED_TRUTH_CUE = 0x1f2e3d4c;

/** Mix the global lie seed with a per-segment constant to get a unique seed. */
function composeSeed(segmentIndex: number, mixConstant: number): number {
  // XOR the base seed against the product of index and constant.
  // The >>> 0 keeps it in unsigned 32-bit range.
  return (LIE_SEGMENT_SEED ^ (Math.imul(segmentIndex, mixConstant) >>> 0)) >>> 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the audio hint at `segmentIndex` should be a lie.
 *
 * The result is fully deterministic: the same segment index always returns
 * the same boolean for a given `LIE_SEGMENT_SEED` / `LIE_PROBABILITY` pair,
 * regardless of call order or timing.
 *
 * ~50 % of segments are lies when `LIE_PROBABILITY = 0.5`.
 */
export function isLieAtSegment(segmentIndex: number): boolean {
  const rand = mulberry32(composeSeed(segmentIndex, SEED_LIE_FLAG));
  return rand() < LIE_PROBABILITY;
}

/**
 * Return the 1-based index (1–6) of the lie audio cue to play at
 * `segmentIndex`.
 *
 * The first PRNG draw is discarded so the output distribution is
 * independent of the lie-flag draw that uses the same seed family.
 */
export function getLieCueIndex(segmentIndex: number): number {
  const rand = mulberry32(composeSeed(segmentIndex, SEED_LIE_CUE));
  rand(); // discard first draw for decorrelation
  return Math.floor(rand() * 6) + 1; // 1 … 6 inclusive
}

/**
 * Return the 1-based index (1–6) of the truth audio cue to play at
 * `segmentIndex`.
 *
 * Uses a different mixing constant from `getLieCueIndex` so truth and lie
 * indices are statistically independent even when the segment numbers match.
 */
export function getTruthCueIndex(segmentIndex: number): number {
  const rand = mulberry32(composeSeed(segmentIndex, SEED_TRUTH_CUE));
  rand(); // discard first draw for decorrelation
  return Math.floor(rand() * 6) + 1; // 1 … 6 inclusive
}

/**
 * Derive the `CueId` string for a hint at `segmentIndex`.
 *
 * Returns e.g. `'lie_3'` or `'truth_5'` — shapes that match the `CueId`
 * union in `types/audio.ts`.
 */
export function getCueIdForSegment(segmentIndex: number): `lie_${number}` | `truth_${number}` {
  if (isLieAtSegment(segmentIndex)) {
    return `lie_${getLieCueIndex(segmentIndex)}`;
  }
  return `truth_${getTruthCueIndex(segmentIndex)}`;
}

/**
 * Pre-compute the lie/truth schedule for `count` segments.
 * Useful for debug panels and editor tooling.
 */
export interface SegmentHint {
  segmentIndex: number;
  isLie: boolean;
  cueIndex: number;
  cueId: `lie_${number}` | `truth_${number}`;
}

export function buildSegmentSchedule(count: number): SegmentHint[] {
  const schedule: SegmentHint[] = [];
  for (let i = 0; i < count; i++) {
    const lie = isLieAtSegment(i);
    const cueIndex = lie ? getLieCueIndex(i) : getTruthCueIndex(i);
    schedule.push({
      segmentIndex: i,
      isLie: lie,
      cueIndex,
      cueId: lie ? `lie_${cueIndex}` : `truth_${cueIndex}`,
    });
  }
  return schedule;
}
