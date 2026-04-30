import { useEffect, useRef } from 'react';

export type GameLoopCallback = (dt: number, timestamp: number) => void;

/**
 * Drives a callback on every animation frame.
 * @param callback  Called with (dt, timestamp) — dt is clamped to 50 ms max.
 * @param active    Set to false to pause the loop without unmounting.
 */
export function useGameLoop(
  callback: GameLoopCallback,
  active: boolean = true,
): void {
  const callbackRef       = useRef<GameLoopCallback>(callback);
  const frameRef          = useRef<number>(0);
  const lastTimestampRef  = useRef<number>(0);

  // Always keep the ref current so stale-closure bugs can't happen
  callbackRef.current = callback;

  useEffect(() => {
    if (!active) return;

    lastTimestampRef.current = 0; // reset on (re)start

    const loop = (timestamp: number) => {
      if (lastTimestampRef.current === 0) {
        // First frame — dt would be huge; emit 0 and start the clock
        lastTimestampRef.current = timestamp;
        frameRef.current = requestAnimationFrame(loop);
        callbackRef.current(0, timestamp);
        return;
      }

      // Cap dt at 50 ms (handles tab-background throttling, debugger pauses)
      const rawDt = timestamp - lastTimestampRef.current;
      const dt    = Math.min(rawDt / 1000, 0.05);
      lastTimestampRef.current = timestamp;

      callbackRef.current(dt, timestamp);
      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      lastTimestampRef.current = 0;
    };
  }, [active]);
}
