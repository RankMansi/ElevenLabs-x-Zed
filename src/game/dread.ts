import type { DreadState } from '../types/game';
import { clamp, clamp01 } from '../utils/clamp';
import {
  DREAD_IDLE_THRESHOLD_MS,
  DREAD_INCREASE_RATE,
  DREAD_DECREASE_RATE,
  DREAD_MAX_LIGHT_SHRINK,
  HEARTBEAT_START_DREAD,
  LIGHT_RADIUS_TILES,
} from '../config/game';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Return a fresh DreadState with no accumulated dread.
 * Call this at the start of every run.
 */
export function createDread(): DreadState {
  return {
    level: 0,
    idleMs: 0,
    lightRadiusMod: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

/**
 * Advance the dread state by one frame.
 *
 * Dread accumulation rules:
 *  - While the player is MOVING   → idle timer resets; dread drains at DREAD_DECREASE_RATE/s
 *  - While the player is IDLE and the idle timer exceeds DREAD_IDLE_THRESHOLD_MS
 *                                 → dread rises at DREAD_INCREASE_RATE/s
 *  - Dread is always clamped to [0, 1].
 *
 * The light radius modifier shrinks linearly with dread:
 *   lightRadiusMod = 1.0 − (level × DREAD_MAX_LIGHT_SHRINK)
 * so at level 1.0 the radius is reduced by DREAD_MAX_LIGHT_SHRINK (e.g. 12%).
 *
 * @param dread      Previous frame's DreadState (immutable — returns a new object).
 * @param isMoving   Whether the player moved at all during this frame.
 * @param dtSeconds  Frame delta time in seconds.
 */
export function updateDread(
  dread: DreadState,
  isMoving: boolean,
  dtSeconds: number,
): DreadState {
  let { level, idleMs } = dread;

  if (isMoving) {
    // Reset idle accumulator
    idleMs = 0;
    // Drain dread while moving
    level = clamp01(level - DREAD_DECREASE_RATE * dtSeconds);
  } else {
    // Accumulate idle time (convert dtSeconds → ms)
    idleMs += dtSeconds * 1_000;

    // Only start building dread once the idle grace period has elapsed
    if (idleMs > DREAD_IDLE_THRESHOLD_MS) {
      level = clamp01(level + DREAD_INCREASE_RATE * dtSeconds);
    }
  }

  // Derive the light modifier from the current dread level
  const lightRadiusMod = 1.0 - level * DREAD_MAX_LIGHT_SHRINK;

  return { level, idleMs, lightRadiusMod };
}

// ---------------------------------------------------------------------------
// Derived queries
// ---------------------------------------------------------------------------

/**
 * Return the effective light radius in tiles after applying the dread modifier.
 * Renderer should multiply this by TILE_SIZE to get the pixel radius.
 */
export function getEffectiveLightRadius(dread: DreadState): number {
  return clamp(
    LIGHT_RADIUS_TILES * dread.lightRadiusMod,
    LIGHT_RADIUS_TILES * (1.0 - DREAD_MAX_LIGHT_SHRINK),
    LIGHT_RADIUS_TILES,
  );
}

/**
 * Return true when dread has risen high enough to trigger the heartbeat SFX.
 * The caller is responsible for deduplicating (i.e. only firing on the rising
 * edge — compare with the previous frame's value).
 */
export function shouldTriggerHeartbeat(dread: DreadState): boolean {
  return dread.level >= HEARTBEAT_START_DREAD;
}

/**
 * Return the dread level as a human-readable label.  Useful for debug HUD.
 */
export function getDreadLabel(dread: DreadState): string {
  if (dread.level < 0.2) return 'calm';
  if (dread.level < 0.4) return 'uneasy';
  if (dread.level < 0.6) return 'anxious';
  if (dread.level < 0.8) return 'fearful';
  return 'panic';
}

/**
 * Compute what opacity the grain/noise overlay should have at the current
 * dread level.  Returns a value in [baseOpacity, maxOpacity].
 *
 * @param baseOpacity  Grain opacity at zero dread (e.g. GRAIN_OPACITY_BASE).
 * @param maxOpacity   Grain opacity at full dread  (e.g. GRAIN_OPACITY_DREAD_MAX).
 */
export function getDreadGrainOpacity(
  dread: DreadState,
  baseOpacity: number,
  maxOpacity: number,
): number {
  return clamp(
    baseOpacity + (maxOpacity - baseOpacity) * dread.level,
    baseOpacity,
    maxOpacity,
  );
}

/**
 * Instantly reduce dread by `amount` (clamped to [0, 1]).
 * Useful for events that should partially relieve tension (e.g. finding a
 * landmark, completing a sub-objective).
 */
export function relieveDread(dread: DreadState, amount: number): DreadState {
  const level = clamp01(dread.level - amount);
  const lightRadiusMod = 1.0 - level * DREAD_MAX_LIGHT_SHRINK;
  return { ...dread, level, lightRadiusMod };
}
