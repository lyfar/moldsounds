import { clamp } from "../utils.js";

export function buildPresetExport({ state, pointsManager, settings }) {
  return {
    version: 1,
    type: "interactive-physarum",
    generatedAt: new Date().toISOString(),
    points: pointsManager.currentPointsData.map((row) => row.slice()),
    selectedIndices: pointsManager.selectedIndices.slice(),
    settings: {
      penSize: state.targetActionAreaSizeSigma,
      inertia: state.L2Action,
      flowX: state.moveBiasActionX,
      flowY: state.moveBiasActionY,
      colorMode: state.colorModeType,
      showPen: state.displayPen,
      depositFactor: settings.depositFactor,
      decayFactor: settings.decayFactor,
      blurPasses: settings.blurPasses,
      drawOpacity: settings.drawOpacity,
      fillOpacity: settings.fillOpacity,
      dotSize: settings.dotSize,
    },
  };
}

export function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function createPresetSettingsApplier({
  state,
  settings,
  ui,
  updateRenderValues,
  onInertiaChange,
}) {
  const {
    penSize,
    penSizeQuick,
    penSizeQuickValue,
    inertia,
    flowX,
    flowY,
    colorMode,
    showPen,
    depositFactor,
    decayFactor,
    blurPasses,
    drawOpacity,
    fillOpacity,
    dotSize,
  } = ui;

  const applyPresetSettings = (settingsData) => {
    if (!settingsData || typeof settingsData !== "object") {
      return;
    }

    if (Number.isFinite(settingsData.penSize) && penSize) {
      const min = Number(penSize.min);
      const max = Number(penSize.max);
      const next = clamp(settingsData.penSize, min, max);
      state.targetActionAreaSizeSigma = next;
      state.latestSigmaChangeTime = state.time;
      penSize.value = String(next);
      if (penSizeQuick) {
        penSizeQuick.value = String(next);
      }
      if (penSizeQuickValue) {
        penSizeQuickValue.textContent = next.toFixed(2);
      }
    }

    if (Number.isFinite(settingsData.inertia) && inertia) {
      state.L2Action = clamp(settingsData.inertia, 0, 1);
      inertia.value = String(state.L2Action);
      if (typeof onInertiaChange === "function") {
        onInertiaChange(state.L2Action);
      }
    }

    if (Number.isFinite(settingsData.flowX) && flowX) {
      state.moveBiasActionX = clamp(settingsData.flowX, -1, 1);
      flowX.value = String(state.moveBiasActionX);
    }

    if (Number.isFinite(settingsData.flowY) && flowY) {
      state.moveBiasActionY = clamp(settingsData.flowY, -1, 1);
      flowY.value = String(state.moveBiasActionY);
    }

    if (Number.isFinite(settingsData.colorMode) && colorMode) {
      state.colorModeType = clamp(
        Math.round(settingsData.colorMode),
        0,
        settings.numberOfColorModes - 1
      );
      colorMode.value = String(state.colorModeType);
    }

    if (typeof settingsData.showPen === "boolean" && showPen) {
      state.displayPen = settingsData.showPen;
      showPen.checked = state.displayPen;
    }

    if (Number.isFinite(settingsData.depositFactor) && depositFactor) {
      settings.depositFactor = clamp(settingsData.depositFactor, 0, 1);
      depositFactor.value = String(settings.depositFactor);
    }

    if (Number.isFinite(settingsData.decayFactor) && decayFactor) {
      settings.decayFactor = clamp(settingsData.decayFactor, 0, 1);
      decayFactor.value = String(settings.decayFactor);
    }

    if (Number.isFinite(settingsData.blurPasses) && blurPasses) {
      settings.blurPasses = Math.max(0, Math.round(settingsData.blurPasses));
      blurPasses.value = String(settings.blurPasses);
    }

    if (Number.isFinite(settingsData.drawOpacity) && drawOpacity) {
      settings.drawOpacity = clamp(settingsData.drawOpacity, 0, 1);
      drawOpacity.value = String(settings.drawOpacity);
    }

    if (Number.isFinite(settingsData.fillOpacity) && fillOpacity) {
      settings.fillOpacity = clamp(settingsData.fillOpacity, 0, 1);
      fillOpacity.value = String(settings.fillOpacity);
    }

    if (Number.isFinite(settingsData.dotSize) && dotSize) {
      settings.dotSize = clamp(settingsData.dotSize, 0, 50);
      dotSize.value = String(settings.dotSize);
    }

    if (typeof updateRenderValues === "function") {
      updateRenderValues();
    }
  };

  const applyRenderSettingsFromParams = (params, offset = 14) => {
    if (!Array.isArray(params) || params.length < offset + 6) {
      return;
    }
    applyPresetSettings({
      depositFactor: params[offset],
      decayFactor: params[offset + 1],
      blurPasses: params[offset + 2],
      drawOpacity: params[offset + 3],
      fillOpacity: params[offset + 4],
      dotSize: params[offset + 5],
    });
  };

  return {
    applyPresetSettings,
    applyRenderSettingsFromParams,
  };
}
