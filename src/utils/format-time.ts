/** Format seconds to MM:SS display, e.g. 72 → "01:12" */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Format milliseconds to MM:SS */
export function formatMs(ms: number): string {
  return formatTime(ms / 1000);
}
