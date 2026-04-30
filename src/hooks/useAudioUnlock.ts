import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Browsers require a user gesture before AudioContext can run.
 * `unlock()` awaits `onUnlock` so callers can open briefing only after init.
 */
export function useAudioUnlock(
  onUnlock: () => void | Promise<void>,
): { unlocked: boolean; unlock: () => Promise<void> } {
  const [unlocked, setUnlocked] = useState(false);
  const busyRef = useRef(false);

  const unlock = useCallback(async (): Promise<void> => {
    if (unlocked || busyRef.current) return;
    busyRef.current = true;
    try {
      await Promise.resolve(onUnlock());
      setUnlocked(true);
    } catch (err) {
      console.warn('[useAudioUnlock] onUnlock threw:', err);
    } finally {
      busyRef.current = false;
    }
  }, [unlocked, onUnlock]);

  useEffect(() => {
    if (unlocked) return;

    const opts: AddEventListenerOptions = { once: true, passive: true };
    const handle = () => {
      void unlock();
    };

    window.addEventListener('click', handle, opts);
    window.addEventListener('keydown', handle, opts);
    window.addEventListener('touchstart', handle, opts);
    window.addEventListener('pointerdown', handle, opts);

    return () => {
      window.removeEventListener('click', handle);
      window.removeEventListener('keydown', handle);
      window.removeEventListener('touchstart', handle);
      window.removeEventListener('pointerdown', handle);
    };
  }, [unlocked, unlock]);

  return { unlocked, unlock };
}
