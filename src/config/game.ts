// Tile size in pixels
export const TILE_SIZE = 48;

// Light radius in tiles (world: 1 tile = 1m; widened slightly so the maze reads on typical displays)
export const LIGHT_RADIUS_TILES = 3.25;

// Player speed (tiles per second)
export const PLAYER_SPEED = 4.0;
export const PLAYER_SLOW_SPEED = 1.8; // optional slow-walk when bound
export const PLAYER_SPRINT_SPEED = 6.0; // future stamina

// Dread system
export const DREAD_IDLE_THRESHOLD_MS = 3000;
export const DREAD_INCREASE_RATE = 0.08; // per second
export const DREAD_DECREASE_RATE = 0.12; // per second while moving
export const DREAD_MAX_LIGHT_SHRINK = 0.12; // max 12% radius reduction
export const HEARTBEAT_START_DREAD = 0.6; // trigger heartbeat at 60% dread

// Shift periods (ms) — ~2.0 s “shift episode” cadence (Run III adds a slow major clock).
export const RUN1_SHIFT_PERIOD_MS = 2_000;
export const RUN2_SHIFT_PERIOD_MS = 2_000;
/** Run III: heavy re-layout (graph-scale); slower than micro tick. */
export const RUN3_MAJOR_PERIOD_MS = 24_000;
/** Run III: localized opens on the current layout every ~2 s. */
export const RUN3_MINOR_PERIOD_MS = 2_000;
export const RUN4_SHIFT_PERIOD_MS = 2_000;

/** Klaxon / sting window before a major boundary (keep < period on fast ticks). */
export const SHIFT_WARNING_MS = 720;

/** Brief impulse shake on shift commit (camera, px peak; ms duration). */
export const SHIFT_SCREEN_SHAKE_MS = 115;
export const SHIFT_SCREEN_SHAKE_MAX_PX = 2.5;

// Ghost wall display after shift (ms)
export const GHOST_WALL_DURATION_MS = 1_800;
export const GHOST_WALL_ALPHA = 0.05;

// Canvas / rendering
export const VIGNETTE_FEATHER = 0.35; // fraction of radius for feather
export const GRAIN_OPACITY_BASE = 0.025;
export const GRAIN_OPACITY_DREAD_MAX = 0.05;

// Run maze sizes (columns × rows)
export const RUN1_MAZE_SIZE = { width: 15, height: 15 };
export const RUN2_MAZE_SIZE = { width: 20, height: 20 };
export const RUN3_MAZE_SIZE = { width: 24, height: 24 };
export const RUN4_MAZE_SIZE = { width: 22, height: 22 };

// Run3 stamina
export const STAMINA_MAX_MS = 8_000;
export const STAMINA_REGEN_RATE = 0.4; // fraction per second
export const STAMINA_DRAIN_RATE = 1.0; // fraction per second while sprinting

// Run2 lie probability (deterministic seed-based)
export const LIE_SEGMENT_SEED = 0xdeadbeef;
export const LIE_PROBABILITY = 0.5; // 50% of hints are lies

// Animation
/**
 * Wall morph duration after a layout shift (visual blend; collision uses the new maze immediately).
 * Kept ≤ ~1.8 s so a 2 s tick leaves slack before the next episode.
 */
export const SHIFT_ANIMATION_MS = 1_720;
export const SCANLINE_WARN_MS = 300; // HUD scanline slide-in

// FPS target
export const TARGET_FPS = 60;
