import { clamp } from "../utils.js";

export function createFavoritePresetManager({ state, settings, pointsManager }) {
  let favoritePresetFiles = [];
  let favoritePresetIndex = -1;
  let favoritePresetLoad = null;
  let favoritePresetRequestId = 0;

  const applyFavoriteSettings = (settingsData) => {
    if (!settingsData || typeof settingsData !== "object") {
      return;
    }
    if (Number.isFinite(settingsData.penSize)) {
      const min = Number.isFinite(settings.penSizeMin) ? settings.penSizeMin : 0.02;
      const max = Number.isFinite(settings.penSizeMax) ? settings.penSizeMax : 0.85;
      state.targetActionAreaSizeSigma = clamp(settingsData.penSize, min, max);
      state.latestSigmaChangeTime = state.time;
    }
    if (Number.isFinite(settingsData.inertia)) {
      state.L2Action = clamp(settingsData.inertia, 0, 1);
    }
    if (Number.isFinite(settingsData.flowX)) {
      state.moveBiasActionX = clamp(settingsData.flowX, -1, 1);
    }
    if (Number.isFinite(settingsData.flowY)) {
      state.moveBiasActionY = clamp(settingsData.flowY, -1, 1);
    }
    if (Number.isFinite(settingsData.colorMode)) {
      const maxMode = Math.max(0, (settings.numberOfColorModes ?? 1) - 1);
      state.colorModeType = clamp(Math.round(settingsData.colorMode), 0, maxMode);
    }
    if (typeof settingsData.primeFieldEnabled === "boolean") {
      state.primeFieldEnabled = settingsData.primeFieldEnabled;
    }
    if (Number.isFinite(settingsData.primeFieldSpeed)) {
      state.primeFieldSpeed = clamp(settingsData.primeFieldSpeed, 0, 1);
    }
    if (Number.isFinite(settingsData.primeFieldStrength)) {
      state.primeFieldStrength = clamp(settingsData.primeFieldStrength, 0.1, 1.5);
    }
    if (Number.isFinite(settingsData.primeFieldSpread)) {
      state.primeFieldSpread = clamp(settingsData.primeFieldSpread, 0.2, 0.7);
    }
    if (Number.isFinite(settingsData.depositFactor)) {
      settings.depositFactor = clamp(settingsData.depositFactor, 0, 1);
    }
    if (Number.isFinite(settingsData.decayFactor)) {
      settings.decayFactor = clamp(settingsData.decayFactor, 0, 1);
    }
    if (Number.isFinite(settingsData.blurPasses)) {
      settings.blurPasses = Math.max(0, Math.round(settingsData.blurPasses));
    }
    if (Number.isFinite(settingsData.drawOpacity)) {
      settings.drawOpacity = clamp(settingsData.drawOpacity, 0, 1);
    }
    if (Number.isFinite(settingsData.fillOpacity)) {
      settings.fillOpacity = clamp(settingsData.fillOpacity, 0, 1);
    }
    if (Number.isFinite(settingsData.dotSize)) {
      settings.dotSize = clamp(settingsData.dotSize, 0, 50);
    }
  };

  const applyFavoriteSelection = (indices) => {
    if (!Array.isArray(indices) || indices.length < 2) {
      return false;
    }
    const limit = pointsManager.getNumberOfPoints() - 1;
    const penIndex = clamp(Math.round(indices[0]), 0, limit);
    const bgIndex = clamp(Math.round(indices[1]), 0, limit);
    pointsManager.setSelectedIndex(0, penIndex);
    pointsManager.setSelectedIndex(1, bgIndex);
    return true;
  };

  const loadFavoritePresetFiles = async () => {
    if (favoritePresetLoad) {
      return favoritePresetLoad;
    }
    favoritePresetLoad = (async () => {
      const response = await fetch("./physarum-favorites/index.json");
      if (!response.ok) {
        throw new Error(`Favorites index ${response.status}`);
      }
      const payload = await response.json();
      const files = Array.isArray(payload?.presets)
        ? payload.presets.map((entry) => entry?.file).filter(Boolean)
        : [];
      favoritePresetFiles = files;
      return files;
    })().catch((error) => {
      console.warn(error);
      favoritePresetFiles = [];
      return [];
    });
    return favoritePresetLoad;
  };

  const pickRandomFavoriteFile = (files) => {
    if (!files.length) {
      return null;
    }
    if (files.length === 1) {
      favoritePresetIndex = 0;
      return files[0];
    }
    let nextIndex = Math.floor(Math.random() * files.length);
    if (nextIndex === favoritePresetIndex) {
      nextIndex = (nextIndex + 1) % files.length;
    }
    favoritePresetIndex = nextIndex;
    return files[nextIndex];
  };

  const applyRandomFavoritePreset = async () => {
    const requestId = (favoritePresetRequestId += 1);
    const files = await loadFavoritePresetFiles();
    if (requestId !== favoritePresetRequestId) {
      return;
    }
    const file = pickRandomFavoriteFile(files);
    if (!file) {
      return;
    }
    const response = await fetch(`./physarum-favorites/${file}`);
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    if (Array.isArray(payload?.points)) {
      pointsManager.loadPointsData(payload.points);
    }
    if (!applyFavoriteSelection(payload?.selectedIndices)) {
      const penIndex = payload?.settings?.penIndex;
      const bgIndex = payload?.settings?.bgIndex;
      if (Number.isFinite(penIndex) && Number.isFinite(bgIndex)) {
        applyFavoriteSelection([penIndex, bgIndex]);
      }
    }
    if (payload?.settings) {
      applyFavoriteSettings(payload.settings);
    }
    state.transitionTriggerTime = state.time;
  };

  return {
    applyRandomFavoritePreset,
    loadFavoritePresetFiles,
  };
}
