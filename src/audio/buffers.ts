const bufferCache = new Map<string, AudioBuffer>();

export async function loadAudioBuffer(
  ctx: AudioContext,
  path: string
): Promise<AudioBuffer | null> {
  if (bufferCache.has(path)) return bufferCache.get(path)!;

  try {
    const response = await fetch(path);
    if (!response.ok) {
      console.warn(`[Audio] HTTP ${response.status} loading: ${path}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const head = new Uint8Array(arrayBuffer, 0, Math.min(64, arrayBuffer.byteLength));
    const ascii = String.fromCharCode(...head);
    if (ascii.includes("<!DOCTYPE") || ascii.includes("<html")) {
      console.warn(
        `[Audio] Not audio (got HTML — missing asset or bad base URL?): ${path}`,
      );
      return null;
    }
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    bufferCache.set(path, audioBuffer);
    return audioBuffer;
  } catch (e) {
    console.warn(`[Audio] Failed to load: ${path}`, e);
    return null;
  }
}

export async function preloadAudioBuffers(
  ctx: AudioContext,
  paths: string[]
): Promise<void> {
  await Promise.allSettled(paths.map(p => loadAudioBuffer(ctx, p)));
}

export function getCachedBuffer(path: string): AudioBuffer | undefined {
  return bufferCache.get(path);
}

export function clearBufferCache(): void {
  bufferCache.clear();
}

export function getBufferCacheSize(): number {
  return bufferCache.size;
}
