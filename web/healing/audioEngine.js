import { clamp, lerp } from "../utils.js";
import {
  playSacredBowl,
  playRiemannGong,
  playOrganicBlock,
  playCrystalHarp,
  playShamanicDrum,
  playKoshiChimes,
} from "./instruments.js";
import { getAudioContext, getMasterGain } from "../audio.js";

const INSTRUMENT_PLAYERS = {
  bowl: playSacredBowl,
  gong: playRiemannGong,
  wood: playOrganicBlock,
  crystal: playCrystalHarp,
  drum: playShamanicDrum,
  chime: playKoshiChimes,
};

const createPinkNoiseBuffer = (ctx) => {
  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < bufferSize; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    data[i] *= 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
};

export function createHealingAudio() {
  let ctx = null;
  let compNode = null;
  let reverbNode = null;
  let analyser = null;
  let timeData = null;
  let pinkNoiseBuffer = null;
  let level = 0;
  const LEVEL_ATTACK = 0.4;
  const LEVEL_RELEASE = 0.08;

  const ensureNodes = () => {
    if (ctx) {
      return;
    }
    ctx = getAudioContext();
    pinkNoiseBuffer = createPinkNoiseBuffer(ctx);

    reverbNode = ctx.createConvolver();
    reverbNode.buffer = pinkNoiseBuffer;

    compNode = ctx.createDynamicsCompressor();
    compNode.threshold.value = -20;
    compNode.ratio.value = 8;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.85;
    timeData = new Uint8Array(analyser.fftSize);

    reverbNode.connect(compNode);
    compNode.connect(analyser);
    analyser.connect(getMasterGain());
  };

  const ensureActive = () => {
    ensureNodes();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  };

  const triggerInstrument = (instrumentId, params) => {
    ensureActive();
    const player = INSTRUMENT_PLAYERS[instrumentId] || playSacredBowl;
    player(ctx, params, {
      dest: compNode,
      reverb: reverbNode,
      pinkNoiseBuffer,
    });
  };

  const updateLevel = () => {
    if (!analyser || !timeData) {
      return 0;
    }
    analyser.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i += 1) {
      const v = (timeData[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length);
    const boosted = clamp((rms - 0.01) * 6.0, 0, 1);
    const smoothing = boosted > level ? LEVEL_ATTACK : LEVEL_RELEASE;
    level = lerp(level, boosted, smoothing);
    return level;
  };

  return {
    ensureActive,
    triggerInstrument,
    updateLevel,
  };
}
