import React from 'react';
import { Link } from 'react-router-dom';

const PHASES = [
  {
    id: 'run1' as const,
    title: 'PHASE I · METRONOME',
    body: 'Master one clock',
  },
  {
    id: 'run2' as const,
    title: 'PHASE II · FALSE SHEPHERD',
    body: 'Separate truth & bait',
  },
  {
    id: 'run3' as const,
    title: 'PHASE III · DUAL CLOCK',
    body: 'Two clocks arguing',
  },
];

export const Timeline: React.FC = () => (
  <div className="ms-timeline" aria-label="Run phases">
    <div className="ms-timeline__line" aria-hidden />
    <ol className="ms-timeline__list">
      {PHASES.map((p) => (
        <li key={p.id} className="ms-timeline__node">
          <Link to={`/play/${p.id}`} className="ms-timeline__thumb" title={`Open ${p.title}`}>
            <span className="ms-timeline__glyph" aria-hidden />
          </Link>
          <div className="ms-timeline__copy">
            <h3 className="ms-timeline__title">{p.title}</h3>
            <p className="ms-timeline__body">{p.body}</p>
            <Link to={`/play/${p.id}`} className="ms-timeline__link">
              Enter phase →
            </Link>
          </div>
        </li>
      ))}
    </ol>
  </div>
);
