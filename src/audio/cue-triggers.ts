import type { RunId } from '../types/maze';
import type { CueId, SfxId } from '../types/audio';
import { isLieAtSegment, getLieCueIndex, getTruthCueIndex } from '../game/lie-rng';

// ---------------------------------------------------------------------------
// Event union
// ---------------------------------------------------------------------------

export type AudioTriggerEvent =
  | { type: 'run_start'; runId: RunId; lineIndex: number }
  | { type: 'wrong_turn'; variantIndex: number }
  | { type: 'shift_warning'; variantIndex: number }
  | { type: 'exit_found' }
  | { type: 'decoy_exit'; variantIndex: number }
  | { type: 'directional_hint'; segmentIndex: number; runId: RunId }
  | { type: 'idle_heartbeat' };

// ---------------------------------------------------------------------------
// TTS resolver
// ---------------------------------------------------------------------------

export function resolveTtsCue(event: AudioTriggerEvent): CueId | null {
  switch (event.type) {
    case 'run_start':
      return `${event.runId}_start_${(event.lineIndex % 3) + 1}` as CueId;

    case 'wrong_turn':
      return `wrong_turn_${(event.variantIndex % 6) + 1}` as CueId;

    case 'shift_warning':
      return `shift_warning_${(event.variantIndex % 3) + 1}` as CueId;

    case 'exit_found':
      return 'exit_found';

    case 'decoy_exit':
      return `decoy_exit_${(event.variantIndex % 2) + 1}` as CueId;

    case 'directional_hint': {
      if (event.runId === 'run1') {
        // Run 1 is always honest
        const idx = getTruthCueIndex(event.segmentIndex);
        return `truth_${idx}` as CueId;
      }
      // Run 2–4: deterministic lie or truth per segment
      const isLie = isLieAtSegment(event.segmentIndex);
      const idx = isLie
        ? getLieCueIndex(event.segmentIndex)
        : getTruthCueIndex(event.segmentIndex);
      return `${isLie ? 'lie' : 'truth'}_${idx}` as CueId;
    }

    case 'idle_heartbeat':
      return null; // heartbeat is SFX only

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// SFX resolver
// ---------------------------------------------------------------------------

export function resolveSfxId(event: AudioTriggerEvent): SfxId | null {
  switch (event.type) {
    case 'idle_heartbeat':
      return 'heartbeat_loop';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Named helpers for common SFX
// ---------------------------------------------------------------------------

export function getShiftSfx(): SfxId {
  return 'wall_grind';
}

export function getKlaxonSfx(): SfxId {
  return 'klaxon_shift';
}

export function getFootstepSfx(surface: 'stone' | 'dirt'): SfxId {
  return surface === 'stone' ? 'footstep_stone' : 'footstep_dirt';
}

export function getSuccessSfx(): SfxId {
  return 'stinger_success';
}

export function getDecoyExitSfx(): SfxId {
  return 'stinger_not_exit';
}

export function getGateHumSfx(): SfxId {
  return 'gate_hum_loop';
}

export function getBreathSfx(): SfxId {
  return 'breath_hook';
}
