import type { Point, RunId, Maze, MazeState } from './maze';
import type { CueId } from './audio';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'win' | 'lose' | 'transition';

export interface PlayerState {
  position: Point; // grid coordinates (can be fractional for smooth movement)
  velocity: { x: number; y: number };
  facing: 'north' | 'east' | 'south' | 'west';
  isSprinting: boolean;
  isSlowWalking: boolean;
  staminaMs: number; // for Run3 stamina
}

export interface DreadState {
  level: number; // 0..1
  idleMs: number;
  lightRadiusMod: number; // 1.0 = full, 0.9 = shrunk 10%
}

export interface ShiftEvent {
  tSeconds: number; // time into the run when this fires (or period for repeating)
  stateId: string; // 'A' or 'B' or 'A-major' / 'A-minor'
  isPeriodic: boolean; // if true, fires every tSeconds
}

export interface RunState {
  runId: RunId;
  phase: GamePhase;
  elapsedMs: number;
  currentMazeState: string; // 'A' or 'B'
  nextMajorShiftMs: number;
  nextMinorShiftMs: number; // Run3 only
  shiftCount: number;
  stepsToExit: number;
  isWon: boolean;
}

export interface GameState {
  phase: GamePhase;
  currentRun: RunId | null;
  runState: RunState | null;
  player: PlayerState;
  dread: DreadState;
  maze: Maze | null;
  activeMazeState: MazeState | null;
  ghostWallAlpha: number; // 0..1 for memory glitch
  pendingCue: CueId | null;
  lastShiftMs: number;
  showGhostWalls: boolean;
  /** Snapshot before the last layout shift; null when not morphing walls. */
  wallMorphFrom: Maze | null;
  /** 0 = start of morph, 1 = done (collision already uses `maze`). */
  wallMorphT: number;
  /** Decaying screen shake after a layout commit (ms remaining). */
  screenShakeMs: number;
}
