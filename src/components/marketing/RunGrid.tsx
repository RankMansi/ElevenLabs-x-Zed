import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RunId } from '../../types/maze';

const RUNS: {
  id: RunId;
  title: string;
  micro: string;
  btn: string;
}[] = [
  {
    id: 'run1',
    title: 'RUN I — METRONOME',
    micro: 'Single shift clock · learn the rhythm',
    btn: 'BEGIN METRONOME',
  },
  {
    id: 'run2',
    title: 'RUN II — FALSE SHEPHERD',
    micro: 'Some cues lie · trust ear & map',
    btn: 'BEGIN FALSE SHEPHERD',
  },
  {
    id: 'run3',
    title: 'RUN III — DUAL CLOCK',
    micro: 'Major + minor shifts · decoys live here',
    btn: 'BEGIN DUAL CLOCK',
  },
];

export interface RunGridProps {
  pulseRunId: RunId | null;
}

export const RunGrid: React.FC<RunGridProps> = ({ pulseRunId }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!pulseRunId) return;
    const el = document.querySelector(`[data-ms-run="${pulseRunId}"]`);
    if (!el || !(el instanceof HTMLElement)) return;
    el.classList.add('ms-run-card--pulse');
    const t = window.setTimeout(() => el.classList.remove('ms-run-card--pulse'), 1600);
    return () => window.clearTimeout(t);
  }, [pulseRunId]);

  return (
    <div className="ms-run-grid">
      {RUNS.map((r) => (
        <div key={r.id} data-ms-run={r.id} className="ms-run-card">
          <h3 className="ms-run-card__title">{r.title}</h3>
          <p className="ms-run-card__micro">{r.micro}</p>
          <button
            type="button"
            className="ms-run-card__btn"
            onClick={() => navigate(`/play/${r.id}`)}
          >
            {r.btn}
          </button>
        </div>
      ))}
    </div>
  );
};
