/**
 * Browser client for the local `/api/tts` proxy (ElevenLabs server-side).
 * Never send API keys from the client.
 */

export type TtsVoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  speed?: number;
};

export interface TtsRequestBody {
  text: string;
  voiceId?: string;
  modelId?: string;
  outputFormat?: string;
  voiceSettings?: TtsVoiceSettings;
}

export class TtsRequestError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`TTS request failed (${status})`);
    this.name = 'TtsRequestError';
    this.status = status;
    this.body = body;
  }
}

export async function fetchTtsMp3(body: TtsRequestBody): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new TtsRequestError(res.status, errText);
  }

  return res.blob();
}
