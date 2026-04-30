import type { Maze, Cell, Point } from '../types/maze';
import { createEmptyGrid, getNeighbors, removeWall } from './grid';

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// Fast, high-quality 32-bit PRNG. Deterministic for a given seed.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed >>> 0; // ensure unsigned 32-bit
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

// ---------------------------------------------------------------------------
// Array shuffle (Fisher-Yates, in-place on a copy)
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// ---------------------------------------------------------------------------
// Recursive backtracker (iterative to avoid call-stack limits on large mazes)
// ---------------------------------------------------------------------------

function recursiveBacktrack(
  maze: Maze,
  startX: number,
  startY: number,
  rand: () => number,
): void {
  // Iterative DFS using an explicit stack to avoid stack-overflow on large grids
  const stack: Cell[] = [];
  const startCell = maze.cells[startY][startX];
  startCell.visited = true;
  stack.push(startCell);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    // Collect all unvisited neighbours
    const unvisitedNeighbours = getNeighbors(maze, current).filter(
      ({ cell }) => !cell.visited,
    );

    if (unvisitedNeighbours.length === 0) {
      // Dead end — backtrack
      stack.pop();
    } else {
      // Pick a random unvisited neighbour
      const shuffled = shuffleArray(unvisitedNeighbours, rand);
      const { cell: next, direction } = shuffled[0];

      // Carve the passage (removes wall on both sides)
      removeWall(maze, current, next, direction);
      next.visited = true;
      stack.push(next);
    }
  }
}

// ---------------------------------------------------------------------------
// Public options and generate function
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  /** Maze width in tiles (columns). */
  width: number;
  /** Maze height in tiles (rows). */
  height: number;
  /** Seed for the PRNG — same seed always produces identical mazes. */
  seed: number;
  /** How many decoy exits to place on the perimeter (default 0). */
  decoyExitCount?: number;
}

/**
 * Generate a fully-connected, solvable maze using the recursive backtracker
 * algorithm.  Start is always (0, 0); the true exit is always
 * (width-1, height-1).  Decoy exits are scattered on the perimeter.
 */
export function generateMaze(opts: GenerateOptions): Maze {
  const { width, height, seed, decoyExitCount = 0 } = opts;
  const rand = mulberry32(seed);

  // --- Allocate the grid ---
  const cells = createEmptyGrid(width, height);

  const maze: Maze = {
    width,
    height,
    cells,
    start: { x: 0, y: 0 },
    exit: { x: width - 1, y: height - 1 },
    decoyExits: [],
  };

  // --- Carve passages ---
  recursiveBacktrack(maze, 0, 0, rand);

  // --- Clear visited flags (they were only needed for generation) ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      maze.cells[y][x].visited = false;
    }
  }

  // --- Mark special cells ---
  maze.cells[0][0].isStart = true;
  maze.cells[height - 1][width - 1].isExit = true;

  // Canonical references
  maze.start = { x: 0, y: 0 };
  maze.exit  = { x: width - 1, y: height - 1 };

  // --- Place decoy exits on the perimeter ---
  if (decoyExitCount > 0) {
    const candidates: Point[] = collectPerimeterCandidates(maze);
    const shuffled = shuffleArray(candidates, rand);

    for (let i = 0; i < Math.min(decoyExitCount, shuffled.length); i++) {
      const { x, y } = shuffled[i];
      maze.cells[y][x].isDecoyExit = true;
      maze.decoyExits.push({ x, y });
    }
  }

  return maze;
}

/**
 * Collect all perimeter cells except the real start and exit,
 * to serve as candidates for decoy exit placement.
 */
function collectPerimeterCandidates(maze: Maze): Point[] {
  const { width, height } = maze;
  const candidates: Point[] = [];
  const isStart = (x: number, y: number) => x === 0 && y === 0;
  const isExit  = (x: number, y: number) => x === width - 1 && y === height - 1;

  // Top row
  for (let x = 0; x < width; x++) {
    if (!isStart(x, 0) && !isExit(x, 0)) candidates.push({ x, y: 0 });
  }
  // Bottom row
  for (let x = 0; x < width; x++) {
    if (!isStart(x, height - 1) && !isExit(x, height - 1))
      candidates.push({ x, y: height - 1 });
  }
  // Left column (excluding corners already added)
  for (let y = 1; y < height - 1; y++) {
    if (!isStart(0, y) && !isExit(0, y)) candidates.push({ x: 0, y });
  }
  // Right column (excluding corners already added)
  for (let y = 1; y < height - 1; y++) {
    if (!isStart(width - 1, y) && !isExit(width - 1, y))
      candidates.push({ x: width - 1, y });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Clone helper — deep-copy maze without re-generating
// ---------------------------------------------------------------------------

/**
 * Return a fully independent deep copy of `maze`.
 * All cell wall objects and the decoyExits array are cloned;
 * structural scalars (width, height, start, exit) are copied by value.
 */
export function cloneMaze(maze: Maze): Maze {
  return {
    width:      maze.width,
    height:     maze.height,
    start:      { x: maze.start.x, y: maze.start.y },
    exit:       { x: maze.exit.x,  y: maze.exit.y  },
    decoyExits: maze.decoyExits.map(p => ({ x: p.x, y: p.y })),
    cells: maze.cells.map(row =>
      row.map(cell => ({
        x:           cell.x,
        y:           cell.y,
        visited:     cell.visited,
        isExit:      cell.isExit,
        isDecoyExit: cell.isDecoyExit,
        isStart:     cell.isStart,
        walls: {
          north: cell.walls.north,
          east:  cell.walls.east,
          south: cell.walls.south,
          west:  cell.walls.west,
        },
      })),
    ),
  };
}
