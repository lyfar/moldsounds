import { playNextLevel } from "./audio.js";
import { initPresetControls } from "./presetControls.js";
import { initTowerControls } from "./towerControls.js";
import { initInputHandlers } from "./controls/inputHandlers.js";
import { initMobilePanels } from "./controls/mobilePanels.js";
import { initSettingsIO } from "./controls/settingsIO.js";
import { initSimpleMode } from "./controls/simpleMode.js";
import { initUiControls } from "./controls/uiControls.js";
import { initWeaponControls } from "./controls/weaponControls.js";

export function initControls(state, pointsManager, settings, qualityKey) {
  let currentLevel = 1;
  let totalShots = 0;
  const baseL2ActionRef = { value: state.L2Action ?? 0 };

  const levelNumber = document.getElementById("levelNumber");
  const shotCount = document.getElementById("shotCount");
  const quantumShiftBtn = document.getElementById("quantumShift");
  const nextLevelBtn = document.getElementById("nextLevel");

  const ui = {
    penSize: document.getElementById("penSize"),
    penSizeQuick: document.getElementById("penSizeQuick"),
    penSizeQuickValue: document.getElementById("penSizeQuickValue"),
    inertia: document.getElementById("inertia"),
    flowX: document.getElementById("flowX"),
    flowY: document.getElementById("flowY"),
    flowValue: document.getElementById("flowValue"),
    inertiaValue: document.getElementById("inertiaValue"),
    flowXMobile: document.getElementById("flowXMobile"),
    flowYMobile: document.getElementById("flowYMobile"),
    inertiaMobile: document.getElementById("inertiaMobile"),
    flowReset: document.getElementById("flowReset"),
    flowControlHud: document.getElementById("flowControlHud"),
    colorMode: document.getElementById("colorMode"),
    viewToggle: document.getElementById("viewToggle"),
    quality: document.getElementById("quality"),
    showPen: document.getElementById("showPen"),
    depositFactor: document.getElementById("depositFactor"),
    decayFactor: document.getElementById("decayFactor"),
    blurPasses: document.getElementById("blurPasses"),
    drawOpacity: document.getElementById("drawOpacity"),
    fillOpacity: document.getElementById("fillOpacity"),
    dotSize: document.getElementById("dotSize"),
    depositFactorValue: document.getElementById("depositFactorValue"),
    decayFactorValue: document.getElementById("decayFactorValue"),
    blurPassesValue: document.getElementById("blurPassesValue"),
    drawOpacityValue: document.getElementById("drawOpacityValue"),
    fillOpacityValue: document.getElementById("fillOpacityValue"),
    dotSizeValue: document.getElementById("dotSizeValue"),
    particleDensity: document.getElementById("particleDensity"),
    particleDensityValue: document.getElementById("particleDensityValue"),
    particleInfo: document.getElementById("particleInfo"),
    debugToggle: document.getElementById("debugToggle"),
    debugLog: document.getElementById("debugLog"),
    keyboardHint: document.getElementById("keyboardHint"),
    weaponList: document.getElementById("weaponList"),
    actionList: document.getElementById("actionList"),
    weaponStatus: document.getElementById("weaponStatus"),
    soundToggle: document.getElementById("soundToggle"),
    soundFrequency: document.getElementById("soundFrequency"),
    soundStrength: document.getElementById("soundStrength"),
    soundFrequencyValue: document.getElementById("soundFrequencyValue"),
    soundStrengthValue: document.getElementById("soundStrengthValue"),
    soundWaveMode: document.getElementById("soundWaveMode"),
    weaponVolume: document.getElementById("weaponVolume"),
    weaponVolumeValue: document.getElementById("weaponVolumeValue"),
    primeMode: document.getElementById("primeMode"),
    primeSpeed: document.getElementById("primeSpeed"),
    primeSpeedValue: document.getElementById("primeSpeedValue"),
    primeStrength: document.getElementById("primeStrength"),
    primeStrengthValue: document.getElementById("primeStrengthValue"),
    primeSpread: document.getElementById("primeSpread"),
    primeSpreadValue: document.getElementById("primeSpreadValue"),
    exportSettings: document.getElementById("exportSettings"),
    importSettings: document.getElementById("importSettings"),
    settingsFile: document.getElementById("settingsFile"),
    favoriteSettings: document.getElementById("favoriteSettings"),
    mobileToggleTowers: document.getElementById("mobileToggleTowers"),
    mobileToggleSettings: document.getElementById("mobileToggleSettings"),
    mobileBackdrop: document.getElementById("mobileBackdrop"),
    placeTowerBtn: document.getElementById("placeTowerBtn"),
    randomize: document.getElementById("randomize"),
    swap: document.getElementById("swap"),
    spawnBurst: document.getElementById("spawnBurst"),
    spawnRing: document.getElementById("spawnRing"),
    wave: document.getElementById("wave"),
    nextColor: document.getElementById("nextColor"),
    saveImage: document.getElementById("saveImage"),
    randomParams: document.getElementById("randomParams"),
    annihilatorPanel: document.getElementById("annihilatorPanel"),
    annihilatorButton: document.getElementById("annihilatorButton"),
    annihilatorStatus: document.getElementById("annihilatorStatus"),
  };

  const presetUi = {
    penSelect: document.getElementById("penPoint"),
    bgSelect: document.getElementById("bgPoint"),
    exportPreset: document.getElementById("exportPreset"),
    importPreset: document.getElementById("importPreset"),
    presetFile: document.getElementById("presetFile"),
    presetLibrary: document.getElementById("presetLibrary"),
    presetInfo: document.getElementById("presetInfo"),
    presetApplyTarget: document.getElementById("presetApplyTarget"),
    applyPresetBtn: document.getElementById("applyPresetBtn"),
    editTarget: document.getElementById("editTarget"),
    editPointLabel: document.getElementById("editPointLabel"),
    paramList: document.getElementById("paramList"),
    resetCurrent: document.getElementById("resetCurrent"),
    resetAll: document.getElementById("resetAll"),
    penSize: ui.penSize,
    penSizeQuick: ui.penSizeQuick,
    penSizeQuickValue: ui.penSizeQuickValue,
    inertia: ui.inertia,
    flowX: ui.flowX,
    flowY: ui.flowY,
    colorMode: ui.colorMode,
    showPen: ui.showPen,
    depositFactor: ui.depositFactor,
    decayFactor: ui.decayFactor,
    blurPasses: ui.blurPasses,
    drawOpacity: ui.drawOpacity,
    fillOpacity: ui.fillOpacity,
    dotSize: ui.dotSize,
  };

  const updateGameHUD = () => {
    if (levelNumber) levelNumber.textContent = currentLevel;
    if (shotCount) shotCount.textContent = totalShots;
  };

  const incrementShots = () => {
    totalShots += 1;
    updateGameHUD();
  };

  const incrementLevel = () => {
    currentLevel += 1;
    updateGameHUD();
  };

  const VIEW_STORAGE_KEY = "physarum:viewMode";
  const applyViewMode = (mode, persist = false) => {
    const isExpert = mode === "expert";
    document.body.classList.toggle("view-expert", isExpert);
    if (ui.viewToggle) {
      ui.viewToggle.textContent = isExpert ? "Expert" : "Simple";
      ui.viewToggle.setAttribute("aria-pressed", String(isExpert));
    }
    if (!isExpert) {
      document.body.classList.remove("mobile-show-towers", "mobile-show-settings", "mobile-panel-open");
    }
    if (persist) {
      try {
        window.localStorage?.setItem(VIEW_STORAGE_KEY, isExpert ? "expert" : "simple");
      } catch (error) {
        console.warn("Failed to persist view mode", error);
      }
    }
  };

  const isSimpleMode = () => !document.body.classList.contains("view-expert");

  try {
    const storedView = window.localStorage?.getItem(VIEW_STORAGE_KEY);
    applyViewMode(storedView === "expert" ? "expert" : "simple");
  } catch (error) {
    applyViewMode("simple");
  }

  const flashStatus = (() => {
    let timer = null;
    return (message) => {
      if (!ui.weaponStatus) {
        console.info(message);
        return;
      }
      const previous = ui.weaponStatus.textContent;
      ui.weaponStatus.textContent = message;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        if (ui.weaponStatus.textContent === message) {
          ui.weaponStatus.textContent = previous;
        }
      }, 2000);
    };
  })();

  let actionButtons = [];
  const onSoundToggle = (enabled) => {
    actionButtons.forEach((button) => {
      if (button.dataset.actionId === "sound") {
        button.classList.toggle("action--active", enabled);
      }
    });
  };

  const {
    updateRenderValues,
    updateFlowControlHud,
    updatePrimeUi,
    updateSoundUi,
    setSoundEnabled,
    applyPenSizeDelta,
    syncPenSizeInputs,
    updateParticleInfo,
  } = initUiControls({
    state,
    settings,
    ui,
    qualityKey,
    onInertiaChange: (value) => {
      baseL2ActionRef.value = value;
    },
    onSoundToggle,
  });

  const {
    updateAdvancedValues,
    syncPointSelectors,
    applyPresetSettings,
    applyPresetPayload,
  } = initPresetControls({
    state,
    pointsManager,
    settings,
    ui: presetUi,
    updateRenderValues,
    updateFlowControlHud,
    onInertiaChange: (value) => {
      baseL2ActionRef.value = value;
    },
    flashStatus,
  });

  const getCurrentPointValues = () => pointsManager.currentPointValues[0];

  const simpleMode = initSimpleMode({
    state,
    pointsManager,
    isSimpleMode,
    updateGameHUD,
    incrementLevel,
    updateAdvancedValues,
    applyPresetPayload,
    applyPresetSettings,
    updateFlowControlHud,
    syncPointSelectors,
    getCurrentPointValues,
    playNextLevel,
  });

  const weapons = initWeaponControls({
    state,
    settings,
    pointsManager,
    ui: {
      weaponList: ui.weaponList,
      actionList: ui.actionList,
      weaponStatus: ui.weaponStatus,
      randomParams: ui.randomParams,
      randomize: ui.randomize,
      swap: ui.swap,
      spawnBurst: ui.spawnBurst,
      spawnRing: ui.spawnRing,
      wave: ui.wave,
      nextColor: ui.nextColor,
      saveImage: ui.saveImage,
      colorMode: ui.colorMode,
      quantumShiftBtn,
      nextLevelBtn,
    },
    isSimpleMode,
    incrementShots,
    incrementLevel,
    updateAdvancedValues,
    syncPointSelectors,
    applySimpleTowerDamage: simpleMode.applySimpleTowerDamage,
    setSoundEnabled,
  });

  actionButtons = weapons.actionButtons;
  updateSoundUi();
  setSoundEnabled(state.soundEnabled, { silent: true });

  initSettingsIO({
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
    onRestorePending: () => {
      simpleMode.markSkipInitialSimplePresets();
    },
  });

  if (ui.viewToggle) {
    ui.viewToggle.addEventListener("click", () => {
      const isExpert = document.body.classList.contains("view-expert");
      const nextMode = isExpert ? "simple" : "expert";
      applyViewMode(nextMode, true);
      if (nextMode === "simple") {
        simpleMode.maybeStartSimplePresets(true);
      }
    });
  }

  simpleMode.maybeStartSimplePresets();

  if (ui.annihilatorButton) {
    ui.annihilatorButton.addEventListener("click", () => {
      setSoundEnabled(!state.soundEnabled);
    });
  }

  initTowerControls(state);

  initInputHandlers({
    state,
    ui: {
      penSize: ui.penSize,
      flowX: ui.flowX,
      flowY: ui.flowY,
      inertia: ui.inertia,
      flowXMobile: ui.flowXMobile,
      flowYMobile: ui.flowYMobile,
      inertiaMobile: ui.inertiaMobile,
      placeTowerBtn: ui.placeTowerBtn,
      showPen: ui.showPen,
    },
    isSimpleMode,
    setWeaponIndex: weapons.setWeaponIndex,
    runNextLevel: weapons.runNextLevel,
    applyPenSizeDelta,
    updateFlowControlHud,
    baseL2ActionRef,
  });

  initMobilePanels({
    ui: {
      mobileToggleTowers: ui.mobileToggleTowers,
      mobileToggleSettings: ui.mobileToggleSettings,
      mobileBackdrop: ui.mobileBackdrop,
    },
  });

  if (ui.keyboardHint) {
    ui.keyboardHint.textContent = "";
  }

  updateGameHUD();
}
