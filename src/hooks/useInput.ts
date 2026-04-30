import { useState, useEffect, useRef } from 'react';
import { KEYS } from '../config/keys';

export interface InputState {
  moveNorth: boolean;
  moveSouth: boolean;
  moveEast: boolean;
  moveWest: boolean;
  slowWalk: boolean;
  interact: boolean;
  pause: boolean;
  isMoving: boolean;
}

const INITIAL_STATE: InputState = {
  moveNorth: false,
  moveSouth: false,
  moveEast: false,
  moveWest: false,
  slowWalk: false,
  interact: false,
  pause: false,
  isMoving: false,
};

function buildState(keys: Set<string>): InputState {
  const moveNorth = [...keys].some(k => (KEYS.MOVE_NORTH as readonly string[]).includes(k));
  const moveSouth = [...keys].some(k => (KEYS.MOVE_SOUTH as readonly string[]).includes(k));
  const moveEast  = [...keys].some(k => (KEYS.MOVE_EAST  as readonly string[]).includes(k));
  const moveWest  = [...keys].some(k => (KEYS.MOVE_WEST  as readonly string[]).includes(k));
  const slowWalk  = [...keys].some(k => (KEYS.SLOW_WALK  as readonly string[]).includes(k));
  const interact  = [...keys].some(k => (KEYS.INTERACT   as readonly string[]).includes(k));
  const pause     = [...keys].some(k => (KEYS.PAUSE      as readonly string[]).includes(k));

  return {
    moveNorth,
    moveSouth,
    moveEast,
    moveWest,
    slowWalk,
    interact,
    pause,
    isMoving: moveNorth || moveSouth || moveEast || moveWest,
  };
}

/**
 * Returns live keyboard input state, updated on every keydown / keyup event.
 * Automatically cleans up listeners on unmount.
 */
export function useInput(): InputState {
  const [state, setState] = useState<InputState>(INITIAL_STATE);
  const keysRef = useRef(new Set<string>());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      setState(buildState(keysRef.current));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      setState(buildState(keysRef.current));
    };

    const onBlur = () => {
      // Release all keys when window loses focus to prevent stuck keys
      keysRef.current.clear();
      setState(INITIAL_STATE);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return state;
}
