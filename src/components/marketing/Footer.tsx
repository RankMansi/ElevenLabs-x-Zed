import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';

function makeScrollHandler(id: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'start',
    });
  };
}

export const Footer: React.FC = () => {
  const discord = import.meta.env.VITE_DISCORD_URL?.trim();
  const xUrl = import.meta.env.VITE_X_URL?.trim();

  const goAbout = useCallback(makeScrollHandler('about'), []);
  const goMazes = useCallback(makeScrollHandler('mazes'), []);
  const goSignal = useCallback(makeScrollHandler('signal'), []);
  const goContact = useCallback(makeScrollHandler('contact'), []);

  return (
    <footer className="ms-footer">
      <div className="ms-footer__inner">
        <Link to="/" className="ms-footer__brand">
          CHRONOS GRID
        </Link>
        <nav className="ms-footer__nav" aria-label="Footer">
          <a href="#about" onClick={goAbout}>
            ABOUT
          </a>
          <a href="#mazes" onClick={goMazes}>
            RUNS
          </a>
          <a href="#signal" onClick={goSignal}>
            SIGNAL
          </a>
          <a href="#contact" onClick={goContact}>
            CONTACT
          </a>
        </nav>
        <div className="ms-footer__social">
          {discord ? (
            <a href={discord} target="_blank" rel="noreferrer noopener">
              Discord
            </a>
          ) : null}
          {xUrl ? (
            <a href={xUrl} target="_blank" rel="noreferrer noopener">
              X
            </a>
          ) : null}
        </div>
      </div>
      <p className="ms-footer__legal">Concrete calendar · sound as evidence · no embeds</p>
    </footer>
  );
};
