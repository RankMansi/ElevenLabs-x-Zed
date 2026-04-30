export type BusId = 'tts' | 'voice' | 'sfx' | 'hum' | 'music';

export interface Bus {
  gainNode: GainNode;
  defaultGain: number;
}

/** Linear gain multiplier for a dB offset (e.g. -12 → ~0.25). */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export class WebAudioMixer {
  private ctx: AudioContext | null = null;
  private buses: Map<BusId, Bus> = new Map();
  private masterGain: GainNode | null = null;
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();

  initialize(): void {
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.ctx.destination);

    const busConfigs: Array<[BusId, number]> = [
      ['tts', 1.0],
      ['voice', 1.0],
      ['sfx', 0.7],
      ['hum', 0.4],
      ['music', 0.3],
    ];

    for (const [id, gain] of busConfigs) {
      const gainNode = this.ctx.createGain();
      gainNode.gain.value = gain;
      gainNode.connect(this.masterGain);
      this.buses.set(id, { gainNode, defaultGain: gain });
    }
  }

  get audioContext(): AudioContext | null {
    return this.ctx;
  }

  /** Sum into a bus (e.g. procedural ambience, synthetic UI ticks). */
  getBusEntry(busId: BusId): GainNode | null {
    return this.buses.get(busId)?.gainNode ?? null;
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getBusGain(busId: BusId): number {
    return this.buses.get(busId)?.gainNode.gain.value ?? 0;
  }

  setBusGain(busId: BusId, gain: number, rampMs = 200): void {
    const bus = this.buses.get(busId);
    if (!bus || !this.ctx) return;
    const t = this.ctx.currentTime + rampMs / 1000;
    bus.gainNode.gain.linearRampToValueAtTime(Math.max(0, gain), t);
  }

  /** Ramp a bus back to its default install gain. */
  rampBusToDefault(busId: BusId, rampMs = 80): void {
    const bus = this.buses.get(busId);
    if (!bus || !this.ctx) return;
    const t = this.ctx.currentTime + rampMs / 1000;
    bus.gainNode.gain.linearRampToValueAtTime(bus.defaultGain, t);
  }

  /**
   * During briefing narration: lower SFX bus by 12 dB relative to its default.
   */
  applyBriefingSfxDuck(rampMs = 50): void {
    const bus = this.buses.get('sfx');
    if (!bus || !this.ctx) return;
    const target = bus.defaultGain * dbToGain(-12);
    const t = this.ctx.currentTime + rampMs / 1000;
    bus.gainNode.gain.linearRampToValueAtTime(Math.max(0, target), t);
  }

  clearBriefingSfxDuck(rampMs = 160): void {
    const bus = this.buses.get('sfx');
    if (!bus || !this.ctx) return;
    const t = this.ctx.currentTime + rampMs / 1000;
    bus.gainNode.gain.linearRampToValueAtTime(bus.defaultGain, t);
  }

  setMasterVolume(vol: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }

  /**
   * Play an AudioBuffer on the given bus.
   * Returns the created source node (or null on failure).
   */
  playBuffer(
    buffer: AudioBuffer,
    busId: BusId,
    options: {
      loop?: boolean;
      pan?: number; // -1 (left) … +1 (right)
      volume?: number; // 0 … 1
      id?: string; // provide to allow stopSource() later
      offset?: number; // start offset in seconds
      duration?: number; // stop after this many seconds (one-shot trim)
      onEnded?: () => void;
    } = {},
  ): AudioBufferSourceNode | null {
    if (!this.ctx || !this.masterGain) return null;

    const bus = this.buses.get(busId);
    if (!bus) return null;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, options.volume ?? 1.0));

    const connectTail = () => {
      if (options.pan !== undefined) {
        const panner = this.ctx!.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, options.pan));
        source.connect(gainNode);
        gainNode.connect(panner);
        panner.connect(bus.gainNode);
      } else {
        source.connect(gainNode);
        gainNode.connect(bus.gainNode);
      }
    };
    connectTail();

    const dur = options.duration;
    if (dur !== undefined && dur > 0 && !source.loop) {
      source.start(0, options.offset ?? 0, dur);
    } else {
      source.start(0, options.offset ?? 0);
    }

    if (options.id) {
      const existing = this.activeSources.get(options.id);
      if (existing) {
        try {
          existing.stop();
        } catch {
          /* already stopped */
        }
      }
      this.activeSources.set(options.id, source);

      source.addEventListener('ended', () => {
        if (this.activeSources.get(options.id!) === source) {
          this.activeSources.delete(options.id!);
        }
        options.onEnded?.();
      });
    } else if (options.onEnded) {
      source.addEventListener('ended', options.onEnded);
    }

    return source;
  }

  stopSource(id: string): void {
    const source = this.activeSources.get(id);
    if (source) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      this.activeSources.delete(id);
    }
  }

  isPlaying(id: string): boolean {
    return this.activeSources.has(id);
  }

  /**
   * Duck all buses EXCEPT the given one (e.g., duck sfx/hum/music while TTS plays).
   */
  duckAll(exceptBus: BusId, duckFactor = 0.2, rampMs = 150): void {
    for (const [id, bus] of this.buses) {
      if (id === exceptBus) continue;
      if (!this.ctx) continue;
      const target = bus.defaultGain * duckFactor;
      bus.gainNode.gain.linearRampToValueAtTime(
        Math.max(0, target),
        this.ctx.currentTime + rampMs / 1000,
      );
    }
  }

  /**
   * Restore all buses to their default gain after ducking.
   */
  unduckAll(rampMs = 300): void {
    for (const [, bus] of this.buses) {
      if (!this.ctx) continue;
      bus.gainNode.gain.linearRampToValueAtTime(
        bus.defaultGain,
        this.ctx.currentTime + rampMs / 1000,
      );
    }
  }

  stopAll(): void {
    for (const [id] of [...this.activeSources]) {
      this.stopSource(id);
    }
  }

  destroy(): void {
    this.stopAll();
    this.ctx?.close();
    this.ctx = null;
    this.buses.clear();
    this.masterGain = null;
  }
}
