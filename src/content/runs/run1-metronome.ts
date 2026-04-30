import type { RunId } from '../../types/maze';
import type { MazeState } from '../../types/maze';
import { RUN1_MAZE_SIZE, RUN1_SHIFT_PERIOD_MS } from '../../config/game';
import { generateMaze } from '../../maze/generate';
import { generateSafeStateB } from '../../maze/shift-apply';

// ─── Run Configuration ───────────────────────────────────────────────────────

export const RUN1_CONFIG = {
  runId: 'run1' as RunId,
  name: 'RUN I',
  subtitle: 'THE METRONOME',
  description: 'Learn that every 20 seconds the maze breathes.',
  mazeSize: RUN1_MAZE_SIZE,
  seed: 0xABCDEF01,
  shiftPeriodMs: RUN1_SHIFT_PERIOD_MS,
  hasLies: false,
  hasMinorShifts: false,
  decoyExitCount: 0,

  // TTS lines played at run start (pre-baked or live)
  startTtsLines: [
    'The maze breathes on a schedule. Every twenty seconds, it shifts. Learn the rhythm.',
    'You have two minutes before the first gate moves. Count.',
    'Trust what you hear. For now.',
  ],

  // Honest direction hints only (Run I is the tutorial)
  lieEnabled: false,

  // No time pressure — learning run
  timeLimitMs: null as number | null,
} as const;

// ─── Shift Data ──────────────────────────────────────────────────────────────

/**
 * Generate the base maze + State A / State B wall toggles for Run I.
 *
 * State A = base carved maze (no extra toggles).
 * State B = 6 wall passages opened in the south/east sections, making a
 *           visible "breath" in the lower half of the maze while keeping the
 *           northern escape routes intact.
 *
 * Both states are pre-verified solvable by generateSafeStateB (it only opens
 * walls, never adds them, so connectivity is preserved).
 */
export function getRun1ShiftData() {
  const maze = generateMaze({
    width:          RUN1_MAZE_SIZE.width,
    height:         RUN1_MAZE_SIZE.height,
    seed:           RUN1_CONFIG.seed,
    decoyExitCount: RUN1_CONFIG.decoyExitCount,
  });

  // State B: open 6 internal walls — enough to feel dramatic but not confusing
  const stateBToggles = generateSafeStateB(maze, RUN1_CONFIG.seed + 1, 6);

  const stateA: MazeState = {
    id: 'A',
    wallOverrides: [], // base carved maze — no modifications
  };

  const stateB: MazeState = {
    id: 'B',
    wallOverrides: stateBToggles,
  };

  return { maze, stateA, stateB };
}

// ─── Shift Schedule (data-driven, used by ShiftScheduler) ───────────────────

export const RUN1_SHIFT_SCHEDULE = {
  mode: 'periodic-ab' as const,
  periodMs: RUN1_SHIFT_PERIOD_MS, // 20 000 ms
  states: ['A', 'B'] as const,

  // Narration fired at the very first shift (only once, to teach the mechanic)
  firstShiftNarration: 'shift_warning_1' as const,
} as const;

// ─── Difficulty Parameters ───────────────────────────────────────────────────

export const RUN1_DIFFICULTY = {
  // Dread / idle penalty is present but capped lower than other runs
  dreadMultiplier: 0.6,

  // No memory-glitch ghost walls on first run — keep it readable
  ghostWallsEnabled: false,

  // Footstep spatialization towards exit: fully honest
  exitHumEnabled: true,
  decoyHumEnabled: false,

  // Shift warning: always play klaxon + TTS
  preShiftKlaxon: true,
  preShiftTts: true,
} as const;
