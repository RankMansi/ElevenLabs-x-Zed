import { KEYS } from "../config/keys";
import type { ActionKey } from "../config/keys";

// Re-export for consumers who import from this module
export type { ActionKey };

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface InputState {
  /** Directional intent — true while the key is held */
  moveNorth: boolean;
  moveSouth: boolean;
  moveEast: boolean;
  moveWest: boolean;
  /** Reserved for slow-walk (no default keys bound) */
  slowWalk: boolean;
  /** Interaction key (E) — held state */
  interact: boolean;
  /** Pause / menu toggle (Escape or P) — held state */
  pause: boolean;
  /** Raw set of currently held key codes (e.g. "ArrowUp") */
  keys: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Key codes that the manager intercepts (prevents browser scroll / shortcuts)
// ---------------------------------------------------------------------------

const INTERCEPTED_CODES = new Set<string>([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyE",
  "KeyP",
  "Escape",
  "Space",
]);

// ---------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------

/**
 * Stateful keyboard input manager.
 *
 * Usage:
 *   const input = new InputManager();
 *   input.attach();                    // register window listeners
 *   const state = input.getState();   // read each frame
 *   input.clearJustPressed();          // call once per frame after consuming
 *   input.detach();                    // cleanup
 */
export class InputManager {
  // Mutable working copy of held keys
  private _keys = new Set<string>();
  // Keys that transitioned down *this frame* (cleared by the caller)
  private _justPressed = new Set<string>();
  // Keys that transitioned up *this frame* (cleared by the caller)
  private _justReleased = new Set<string>();

  // Derived action state (updated on every keydown/keyup)
  private _state: Omit<InputState, "keys"> = {
    moveNorth: false,
    moveSouth: false,
    moveEast: false,
    moveWest: false,
    slowWalk: false,
    interact: false,
    pause: false,
  };

  constructor() {
    // Bind so we can attach / detach cleanly
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Register global keyboard listeners on the window. */
  attach(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  /** Remove global keyboard listeners. */
  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this._keys.clear();
    this._justPressed.clear();
    this._justReleased.clear();
    this._recompute();
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private onKeyDown(e: KeyboardEvent): void {
    // Suppress browser defaults for game keys (arrow scroll, spacebar, etc.)
    if (INTERCEPTED_CODES.has(e.code)) {
      e.preventDefault();
    }

    // Only record just-pressed on the *first* keydown event (ignore auto-repeat)
    if (!e.repeat && !this._keys.has(e.code)) {
      this._justPressed.add(e.code);
    }

    this._keys.add(e.code);
    this._recompute();
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (this._keys.has(e.code)) {
      this._justReleased.add(e.code);
    }
    this._keys.delete(e.code);
    this._recompute();
  }

  // ---------------------------------------------------------------------------
  // Internal state derivation
  // ---------------------------------------------------------------------------

  /**
   * Rebuild derived action booleans from the raw key set.
   * Called after every keydown / keyup so `getState()` is always fresh.
   */
  private _recompute(): void {
    const has = (action: ActionKey): boolean =>
      (KEYS[action] as readonly string[]).some((code) => this._keys.has(code));

    this._state = {
      moveNorth: has("MOVE_NORTH"),
      moveSouth: has("MOVE_SOUTH"),
      moveEast: has("MOVE_EAST"),
      moveWest: has("MOVE_WEST"),
      slowWalk: has("SLOW_WALK"),
      interact: has("INTERACT"),
      pause: has("PAUSE"),
    };
  }

  // ---------------------------------------------------------------------------
  // Public read API
  // ---------------------------------------------------------------------------

  /**
   * Return a snapshot of the current input state.
   * The `keys` set is returned as a frozen reference — do not mutate it.
   */
  getState(): Readonly<InputState> {
    return {
      ...this._state,
      keys: this._keys as ReadonlySet<string>,
    };
  }

  // ---------------------------------------------------------------------------
  // Just-pressed / just-released helpers
  // ---------------------------------------------------------------------------

  /**
   * True if the given raw key code was pressed down since the last
   * `clearJustPressed()` call (i.e. this frame).
   */
  wasJustPressed(code: string): boolean {
    return this._justPressed.has(code);
  }

  /**
   * True if the given action had *any* of its bound keys pressed this frame.
   */
  wasActionJustPressed(action: ActionKey): boolean {
    return (KEYS[action] as readonly string[]).some((code) =>
      this._justPressed.has(code),
    );
  }

  /**
   * True if the given raw key code was released since the last
   * `clearJustPressed()` call.
   */
  wasJustReleased(code: string): boolean {
    return this._justReleased.has(code);
  }

  /**
   * True if the given action had *any* of its bound keys released this frame.
   */
  wasActionJustReleased(action: ActionKey): boolean {
    return (KEYS[action] as readonly string[]).some((code) =>
      this._justReleased.has(code),
    );
  }

  /**
   * Clear the just-pressed and just-released sets.
   * Must be called once per game-loop frame *after* all consumers have read
   * the just-pressed state.
   */
  clearJustPressed(): void {
    this._justPressed.clear();
    this._justReleased.clear();
  }

  // ---------------------------------------------------------------------------
  // Convenience queries
  // ---------------------------------------------------------------------------

  /** True when any directional key is currently held. */
  isMoving(): boolean {
    return (
      this._state.moveNorth ||
      this._state.moveSouth ||
      this._state.moveEast ||
      this._state.moveWest
    );
  }

  /**
   * Return a normalised direction vector `{ dx, dy }` based on the held
   * directional keys.  Diagonal inputs are pre-scaled to ≈ 0.707 so speed
   * stays constant regardless of direction.
   */
  getMovementVector(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    if (this._state.moveEast) dx += 1;
    if (this._state.moveWest) dx -= 1;
    if (this._state.moveSouth) dy += 1;
    if (this._state.moveNorth) dy -= 1;

    if (dx !== 0 && dy !== 0) {
      // Normalise diagonal
      const INV_SQRT2 = 0.7071067811865476;
      dx *= INV_SQRT2;
      dy *= INV_SQRT2;
    }

    return { dx, dy };
  }

  /**
   * Check whether a specific key code is currently held, without going
   * through the action abstraction.
   */
  isKeyHeld(code: string): boolean {
    return this._keys.has(code);
  }

  /**
   * Check an action by name using the `matchesKey` helper from config.
   * Alias kept for callers that prefer the helper-based API.
   */
  isActionHeld(action: ActionKey): boolean {
    return (KEYS[action] as readonly string[]).some((code) =>
      this._keys.has(code),
    );
  }
}
