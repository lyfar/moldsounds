import { WEAPON_GAIN_SCALE } from "./constants.js";

let audioCtx = null;
let masterGain = null;
let compressor = null;
let weaponGain = null;
let currentVolume = 0.5;

export function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = currentVolume;

    weaponGain = audioCtx.createGain();
    weaponGain.gain.value = WEAPON_GAIN_SCALE;
    weaponGain.connect(masterGain);

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

export function getWeaponGain() {
  ensureAudioContext();
  return weaponGain || masterGain;
}

export function setMasterVolume(volume) {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.05);
  }
}
