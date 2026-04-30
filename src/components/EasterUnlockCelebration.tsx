import React, { useMemo } from 'react';
import { consumePartyFlag } from '../content/easter-storage';

export interface EasterUnlockCelebrationProps {
  open: boolean;
  onDismiss: () => void;
}

/**
 * Full-screen celebration when Run IV first becomes playable (marks + ordered maze wins),
 * or when returning with a pending party flag.
 */
export const EasterUnlockCelebration: React.FC<EasterUnlockCelebrationProps> = ({
  open,
  onDismiss,
}) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        key: i,
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 14) * 0.035}s`,
        dur: `${1.15 + (i % 6) * 0.12}s`,
        hue: i % 4 === 0 ? '#8fd4a8' : i % 4 === 1 ? '#7de8ff' : i % 4 === 2 ? '#d4c48f' : '#a8b8ff',
      })),
    [],
  );

  if (!open) return null;

  const dismiss = () => {
    consumePartyFlag();
    onDismiss();
  };

  return (
    <div
      className="egg-party-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="egg-party-title"
    >
      <div className="egg-party-backdrop" />
      {pieces.map((p) => (
        <span
          key={p.key}
          className="egg-party-confetti"
          style={{
            left: p.left,
            animationDelay: p.delay,
            animationDuration: p.dur,
            background: p.hue,
          }}
        />
      ))}
      <div className="egg-party-card">
        <p className="egg-party-kicker">MARKS + ORDERED WINS · RUN IV OPEN</p>
        <h2 id="egg-party-title" className="egg-party-title">
          Run IV is yours — now it&apos;s life-or-death cosplay for real
        </h2>
        <p className="egg-party-body">
          All three hidden marks and exits on runs I through III, in order, this session. The
          fourth run is on the landing page: bigger grid, fast wall rhythm, lies on, no minor
          clock — run before the joke gets tired.
        </p>
        <button type="button" className="menu-btn egg-party-btn" onClick={dismiss}>
          Back to the stone
        </button>
      </div>
    </div>
  );
};
