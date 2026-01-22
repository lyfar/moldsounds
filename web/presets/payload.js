import { PARAMS_DIMENSION, PARAMETERS_MATRIX, POINT_LABELS } from "../config.js";

const PRESET_SCALING_BY_NAME = (() => {
  const map = new Map();
  const scalingIndex = PARAMS_DIMENSION - 1;
  for (let i = 0; i < POINT_LABELS.length; i += 1) {
    const name = POINT_LABELS[i];
    const factor = PARAMETERS_MATRIX[i]?.[scalingIndex];
    if (!name || !Number.isFinite(factor)) {
      continue;
    }
    map.set(name.toLowerCase(), factor);
  }
  return map;
})();

const resolvePresetScalingFactor = (payload) => {
  const name = typeof payload?.name === "string" ? payload.name.trim().toLowerCase() : "";
  if (name && PRESET_SCALING_BY_NAME.has(name)) {
    return PRESET_SCALING_BY_NAME.get(name);
  }
  return null;
};

const parsePresetPayload = (payload) => {
  const params = payload?.parameters;
  if (!Array.isArray(params) || params.length < 14) {
    return null;
  }
  const renderOffset = params.length >= 21 ? 15 : 14;
  const coreParams = params.slice(0, 14);
  const explicitScaling =
    params.length >= 21 && Number.isFinite(params[14]) ? Number(params[14]) : null;
  const scalingFactor = Number.isFinite(explicitScaling)
    ? explicitScaling
    : resolvePresetScalingFactor(payload);
  return { params, coreParams, renderOffset, scalingFactor };
};

export function applyPresetPayload({
  payload,
  targetIndex,
  pointsManager,
  applyRenderSettingsFromParams,
  updateAdvancedValues,
  state,
  notify,
}) {
  const parsed = parsePresetPayload(payload);
  if (!parsed) {
    notify("Preset parameters missing or invalid.");
    return false;
  }

  const applyTargets = targetIndex === 2 ? [0, 1] : [targetIndex];
  const applied = applyTargets.every((slot) =>
    pointsManager.applyPointPreset(slot, parsed.coreParams, parsed.scalingFactor)
  );
  if (!applied) {
    notify("Preset parameters could not be applied.");
    return false;
  }

  applyRenderSettingsFromParams(parsed.params, parsed.renderOffset);
  if (typeof updateAdvancedValues === "function") {
    updateAdvancedValues();
  }
  state.transitionTriggerTime = state.time;
  const targetLabel =
    targetIndex === 2 ? "Pen + Background" : targetIndex === 0 ? "Pen" : "Background";
  notify(`Preset applied to ${targetLabel}.`);
  return true;
}
