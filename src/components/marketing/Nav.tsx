import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

function scrollToId(id: string) {
  const el = document.getElementById(id);
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}

export interface MarketingNavProps {
  onEnterMaze: () => void;
}

export const MarketingNav: React.FC<MarketingNavProps> = ({ onEnterMaze }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const go = useCallback((id: string) => {
    return (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      scrollToId(id);
      setMenuOpen(false);
    };
  }, []);

  return (
    <header className={`ms-nav${menuOpen ? ' ms-nav--open' : ''}`}>
      <Link to="/" className="ms-nav__brand" onClick={() => setMenuOpen(false)}>
        CHRONOS GRID
      </Link>
      <nav id="ms-primary-nav" className="ms-nav__links" aria-label="Primary">
        <a href="#about" className="ms-nav__link" onClick={go('about')}>
          ABOUT
        </a>
        <a href="#mazes" className="ms-nav__link" onClick={go('mazes')}>
          RUNS
        </a>
        <a href="#signal" className="ms-nav__link" onClick={go('signal')}>
          SIGNAL
        </a>
        <a href="#contact" className="ms-nav__link" onClick={go('contact')}>
          CONTACT
        </a>
      </nav>
      <div className="ms-nav__end">
        <button
          type="button"
          className="ms-nav__cta"
          onClick={() => {
            setMenuOpen(false);
            onEnterMaze();
          }}
        >
          ENTER MAZE
        </button>
        <button
          type="button"
          className="ms-nav__burger"
          aria-expanded={menuOpen}
          aria-controls="ms-primary-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          Menu
        </button>
      </div>
    </header>
  );
};
