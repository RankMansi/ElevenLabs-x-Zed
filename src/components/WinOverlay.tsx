import React from 'react';
import type { RunId } from '../types/maze';
import type { AudioDirector } from '../audio/audio-director';
import { isRun4Unlocked } from '../content/easter-storage';

interface WinOverlayProps {
  runId: RunId;
  audio: AudioDirector | null;
  onNextRun?: () => void;
  onMenu: () => void;
}

const WIN_MESSAGES: Record<RunId, string> = {
  run1: 'You learned the rhythm.\nThe maze breathes for you now.',
  run2: 'You survived the lies.\nThe shepherd was false. You were not.',
  run3: 'Two clocks. Infinite paths. One exit.\nYou found it.',
  run4: 'You cleared the bonus gate.\nLife or death was a joke—the corridor was real.',
};

const NEXT_RUN_LABELS: Partial<Record<RunId, string>> = {
  run1: 'RUN II — THE FALSE SHEPHERD',
  run2: 'RUN III — DUAL CLOCK',
  run3: 'RUN IV — LIFE OR DEATH',
};

export const WinOverlay: React.FC<WinOverlayProps> = ({
  runId,
  audio,
  onNextRun,
  onMenu,
}) => {
  const message = WIN_MESSAGES[runId];
  const nextLabel = NEXT_RUN_LABELS[runId];
  const run4Locked = runId === 'run3' && !isRun4Unlocked();
  const showNext = Boolean(onNextRun && nextLabel && !run4Locked);

  return (
    <div className="screen-overlay win-overlay">
      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
          padding: '0 32px',
        }}
      >
        {/* Small system label */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)',
            color: 'rgba(168, 230, 207, 0.85)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          EXIT CONFIRMED · {runId.toUpperCase()}
        </div>

        {/* Main title */}
        <h2 className="win-title">YOU'RE OUT</h2>

        {/* Flavour text */}
        <p
          className="win-subtitle"
          style={{ whiteSpace: 'pre-line' }}
        >
          {message}
        </p>

        {run4Locked && (
          <p className="win-subtitle" style={{ marginTop: '-8px', fontSize: '0.9rem' }}>
            Run IV needs all three marks <em>and</em> real exits on runs I → II → III in that order
            this session. Check progress from the landing page.
          </p>
        )}

        {/* Divider */}
        <div
          style={{
            width: '100%',
            maxWidth: '300px',
            height: '1px',
            background:
              'linear-gradient(to right, transparent, var(--color-glade-deep), transparent)',
            marginBottom: '32px',
          }}
        />

        {/* Actions */}
        <div className="pause-menu">
          {showNext && onNextRun && nextLabel && (
            <button
              className="menu-btn"
              onClick={() => {
                audio?.playUiClick();
                onNextRun();
              }}
              style={{
                color: 'var(--color-exit)',
                borderColor: 'var(--color-exit)',
              }}
            >
              → {nextLabel}
            </button>
          )}

          <button
            className="menu-btn"
            onClick={() => {
              audio?.playUiClick();
              onMenu();
            }}
          >
            ← BACK TO MENU
          </button>
        </div>

        {/* End-card tagline */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-faint)',
            letterSpacing: '0.08em',
            marginTop: '40px',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          "Concrete that breathes, grass you almost remember."
        </div>
      </div>

      {/* Glade hope strip — grass at the edge of frame */}
      <div className="glade-strip glade-strip--win" />
    </div>
  );
};
