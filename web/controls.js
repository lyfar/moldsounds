import {
  COLOR_MODES,
  QUALITY_PRESETS,
  WEAPON_MODES,
  SOUND_WAVE_MODES,
  TOWER_SETTINGS,
} from "./config.js";
import { clamp, lerp, setRandomSpawn, setVortexSpawn, setPulseSpawn } from "./utils.js";
import { initTowerControls } from "./towerControls.js";
import { initPresetControls } from "./presetControls.js";
import {
  playWeaponSound,
  playQuantumShift,
  playNextLevel,
  playSoundToggle,
  playWeaponSelect,
  setMasterVolume
} from "./audio.js";

export function initControls(state, pointsManager, settings, qualityKey) {
  // Game state
  let currentLevel = 1;
  let totalShots = 0;
  let baseL2Action = state.L2Action ?? 0;
  
  // DOM Elements - Game HUD
  const levelNumber = document.getElementById("levelNumber");
  const shotCount = document.getElementById("shotCount");
  const quantumShiftBtn = document.getElementById("quantumShift");
  const nextLevelBtn = document.getElementById("nextLevel");
  
  // DOM Elements - Settings
  const penSize = document.getElementById("penSize");
  const penSizeQuick = document.getElementById("penSizeQuick");
  const penSizeQuickValue = document.getElementById("penSizeQuickValue");
  const inertia = document.getElementById("inertia");
  const flowX = document.getElementById("flowX");
  const flowY = document.getElementById("flowY");
  const flowValue = document.getElementById("flowValue");
  const inertiaValue = document.getElementById("inertiaValue");
  const flowXMobile = document.getElementById("flowXMobile");
  const flowYMobile = document.getElementById("flowYMobile");
  const inertiaMobile = document.getElementById("inertiaMobile");
  const flowReset = document.getElementById("flowReset");
  const colorMode = document.getElementById("colorMode");
  const viewToggle = document.getElementById("viewToggle");
  const quality = document.getElementById("quality");
  const showPen = document.getElementById("showPen");
  const depositFactor = document.getElementById("depositFactor");
  const decayFactor = document.getElementById("decayFactor");
  const blurPasses = document.getElementById("blurPasses");
  const drawOpacity = document.getElementById("drawOpacity");
  const fillOpacity = document.getElementById("fillOpacity");
  const dotSize = document.getElementById("dotSize");
  const depositFactorValue = document.getElementById("depositFactorValue");
  const decayFactorValue = document.getElementById("decayFactorValue");
  const blurPassesValue = document.getElementById("blurPassesValue");
  const drawOpacityValue = document.getElementById("drawOpacityValue");
  const fillOpacityValue = document.getElementById("fillOpacityValue");
  const dotSizeValue = document.getElementById("dotSizeValue");
  const debugToggle = document.getElementById("debugToggle");
  const debugLog = document.getElementById("debugLog");
  const keyboardHint = document.getElementById("keyboardHint");
  const weaponList = document.getElementById("weaponList");
  const actionList = document.getElementById("actionList");
  const weaponStatus = document.getElementById("weaponStatus");
  const soundToggle = document.getElementById("soundToggle");
  const soundFrequency = document.getElementById("soundFrequency");
  const soundStrength = document.getElementById("soundStrength");
  const soundFrequencyValue = document.getElementById("soundFrequencyValue");
  const soundStrengthValue = document.getElementById("soundStrengthValue");
  const soundWaveMode = document.getElementById("soundWaveMode");
  const weaponVolume = document.getElementById("weaponVolume");
  const weaponVolumeValue = document.getElementById("weaponVolumeValue");
  const primeMode = document.getElementById("primeMode");
  const primeSpeed = document.getElementById("primeSpeed");
  const primeSpeedValue = document.getElementById("primeSpeedValue");
  const primeStrength = document.getElementById("primeStrength");
  const primeStrengthValue = document.getElementById("primeStrengthValue");
  const primeSpread = document.getElementById("primeSpread");
  const primeSpreadValue = document.getElementById("primeSpreadValue");
  const exportSettings = document.getElementById("exportSettings");
  const importSettings = document.getElementById("importSettings");
  const settingsFile = document.getElementById("settingsFile");

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
  };

  const mobileToggleTowers = document.getElementById("mobileToggleTowers");
  const mobileToggleSettings = document.getElementById("mobileToggleSettings");
  const mobileBackdrop = document.getElementById("mobileBackdrop");
  const placeTowerBtn = document.getElementById("placeTowerBtn");
  
  // Annihilator panel elements (legacy)
  const annihilatorPanel = document.getElementById("annihilatorPanel");
  const annihilatorButton = document.getElementById("annihilatorButton");
  const annihilatorStatus = document.getElementById("annihilatorStatus");

  const randomize = document.getElementById("randomize");
  const swap = document.getElementById("swap");
  const spawnBurst = document.getElementById("spawnBurst");
  const spawnRing = document.getElementById("spawnRing");
  const wave = document.getElementById("wave");
  const nextColor = document.getElementById("nextColor");
  const saveImage = document.getElementById("saveImage");
  
  // Update game HUD
  const updateGameHUD = () => {
    if (levelNumber) levelNumber.textContent = currentLevel;
    if (shotCount) shotCount.textContent = totalShots;
  };
  
  const incrementShots = () => {
    totalShots++;
    updateGameHUD();
  };
  const randomParams = document.getElementById("randomParams");

  const VIEW_STORAGE_KEY = "physarum:viewMode";
  const applyViewMode = (mode, persist = false) => {
    const isExpert = mode === "expert";
    document.body.classList.toggle("view-expert", isExpert);
    if (viewToggle) {
      viewToggle.textContent = isExpert ? "Expert" : "Simple";
      viewToggle.setAttribute("aria-pressed", String(isExpert));
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

  if (viewToggle) {
    viewToggle.addEventListener("click", () => {
      const isExpert = document.body.classList.contains("view-expert");
      applyViewMode(isExpert ? "simple" : "expert", true);
    });
  }

  const SIMPLE_TOWER_RULES = {
    health: Number(TOWER_SETTINGS.defaultHealth ?? 100),
    radiusMin: 0.4,
    radiusMax: 0.5,
    frequencyMin: 180,
    frequencyMax: 520,
    strengthMin: 0.15,
    strengthMax: 0.35,
  };

  const SIMPLE_WEAPON_DAMAGE = [14, 12, 10, 16, 18];

  const getSimpleTowerTarget = () => {
    if (!state.towers.length) {
      return null;
    }
    const defaultTower = state.towers.find((tower) => tower?.isDefaultTrack);
    return defaultTower || state.towers[0];
  };

  const ensureTowerHealth = (tower) => {
    const maxHealth = Number.isFinite(tower.maxHealth)
      ? tower.maxHealth
      : SIMPLE_TOWER_RULES.health;
    if (!Number.isFinite(tower.maxHealth)) {
      tower.maxHealth = maxHealth;
    }
    if (!Number.isFinite(tower.health)) {
      tower.health = maxHealth;
    }
  };

  const applyTowerStats = (tower, stats) => {
    tower.radius = stats.radius;
    tower.frequency = stats.frequency;
    tower.strength = stats.strength;
    tower.pattern = stats.pattern;
    if (tower.audio) {
      tower.baseRadius = stats.radius;
      tower.baseStrength = stats.strength;
    }
  };

  const rerollSimpleTower = (tower) => {
    const radiusRaw =
      SIMPLE_TOWER_RULES.radiusMin +
      Math.random() * (SIMPLE_TOWER_RULES.radiusMax - SIMPLE_TOWER_RULES.radiusMin);
    const radius = clamp(
      radiusRaw,
      TOWER_SETTINGS.minRadius,
      TOWER_SETTINGS.maxRadius
    );
    const frequency = Math.round(
      SIMPLE_TOWER_RULES.frequencyMin +
        Math.random() * (SIMPLE_TOWER_RULES.frequencyMax - SIMPLE_TOWER_RULES.frequencyMin)
    );
    const strength = Number(
      (
        SIMPLE_TOWER_RULES.strengthMin +
        Math.random() * (SIMPLE_TOWER_RULES.strengthMax - SIMPLE_TOWER_RULES.strengthMin)
      ).toFixed(2)
    );
    const pattern =
      SOUND_WAVE_MODES.length > 0
        ? Math.floor(Math.random() * SOUND_WAVE_MODES.length)
        : 0;
    applyTowerStats(tower, { radius, frequency, strength, pattern });
  };

  const advanceSimpleTowerLevel = (tower) => {
    rerollSimpleTower(tower);
    tower.health = tower.maxHealth;
    currentLevel += 1;
    updateGameHUD();
    pointsManager.createRandomParameters();
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
    playNextLevel(getCurrentPointValues());
  };

  const applySimpleTowerDamage = (weaponIndex) => {
    if (!isSimpleMode()) {
      return;
    }
    const tower = getSimpleTowerTarget();
    if (!tower) {
      return;
    }
    ensureTowerHealth(tower);
    const damage = SIMPLE_WEAPON_DAMAGE[weaponIndex] ?? 12;
    tower.health = Math.max(0, tower.health - damage);
    if (tower.health <= 0) {
      advanceSimpleTowerLevel(tower);
    }
  };

  const updatePenQuickLabel = (value) => {
    if (penSizeQuickValue) {
      penSizeQuickValue.textContent = value.toFixed(2);
    }
  };

  const syncPenSizeInputs = (value) => {
    if (penSize) {
      penSize.value = String(value);
    }
    if (penSizeQuick) {
      penSizeQuick.value = String(value);
    }
    updatePenQuickLabel(value);
  };

  penSize.min = String(settings.penSizeMin);
  penSize.max = String(settings.penSizeMax);
  penSize.value = String(state.targetActionAreaSizeSigma);
  if (penSizeQuick) {
    penSizeQuick.min = penSize.min;
    penSizeQuick.max = penSize.max;
    penSizeQuick.step = penSize.step;
    penSizeQuick.value = String(state.targetActionAreaSizeSigma);
  }
  updatePenQuickLabel(state.targetActionAreaSizeSigma);
  penSize.addEventListener("input", () => {
    const next = Number(penSize.value);
    state.targetActionAreaSizeSigma = next;
    state.latestSigmaChangeTime = state.time;
    syncPenSizeInputs(next);
  });
  if (penSizeQuick) {
    penSizeQuick.addEventListener("input", () => {
      const next = Number(penSizeQuick.value);
      state.targetActionAreaSizeSigma = next;
      state.latestSigmaChangeTime = state.time;
      syncPenSizeInputs(next);
    });
  }

  inertia.value = String(state.L2Action);
  inertia.addEventListener("input", () => {
    state.L2Action = Number(inertia.value);
    baseL2Action = state.L2Action;
  });

  flowX.value = String(state.moveBiasActionX);
  flowY.value = String(state.moveBiasActionY);
  flowX.addEventListener("input", () => {
    state.moveBiasActionX = Number(flowX.value);
  });
  flowY.addEventListener("input", () => {
    state.moveBiasActionY = Number(flowY.value);
  });

  if (flowXMobile) {
    flowXMobile.value = String(state.moveBiasActionX);
    flowXMobile.addEventListener("input", () => {
      state.moveBiasActionX = Number(flowXMobile.value);
      if (flowX) flowX.value = String(state.moveBiasActionX);
      updateFlowControlHud();
    });
  }

  if (flowYMobile) {
    flowYMobile.value = String(state.moveBiasActionY);
    flowYMobile.addEventListener("input", () => {
      state.moveBiasActionY = Number(flowYMobile.value);
      if (flowY) flowY.value = String(state.moveBiasActionY);
      updateFlowControlHud();
    });
  }

  if (inertiaMobile) {
    inertiaMobile.value = String(state.L2Action ?? 0);
    inertiaMobile.addEventListener("input", () => {
      state.L2Action = Number(inertiaMobile.value);
      baseL2Action = state.L2Action;
      if (inertia) inertia.value = String(state.L2Action);
      updateFlowControlHud();
    });
  }

  if (flowReset) {
    flowReset.addEventListener("click", () => {
      state.moveBiasActionX = 0;
      state.moveBiasActionY = 0;
      if (flowX) flowX.value = "0";
      if (flowY) flowY.value = "0";
      if (flowXMobile) flowXMobile.value = "0";
      if (flowYMobile) flowYMobile.value = "0";
      updateFlowControlHud();
    });
  }

  colorMode.innerHTML = "";
  for (const mode of COLOR_MODES) {
    const option = document.createElement("option");
    option.value = String(mode.id);
    option.textContent = mode.label;
    colorMode.appendChild(option);
  }
  colorMode.value = String(state.colorModeType);
  colorMode.addEventListener("change", () => {
    state.colorModeType = Number(colorMode.value);
  });

  quality.innerHTML = "";
  for (const [key, preset] of Object.entries(QUALITY_PRESETS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = preset.label;
    quality.appendChild(option);
  }
  quality.value = qualityKey;
  quality.addEventListener("change", () => {
    const params = new URLSearchParams(window.location.search);
    params.set("quality", quality.value);
    window.location.search = params.toString();
  });

  // Particle density control
  const particleDensity = document.getElementById("particleDensity");
  const particleDensityValue = document.getElementById("particleDensityValue");
  const particleInfo = document.getElementById("particleInfo");
  
  const updateParticleInfo = () => {
    const preset = QUALITY_PRESETS[qualityKey];
    const density = particleDensity ? Number(particleDensity.value) : preset.particleDensity;
    const count = Math.floor(preset.simWidth * preset.simHeight * density);
    let formatted;
    if (count >= 1000000) {
      formatted = `${(count / 1000000).toFixed(1)}M`;
    } else {
      formatted = `${Math.floor(count / 1000)}K`;
    }
    if (particleDensityValue) {
      particleDensityValue.textContent = `${density.toFixed(1)}x`;
    }
    if (particleInfo) {
      particleInfo.textContent = `~${formatted} particles (reload to apply)`;
    }
  };
  
  if (particleDensity) {
    // Read current density from URL or use preset default
    const urlParams = new URLSearchParams(window.location.search);
    const densityFromUrl = urlParams.get("density");
    const preset = QUALITY_PRESETS[qualityKey];
    const currentDensity = densityFromUrl ? parseFloat(densityFromUrl) : preset.particleDensity;
    particleDensity.value = String(currentDensity);
    updateParticleInfo();
    particleDensity.addEventListener("input", () => {
      updateParticleInfo();
    });
    particleDensity.addEventListener("change", () => {
      const params = new URLSearchParams(window.location.search);
      params.set("density", particleDensity.value);
      // Force reload
      window.location.href = window.location.pathname + "?" + params.toString();
    });
  }

  const updateRenderValues = () => {
    if (depositFactorValue) {
      depositFactorValue.textContent = Number(settings.depositFactor).toFixed(3);
    }
    if (decayFactorValue) {
      decayFactorValue.textContent = Number(settings.decayFactor).toFixed(3);
    }
    if (blurPassesValue) {
      blurPassesValue.textContent = String(Math.round(settings.blurPasses ?? 1));
    }
    if (drawOpacityValue) {
      drawOpacityValue.textContent = Number(settings.drawOpacity ?? 1).toFixed(3);
    }
    if (fillOpacityValue) {
      fillOpacityValue.textContent = Number(settings.fillOpacity ?? 0).toFixed(3);
    }
    if (dotSizeValue) {
      dotSizeValue.textContent = Number(settings.dotSize ?? 10).toFixed(1);
    }
  };

  if (depositFactor) {
    depositFactor.min = "0";
    depositFactor.max = "1";
    depositFactor.step = "0.001";
    depositFactor.value = String(settings.depositFactor);
    depositFactor.addEventListener("input", () => {
      settings.depositFactor = Number(depositFactor.value);
      updateRenderValues();
    });
  }

  if (decayFactor) {
    decayFactor.min = "0";
    decayFactor.max = "1";
    decayFactor.step = "0.001";
    decayFactor.value = String(settings.decayFactor);
    decayFactor.addEventListener("input", () => {
      settings.decayFactor = Number(decayFactor.value);
      updateRenderValues();
    });
  }

  if (blurPasses) {
    blurPasses.min = "0";
    blurPasses.max = "20";
    blurPasses.step = "1";
    blurPasses.value = String(settings.blurPasses ?? 1);
    blurPasses.addEventListener("input", () => {
      settings.blurPasses = Math.max(0, Math.round(Number(blurPasses.value)));
      updateRenderValues();
    });
  }

  if (drawOpacity) {
    drawOpacity.min = "0";
    drawOpacity.max = "1";
    drawOpacity.step = "0.001";
    drawOpacity.value = String(settings.drawOpacity ?? 1);
    drawOpacity.addEventListener("input", () => {
      settings.drawOpacity = Number(drawOpacity.value);
      updateRenderValues();
    });
  }

  if (fillOpacity) {
    fillOpacity.min = "0";
    fillOpacity.max = "1";
    fillOpacity.step = "0.001";
    fillOpacity.value = String(settings.fillOpacity ?? 0);
    fillOpacity.addEventListener("input", () => {
      settings.fillOpacity = Number(fillOpacity.value);
      updateRenderValues();
    });
  }

  if (dotSize) {
    dotSize.min = "0";
    dotSize.max = "50";
    dotSize.step = "0.1";
    dotSize.value = String(settings.dotSize ?? 10);
    dotSize.addEventListener("input", () => {
      settings.dotSize = Number(dotSize.value);
      updateRenderValues();
    });
  }

  updateRenderValues();

  showPen.checked = state.displayPen;
  showPen.addEventListener("change", () => {
    state.displayPen = showPen.checked;
  });

  if (primeMode) {
    primeMode.checked = state.primeFieldEnabled;
    primeMode.addEventListener("change", () => {
      state.primeFieldEnabled = primeMode.checked;
      updatePrimeUi();
    });
  }

  if (primeSpeed) {
    primeSpeed.value = String(state.primeFieldSpeed);
    primeSpeed.addEventListener("input", () => {
      state.primeFieldSpeed = clamp(Number(primeSpeed.value), 0, 1);
      updatePrimeUi();
    });
  }

  if (primeStrength) {
    primeStrength.value = String(state.primeFieldStrength);
    primeStrength.addEventListener("input", () => {
      const min = Number(primeStrength.min || 0.1);
      const max = Number(primeStrength.max || 1.2);
      state.primeFieldStrength = clamp(Number(primeStrength.value), min, max);
      updatePrimeUi();
    });
  }

  if (primeSpread) {
    primeSpread.value = String(state.primeFieldSpread);
    primeSpread.addEventListener("input", () => {
      const min = Number(primeSpread.min || 0.2);
      const max = Number(primeSpread.max || 0.7);
      state.primeFieldSpread = clamp(Number(primeSpread.value), min, max);
      updatePrimeUi();
    });
  }

  if (soundFrequency) {
    soundFrequency.min = "20";
    soundFrequency.max = "2000";
    soundFrequency.step = "1";
    soundFrequency.value = String(state.soundFrequency);
    soundFrequency.addEventListener("input", () => {
      state.soundFrequency = Number(soundFrequency.value);
      if (osc && audioCtx) {
        osc.frequency.setTargetAtTime(state.soundFrequency, audioCtx.currentTime, 0.05);
      }
      updateSoundUi();
    });
  }

  if (soundStrength) {
    soundStrength.min = "0";
    soundStrength.max = "1";
    soundStrength.step = "0.01";
    soundStrength.value = String(state.soundStrength);
    soundStrength.addEventListener("input", () => {
      state.soundStrength = Number(soundStrength.value);
      updateSoundUi();
    });
  }

  if (soundWaveMode) {
    soundWaveMode.innerHTML = "";
    for (const mode of SOUND_WAVE_MODES) {
      const option = document.createElement("option");
      option.value = String(mode.id);
      option.textContent = mode.label;
      option.title = mode.description;
      soundWaveMode.appendChild(option);
    }
    soundWaveMode.value = String(state.soundWaveMode);
    soundWaveMode.addEventListener("change", () => {
      state.soundWaveMode = Number(soundWaveMode.value);
    });
  }

  // Initialize weapon sound volume
  const initialVolume = settings.weaponSoundVolume || 0.5;
  setMasterVolume(initialVolume);
  
  if (weaponVolume) {
    weaponVolume.value = String(initialVolume);
    if (weaponVolumeValue) {
      weaponVolumeValue.textContent = `${Math.round(initialVolume * 100)}%`;
    }
    weaponVolume.addEventListener("input", () => {
      const vol = Number(weaponVolume.value);
      setMasterVolume(vol);
      if (weaponVolumeValue) {
        weaponVolumeValue.textContent = `${Math.round(vol * 100)}%`;
      }
    });
  }

  if (soundToggle) {
    soundToggle.checked = state.soundEnabled;
    soundToggle.addEventListener("change", () => {
      setSoundEnabled(soundToggle.checked);
    });
  }

  let audioCtx = null;
  let osc = null;
  let gain = null;

  const ensureAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      osc = audioCtx.createOscillator();
      gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(state.soundFrequency, audioCtx.currentTime);
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  };

  const updateSoundUi = () => {
    if (soundToggle) {
      soundToggle.checked = state.soundEnabled;
    }
    if (soundFrequencyValue) {
      soundFrequencyValue.textContent = `${Math.round(state.soundFrequency)} Hz`;
    }
    if (soundStrengthValue) {
      soundStrengthValue.textContent = state.soundStrength.toFixed(2);
    }
  };

  const updatePrimeUi = () => {
    const enabled = state.primeFieldEnabled;
    if (primeMode) {
      primeMode.checked = enabled;
    }
    if (primeSpeedValue) {
      primeSpeedValue.textContent = `${state.primeFieldSpeed.toFixed(2)}x`;
    }
    if (primeStrengthValue) {
      primeStrengthValue.textContent = state.primeFieldStrength.toFixed(2);
    }
    if (primeSpreadValue) {
      primeSpreadValue.textContent = state.primeFieldSpread.toFixed(2);
    }
    if (primeSpeed) {
      primeSpeed.disabled = !enabled;
    }
    if (primeStrength) {
      primeStrength.disabled = !enabled;
    }
    if (primeSpread) {
      primeSpread.disabled = !enabled;
    }
  };

  updatePrimeUi();

  const setSoundEnabled = (enabled) => {
    state.soundEnabled = enabled;
    // Play feedback sound
    playSoundToggle(enabled);
    if (enabled) {
      ensureAudio();
      if (gain && audioCtx) {
        gain.gain.setTargetAtTime(0.06, audioCtx.currentTime, 0.08);
      }
    } else if (gain && audioCtx) {
      gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
    }
    updateSoundUi();
    // Update annihilator panel UI
    if (annihilatorPanel) {
      annihilatorPanel.classList.toggle("annihilator-panel--active", enabled);
    }
    if (annihilatorStatus) {
      annihilatorStatus.textContent = enabled ? "ON" : "OFF";
    }
    if (soundToggle) {
      soundToggle.checked = enabled;
    }
    actionButtons.forEach((button) => {
      if (button.dataset.actionId === "sound") {
        button.classList.toggle("action--active", state.soundEnabled);
      }
    });
  };

  if (debugToggle && debugLog) {
    debugToggle.checked = state.debug.enabled;
    debugToggle.addEventListener("change", () => {
      state.debug.enabled = debugToggle.checked;
      debugLog.textContent = state.debug.enabled ? "Debug enabled." : "Debug disabled.";
    });
  }

  const weaponButtons = [];
  const actionButtons = [];

  const saveSnapshot = () => {
    const link = document.createElement("a");
    link.download = `physarum_${Date.now()}.png`;
    link.href = state.canvas.toDataURL("image/png");
    link.click();
  };

  const flashStatus = (() => {
    let timer = null;
    return (message) => {
      if (!weaponStatus) {
        console.info(message);
        return;
      }
      const previous = weaponStatus.textContent;
      weaponStatus.textContent = message;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        if (weaponStatus.textContent === message) {
          weaponStatus.textContent = previous;
        }
      }, 2000);
    };
  })();
  const { updateAdvancedValues, syncPointSelectors, applyPresetSettings } = initPresetControls({
    state,
    pointsManager,
    settings,
    ui: presetUi,
    updateRenderValues,
    updateFlowControlHud,
    onInertiaChange: (value) => {
      baseL2Action = value;
    },
    flashStatus,
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
        updateParticleInfo();
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
        const payload =
          parsed && typeof parsed === "object"
            ? parsed
            : null;
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
      flashStatus("Settings restored after reload.");
    }
  } catch (error) {
    console.warn("Failed to restore pending settings", error);
  }

  // Weapon cooldown tracking
  const weaponCooldowns = WEAPON_MODES.map(() => 0);
  
  const isWeaponReady = (index) => {
    return state.time >= weaponCooldowns[index];
  };
  
  const triggerWeaponCooldown = (index) => {
    const weapon = WEAPON_MODES[index];
    weaponCooldowns[index] = state.time + (weapon.cooldown || 0.3);
    updateWeaponCooldownDisplay();
  };
  
  const updateWeaponCooldownDisplay = () => {
    weaponButtons.forEach((button, index) => {
      const remaining = Math.max(0, weaponCooldowns[index] - state.time);
      if (remaining > 0) {
        button.classList.add("weapon--cooldown");
        button.style.setProperty("--cooldown-progress", `${(remaining / (WEAPON_MODES[index].cooldown || 0.3)) * 100}%`);
      } else {
        button.classList.remove("weapon--cooldown");
        button.style.removeProperty("--cooldown-progress");
      }
    });
  };
  
  // Update cooldowns every frame
  const cooldownInterval = setInterval(() => {
    updateWeaponCooldownDisplay();
  }, 50);
  
  // Helper to get current point values for sound generation
  const getCurrentPointValues = () => {
    return pointsManager.currentPointValues[0];
  };
  
  const weaponActions = [
    () => {
      if (!isWeaponReady(0)) return false;
      state.spawnParticles = 2;
      setRandomSpawn(state, settings);
      triggerWeaponCooldown(0);
      playWeaponSound(0, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(0);
      return true;
    },
    () => {
      if (!isWeaponReady(1)) return false;
      state.spawnParticles = 1;
      triggerWeaponCooldown(1);
      playWeaponSound(1, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(1);
      return true;
    },
    () => {
      if (!isWeaponReady(2)) return false;
      state.triggerWave = true;
      triggerWeaponCooldown(2);
      playWeaponSound(2, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(2);
      return true;
    },
    () => {
      // Chaos Vortex - spiral spawn pattern
      if (!isWeaponReady(3)) return false;
      state.spawnParticles = 2;
      setVortexSpawn(state, settings);
      triggerWeaponCooldown(3);
      playWeaponSound(3, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(3);
      return true;
    },
    () => {
      // Mold Pulse - concentrated burst
      if (!isWeaponReady(4)) return false;
      state.spawnParticles = 2;
      setPulseSpawn(state, settings);
      triggerWeaponCooldown(4);
      playWeaponSound(4, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(4);
      return true;
    },
  ];

  const runRandomPoints = () => {
    pointsManager.useRandomIndices();
    syncPointSelectors();
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
  };

  const runQuantumSwap = () => {
    const oldValues = pointsManager.currentPointValues[0].slice();
    pointsManager.swapUsedPoints();
    syncPointSelectors();
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
    playQuantumShift(oldValues, pointsManager.currentPointValues[0]);
  };

  const runNextLevel = () => {
    if (isSimpleMode()) {
      return;
    }
    currentLevel++;
    updateGameHUD();
    pointsManager.createRandomParameters();
    updateAdvancedValues();
    playNextLevel(getCurrentPointValues());
  };

  const setWeaponIndex = (index) => {
    const clamped = clamp(index, 0, WEAPON_MODES.length - 1);
    if (clamped !== state.weaponIndex) {
      playWeaponSelect(clamped);
    }
    state.weaponIndex = clamped;
    weaponButtons.forEach((button, i) => {
      if (i === clamped) {
        button.classList.add("weapon--active");
      } else {
        button.classList.remove("weapon--active");
      }
    });
    if (weaponStatus) {
      weaponStatus.textContent = `Weapon: ${WEAPON_MODES[clamped].label}`;
    }
  };

  state.weaponActions = weaponActions;

  if (weaponList) {
    weaponList.innerHTML = "";
    WEAPON_MODES.forEach((mode, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `weapon weapon--${mode.id}`;
      button.innerHTML = `
        <span class="weapon__preview" aria-hidden="true">
          <span class="weapon__key">${mode.key}</span>
        </span>
        <span class="weapon__label">${mode.label}</span>
      `;
      button.addEventListener("click", () => {
        setWeaponIndex(index);
        // Fire the weapon on click
        const action = weaponActions[index];
        if (typeof action === "function") {
          action("click");
        }
      });
      weaponList.appendChild(button);
      weaponButtons.push(button);
    });
    setWeaponIndex(state.weaponIndex);
  }

  if (actionList) {
    const actionItems = [
      {
        id: "sound",
        key: "4",
        label: "Sound Wave Annihilator",
        action: () => setSoundEnabled(!state.soundEnabled),
        toggle: true,
      },
      { id: "quantum", key: "Q", label: "Quantum Shift", action: runQuantumSwap },
      { id: "level", key: "Enter", label: "Next level", action: runNextLevel },
    ];

    actionList.innerHTML = "";
    actionItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action";
      button.dataset.actionId = item.id;
      if (item.toggle && state.soundEnabled) {
        button.classList.add("action--active");
      }
      button.innerHTML = `<span class="weapon__key">${item.key}</span><span class="weapon__label">${item.label}</span>`;
      button.addEventListener("click", () => {
        item.action();
      });
      actionList.appendChild(button);
      actionButtons.push(button);
    });
  }

  updateSoundUi();

  if (randomParams) {
    randomParams.addEventListener("click", () => {
      runNextLevel();
    });
  }

  if (randomize) {
    randomize.addEventListener("click", () => {
      runRandomPoints();
    });
  }

  if (swap) {
    swap.addEventListener("click", () => {
      runQuantumSwap();
    });
  }

  if (spawnBurst) {
    spawnBurst.addEventListener("click", () => {
      setWeaponIndex(0);
      weaponActions[0]();
    });
  }

  if (spawnRing) {
    spawnRing.addEventListener("click", () => {
      setWeaponIndex(1);
      weaponActions[1]();
    });
  }

  if (wave) {
    wave.addEventListener("click", () => {
      setWeaponIndex(2);
      weaponActions[2]();
    });
  }

  if (nextColor) {
    nextColor.addEventListener("click", () => {
      state.colorModeType = (state.colorModeType + 1) % settings.numberOfColorModes;
      colorMode.value = String(state.colorModeType);
    });
  }

  if (saveImage) {
    saveImage.addEventListener("click", () => {
      saveSnapshot();
    });
  }

  const editableTags = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
  const isEditableTarget = (target) =>
    target && (editableTags.has(target.tagName) || target.isContentEditable);

  const applyPenSizeDelta = (delta) => {
    const min = Number(penSize.min);
    const max = Number(penSize.max);
    const next = clamp(state.targetActionAreaSizeSigma + delta, min, max);
    state.targetActionAreaSizeSigma = next;
    state.latestSigmaChangeTime = state.time;
    syncPenSizeInputs(next);
  };

  const moveActionBy = (dx, dy) => {
    state.actionX = clamp(state.actionX + dx, 0, state.simWidth);
    state.actionY = clamp(state.actionY + dy, 0, state.simHeight);
    state.mouseXchange = state.actionX / state.simWidth;
    // Direct mapping - no flip
    state.screenY = state.actionY / state.simHeight;
  };

  // Track held keys for continuous parameter changes
  const heldKeys = new Set();
  const flowControlHud = document.getElementById("flowControlHud");
  
  function updateFlowControlHud() {
    if (!flowControlHud) {
      return;
    }
    const flowXVal = state.moveBiasActionX || 0;
    const flowYVal = state.moveBiasActionY || 0;
    const inertiaVal = state.L2Action ?? 0;
    if (flowValue) {
      flowValue.textContent = `X: ${flowXVal > 0 ? "+" : ""}${flowXVal.toFixed(2)} | Y: ${flowYVal > 0 ? "+" : ""}${flowYVal.toFixed(2)}`;
      flowValue.classList.toggle("active", flowXVal !== 0 || flowYVal !== 0);
    }
    if (inertiaValue) {
      inertiaValue.textContent = inertiaVal.toFixed(2);
      inertiaValue.classList.toggle("active", inertiaVal !== 0);
    }
    if (flowXMobile) {
      flowXMobile.value = String(flowXVal);
    }
    if (flowYMobile) {
      flowYMobile.value = String(flowYVal);
    }
    if (inertiaMobile) {
      inertiaMobile.value = String(inertiaVal);
    }
  }

  const applyHeldKeys = () => {
    // Flow X: A = left (-), D = right (+)
    if (heldKeys.has("a")) {
      state.moveBiasActionX = clamp(state.moveBiasActionX - 0.02, -1, 1);
    } else if (heldKeys.has("d")) {
      state.moveBiasActionX = clamp(state.moveBiasActionX + 0.02, -1, 1);
    } else {
      // Return to neutral
      state.moveBiasActionX = lerp(state.moveBiasActionX, 0, 0.1);
      if (Math.abs(state.moveBiasActionX) < 0.01) state.moveBiasActionX = 0;
    }
    
    // Flow Y: W = up (+), S = down (-)
    if (heldKeys.has("w")) {
      state.moveBiasActionY = clamp(state.moveBiasActionY + 0.02, -1, 1);
    } else if (heldKeys.has("s")) {
      state.moveBiasActionY = clamp(state.moveBiasActionY - 0.02, -1, 1);
    } else {
      // Return to neutral
      state.moveBiasActionY = lerp(state.moveBiasActionY, 0, 0.1);
      if (Math.abs(state.moveBiasActionY) < 0.01) state.moveBiasActionY = 0;
    }
    
    // Inertia (L2Action): E = increase, Q = decrease
    if (heldKeys.has("e")) {
      state.L2Action = clamp((state.L2Action ?? baseL2Action) + 0.015, 0, 1);
    } else if (heldKeys.has("q")) {
      state.L2Action = clamp((state.L2Action ?? baseL2Action) - 0.015, 0, 1);
    } else {
      // Return to base
      state.L2Action = lerp(state.L2Action ?? baseL2Action, baseL2Action, 0.05);
      if (Math.abs(state.L2Action - baseL2Action) < 0.01) state.L2Action = baseL2Action;
    }
    
    // Update UI sliders
    if (flowX) flowX.value = String(state.moveBiasActionX);
    if (flowY) flowY.value = String(state.moveBiasActionY);
    if (inertia) inertia.value = String(state.L2Action);
    if (flowXMobile) flowXMobile.value = String(state.moveBiasActionX);
    if (flowYMobile) flowYMobile.value = String(state.moveBiasActionY);
    if (inertiaMobile) inertiaMobile.value = String(state.L2Action);
    
    updateFlowControlHud();
  };
  
  // Run held key logic every frame
  const flowControlLoop = () => {
    applyHeldKeys();
    requestAnimationFrame(flowControlLoop);
  };
  flowControlLoop();

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    const rawKey = event.key;
    const key = rawKey.toLowerCase();
    
    // Track held keys for WASD and QE
    const flowKeys = ["w", "a", "s", "d", "q", "e"];
    if (flowKeys.includes(key)) {
      heldKeys.add(key);
      event.preventDefault();
      return;
    }
    
    // Arrow keys for cursor movement
    const isMoveKey = ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key);
    if (!isMoveKey && event.repeat) {
      return;
    }

    const moveStep = (event.shiftKey ? 0.01 : 0.03) * Math.min(state.simWidth, state.simHeight);
    const penStep = event.shiftKey ? 0.05 : 0.02;
    let handled = true;

    switch (key) {
      case "1":
      case "2":
      case "3":
      case "4":
      case "5": {
        // Weapons 1-5 select and fire
        const index = Number(rawKey) - 1;
        setWeaponIndex(index);
        const action = state.weaponActions[index];
        if (typeof action === "function") {
          action("keyboard");
        }
        break;
      }
      case "6":
        // Key 6 = Toggle tower placement mode
        if (!document.body.classList.contains("view-expert")) {
          break;
        }
        if (state.towers.length < state.maxTowers) {
          state.towerPlacementMode = !state.towerPlacementMode;
          if (placeTowerBtn) {
            placeTowerBtn.classList.toggle("tower-panel__place-btn--active", state.towerPlacementMode);
          }
        }
        break;
      case "arrowup":
        moveActionBy(0, -moveStep);  // Direct: - moves up (towards Y=0)
        break;
      case "arrowdown":
        moveActionBy(0, moveStep);  // Direct: + moves down (towards Y=max)
        break;
      case "arrowleft":
        moveActionBy(-moveStep, 0);
        break;
      case "arrowright":
        moveActionBy(moveStep, 0);
        break;
      case " ":
      case "enter":
        // Space or Enter = Next Level
        if (!isSimpleMode()) {
          runNextLevel();
        } else {
          handled = false;
        }
        break;
      case "p":
        state.displayPen = !state.displayPen;
        if (showPen) showPen.checked = state.displayPen;
        break;
      case "[":
      case "-":
        applyPenSizeDelta(-penStep);
        break;
      case "]":
      case "=":
        applyPenSizeDelta(penStep);
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      event.preventDefault();
    }
  });
  
  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    heldKeys.delete(key);
  });
  
  // Clear held keys on window blur
  window.addEventListener("blur", () => {
    heldKeys.clear();
  });

  if (keyboardHint) {
    keyboardHint.textContent = "";
  }
  
  // New game UI button handlers
  if (quantumShiftBtn) {
    quantumShiftBtn.addEventListener("click", () => {
      runQuantumSwap();
    });
  }
  
  if (nextLevelBtn) {
    nextLevelBtn.addEventListener("click", () => {
      runNextLevel();
    });
  }
  
  // Annihilator panel button handler
  if (annihilatorButton) {
    annihilatorButton.addEventListener("click", () => {
      setSoundEnabled(!state.soundEnabled);
    });
  }
  
  // Initialize annihilator panel state
  if (annihilatorPanel && state.soundEnabled) {
    annihilatorPanel.classList.add("annihilator-panel--active");
  }
  if (annihilatorStatus) {
    annihilatorStatus.textContent = state.soundEnabled ? "ON" : "OFF";
  }

  initTowerControls(state);

  const isMobileLayout = () =>
    window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 700px)").matches;

  const updateMobileToggleState = () => {
    const showTowers = document.body.classList.contains("mobile-show-towers");
    const showSettings = document.body.classList.contains("mobile-show-settings");
    if (mobileToggleTowers) {
      mobileToggleTowers.setAttribute("aria-pressed", String(showTowers));
    }
    if (mobileToggleSettings) {
      mobileToggleSettings.setAttribute("aria-pressed", String(showSettings));
    }
  };

  const closeMobilePanels = () => {
    document.body.classList.remove("mobile-show-towers", "mobile-show-settings", "mobile-panel-open");
    updateMobileToggleState();
  };

  const openMobilePanel = (panel) => {
    if (!isMobileLayout()) {
      return;
    }
    document.body.classList.remove("mobile-show-towers", "mobile-show-settings");
    if (panel === "towers") {
      document.body.classList.add("mobile-show-towers");
    } else if (panel === "settings") {
      document.body.classList.add("mobile-show-settings");
    }
    document.body.classList.add("mobile-panel-open");
    updateMobileToggleState();
  };

  if (mobileToggleTowers) {
    mobileToggleTowers.addEventListener("click", () => {
      const isOpen = document.body.classList.contains("mobile-show-towers");
      if (isOpen) {
        closeMobilePanels();
      } else {
        openMobilePanel("towers");
      }
    });
  }

  if (mobileToggleSettings) {
    mobileToggleSettings.addEventListener("click", () => {
      const isOpen = document.body.classList.contains("mobile-show-settings");
      if (isOpen) {
        closeMobilePanels();
      } else {
        openMobilePanel("settings");
      }
    });
  }

  if (mobileBackdrop) {
    mobileBackdrop.addEventListener("click", () => {
      closeMobilePanels();
    });
  }

  updateMobileToggleState();

  window.addEventListener("resize", () => {
    if (!isMobileLayout()) {
      closeMobilePanels();
    }
  });

  // Initialize game HUD
  updateGameHUD();
}
