import { startProceduralCaveAmbience } from './procedural-cave-ambience';
import {
  CHRONOS_BGM_LENGTH_MS,
  CHRONOS_BGM_PROMPT,
  CHRONOS_SFX_ATMOSPHERE_PROMPT,
  CHRONOS_SFX_DURATION_SEC,
} from './chronos-music-prompt';

type ProcSession = {
  kind: 'proc';
  ctx: AudioContext;
  stopBed: () => void;
};

type ElevenSession = {
  kind: 'eleven';
  stopBed: () => void;
};

let session: ProcSession | ElevenSession | null = null;
let boot: Promise<void> | null = null;
/** After one ElevenLabs upgrade attempt (success or fail), do not re-fetch every navigation. */
let upgradeScheduled = false;

let procCtx: AudioContext | null = null;

/** Call synchronously from pointer / unlock handlers so resume() stays in the user-gesture window. */
function primeAudioContext(): void {
  if (!procCtx) procCtx = new AudioContext();
  void procCtx.resume();
}

function teardownEleven(s: ElevenSession): void {
  s.stopBed();
}

function teardownProc(s: ProcSession): void {
  s.stopBed();
}

/**
 * Stops Chronos marketing / maze bed (ElevenLabs or procedural). Normally you
 * leave playback running across landing → play; use this only for hard teardown.
 */
export function stopTitleScreenBed(): void {
  if (session?.kind === 'eleven') teardownEleven(session);
  if (session?.kind === 'proc') teardownProc(session);
  session = null;
  boot = null;
  upgradeScheduled = false;
}

async function waitForRunningContext(ctx: AudioContext, maxMs: number): Promise<boolean> {
  if (ctx.state === 'running') return true;
  await ctx.resume();
  if ((ctx.state as string) === 'running') return true;
  await new Promise<void>((resolve) => {
    const t = window.setTimeout(() => {
      ctx.removeEventListener('statechange', onState);
      resolve();
    }, maxMs);
    const onState = () => {
      if ((ctx.state as string) === 'running') {
        window.clearTimeout(t);
        ctx.removeEventListener('statechange', onState);
        resolve();
      }
    };
    ctx.addEventListener('statechange', onState);
    void ctx.resume();
  });
  return (ctx.state as string) === 'running';
}

async function startProceduralBed(): Promise<void> {
  if (!procCtx) procCtx = new AudioContext();
  const ok = await waitForRunningContext(procCtx, 4_000);
  if (!ok) return;
  if (session?.kind === 'proc') return;
  const stopBed = startProceduralCaveAmbience(procCtx, procCtx.destination, 'title_screen');
  session = { kind: 'proc', ctx: procCtx, stopBed };
}

function playDecodedLoop(
  ctx: AudioContext,
  buffer: AudioBuffer,
  gainDb: number,
): () => void {
  const master = ctx.createGain();
  master.gain.value = Math.pow(10, gainDb / 20);
  master.connect(ctx.destination);

  let current: AudioBufferSourceNode | null = null;

  const playOne = () => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(master);
    src.start(0);
    current = src;
  };

  playOne();

  return () => {
    try {
      current?.stop();
    } catch {
      /* already stopped */
    }
    current?.disconnect();
    master.disconnect();
    current = null;
  };
}

async function tryElevenLabsUpgrade(): Promise<boolean> {
  if (!procCtx || procCtx.state !== 'running') return false;

  const musicRes = await fetch('/api/chronos-music', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: CHRONOS_BGM_PROMPT,
      musicLengthMs: CHRONOS_BGM_LENGTH_MS,
    }),
  });
  if (!musicRes.ok) return false;
  const ct = musicRes.headers.get('content-type') ?? '';
  if (!ct.includes('audio') && !ct.includes('octet-stream')) return false;

  const raw = await musicRes.arrayBuffer();
  let musicBuf: AudioBuffer;
  try {
    musicBuf = await procCtx.decodeAudioData(raw.slice(0));
  } catch {
    return false;
  }

  let stopSfx: (() => void) | null = null;
  try {
    const sfxRes = await fetch('/api/chronos-sfx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: CHRONOS_SFX_ATMOSPHERE_PROMPT,
        durationSeconds: CHRONOS_SFX_DURATION_SEC,
      }),
    });
    if (sfxRes.ok) {
      const sct = sfxRes.headers.get('content-type') ?? '';
      if (sct.includes('audio') || sct.includes('octet-stream')) {
        const sfxRaw = await sfxRes.arrayBuffer();
        const sfxBuf = await procCtx.decodeAudioData(sfxRaw.slice(0));
        stopSfx = playDecodedLoop(procCtx, sfxBuf, -8);
      }
    }
  } catch {
    /* optional */
  }

  const stopMusic = playDecodedLoop(procCtx, musicBuf, 2);

  if (session?.kind === 'proc') {
    teardownProc(session);
  }

  const stopBed = () => {
    stopMusic();
    stopSfx?.();
  };

  session = { kind: 'eleven', stopBed };
  return true;
}

async function bootOnce(): Promise<void> {
  if (session?.kind === 'eleven') return;

  if (!session) {
    await startProceduralBed();
  }

  if (session?.kind !== 'proc') return;
  if (upgradeScheduled) return;
  upgradeScheduled = true;

  try {
    await tryElevenLabsUpgrade();
  } catch {
    /* keep procedural */
  }
}

/**
 * Starts the shared Chronos bed: procedural audio immediately (after sync context prime),
 * then replaces with ElevenLabs music when `/api/chronos-*` returns audio.
 */
export function startTitleScreenBed(): void {
  primeAudioContext();

  if (session?.kind === 'eleven') return;
  if (session?.kind === 'proc' && upgradeScheduled && !boot) return;

  if (boot) return;

  boot = bootOnce().finally(() => {
    boot = null;
  });
}

/** Alias for GameShell — same shared bed as the landing page. */
export function ensureChronosBgm(): void {
  startTitleScreenBed();
}
