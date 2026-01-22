import { QUALITY_PRESETS } from "../config.js";
import { clamp } from "../utils.js";
import { setMasterVolume } from "../audio.js";

const FAVORITES_FOLDER_NAME = "physarum-favorites";
const FAVORITE_FILE_PATTERN = /^physarum_favorite_(\d+)\.json$/;

const buildFavoriteIndexEntry = (fileName, payload) => {
  const match = FAVORITE_FILE_PATTERN.exec(fileName);
  const fallbackTimestamp = match ? Number(match[1]) : null;
  const generatedAt =
    typeof payload?.generatedAt === "string"
      ? payload.generatedAt
      : Number.isFinite(fallbackTimestamp)
        ? new Date(fallbackTimestamp).toISOString()
        : null;
  const label = generatedAt ? `Favorite ${generatedAt.slice(0, 10)}` : fileName;
  return {
    file: fileName,
    name: fileName.replace(/\.json$/, ""),
    exported: generatedAt,
    label,
  };
};

const updateFavoritesIndex = async (directoryHandle) => {
  const entries = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind !== "file") {
      continue;
    }
    if (!name.endsWith(".json") || name === "index.json") {
      continue;
    }
    let payload = null;
    try {
      const file = await handle.getFile();
      const text = await file.text();
      payload = JSON.parse(text);
    } catch (error) {
      console.warn("Failed to parse favorite", name, error);
    }
    entries.push(buildFavoriteIndexEntry(name, payload));
  }
  entries.sort((a, b) => {
    if (a.exported && b.exported) {
      return a.exported.localeCompare(b.exported);
    }
    if (a.exported) {
      return -1;
    }
    if (b.exported) {
      return 1;
    }
    return a.file.localeCompare(b.file);
  });

  const indexPayload = {
    version: 1,
    source: "favorites",
    presets: entries,
  };
  const indexHandle = await directoryHandle.getFileHandle("index.json", { create: true });
  const writable = await indexHandle.createWritable();
  await writable.write(JSON.stringify(indexPayload, null, 2));
  await writable.close();
};

export function initSettingsIO({
  state,
  settings,
  pointsManager,
  ui,
  qualityKey,
  applyPresetSettings,
  updateFlowControlHud,
  updatePrimeUi,
  syncPointSelectors,
  updateAdvancedValues,
  updateParticleInfo,
  flashStatus,
  onRestorePending,
}) {
  const {
    exportSettings,
    importSettings,
    settingsFile,
    favoriteSettings,
    primeMode,
    primeSpeed,
    primeStrength,
    primeSpread,
    weaponVolume,
    weaponVolumeValue,
    particleDensity,
    quality,
  } = ui;

  let favoriteDirectoryHandle = null;

  const downloadJson = (payload, filename) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildSettingsExport = () => {
    const currentDensity = particleDensity
      ? Number(particleDensity.value)
      : QUALITY_PRESETS[qualityKey].particleDensity;
    const currentVolume = weaponVolume
      ? Number(weaponVolume.value)
      : settings.weaponSoundVolume ?? 0.5;
    return {
      version: 1,
      type: "interactive-physarum-settings",
      generatedAt: new Date().toISOString(),
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
        primeFieldEnabled: state.primeFieldEnabled,
        primeFieldSpeed: state.primeFieldSpeed,
        primeFieldStrength: state.primeFieldStrength,
        primeFieldSpread: state.primeFieldSpread,
        weaponVolume: currentVolume,
        quality: quality ? quality.value : qualityKey,
        particleDensity: currentDensity,
        penIndex: pointsManager.selectedIndices[0],
        bgIndex: pointsManager.selectedIndices[1],
      },
    };
  };

  const buildFavoriteExport = () => ({
    version: 1,
    type: "interactive-physarum-favorite",
    generatedAt: new Date().toISOString(),
    points: pointsManager.currentPointsData.map((row) => row.slice()),
    selectedIndices: pointsManager.selectedIndices.slice(),
    settings: buildSettingsExport().settings,
  });

  const ensureFavoriteDirectory = async () => {
    if (favoriteDirectoryHandle) {
      return favoriteDirectoryHandle;
    }
    if (!("showDirectoryPicker" in window)) {
      return null;
    }
    const pickedDirectory = await window.showDirectoryPicker({
      id: "physarum-favorites",
      mode: "readwrite",
    });
    if (pickedDirectory.name === FAVORITES_FOLDER_NAME) {
      favoriteDirectoryHandle = pickedDirectory;
      return favoriteDirectoryHandle;
    }
    favoriteDirectoryHandle = await pickedDirectory.getDirectoryHandle(
      FAVORITES_FOLDER_NAME,
      { create: true }
    );
    return favoriteDirectoryHandle;
  };

  const saveFavoriteToFolder = async () => {
    const payload = buildFavoriteExport();
    if (!("showDirectoryPicker" in window)) {
      downloadJson(payload, `physarum_favorite_${Date.now()}.json`);
      flashStatus("Browser doesn't support folder save. Downloaded JSON.");
      return;
    }
    try {
      const directoryHandle = await ensureFavoriteDirectory();
      if (!directoryHandle) {
        return;
      }
      const filename = `physarum_favorite_${Date.now()}.json`;
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();
      try {
        await updateFavoritesIndex(directoryHandle);
      } catch (error) {
        console.warn("Failed to update favorites index", error);
      }
      flashStatus("Favorite saved.");
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      console.error(error);
      flashStatus("Failed to save favorite.");
    }
  };

  const applySettingsImport = (settingsData, options = {}) => {
    const { skipReload = false, silent = false } = options;
    if (!settingsData || typeof settingsData !== "object") {
      flashStatus("Invalid settings JSON.");
      return;
    }

    applyPresetSettings(settingsData);

    if (typeof settingsData.primeFieldEnabled === "boolean") {
      state.primeFieldEnabled = settingsData.primeFieldEnabled;
      if (primeMode) {
        primeMode.checked = state.primeFieldEnabled;
      }
    }

    if (Number.isFinite(settingsData.primeFieldSpeed)) {
      const next = clamp(Number(settingsData.primeFieldSpeed), 0, 1);
      state.primeFieldSpeed = next;
      if (primeSpeed) {
        primeSpeed.value = String(next);
      }
    }

    if (Number.isFinite(settingsData.primeFieldStrength)) {
      const min = primeStrength ? Number(primeStrength.min || 0.1) : 0.1;
      const max = primeStrength ? Number(primeStrength.max || 1.2) : 1.2;
      const next = clamp(Number(settingsData.primeFieldStrength), min, max);
      state.primeFieldStrength = next;
      if (primeStrength) {
        primeStrength.value = String(next);
      }
    }

    if (Number.isFinite(settingsData.primeFieldSpread)) {
      const min = primeSpread ? Number(primeSpread.min || 0.2) : 0.2;
      const max = primeSpread ? Number(primeSpread.max || 0.7) : 0.7;
      const next = clamp(Number(settingsData.primeFieldSpread), min, max);
      state.primeFieldSpread = next;
      if (primeSpread) {
        primeSpread.value = String(next);
      }
    }

    updatePrimeUi();

    if (Number.isFinite(settingsData.weaponVolume)) {
      const vol = clamp(settingsData.weaponVolume, 0, 1);
      setMasterVolume(vol);
      if (weaponVolume) {
        weaponVolume.value = String(vol);
      }
      if (weaponVolumeValue) {
        weaponVolumeValue.textContent = `${Math.round(vol * 100)}%`;
      }
    }

    let updatedSelection = false;
    if (Number.isFinite(settingsData.penIndex)) {
      const penIndex = Math.round(
        clamp(Number(settingsData.penIndex), 0, pointsManager.getNumberOfPoints() - 1)
      );
      pointsManager.setSelectedIndex(0, penIndex);
      updatedSelection = true;
    }
    if (Number.isFinite(settingsData.bgIndex)) {
      const bgIndex = Math.round(
        clamp(Number(settingsData.bgIndex), 0, pointsManager.getNumberOfPoints() - 1)
      );
      pointsManager.setSelectedIndex(1, bgIndex);
      updatedSelection = true;
    }
    if (updatedSelection) {
      syncPointSelectors();
      updateAdvancedValues();
    }

    if (typeof updateFlowControlHud === "function") {
      updateFlowControlHud();
    }

    const params = new URLSearchParams(window.location.search);
    let needsReload = false;
    const currentQuality = quality ? quality.value : qualityKey;
    if (typeof settingsData.quality === "string" && QUALITY_PRESETS[settingsData.quality]) {
      if (settingsData.quality !== currentQuality) {
        params.set("quality", settingsData.quality);
        needsReload = true;
      }
    }
    if (Number.isFinite(settingsData.particleDensity)) {
      const density = clamp(Number(settingsData.particleDensity), 0.5, 5.0);
      if (particleDensity) {
        particleDensity.value = String(density);
        if (typeof updateParticleInfo === "function") {
          updateParticleInfo();
        }
      }
      params.set("density", String(density));
      needsReload = true;
    }

    if (needsReload && !skipReload) {
      try {
        window.localStorage?.setItem("physarum:pendingSettings", JSON.stringify(settingsData));
      } catch (error) {
        console.warn("Failed to persist settings for reload", error);
      }
      flashStatus("Settings imported. Reloading...");
      window.location.href = window.location.pathname + "?" + params.toString();
      return;
    }

    if (!silent) {
      flashStatus("Settings imported.");
    }
  };

  if (exportSettings) {
    exportSettings.addEventListener("click", () => {
      downloadJson(buildSettingsExport(), `physarum_settings_${Date.now()}.json`);
      flashStatus("Settings exported.");
    });
  }

  if (favoriteSettings) {
    favoriteSettings.addEventListener("click", () => {
      saveFavoriteToFolder();
    });
  }

  if (importSettings && settingsFile) {
    importSettings.addEventListener("click", () => {
      settingsFile.value = "";
      settingsFile.click();
    });

    settingsFile.addEventListener("change", async () => {
      const file = settingsFile.files && settingsFile.files[0];
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const payload = parsed && typeof parsed === "object" ? parsed : null;
        const settingsData = payload?.settings || payload;
        applySettingsImport(settingsData);
      } catch (error) {
        console.error(error);
        flashStatus("Invalid settings JSON.");
      }
    });
  }

  try {
    const pendingRaw = window.localStorage?.getItem("physarum:pendingSettings");
    if (pendingRaw) {
      window.localStorage?.removeItem("physarum:pendingSettings");
      const pendingSettings = JSON.parse(pendingRaw);
      applySettingsImport(pendingSettings, { skipReload: true, silent: true });
      if (typeof onRestorePending === "function") {
        onRestorePending();
      }
      flashStatus("Settings restored after reload.");
    }
  } catch (error) {
    console.warn("Failed to restore pending settings", error);
  }

  return { applySettingsImport };
}
