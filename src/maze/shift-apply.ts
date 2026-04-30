import type { Maze, MazeState, WallToggle } from '../types/maze';
import { cloneMaze } from './generate';

// ---------------------------------------------------------------------------
// Direction mirroring
// ---------------------------------------------------------------------------

const NEIGHBOR_MAP = {
  north: { dx:  0, dy: -1, neighborWall: 'south' as const },
  east:  { dx:  1, dy:  0, neighborWall: 'west'  as const },
  south: { dx:  0, dy:  1, neighborWall: 'north' as const },
  west:  { dx: -1, dy:  0, neighborWall: 'east'  as const },
} as const;

// ---------------------------------------------------------------------------
// Core toggle applicator
// ---------------------------------------------------------------------------

/**
 * Apply a list of wall toggles to a deep-clone of `baseMaze` and return the
 * resulting maze.  Each toggle is symmetric — the neighbour cell's matching
 * wall is updated automatically so the graph never has one-sided openings.
 *
 * Toggles referencing out-of-bounds cells are silently skipped.
 */
export function applyWallToggles(baseMaze: Maze, toggles: WallToggle[]): Maze {
  const maze = cloneMaze(baseMaze);

  for (const toggle of toggles) {
    const { cell: pt, wall, open } = toggle;

    const cell = maze.cells[pt.y]?.[pt.x];
    if (!cell) continue; // out-of-bounds guard

    // open: true  → remove wall (false)
    // open: false → add wall    (true)
    cell.walls[wall] = !open;

    // Mirror the change on the neighbouring cell
    const { dx, dy, neighborWall } = NEIGHBOR_MAP[wall];
    const nx = pt.x + dx;
    const ny = pt.y + dy;
    const neighbor = maze.cells[ny]?.[nx];
    if (neighbor) {
      neighbor.walls[neighborWall] = !open;
    }
  }

  return maze;
}

// ---------------------------------------------------------------------------
// Named state applicator
// ---------------------------------------------------------------------------

/**
 * Switch the maze to the layout described by `state`.
 * `state.wallOverrides` is applied on top of a fresh clone of `baseMaze`.
 */
export function applyMazeState(baseMaze: Maze, state: MazeState): Maze {
  return applyWallToggles(baseMaze, state.wallOverrides);
}

// ---------------------------------------------------------------------------
// Safe state-B generator
// ---------------------------------------------------------------------------

/**
 * Generate a set of wall toggles that open previously-closed internal walls,
 * producing an alternate maze layout (state B) from state A.
 *
 * "Safe" here means we only *open* walls (never close them), so state B is a
 * superset of state A's connectivity — the maze can only become easier to
 * navigate, never disconnected.  The shift from B back to A can temporarily
 * re-close walls, but the softlock validator in `softlock.ts` handles that.
 *
 * @param baseMaze   - The base (state A) maze.
 * @param seed       - Seed for the deterministic PRNG so runs are reproducible.
 * @param toggleCount - How many walls to open (default 8).
 */
export function generateSafeStateB(
  baseMaze: Maze,
  seed: number,
  toggleCount = 8,
): WallToggle[] {
  const rand = mulberry32(seed);
  const { width, height } = baseMaze;

  // Collect every currently-closed internal wall.
  // We only look at east and south faces to avoid counting each shared wall twice.
  const candidates: WallToggle[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = baseMaze.cells[y][x];

      // East wall: only include when the neighbour exists
      if (cell.walls.east && x + 1 < width) {
        candidates.push({ cell: { x, y }, wall: 'east', open: true });
      }

      // South wall: only include when the neighbour exists
      if (cell.walls.south && y + 1 < height) {
        candidates.push({ cell: { x, y }, wall: 'south', open: true });
      }
    }
  }

  // Shuffle and take the first `toggleCount` entries
  const shuffled = shuffleArray(candidates, rand);
  return shuffled.slice(0, Math.min(toggleCount, shuffled.length));
}

// ---------------------------------------------------------------------------
// Build a paired (A, B) toggle set for use by the shift scheduler
// ---------------------------------------------------------------------------

/**
 * Returns wall-toggle lists for both directions of a single shift cycle:
 *
 *   wallsForStateB — apply to baseMaze to get state B
 *   wallsForStateA — apply to baseMaze to get state A (identity; empty list
 *                    because baseMaze *is* state A)
 *
 * The engine stores both and applies whichever matches the next target state.
 */
export function buildShiftPair(
  baseMaze: Maze,
  seed: number,
  toggleCount = 8,
): { wallsForStateA: WallToggle[]; wallsForStateB: WallToggle[] } {
  const wallsForStateB = generateSafeStateB(baseMaze, seed, toggleCount);
  // Returning to state A means re-closing those walls.
  const wallsForStateA: WallToggle[] = wallsForStateB.map(t => ({
    ...t,
    open: false, // close the wall that B opened
  }));
  return { wallsForStateA, wallsForStateB };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Mulberry32 seeded PRNG — fast, good distribution, fully deterministic. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates shuffle using the provided PRNG — returns a new array. */
function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
