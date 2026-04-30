import React from 'react';
import type { RunId } from '../../types/maze';

const CARDS: { title: string; micro: string; pulseRun: RunId }[] = [
  { title: 'ARROWS', micro: 'Move runner', pulseRun: 'run1' },
  { title: '2 M LIGHT', micro: 'Vision cone', pulseRun: 'run2' },
  { title: 'LAYOUTS', micro: 'Timed wall swaps', pulseRun: 'run3' },
  { title: 'AUDIO', micro: 'Evidence & lies', pulseRun: 'run2' },
  { title: 'THREE RUNS', micro: 'Escalating clocks', pulseRun: 'run1' },
];

export interface FeatureCardRowProps {
  onCardActivate: (highlightRun: RunId) => void;
}

export const FeatureCardRow: React.FC<FeatureCardRowProps> = ({ onCardActivate }) => (
  <div className="ms-feature-row" role="list">
    {CARDS.map((c) => (
      <button
        key={c.title}
        type="button"
        className="ms-feature-card"
        role="listitem"
        onClick={() => onCardActivate(c.pulseRun)}
      >
        <span className="ms-feature-card__thumb" aria-hidden />
        <span className="ms-feature-card__title">{c.title}</span>
        <span className="ms-feature-card__micro">{c.micro}</span>
      </button>
    ))}
  </div>
);
