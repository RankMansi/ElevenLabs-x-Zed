import type { Maze, Point } from '../types/maze';
import { getCell } from './grid';

const DIRS: Array<{ dx: number; dy: number; wall: 'north' | 'east' | 'south' | 'west' }> = [
  { dx:  0, dy: -1, wall: 'north' },
  { dx:  1, dy:  0, wall: 'east'  },
  { dx:  0, dy:  1, wall: 'south' },
  { dx: -1, dy:  0, wall: 'west'  },
];

function key(p: Point): string {
  return `${p.x},${p.y}`;
}

/**
 * BFS from `from` to `to` through the maze's wall graph.
 * Returns the full path (inclusive of start and end) or null if unreachable.
 */
export function bfsPath(maze: Maze, from: Point, to: Point): Point[] | null {
  const startKey = key(from);
  const goalKey  = key(to);

  if (startKey === goalKey) return [{ ...from }];

  // Guard: both endpoints must be valid cells
  if (!getCell(maze, from.x, from.y)) return null;
  if (!getCell(maze, to.x,   to.y  )) return null;

  // parent map: each visited key → the point we came from
  const parent = new Map<string, Point | null>();
  parent.set(startKey, null);

  const queue: Point[] = [{ ...from }];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const posKey = key(pos);

    if (posKey === goalKey) {
      // Reconstruct path by walking back through parent map
      const path: Point[] = [];
      let cur: Point | null = pos;
      while (cur !== null) {
        path.push({ ...cur });
        cur = parent.get(key(cur)) ?? null;
      }
      return path.reverse();
    }

    const cell = getCell(maze, pos.x, pos.y);
    if (!cell) continue;

    for (const { dx, dy, wall } of DIRS) {
      if (cell.walls[wall]) continue; // wall blocks passage

      const next: Point = { x: pos.x + dx, y: pos.y + dy };
      const nextKey = key(next);

      if (!parent.has(nextKey) && getCell(maze, next.x, next.y)) {
        parent.set(nextKey, pos);
        queue.push(next);
      }
    }
  }

  return null; // destination unreachable
}

/**
 * Returns true if `to` is reachable from `from` in the current maze state.
 */
export function isReachable(maze: Maze, from: Point, to: Point): boolean {
  return bfsPath(maze, from, to) !== null;
}

/**
 * Returns the number of steps (edges) in the shortest path, or -1 if unreachable.
 * A path of length 1 (same cell) returns 0.
 */
export function shortestPathLength(maze: Maze, from: Point, to: Point): number {
  const path = bfsPath(maze, from, to);
  if (path === null) return -1;
  return path.length - 1; // edges = nodes - 1
}

/**
 * BFS that returns only distances (not full paths) for every reachable cell from `from`.
 * Useful for heatmaps / proximity calculations without the path reconstruction overhead.
 */
export function bfsDistanceMap(maze: Maze, from: Point): Map<string, number> {
  const dist = new Map<string, number>();
  const startKey = key(from);

  if (!getCell(maze, from.x, from.y)) return dist;

  dist.set(startKey, 0);
  const queue: Array<{ pos: Point; d: number }> = [{ pos: { ...from }, d: 0 }];

  while (queue.length > 0) {
    const { pos, d } = queue.shift()!;
    const cell = getCell(maze, pos.x, pos.y);
    if (!cell) continue;

    for (const { dx, dy, wall } of DIRS) {
      if (cell.walls[wall]) continue;

      const next: Point = { x: pos.x + dx, y: pos.y + dy };
      const nextKey = key(next);

      if (!dist.has(nextKey) && getCell(maze, next.x, next.y)) {
        dist.set(nextKey, d + 1);
        queue.push({ pos: next, d: d + 1 });
      }
    }
  }

  return dist;
}
