/**
 * Dev / preview only: POST /api/chronos-music and POST /api/chronos-sfx
 * use ELEVENLABS_API_KEY from .env (same key as TTS). Static production builds
 * need a real backend proxy with the same contract if you want API music live.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import type { Connect } from 'vite';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { TtsEnv } from './tts-middleware';

/** Keep in sync with `src/audio/chronos-music-prompt.ts`. */
const CHRONOS_BGM_PROMPT = [
  'Cinematic instrumental only — NO vocals.',
  'NOT horror or scary: avoid ominous drones, creeping dread, spooky stabs, jump-scare impacts, dissonant scrapes as the main feature, dark ambient noise walls, evil bass growls, demonic undertones, or pure horror sound design. Tension = high stakes, not terror.',
  'Theme: blockbuster survival thriller — gigantic cold grey stone labyrinth beside a fragile pocket of greenery; restrained natural “alive” shimmer against vast mineral scale.',
  'Emotional mix: adrenaline, urgency, camaraderie-in-adversity, curiosity, bittersweet determination — never terror.',
  'Orchestral-electronic hybrid: wide strings with short bow attacks (never screeching horror strings); brass low and noble (NO trailer “BRAAAM”); light driving percussion like a measured running pace around 100–112 BPM — NOT four-on-the-floor club.',
  'Subtle organic layers: soft wind and air; airy choir PADS ONLY — neutral “aaa” pad texture, extremely quiet, vowel-neutral, background wash only — NOT epic chant or lead vocals. Occasional clean electric guitar or plucked harp-like pings for hope.',
  'Harmony: open, slightly unresolved minor with rising hopeful motion; avoid cliché spooky Phrygian horror color. Keep ambiguity forward-moving and optimistic-adrenal, not dread.',
  'STRUCTURE (single ~90s piece that still evolves; optimistic survival energy):',
  'Opening: sunrise-through-fog sparkle; thin bright highs, warm low mids; a steady soft pulse emerges.',
  'Middle: widen the space — sense of SCALE in big corridors; driving rhythm subtly stronger; shimmering highs like distant bioluminescent leaves against cold restrained metallic taps (order / system).',
  'Bridge: heroic lift but restrained — “determined sprint,” not a victory fanfare or triumphant climax.',
  'Downshift: breathable strip-back — wind, muted pulse, gentle shimmer so the energy can loop.',
  'LOOP REQUIREMENT (endless gameplay): The LAST 12 SECONDS must glide back toward the opening texture and a similar loudness spectrum — NO finale sting, NO resolved major cadence, NO horror tail. End with air + soft pulse + gentle shimmer so second 0 connects seamlessly when looped.',
  'Bans: horror strings as lead, jump-scare hits, ominous drone walls, trailer BRAAAM, epic choir climax, cheesy horror stab, obvious final chord or ritardando “finished” ending.',
  'Prefer crossfade-friendly textures and controlled dynamics at the tail over huge transient peaks in the final seconds.',
].join(' ');

const CHRONOS_SFX_ATMOSPHERE_PROMPT = [
  'Seamless looping bed: subterranean air movement, faint far-off electrical hum,',
  'microscopic water drips, no melody, no rhythm, no voice, ultra-wide stereo wash.',
].join(' ');

const CHRONOS_BGM_LENGTH_MS = 90_000;
const CHRONOS_SFX_DURATION_SEC = 22;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) parts.push(value);
  }
  return Buffer.concat(parts.map((u) => Buffer.from(u)));
}

function json(res: ServerResponse, status: number, obj: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

function clampMusicMs(n: number): number {
  if (!Number.isFinite(n)) return CHRONOS_BGM_LENGTH_MS;
  return Math.min(300_000, Math.max(10_000, Math.round(n)));
}

export function createChronosElevenlabsMiddleware(
  getEnv: () => TtsEnv,
): Connect.NextHandleFunction {
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const url = req.url?.split('?')[0] ?? '';
    if (req.method !== 'POST') {
      next();
      return;
    }

    const env = getEnv();
    const apiKey = env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      if (url === '/api/chronos-music' || url === '/api/chronos-sfx') {
        json(res, 503, {
          error: 'Chronos ElevenLabs routes unavailable',
          detail:
            'Missing ELEVENLABS_API_KEY in .env (server-only). Music generation requires a paid-capable key.',
        });
        return;
      }
      next();
      return;
    }

    if (url === '/api/chronos-music') {
      let payload: unknown;
      try {
        const raw = await readBody(req);
        payload = JSON.parse(raw || '{}') as unknown;
      } catch {
        json(res, 400, { error: 'Invalid JSON body' });
        return;
      }
      const b = (payload && typeof payload === 'object' ? payload : {}) as Record<
        string,
        unknown
      >;
      const prompt =
        typeof b.prompt === 'string' && b.prompt.trim().length > 0
          ? b.prompt.trim().slice(0, 4_000)
          : CHRONOS_BGM_PROMPT;
      const musicLengthMs = clampMusicMs(
        typeof b.musicLengthMs === 'number' ? b.musicLengthMs : CHRONOS_BGM_LENGTH_MS,
      );

      try {
        const client = new ElevenLabsClient({ apiKey });
        const detailed = await client.music.composeDetailed({
          prompt,
          musicLengthMs,
          forceInstrumental: true,
          outputFormat: 'mp3_44100_128',
        });
        const buf = detailed.audio;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Chronos-Music-Length-Ms', String(musicLengthMs));
        res.end(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[api/chronos-music]', msg);
        json(res, 502, { error: 'ElevenLabs music generation failed', detail: msg });
      }
      return;
    }

    if (url === '/api/chronos-sfx') {
      let payload: unknown;
      try {
        const raw = await readBody(req);
        payload = JSON.parse(raw || '{}') as unknown;
      } catch {
        json(res, 400, { error: 'Invalid JSON body' });
        return;
      }
      const b = (payload && typeof payload === 'object' ? payload : {}) as Record<
        string,
        unknown
      >;
      const text =
        typeof b.text === 'string' && b.text.trim().length > 0
          ? b.text.trim().slice(0, 2_000)
          : CHRONOS_SFX_ATMOSPHERE_PROMPT;
      const durationSeconds =
        typeof b.durationSeconds === 'number' && b.durationSeconds >= 0.5 && b.durationSeconds <= 30
          ? b.durationSeconds
          : CHRONOS_SFX_DURATION_SEC;

      try {
        const client = new ElevenLabsClient({ apiKey });
        const stream = await client.textToSoundEffects.convert({
          text,
          durationSeconds,
          loop: true,
          outputFormat: 'mp3_44100_128',
        });
        const buf = await streamToBuffer(stream);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.end(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[api/chronos-sfx]', msg);
        json(res, 502, { error: 'ElevenLabs sound effect generation failed', detail: msg });
      }
      return;
    }

    next();
  };
}
