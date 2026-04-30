import type { TtsManifest, AudioCue, CueId } from '../types/audio';
import { deriveCuePath } from '../content/audio-manifest';

let cachedManifest: TtsManifest | null = null;
const cueMap = new Map<CueId, AudioCue>();

export async function loadTtsManifest(): Promise<TtsManifest> {
  if (cachedManifest) return cachedManifest;

  try {
    const resp = await fetch('/audio/tts/manifest.json');
    if (!resp.ok) throw new Error(`Manifest fetch failed: ${resp.status}`);
    const data: TtsManifest = await resp.json();
    cachedManifest = data;

    cueMap.clear();
    for (const cue of data.cues) {
      cueMap.set(cue.id, cue);
    }

    return data;
  } catch (e) {
    console.warn('[AudioManifest] Failed to load TTS manifest, using empty fallback.', e);
    cachedManifest = { cues: [] };
    return cachedManifest;
  }
}

export function getCue(id: CueId): AudioCue | null {
  return cueMap.get(id) ?? null;
}

export function getCuePath(id: CueId): string | null {
  return cueMap.get(id)?.path ?? deriveCuePath(id);
}

export function getCueText(id: CueId): string {
  return cueMap.get(id)?.text ?? '';
}

export function getCueDuration(id: CueId): number {
  return cueMap.get(id)?.duration ?? 3.0;
}

export function isManifestLoaded(): boolean {
  return cachedManifest !== null;
}

export function clearManifestCache(): void {
  cachedManifest = null;
  cueMap.clear();
}
