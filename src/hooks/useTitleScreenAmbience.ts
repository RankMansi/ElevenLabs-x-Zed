import { useEffect, useRef } from 'react';
import { startTitleScreenBed } from '../audio/marketing-audio-singleton';

/**
 * Chronos bed on first pointer gesture. Playback is intentionally **not** torn
 * down on route change so ElevenLabs / procedural music continues into `/play`.
 */
export function useTitleScreenAmbience(): void {
  const startedRef = useRef(false);

  useEffect(() => {
    const onFirst = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      window.removeEventListener('pointerdown', onFirst);
      startTitleScreenBed();
    };

    window.addEventListener('pointerdown', onFirst, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onFirst);
    };
  }, []);
}
