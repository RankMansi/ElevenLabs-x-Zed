/**
 * CHRONOS GRID — ElevenLabs TTS Proxy Server
 *
 * A minimal Bun HTTP server that proxies Text-to-Speech requests to the
 * ElevenLabs API, keeping the API key out of the browser bundle.
 *
 * Usage (from chronos-grid/):
 *   bun run src/server/index.ts
 *
 * Endpoints:
 *   POST /api/tts          Generate TTS audio, returns audio/mpeg
 *   GET  /api/voices       List available ElevenLabs voices
 *   GET  /api/health       Health check
 *
 * Environment variables (see .env.example):
 *   ELEVENLABS_API_KEY     Required for live TTS
 *   SERVER_PORT            Defaults to 3001
 *   ALLOWED_ORIGIN         CORS origin, defaults to http://localhost:5173
 *
 * Hackathon note:
 *   If ELEVENLABS_API_KEY is not set, the server starts in "pre-bake only"
 *   mode and returns 503 for TTS requests — the Vite dev server will serve
 *   pre-baked audio from /public/audio instead.
 */

// ---------------------------------------------------------------------------
// Constants / config
// ---------------------------------------------------------------------------

const PORT    = Number(process.env.SERVER_PORT ?? 3001);
const API_KEY = process.env.ELEVENLABS_API_KEY ?? '';
const ORIGIN  = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173';

const ELEVEN_BASE   = 'https://api.elevenlabs.io/v1';
const DEFAULT_MODEL = 'eleven_monolingual_v1';

/**
 * Known voice IDs used by Chronos Grid.
 * Exposed so the client can request them by persona name rather than raw ID.
 */
const VOICES: Record<string, string> = {
  architect: '21m00Tcm4TlvDq8ikWAM', // Rachel — calm, authoritative Dispatch
  glitch:    'AZnzlk1XvdvUeBnXmlld', // Domi   — degraded False Shepherd
  subject:   'ErXwobaYiN019PkySvjV', // Antoni — neutral system read-out
};

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

interface TtsRequestBody {
  text:      string;
  voiceId?:  string;          // raw ElevenLabs voice ID
  persona?:  keyof typeof VOICES; // OR a persona name (architect | glitch | subject)
  modelId?:  string;
  stability?:        number;  // 0–1, default 0.5
  similarityBoost?:  number;  // 0–1, default 0.75
  style?:            number;  // 0–1, default 0.3
}

// ---------------------------------------------------------------------------
// CORS headers (applied to every response)
// ---------------------------------------------------------------------------

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin':  ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/** GET /api/health */
function handleHealth(): Response {
  return jsonResponse({
    ok:        true,
    mode:      API_KEY ? 'live' : 'pre-bake-only',
    timestamp: new Date().toISOString(),
  });
}

/** GET /api/voices — return persona → voiceId map */
function handleVoices(): Response {
  return jsonResponse({ voices: VOICES });
}

/** POST /api/tts — proxy to ElevenLabs, return audio/mpeg */
async function handleTts(req: Request): Promise<Response> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!API_KEY) {
    return errorResponse(
      'ElevenLabs API key not configured. Set ELEVENLABS_API_KEY or use pre-baked audio.',
      503
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: TtsRequestBody;
  try {
    body = (await req.json()) as TtsRequestBody;
  } catch {
    return errorResponse('Invalid JSON body.', 400);
  }

  // ── Validate text ─────────────────────────────────────────────────────────
  const { text } = body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return errorResponse('`text` field is required and must be a non-empty string.', 400);
  }
  if (text.length > 500) {
    return errorResponse('`text` exceeds maximum length of 500 characters.', 400);
  }

  // ── Resolve voice ID ──────────────────────────────────────────────────────
  let voiceId: string;
  if (body.voiceId) {
    voiceId = body.voiceId;
  } else if (body.persona && VOICES[body.persona]) {
    voiceId = VOICES[body.persona];
  } else {
    voiceId = VOICES.architect; // default — calm authoritative
  }

  const modelId         = body.modelId       ?? DEFAULT_MODEL;
  const stability       = body.stability       ?? 0.50;
  const similarityBoost = body.similarityBoost ?? 0.75;
  const style           = body.style           ?? 0.30;

  // ── Call ElevenLabs ───────────────────────────────────────────────────────
  const elevenUrl = `${ELEVEN_BASE}/text-to-speech/${voiceId}`;

  let elevenResp: Response;
  try {
    elevenResp = await fetch(elevenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key':   API_KEY,
        Accept:         'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: true,
        },
      }),
    });
  } catch (networkErr) {
    console.error('[TTS] Network error reaching ElevenLabs:', networkErr);
    return errorResponse('Failed to reach ElevenLabs API.', 502);
  }

  // ── Forward errors from ElevenLabs ───────────────────────────────────────
  if (!elevenResp.ok) {
    const errText = await elevenResp.text().catch(() => '(unreadable)');
    console.error(`[TTS] ElevenLabs error ${elevenResp.status}:`, errText);
    return errorResponse(
      `ElevenLabs returned ${elevenResp.status}: ${elevenResp.statusText}`,
      502
    );
  }

  // ── Stream audio back to client ───────────────────────────────────────────
  const audioData = await elevenResp.arrayBuffer();

  return new Response(audioData, {
    status: 200,
    headers: {
      'Content-Type':  'audio/mpeg',
      'Cache-Control': 'public, max-age=3600, immutable',
      'Content-Length': String(audioData.byteLength),
      ...corsHeaders(),
    },
  });
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

async function router(req: Request): Promise<Response> {
  const url    = new URL(req.url);
  const method = req.method.toUpperCase();

  // Pre-flight CORS
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Routes
  if (url.pathname === '/api/health' && method === 'GET') {
    return handleHealth();
  }

  if (url.pathname === '/api/voices' && method === 'GET') {
    return handleVoices();
  }

  if (url.pathname === '/api/tts' && method === 'POST') {
    return handleTts(req);
  }

  return errorResponse('Not found.', 404);
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const server = Bun.serve({
  port: PORT,
  fetch: router,
});

console.log('');
console.log('  ╔═══════════════════════════════════════╗');
console.log('  ║   CHRONOS GRID — TTS Proxy Server     ║');
console.log('  ╚═══════════════════════════════════════╝');
console.log('');
console.log(`  Listening on  http://localhost:${server.port}`);
console.log(`  Mode          ${API_KEY ? '🟢 LIVE (ElevenLabs connected)' : '🟡 PRE-BAKE ONLY (no API key)'}`);
console.log(`  CORS origin   ${ORIGIN}`);
console.log('');
console.log('  Endpoints:');
console.log('    GET  /api/health');
console.log('    GET  /api/voices');
console.log('    POST /api/tts   { text, persona?, voiceId?, modelId? }');
console.log('');

if (!API_KEY) {
  console.warn('  ⚠  ELEVENLABS_API_KEY is not set.');
  console.warn('     POST /api/tts will return 503.');
  console.warn('     Pre-baked audio in /public/audio/tts/ will be used instead.');
  console.warn('');
}
