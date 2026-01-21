// Procedural audio system - generates sounds based on Physarum parameters
// Each weapon has a unique sound signature derived from current point settings

let audioCtx = null;
let masterGain = null;
let compressor = null;
let weaponGain = null;
let currentVolume = 0.5;
const WEAPON_GAIN_SCALE = 0.3;
const WEAPON_PITCH_SCALE = 0.6;
const WEAPON_FILTER_SCALE = 0.7;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getWeaponParamsFromPoint = (pointValues) => {
  const params = getParamsFromPoint(pointValues);
  return {
    ...params,
    baseFreq: clamp(params.baseFreq * WEAPON_PITCH_SCALE, 60, 800),
    filterFreq: clamp(params.filterFreq * WEAPON_FILTER_SCALE, 120, 2400),
  };
};

const getWeaponGain = () => {
  ensureAudioContext();
  return weaponGain || masterGain;
};

export function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Master gain for overall volume
    masterGain = audioCtx.createGain();
    masterGain.gain.value = currentVolume;
    
    // Weapon gain to keep pen sounds lower
    weaponGain = audioCtx.createGain();
    weaponGain.gain.value = WEAPON_GAIN_SCALE;
    weaponGain.connect(masterGain);

    // Compressor to prevent clipping
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
  }
  
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  
  return audioCtx;
}

export function getAudioContext() {
  return ensureAudioContext();
}

export function getMasterGain() {
  ensureAudioContext();
  return masterGain;
}

export function setMasterVolume(volume) {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.05);
  }
}

// Extract musical parameters from Physarum point settings
function getParamsFromPoint(pointValues) {
  if (!pointValues || pointValues.length < 15) {
    return {
      baseFreq: 220,
      harmonicRatio: 1.5,
      attackTime: 0.05,
      decayTime: 0.3,
      filterFreq: 800,
      modDepth: 0.3,
      detune: 0,
    };
  }
  
  // Map Physarum parameters to audio parameters
  const sensorDist = pointValues[0] || 1;
  const sdExp = pointValues[1] || 0.5;
  const sdAmp = pointValues[2] || 0.5;
  const sensorAngle = pointValues[3] || 1;
  const saExp = pointValues[4] || 0.5;
  const saAmp = pointValues[5] || 0.5;
  const rotAngle = pointValues[6] || 1;
  const raExp = pointValues[7] || 0.5;
  const raAmp = pointValues[8] || 0.5;
  const moveDist = pointValues[9] || 1;
  const mdExp = pointValues[10] || 0.5;
  const mdAmp = pointValues[11] || 0.5;
  const bias1 = pointValues[12] || 0;
  const bias2 = pointValues[13] || 0;
  const scaleFactor = pointValues[14] || 20;
  
  // Base frequency from sensor distance (mapped to musical range 80-800 Hz)
  const baseFreq = 80 + Math.min(sensorDist * 25, 720);
  
  // Harmonic ratio from sensor angle (creates different timbres)
  const harmonicRatio = 1.0 + (sensorAngle % 10) * 0.1;
  
  // Attack/decay from movement parameters
  const attackTime = 0.01 + sdAmp * 0.1;
  const decayTime = 0.1 + moveDist * 0.05;
  
  // Filter frequency from rotation parameters
  const filterFreq = 200 + rotAngle * 100 + raAmp * 500;
  
  // Modulation depth from exponents
  const modDepth = 0.1 + (sdExp + saExp + raExp) * 0.1;
  
  // Detune from biases
  const detune = (bias1 - bias2) * 10;
  
  return {
    baseFreq: Math.min(Math.max(baseFreq, 60), 1200),
    harmonicRatio: Math.min(Math.max(harmonicRatio, 1.0), 3.0),
    attackTime: Math.min(Math.max(attackTime, 0.005), 0.2),
    decayTime: Math.min(Math.max(decayTime, 0.1), 1.0),
    filterFreq: Math.min(Math.max(filterFreq, 100), 4000),
    modDepth: Math.min(Math.max(modDepth, 0), 1),
    detune: Math.min(Math.max(detune, -100), 100),
  };
}

// Nova Burst - explosive scatter sound
export function playNovaBurst(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;
  
  // Size affects pitch and duration
  const sizeMultiplier = 0.5 + penSize * 1.5;
  
  // Create noise burst
  const noiseLength = 0.15 * sizeMultiplier;
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLength, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.3));
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  
  // Filter the noise based on params
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = params.filterFreq * sizeMultiplier;
  noiseFilter.Q.value = 2;
  
  // Pitched component - detuned oscillators for richness
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc2.type = "square";
  osc1.frequency.value = params.baseFreq * sizeMultiplier;
  osc2.frequency.value = params.baseFreq * params.harmonicRatio * sizeMultiplier;
  osc1.detune.value = params.detune - 5;
  osc2.detune.value = params.detune + 5;
  
  // Pitch sweep down for explosion feel
  osc1.frequency.setValueAtTime(params.baseFreq * 2 * sizeMultiplier, now);
  osc1.frequency.exponentialRampToValueAtTime(params.baseFreq * 0.5 * sizeMultiplier, now + 0.15);
  osc2.frequency.setValueAtTime(params.baseFreq * params.harmonicRatio * 2 * sizeMultiplier, now);
  osc2.frequency.exponentialRampToValueAtTime(params.baseFreq * params.harmonicRatio * 0.3 * sizeMultiplier, now + 0.2);
  
  // Gain envelopes
  const noiseGain = ctx.createGain();
  const oscGain = ctx.createGain();
  
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLength);
  
  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25 * sizeMultiplier);
  
  // Connect
  const weaponOut = getWeaponGain();
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(weaponOut);
  
  osc1.connect(oscGain);
  osc2.connect(oscGain);
  oscGain.connect(weaponOut);
  
  // Play
  noise.start(now);
  osc1.start(now);
  osc2.start(now);
  
  noise.stop(now + noiseLength);
  osc1.stop(now + 0.3 * sizeMultiplier);
  osc2.stop(now + 0.3 * sizeMultiplier);
}

// Halo Ring - ethereal ring/chime sound
export function playHaloRing(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;
  
  const sizeMultiplier = 0.7 + penSize * 0.8;
  
  // Create bell-like harmonics
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

// Void Wave - deep pulsing wave sound
export function playVoidWave(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;
  
  const sizeMultiplier = 0.8 + penSize * 1.2;
  const duration = 0.6 * sizeMultiplier;
  
  // Sub bass
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = params.baseFreq * 0.25;
  
  // Main tone with FM modulation
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  
  carrier.type = "sine";
  carrier.frequency.value = params.baseFreq * 0.5;
  
  modulator.type = "sine";
  modulator.frequency.value = params.baseFreq * params.harmonicRatio * 0.5;
  modGain.gain.value = params.modDepth * params.baseFreq;
  
  // Sweep the modulation
  modGain.gain.setValueAtTime(params.modDepth * params.baseFreq * 2, now);
  modGain.gain.exponentialRampToValueAtTime(params.modDepth * params.baseFreq * 0.1, now + duration);
  
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  
  // Filter sweep
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(params.filterFreq * 2, now);
  filter.frequency.exponentialRampToValueAtTime(params.filterFreq * 0.3, now + duration);
  filter.Q.value = 5;
  
  // Gains
  const subGain = ctx.createGain();
  const mainGain = ctx.createGain();
  
  subGain.gain.setValueAtTime(0.001, now);
  subGain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
  subGain.gain.setValueAtTime(0.35, now + duration * 0.7);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  
  // Connect
  const weaponOut = getWeaponGain();
  sub.connect(subGain);
  subGain.connect(weaponOut);
  
  carrier.connect(filter);
  filter.connect(mainGain);
  mainGain.connect(weaponOut);
  
  // Play
  sub.start(now);
  modulator.start(now);
  carrier.start(now);
  
  sub.stop(now + duration + 0.1);
  modulator.stop(now + duration + 0.1);
  carrier.stop(now + duration + 0.1);
}

// Chaos Vortex - swirling chaotic sound
export function playChaosVortex(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;
  
  const sizeMultiplier = 0.6 + penSize * 1.4;
  const duration = 0.5 * sizeMultiplier;
  
  // Multiple detuned oscillators spinning
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
    
    // LFO for wobble
    lfo.type = "sine";
    lfo.frequency.value = 3 + i * 2 + params.modDepth * 10;
    lfoGain.gain.value = 30 + params.modDepth * 50;
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    // Spinning panner
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
    
    // Envelope
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

// Mold Pulse - concentrated impact sound
export function playMoldPulse(pointValues, penSize) {
  const ctx = ensureAudioContext();
  const params = getWeaponParamsFromPoint(pointValues);
  const now = ctx.currentTime;
  
  const sizeMultiplier = 0.5 + penSize;
  
  // Short punchy sound
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const distortion = ctx.createWaveShaper();
  
  osc.type = "square";
  osc.frequency.setValueAtTime(params.baseFreq * 2, now);
  osc.frequency.exponentialRampToValueAtTime(params.baseFreq * 0.5, now + 0.08);
  
  // Soft clipping distortion
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
  
  // Click transient
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

// Quantum Shift - morphing transition sound
export function playQuantumShift(pointValues1, pointValues2) {
  const ctx = ensureAudioContext();
  const params1 = getParamsFromPoint(pointValues1);
  const params2 = getParamsFromPoint(pointValues2);
  const now = ctx.currentTime;
  
  const duration = 0.4;
  
  // Morph between two frequencies
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  const gain2 = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  
  osc1.type = "sine";
  osc2.type = "triangle";
  
  // Crossfade frequencies
  osc1.frequency.setValueAtTime(params1.baseFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(params2.baseFreq, now + duration);
  
  osc2.frequency.setValueAtTime(params1.baseFreq * params1.harmonicRatio, now);
  osc2.frequency.exponentialRampToValueAtTime(params2.baseFreq * params2.harmonicRatio, now + duration);
  
  // Crossfade gains
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
  filter.connect(masterGain);
  
  osc1.start(now);
  osc2.start(now);
  
  osc1.stop(now + duration + 0.1);
  osc2.stop(now + duration + 0.1);
}

// Next Level - ascending arpeggio
export function playNextLevel(pointValues) {
  const ctx = ensureAudioContext();
  const params = getParamsFromPoint(pointValues);
  const now = ctx.currentTime;
  
  // Musical scale based on params
  const scale = [1, 1.25, 1.5, 1.875, 2]; // Pentatonic-ish
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
    gain.connect(masterGain);
    
    osc.start(startTime);
    osc.stop(startTime + noteLength * 2);
  });
}

// Sound toggle on/off
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
  gain.connect(masterGain);
  
  osc.start(now);
  osc.stop(now + 0.2);
}

// Map weapon index to sound function
export function playWeaponSound(weaponIndex, pointValues, penSize) {
  switch (weaponIndex) {
    case 0:
      playNovaBurst(pointValues, penSize);
      break;
    case 1:
      playHaloRing(pointValues, penSize);
      break;
    case 2:
      playVoidWave(pointValues, penSize);
      break;
    case 3:
      playChaosVortex(pointValues, penSize);
      break;
    case 4:
      playMoldPulse(pointValues, penSize);
      break;
    default:
      playNovaBurst(pointValues, penSize);
  }
}

// Weapon select click
export function playWeaponSelect(weaponIndex) {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;
  
  // Different pitch for each weapon slot
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

// UI interaction click
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
  gain.connect(masterGain);
  
  osc.start(now);
  osc.stop(now + 0.05);
}
