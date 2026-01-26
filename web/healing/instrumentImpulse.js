import { clamp } from "../utils.js";
import { TOWER_SETTINGS } from "../config.js";

const CONTINUOUS_INSTRUMENTS = new Set(["bowl", "crystal", "chime"]);
const HOLD_INTERVALS = {
  bowl: 0.7,
  crystal: 0.5,
  chime: 0.85,
};
const CHIME_BURST_DELAYS = [140, 280];

const INSTRUMENT_IMPACT_PROFILES = {
  bowl: { strengthBoost: 0.18, chladniBoost: 0.08 },
  gong: { strengthBoost: 0.32, cymaticsBoost: 0.18, radialBoost: 0.2 },
  wood: { strengthBoost: 0.22, standingBoost: 0.22 },
  crystal: {
    strengthBoost: 0.18,
    chladniBoost: 0.08,
    spiralBoost: 0.08,
    angularBoost: 0.06,
  },
  drum: { strengthBoost: 0.3, radiusBoost: 0.16, standingBoost: 0.3 },
  chime: { strengthBoost: 0.2, spiralBoost: 0.18, angularBoost: 0.22 },
};

const IMPACT_DECAY = 2.4;

export function createInstrumentImpulse({
  audio,
  getActiveInstrument,
  getInstrumentParams,
  setStatus,
  getInstrumentLabel,
  setHolding,
  canvas,
}) {
  let impactLevel = 0;
  let impactInstrument = getActiveInstrument();
  let lastFrameTime = 0;
  let holdActive = false;
  let holdPointerId = null;
  let holdInstrument = null;
  let holdTimer = null;

  const playInstrument = (instrumentId) => {
    const params = getInstrumentParams();
    audio.triggerInstrument(instrumentId, params);
    impactInstrument = instrumentId;
    impactLevel = 1;
  };

  const triggerInstrument = (instrumentId, { burst = false } = {}) => {
    playInstrument(instrumentId);
    if (burst && instrumentId === "chime") {
      CHIME_BURST_DELAYS.forEach((delay) => {
        setTimeout(() => playInstrument(instrumentId), delay);
      });
    }
  };

  const getHoldInterval = (instrumentId, decay) => {
    const base = HOLD_INTERVALS[instrumentId] ?? 0.7;
    const decayScale = clamp(decay / 12.7, 0.6, 1.4);
    return clamp(base * decayScale, 0.3, 1.0);
  };

  const stopHold = (pointerId = null) => {
    if (!holdActive) {
      return;
    }
    if (pointerId !== null && holdPointerId !== null && pointerId !== holdPointerId) {
      return;
    }
    holdActive = false;
    holdPointerId = null;
    holdInstrument = null;
    if (typeof setHolding === "function") {
      setHolding(false);
    }
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  };

  const scheduleHold = () => {
    if (!holdActive || !holdInstrument) {
      return;
    }
    const { decay } = getInstrumentParams();
    const interval = getHoldInterval(holdInstrument, decay);
    holdTimer = setTimeout(() => {
      if (!holdActive || !holdInstrument) {
        return;
      }
      triggerInstrument(holdInstrument, { burst: holdInstrument === "chime" });
      scheduleHold();
    }, interval * 1000);
  };

  const startHold = (pointerId = null) => {
    const activeInstrument = getActiveInstrument();
    if (holdActive || !CONTINUOUS_INSTRUMENTS.has(activeInstrument)) {
      return;
    }
    holdActive = true;
    holdPointerId = pointerId;
    holdInstrument = activeInstrument;
    if (typeof setHolding === "function") {
      setHolding(true);
    }
    scheduleHold();
  };

  const shouldStartHold = (event) => {
    if (!CONTINUOUS_INSTRUMENTS.has(getActiveInstrument())) {
      return false;
    }
    if (event.target !== canvas) {
      return false;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return false;
    }
    if (event.pointerType === "touch" && event.isPrimary === false) {
      return false;
    }
    return true;
  };

  if (canvas) {
    canvas.addEventListener("pointerdown", (event) => {
      if (!shouldStartHold(event)) {
        return;
      }
      startHold(event.pointerId);
    });

    const endHoldEvent = (event) => {
      if (event.pointerType === "touch" && event.isPrimary === false) {
        return;
      }
      stopHold(event.pointerId);
    };

    canvas.addEventListener("pointerup", endHoldEvent);
    canvas.addEventListener("pointercancel", endHoldEvent);
    canvas.addEventListener("pointerleave", () => stopHold());
    window.addEventListener("blur", () => stopHold());
  }

  const emitSound = () => {
    const activeInstrument = getActiveInstrument();
    triggerInstrument(activeInstrument, { burst: activeInstrument === "chime" });
    if (typeof setStatus === "function") {
      const label = getInstrumentLabel?.(activeInstrument) || activeInstrument;
      setStatus(`${label} emitted.`);
    }
  };

  const handleInstrumentChange = (instrumentId) => {
    if (holdActive && holdInstrument !== instrumentId) {
      stopHold();
    }
  };

  const update = (time) => {
    const dt = Math.max(0, time - lastFrameTime);
    lastFrameTime = time;
    impactLevel = Math.max(0, impactLevel - dt * IMPACT_DECAY);
    const profile =
      INSTRUMENT_IMPACT_PROFILES[impactInstrument] || INSTRUMENT_IMPACT_PROFILES.bowl;
    const strengthScale = 1 + (profile.strengthBoost ?? 0) * impactLevel;
    const radiusScale = 1 + (profile.radiusBoost ?? 0) * impactLevel;
    return { strengthScale, radiusScale };
  };

  const applyImpactToMix = (mix) => {
    const profile =
      INSTRUMENT_IMPACT_PROFILES[impactInstrument] || INSTRUMENT_IMPACT_PROFILES.bowl;
    const impact = impactLevel;
    return {
      mixChladni: Math.max(0, mix.mixChladni + (profile.chladniBoost ?? 0) * impact),
      mixCymatics: Math.max(0, mix.mixCymatics + (profile.cymaticsBoost ?? 0) * impact),
      mixSpiral: Math.max(0, mix.mixSpiral + (profile.spiralBoost ?? 0) * impact),
      mixStanding: Math.max(0, mix.mixStanding + (profile.standingBoost ?? 0) * impact),
      radialMod: mix.radialMod + (profile.radialBoost ?? 0) * impact,
      angularMod: mix.angularMod + (profile.angularBoost ?? 0) * impact,
    };
  };

  const applyRadius = (baseRadius, radiusScale) =>
    clamp(baseRadius * radiusScale, TOWER_SETTINGS.minRadius, TOWER_SETTINGS.maxRadius);

  return {
    emitSound,
    handleInstrumentChange,
    update,
    applyImpactToMix,
    applyRadius,
  };
}
