import type { GameState, PlayerState } from "../types/game";
import type { Maze, WallToggle } from "../types/maze";
import {
  SHIFT_ANIMATION_MS,
  TILE_SIZE,
  SHIFT_SCREEN_SHAKE_MS,
} from "../config/game";
import { InputManager } from "./input";
import {
  movePlayer,
  checkExitCollision,
  checkDecoyExitCollision,
} from "./physics";
import { getPlayerGridPos, updateStamina } from "./player";
import { updateDread, shouldTriggerHeartbeat } from "./dread";
import { getSchedule, tickSchedule } from "./shift-scheduler";
import {
  createMemoryGlitch,
  triggerMemoryGlitch,
  updateMemoryGlitch,
  type MemoryGlitchState,
} from "./memory-glitch";
import { validatePostShift } from "../maze/softlock";
import { applyWallToggles, generateSafeStateB } from "../maze/shift-apply";
import { cloneMaze } from "../maze/generate";
import { openPassageCount } from "../maze/grid";
import { getEasterEggGrid } from "./easter-egg";

// ---------------------------------------------------------------------------
// Callback surface
// ---------------------------------------------------------------------------

/**
 * All side-effects the engine can produce in a single frame are surfaced here.
 * The caller (React component / audio system) registers handlers and the engine
 * invokes them at the right moment — keeping the engine itself free of any
 * audio / rendering / UI concerns.
 */
export interface EngineCallbacks {
  /** A maze shift just completed.  `isMajor` false ⇒ minor (Run 3 only). */
  onShift: (newState: "A" | "B", isMajor: boolean) => void;
  /**
   * Fired once per approach when the next major shift is fewer than
   * SHIFT_WARNING_MS away.  Not fired again until the shift fires and the
   * next cycle's warning window opens.
   */
  onShiftWarning: () => void;
  /**
   * Player has been standing still long enough and dread just crossed the
   * heartbeat threshold for the first time this idle session.
   */
  onIdleHeartbeat: () => void;
  /** Player reached the true exit. */
  onWin: () => void;
  /** Player stepped on a decoy exit tile. */
  onDecoyExit: () => void;
  /** Hidden egg tile (runs I–III only); fired once per run when collected. */
  onEasterEgg?: () => void;
  /**
   * Player walked into a dead end.  Debounced internally (at most once per
   * 5 s) so audio cues don't spam.
   */
  onWrongTurn: () => void;
  /**
   * Called every frame (regardless of phase) so the renderer always has a
   * fresh copy of the game state.
   */
  onRender: (state: GameState) => void;
}

// ---------------------------------------------------------------------------
// GameEngine
// ---------------------------------------------------------------------------

export class GameEngine {
  // ---- Input ---------------------------------------------------------------
  private readonly inputManager: InputManager;

  // ---- Game state ----------------------------------------------------------
  private gameState: GameState;
  private callbacks: EngineCallbacks;

  // ---- rAF loop ------------------------------------------------------------
  private lastTimestamp = 0;
  private animFrameId = 0;

  // ---- Shift tracking ------------------------------------------------------
  /** Raw elapsed-ms value from the *previous* frame, for boundary detection. */
  private prevElapsedMs = 0;
  /** The base (state-A) maze from which all shifts are derived. */
  private baseMaze: Maze | null = null;
  /** How many internal walls to open per major layout (from run config). */
  private majorToggleBudget = 12;
  /** Run seed fragment mixed into each major layout index (deterministic variety). */
  private majorShiftSalt = 0x3c6ef372;

  // ---- Memory-glitch (ghost wall) -----------------------------------------
  /**
   * Held privately so `remainingMs` survives across frames.
   * The public GameState exposes only `showGhostWalls` and `ghostWallAlpha`
   * (the render-relevant slice).
   */
  private glitchState: MemoryGlitchState = createMemoryGlitch();

  // ---- Debounce ------------------------------------------------------------
  /**
   * Run-elapsed time (ms) when `onWrongTurn` was last fired.
   * Prevents the wrong-turn cue from spamming while the player is stuck.
   */
  private lastWrongTurnMs = -10_000; // far in the past so it fires immediately if needed

  // ---- Warning de-dup ------------------------------------------------------
  /**
   * Cycle index for which a shift-warning has already been emitted.
   * Ensures `onShiftWarning` fires at most once per shift cycle.
   */
  private lastWarnedMajorCycle = -1;
  private lastWarnedMinorCycle = -1;

  /** True after the hidden egg was collected this run, or when already in save data. */
  private easterEggConsumed = false;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  constructor(initialState: GameState, callbacks: EngineCallbacks) {
    this.gameState = initialState;
    this.callbacks = callbacks;
    this.inputManager = new InputManager();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Attach keyboard listeners and start the rAF loop. */
  start(): void {
    this.inputManager.attach();
    this.lastTimestamp = 0;
    this.prevElapsedMs = 0;
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  /** Detach keyboard listeners and cancel the rAF loop. */
  stop(): void {
    this.inputManager.detach();
    cancelAnimationFrame(this.animFrameId);
    this.animFrameId = 0;
  }

  // ---------------------------------------------------------------------------
  // Maze injection
  // ---------------------------------------------------------------------------

  /**
   * Provide the base maze and both sets of wall toggles before `start()`.
   * Can also be called mid-run to hot-swap the maze (e.g. on run transition).
   *
   * @param maze   - The canonical base maze (state A = baseMaze + wallsA).
   * @param wallsA - Toggles that produce state A from the base mesh.
   *                 Pass an empty array when baseMaze *is* state A.
   * @param wallsB - Unused for majors (each major uses {@link generateSafeStateB}).
   */
  setMaze(
    maze: Maze,
    wallsA: WallToggle[],
    wallsB: WallToggle[],
    opts?: {
      easterAlreadyFound?: boolean;
      majorToggleBudget?: number;
      majorShiftSalt?: number;
    },
  ): void {
    this.baseMaze = maze;
    this.easterEggConsumed = Boolean(opts?.easterAlreadyFound);
    this.majorToggleBudget =
      opts?.majorToggleBudget ??
      (wallsB.length > 0 ? wallsB.length : 12);
    this.majorShiftSalt = (opts?.majorShiftSalt ?? 0x3c6ef372) >>> 0;

    // Apply state A immediately so the renderer has a valid maze on the first frame
    const initialMaze =
      wallsA.length > 0 ? applyWallToggles(maze, wallsA) : maze;
    this.gameState = {
      ...this.gameState,
      maze: initialMaze,
      wallMorphFrom: null,
      wallMorphT: 1,
      screenShakeMs: this.gameState.screenShakeMs ?? 0,
    };

    // Reset glitch
    this.glitchState = createMemoryGlitch();
  }

  // ---------------------------------------------------------------------------
  // State accessors
  // ---------------------------------------------------------------------------

  getState(): GameState {
    return this.gameState;
  }

  /**
   * Merge a partial update into the game state.
   * Use sparingly — prefer letting the engine own all mutable state internally.
   */
  updateState(partial: Partial<GameState>): void {
    this.gameState = { ...this.gameState, ...partial };
  }

  // ---------------------------------------------------------------------------
  // rAF loop
  // ---------------------------------------------------------------------------

  private loop = (timestamp: number): void => {
    // On the very first frame, seed the timestamp so dtMs is 0
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    // Cap the delta to 50 ms (20 fps minimum) to prevent physics tunnelling
    // when the tab is backgrounded or the system is under heavy load.
    const dtMs = Math.min(timestamp - this.lastTimestamp, 50);
    const dtSec = dtMs / 1000;
    this.lastTimestamp = timestamp;

    if (this.gameState.phase === "playing") {
      this.tick(dtMs, dtSec);
    }

    this.callbacks.onRender(this.gameState);
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // ---------------------------------------------------------------------------
  // Per-frame simulation tick
  // ---------------------------------------------------------------------------

  private tick(dtMs: number, dtSec: number): void {
    const { gameState } = this;

    // Guard: can't simulate without a maze and run state
    if (!gameState.maze || !gameState.runState) return;

    const runState = gameState.runState;
    const schedule = getSchedule(runState.runId);

    // ---- 1. Input ----------------------------------------------------------
    const input = this.inputManager.getState();

    // Movement vector — already normalised for diagonals by InputManager
    const { dx, dy } = this.inputManager.getMovementVector();
    const isMoving = dx !== 0 || dy !== 0;

    // ---- 2. Stamina (Run 3 sprint) -----------------------------------------
    let player: PlayerState = {
      ...gameState.player,
      isSlowWalking: input.slowWalk,
      // Sprint is only active when slowWalk is NOT held and stamina remains
      isSprinting:
        gameState.player.isSprinting &&
        !input.slowWalk &&
        gameState.player.staminaMs > 0,
    };

    if (isMoving) {
      const { staminaMs, canSprint } = updateStamina(player, dtSec);
      player = {
        ...player,
        staminaMs,
        isSprinting: player.isSprinting && canSprint,
      };
    } else {
      // Regen stamina while standing still
      const { staminaMs } = updateStamina(
        { ...player, isSprinting: false },
        dtSec,
      );
      player = { ...player, staminaMs };
    }

    // ---- 3. Physics (move + collide) ----------------------------------------
    if (isMoving) {
      player = movePlayer(player, gameState.maze, dx, dy, dtSec);
    } else {
      // Zero velocity when not pressing any direction
      player = { ...player, velocity: { x: 0, y: 0 } };
    }

    // ---- 3b. Easter egg (runs I–III, once per run) -------------------------
    const mazeForEgg = gameState.maze;
    if (
      mazeForEgg &&
      this.callbacks.onEasterEgg &&
      !this.easterEggConsumed &&
      (runState.runId === "run1" ||
        runState.runId === "run2" ||
        runState.runId === "run3")
    ) {
      const egg = getEasterEggGrid(mazeForEgg, runState.runId);
      if (egg) {
        const g = getPlayerGridPos(player);
        if (g.x === egg.x && g.y === egg.y) {
          this.easterEggConsumed = true;
          this.callbacks.onEasterEgg();
        }
      }
    }

    // ---- 4. Dread -----------------------------------------------------------
    const prevDread = gameState.dread;
    const dread = updateDread(prevDread, isMoving, dtSec);

    // Fire heartbeat on the *rising edge* only (not every frame above threshold)
    if (shouldTriggerHeartbeat(dread) && !shouldTriggerHeartbeat(prevDread)) {
      this.callbacks.onIdleHeartbeat();
    }

    // ---- 5. Memory glitch fade ---------------------------------------------
    this.glitchState = updateMemoryGlitch(this.glitchState, dtMs);

    // ---- 6. Shift scheduler ------------------------------------------------
    const newElapsedMs = runState.elapsedMs + dtMs;
    const tick = tickSchedule(schedule, newElapsedMs, this.prevElapsedMs);
    this.prevElapsedMs = newElapsedMs;

    let maze = gameState.maze;
    let currentMazeState = runState.currentMazeState as "A" | "B";
    let shiftCount = runState.shiftCount;

    let wallMorphFrom = gameState.wallMorphFrom;
    let wallMorphT = gameState.wallMorphT;
    let layoutShiftThisFrame = false;
    let screenShakeMs = Math.max(0, (gameState.screenShakeMs ?? 0) - dtMs);

    // -- Shift warning (once per cycle) ---
    if (
      tick.majorWarning &&
      tick.majorCycleIndex !== this.lastWarnedMajorCycle
    ) {
      this.lastWarnedMajorCycle = tick.majorCycleIndex;
      this.callbacks.onShiftWarning();
    }

    // Minor shift warning de-dup (Run 3 only)
    if (
      tick.minorWarning &&
      tick.minorCycleIndex !== null &&
      tick.minorCycleIndex !== this.lastWarnedMinorCycle
    ) {
      this.lastWarnedMinorCycle = tick.minorCycleIndex;
      // Minor warnings are HUD-only (no audio klaxon) — caller decides
    }

    // -- Major shift — new layout from base each time (deterministic, not A/B XOR) ---
    if (tick.majorFired && this.baseMaze) {
      const layoutIndex = shiftCount + 1;
      const salt =
        (this.majorShiftSalt ^ Math.imul(layoutIndex, 0x9e3779b1)) >>> 0;
      const toggles = generateSafeStateB(
        this.baseMaze,
        salt,
        this.majorToggleBudget,
      );
      const shifted = applyWallToggles(this.baseMaze, toggles);

      if (maze) {
        wallMorphFrom = cloneMaze(maze);
        wallMorphT = 0;
        layoutShiftThisFrame = true;
      }

      const gridPos = getPlayerGridPos(player);
      const { safe, nudgedPos } = validatePostShift(shifted, gridPos);
      if (!safe || nudgedPos.x !== gridPos.x || nudgedPos.y !== gridPos.y) {
        player = {
          ...player,
          position: {
            x: nudgedPos.x * TILE_SIZE + TILE_SIZE / 2,
            y: nudgedPos.y * TILE_SIZE + TILE_SIZE / 2,
          },
        };
      }

      maze = shifted;
      currentMazeState = (layoutIndex & 1) === 0 ? "A" : "B";
      shiftCount++;
      screenShakeMs = SHIFT_SCREEN_SHAKE_MS;

      this.glitchState = triggerMemoryGlitch();

      this.callbacks.onShift(currentMazeState, true);
    }

    // -- Minor shift (Run 3): localized opens from the *current* layout ---
    if (tick.minorFired && schedule.minorPeriodMs !== null && maze) {
      const cyc = tick.minorCycleIndex ?? 0;
      const salt =
        (this.majorShiftSalt ^
          0xface_0000 ^
          Math.imul(cyc + 1, 0x85eb_ca6b)) >>>
        0;
      const minorToggleCount = Math.max(
        1,
        Math.floor(this.majorToggleBudget * 0.35),
      );
      const minorToggles = generateSafeStateB(
        maze,
        salt,
        minorToggleCount,
      );
      const preMinorMaze = maze;
      maze = applyWallToggles(maze, minorToggles);

      wallMorphFrom = cloneMaze(preMinorMaze);
      wallMorphT = 0;
      layoutShiftThisFrame = true;
      screenShakeMs = SHIFT_SCREEN_SHAKE_MS;

      const gridPos = getPlayerGridPos(player);
      const { safe, nudgedPos } = validatePostShift(maze, gridPos);
      if (!safe || nudgedPos.x !== gridPos.x || nudgedPos.y !== gridPos.y) {
        player = {
          ...player,
          position: {
            x: nudgedPos.x * TILE_SIZE + TILE_SIZE / 2,
            y: nudgedPos.y * TILE_SIZE + TILE_SIZE / 2,
          },
        };
      }

      if (!this.glitchState.active) {
        this.glitchState = triggerMemoryGlitch();
      }

      this.callbacks.onShift(currentMazeState, false);
    }

    if (
      !layoutShiftThisFrame &&
      wallMorphFrom &&
      wallMorphT < 1
    ) {
      wallMorphT = Math.min(1, wallMorphT + dtMs / SHIFT_ANIMATION_MS);
      if (wallMorphT >= 1) wallMorphFrom = null;
    }

    // ---- 7. Exit / decoy collision -----------------------------------------
    if (checkExitCollision(player, maze)) {
      // ---- WIN ----
      this.callbacks.onWin();
      this.gameState = {
        ...gameState,
        phase: "win",
        player,
        dread,
        maze,
        wallMorphFrom: null,
        wallMorphT: 1,
        screenShakeMs: 0,
        showGhostWalls: this.glitchState.active,
        ghostWallAlpha: this.glitchState.alpha,
        runState: {
          ...runState,
          elapsedMs: newElapsedMs,
          currentMazeState,
          shiftCount,
          nextMajorShiftMs: tick.nextMajorMs,
          nextMinorShiftMs: tick.nextMinorMs ?? 0,
          isWon: true,
        },
      };
      this.inputManager.clearJustPressed();
      return; // stop simulating after win
    }

    if (checkDecoyExitCollision(player, maze)) {
      this.callbacks.onDecoyExit();
    }

    // ---- 8. Dead-end / wrong-turn detection --------------------------------
    const playerGrid = getPlayerGridPos(player);
    const cell = maze.cells[playerGrid.y]?.[playerGrid.x];
    if (cell && isMoving) {
      const open = openPassageCount(cell);
      // A dead end has exactly one open passage.
      // Debounce: don't fire more than once every 5 s.
      if (open === 1 && newElapsedMs - this.lastWrongTurnMs > 5_000) {
        this.lastWrongTurnMs = newElapsedMs;
        this.callbacks.onWrongTurn();
      }
    }

    // ---- 9. Commit new state ------------------------------------------------
    this.gameState = {
      ...gameState,
      player,
      dread,
      maze,
      wallMorphFrom,
      wallMorphT,
      screenShakeMs,
      showGhostWalls: this.glitchState.active,
      ghostWallAlpha: this.glitchState.alpha,
      runState: {
        ...runState,
        elapsedMs: newElapsedMs,
        currentMazeState,
        shiftCount,
        nextMajorShiftMs: tick.nextMajorMs,
        nextMinorShiftMs: tick.nextMinorMs ?? 0,
      },
    };

    this.inputManager.clearJustPressed();
  }
}
