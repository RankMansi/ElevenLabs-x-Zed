import React, { useCallback, useEffect, useState } from 'react';
import { HeroGorge } from '../components/marketing/HeroGorge';
import { MazeGlassRow } from '../components/marketing/MazeGlassRow';
import { EasterUnlockCelebration } from '../components/EasterUnlockCelebration';
import { useTitleScreenAmbience } from '../hooks/useTitleScreenAmbience';
import { consumePartyFlag } from '../content/easter-storage';
import '../styles/marketing-shell.css';
import '../styles/gorge-landing.css';

const CG_TWINKLES: [number, number][] = [
  [7, 11],
  [18, 19],
  [31, 8],
  [44, 24],
  [52, 12],
  [63, 31],
  [78, 14],
  [91, 22],
  [84, 38],
  [12, 42],
  [26, 52],
  [55, 48],
  [71, 56],
  [39, 58],
  [93, 8],
  [16, 28],
  [48, 6],
  [88, 52],
  [5, 58],
  [59, 18],
  [72, 8],
  [22, 62],
  [41, 36],
  [95, 34],
];

function scrollToSection(id: string) {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({
    behavior: smooth ? 'smooth' : 'auto',
    block: 'start',
  });
}

const Landing: React.FC = () => {
  useTitleScreenAmbience();
  const [eggPartyOpen, setEggPartyOpen] = useState(false);

  useEffect(() => {
    if (consumePartyFlag()) {
      setEggPartyOpen(true);
    }
  }, []);

  const enterMaze = useCallback(() => {
    scrollToSection('mazes');
    window.setTimeout(() => {
      document.querySelector<HTMLAnchorElement>('.glass-card__btn')?.focus();
    }, 450);
  }, []);

  return (
    <div className="ms-shell cg-shell" id="top">
      <EasterUnlockCelebration
        open={eggPartyOpen}
        onDismiss={() => setEggPartyOpen(false)}
      />
      <div className="cg-layer-stack" aria-hidden>
        <div className="cg-layer--glow" />
        <div className="cg-layer--silhouette" />
        <div className="cg-layer--water" />
        <div className="cg-grain" />
        <div className="cg-twinkles">
          {CG_TWINKLES.map(([l, t], i) => (
            <span
              key={`${l}-${t}-${i}`}
              className="cg-twinkle"
              style={{
                left: `${l}%`,
                top: `${t}%`,
                animationDelay: `${(i % 8) * 0.35}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="cg-shell__body">
        <div className="cg-landing-main">
          <HeroGorge onEnterMaze={enterMaze} />
          <section id="mazes" aria-labelledby="mazes-heading">
            <MazeGlassRow />
          </section>
          <footer className="cg-audio-hint-strip">
            <p className="cg-audio-hint" role="note">
              Headphones recommended
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Landing;
