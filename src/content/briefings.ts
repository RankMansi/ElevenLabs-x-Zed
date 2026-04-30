import type { RunId } from '../types/maze';

/** Single source of truth for briefing narration (sent to `/api/tts` at runtime). */

export const BRIEFING_RUN1 = `The maze isn't empty—it's on a clock. About every two seconds, walls reconfigure: each beat is a fresh carve from the same stone—not the same door flipping on and off, but different passages opening and others sealing. Your light only carries two meters—enough to move, not enough to understand. Listen for the grind before the shift; that's the truth of the schedule. Find the exit while the pattern still makes sense—that's how you survive Run One. A small neon mark reads clearly in darkness; in this first run it stays visible under your lamp too, so you learn what to look for later.`;

export const BRIEFING_RUN2 = `Run Two is different: sound is evidence, and evidence can lie. You'll hear whispers—some will match what your ears think is open space, and some will beckon you into stone. The maze still shifts about every two seconds with a new layout each time, and the hum you follow may move when the gate turns. Mark the pattern in your head: rhythm first, trust second. Reach the real exit—the rest is decoys wearing the same shape.`;

export const BRIEFING_RUN3 = `Run Three breaks the single clock you learned. Two schedules run together: a slow major pass that remaps the whole grid on a long breath, and a fast two-second pulse that nicks corridors in place while you're still thinking. Each major is a new layout from the bedrock; each micro pass opens a small honest slice of stone. The timers are not suggestions—they're arguments you have to hear at once. Wrong exits will sing louder than stone—listen for the sting that says not it. Stand still too long and the dark shrinks your light: keep moving with discipline, or lose the map in your mind before your feet do.`;

export const BRIEFING_RUN4 = `Run Four opens only after you've beaten runs One, Two, and Three to the true exit in order and collected all three hidden marks in the same session—no shortcuts. One clock only, but it ticks about every two seconds: the same re-carved wall rhythm as before, on a wider grid, with lying whispers and two false exits. The marketing calls it life or death; the stone only cares that you keep moving.`;

export const LANDING_HOOK_TEXT = `They didn't leave you a ceiling—only gates and grinding metal. Step in when you're ready: pick a run. Watch isn't mercy here—sound is.`;

const BY_RUN: Record<RunId, string> = {
  run1: BRIEFING_RUN1,
  run2: BRIEFING_RUN2,
  run3: BRIEFING_RUN3,
  run4: BRIEFING_RUN4,
};

export function getBriefingText(runId: RunId): string {
  return BY_RUN[runId];
}
