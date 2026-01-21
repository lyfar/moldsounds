import { PARAMS_DIMENSION, PARAMETERS_MATRIX, POINT_LABELS } from "./config.js";
import { clamp } from "./utils.js";

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

export function initPresetControls({
  state,
  pointsManager,
  settings,
  ui = {},
  updateRenderValues,
  updateFlowControlHud,
  onInertiaChange,
  flashStatus,
}) {
  const {
    penSelect,
    bgSelect,
    exportPreset,
    importPreset,
    presetFile,
    presetLibrary,
    presetInfo,
    presetApplyTarget,
    applyPresetBtn,
    editTarget,
    editPointLabel,
    paramList,
    resetCurrent,
    resetAll,
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

  const notify =
    typeof flashStatus === "function"
      ? flashStatus
      : (message) => console.info(message);

  let presetLibraryEntries = [];
  const paramControls = [];

  const syncPointSelectors = () => {
    if (penSelect) {
      penSelect.value = String(pointsManager.selectedIndices[0]);
    }
    if (bgSelect) {
      bgSelect.value = String(pointsManager.selectedIndices[1]);
    }
  };

  const setParamValue = (index, value) => {
    const control = paramControls[index];
    if (!control) {
      return;
    }
    const min = Number(control.range.min);
    const max = Number(control.range.max);
    const clamped = clamp(value, min, max);
    pointsManager.setValue(index, clamped);
    control.range.value = String(clamped);
    control.number.value = clamped.toFixed(3);
  };

  const updateAdvancedValues = () => {
    if (!editTarget) {
      return;
    }
    const targetIndex = Number(editTarget.value);
    pointsManager.setCurrentSelectionIndex(targetIndex);
    const pointIndex = pointsManager.selectedIndices[targetIndex];
    const targetLabel = targetIndex === 0 ? "Pen" : "Background";
    if (editPointLabel) {
      editPointLabel.textContent = `Editing ${targetLabel}: ${pointsManager.getPointName(pointIndex)}`;
    }

    for (let i = 0; i < paramControls.length; i += 1) {
      const value = pointsManager.getValue(i);
      paramControls[i].range.value = String(value);
      paramControls[i].number.value = value.toFixed(3);
    }
  };

  const buildParamControls = () => {
    if (!paramList) {
      return;
    }
    paramList.innerHTML = "";
    paramControls.length = 0;

    for (let i = 0; i < PARAMS_DIMENSION; i += 1) {
      const row = document.createElement("div");
      row.className = "param-row";

      const label = document.createElement("label");
      label.textContent = pointsManager.getSettingName(i);

      const controls = document.createElement("div");
      controls.className = "param-controls";

      const range = document.createElement("input");
      range.type = "range";
      const number = document.createElement("input");
      number.type = "number";

      const { min, max, step } = pointsManager.getParamRange(i);
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      number.min = String(min);
      number.max = String(max);
      number.step = String(step);

      range.addEventListener("input", () => {
        setParamValue(i, Number(range.value));
      });
      number.addEventListener("input", () => {
        setParamValue(i, Number(number.value));
      });

      controls.append(range, number);
      row.append(label, controls);
      paramList.appendChild(row);

      paramControls.push({ range, number });
    }

    updateAdvancedValues();
  };

  if (penSelect || bgSelect) {
    if (penSelect) {
      penSelect.innerHTML = "";
    }
    if (bgSelect) {
      bgSelect.innerHTML = "";
    }
    for (let i = 0; i < pointsManager.getNumberOfPoints(); i += 1) {
      const label = pointsManager.getPointName(i);
      if (penSelect) {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = label;
        penSelect.appendChild(option);
      }
      if (bgSelect) {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = label;
        bgSelect.appendChild(option);
      }
    }
    syncPointSelectors();
  }

  if (penSelect) {
    penSelect.addEventListener("change", () => {
      pointsManager.setSelectedIndex(0, Number(penSelect.value));
      state.transitionTriggerTime = state.time;
      updateAdvancedValues();
    });
  }

  if (bgSelect) {
    bgSelect.addEventListener("change", () => {
      pointsManager.setSelectedIndex(1, Number(bgSelect.value));
      state.transitionTriggerTime = state.time;
      updateAdvancedValues();
    });
  }

  const buildPresetExport = () => ({
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
  });

  const downloadJson = (payload, filename) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  const getPresetTargetIndex = () => {
    if (presetApplyTarget) {
      return Number(presetApplyTarget.value) || 0;
    }
    if (editTarget) {
      return Number(editTarget.value) || 0;
    }
    return 0;
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

  const applySinglePreset = (payload, targetIndex) => {
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
    updateAdvancedValues();
    state.transitionTriggerTime = state.time;
    const targetLabel =
      targetIndex === 2 ? "Pen + Background" : targetIndex === 0 ? "Pen" : "Background";
    notify(`Preset applied to ${targetLabel}.`);
    return true;
  };

  if (exportPreset) {
    exportPreset.addEventListener("click", () => {
      downloadJson(buildPresetExport(), `physarum_preset_${Date.now()}.json`);
      notify("Preset exported.");
    });
  }

  if (importPreset && presetFile) {
    importPreset.addEventListener("click", () => {
      presetFile.value = "";
      presetFile.click();
    });

    presetFile.addEventListener("change", async () => {
      const file = presetFile.files && presetFile.files[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const payload =
          Array.isArray(parsed)
            ? { points: parsed }
            : parsed && typeof parsed === "object"
              ? parsed
              : null;

        if (payload?.parameters) {
          applySinglePreset(payload, getPresetTargetIndex());
          return;
        }

        const pointsData =
          payload?.points ||
          payload?.pointsData ||
          payload?.currentPointsData ||
          payload?.parameters;

        if (!Array.isArray(pointsData)) {
          notify("Preset JSON missing point data.");
          return;
        }

        if (!pointsManager.loadPointsData(pointsData)) {
          notify("Preset point data does not match expected size.");
          return;
        }

        if (Array.isArray(payload?.selectedIndices) && payload.selectedIndices.length >= 2) {
          const penIndex = Math.round(
            clamp(Number(payload.selectedIndices[0]), 0, pointsManager.getNumberOfPoints() - 1)
          );
          const bgIndex = Math.round(
            clamp(Number(payload.selectedIndices[1]), 0, pointsManager.getNumberOfPoints() - 1)
          );
          pointsManager.setSelectedIndex(0, penIndex);
          pointsManager.setSelectedIndex(1, bgIndex);
        }

        buildParamControls();
        syncPointSelectors();
        applyPresetSettings(payload?.settings);
        if (typeof updateFlowControlHud === "function") {
          updateFlowControlHud();
        }
        state.transitionTriggerTime = state.time;
        notify("Preset imported.");
      } catch (error) {
        console.error(error);
        notify("Invalid preset JSON.");
      }
    });
  }

  const formatPresetLabel = (entry) => {
    if (entry?.label) {
      return entry.label;
    }
    if (entry?.name && entry?.exported) {
      return `${entry.name} (${entry.exported.slice(0, 10)})`;
    }
    return entry?.name || entry?.file || "Preset";
  };

  const updatePresetInfo = (entry) => {
    if (!presetInfo) {
      return;
    }
    if (!entry) {
      presetInfo.textContent = "No preset selected.";
      return;
    }
    const parts = [entry.name || entry.file];
    if (entry.exported) {
      parts.push(entry.exported);
    }
    presetInfo.textContent = parts.filter(Boolean).join(" \u2022 ");
  };

  const loadPresetLibrary = async () => {
    if (!presetLibrary) {
      return;
    }
    presetLibrary.innerHTML = "";
    presetLibraryEntries = [];
    if (presetInfo) {
      presetInfo.textContent = "Loading presets...";
    }
    try {
      const response = await fetch("./36points-exports/index.json", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Preset index ${response.status}`);
      }
      const data = await response.json();
      const entries = Array.isArray(data?.presets) ? data.presets : [];
      presetLibraryEntries = entries;
      entries.forEach((entry, index) => {
        const option = document.createElement("option");
        option.value = entry.file || String(index);
        option.textContent = formatPresetLabel(entry);
        presetLibrary.appendChild(option);
      });
      updatePresetInfo(entries[0]);
    } catch (error) {
      console.warn("Failed to load preset library", error);
      if (presetInfo) {
        presetInfo.textContent = "Preset library unavailable.";
      }
    }
  };

  const applyPresetLibrarySelection = async () => {
    if (!presetLibrary || presetLibraryEntries.length === 0) {
      notify("Preset library is empty.");
      return;
    }
    const index = Math.max(0, presetLibrary.selectedIndex);
    const entry = presetLibraryEntries[index];
    if (!entry?.file) {
      notify("Preset file missing.");
      return;
    }
    try {
      const response = await fetch(`./36points-exports/${entry.file}`);
      if (!response.ok) {
        throw new Error(`Preset ${response.status}`);
      }
      const payload = await response.json();
      applySinglePreset(payload, getPresetTargetIndex());
      updatePresetInfo(entry);
    } catch (error) {
      console.error(error);
      notify("Failed to load preset.");
    }
  };

  if (presetLibrary) {
    presetLibrary.addEventListener("change", () => {
      updatePresetInfo(presetLibraryEntries[presetLibrary.selectedIndex]);
    });
    loadPresetLibrary();
  }

  if (applyPresetBtn) {
    applyPresetBtn.addEventListener("click", () => {
      applyPresetLibrarySelection();
    });
  }

  if (editTarget) {
    editTarget.addEventListener("change", () => {
      updateAdvancedValues();
    });
  }

  if (resetCurrent) {
    resetCurrent.addEventListener("click", () => {
      pointsManager.resetCurrentPoint();
      updateAdvancedValues();
    });
  }

  if (resetAll) {
    resetAll.addEventListener("click", () => {
      pointsManager.resetAllPoints();
      updateAdvancedValues();
    });
  }

  buildParamControls();

  return {
    updateAdvancedValues,
    syncPointSelectors,
    applyPresetSettings,
    buildParamControls,
  };
}
