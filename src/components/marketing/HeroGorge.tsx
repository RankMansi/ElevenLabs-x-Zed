import React from 'react';

export interface HeroGorgeProps {
  onEnterMaze: () => void;
}

const RISE_COUNT = 52;

export const HeroGorge: React.FC<HeroGorgeProps> = ({ onEnterMaze }) => {
  return (
    <section className="cg-title-hero" aria-labelledby="cg-title-main">
      <div className="cg-title-sky" aria-hidden="true">
        <div className="cg-monolith-cluster">
          <div className="cg-monolith">
            <span className="cg-monolith__ridge cg-monolith__ridge--l" />
            <span className="cg-monolith__ridge cg-monolith__ridge--r" />
          </div>
          <div className="cg-rise-field">
            {Array.from({ length: RISE_COUNT }, (_, i) => {
              const spread = ((i * 17) % 21) - 10;
              const delay = (i * 0.11) % 5;
              const dur = 7 + (i % 9) * 0.65;
              return (
                <span
                  key={i}
                  className="cg-rise"
                  style={{
                    left: `calc(50% + ${spread}px)`,
                    animationDelay: `${delay}s`,
                    animationDuration: `${dur}s`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="cg-title-copy">
        <p className="cg-title-kicker">MAZE RUNTIME · CHRONOS</p>
        <h1 className="cg-title-main" id="cg-title-main">
          <span className="cg-title-main__line">CHRONOS</span>
          <span className="cg-title-main__line cg-title-main__line--second">GRID</span>
        </h1>
        <p className="cg-title-lede">
          Timed wall swaps, short-range light, stereo hum toward the exit. Arrows move;{' '}
          <strong>Esc</strong> pauses. Sizes and rules on each run card below.
        </p>
        <button type="button" className="cg-enter-maze" onClick={onEnterMaze}>
          ENTER MAZE
        </button>
      </div>
    </section>
  );
};
