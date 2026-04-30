import type { Maze, Point, RunId } from '../types/maze';

const EGG_RUNS: readonly RunId[] = ['run1', 'run2', 'run3'];

/** One hidden tile per maze (runs I–III). Returns null for Run IV / unknown. */
export function getEasterEggGrid(maze: Maze, runId: RunId): Point | null {
  if (!EGG_RUNS.includes(runId)) return null;

  const { width: w, height: h } = maze;
  const salt =
    runId === 'run1' ? 0x51ed_101e : runId === 'run2' ? 0x2bad_f00d : 0x00c0_ffee;

  for (let i = 0; i < 200; i++) {
    const x = (salt + i * 0x9e37_79b9 + w * 17) % w;
    const y = (salt + i * 0x85eb_ca6b + h * 23) % h;
    const cell = maze.cells[y]?.[x];
    if (!cell) continue;
    if (cell.isStart || cell.isExit || cell.isDecoyExit) continue;
    if (x === maze.start.x && y === maze.start.y) continue;
    if (x === maze.exit.x && y === maze.exit.y) continue;
    return { x, y };
  }
  return { x: Math.min(1, w - 1), y: Math.min(1, h - 1) };
}
