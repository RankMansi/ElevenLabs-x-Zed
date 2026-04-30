import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RunId } from '../../types/maze';
import { RUN_CONFIGS } from '../../game/run-controller';
import {
  RUN1_SHIFT_PERIOD_MS,
  RUN2_SHIFT_PERIOD_MS,
  RUN3_MAJOR_PERIOD_MS,
  RUN3_MINOR_PERIOD_MS,
  RUN4_SHIFT_PERIOD_MS,
  LIE_PROBABILITY,
} from '../../config/game';
import {
  getEggCount,
  getSequentialMazeWins,
  isRun4Unlocked,
} from '../../content/easter-storage';
import { RunFourLockModal } from '../RunFourLockModal';

const ORDER: RunId[] = ['run1', 'run2', 'run3'];

const BTN: Record<RunId, string> = {
  run1: 'START METRONOME',
  run2: 'START FALSE SHEPHERD',
  run3: 'START DUAL CLOCK',
  run4: 'START LIFE OR DEATH',
};

function mechanicLine(id: RunId): string {
  if (id === 'run1') {
    return `One major shift every ${RUN1_SHIFT_PERIOD_MS / 1000}s · honest direction hints · no decoys`;
  }
  if (id === 'run2') {
    return `${Math.round(LIE_PROBABILITY * 100)}% of whisper hints lie · ${RUN2_SHIFT_PERIOD_MS / 1000}s shifts · one decoy exit`;
  }
  if (id === 'run3') {
    return `${RUN3_MAJOR_PERIOD_MS / 1000}s major / ${RUN3_MINOR_PERIOD_MS / 1000}s minor shifts · two decoy exits`;
  }
  return `${RUN4_SHIFT_PERIOD_MS / 1000}s major shifts · lying hints · two decoys · unlock: I→II→III exits + 3 marks`;
}

export const MazeGlassRow: React.FC = () => {
  const [lockOpen, setLockOpen] = useState(false);
  const [eggCount, setEggCount] = useState(() => getEggCount());
  const [mazeWinsOrdered, setMazeWinsOrdered] = useState(() =>
    getSequentialMazeWins(),
  );

  const refreshEggs = useCallback(() => {
    setEggCount(getEggCount());
    setMazeWinsOrdered(getSequentialMazeWins());
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshEggs();
    };
    window.addEventListener('focus', refreshEggs);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refreshEggs);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshEggs]);

  const run4Cfg = RUN_CONFIGS.run4;
  const run4Unlocked = isRun4Unlocked();

  return (
    <div className="cg-maze-row-wrap">
      <RunFourLockModal
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        eggCount={eggCount}
        mazeWinsOrdered={mazeWinsOrdered}
      />

      <h2 className="cg-maze-row__heading" id="mazes-heading">
        FOUR RUNS
      </h2>
      <p className="cg-maze-row__egg-note">
        Run IV: win I, II, III in order <em>and</em> all three marks this session. I–III: neon
        in dark; Run I also in light. Resets on reload.
      </p>
      <div className="cg-maze-row" role="list">
        {ORDER.map((id) => {
          const cfg = RUN_CONFIGS[id];
          const w = cfg.mazeSize.width;
          const h = cfg.mazeSize.height;
          return (
            <article key={id} className="glass-card" role="listitem">
              <p className="glass-card__label">
                {cfg.name} — {cfg.subtitle}
              </p>
              <h3 className="glass-card__headline">{mechanicLine(id)}</h3>
              <p className="glass-card__body">{cfg.description}</p>
              <p className="glass-card__meta">
                Grid {w}×{h}
                {cfg.hasMinorShifts ? ' · minor + major shifts' : ''}
                {cfg.hasLies && !cfg.hasMinorShifts ? ' · lying hints' : ''}
              </p>
              <Link className="glass-card__btn" to={`/play/${id}`}>
                {BTN[id]}
              </Link>
            </article>
          );
        })}

        <article className="glass-card glass-card--run4" role="listitem">
          <p className="glass-card__label">
            {run4Cfg.name} — {run4Cfg.subtitle}
          </p>
          <h3 className="glass-card__headline">{mechanicLine('run4')}</h3>
          <p className="glass-card__body">{run4Cfg.description}</p>
          <p className="glass-card__meta">
            Grid {run4Cfg.mazeSize.width}×{run4Cfg.mazeSize.height}
            {run4Cfg.hasLies ? ' · lying hints' : ''}
            {!run4Unlocked && (
              <span className="glass-card__locked-tag"> · locked</span>
            )}
          </p>
          {run4Unlocked ? (
            <Link className="glass-card__btn" to="/play/run4" onClick={refreshEggs}>
              {BTN.run4}
            </Link>
          ) : (
            <button
              type="button"
              className="glass-card__btn glass-card__btn--locked"
              onClick={() => {
                refreshEggs();
                setLockOpen(true);
              }}
            >
              RUN IV (LOCKED)
            </button>
          )}
        </article>
      </div>
    </div>
  );
};
