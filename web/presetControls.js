import { clamp } from "./utils.js";
import { initParamControls } from "./presets/paramControls.js";
import {
  buildPresetExport,
  downloadJson,
  createPresetSettingsApplier,
} from "./presets/settings.js";
import { applyPresetPayload } from "./presets/payload.js";
import { loadPresetLibrary, updatePresetInfo } from "./presets/library.js";

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
    exportPreset,
    importPreset,
    presetFile,
    presetLibrary,
    presetInfo,
    presetApplyTarget,
    applyPresetBtn,
    editTarget,
    resetCurrent,
    resetAll,
  } = ui;

  const notify =
    typeof flashStatus === "function"
      ? flashStatus
      : (message) => console.info(message);

  let presetLibraryEntries = [];

  const { buildParamControls, updateAdvancedValues, syncPointSelectors } = initParamControls({
    pointsManager,
    state,
    ui,
  });

  const { applyPresetSettings, applyRenderSettingsFromParams } = createPresetSettingsApplier({
    state,
    settings,
    ui,
    updateRenderValues,
    onInertiaChange,
  });

  const getPresetTargetIndex = () => {
    if (presetApplyTarget) {
      return Number(presetApplyTarget.value) || 0;
    }
    if (editTarget) {
      return Number(editTarget.value) || 0;
    }
    return 0;
  };

  const applyPresetPayloadWithTarget = (payload, targetIndex = getPresetTargetIndex()) =>
    applyPresetPayload({
      payload,
      targetIndex,
      pointsManager,
      applyRenderSettingsFromParams,
      updateAdvancedValues,
      state,
      notify,
    });

  if (exportPreset) {
    exportPreset.addEventListener("click", () => {
      downloadJson(
        buildPresetExport({ state, pointsManager, settings }),
        `physarum_preset_${Date.now()}.json`
      );
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
          applyPresetPayloadWithTarget(payload, getPresetTargetIndex());
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
      applyPresetPayloadWithTarget(payload, getPresetTargetIndex());
      updatePresetInfo(presetInfo, entry);
    } catch (error) {
      console.error(error);
      notify("Failed to load preset.");
    }
  };

  if (presetLibrary) {
    presetLibrary.addEventListener("change", () => {
      updatePresetInfo(presetInfo, presetLibraryEntries[presetLibrary.selectedIndex]);
    });
    loadPresetLibrary({ presetLibrary, presetInfo }).then((entries) => {
      presetLibraryEntries = entries;
    });
  }

  if (applyPresetBtn) {
    applyPresetBtn.addEventListener("click", () => {
      applyPresetLibrarySelection();
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
    applyPresetPayload: applyPresetPayloadWithTarget,
  };
}
