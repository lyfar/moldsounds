import { ensureAudioContext, getMasterGain, getWeaponGain } from "./context.js";
import { WEAPON_PITCH_SCALE } from "./constants.js";
import { getParamsFromPoint } from "./params.js";

export function playQuantumShift(pointValues1, pointValues2) {
  const ctx = ensureAudioContext();
  const params1 = getParamsFromPoint(pointValues1);
  const params2 = getParamsFromPoint(pointValues2);
  const now = ctx.currentTime;

  const duration = 0.4;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc1.type = "sine";
  osc2.type = "triangle";

  osc1.frequency.setValueAtTime(params1.baseFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(params2.baseFreq, now + duration);

  osc2.frequency.setValueAtTime(params1.baseFreq * params1.harmonicRatio, now);
  osc2.frequency.exponentialRampToValueAtTime(
    params2.baseFreq * params2.harmonicRatio,
    now + duration
  );

  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.linearRampToValueAtTime(0.001, now + duration);

  gain2.gain.setValueAtTime(0.001, now);
  gain2.gain.linearRampToValueAtTime(0.2, now + duration * 0.5);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + duration);

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(params1.filterFreq, now);
  filter.frequency.exponentialRampToValueAtTime(params2.filterFreq, now + duration);
  filter.Q.value = 4;

  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(filter);
  gain2.connect(filter);
  filter.connect(getMasterGain());

  osc1.start(now);
  osc2.start(now);

  osc1.stop(now + duration + 0.1);
  osc2.stop(now + duration + 0.1);
}

export function playNextLevel(pointValues) {
  const ctx = ensureAudioContext();
  const params = getParamsFromPoint(pointValues);
  const now = ctx.currentTime;

  const scale = [1, 1.25, 1.5, 1.875, 2];
  const noteLength = 0.08;

  scale.forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = params.baseFreq * ratio * 1.5;

    const startTime = now + i * noteLength;
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteLength * 1.5);

    osc.connect(gain);
    gain.connect(getMasterGain());

    osc.start(startTime);
    osc.stop(startTime + noteLength * 2);
  });
}

export function playSoundToggle(enabled) {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = enabled ? 880 : 440;

  if (enabled) {
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
  } else {
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
  }

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(getMasterGain());

  osc.start(now);
  osc.stop(now + 0.2);
}

export function playWeaponSelect(weaponIndex) {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const pitches = [220, 277, 330, 392, 440];
  const freq = pitches[weaponIndex % pitches.length] * WEAPON_PITCH_SCALE;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 0.05);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(getWeaponGain());

  osc.start(now);
  osc.stop(now + 0.1);
}

export function playUIClick() {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = 1200;

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  osc.connect(gain);
  gain.connect(getMasterGain());

  osc.start(now);
  osc.stop(now + 0.05);
}
