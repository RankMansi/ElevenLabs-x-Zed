import React from 'react';
import type { AudioDirector } from '../audio/audio-director';

interface PauseOverlayProps {
  audio: AudioDirector | null;
  onResume: () => void;
  onQuit: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  audio,
  onResume,
  onQuit,
}) => {
  return (
    <div className="screen-overlay">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        {/* Title */}
        <h2 className="pause-title">PAUSED</h2>

        {/* Thin divider */}
        <div
          style={{
            width: '100%',
            height: '1px',
            background:
              'linear-gradient(to right, transparent, var(--color-glade-deep), transparent)',
            marginBottom: 'var(--sp-6)',
          }}
          aria-hidden="true"
        />

        {/* Menu buttons */}
        <div className="pause-menu">
          <button
            className="menu-btn"
            onClick={() => {
              audio?.playUiClick();
              onResume();
            }}
            autoFocus
          >
            ▶&nbsp;&nbsp;RESUME
          </button>

          <button
            className="menu-btn"
            onClick={() => {
              audio?.playUiClick();
              onQuit();
            }}
            style={{ marginTop: 'var(--sp-1)' }}
          >
            ✕&nbsp;&nbsp;QUIT TO MENU
          </button>
        </div>

        {/* Hint */}
        <p
          style={{
            marginTop: 'var(--sp-6)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-dim)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          ESC to resume
        </p>
      </div>
    </div>
  );
};
