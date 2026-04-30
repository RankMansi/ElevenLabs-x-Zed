import type { RunId } from '../types/maze';
import type { RunState } from '../types/game';
import {
  RUN1_MAZE_SIZE,
  RUN2_MAZE_SIZE,
  RUN3_MAZE_SIZE,
  RUN4_MAZE_SIZE,
  RUN1_SHIFT_PERIOD_MS,
  RUN2_SHIFT_PERIOD_MS,
  RUN3_MAJOR_PERIOD_MS,
  RUN3_MINOR_PERIOD_MS,
  RUN4_SHIFT_PERIOD_MS,
} from '../config/game';
import { getSchedule } from './shift-scheduler';

// ---------------------------------------------------------------------------
// Per-run static configuration
// ---------------------------------------------------------------------------

export interface RunConfig {
  /** Canonical run identifier. */
  runId: RunId;
  /** Display name shown in the HUD (e.g. "RUN I"). */
  name: string;
  /** Short thematic subtitle. */
  subtitle: string;
  /** One-sentence description shown on the pre-run title card. */
  description: string;
  /** Maze dimensions for this run. */
  mazeSize: { width: number; height: number };
  /**
   * Base seed for maze generation.  Both the A-state maze and the B-state
   * wall-toggle set are derived from this seed (with different offsets) so
   * results are fully reproducible.
   */
  seed: number;
  /** How many decoy exits to scatter on the perimeter. */
  decoyExitCount: number;
  /** Whether ~50 % of direction hints are lies (Run 2+). */
  hasLies: boolean;
  /** Whether minor shifts fire in addition to major ones (Run 3 only). */
  hasMinorShifts: boolean;
  /** Major shift period in milliseconds. */
  majorShiftPeriodMs: number;
  /** Minor shift period in milliseconds, or null when not applicable. */
  minorShiftPeriodMs: number | null;
}

// ---------------------------------------------------------------------------
// Run configuration table
// ---------------------------------------------------------------------------

export const RUN_CONFIGS: Record<RunId, RunConfig> = {
  run1: {
    runId:             'run1',
    name:              'RUN I',
    subtitle:          'THE METRONOME',
    description:       '~2s wall swaps. Honest whispers.',
    mazeSize:          RUN1_MAZE_SIZE,
    seed:              0xabcdef01,
    decoyExitCount:    0,
    hasLies:           false,
    hasMinorShifts:    false,
    majorShiftPeriodMs: RUN1_SHIFT_PERIOD_MS,
    minorShiftPeriodMs: null,
  },

  run2: {
    runId:             'run2',
    name:              'RUN II',
    subtitle:          'THE FALSE SHEPHERD',
    description:       '~Half the whispers lie. ~2s shifts, one decoy.',
    mazeSize:          RUN2_MAZE_SIZE,
    seed:              0xbeefcafe,
    decoyExitCount:    1,
    hasLies:           true,
    hasMinorShifts:    false,
    majorShiftPeriodMs: RUN2_SHIFT_PERIOD_MS,
    minorShiftPeriodMs: null,
  },

  run3: {
    runId:             'run3',
    name:              'RUN III',
    subtitle:          'DUAL CLOCK',
    description:       '~24s major / ~2s minor. Two decoys.',
    mazeSize:          RUN3_MAZE_SIZE,
    seed:              0xdeadbeef,
    decoyExitCount:    2,
    hasLies:           true,
    hasMinorShifts:    true,
    majorShiftPeriodMs: RUN3_MAJOR_PERIOD_MS,
    minorShiftPeriodMs: RUN3_MINOR_PERIOD_MS,
  },

  run4: {
    runId:             'run4',
    name:              'RUN IV',
    subtitle:          'LIFE OR DEATH',
    description:       'Session: 3 marks + beat I, II, III in order. Bigger grid, lies on.',
    mazeSize:          RUN4_MAZE_SIZE,
    seed:              0xcafebabe,
    decoyExitCount:    2,
    hasLies:           true,
    hasMinorShifts:    false,
    majorShiftPeriodMs: RUN4_SHIFT_PERIOD_MS,
    minorShiftPeriodMs: null,
  },
};

// ---------------------------------------------------------------------------
// RunState factory
// ---------------------------------------------------------------------------

/**
 * Build a fresh `RunState` for the given run.
 * Elapsed time, shift count, and win flag all start at zero / false.
 * The initial maze state is always 'A'.
 */
export function createRunState(runId: RunId): RunState {
  const schedule = getSchedule(runId);

  return {
    runId,
    phase:            'playing',
    elapsedMs:        0,
    currentMazeState: 'A',
    nextMajorShiftMs: schedule.majorPeriodMs,
    nextMinorShiftMs: schedule.minorPeriodMs ?? 0,
    shiftCount:       0,
    stepsToExit:      0,
    isWon:            false,
  };
}

// ---------------------------------------------------------------------------
// Label / display helpers
// ---------------------------------------------------------------------------

/**
 * Return the full display label for a run: "RUN I — THE METRONOME".
 */
export function getRunLabel(runId: RunId): string {
  const cfg = RUN_CONFIGS[runId];
  return `${cfg.name} \u2014 ${cfg.subtitle}`;
}

/**
 * Return the ordered list of run IDs in progression order.
 */
export const RUN_ORDER: RunId[] = ['run1', 'run2', 'run3', 'run4'];

/**
 * Return the run that follows the given one, or null if `runId` is the last.
 */
export function getNextRun(runId: RunId): RunId | null {
  const idx = RUN_ORDER.indexOf(runId);
  if (idx === -1 || idx === RUN_ORDER.length - 1) return null;
  return RUN_ORDER[idx + 1];
}

/**
 * Return the config for `runId` (convenience re-export so callers don't
 * need to import the full table).
 */
export function getRunConfig(runId: RunId): RunConfig {
  return RUN_CONFIGS[runId];
}
