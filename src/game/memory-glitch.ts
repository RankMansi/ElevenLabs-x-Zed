import { GHOST_WALL_DURATION_MS, GHOST_WALL_ALPHA } from "../config/game";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tracks the state of the "memory glitch" effect that briefly renders ghost
 * walls after a maze shift — showing the player where walls *used* to be.
 *
 * `active`      — whether the effect is currently running.
 * `remainingMs` — milliseconds left before the effect ends.
 * `alpha`       — current draw opacity (fades linearly from GHOST_WALL_ALPHA → 0).
 */
export interface MemoryGlitchState {
  active: boolean;
  remainingMs: number;
  alpha: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Return a freshly initialised, inactive glitch state.
 * Call this once when a run is first created.
 */
export function createMemoryGlitch(): MemoryGlitchState {
  return {
    active: false,
    remainingMs: 0,
    alpha: 0,
  };
}

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

/**
 * Fire the ghost-wall effect.  Returns a new state with the full timer set
 * and alpha at its peak value.  Call this immediately after every maze shift.
 *
 * The returned state is immutable — the original is not mutated.
 */
export function triggerMemoryGlitch(): MemoryGlitchState {
  return {
    active: true,
    remainingMs: GHOST_WALL_DURATION_MS,
    alpha: GHOST_WALL_ALPHA,
  };
}

// ---------------------------------------------------------------------------
// Per-frame update
// ---------------------------------------------------------------------------

/**
 * Advance the glitch state by `dtMs` milliseconds.
 *
 * Alpha decays linearly:
 *   alpha(t) = GHOST_WALL_ALPHA × (remainingMs / GHOST_WALL_DURATION_MS)
 *
 * Once `remainingMs` reaches zero the effect becomes inactive and alpha is
 * clamped to 0.  If the state is already inactive the call is a no-op.
 *
 * This function is pure — it always returns a new object and never mutates
 * the input, making it safe to use inside React state or immutable stores.
 *
 * @param state - Current glitch state.
 * @param dtMs  - Delta time in milliseconds since the last frame.
 */
export function updateMemoryGlitch(
  state: MemoryGlitchState,
  dtMs: number,
): MemoryGlitchState {
  if (!state.active) return state;

  const remaining = Math.max(0, state.remainingMs - dtMs);

  if (remaining === 0) {
    return { active: false, remainingMs: 0, alpha: 0 };
  }

  // Linear fade: full opacity at trigger, zero at expiry
  const alpha = GHOST_WALL_ALPHA * (remaining / GHOST_WALL_DURATION_MS);

  return {
    active: true,
    remainingMs: remaining,
    alpha,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * True when the ghost-wall layer should be drawn this frame.
 * Convenience wrapper so callers don't need to import the type.
 */
export function isGlitchVisible(state: MemoryGlitchState): boolean {
  return state.active && state.alpha > 0;
}

/**
 * Return the fraction of the effect's lifetime that has elapsed (0 → 1).
 * 0 = just triggered, 1 = fully expired.
 * Useful for driving additional visual flourishes (e.g. scanline intensity).
 */
export function glitchProgress(state: MemoryGlitchState): number {
  if (!state.active || state.remainingMs <= 0) return 1;
  return 1 - state.remainingMs / GHOST_WALL_DURATION_MS;
}
