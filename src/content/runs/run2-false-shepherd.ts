import type { RunId } from '../../types/maze';
import type { MazeState } from '../../types/maze';
import { RUN2_MAZE_SIZE, RUN2_SHIFT_PERIOD_MS } from '../../config/game';
import { generateSafeStateB } from '../../maze/shift-apply';
import { generateMaze } from '../../maze/generate';

// ---------------------------------------------------------------------------
// Run II Config
// ---------------------------------------------------------------------------

export const RUN2_CONFIG = {
  runId: 'run2' as RunId,
  name: 'RUN II',
  subtitle: 'THE FALSE SHEPHERD',
  description: '50% of direction hints are lies. The hum moves.',
  mazeSize: RUN2_MAZE_SIZE,

  /** Deterministic seed — reproducible maze every time */
  seed: 0xBEEFCAFE,

  shiftPeriodMs: RUN2_SHIFT_PERIOD_MS,

  /** Run II has a lie system — half of audio hints are deceptive */
  hasLies: true,
  lieProbability: 0.5,

  /**
   * Per-segment lie seeds used by lie-rng.ts.
   * These are mixed with the segment index so the pattern is
   * deterministic but not immediately obvious to the player.
   */
  lieSeeds: [0x1234, 0x5678, 0x9abc, 0xdef0, 0x2468, 0xace0],

  /** One decoy exit — looks like an exit but plays the wrong sting */
  decoyExitCount: 1,

  /**
   * TTS lines spoken at the start of Run II.
   * Line 1 = Architect voice (honest framing).
   * Lines 2-3 = Glitch voice (the lie is already seeded).
   */
  startTtsLines: [
    'The Architect speaks. But the signal is compromised.',
    'Some of what you hear is true. Some is not. You will learn to tell the difference.',
    'The hum leads somewhere. Whether it leads to the exit — that is the question.',
  ],

  /**
   * Voices used in Run II (ElevenLabs voice IDs).
   * The Architect is authoritative and calm.
   * The Glitch persona is slightly degraded — same model, different ID.
   */
  voices: {
    architect: '21m00Tcm4TlvDq8ikWAM', // Rachel — calm, measured
    glitch:    'AZnzlk1XvdvUeBnXmlld', // Domi  — unsettling, faster
  },

  /**
   * On each B→A transition the decoy hum position shifts to a new
   * grid point.  These are expressed as fractions of (width, height)
   * so they remain valid regardless of the exact maze dimensions.
   */
  decoyHumPositions: [
    { xFrac: 0.15, yFrac: 0.15 }, // NW corner
    { xFrac: 0.85, yFrac: 0.15 }, // NE corner
    { xFrac: 0.15, yFrac: 0.85 }, // SW corner
    { xFrac: 0.85, yFrac: 0.85 }, // SE (near real exit — cruel)
  ],
} as const;

// ---------------------------------------------------------------------------
// Shift data factory
// ---------------------------------------------------------------------------

/**
 * Generate the maze and both shift states for Run II.
 *
 * State A = base layout (returned by generateMaze).
 * State B = opens ~10 internal passages chosen by the seeded PRNG.
 *
 * Both states are pre-validated to be solvable — see solvability.ts.
 */
export function getRun2ShiftData(): {
  maze: ReturnType<typeof generateMaze>;
  stateA: MazeState;
  stateB: MazeState;
} {
  const maze = generateMaze({
    width:           RUN2_MAZE_SIZE.width,
    height:          RUN2_MAZE_SIZE.height,
    seed:            RUN2_CONFIG.seed,
    decoyExitCount:  RUN2_CONFIG.decoyExitCount,
  });

  const stateBToggles = generateSafeStateB(maze, RUN2_CONFIG.seed + 1, 10);

  const stateA: MazeState = {
    id: 'A',
    wallOverrides: [],          // base — no overrides needed
  };

  const stateB: MazeState = {
    id: 'B',
    wallOverrides: stateBToggles,
  };

  return { maze, stateA, stateB };
}

// ---------------------------------------------------------------------------
// Decoy hum position helper
// ---------------------------------------------------------------------------

/**
 * Returns the world-pixel position for the decoy hum at a given shift cycle.
 * The position cycles through RUN2_CONFIG.decoyHumPositions deterministically.
 */
export function getDecoyHumPosition(
  shiftCount: number,
  mazeWidthPx: number,
  mazeHeightPx: number,
): { x: number; y: number } {
  const positions = RUN2_CONFIG.decoyHumPositions;
  const entry = positions[shiftCount % positions.length];
  return {
    x: entry.xFrac * mazeWidthPx,
    y: entry.yFrac * mazeHeightPx,
  };
}
