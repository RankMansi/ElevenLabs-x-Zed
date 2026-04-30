import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { GameShell } from '../components/GameShell';
import { parseRunParam } from '../utils/runRoutes';
import { isRun4Unlocked } from '../content/easter-storage';
import '../styles/marketing-shell.css';

const RUN_ROMAN: Record<string, string> = {
  run1: 'I',
  run2: 'II',
  run3: 'III',
  run4: 'IV',
};

const Play: React.FC = () => {
  const { runId } = useParams();
  const navigate = useNavigate();
  const id = parseRunParam(runId);

  if (!id) {
    return <Navigate to="/" replace />;
  }

  if (id === 'run4' && !isRun4Unlocked()) {
    return <Navigate to="/" replace />;
  }

  const roman = RUN_ROMAN[id] ?? id;

  return (
    <div className="play-route">
      <header className="play-route__bar">
        <button
          type="button"
          className="play-route__back"
          onClick={() => navigate('/')}
        >
          ← Back to site
        </button>
        <span className="play-route__label">
          Run {roman} — briefing / maze
        </span>
      </header>
      <GameShell
        key={id}
        initialRunId={id}
        onExitToMarketing={() => navigate('/')}
      />
    </div>
  );
};

export default Play;
