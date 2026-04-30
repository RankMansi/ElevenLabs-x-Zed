import type { RunId } from "../types/maze";
import type { CueId, SfxId } from "../types/audio";
import type { SpatialPoint } from "../types/audio";
import { WebAudioMixer, dbToGain } from "./web-audio-mixer";
import { loadAudioBuffer } from "./buffers";
import { loadTtsManifest, getCuePath } from "./manifest";
import { computeHumSpatial } from "./spatial-2d";
import { getShiftSfx, getKlaxonSfx } from "./cue-triggers";

const SFX_PATHS: Record<SfxId, string> = {
  footstep_stone: "/audio/sfx/footstep_stone.mp3",
  footstep_dirt: "/audio/sfx/footstep_dirt.mp3",
  wall_grind: "/audio/sfx/wall_grind.mp3",
  gate_hum_loop: "/audio/sfx/gate_hum_loop.mp3",
  heartbeat_loop: "/audio/sfx/heartbeat_loop.mp3",
  stinger_not_exit: "/audio/sfx/stinger_not_exit.mp3",
  stinger_success: "/audio/sfx/stinger_success.mp3",
  breath_hook: "/audio/sfx/breath_hook.mp3",
  klaxon_shift: "/audio/sfx/klaxon_shift.mp3",
  ui_hover_scrape: "/audio/sfx/ui_hover_scrape.mp3",
};

export class AudioDirector {
  private mixer: WebAudioMixer;
  private currentRunId: RunId | null = null;
  private initialized = false;
  private footstepTimer = 0;
  private shiftWarningVariant = 0;
  private wrongTurnVariant = 0;
  private humTarget: SpatialPoint | null = null;
  private playerPos: SpatialPoint = { x: 0, y: 0 };
  private heartbeatActive = false;
  private humActive = false;
  private lastHoverScrapeMs = 0;
  private briefingActive = false;
  private caveAmbienceStop: (() => void) | null = null;

  constructor() {
    this.mixer = new WebAudioMixer();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.mixer.initialize();
    await loadTtsManifest();
    this.initialized = true;
  }

  resume(): void {
    this.mixer.resume();
  }

  setRun(runId: RunId): void {
    this.currentRunId = runId;
    this.shiftWarningVariant = 0;
    this.wrongTurnVariant = 0;
  }

  setPlayerPos(pos: SpatialPoint): void {
    this.playerPos = pos;
    if (this.humTarget && this.humActive) {
      this.updateHumSpatial();
    }
  }

  setHumTarget(pos: SpatialPoint): void {
    this.humTarget = pos;
    if (this.humActive) {
      this.updateHumSpatial();
    }
  }

  private updateHumSpatial(): void {
    if (!this.humTarget) return;
    const { pan: _pan, volume } = computeHumSpatial(
      this.playerPos,
      this.humTarget,
    );
    this.mixer.setBusGain("hum", volume * 0.4);
  }

  /**
   * While live ElevenLabs briefing plays (HTMLAudio), duck SFX by −12 dB.
   * Pair with {@link endBriefingDuck} when narration ends or is skipped.
   */
  beginLiveBriefing(): void {
    this.mixer.applyBriefingSfxDuck(50);
    this.briefingActive = true;
  }

  endBriefingDuck(): void {
    if (!this.briefingActive) return;
    this.briefingActive = false;
    this.mixer.clearBriefingSfxDuck(160);
  }

  /** Debounced metal scrape for run-tile hover (~50 ms once per ~380 ms). */
  playTileHoverScrape(): void {
    const now = performance.now();
    if (now - this.lastHoverScrapeMs < 380) return;
    this.lastHoverScrapeMs = now;
    this.playUiScrape().catch(() => {});
  }

  private async playUiScrape(): Promise<void> {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const buffer = await loadAudioBuffer(ctx, SFX_PATHS.ui_hover_scrape);
    if (!buffer) return;
    const dur = Math.min(0.055, buffer.duration);
    this.mixer.playBuffer(buffer, "sfx", { volume: 0.35, duration: dur });
  }

  /** Sage flash companion: klaxon tail at −24 dB (linear ~0.063 × bus). */
  async playRunSelectKlaxonTail(): Promise<void> {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const buffer = await loadAudioBuffer(ctx, SFX_PATHS.klaxon_shift);
    if (!buffer) return;
    const vol = 0.85 * dbToGain(-24);
    this.mixer.playBuffer(buffer, "sfx", {
      volume: vol,
      duration: Math.min(0.45, buffer.duration),
    });
  }

  async playRunStart(): Promise<void> {
    if (!this.currentRunId) return;
    const cueId = `${this.currentRunId}_start_1` as CueId;
    await this.playTts(cueId);
  }

  async playShiftWarning(): Promise<void> {
    this.playSfx(getKlaxonSfx()).catch(() => {});
    const variant = (this.shiftWarningVariant % 3) + 1;
    this.shiftWarningVariant++;
    await this.playTts(`shift_warning_${variant}` as CueId);
  }

  async playWallShift(): Promise<void> {
    await this.playSfx(getShiftSfx());
  }

  async playWrongTurn(): Promise<void> {
    const variant = (this.wrongTurnVariant % 6) + 1;
    this.wrongTurnVariant++;
    await this.playTts(`wrong_turn_${variant}` as CueId);
  }

  async playExitFound(): Promise<void> {
    this.stopHeartbeat();
    await this.playSfx("stinger_success");
    await this.playTts("exit_found");
  }

  async playDecoyExit(): Promise<void> {
    await this.playSfx("stinger_not_exit");
    await this.playTts("decoy_exit_1");
  }

  async startHeartbeat(): Promise<void> {
    if (this.heartbeatActive) return;
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const buffer = await loadAudioBuffer(ctx, SFX_PATHS["heartbeat_loop"]);
    if (!buffer) return;
    this.mixer.playBuffer(buffer, "sfx", {
      loop: true,
      volume: 0.45,
      id: "heartbeat",
    });
    this.heartbeatActive = true;
  }

  stopHeartbeat(): void {
    if (!this.heartbeatActive) return;
    this.mixer.stopSource("heartbeat");
    this.heartbeatActive = false;
  }

  async startHumLoop(exitPos: SpatialPoint): Promise<void> {
    this.humTarget = exitPos;
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const buffer = await loadAudioBuffer(ctx, SFX_PATHS["gate_hum_loop"]);
    if (!buffer) return;
    const { pan, volume } = computeHumSpatial(this.playerPos, exitPos);
    this.mixer.playBuffer(buffer, "hum", {
      loop: true,
      pan,
      volume: volume * 0.4,
      id: "exit_hum",
    });
    this.humActive = true;
  }

  stopHumLoop(): void {
    this.mixer.stopSource("exit_hum");
    this.humActive = false;
  }

  async startMusicLoop(): Promise<void> {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const buffer = await loadAudioBuffer(
      ctx,
      "/audio/music/drone_run2_loop.mp3",
    );
    if (!buffer) return;
    this.mixer.playBuffer(buffer, "music", {
      loop: true,
      volume: 1.0,
      id: "music",
    });
  }

  stopMusicLoop(): void {
    this.mixer.stopSource("music");
  }

  private stopCaveAmbience(): void {
    if (this.caveAmbienceStop) {
      this.caveAmbienceStop();
      this.caveAmbienceStop = null;
    }
  }

  /** Stop procedural cave bed only (briefing / handoff). Gameplay loops unchanged. */
  stopAmbientBed(): void {
    this.stopCaveAmbience();
  }

  /** Clears any legacy mixer bed; global BGM lives in `marketing-audio-singleton`. */
  startLandingAmbience(): void {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    this.stopCaveAmbience();
    this.stopMusicLoop();
  }

  /**
   * Clears mixer-side cave/music loops. Maze BGM is the same shared track as the
   * landing page (`startTitleScreenBed` / ElevenLabs upgrade)—not started here.
   */
  startRunAmbience(_runId: RunId): void {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    this.stopCaveAmbience();
    this.stopMusicLoop();
  }

  /** Short mechanical tick for buttons (Web Audio, no asset). */
  playUiClick(): void {
    try {
      const ctx = this.mixer.audioContext;
      const entry = this.mixer.getBusEntry("sfx");
      if (!ctx || !entry) return;
      const t = ctx.currentTime;
      const len = Math.ceil(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.85;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2600;
      f.Q.value = 1.1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);
      src.connect(f);
      f.connect(g);
      g.connect(entry);
      src.start(t);
      src.stop(t + 0.048);
      window.setTimeout(() => {
        src.disconnect();
        f.disconnect();
        g.disconnect();
      }, 120);
    } catch {
      /* ignore */
    }
  }

  async playBreathHook(): Promise<void> {
    await this.playSfx("breath_hook");
  }

  tickFootstep(isMoving: boolean, isSlowWalking: boolean, dtMs: number): void {
    if (!isMoving) {
      this.footstepTimer = 0;
      return;
    }
    if (this.heartbeatActive) {
      this.stopHeartbeat();
    }
    this.footstepTimer += dtMs;
    const interval = isSlowWalking ? 700 : 400;
    if (this.footstepTimer >= interval) {
      this.footstepTimer = 0;
      const sfxId: SfxId =
        Math.random() > 0.4 ? "footstep_stone" : "footstep_dirt";
      this.playSfx(sfxId).catch(() => {});
    }
  }

  setMasterVolume(vol: number): void {
    this.mixer.setMasterVolume(vol);
  }

  private async playTts(cueId: CueId): Promise<void> {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const path = getCuePath(cueId);
    if (!path) {
      console.warn(`[AudioDirector] No path for TTS cue: ${cueId}`);
      return;
    }
    const buffer = await loadAudioBuffer(ctx, path);
    if (!buffer) return;
    this.mixer.duckAll("tts");
    this.mixer.playBuffer(buffer, "tts", { volume: 1.0 });
    window.setTimeout(
      () => this.mixer.unduckAll(),
      buffer.duration * 1000 + 300,
    );
  }

  private async playSfx(sfxId: SfxId): Promise<void> {
    const ctx = this.mixer.audioContext;
    if (!ctx) return;
    const path = SFX_PATHS[sfxId];
    if (!path) return;
    const buffer = await loadAudioBuffer(ctx, path);
    if (!buffer) return;
    this.mixer.playBuffer(buffer, "sfx", { volume: 0.8 });
  }

  /** Stop gameplay loops without tearing down the audio context (return to landing). */
  silenceGameplay(): void {
    this.stopHeartbeat();
    this.stopHumLoop();
    this.stopMusicLoop();
    this.stopCaveAmbience();
  }

  destroy(): void {
    this.silenceGameplay();
    this.endBriefingDuck();
    this.mixer.destroy();
    this.initialized = false;
  }
}
