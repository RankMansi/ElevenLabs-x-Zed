import type { Maze } from '../types/maze';
import type { SpatialPoint } from '../types/audio';
import { TILE_SIZE } from '../config/game';

// ---------------------------------------------------------------------------
// Interest point container
// ---------------------------------------------------------------------------

export interface InterestPoints {
  /** Pixel-space centre of the true exit cell. */
  exit: SpatialPoint;
  /** Pixel-space centres of every decoy exit. */
  decoys: SpatialPoint[];
  /**
   * The decoy exit whose pixel centre is closest to the player at query time,
   * or null when no decoys exist.  This is a snapshot — re-call
   * `getInterestPoints` (or `nearestDecoy`) each frame if you need it live.
   */
  nearestDecoy: SpatialPoint | null;
}

// ---------------------------------------------------------------------------
// Grid → pixel helpers
// ---------------------------------------------------------------------------

/**
 * Convert a grid column/row pair to the pixel-space centre of that tile.
 */
function tileCentre(gridX: number, gridY: number): SpatialPoint {
  return {
    x: (gridX + 0.5) * TILE_SIZE,
    y: (gridY + 0.5) * TILE_SIZE,
  };
}

// ---------------------------------------------------------------------------
// Primary export: snapshot all interest points for a maze
// ---------------------------------------------------------------------------

/**
 * Return the pixel-space positions of the exit and all decoy exits.
 * The `nearestDecoy` field is computed relative to the exit itself (since we
 * don't have the live player position here).  Callers that need proximity to
 * the player should use `nearestDecoyToPlayer` instead.
 */
export function getInterestPoints(maze: Maze): InterestPoints {
  const exit = tileCentre(maze.exit.x, maze.exit.y);

  const decoys: SpatialPoint[] = maze.decoyExits.map(d =>
    tileCentre(d.x, d.y),
  );

  const nearestDecoy = decoys.length > 0
    ? decoys.reduce<SpatialPoint>((best, d) =>
        distanceBetween(d, exit) < distanceBetween(best, exit) ? d : best,
      decoys[0],
    )
    : null;

  return { exit, decoys, nearestDecoy };
}

/**
 * Return the decoy exit closest to the given player position, or null if there
 * are none.
 */
export function nearestDecoyToPlayer(
  maze: Maze,
  playerPixel: SpatialPoint,
): SpatialPoint | null {
  if (maze.decoyExits.length === 0) return null;

  let closest: SpatialPoint | null = null;
  let closestDist = Infinity;

  for (const d of maze.decoyExits) {
    const centre = tileCentre(d.x, d.y);
    const dist = distanceBetween(centre, playerPixel);
    if (dist < closestDist) {
      closestDist = dist;
      closest = centre;
    }
  }

  return closest;
}

// ---------------------------------------------------------------------------
// Distance / vector utilities
// ---------------------------------------------------------------------------

/**
 * Euclidean distance between two pixel-space points.
 */
export function distanceBetween(a: SpatialPoint, b: SpatialPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalised direction vector from `from` to `to`, along with the raw distance.
 * When the two points coincide the direction is (0, 0) and dist is 0.
 */
export function vectorTo(
  from: SpatialPoint,
  to:   SpatialPoint,
): { dx: number; dy: number; dist: number } {
  const rawDx = to.x - from.x;
  const rawDy = to.y - from.y;
  const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  if (dist === 0) return { dx: 0, dy: 0, dist: 0 };
  return { dx: rawDx / dist, dy: rawDy / dist, dist };
}

// ---------------------------------------------------------------------------
// Spatial audio helpers
// ---------------------------------------------------------------------------

/**
 * Compute a stereo pan value in the range [-1, 1] based on the horizontal
 * offset from the player to the target.
 *
 *   -1 = fully left   0 = centre   +1 = fully right
 *
 * The pan saturates at ± `maxDistTiles` tiles from the player.
 *
 * @param playerPos    - Player pixel-space position.
 * @param targetPos    - Target pixel-space position (exit, decoy, etc.).
 * @param maxDistTiles - Horizontal distance (in tiles) that maps to full pan.
 *                       Defaults to 20 tiles.
 */
export function getPan(
  playerPos:    SpatialPoint,
  targetPos:    SpatialPoint,
  maxDistTiles  = 20,
): number {
  const dx       = targetPos.x - playerPos.x;
  const maxPixel = maxDistTiles * TILE_SIZE;
  return Math.max(-1, Math.min(1, dx / maxPixel));
}

/**
 * Compute a linear volume scalar in [0, 1] based on distance.
 *
 *   1.0 = player is at the target
 *   0.0 = player is at or beyond `maxDist` pixels away
 *
 * Uses a linear falloff curve.  For a more realistic rolloff pass in a smaller
 * `maxDist` or apply a power curve on the result in the caller.
 *
 * @param playerPos - Player pixel-space position.
 * @param targetPos - Target pixel-space position.
 * @param maxDist   - Distance (pixels) at which volume reaches 0.
 *                    Defaults to 20 tiles.
 */
export function getVolume(
  playerPos: SpatialPoint,
  targetPos: SpatialPoint,
  maxDist   = 20 * TILE_SIZE,
): number {
  const dist = distanceBetween(playerPos, targetPos);
  return Math.max(0, 1 - dist / maxDist);
}

/**
 * Combined spatial audio parameters for a single source.
 * Pass `pan` to `AudioNode.pannerNode` or a `StereoPannerNode`,
 * and `volume` to the source `GainNode`.
 */
export interface SpatialAudioParams {
  pan:    number; // [-1, 1]
  volume: number; // [0,  1]
}

/**
 * Compute pan + volume for a given source relative to the player in one call.
 *
 * @param playerPos    - Player pixel-space position.
 * @param sourcePos    - Audio source pixel-space position.
 * @param maxDistTiles - Tiles at which both pan and volume saturate/zero.
 */
export function getSpatialAudioParams(
  playerPos:    SpatialPoint,
  sourcePos:    SpatialPoint,
  maxDistTiles  = 20,
): SpatialAudioParams {
  return {
    pan:    getPan(playerPos, sourcePos, maxDistTiles),
    volume: getVolume(playerPos, sourcePos, maxDistTiles * TILE_SIZE),
  };
}
