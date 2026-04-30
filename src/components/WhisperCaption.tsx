import React, { useState, useEffect, useRef } from 'react';

interface WhisperCaptionProps {
  text: string;
  active: boolean;
  typingSpeedCps?: number; // characters per second, default 40
}

export const WhisperCaption: React.FC<WhisperCaptionProps> = ({
  text,
  active,
  typingSpeedCps = 40,
}) => {
  const [displayed, setDisplayed] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    clearTimer();

    if (!active || !text) {
      setDisplayed('');
      setShowCursor(false);
      indexRef.current = 0;
      return;
    }

    indexRef.current = 0;
    setDisplayed('');
    setShowCursor(true);

    const msPerChar = 1000 / typingSpeedCps;

    const type = () => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));

      if (indexRef.current < text.length) {
        timerRef.current = setTimeout(type, msPerChar);
      } else {
        // Typing done — blink cursor briefly then hide
        timerRef.current = setTimeout(() => setShowCursor(false), 1800);
      }
    };

    timerRef.current = setTimeout(type, msPerChar);

    return clearTimer;
  }, [text, active, typingSpeedCps]);

  const isEmpty = !active || !text;

  return (
    <div
      className={`whisper-caption${isEmpty ? ' whisper-caption--empty' : ' whisper-caption--active'}`}
      aria-live="polite"
      aria-atomic="false"
    >
      {displayed}
      {showCursor && (
        <span className="whisper-cursor" aria-hidden="true" />
      )}
    </div>
  );
};
