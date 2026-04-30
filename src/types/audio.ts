export type CueId =
  | 'run1_start_1' | 'run1_start_2' | 'run1_start_3'
  | 'run2_start_1' | 'run2_start_2' | 'run2_start_3'
  | 'run3_start_1' | 'run3_start_2' | 'run3_start_3'
  | 'run4_start_1' | 'run4_start_2' | 'run4_start_3'
  | 'wrong_turn_1' | 'wrong_turn_2' | 'wrong_turn_3'
  | 'wrong_turn_4' | 'wrong_turn_5' | 'wrong_turn_6'
  | 'shift_warning_1' | 'shift_warning_2' | 'shift_warning_3'
  | 'exit_found'
  | 'decoy_exit_1' | 'decoy_exit_2'
  | 'lie_1' | 'lie_2' | 'lie_3' | 'lie_4' | 'lie_5' | 'lie_6'
  | 'truth_1' | 'truth_2' | 'truth_3' | 'truth_4' | 'truth_5' | 'truth_6';

export type SfxId =
  | 'footstep_stone' | 'footstep_dirt'
  | 'wall_grind' | 'gate_hum_loop'
  | 'heartbeat_loop' | 'stinger_not_exit'
  | 'stinger_success' | 'breath_hook'
  | 'klaxon_shift'
  | 'ui_hover_scrape';

export type MusicId = 'drone_run2_loop';

export type Channel = 'tts' | 'voice' | 'sfx' | 'hum' | 'music';

export interface SpatialPoint {
  x: number;
  y: number;
}

export interface AudioCue {
  id: CueId;
  path: string;
  duration: number; // seconds
  text: string; // caption text
}

export interface TtsManifest {
  cues: AudioCue[];
}
