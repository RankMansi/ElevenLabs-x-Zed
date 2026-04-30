import type { Maze, Point } from '../types/maze';
import { isReachable } from './pathfind';

/**
 * Verify the true exit is reachable from the player's current grid position.
 * This is the primary softlock guard — called after every shift.
 */
export function isSolvable(maze: Maze, playerPos: Point): boolean {
  return isReachable(maze, playerPos, maze.exit);
}

/**
 * Verify every decoy exit is reachable from the player's current position.
 * Used during maze generation validation to ensure fair game design
 * (decoys should tempt, not be phantom).
 */
export function allDecoyExitsReachable(maze: Maze, playerPos: Point): boolean {
  return maze.decoyExits.every(decoy => isReachable(maze, playerPos, decoy));
}

/**
 * Verify that every cell in the maze is reachable from the maze start.
 * A fully connected maze means the recursive backtracker ran correctly
 * and no isolated islands exist. This is O(width × height) BFS.
 */
export function isFullyConnected(maze: Maze): boolean {
  const reachable = countReachableCells(maze, maze.start);
  return reachable === maze.width * maze.height;
}

/**
 * Count how many distinct cells are reachable from `from` by walking through
 * open passages (wall booleans). Uses iterative BFS to avoid stack overflow
 * on large mazes.
 */
function countReachableCells(maze: Maze, from: Point): number {
  const visited = new Set<string>();
  const queue: Point[] = [{ x: from.x, y: from.y }];
  visited.add(`${from.x},${from.y}`);

  const dirs: Array<{ dx: number; dy: number; wall: 'north' | 'east' | 'south' | 'west' }> = [
    { dx:  0, dy: -1, wall: 'north' },
    { dx:  1, dy:  0, wall: 'east'  },
    { dx:  0, dy:  1, wall: 'south' },
    { dx: -1, dy:  0, wall: 'west'  },
  ];

  while (queue.length > 0) {
    const pos = queue.shift()!;
    const cell = maze.cells[pos.y]?.[pos.x];
    if (!cell) continue;

    for (const { dx, dy, wall } of dirs) {
      if (cell.walls[wall]) continue; // wall blocks passage

      const next: Point = { x: pos.x + dx, y: pos.y + dy };

      // Guard: neighbour must exist in the grid
      if (next.x < 0 || next.y < 0 || next.x >= maze.width || next.y >= maze.height) continue;

      const key = `${next.x},${next.y}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }

  return visited.size;
}

/**
 * Comprehensive validity report for a generated maze — useful in dev/debug.
 */
export interface MazeValidationReport {
  fullyConnected: boolean;
  exitReachableFromStart: boolean;
  decoyExitsReachableFromStart: boolean;
  reachableCellCount: number;
  totalCells: number;
}

export function validateMaze(maze: Maze): MazeValidationReport {
  const totalCells = maze.width * maze.height;
  const reachableCellCount = countReachableCells(maze, maze.start);

  return {
    fullyConnected: reachableCellCount === totalCells,
    exitReachableFromStart: isReachable(maze, maze.start, maze.exit),
    decoyExitsReachableFromStart: maze.decoyExits.every(d =>
      isReachable(maze, maze.start, d)
    ),
    reachableCellCount,
    totalCells,
  };
}
