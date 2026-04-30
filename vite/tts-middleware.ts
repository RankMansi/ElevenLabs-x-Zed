/**
 * Vite dev / preview middleware: POST /api/tts → ElevenLabs (server-side only).
 */
import type { IncomingMessage, ServerResponse } from 'http';
import type { Connect } from 'vite';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const MAX_TEXT_CHARS = 4_000;
const VOICES_CACHE_MS = 5 * 60 * 1000;

type VoiceIdCache = { ids: string[]; fetchedAt: number };
let voiceIdCache: VoiceIdCache | null = null;

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

async function resolveVoiceIdForRequest(
  client: ElevenLabsClient,
  env: TtsEnv,
  body: Record<string, unknown>,
): Promise<string> {
  const allowVoiceOverride = env.ALLOW_TTS_VOICE_OVERRIDE === '1';
  const bodyVoice =
    typeof body.voiceId === 'string' && body.voiceId.trim() ? body.voiceId.trim() : '';
  if (allowVoiceOverride && bodyVoice) {
    return bodyVoice;
  }

  const fromEnv = env.ELEVENLABS_VOICE_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const now = Date.now();
  if (
    !voiceIdCache ||
    voiceIdCache.ids.length === 0 ||
    now - voiceIdCache.fetchedAt > VOICES_CACHE_MS
  ) {
    const list = await client.voices.getAll({ showLegacy: true });
    const ids = (list.voices ?? [])
      .map((v) => v.voiceId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    voiceIdCache = { ids, fetchedAt: now };
  }

  const { ids } = voiceIdCache;
  if (!ids.length) {
    throw new Error(
      'No voices returned for this API key. Add voices in ElevenLabs or set ELEVENLABS_VOICE_ID.',
    );
  }

  return ids[Math.floor(Math.random() * ids.length)]!;
}

export type TtsEnv = {
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  ELEVENLABS_MODEL_ID?: string;
  ALLOW_TTS_VOICE_OVERRIDE?: string;
};

export function createTtsMiddleware(getEnv: () => TtsEnv): Connect.NextHandleFunction {
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url !== '/api/tts' || req.method !== 'POST') {
      next();
      return;
    }

    const env = getEnv();
    const apiKey = env.ELEVENLABS_API_KEY?.trim();

    if (!apiKey) {
      json(res, 503, {
        error: 'TTS unavailable',
        detail:
          'Missing ELEVENLABS_API_KEY in .env (server-only; never VITE_*). Restart dev after saving.',
      });
      return;
    }

    let payload: unknown;
    try {
      const raw = await readBody(req);
      payload = JSON.parse(raw || '{}') as unknown;
    } catch {
      json(res, 400, { error: 'Invalid JSON body' });
      return;
    }

    if (!payload || typeof payload !== 'object') {
      json(res, 400, { error: 'Body must be a JSON object' });
      return;
    }

    const b = payload as Record<string, unknown>;
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text.length) {
      json(res, 400, { error: 'Missing or empty "text"' });
      return;
    }
    if (text.length > MAX_TEXT_CHARS) {
      json(res, 400, { error: `Text exceeds ${MAX_TEXT_CHARS} characters` });
      return;
    }

    const modelId =
      typeof b.modelId === 'string' && b.modelId.trim()
        ? b.modelId.trim().slice(0, 64)
        : (env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_flash_v2_5');

    const outputFormat =
      typeof b.outputFormat === 'string' && /^mp3_[0-9_]+$/.test(b.outputFormat.trim())
        ? b.outputFormat.trim()
        : 'mp3_44100_128';

    const requestBody: Parameters<ElevenLabsClient['textToSpeech']['convert']>[1] = {
      text,
      modelId,
      outputFormat: outputFormat as 'mp3_44100_128',
    };

    if (b.voiceSettings && typeof b.voiceSettings === 'object' && b.voiceSettings !== null) {
      const vs = b.voiceSettings as Record<string, unknown>;
      const simSnake = vs.similarity_boost;
      const simCamel = vs.similarityBoost;
      requestBody.voiceSettings = {
        stability: typeof vs.stability === 'number' ? vs.stability : undefined,
        similarityBoost:
          typeof simCamel === 'number'
            ? simCamel
            : typeof simSnake === 'number'
              ? simSnake
              : undefined,
        speed: typeof vs.speed === 'number' ? vs.speed : undefined,
      };
    }

    try {
      const client = new ElevenLabsClient({ apiKey });
      let voiceId: string;
      try {
        voiceId = await resolveVoiceIdForRequest(client, env, b);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[api/tts] voice resolution:', msg);
        json(res, 503, { error: 'TTS voice unavailable', detail: msg });
        return;
      }

      const stream = await client.textToSpeech.convert(voiceId, requestBody);
      const buf = await streamToBuffer(stream);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-TTS-Voice-Id', voiceId);
      res.end(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[api/tts]', msg);
      json(res, 502, { error: 'ElevenLabs generation failed', detail: msg });
    }
  };
}
