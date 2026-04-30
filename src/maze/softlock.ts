import type { Maze, Point } from '../types/maze';
import { getCell } from './grid';
import { isReachable } from './pathfind';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DIRS: Array<{ dx: number; dy: number; wall: 'north' | 'east' | 'south' | 'west' }> = [
  { dx:  0, dy: -1, wall: 'north' },
  { dx:  1, dy:  0, wall: 'east'  },
  { dx:  0, dy:  1, wall: 'south' },
  { dx: -1, dy:  0, wall: 'west'  },
];

function key(p: Point): string {
  return `${p.x},${p.y}`;
}

function clampToMaze(maze: Maze, pos: Point): Point {
  return {
    x: Math.max(0, Math.min(maze.width  - 1, pos.x)),
    y: Math.max(0, Math.min(maze.height - 1, pos.y)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the nearest valid grid cell to `pos`.
 *
 * In this maze model walls exist *between* cells, not *inside* them, so every
 * grid cell is itself walkable.  The only case where a position needs nudging
 * is when the pixel-to-grid conversion produces out-of-bounds coordinates
 * (e.g. the player was standing near a border that moved inward during a
 * shift).  We clamp first, then do nothing extra.
 */
export function nudgeToNearestFreeCell(maze: Maze, pos: Point): Point {
  const clamped = clampToMaze(maze, pos);
  // Every in-bounds cell is inherently occupiable; return clamped position.
  const cell = getCell(maze, clamped.x, clamped.y);
  if (cell) return clamped;

  // Fallback: BFS outward from the clamped position to find a valid cell.
  const visited = new Set<string>();
  const queue: Point[] = [clamped];
  visited.add(key(clamped));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (getCell(maze, cur.x, cur.y)) return cur;

    for (const { dx, dy } of DIRS) {
      const next: Point = { x: cur.x + dx, y: cur.y + dy };
      const k = key(next);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push(next);
      }
    }
  }

  // Ultimate fallback: maze start is always valid.
  return { ...maze.start };
}

/**
 * Post-shift softlock validation.
 *
 * After the maze reconfigures its walls the player's current grid position
 * may no longer have a path to the exit.  This function:
 *   1. Nudges the position into bounds if necessary.
 *   2. Checks whether the exit is still reachable from the nudged position.
 *   3. If not, finds the closest reachable cell (via BFS from the exit) and
 *      returns it as the authoritative safe position.
 *
 * The caller is responsible for teleporting the player to `nudgedPos` when
 * `safe` is false.
 */
export function validatePostShift(
  maze: Maze,
  playerPos: Point,
): { safe: boolean; nudgedPos: Point } {
  const nudgedPos = nudgeToNearestFreeCell(maze, playerPos);

  if (isReachable(maze, nudgedPos, maze.exit)) {
    return { safe: true, nudgedPos };
  }

  // Exit no longer reachable — find the closest reachable position.
  const recoveryPos = findNearestReachablePoint(maze, nudgedPos);
  return { safe: false, nudgedPos: recoveryPos };
}

/**
 * BFS *backwards* from the maze exit to locate the cell that is:
 *   - reachable from the exit (and therefore on a valid path to it), AND
 *   - closest (Manhattan distance) to `from`.
 *
 * This is the anti-softlock recovery target when a shift cuts the player off
 * from the exit.  Running BFS from the exit rather than from the player
 * guarantees the returned cell always has a valid path outward.
 */
export function findNearestReachablePoint(maze: Maze, from: Point): Point {
  const visited = new Set<string>();
  const queue: Point[] = [{ ...maze.exit }];
  visited.add(key(maze.exit));

  let closest: Point  = { ...maze.exit };
  let closestDist: number = Infinity;

  while (queue.length > 0) {
    const pos = queue.shift()!;

    const dist = Math.abs(pos.x - from.x) + Math.abs(pos.y - from.y);
    if (dist < closestDist) {
      closestDist = dist;
      closest = { ...pos };
    }

    // Short-circuit: found the exact player position — can't do better.
    if (dist === 0) break;

    const cell = maze.cells[pos.y]?.[pos.x];
    if (!cell) continue;

    for (const { dx, dy, wall } of DIRS) {
      if (cell.walls[wall]) continue; // wall blocks passage

      const next: Point = { x: pos.x + dx, y: pos.y + dy };
      const k = key(next);

      if (!visited.has(k) && getCell(maze, next.x, next.y)) {
        visited.add(k);
        queue.push(next);
      }
    }
  }

  return closest;
}

/**
 * Return every cell that is reachable from the exit as a flat array.
 * Useful for debug overlays and editor tooling.
 */
export function reachableSetFromExit(maze: Maze): Point[] {
  const visited = new Set<string>();
  const queue: Point[] = [{ ...maze.exit }];
  visited.add(key(maze.exit));

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const cell = maze.cells[pos.y]?.[pos.x];
    if (!cell) continue;

    for (const { dx, dy, wall } of DIRS) {
      if (cell.walls[wall]) continue;

      const next: Point = { x: pos.x + dx, y: pos.y + dy };
      const k = key(next);

      if (!visited.has(k) && getCell(maze, next.x, next.y)) {
        visited.add(k);
        queue.push(next);
      }
    }
  }

  return Array.from(visited).map(k => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
  });
}
