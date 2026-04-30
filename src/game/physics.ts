import type { PlayerState } from '../types/game';
import type { Maze, Point } from '../types/maze';
import { TILE_SIZE } from '../config/game';
import { getCell } from '../maze/grid';
import { getPlayerSpeed, updateFacing } from './player';
import { clamp } from '../utils/clamp';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Half-width of the player's square hitbox in pixels. */
const PLAYER_HALF = TILE_SIZE * 0.28;

/** Keeps grid index math stable at tile edges (float noise). */
const EDGE_EPS = 1e-4;

// ---------------------------------------------------------------------------
// Public: move + collide
// ---------------------------------------------------------------------------

/**
 * Advance the player by one simulation step.
 *
 * - `dx` / `dy` are normalised input directions in the range [-1, 1].
 * - Diagonal input is pre-normalised by the caller so speed is consistent.
 * - Collision is resolved by two independent axis sweeps (slide behaviour).
 */
export function movePlayer(
  player: PlayerState,
  maze: Maze,
  dx: number,
  dy: number,
  dtSeconds: number,
): PlayerState {
  // Speed is in tiles/second; convert to pixels/second.
  const speed = getPlayerSpeed(player) * TILE_SIZE;

  const vx = dx * speed;
  const vy = dy * speed;

  const px = player.position.x;
  const py = player.position.y;

  // Two-pass resolution: move each axis independently so the player slides
  // along walls rather than getting stuck at corners.
  const afterX = resolveX(maze, px, py, px + vx * dtSeconds);
  const afterY = resolveY(maze, afterX.x, afterX.y, afterX.y + vy * dtSeconds);

  const facing =
    dx !== 0 || dy !== 0 ? updateFacing(player, dx, dy) : player.facing;

  return {
    ...player,
    position: { x: afterX.x, y: afterY.y },
    velocity: { x: vx, y: vy },
    facing,
  };
}

// ---------------------------------------------------------------------------
// Axis-separated collision resolution
// ---------------------------------------------------------------------------

/**
 * Resolve movement along the X axis only.
 * `py` is the current (already-resolved) Y; only `newX` changes.
 *
 * Wall checks must use every tile column the hitbox spans. If we only looked at
 * the cell containing the leading edge, crossing a boundary would read the
 * neighbour's *outer* wall (e.g. `east` on the cell to the right) instead of
 * the shared seam (`east` on the left cell == `west` on the right).
 */
function resolveX(maze: Maze, px: number, py: number, newX: number): Point {
  let rx = clamp(newX, PLAYER_HALF, maze.width * TILE_SIZE - PLAYER_HALF);

  const topY = py - PLAYER_HALF;
  const botY = py + PLAYER_HALF;

  if (rx > px) {
    for (const sampleY of sampleRows(topY, botY)) {
      const cy = Math.floor(sampleY / TILE_SIZE);
      const leftCol = Math.floor((px - PLAYER_HALF + EDGE_EPS) / TILE_SIZE);
      const rightCol = Math.floor((rx + PLAYER_HALF - EDGE_EPS) / TILE_SIZE);
      for (let col = leftCol; col <= rightCol; col++) {
        const cell = getCell(maze, col, cy);
        if (cell?.walls.east) {
          const wallPixel = (col + 1) * TILE_SIZE;
          rx = Math.min(rx, wallPixel - PLAYER_HALF - EDGE_EPS);
        }
      }
    }
  }

  if (rx < px) {
    for (const sampleY of sampleRows(topY, botY)) {
      const cy = Math.floor(sampleY / TILE_SIZE);
      const leftCol = Math.floor((rx - PLAYER_HALF + EDGE_EPS) / TILE_SIZE);
      const rightCol = Math.floor((px + PLAYER_HALF - EDGE_EPS) / TILE_SIZE);
      for (let col = leftCol; col <= rightCol; col++) {
        const cell = getCell(maze, col, cy);
        if (cell?.walls.west) {
          const wallPixel = col * TILE_SIZE;
          rx = Math.max(rx, wallPixel + PLAYER_HALF + EDGE_EPS);
        }
      }
    }
  }

  return { x: rx, y: py };
}

/**
 * Resolve movement along the Y axis only.
 * `px` is the already-resolved X; only `newY` changes.
 *
 * Same seam rule as `resolveX`: iterate every tile row the hitbox spans so we
 * test `south` / `north` on the cells that actually own the edges crossed.
 */
function resolveY(maze: Maze, px: number, py: number, newY: number): Point {
  let ry = clamp(newY, PLAYER_HALF, maze.height * TILE_SIZE - PLAYER_HALF);

  const leftX = px - PLAYER_HALF;
  const rightX = px + PLAYER_HALF;

  if (ry > py) {
    for (const sampleX of sampleCols(leftX, rightX)) {
      const cx = Math.floor(sampleX / TILE_SIZE);
      const topRow = Math.floor((py - PLAYER_HALF + EDGE_EPS) / TILE_SIZE);
      const botRow = Math.floor((ry + PLAYER_HALF - EDGE_EPS) / TILE_SIZE);
      for (let row = topRow; row <= botRow; row++) {
        const cell = getCell(maze, cx, row);
        if (cell?.walls.south) {
          const wallPixel = (row + 1) * TILE_SIZE;
          ry = Math.min(ry, wallPixel - PLAYER_HALF - EDGE_EPS);
        }
      }
    }
  }

  if (ry < py) {
    for (const sampleX of sampleCols(leftX, rightX)) {
      const cx = Math.floor(sampleX / TILE_SIZE);
      const topRow = Math.floor((ry - PLAYER_HALF + EDGE_EPS) / TILE_SIZE);
      const botRow = Math.floor((py + PLAYER_HALF - EDGE_EPS) / TILE_SIZE);
      for (let row = topRow; row <= botRow; row++) {
        const cell = getCell(maze, cx, row);
        if (cell?.walls.north) {
          const wallPixel = row * TILE_SIZE;
          ry = Math.max(ry, wallPixel + PLAYER_HALF + EDGE_EPS);
        }
      }
    }
  }

  return { x: px, y: ry };
}

// ---------------------------------------------------------------------------
// Hitbox edge sampling
// ---------------------------------------------------------------------------

/**
 * Return Y sample points spanning the player's hitbox top-to-bottom.
 * We sample at the top edge, bottom edge, and the centre to ensure we catch
 * walls even when the hitbox spans two rows.
 */
function sampleRows(topY: number, botY: number): number[] {
  const midY = (topY + botY) / 2;
  return [topY + 0.5, midY, botY - 0.5];
}

/**
 * Return X sample points spanning the player's hitbox left-to-right.
 */
function sampleCols(leftX: number, rightX: number): number[] {
  const midX = (leftX + rightX) / 2;
  return [leftX + 0.5, midX, rightX - 0.5];
}

// ---------------------------------------------------------------------------
// Public: exit / decoy-exit collision
// ---------------------------------------------------------------------------

/**
 * Return true when the player's centre is inside the true exit tile.
 */
export function checkExitCollision(player: PlayerState, maze: Maze): boolean {
  const gx = Math.floor(player.position.x / TILE_SIZE);
  const gy = Math.floor(player.position.y / TILE_SIZE);
  return gx === maze.exit.x && gy === maze.exit.y;
}

/**
 * Return true when the player's centre is inside any decoy exit tile.
 */
export function checkDecoyExitCollision(player: PlayerState, maze: Maze): boolean {
  const gx = Math.floor(player.position.x / TILE_SIZE);
  const gy = Math.floor(player.position.y / TILE_SIZE);
  return maze.decoyExits.some(d => d.x === gx && d.y === gy);
}

/**
 * Return which decoy exit tile the player is standing in, or null.
 * Useful for playing per-decoy audio cues.
 */
export function getDecoyExitAt(player: PlayerState, maze: Maze): Point | null {
  const gx = Math.floor(player.position.x / TILE_SIZE);
  const gy = Math.floor(player.position.y / TILE_SIZE);
  return maze.decoyExits.find(d => d.x === gx && d.y === gy) ?? null;
}

/**
 * Pixel-space distance from the player's centre to the centre of a grid tile.
 */
export function distanceToTile(player: PlayerState, tile: Point): number {
  const tx = (tile.x + 0.5) * TILE_SIZE;
  const ty = (tile.y + 0.5) * TILE_SIZE;
  const dx = player.position.x - tx;
  const dy = player.position.y - ty;
  return Math.sqrt(dx * dx + dy * dy);
}
