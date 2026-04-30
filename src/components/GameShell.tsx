import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';

const EGG_COLLECT_FADE_MS = 900;

import type { RunId, Point } from '../types/maze';
import type { GameState } from '../types/game';
import type { Maze } from '../types/maze';

import { GameEngine }         from '../game/engine';
import { createPlayer }       from '../game/player';
import { createDread }        from '../game/dread';
import {
  createRunState,
  RUN_CONFIGS,
  getNextRun,
} from '../game/run-controller';
import { getEasterEggGrid } from '../game/easter-egg';
import {
  hasEggForRun,
  isRun4Unlocked,
  markEggFound,
  markRunMazeWon,
} from '../content/easter-storage';
import { getInterestPoints }  from '../game/interest-points';
import { getEffectiveLightRadius } from '../game/dread';

import { generateMaze }       from '../maze/generate';

import { AudioDirector }      from '../audio/audio-director';

import { CanvasRoot }         from '../render/canvas-root';
import {
  renderMaze,
  renderPlayer,
  computeCameraOffset,
  drawEasterEggScreenMark,
} from '../render/maze-renderer';
import { applyLightMask, drawLightCenter } from '../render/light-mask';
import { drawGridOverlay, drawGridDots } from '../render/grid-overlay';
import { drawFilmGrain }      from '../render/post-fx';

import { HudStrip }           from './HudStrip';
import { HelpBar }            from './HelpBar';
import { WhisperCaption }     from './WhisperCaption';
import { ShiftWarningLine }   from './ShiftWarningLine';
import { PauseOverlay }       from './PauseOverlay';
import { WinOverlay }         from './WinOverlay';
import { FilmGrainOverlay }   from './FilmGrainOverlay';
import { BriefingModal }      from './BriefingModal';
import { EasterUnlockCelebration } from './EasterUnlockCelebration';

import { useAudioUnlock }     from '../hooks/useAudioUnlock';
import { ensureChronosBgm }   from '../audio/marketing-audio-singleton';

import {
  TILE_SIZE,
  SHIFT_SCREEN_SHAKE_MS,
  SHIFT_SCREEN_SHAKE_MAX_PX,
} from '../config/game';

type GamePhaseUI = 'briefing' | 'playing' | 'paused' | 'win';

export interface GameShellProps {
  initialRunId: RunId;
  onExitToMarketing: () => void;
}

interface CaptionState {
  text:   string;
  active: boolean;
}

export const GameShell: React.FC<GameShellProps> = ({
  initialRunId,
  onExitToMarketing,
}) => {
  const [phase,       setPhase]       = useState<GamePhaseUI>('briefing');
  const [selectedRun, setSelectedRun] = useState<RunId | null>(null);
  const [briefingRun, setBriefingRun] = useState<RunId>(initialRunId);

  const [gameState,     setGameState]     = useState<GameState | null>(null);
  const [caption,       setCaption]       = useState<CaptionState>({ text: '', active: false });
  const [shiftWarning,  setShiftWarning]  = useState(false);
  const [eggPartyOpen,  setEggPartyOpen]  = useState(false);

  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const engineRef      = useRef<GameEngine | null>(null);
  const audioRef       = useRef<AudioDirector | null>(null);
  const frameCountRef  = useRef(0);
  const prevMazeRef    = useRef<Maze | null>(null);
  const engineLiveRef  = useRef(false);

  const firstStepMovedRef     = useRef(false);
  const firstStepBloomStartMs = useRef<number | null>(null);
  /** Monotonic end time (performance.now) for post-collect marker fade; null when idle. */
  const eggCollectFadeEndRef = useRef<number | null>(null);
  /** Clears stale fade when switching between egg runs without a full shell remount. */
  const lastEggRenderRunRef = useRef<RunId | null>(null);

  const { unlocked: audioUnlocked, unlock: unlockAudio } = useAudioUnlock(
    useCallback(async () => {
      if (!audioRef.current) {
        audioRef.current = new AudioDirector();
      }
      await audioRef.current.initialize();
      audioRef.current.resume();
    }, [])
  );

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const renderGame = useCallback((state: GameState) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !state.maze) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#070809';
    ctx.fillRect(0, 0, W, H);

    const playerPos = state.player.position;
    const baseCam = computeCameraOffset(playerPos, W, H);
    const sm = state.screenShakeMs ?? 0;
    const shakeT =
      SHIFT_SCREEN_SHAKE_MS > 0 ? sm / SHIFT_SCREEN_SHAKE_MS : 0;
    const amp = shakeT * SHIFT_SCREEN_SHAKE_MAX_PX;
    const wob = (state.runState?.elapsedMs ?? 0) * 0.013;
    const cameraOffset = {
      x: baseCam.x + amp * Math.sin(wob),
      y: baseCam.y + amp * Math.cos(wob * 0.87),
    };

    const moving =
      state.player.velocity.x !== 0 || state.player.velocity.y !== 0;
    if (!firstStepMovedRef.current && moving) {
      firstStepMovedRef.current = true;
      firstStepBloomStartMs.current = performance.now();
    }

    let bloomExtraTiles = 0;
    const bloomStart = firstStepBloomStartMs.current;
    if (bloomStart !== null) {
      const t = (performance.now() - bloomStart) / 250;
      if (t >= 1) {
        firstStepBloomStartMs.current = null;
      } else {
        const u = 1 - (1 - t) * (1 - t);
        bloomExtraTiles = u * 0.55;
      }
    }

    const lightRadius =
      getEffectiveLightRadius(state.dread) + bloomExtraTiles;

    drawGridOverlay({
      ctx,
      canvasWidth:  W,
      canvasHeight: H,
      cellPx: TILE_SIZE,
      scrollOffset: {
        x: (playerPos.x * 0.12) % TILE_SIZE,
        y: (playerPos.y * 0.12) % TILE_SIZE,
      },
      opacity: 0.055,
    });
    drawGridDots({
      ctx,
      canvasWidth:  W,
      canvasHeight: H,
      cellPx: TILE_SIZE,
      scrollOffset: {
        x: (playerPos.x * 0.12) % TILE_SIZE,
        y: (playerPos.y * 0.12) % TILE_SIZE,
      },
      opacity: 0.04,
    });

    const rid = state.currentRun;
    let easterEggCell: Point | null = null;
    const eggRun =
      Boolean(rid && state.maze && (rid === 'run1' || rid === 'run2' || rid === 'run3'));
    if (eggRun && state.maze && rid) {
      easterEggCell = getEasterEggGrid(state.maze, rid);
      const prevR = lastEggRenderRunRef.current;
      if (prevR !== null && prevR !== rid) {
        eggCollectFadeEndRef.current = null;
      }
      lastEggRenderRunRef.current = rid;
    } else {
      lastEggRenderRunRef.current = null;
    }

    const nowMs = performance.now();
    const fadeEnd = eggCollectFadeEndRef.current;
    let eggCollectFade = 0;
    if (fadeEnd !== null) {
      if (nowMs >= fadeEnd) {
        eggCollectFadeEndRef.current = null;
        eggCollectFade = 0;
      } else {
        eggCollectFade = (fadeEnd - nowMs) / EGG_COLLECT_FADE_MS;
      }
    }

    const eggPersisted = Boolean(rid && hasEggForRun(rid));
    const fadeActive = fadeEnd !== null && nowMs < fadeEnd;
    const eggShowMark =
      Boolean(easterEggCell && eggRun) &&
      (!eggPersisted || fadeActive);
    const easterEggMarkAlpha = !eggPersisted ? 1 : eggCollectFade;

    let eggOutsideLamp = false;
    if (easterEggCell) {
      const ecx = (easterEggCell.x + 0.5) * TILE_SIZE;
      const ecy = (easterEggCell.y + 0.5) * TILE_SIZE;
      const ldx = ecx - playerPos.x;
      const ldy = ecy - playerPos.y;
      const litR = lightRadius * TILE_SIZE;
      eggOutsideLamp = ldx * ldx + ldy * ldy > litR * litR;
    }

    renderMaze({
      ctx,
      maze:            state.maze,
      playerWorldPos:  playerPos,
      cameraOffset,
      lightRadiusTiles: lightRadius + 1,
      showGhostWalls:  state.showGhostWalls,
      ghostWallAlpha:  state.ghostWallAlpha,
      prevMaze:        prevMazeRef.current ?? undefined,
      morphFrom:       state.wallMorphFrom,
      morphT:          state.wallMorphT,
    });

    drawLightCenter(ctx, W / 2, H / 2, lightRadius * TILE_SIZE);

    renderPlayer(
      ctx,
      playerPos,
      cameraOffset,
      state.player.facing,
      W,
      H,
    );

    applyLightMask({
      ctx,
      centerX:      W / 2,
      centerY:      H / 2,
      radiusTiles:  lightRadius,
      canvasWidth:  W,
      canvasHeight: H,
    });

    const eggMarkVisible =
      rid === 'run1' || eggOutsideLamp;

    if (
      easterEggCell &&
      eggShowMark &&
      easterEggMarkAlpha > 0.02 &&
      eggMarkVisible &&
      rid &&
      (rid === 'run1' || rid === 'run2' || rid === 'run3')
    ) {
      drawEasterEggScreenMark(ctx, easterEggCell, cameraOffset, {
        markAlpha: easterEggMarkAlpha,
        runId: rid,
      });
    }

    frameCountRef.current += 1;
    drawFilmGrain(ctx, W, H, state.dread.level, frameCountRef.current % 2);
  }, []);

  const startRun = useCallback(async (runId: RunId) => {
    engineRef.current?.stop();
    engineLiveRef.current = false;

    firstStepMovedRef.current = false;
    firstStepBloomStartMs.current = null;
    eggCollectFadeEndRef.current = null;
    lastEggRenderRunRef.current = null;

    const cfg = RUN_CONFIGS[runId];

    const mazeData = generateMaze({
      width:          cfg.mazeSize.width,
      height:         cfg.mazeSize.height,
      seed:           cfg.seed,
      decoyExitCount: cfg.decoyExitCount,
    });

    const toggleBudget =
      runId === 'run4' ? 22 : runId === 'run3' ? 20 : runId === 'run2' ? 16 : 12;
    const initialState: GameState = {
      phase:           'playing',
      currentRun:      runId,
      runState:        createRunState(runId),
      player:          createPlayer(mazeData.start),
      dread:           createDread(),
      maze:            mazeData,
      activeMazeState: { id: 'A', wallOverrides: [] },
      ghostWallAlpha:  0,
      pendingCue:      null,
      lastShiftMs:     0,
      showGhostWalls:  false,
      wallMorphFrom:   null,
      wallMorphT:      1,
      screenShakeMs:   0,
    };

    setGameState(initialState);
    setSelectedRun(runId);
    setPhase('playing');
    setCaption({ text: '', active: false });
    setShiftWarning(false);
    prevMazeRef.current = null;
    frameCountRef.current = 0;

    const engine = new GameEngine(initialState, {
      onShift: async (_newState, isMajor) => {
        prevMazeRef.current = engineRef.current?.getState().maze ?? null;

        if (isMajor) {
          audioRef.current?.playWallShift().catch(() => {});
        }
      },

      onShiftWarning: async () => {
        setShiftWarning(true);
        setTimeout(() => setShiftWarning(false), 900);
        audioRef.current?.playShiftWarning().catch(() => {});
      },

      onWrongTurn: async () => {
        audioRef.current?.playWrongTurn().catch(() => {});
      },

      onWin: async () => {
        engineLiveRef.current = false;
        await audioRef.current?.playExitFound();
        if (runId === 'run1' || runId === 'run2' || runId === 'run3') {
          const { justHitThree } = markRunMazeWon(runId);
          if (justHitThree) {
            setEggPartyOpen(true);
          }
        }
        setPhase('win');
      },

      onDecoyExit: async () => {
        audioRef.current?.playDecoyExit().catch(() => {});
      },

      onEasterEgg: () => {
        const { justHitThree } = markEggFound(runId);
        audioRef.current?.playUiClick();
        eggCollectFadeEndRef.current = performance.now() + EGG_COLLECT_FADE_MS;
        if (justHitThree) {
          setEggPartyOpen(true);
        }
      },

      onIdleHeartbeat: async () => {
        audioRef.current?.startHeartbeat().catch(() => {});
      },

      onRender: (state) => {
        setGameState((prev) => (prev === state ? prev : { ...state }));
        renderGame(state);

        audioRef.current?.tickFootstep(
          state.player.velocity.x !== 0 || state.player.velocity.y !== 0,
          state.player.isSlowWalking,
          16,
        );

        audioRef.current?.setPlayerPos(state.player.position);
      },
    });

    engine.setMaze(mazeData, [], [], {
      easterAlreadyFound: hasEggForRun(runId),
      majorToggleBudget: toggleBudget,
      majorShiftSalt: (cfg.seed + 1) >>> 0,
    });
    engineRef.current = engine;
    engineLiveRef.current = true;

    if (audioRef.current) {
      audioRef.current.setRun(runId);

      const interestPoints = getInterestPoints(mazeData);

      audioRef.current.startHumLoop(interestPoints.exit).catch(() => {});

      audioRef.current.startRunAmbience(runId);

      audioRef.current.playBreathHook().catch(() => {});

      setTimeout(() => {
        audioRef.current?.playRunStart().catch(() => {});
      }, 2_500);
    }

    engine.start();
  }, [renderGame]);

  const handleBriefingComplete = useCallback(
    (id: RunId) => {
      void startRun(id);
    },
    [startRun],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'KeyP') return;

      setPhase((current) => {
        if (current === 'playing') {
          engineRef.current?.updateState({ phase: 'paused' });
          return 'paused';
        }
        if (current === 'paused') {
          engineRef.current?.updateState({ phase: 'playing' });
          return 'playing';
        }
        return current;
      });
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      audioRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (phase === 'briefing') {
      void unlockAudio();
    }
  }, [phase, unlockAudio]);

  useEffect(() => {
    if (!audioUnlocked) return;
    ensureChronosBgm();
  }, [audioUnlocked]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUnlocked) return;
    if (phase === 'briefing' && briefingRun) {
      a.startRunAmbience(briefingRun);
    }
  }, [phase, audioUnlocked, briefingRun]);

  useEffect(() => {
    if (phase !== 'win') return;
    audioRef.current?.silenceGameplay();
  }, [phase]);

  const handleResume = useCallback(() => {
    engineRef.current?.updateState({ phase: 'playing' });
    setPhase('playing');
  }, []);

  const handleQuitToMenu = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    engineLiveRef.current = false;
    audioRef.current?.silenceGameplay();
    setSelectedRun(null);
    setGameState(null);
    setCaption({ text: '', active: false });
    setShiftWarning(false);
    eggCollectFadeEndRef.current = null;
    lastEggRenderRunRef.current = null;
    prevMazeRef.current = null;
    onExitToMarketing();
  }, [onExitToMarketing]);

  const handleNextRun = useCallback(() => {
    let nextRun = selectedRun ? getNextRun(selectedRun) : null;
    if (nextRun === 'run4' && !isRun4Unlocked()) {
      nextRun = null;
    }

    engineRef.current?.stop();
    engineRef.current = null;
    engineLiveRef.current = false;
    audioRef.current?.silenceGameplay();
    eggCollectFadeEndRef.current = null;
    lastEggRenderRunRef.current = null;

    if (nextRun) {
      setBriefingRun(nextRun);
      setPhase('briefing');
    } else {
      setSelectedRun(null);
      setGameState(null);
      onExitToMarketing();
    }
  }, [selectedRun, onExitToMarketing]);

  const runCfg        = selectedRun ? RUN_CONFIGS[selectedRun] : null;
  const isRun3        = selectedRun === 'run3';
  const hasNextRun    = Boolean(selectedRun && getNextRun(selectedRun));
  const nextMajorMs   = gameState?.runState?.nextMajorShiftMs ?? 0;
  const nextMinorMs   = isRun3 ? (gameState?.runState?.nextMinorShiftMs ?? 0) : null;

  const dreadLevel    = gameState?.dread.level ?? 0;

  return (
    <div className="game-viewport chronos-chrome">

      <div className="canvas-container">
        <CanvasRoot onReady={handleCanvasReady} />
      </div>

      {phase === 'briefing' && briefingRun && (
        <BriefingModal
          runId={briefingRun}
          audio={audioRef.current}
          onComplete={handleBriefingComplete}
        />
      )}

      {(phase === 'playing' || phase === 'paused') && runCfg && (
        <>
          <HudStrip
            runId={selectedRun}
            runName={runCfg.name}
            runSubtitle={runCfg.subtitle}
            nextMajorShiftMs={nextMajorMs}
            nextMinorShiftMs={nextMinorMs}
            shiftWarning={shiftWarning}
          />

          <ShiftWarningLine active={shiftWarning} />

          <div className="caption-area">
            <WhisperCaption
              text={caption.text}
              active={caption.active}
            />
          </div>

          <HelpBar />
        </>
      )}

      {phase === 'paused' && (
        <PauseOverlay
          audio={audioRef.current}
          onResume={handleResume}
          onQuit={handleQuitToMenu}
        />
      )}

      {phase === 'win' && selectedRun && (
        <WinOverlay
          runId={selectedRun}
          audio={audioRef.current}
          onNextRun={hasNextRun ? handleNextRun : undefined}
          onMenu={handleQuitToMenu}
        />
      )}

      <FilmGrainOverlay
        dreadLevel={dreadLevel}
        extraOpacity={phase === 'briefing' ? 0.05 : 0}
      />

      <EasterUnlockCelebration
        open={eggPartyOpen}
        onDismiss={() => {
          setEggPartyOpen(false);
        }}
      />

    </div>
  );
};
