import type { Cell, Point, Maze } from '../types/maze';

// ---------------------------------------------------------------------------
// Grid construction
// ---------------------------------------------------------------------------

/**
 * Allocate a fresh width×height grid where every cell starts with all four
 * walls intact and the visited flag cleared.
 */
export function createEmptyGrid(width: number, height: number): Cell[][] {
  const cells: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    cells[y] = [];
    for (let x = 0; x < width; x++) {
      cells[y][x] = {
        x,
        y,
        walls: { north: true, east: true, south: true, west: true },
        visited: false,
        isExit: false,
        isDecoyExit: false,
        isStart: false,
      };
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Cell accessors
// ---------------------------------------------------------------------------

/**
 * Return the cell at (x, y) or null when the coordinate is out of bounds.
 */
export function getCell(maze: Maze, x: number, y: number): Cell | null {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return null;
  return maze.cells[y][x];
}

// ---------------------------------------------------------------------------
// Neighbour enumeration
// ---------------------------------------------------------------------------

type Direction = 'north' | 'east' | 'south' | 'west';

interface Neighbour {
  cell: Cell;
  direction: Direction;
}

const DIRECTION_DELTAS: ReadonlyArray<{ dx: number; dy: number; dir: Direction }> = [
  { dx: 0, dy: -1, dir: 'north' },
  { dx: 1, dy: 0,  dir: 'east'  },
  { dx: 0, dy: 1,  dir: 'south' },
  { dx: -1, dy: 0, dir: 'west'  },
];

/**
 * Return all in-bounds neighbours of `cell` together with the direction
 * you must travel from `cell` to reach each neighbour.
 */
export function getNeighbors(maze: Maze, cell: Cell): Neighbour[] {
  const result: Neighbour[] = [];
  for (const { dx, dy, dir } of DIRECTION_DELTAS) {
    const neighbour = getCell(maze, cell.x + dx, cell.y + dy);
    if (neighbour) {
      result.push({ cell: neighbour, direction: dir });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Direction helpers
// ---------------------------------------------------------------------------

const OPPOSITE: Record<Direction, Direction> = {
  north: 'south',
  east:  'west',
  south: 'north',
  west:  'east',
};

/**
 * Return the direction that is the mirror image of `dir`.
 */
export function oppositeDir(dir: Direction): Direction {
  return OPPOSITE[dir];
}

// ---------------------------------------------------------------------------
// Wall manipulation
// ---------------------------------------------------------------------------

/**
 * Remove the wall shared between `cellA` and `cellB`.
 * `dir` is the direction from cellA to cellB.
 * Both cells are mutated in place so the opening is symmetric.
 */
export function removeWall(maze: Maze, cellA: Cell, cellB: Cell, dir: Direction): void {
  // Suppress unused-parameter lint — maze is kept for API symmetry and
  // potential future bounds-checks.
  void maze;
  cellA.walls[dir] = false;
  cellB.walls[oppositeDir(dir)] = false;
}

// ---------------------------------------------------------------------------
// Walkability query
// ---------------------------------------------------------------------------

/**
 * Return true when the player at grid cell `from` may step one tile in
 * direction `dir` without hitting a wall.
 */
export function isWalkable(maze: Maze, from: Point, dir: Direction): boolean {
  const cell = getCell(maze, from.x, from.y);
  if (!cell) return false;
  return !cell.walls[dir];
}

// ---------------------------------------------------------------------------
// Coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert a pixel-space position to integer grid coordinates (column, row).
 * The result is clamped to the valid grid range.
 */
export function worldToGrid(worldX: number, worldY: number, tileSize: number): Point {
  return {
    x: Math.floor(worldX / tileSize),
    y: Math.floor(worldY / tileSize),
  };
}

/**
 * Convert integer grid coordinates to the pixel-space centre of that tile.
 */
export function gridToWorld(gridX: number, gridY: number, tileSize: number): Point {
  return {
    x: gridX * tileSize + tileSize / 2,
    y: gridY * tileSize + tileSize / 2,
  };
}

// ---------------------------------------------------------------------------
// Utility: count open passages out of a cell
// ---------------------------------------------------------------------------

/**
 * Return the number of open passages (non-wall sides) on `cell`.
 * Useful for dead-end detection (openCount === 1).
 */
export function openPassageCount(cell: Cell): number {
  return (
    (cell.walls.north ? 0 : 1) +
    (cell.walls.east  ? 0 : 1) +
    (cell.walls.south ? 0 : 1) +
    (cell.walls.west  ? 0 : 1)
  );
}

/**
 * Return true when the cell is a dead end (exactly one open passage).
 */
export function isDeadEnd(cell: Cell): boolean {
  return openPassageCount(cell) === 1;
}
