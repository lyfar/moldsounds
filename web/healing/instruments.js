export const SACRED_FREQUENCIES = [
  { hz: 174, label: "Pain Relief", desc: "Natural Anaesthetic" },
  { hz: 285, label: "Healing Tissue", desc: "Cellular Regeneration" },
  { hz: 396, label: "Liberating Guilt", desc: "Root Chakra" },
  { hz: 417, label: "Undoing Situations", desc: "Sacral Chakra" },
  { hz: 528, label: "Transformation", desc: "DNA Repair (Miracle)" },
  { hz: 639, label: "Connecting", desc: "Heart Chakra" },
  { hz: 741, label: "Expression", desc: "Throat Chakra" },
  { hz: 852, label: "Awakening Intuition", desc: "Third Eye" },
  { hz: 963, label: "Transcendence", desc: "Crown Chakra" },
  { hz: 183.58, label: "Abundance (Jupiter)", desc: "Spin Frequency of Wealth" },
];

export const RIEMANN_ZEROS = [14.1347, 21.022, 25.0108, 30.4248, 32.935];
export const PHI = 1.61803398875;

export const DRUM_RATIOS = [1.0, 1.59, 2.14, 2.3, 2.92];
export const KOSHI_INTERVALS = [1, 1.125, 1.25, 1.5, 1.66];

export const INSTRUMENTS = [
  { id: "bowl", label: "Bowl" },
  { id: "gong", label: "Gong" },
  { id: "wood", label: "Wood" },
  { id: "crystal", label: "Crystal" },
  { id: "drum", label: "Drum" },
  { id: "chime", label: "Chime" },
];

export function playSacredBowl(ctx, params, nodes) {
  const now = ctx.currentTime;
  const dest = nodes.dest;
  const reverb = nodes.reverb;
  const dry = ctx.createGain();
  dry.gain.value = 1.0 - params.reverbMix * 0.5;
  const wet = ctx.createGain();
  wet.gain.value = params.reverbMix;
  dry.connect(dest);
  wet.connect(reverb);

  [1.0, 2.78, 5.16, 8.13, 11.52].forEach((ratio, i) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const env = ctx.createGain();
    const personalFreq = params.frequency * ratio * (i === 0 ? 1 : params.intentionSeed);
    const delta = i === 0 ? params.binauralBeat : params.binauralBeat / (i * PHI);

    osc1.frequency.value = personalFreq;
    osc2.frequency.value = personalFreq + delta;
    osc1.type = "sine";
    osc2.type = "sine";

    const t60 = params.decay / Math.pow(PHI, i * 0.5);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.3 / (i + 1), now + 0.1);
    env.gain.exponentialRampToValueAtTime(0.0001, now + t60);

    osc1.connect(env);
    osc2.connect(env);
    env.connect(dry);
    env.connect(wet);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + t60);
    osc2.stop(now + t60);
  });
}

export function playRiemannGong(ctx, params, nodes) {
  const now = ctx.currentTime;
  const dest = nodes.dest;
  const reverb = nodes.reverb;
  const dry = ctx.createGain();
  dry.gain.value = 0.9;
  const wet = ctx.createGain();
  wet.gain.value = params.reverbMix * 1.6;
  dry.connect(dest);
  wet.connect(reverb);

  RIEMANN_ZEROS.forEach((zero, i) => {
    const normalizedRatio = zero / 14.1347;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const baseF = params.frequency * 0.6 * normalizedRatio;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.02 * params.intentionSeed, now + 0.5);

    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.frequency.value = baseF * PHI;
    const fmIntensity = 800 * params.intentionSeed;
    modGain.gain.setValueAtTime(fmIntensity, now);
    modGain.gain.exponentialRampToValueAtTime(10, now + params.decay);
    mod.connect(modGain);
    modGain.connect(osc.frequency);

    const amp = (1 / (i + 1)) * 0.35;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(amp, now + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, now + params.decay * 1.3);

    mod.start(now);
    osc.start(now);
    mod.stop(now + params.decay * 2);
    osc.stop(now + params.decay * 2);
    osc.connect(env);
    env.connect(dry);
    env.connect(wet);
  });
}

export function playOrganicBlock(ctx, params, nodes) {
  const now = ctx.currentTime;
  const dest = nodes.dest;
  const variance = params.intentionSeed;

  const noise = ctx.createBufferSource();
  noise.buffer = nodes.pinkNoiseBuffer;
  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0.8, now);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  noise.connect(noiseEnv);
  noiseEnv.connect(dest);
  noise.start(now);

  const osc = ctx.createOscillator();
  const oscEnv = ctx.createGain();
  osc.frequency.value = params.frequency * 4 * variance;
  osc.type = "triangle";
  oscEnv.gain.setValueAtTime(0, now);
  oscEnv.gain.linearRampToValueAtTime(0.5, now + 0.005);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(oscEnv);
  oscEnv.connect(dest);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function playCrystalHarp(ctx, params, nodes) {
  const now = ctx.currentTime;
  const dest = nodes.dest;
  const reverb = nodes.reverb;
  const dry = ctx.createGain();
  dry.gain.value = 0.5;
  const wet = ctx.createGain();
  wet.gain.value = params.reverbMix * 1.8;
  dry.connect(dest);
  wet.connect(reverb);

  [1, 2].forEach((octave) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const pitch = params.frequency * 2 * octave * params.intentionSeed;

    osc.frequency.value = pitch;
    osc.type = "sine";

    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.2, now + 0.5);
    env.gain.exponentialRampToValueAtTime(0.001, now + params.decay * 1.5);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 6 * params.intentionSeed;
    lfoGain.gain.value = 0.1;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + params.decay);

    osc.connect(env);
    env.connect(dry);
    env.connect(wet);
    osc.start(now);
    osc.stop(now + params.decay * 2);
  });
}

export function playShamanicDrum(ctx, params, nodes) {
  const now = ctx.currentTime;
  const dest = nodes.dest;
  const dry = ctx.createGain();
  dry.gain.value = 1.0;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  dry.connect(dest);
  wet.connect(nodes.reverb);

  DRUM_RATIOS.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    const drumFreq = 90 * ratio * params.intentionSeed;

    osc.frequency.setValueAtTime(drumFreq * 1.2, now);
    osc.frequency.exponentialRampToValueAtTime(drumFreq, now + 0.1);
    osc.type = "sine";

    const amp = (1 / (i + 1.5)) * 0.6;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(amp, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(env);
    env.connect(dry);
    env.connect(wet);
    osc.start(now);
    osc.stop(now + 0.5);
  });

  const noise = ctx.createBufferSource();
  noise.buffer = nodes.pinkNoiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 300;

  const noiseEnv = ctx.createGain();
  noiseEnv.gain.setValueAtTime(0.5, now);
  noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  noise.connect(filter);
  filter.connect(noiseEnv);
  noiseEnv.connect(dry);
  noise.start(now);
}

export function playKoshiChimes(ctx, params, nodes) {
  const now = ctx.currentTime;
  const dest = nodes.dest;
  const reverb = nodes.reverb;

  const dry = ctx.createGain();
  dry.gain.value = 0.6;
  const wet = ctx.createGain();
  wet.gain.value = params.reverbMix;
  dry.connect(dest);
  wet.connect(reverb);

  const noteCount = 5;

  for (let i = 0; i < noteCount; i += 1) {
    const delay = i * 0.12 * params.intentionSeed;
    const randomInterval = KOSHI_INTERVALS[Math.floor(Math.random() * KOSHI_INTERVALS.length)];

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    const pitch = params.frequency * 2 * randomInterval;
    osc.frequency.value = pitch;
    osc.type = "triangle";

    env.gain.setValueAtTime(0, now + delay);
    env.gain.linearRampToValueAtTime(0.15, now + delay + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + delay + 2.5);

    osc.connect(env);
    env.connect(dry);
    env.connect(wet);
    osc.start(now + delay);
    osc.stop(now + delay + 3);
  }
}
