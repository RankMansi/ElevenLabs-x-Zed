import type { RunId } from '../../types/maze';
import type { MazeState } from '../../types/maze';
import { RUN3_MAZE_SIZE, RUN3_MAJOR_PERIOD_MS, RUN3_MINOR_PERIOD_MS } from '../../config/game';
import { generateSafeStateB } from '../../maze/shift-apply';
import { generateMaze } from '../../maze/generate';

export const RUN3_CONFIG = {
  runId: 'run3' as RunId,
  name: 'RUN III',
  subtitle: 'DUAL CLOCK',
  description: 'Two schedules. Two decoy exits. One way out.',
  mazeSize: RUN3_MAZE_SIZE,
  seed: 0xDEADBEEF,
  majorPeriodMs: RUN3_MAJOR_PERIOD_MS,
  minorPeriodMs: RUN3_MINOR_PERIOD_MS,
  hasLies: true,
  decoyExitCount: 2,
  startTtsLines: [
    'Two clocks now. Major shift every thirty seconds. Minor shift every ten.',
    'There are exits that are not exits. The real one plays a different tone.',
    'Both clocks lie if you let them. Move before they sync.',
  ],
  // Voice: Architect for truth lines, Glitch for lie lines (Run III uses both)
  architectVoiceId: '21m00Tcm4TlvDq8ikWAM',
  glitchVoiceId: 'AZnzlk1XvdvUeBnXmlld',
};

export interface Run3ShiftData {
  maze: ReturnType<typeof generateMaze>;
  stateA: MazeState;
  stateBMajor: MazeState;
  stateBMinor: MazeState;
}

/**
 * Generate Run III maze and its three shift states:
 *   - stateA      : base layout (applied at run start)
 *   - stateBMajor : large wall reorganisation, fires every 30 s
 *   - stateBMinor : small local edits,          fires every 10 s
 *
 * The minor shifts are intentionally small (4 toggles) so they feel like
 * the maze "breathing", while major shifts are a genuine topology change
 * that can flip corridors the player is mid-run through.
 */
export function getRun3ShiftData(): Run3ShiftData {
  const maze = generateMaze({
    width: RUN3_MAZE_SIZE.width,
    height: RUN3_MAZE_SIZE.height,
    seed: RUN3_CONFIG.seed,
    decoyExitCount: 2,
  });

  // Major: many toggles — large reorganisation
  const majorToggles = generateSafeStateB(maze, RUN3_CONFIG.seed + 1, 14);

  // Minor: few toggles — local micro-edits
  // Use a different seed offset so minor shifts are independent of major shifts
  const minorToggles = generateSafeStateB(maze, RUN3_CONFIG.seed + 0x77, 4);

  const stateA: MazeState = {
    id: 'A',
    wallOverrides: [],   // base — no overrides
  };

  const stateBMajor: MazeState = {
    id: 'B-major',
    wallOverrides: majorToggles,
  };

  const stateBMinor: MazeState = {
    id: 'B-minor',
    wallOverrides: minorToggles,
  };

  return { maze, stateA, stateBMajor, stateBMinor };
}

/**
 * Describe the dual-clock schedule for the HUD and the shift-scheduler.
 *
 * Run III runs TWO independent timers:
 *   Major clock — fires every RUN3_MAJOR_PERIOD_MS (30 000 ms)
 *                 Applies stateBMajor toggles (or toggles back to A).
 *   Minor clock — fires every RUN3_MINOR_PERIOD_MS (10 000 ms)
 *                 Applies stateBMinor toggles as a delta on top of
 *                 whichever major state is currently active.
 */
export const RUN3_SCHEDULE = {
  majorPeriodMs: RUN3_MAJOR_PERIOD_MS,
  minorPeriodMs: RUN3_MINOR_PERIOD_MS,
  description: 'Major 30 s / Minor 10 s — two independent clocks',
} as const;
