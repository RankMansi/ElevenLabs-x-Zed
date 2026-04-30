import type { RunId } from '../types/maze';
import {
  RUN1_SHIFT_PERIOD_MS,
  RUN2_SHIFT_PERIOD_MS,
  RUN3_MAJOR_PERIOD_MS,
  RUN3_MINOR_PERIOD_MS,
  RUN4_SHIFT_PERIOD_MS,
  SHIFT_WARNING_MS,
} from '../config/game';

// ---------------------------------------------------------------------------
// Schedule descriptor
// ---------------------------------------------------------------------------

/**
 * Describes the timing model for a single run.
 *
 *   - `majorPeriodMs`  — how often the primary (full) maze shift fires.
 *   - `minorPeriodMs`  — how often a lightweight partial shift fires (Run 3
 *                        only); null for runs that have no minor shifts.
 */
export interface ShiftSchedule {
  runId: RunId;
  majorPeriodMs: number;
  minorPeriodMs: number | null;
}

// ---------------------------------------------------------------------------
// Per-tick output
// ---------------------------------------------------------------------------

/**
 * Everything the game loop needs to know about shift timing for the current
 * frame.  All time values are in milliseconds.
 */
export interface ShiftTick {
  /** True when a major shift boundary was crossed this frame. */
  majorFired: boolean;
  /** True when a minor shift boundary was crossed this frame (Run 3 only). */
  minorFired: boolean;
  /**
   * True when a major shift is fewer than SHIFT_WARNING_MS away AND hasn't
   * fired yet this frame.  Drives the auditory/visual warning cue.
   */
  majorWarning: boolean;
  /**
   * True when a minor shift is fewer than SHIFT_WARNING_MS away AND hasn't
   * fired yet this frame (Run 3 only).
   */
  minorWarning: boolean;
  /** Milliseconds until the next major shift fires. Always > 0. */
  nextMajorMs: number;
  /** Milliseconds until the next minor shift fires, or null if no minor shifts. */
  nextMinorMs: number | null;
  /**
   * Which cycle index (0-based) the run is currently in for major shifts.
   * Useful for seeding per-shift RNG variants.
   */
  majorCycleIndex: number;
  /**
   * Which cycle index (0-based) the run is currently in for minor shifts,
   * or null when there are no minor shifts.
   */
  minorCycleIndex: number | null;
}

// ---------------------------------------------------------------------------
// Schedule factory
// ---------------------------------------------------------------------------

/**
 * Return the canonical shift schedule for a given run.
 *
 * Run 1 — major every 20 s, no minor.
 * Run 2 — major every 15 s, no minor.
 * Run 3 — major every 30 s, minor every 10 s.
 */
export function getSchedule(runId: RunId): ShiftSchedule {
  switch (runId) {
    case 'run1':
      return {
        runId,
        majorPeriodMs: RUN1_SHIFT_PERIOD_MS,
        minorPeriodMs: null,
      };

    case 'run2':
      return {
        runId,
        majorPeriodMs: RUN2_SHIFT_PERIOD_MS,
        minorPeriodMs: null,
      };

    case 'run3':
      return {
        runId,
        majorPeriodMs: RUN3_MAJOR_PERIOD_MS,
        minorPeriodMs: RUN3_MINOR_PERIOD_MS,
      };

    case 'run4':
      return {
        runId,
        majorPeriodMs: RUN4_SHIFT_PERIOD_MS,
        minorPeriodMs: null,
      };
  }
}

function warningHorizonMs(periodMs: number): number {
  return Math.min(SHIFT_WARNING_MS, Math.max(80, periodMs - 120));
}

// ---------------------------------------------------------------------------
// Tick evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluate what shift-related events occurred between `prevElapsedMs` and
 * `elapsedMs` for the given schedule.
 *
 * The function is pure — it has no mutable state.  The game loop should call
 * it every frame, passing the accumulated run time before and after the frame.
 *
 * @param schedule       - The run's shift schedule (from `getSchedule`).
 * @param elapsedMs      - Run time at the END of the current frame (ms).
 * @param prevElapsedMs  - Run time at the END of the previous frame (ms).
 */
export function tickSchedule(
  schedule: ShiftSchedule,
  elapsedMs: number,
  prevElapsedMs: number,
): ShiftTick {
  // --- Major shift ---
  const majorFired = didCrossBoundary(schedule.majorPeriodMs, elapsedMs, prevElapsedMs);
  const majorCycleIndex = Math.floor(elapsedMs / schedule.majorPeriodMs);

  // Time remaining until the *next* major boundary (always in (0, periodMs])
  const majorPhase   = elapsedMs % schedule.majorPeriodMs;
  const nextMajorMs  = majorFired
    ? schedule.majorPeriodMs                          // fired this frame → full period ahead
    : schedule.majorPeriodMs - majorPhase;

  const majorWarnMs = warningHorizonMs(schedule.majorPeriodMs);
  const majorWarning = !majorFired && nextMajorMs <= majorWarnMs;

  // --- Minor shift (Run 3 only) ---
  let minorFired       = false;
  let minorWarning     = false;
  let nextMinorMs: number | null = null;
  let minorCycleIndex: number | null = null;

  if (schedule.minorPeriodMs !== null) {
    minorFired = didCrossBoundary(schedule.minorPeriodMs, elapsedMs, prevElapsedMs);
    minorCycleIndex = Math.floor(elapsedMs / schedule.minorPeriodMs);

    const minorPhase = elapsedMs % schedule.minorPeriodMs;
    nextMinorMs = minorFired
      ? schedule.minorPeriodMs
      : schedule.minorPeriodMs - minorPhase;

    const minorWarnMs = warningHorizonMs(schedule.minorPeriodMs);
    minorWarning = !minorFired && nextMinorMs <= minorWarnMs;
  }

  return {
    majorFired,
    minorFired,
    majorWarning,
    minorWarning,
    nextMajorMs,
    nextMinorMs,
    majorCycleIndex,
    minorCycleIndex,
  };
}

// ---------------------------------------------------------------------------
// Helper: boundary crossing detection
// ---------------------------------------------------------------------------

/**
 * Return true when at least one multiple of `periodMs` falls strictly in the
 * half-open interval (prevElapsedMs, elapsedMs].
 *
 * Works correctly even when the frame delta is large (e.g. tab was
 * backgrounded), because it compares integer cycle counts rather than a simple
 * modulo check.
 */
function didCrossBoundary(
  periodMs: number,
  elapsedMs: number,
  prevElapsedMs: number,
): boolean {
  if (periodMs <= 0) return false;
  const prevCycle = Math.floor(prevElapsedMs / periodMs);
  const currCycle = Math.floor(elapsedMs    / periodMs);
  // A new cycle has begun when the quotient increases.
  // We also exclude the t=0 edge case (first frame, both quotients are 0).
  return currCycle > prevCycle && prevElapsedMs > 0;
}

// ---------------------------------------------------------------------------
// Convenience: compute the initial nextMajorShiftMs / nextMinorShiftMs
// for a brand-new RunState (elapsed = 0).
// ---------------------------------------------------------------------------

/**
 * Returns the number of milliseconds until the first major shift for a fresh
 * run (i.e. when `elapsedMs` is 0).  This is simply the full period.
 */
export function initialNextMajorMs(runId: RunId): number {
  return getSchedule(runId).majorPeriodMs;
}

/**
 * Returns the number of milliseconds until the first minor shift for a fresh
 * Run 3, or 0 for runs without minor shifts.
 */
export function initialNextMinorMs(runId: RunId): number {
  return getSchedule(runId).minorPeriodMs ?? 0;
}
