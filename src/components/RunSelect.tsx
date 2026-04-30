import React from 'react';
import type { RunId } from '../types/maze';
import { RUN_CONFIGS } from '../game/run-controller';

interface RunSelectProps {
  onSelectRun: (runId: RunId) => void;
  audioUnlocked: boolean;
  onAudioUnlock: () => void;
}

const RUNS: RunId[] = ['run1', 'run2', 'run3'];

const RUN_NUMBERS: Record<RunId, string> = {
  run1: 'RUN I',
  run2: 'RUN II',
  run3: 'RUN III',
  run4: 'RUN IV',
};

export const RunSelect: React.FC<RunSelectProps> = ({
  onSelectRun,
  audioUnlocked,
  onAudioUnlock,
}) => {
  const handleSelect = (runId: RunId) => {
    if (!audioUnlocked) onAudioUnlock();
    onSelectRun(runId);
  };

  return (
    <div
      className="screen-overlay"
      style={{ background: '#070809', backdropFilter: 'none' }}
    >
      <div className="run-select">
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center' }}>
          <h1 className="run-select__title">CHRONOS GRID</h1>
          <p className="run-select__subtitle">
            Navigate with incomplete vision · Trust nothing
          </p>
        </div>

        {/* ── Run cards ─────────────────────────────────────────────────── */}
        <div className="run-list">
          {RUNS.map((runId) => {
            const cfg = RUN_CONFIGS[runId];
            return (
              <button
                key={runId}
                className="run-card"
                onClick={() => handleSelect(runId)}
                tabIndex={0}
                type="button"
              >
                <div className="run-card__number">{RUN_NUMBERS[runId]}</div>
                <div className="run-card__name">{cfg.subtitle}</div>
                <div className="run-card__desc">{cfg.description}</div>
              </button>
            );
          })}
        </div>

        {/* ── Audio unlock hint ─────────────────────────────────────────── */}
        {!audioUnlocked && (
          <p className="audio-unlock-hint">
            Click or press any key to enable audio
          </p>
        )}

        {/* ── Tagline ───────────────────────────────────────────────────── */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-text-dim)',
            textAlign: 'center',
            letterSpacing: '0.07em',
            fontStyle: 'italic',
          }}
        >
          "Concrete that breathes, grass you almost remember."
        </div>
      </div>

      {/* ── Glade bokeh strip ─────────────────────────────────────────────── */}
      <div className="run-select__glade-strip" />
    </div>
  );
};
