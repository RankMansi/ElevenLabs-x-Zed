import type { PlayerState } from '../types/game';
import type { Point } from '../types/maze';
import {
  PLAYER_SPEED,
  PLAYER_SLOW_SPEED,
  PLAYER_SPRINT_SPEED,
  TILE_SIZE,
  STAMINA_MAX_MS,
  STAMINA_DRAIN_RATE,
  STAMINA_REGEN_RATE,
} from '../config/game';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the initial PlayerState for a run.
 * `startGrid` is a grid-space coordinate (column, row); the player is placed
 * at the pixel-space centre of that tile.
 */
export function createPlayer(startGrid: Point): PlayerState {
  return {
    position: {
      x: startGrid.x * TILE_SIZE + TILE_SIZE / 2,
      y: startGrid.y * TILE_SIZE + TILE_SIZE / 2,
    },
    velocity: { x: 0, y: 0 },
    facing: 'south',
    isSprinting: false,
    isSlowWalking: false,
    staminaMs: STAMINA_MAX_MS,
  };
}

// ---------------------------------------------------------------------------
// Grid position
// ---------------------------------------------------------------------------

/**
 * Convert the player's pixel-space position to integer grid coordinates.
 * Uses floor so the result is always the tile the player's centre occupies.
 */
export function getPlayerGridPos(player: PlayerState): Point {
  return {
    x: Math.floor(player.position.x / TILE_SIZE),
    y: Math.floor(player.position.y / TILE_SIZE),
  };
}

/**
 * Return the fractional offset (0..1) of the player inside their current tile.
 * Useful for smooth sub-tile rendering and wall-proximity tests.
 */
export function getPlayerTileOffset(player: PlayerState): { tx: number; ty: number } {
  return {
    tx: (player.position.x % TILE_SIZE) / TILE_SIZE,
    ty: (player.position.y % TILE_SIZE) / TILE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

/**
 * Return the current movement speed in **tiles per second** based on
 * the player's state flags.  Priority: slow-walk > sprint > normal.
 *
 * Slow-walk overrides sprint when both would apply.
 */
export function getPlayerSpeed(player: PlayerState): number {
  if (player.isSlowWalking) return PLAYER_SLOW_SPEED;
  if (player.isSprinting)   return PLAYER_SPRINT_SPEED;
  return PLAYER_SPEED;
}

// ---------------------------------------------------------------------------
// Facing
// ---------------------------------------------------------------------------

/**
 * Derive the cardinal facing direction from a movement delta (dx, dy).
 * If both axes are non-zero the dominant axis (larger absolute value) wins.
 * If the delta is zero the current facing is preserved.
 */
export function updateFacing(
  player: PlayerState,
  dx: number,
  dy: number,
): 'north' | 'east' | 'south' | 'west' {
  if (dx === 0 && dy === 0) return player.facing;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx >= absDy) {
    // Horizontal dominates (or equal — prefer horizontal for feel)
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}

// ---------------------------------------------------------------------------
// Stamina
// ---------------------------------------------------------------------------

/**
 * Update the player's stamina for one frame.
 *
 * - Sprinting drains stamina at `STAMINA_DRAIN_RATE` (fraction per second).
 * - Any non-sprinting state regenerates stamina at `STAMINA_REGEN_RATE`.
 * - Stamina is clamped to [0, STAMINA_MAX_MS].
 * - When stamina hits 0 the sprint flag is automatically cleared
 *   (the caller should also clear `isSprinting` on the input layer).
 *
 * Returns the updated stamina value and whether sprinting is still possible.
 */
export function updateStamina(
  player: PlayerState,
  dtSeconds: number,
): { staminaMs: number; canSprint: boolean } {
  let { staminaMs } = player;

  if (player.isSprinting && !player.isSlowWalking) {
    // Drain at the configured rate
    staminaMs -= STAMINA_DRAIN_RATE * STAMINA_MAX_MS * dtSeconds;
  } else {
    // Regen when not sprinting
    staminaMs += STAMINA_REGEN_RATE * STAMINA_MAX_MS * dtSeconds;
  }

  staminaMs = Math.max(0, Math.min(STAMINA_MAX_MS, staminaMs));
  const canSprint = staminaMs > 0;

  return { staminaMs, canSprint };
}

/**
 * Return the stamina level as a normalised fraction in [0, 1].
 * Convenient for rendering the HUD bar.
 */
export function getStaminaFraction(player: PlayerState): number {
  return Math.max(0, Math.min(1, player.staminaMs / STAMINA_MAX_MS));
}

// ---------------------------------------------------------------------------
// State predicates
// ---------------------------------------------------------------------------

/** True when the player is actively moving (non-zero velocity). */
export function isPlayerMoving(player: PlayerState): boolean {
  return player.velocity.x !== 0 || player.velocity.y !== 0;
}

/** True when the player is sprinting AND has remaining stamina. */
export function isEffectivelySprinting(player: PlayerState): boolean {
  return player.isSprinting && !player.isSlowWalking && player.staminaMs > 0;
}
