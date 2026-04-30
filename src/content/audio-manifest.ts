import type { TtsManifest } from '../types/audio';

// ---------------------------------------------------------------------------
// audio-manifest.ts
//
// Typed bridge between the public JSON manifest (shipped at
// /public/audio/tts/manifest.json and served at /audio/tts/manifest.json)
// and the TypeScript type system.
//
// Two usage patterns:
//
//   1. BUILD-TIME (static import via Vite's JSON plugin):
//      Import STATIC_MANIFEST for compile-time access to cue metadata.
//      Vite inlines the JSON at build time — no fetch required.
//
//   2. RUNTIME (dynamic fetch via audio/manifest.ts):
//      The AudioDirector calls loadTtsManifest() from audio/manifest.ts,
//      which fetches the file at runtime and populates a cue look-up map.
//      Use this path when you need getCuePath() / getCueText() etc.
//
// This file handles pattern 1.  For pattern 2, see src/audio/manifest.ts.
// ---------------------------------------------------------------------------

// Vite resolves JSON imports automatically when the file is inside /public
// and referenced from the build.  Since manifest.json lives in /public we
// fetch it at runtime instead of importing it statically (public/ files are
// not processed by Vite's module graph).  We expose the shape here so other
// modules can reference the type without importing the heavy runtime loader.

/** Minimal inline manifest used as a compile-time fallback / type reference. */
export const FALLBACK_MANIFEST: TtsManifest = {
  cues: [],
};

/**
 * All known TTS cue IDs in the order they appear in manifest.json.
 * Useful for pre-loading buffers in one shot at run start.
 *
 * Organised by category so it is easy to pre-load only what a given run needs.
 */
export const CUE_GROUPS = {
  run1Start:     ['run1_start_1', 'run1_start_2', 'run1_start_3'] as const,
  run2Start:     ['run2_start_1', 'run2_start_2', 'run2_start_3'] as const,
  run3Start:     ['run3_start_1', 'run3_start_2', 'run3_start_3'] as const,
  run4Start:     ['run4_start_1', 'run4_start_2', 'run4_start_3'] as const,
  wrongTurn:     [
    'wrong_turn_1', 'wrong_turn_2', 'wrong_turn_3',
    'wrong_turn_4', 'wrong_turn_5', 'wrong_turn_6',
  ] as const,
  shiftWarning:  ['shift_warning_1', 'shift_warning_2', 'shift_warning_3'] as const,
  exitFound:     ['exit_found'] as const,
  decoyExit:     ['decoy_exit_1', 'decoy_exit_2'] as const,
  lies:          ['lie_1', 'lie_2', 'lie_3', 'lie_4', 'lie_5', 'lie_6'] as const,
  truths:        ['truth_1', 'truth_2', 'truth_3', 'truth_4', 'truth_5', 'truth_6'] as const,
} as const;

/** Flat array of every cue id defined in the manifest. */
export const ALL_CUE_IDS = [
  ...CUE_GROUPS.run1Start,
  ...CUE_GROUPS.run2Start,
  ...CUE_GROUPS.run3Start,
  ...CUE_GROUPS.run4Start,
  ...CUE_GROUPS.wrongTurn,
  ...CUE_GROUPS.shiftWarning,
  ...CUE_GROUPS.exitFound,
  ...CUE_GROUPS.decoyExit,
  ...CUE_GROUPS.lies,
  ...CUE_GROUPS.truths,
] as const;

export type KnownCueId = (typeof ALL_CUE_IDS)[number];

/**
 * Returns the cue IDs that should be pre-loaded before a given run starts.
 * Avoids loading Run II / III lines during Run I, etc.
 */
export function getCueIdsForRun(runId: 'run1' | 'run2' | 'run3' | 'run4'): KnownCueId[] {
  const base: KnownCueId[] = [
    ...CUE_GROUPS.wrongTurn,
    ...CUE_GROUPS.shiftWarning,
    ...CUE_GROUPS.exitFound,
  ];

  switch (runId) {
    case 'run1':
      return [
        ...CUE_GROUPS.run1Start,
        ...CUE_GROUPS.truths,
        ...base,
      ];

    case 'run2':
      return [
        ...CUE_GROUPS.run2Start,
        ...CUE_GROUPS.lies,
        ...CUE_GROUPS.truths,
        ...CUE_GROUPS.decoyExit,
        ...base,
      ];

    case 'run3':
      return [
        ...CUE_GROUPS.run3Start,
        ...CUE_GROUPS.lies,
        ...CUE_GROUPS.truths,
        ...CUE_GROUPS.decoyExit,
        ...base,
      ];

    case 'run4':
      return [
        ...CUE_GROUPS.run4Start,
        ...CUE_GROUPS.lies,
        ...CUE_GROUPS.truths,
        ...CUE_GROUPS.decoyExit,
        ...base,
      ];
  }
}

/**
 * Derive the expected /public path for a given cue ID using the naming
 * convention used in manifest.json.
 *
 * This is a pure function — no fetch required — so it can be used during
 * build-time checks or in tests.
 *
 * Convention:
 *   run{N}_start_{M}   → /audio/tts/run{N}/start_{M}.mp3
 *   wrong_turn_{N}     → /audio/tts/common/wrong_turn_{N}.mp3
 *   shift_warning_{N}  → /audio/tts/common/shift_warning_{N}.mp3
 *   exit_found         → /audio/tts/common/exit_found.mp3
 *   decoy_exit_{N}     → /audio/tts/common/decoy_exit_{N}.mp3
 *   lie_{N}            → /audio/tts/common/lie_{N}.mp3
 *   truth_{N}          → /audio/tts/common/truth_{N}.mp3
 */
export function deriveCuePath(cueId: string): string {
  if (cueId.startsWith('run1_start_')) {
    return `/audio/tts/run1/${cueId.replace('run1_', '')}.mp3`;
  }
  if (cueId.startsWith('run2_start_')) {
    return `/audio/tts/run2/${cueId.replace('run2_', '')}.mp3`;
  }
  if (cueId.startsWith('run3_start_')) {
    return `/audio/tts/run3/${cueId.replace('run3_', '')}.mp3`;
  }
  if (cueId.startsWith('run4_start_')) {
    return `/audio/tts/run4/${cueId.replace('run4_', '')}.mp3`;
  }
  // Everything else lives in /common
  return `/audio/tts/common/${cueId}.mp3`;
}
