export {
  ensureAudioContext,
  getAudioContext,
  getMasterGain,
  setMasterVolume,
} from "./audio/context.js";
export {
  playNovaBurst,
  playHaloRing,
  playVoidWave,
  playChaosVortex,
  playMoldPulse,
} from "./audio/weapons.js";
export {
  playQuantumShift,
  playNextLevel,
  playSoundToggle,
  playWeaponSelect,
  playUIClick,
} from "./audio/effects.js";

import {
  playNovaBurst,
  playHaloRing,
  playVoidWave,
  playChaosVortex,
  playMoldPulse,
} from "./audio/weapons.js";

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
