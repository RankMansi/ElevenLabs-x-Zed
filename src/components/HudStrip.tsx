import React from 'react';
import type { RunId } from '../types/maze';
import { ShiftCountdown } from './ShiftCountdown';

interface HudStripProps {
  runId: RunId | null;
  runName: string;
  runSubtitle: string;
  nextMajorShiftMs: number;
  nextMinorShiftMs: number | null;
  shiftWarning: boolean;
}

export const HudStrip: React.FC<HudStripProps> = ({
  runId,
  runName,
  runSubtitle,
  nextMajorShiftMs,
  nextMinorShiftMs,
  shiftWarning,
}) => {
  return (
    <div className="hud-strip-top">
      {/* ── Left: run identifier ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span className="hud-run-label">{runName}</span>
        {runSubtitle && (
          <span className="hud-run-subtitle">— {runSubtitle}</span>
        )}
      </div>

      {/* ── Right: shift timers ──────────────────────────────────────────── */}
      {runId && (
        <ShiftCountdown
          nextMajorMs={nextMajorShiftMs}
          nextMinorMs={nextMinorShiftMs}
          warning={shiftWarning}
        />
      )}
    </div>
  );
};
