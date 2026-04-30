import { useState, useEffect, useRef, useCallback } from 'react';

export interface RunClock {
  elapsedMs: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

/**
 * High-resolution elapsed-time clock for a single run.
 *
 * - Uses performance.now() internally for sub-millisecond accuracy.
 * - Accumulates elapsed time across pause/resume cycles so pausing does
 *   not reset the counter.
 * - Drives React state via requestAnimationFrame so the UI stays in sync
 *   with the game loop without needing a separate setInterval.
 */
export function useRunClock(): RunClock {
  const [elapsedMs, setElapsedMs]   = useState(0);
  const [isRunning, setIsRunning]   = useState(false);

  // Refs hold mutable values that must not trigger re-renders themselves.
  const startTimeRef        = useRef<number | null>(null); // performance.now() at last resume
  const accumulatedMsRef    = useRef(0);                   // ms elapsed before current resume
  const rafRef              = useRef<number>(0);

  // ── Tick ──────────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    if (startTimeRef.current === null) return;
    const now = performance.now();
    setElapsedMs(accumulatedMsRef.current + (now - startTimeRef.current));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (startTimeRef.current !== null) return; // already running
    startTimeRef.current = performance.now();
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (startTimeRef.current === null) return; // already paused
    cancelAnimationFrame(rafRef.current);
    accumulatedMsRef.current += performance.now() - startTimeRef.current;
    startTimeRef.current = null;
    // Sync state one last time with the final value
    setElapsedMs(accumulatedMsRef.current);
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startTimeRef.current     = null;
    accumulatedMsRef.current = 0;
    setElapsedMs(0);
    setIsRunning(false);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { elapsedMs, isRunning, start, pause, reset };
}
