import type { SpatialPoint } from '../types/audio';
import { TILE_SIZE } from '../config/game';
import { clamp } from '../utils/clamp';

export interface Spatial2DParams {
  pan: number;    // -1 (left) .. +1 (right)
  volume: number; // 0 .. 1
}

const MAX_AUDIBLE_TILES = 18;
const MAX_AUDIBLE_DIST  = MAX_AUDIBLE_TILES * TILE_SIZE;
const HUM_MAX_TILES     = 14;
const HUM_MAX_DIST      = HUM_MAX_TILES * TILE_SIZE;

/**
 * Compute stereo pan and volume from a player world-position to a target
 * world-position.  All positions are in pixels (1 tile = TILE_SIZE px).
 *
 * @param playerPos  Player world position (pixels)
 * @param targetPos  Target world position (pixels)
 * @param maxDist    Maximum audible distance (pixels).  Defaults to 18 tiles.
 */
export function computeSpatial(
  playerPos: SpatialPoint,
  targetPos: SpatialPoint,
  maxDist = MAX_AUDIBLE_DIST,
): Spatial2DParams {
  const dx   = targetPos.x - playerPos.x;
  const dy   = targetPos.y - playerPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Linear fall-off — hits 0 at maxDist
  const volume = clamp(1 - dist / maxDist, 0, 1);

  // Stereo pan: full-left when target is maxDist/2 to the left, vice versa
  const pan = clamp(dx / (maxDist * 0.5), -1, 1);

  return { pan, volume };
}

/**
 * Specialised variant for the gate/exit hum loop — shorter audible range.
 */
export function computeHumSpatial(
  playerPos: SpatialPoint,
  humPos: SpatialPoint,
): Spatial2DParams {
  return computeSpatial(playerPos, humPos, HUM_MAX_DIST);
}

/**
 * Quick distance helper in world-pixels.
 */
export function worldDistance(a: SpatialPoint, b: SpatialPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert world-pixel distance to approximate tile count.
 */
export function pixelsToTiles(px: number): number {
  return px / TILE_SIZE;
}
