import type { RunId } from '../types/maze';

export type CaveAmbienceProfile = 'landing' | 'title_screen' | RunId;

const PEAK: Record<CaveAmbienceProfile, number> = {
  landing: 0.52,
  title_screen: 0.62,
  run1: 0.48,
  run2: 0.5,
  run3: 0.46,
  run4: 0.44,
};

/**
 * Layered sub / filtered noise — damp concrete void. Profiles differ in pitch and motion.
 * `title_screen` is a quieter, deeper bed for the marketing page (first-gesture AudioContext).
 */
export function startProceduralCaveAmbience(
  ctx: AudioContext,
  destination: AudioNode,
  profile: CaveAmbienceProfile,
): () => void {
  const now = ctx.currentTime;
  const oscs: OscillatorNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  const peak = PEAK[profile];
  const root = ctx.createGain();
  root.gain.setValueAtTime(0, now);
  root.gain.linearRampToValueAtTime(peak, now + 1.35);
  root.connect(destination);

  const masterLp = ctx.createBiquadFilter();
  masterLp.type = 'lowpass';
  if (profile === 'title_screen') {
    masterLp.frequency.value = 360;
  } else if (profile === 'landing') {
    masterLp.frequency.value = 400;
  } else if (profile === 'run1') {
    masterLp.frequency.value = 500;
  } else if (profile === 'run2') {
    masterLp.frequency.value = 360;
  } else if (profile === 'run3') {
    masterLp.frequency.value = 460;
  } else {
    masterLp.frequency.value = 440;
  }
  masterLp.Q.value = 0.2;
  masterLp.connect(root);

  const addOsc = (
    type: OscillatorType,
    freq: number,
    gain: number,
    dest: AudioNode,
  ): void => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(dest);
    o.start(now);
    oscs.push(o);
  };

  if (profile === 'title_screen') {
    addOsc('sine', 36, 0.5, masterLp);
    addOsc('sine', 58, 0.2, masterLp);
    addOsc('triangle', 92, 0.055, masterLp);
  } else if (profile === 'landing') {
    addOsc('sine', 42, 0.55, masterLp);
    addOsc('sine', 63, 0.22, masterLp);
    addOsc('triangle', 101, 0.08, masterLp);
  } else if (profile === 'run1') {
    addOsc('sine', 55, 0.5, masterLp);
    addOsc('triangle', 165, 0.12, masterLp);
    addOsc('sine', 220, 0.04, masterLp);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.42;
    const d = ctx.createGain();
    d.gain.value = 0.1;
    lfo.connect(d);
    d.connect(root.gain);
    lfo.start(now);
    oscs.push(lfo);
  } else if (profile === 'run2') {
    addOsc('sine', 98, 0.28, masterLp);
    addOsc('sine', 103.5, 0.28, masterLp);
    addOsc('triangle', 49, 0.18, masterLp);
  } else if (profile === 'run3') {
    addOsc('sine', 41, 0.45, masterLp);
    addOsc('sine', 58, 0.2, masterLp);
    addOsc('triangle', 87, 0.1, masterLp);
    addOsc('triangle', 131, 0.05, masterLp);
  } else {
    addOsc('sine', 38, 0.42, masterLp);
    addOsc('sine', 61, 0.22, masterLp);
    addOsc('triangle', 84, 0.11, masterLp);
    addOsc('triangle', 120, 0.055, masterLp);
  }

  const noiseDur = Math.ceil(ctx.sampleRate * 1.5);
  const nBuf = ctx.createBuffer(1, noiseDur, ctx.sampleRate);
  const ch = nBuf.getChannelData(0);
  for (let i = 0; i < noiseDur; i++) ch[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = nBuf;
  noise.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  if (profile === 'title_screen') {
    bp.frequency.value = 200;
    bp.Q.value = 0.5;
  } else if (profile === 'landing') {
    bp.frequency.value = 240;
    bp.Q.value = 0.55;
  } else if (profile === 'run1') {
    bp.frequency.value = 480;
    bp.Q.value = 0.55;
  } else if (profile === 'run2') {
    bp.frequency.value = 200;
    bp.Q.value = 0.55;
  } else if (profile === 'run3') {
    bp.frequency.value = 360;
    bp.Q.value = 0.45;
  } else {
    bp.frequency.value = 340;
    bp.Q.value = 0.48;
  }
  const ng = ctx.createGain();
  if (profile === 'title_screen') {
    ng.gain.value = 0.065;
  } else if (profile === 'landing') {
    ng.gain.value = 0.09;
  } else if (profile === 'run1') {
    ng.gain.value = 0.11;
  } else if (profile === 'run2') {
    ng.gain.value = 0.14;
  } else if (profile === 'run3') {
    ng.gain.value = 0.1;
  } else {
    ng.gain.value = 0.11;
  }
  noise.connect(bp);
  bp.connect(ng);
  ng.connect(masterLp);
  noise.start(now);
  sources.push(noise);

  if (profile === 'run3' || profile === 'run4') {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.073;
    const d1 = ctx.createGain();
    const d2 = ctx.createGain();
    d1.gain.value = 0.025;
    d2.gain.value = 0.02;
    lfo.connect(d1);
    lfo2.connect(d2);
    d1.connect(ng.gain);
    d2.connect(ng.gain);
    lfo.start(now);
    lfo2.start(now);
    oscs.push(lfo, lfo2);
  }

  return () => {
    const t = ctx.currentTime;
    try {
      root.gain.cancelScheduledValues(t);
      root.gain.setValueAtTime(root.gain.value, t);
      root.gain.linearRampToValueAtTime(0, t + 0.5);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      for (const o of oscs) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
        o.disconnect();
      }
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
        s.disconnect();
      }
      bp.disconnect();
      ng.disconnect();
      masterLp.disconnect();
      root.disconnect();
    }, 550);
  };
}
