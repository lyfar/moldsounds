import { ensureAudioContext, getWeaponGain } from "./context.js";
import { getWeaponParamsFromPoint } from "./params.js";

export function playNovaBurst(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;

  const sizeMultiplier = 0.5 + penSize * 1.5;
  const noiseLength = 0.15 * sizeMultiplier;
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLength, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.3));
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = params.filterFreq * sizeMultiplier;
  noiseFilter.Q.value = 2;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "square";
  osc1.frequency.value = params.baseFreq * sizeMultiplier;
  osc2.frequency.value = params.baseFreq * params.harmonicRatio * sizeMultiplier;
  osc1.detune.value = params.detune - 5;
  osc2.detune.value = params.detune + 5;

  osc1.frequency.setValueAtTime(params.baseFreq * 2 * sizeMultiplier, now);
  osc1.frequency.exponentialRampToValueAtTime(
    params.baseFreq * 0.5 * sizeMultiplier,
    now + 0.15
  );
  osc2.frequency.setValueAtTime(params.baseFreq * params.harmonicRatio * 2 * sizeMultiplier, now);
  osc2.frequency.exponentialRampToValueAtTime(
    params.baseFreq * params.harmonicRatio * 0.3 * sizeMultiplier,
    now + 0.2
  );

  const noiseGain = ctx.createGain();
  const oscGain = ctx.createGain();

  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLength);

  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 * sizeMultiplier);

  const weaponOut = getWeaponGain();
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(weaponOut);

  osc1.connect(oscGain);
  osc2.connect(oscGain);
  oscGain.connect(weaponOut);

  noise.start(now);
  osc1.start(now);
  osc2.start(now);

  noise.stop(now + noiseLength);
  osc1.stop(now + 0.3 * sizeMultiplier);
  osc2.stop(now + 0.3 * sizeMultiplier);
}

export function playHaloRing(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;

  const sizeMultiplier = 0.7 + penSize * 0.8;
  const harmonics = [1, 2.4, 5.95, 8.5, 11.8];
  const gains = [1, 0.6, 0.4, 0.25, 0.15];

  harmonics.forEach((harmonic, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.value = params.baseFreq * harmonic * sizeMultiplier * 1.5;
    osc.detune.value = params.detune + (Math.random() - 0.5) * 10;

    filter.type = "highpass";
    filter.frequency.value = 200;

    const duration = params.decayTime * (1.5 - i * 0.15) * sizeMultiplier;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gains[i] * 0.25, now + params.attackTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getWeaponGain());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  });
}

export function playVoidWave(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;

  const sizeMultiplier = 0.8 + penSize * 1.2;
  const duration = 0.6 * sizeMultiplier;

  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = params.baseFreq * 0.25;

  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();

  carrier.type = "sine";
  carrier.frequency.value = params.baseFreq * 0.5;

  modulator.type = "sine";
  modulator.frequency.value = params.baseFreq * params.harmonicRatio * 0.5;
  modGain.gain.value = params.modDepth * params.baseFreq;

  modGain.gain.setValueAtTime(params.modDepth * params.baseFreq * 2, now);
  modGain.gain.exponentialRampToValueAtTime(
    params.modDepth * params.baseFreq * 0.1,
    now + duration
  );

  modulator.connect(modGain);
  modGain.connect(carrier.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(params.filterFreq * 2, now);
  filter.frequency.exponentialRampToValueAtTime(params.filterFreq * 0.3, now + duration);
  filter.Q.value = 5;

  const subGain = ctx.createGain();
  const mainGain = ctx.createGain();

  subGain.gain.setValueAtTime(0.001, now);
  subGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
  subGain.gain.setValueAtTime(0.35, now + duration * 0.7);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  const weaponOut = getWeaponGain();
  sub.connect(subGain);
  subGain.connect(weaponOut);

  carrier.connect(filter);
  filter.connect(mainGain);
  mainGain.connect(weaponOut);

  sub.start(now);
  modulator.start(now);
  carrier.start(now);

  sub.stop(now + duration + 0.1);
  modulator.stop(now + duration + 0.1);
  carrier.stop(now + duration + 0.1);
}

export function playChaosVortex(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;

  const sizeMultiplier = 0.6 + penSize * 1.4;
  const duration = 0.5 * sizeMultiplier;

  const numOscs = 5;
  for (let i = 0; i < numOscs; i++) {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const panner = ctx.createStereoPanner();

    osc.type = i % 2 === 0 ? "sawtooth" : "triangle";
    osc.frequency.value = params.baseFreq * (1 + i * 0.15) * sizeMultiplier;
    osc.detune.value = params.detune + (i - numOscs / 2) * 20;

    lfo.type = "sine";
    lfo.frequency.value = 3 + i * 2 + params.modDepth * 10;
    lfoGain.gain.value = 30 + params.modDepth * 50;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const panLfo = ctx.createOscillator();
    panLfo.type = "sine";
    panLfo.frequency.value = 2 + i * 0.5;
    const panGain = ctx.createGain();
    panGain.gain.value = 0.8;
    panLfo.connect(panGain);
    panGain.connect(panner.pan);

    filter.type = "bandpass";
    filter.frequency.value = params.filterFreq * (0.5 + i * 0.3);
    filter.Q.value = 3;

    const startDelay = i * 0.02;
    gain.gain.setValueAtTime(0.001, now + startDelay);
    gain.gain.exponentialRampToValueAtTime(0.15 / numOscs, now + startDelay + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(getWeaponGain());

    osc.start(now + startDelay);
    lfo.start(now + startDelay);
    panLfo.start(now + startDelay);

    osc.stop(now + duration + 0.1);
    lfo.stop(now + duration + 0.1);
    panLfo.stop(now + duration + 0.1);
  }
}

export function playMoldPulse(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;

  const sizeMultiplier = 0.5 + penSize;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const distortion = ctx.createWaveShaper();

  osc.type = "square";
  osc.frequency.setValueAtTime(params.baseFreq * 2, now);
  osc.frequency.exponentialRampToValueAtTime(params.baseFreq * 0.5, now + 0.08);

  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i - 128) / 128;
    curve[i] = Math.tanh(x * 2);
  }
  distortion.curve = curve;

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(params.filterFreq * 3, now);
  filter.frequency.exponentialRampToValueAtTime(params.filterFreq * 0.5, now + 0.1);
  filter.Q.value = 2;

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12 * sizeMultiplier);

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = "sine";
  click.frequency.value = params.baseFreq * 4;
  clickGain.gain.setValueAtTime(0.3, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

  click.connect(clickGain);
  clickGain.connect(getWeaponGain());

  osc.connect(distortion);
  distortion.connect(filter);
  filter.connect(gain);
  gain.connect(getWeaponGain());

  osc.start(now);
  click.start(now);

  osc.stop(now + 0.15 * sizeMultiplier);
  click.stop(now + 0.03);
}
