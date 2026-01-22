import { WEAPON_FILTER_SCALE, WEAPON_PITCH_SCALE } from "./constants.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const getWeaponParamsFromPoint = (pointValues) => {
  const params = getParamsFromPoint(pointValues);
  return {
    ...params,
    baseFreq: clamp(params.baseFreq * WEAPON_PITCH_SCALE, 60, 800),
    filterFreq: clamp(params.filterFreq * WEAPON_FILTER_SCALE, 120, 2400),
  };
};

export function getParamsFromPoint(pointValues) {
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

  const baseFreq = 80 + Math.min(sensorDist * 25, 720);
  const harmonicRatio = 1.0 + (sensorAngle % 10) * 0.1;
  const attackTime = 0.01 + sdAmp * 0.1;
  const decayTime = 0.1 + moveDist * 0.05;
  const filterFreq = 200 + rotAngle * 100 + raAmp * 500;
  const modDepth = 0.1 + (sdExp + saExp + raExp) * 0.1;
  const detune = (bias1 - bias2) * 10;

  return {
    baseFreq: clamp(baseFreq, 60, 1200),
    harmonicRatio: clamp(harmonicRatio, 1.0, 3.0),
    attackTime: clamp(attackTime, 0.005, 0.2),
    decayTime: clamp(decayTime, 0.1, 1.0),
    filterFreq: clamp(filterFreq, 100, 4000),
    modDepth: clamp(modDepth, 0, 1),
    detune: clamp(detune, -100, 100),
  };
}
