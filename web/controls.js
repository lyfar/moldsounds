import { COLOR_MODES, QUALITY_PRESETS, PARAMS_DIMENSION, WEAPON_MODES, SOUND_WAVE_MODES, TOWER_SETTINGS } from "./config.js";
import { clamp, lerp, setRandomSpawn, setVortexSpawn, setPulseSpawn } from "./utils.js";
import { 
  playWeaponSound, 
  playQuantumShift, 
  playNextLevel, 
  playSoundToggle,
  playWeaponSelect,
  setMasterVolume,
  ensureAudioContext 
} from "./audio.js";

export function initControls(state, pointsManager, settings, qualityKey) {
  // Game state
  let currentLevel = 1;
  let totalShots = 0;
  let presetLibraryEntries = [];
  
  // DOM Elements - Game HUD
  const levelNumber = document.getElementById("levelNumber");
  const shotCount = document.getElementById("shotCount");
  const quantumShiftBtn = document.getElementById("quantumShift");
  const nextLevelBtn = document.getElementById("nextLevel");
  
  // DOM Elements - Settings
  const penSelect = document.getElementById("penPoint");
  const bgSelect = document.getElementById("bgPoint");
  const exportPreset = document.getElementById("exportPreset");
  const importPreset = document.getElementById("importPreset");
  const presetFile = document.getElementById("presetFile");
  const penSize = document.getElementById("penSize");
  const inertia = document.getElementById("inertia");
  const flowX = document.getElementById("flowX");
  const flowY = document.getElementById("flowY");
  const colorMode = document.getElementById("colorMode");
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
  const presetLibrary = document.getElementById("presetLibrary");
  const presetInfo = document.getElementById("presetInfo");
  const presetApplyTarget = document.getElementById("presetApplyTarget");
  const applyPresetBtn = document.getElementById("applyPresetBtn");
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
  
  // Annihilator panel elements (legacy)
  const annihilatorPanel = document.getElementById("annihilatorPanel");
  const annihilatorButton = document.getElementById("annihilatorButton");
  const annihilatorStatus = document.getElementById("annihilatorStatus");

  // Tower panel elements
  const towerPanel = document.getElementById("towerPanel");
  const towerCountEl = document.getElementById("towerCount");
  const placeTowerBtn = document.getElementById("placeTowerBtn");
  const towerListEl = document.getElementById("towerList");
  const clearTowersBtn = document.getElementById("clearTowersBtn");
  const newTowerRadius = document.getElementById("newTowerRadius");
  const newTowerFreq = document.getElementById("newTowerFreq");
  const newTowerStrength = document.getElementById("newTowerStrength");
  const newTowerPattern = document.getElementById("newTowerPattern");
  const newTowerRadiusValue = document.getElementById("newTowerRadiusValue");
  const newTowerFreqValue = document.getElementById("newTowerFreqValue");
  const newTowerStrengthValue = document.getElementById("newTowerStrengthValue");
  const newTowerSection = document.getElementById("newTowerSection");
  
  // Edit tower elements
  const editTowerSection = document.getElementById("editTowerSection");
  const editTowerNum = document.getElementById("editTowerNum");
  const editTowerRadius = document.getElementById("editTowerRadius");
  const editTowerFreq = document.getElementById("editTowerFreq");
  const editTowerStrength = document.getElementById("editTowerStrength");
  const editTowerPattern = document.getElementById("editTowerPattern");
  const editTowerRadiusValue = document.getElementById("editTowerRadiusValue");
  const editTowerFreqValue = document.getElementById("editTowerFreqValue");
  const editTowerStrengthValue = document.getElementById("editTowerStrengthValue");

  const editTarget = document.getElementById("editTarget");
  const editPointLabel = document.getElementById("editPointLabel");
  const paramList = document.getElementById("paramList");

  const randomize = document.getElementById("randomize");
  const swap = document.getElementById("swap");
  const spawnBurst = document.getElementById("spawnBurst");
  const spawnRing = document.getElementById("spawnRing");
  const wave = document.getElementById("wave");
  const nextColor = document.getElementById("nextColor");
  const saveImage = document.getElementById("saveImage");
  const resetCurrent = document.getElementById("resetCurrent");
  const resetAll = document.getElementById("resetAll");
  
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

  penSelect.innerHTML = "";
  bgSelect.innerHTML = "";

  for (let i = 0; i < pointsManager.getNumberOfPoints(); i += 1) {
    const label = pointsManager.getPointName(i);
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = label;
    penSelect.appendChild(option.cloneNode(true));
    bgSelect.appendChild(option);
  }

  penSelect.value = String(pointsManager.selectedIndices[0]);
  bgSelect.value = String(pointsManager.selectedIndices[1]);

  penSelect.addEventListener("change", () => {
    pointsManager.setSelectedIndex(0, Number(penSelect.value));
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
  });

  bgSelect.addEventListener("change", () => {
    pointsManager.setSelectedIndex(1, Number(bgSelect.value));
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
  });

  penSize.min = String(settings.penSizeMin);
  penSize.max = String(settings.penSizeMax);
  penSize.value = String(state.targetActionAreaSizeSigma);
  penSize.addEventListener("input", () => {
    state.targetActionAreaSizeSigma = Number(penSize.value);
    state.latestSigmaChangeTime = state.time;
  });

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

  const paramControls = [];
  const weaponButtons = [];
  const actionButtons = [];

  const syncPointSelectors = () => {
    penSelect.value = String(pointsManager.selectedIndices[0]);
    bgSelect.value = String(pointsManager.selectedIndices[1]);
  };

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
    }

    if (Number.isFinite(settingsData.inertia) && inertia) {
      state.L2Action = clamp(settingsData.inertia, 0, 1);
      inertia.value = String(state.L2Action);
      baseL2Action = state.L2Action;
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

    updateRenderValues();
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

  const applyRenderSettingsFromParams = (params) => {
    if (!Array.isArray(params) || params.length < 20) {
      return;
    }
    applyPresetSettings({
      depositFactor: params[14],
      decayFactor: params[15],
      blurPasses: params[16],
      drawOpacity: params[17],
      fillOpacity: params[18],
      dotSize: params[19],
    });
  };

  const applySinglePreset = (payload, targetIndex) => {
    const params = payload?.parameters;
    if (!Array.isArray(params) || params.length < 14) {
      flashStatus("Preset parameters missing or invalid.");
      return false;
    }

    if (!pointsManager.applyPointPreset(targetIndex, params)) {
      flashStatus("Preset parameters could not be applied.");
      return false;
    }

    applyRenderSettingsFromParams(params);
    updateAdvancedValues();
    state.transitionTriggerTime = state.time;
    const targetLabel = targetIndex === 0 ? "Pen" : "Background";
    flashStatus(`Preset applied to ${targetLabel}.`);
    return true;
  };

  function setParamValue(index, value) {
    const control = paramControls[index];
    const min = Number(control.range.min);
    const max = Number(control.range.max);
    const clamped = clamp(value, min, max);
    pointsManager.setValue(index, clamped);
    control.range.value = String(clamped);
    control.number.value = clamped.toFixed(3);
  }

  function updateAdvancedValues() {
    const targetIndex = Number(editTarget.value);
    pointsManager.setCurrentSelectionIndex(targetIndex);
    const pointIndex = pointsManager.selectedIndices[targetIndex];
    const targetLabel = targetIndex === 0 ? "Pen" : "Background";
    editPointLabel.textContent = `Editing ${targetLabel}: ${pointsManager.getPointName(pointIndex)}`;

    for (let i = 0; i < paramControls.length; i += 1) {
      const value = pointsManager.getValue(i);
      paramControls[i].range.value = String(value);
      paramControls[i].number.value = value.toFixed(3);
    }
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
      return true;
    },
    () => {
      if (!isWeaponReady(1)) return false;
      state.spawnParticles = 1;
      triggerWeaponCooldown(1);
      playWeaponSound(1, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      return true;
    },
    () => {
      if (!isWeaponReady(2)) return false;
      state.triggerWave = true;
      triggerWeaponCooldown(2);
      playWeaponSound(2, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
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
      button.className = "weapon";
      button.innerHTML = `<span class="weapon__key">${mode.key}</span><span class="weapon__label">${mode.label}</span>`;
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

  function buildParamControls() {
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
  }

  editTarget.addEventListener("change", () => {
    updateAdvancedValues();
  });

  resetCurrent.addEventListener("click", () => {
    pointsManager.resetCurrentPoint();
    updateAdvancedValues();
  });

  resetAll.addEventListener("click", () => {
    pointsManager.resetAllPoints();
    updateAdvancedValues();
  });

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

  if (exportPreset) {
    exportPreset.addEventListener("click", () => {
      downloadJson(buildPresetExport(), `physarum_preset_${Date.now()}.json`);
      flashStatus("Preset exported.");
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
          flashStatus("Preset JSON missing point data.");
          return;
        }

        if (!pointsManager.loadPointsData(pointsData)) {
          flashStatus("Preset point data does not match expected size.");
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
        updateFlowControlHud();
        state.transitionTriggerTime = state.time;
        flashStatus("Preset imported.");
      } catch (error) {
        console.error(error);
        flashStatus("Invalid preset JSON.");
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
    presetInfo.textContent = parts.filter(Boolean).join(" • ");
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
      flashStatus("Preset library is empty.");
      return;
    }
    const index = Math.max(0, presetLibrary.selectedIndex);
    const entry = presetLibraryEntries[index];
    if (!entry?.file) {
      flashStatus("Preset file missing.");
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
      flashStatus("Failed to load preset.");
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

  const editableTags = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
  const isEditableTarget = (target) =>
    target && (editableTags.has(target.tagName) || target.isContentEditable);

  const applyPenSizeDelta = (delta) => {
    const min = Number(penSize.min);
    const max = Number(penSize.max);
    const next = clamp(state.targetActionAreaSizeSigma + delta, min, max);
    state.targetActionAreaSizeSigma = next;
    state.latestSigmaChangeTime = state.time;
    penSize.value = String(next);
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
  
  const updateFlowControlHud = () => {
    if (!flowControlHud) return;
    const flowXVal = state.moveBiasActionX || 0;
    const flowYVal = state.moveBiasActionY || 0;
    const inertiaVal = state.L2Action ?? 0;
    flowControlHud.innerHTML = `
      <div class="flow-indicator">
        <span class="flow-label">FLOW</span>
        <span class="flow-value ${flowXVal !== 0 || flowYVal !== 0 ? 'active' : ''}">
          X: ${flowXVal > 0 ? '+' : ''}${flowXVal.toFixed(2)} | Y: ${flowYVal > 0 ? '+' : ''}${flowYVal.toFixed(2)}
        </span>
      </div>
      <div class="flow-indicator">
        <span class="flow-label">INERTIA</span>
        <span class="flow-value ${inertiaVal !== 0 ? 'active' : ''}">${inertiaVal.toFixed(2)}</span>
      </div>
    `;
  };
  
  // Base L2Action (inertia) to return to when key released  
  let baseL2Action = state.L2Action ?? 0;
  
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
        runNextLevel();
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

  // ============================================
  // TOWER SYSTEM
  // ============================================
  
  // Update tower list UI
  const updateTowerUI = () => {
    if (towerCountEl) {
      towerCountEl.textContent = `${state.towers.length}/${state.maxTowers}`;
    }

    if (towerListEl) {
      towerListEl.innerHTML = "";
      state.towers.forEach((tower, index) => {
        const item = document.createElement("div");
        item.className = `tower-item${state.selectedTowerIndex === index ? " tower-item--selected" : ""}`;
        item.innerHTML = `
          <span class="tower-item__num">#${index + 1}</span>
          <span class="tower-item__info">${Math.round(tower.frequency)}Hz, ${(tower.strength * 100).toFixed(0)}%</span>
          <button class="tower-item__delete" data-index="${index}">×</button>
        `;
        item.addEventListener("click", (e) => {
          if (!e.target.classList.contains("tower-item__delete")) {
            state.selectedTowerIndex = state.selectedTowerIndex === index ? -1 : index;
            updateTowerUI();
          }
        });
        towerListEl.appendChild(item);
      });

      // Delete button handlers
      towerListEl.querySelectorAll(".tower-item__delete").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          state.towers.splice(idx, 1);
          if (state.selectedTowerIndex >= state.towers.length) {
            state.selectedTowerIndex = state.towers.length - 1;
          }
          updateTowerUI();
        });
      });
    }
    
    // Show/hide edit section based on selection
    const hasSelection = state.selectedTowerIndex >= 0 && state.selectedTowerIndex < state.towers.length;
    
    if (newTowerSection) {
      newTowerSection.classList.toggle("hidden", hasSelection);
    }
    if (editTowerSection) {
      editTowerSection.classList.toggle("hidden", !hasSelection);
      
      if (hasSelection) {
        const tower = state.towers[state.selectedTowerIndex];
        if (editTowerNum) editTowerNum.textContent = String(state.selectedTowerIndex + 1);
        if (editTowerRadius) {
          editTowerRadius.value = String(tower.radius);
          if (editTowerRadiusValue) editTowerRadiusValue.textContent = tower.radius.toFixed(2);
        }
        if (editTowerFreq) {
          editTowerFreq.value = String(tower.frequency);
          if (editTowerFreqValue) editTowerFreqValue.textContent = `${Math.round(tower.frequency)} Hz`;
        }
        if (editTowerStrength) {
          editTowerStrength.value = String(tower.strength);
          if (editTowerStrengthValue) editTowerStrengthValue.textContent = tower.strength.toFixed(2);
        }
        if (editTowerPattern) {
          editTowerPattern.value = String(tower.pattern);
        }
      }
    }
  };
  
  
  // Place tower at current cursor position
  const placeTower = () => {
    if (state.towers.length >= state.maxTowers) {
      return;
    }
    
    const tower = {
      x: state.actionX,
      y: state.actionY,
      radius: newTowerRadius ? parseFloat(newTowerRadius.value) : TOWER_SETTINGS.defaultRadius,
      frequency: newTowerFreq ? parseFloat(newTowerFreq.value) : TOWER_SETTINGS.defaultFrequency,
      strength: newTowerStrength ? parseFloat(newTowerStrength.value) : TOWER_SETTINGS.defaultStrength,
      pattern: newTowerPattern ? parseInt(newTowerPattern.value) : TOWER_SETTINGS.defaultPattern,
    };
    
    state.towers.push(tower);
    state.selectedTowerIndex = state.towers.length - 1;
    state.towerPlacementMode = false;
    
    if (placeTowerBtn) {
      placeTowerBtn.classList.remove("tower-panel__place-btn--active");
    }
    
    updateTowerUI();
    
  };
  
  // Tower placement mode toggle
  if (placeTowerBtn) {
    placeTowerBtn.addEventListener("click", () => {
      if (state.towers.length >= state.maxTowers) {
        return;
      }
      state.towerPlacementMode = !state.towerPlacementMode;
      placeTowerBtn.classList.toggle("tower-panel__place-btn--active", state.towerPlacementMode);
    });
  }
  
  // Clear all towers
  if (clearTowersBtn) {
    clearTowersBtn.addEventListener("click", () => {
      state.towers = [];
      state.selectedTowerIndex = -1;
      updateTowerUI();
      
    });
  }
  
  // Tower settings inputs
  if (newTowerRadius) {
    newTowerRadius.addEventListener("input", () => {
      if (newTowerRadiusValue) {
        newTowerRadiusValue.textContent = parseFloat(newTowerRadius.value).toFixed(2);
      }
    });
  }
  if (newTowerFreq) {
    newTowerFreq.addEventListener("input", () => {
      if (newTowerFreqValue) {
        newTowerFreqValue.textContent = `${newTowerFreq.value} Hz`;
      }
    });
  }
  if (newTowerStrength) {
    newTowerStrength.addEventListener("input", () => {
      if (newTowerStrengthValue) {
        newTowerStrengthValue.textContent = parseFloat(newTowerStrength.value).toFixed(2);
      }
    });
  }
  
  // Populate pattern dropdowns
  const populatePatternDropdown = (selectEl, defaultValue) => {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    SOUND_WAVE_MODES.forEach(mode => {
      const opt = document.createElement("option");
      opt.value = String(mode.id);
      opt.textContent = mode.label;
      selectEl.appendChild(opt);
    });
    selectEl.value = String(defaultValue);
  };
  
  populatePatternDropdown(newTowerPattern, TOWER_SETTINGS.defaultPattern);
  populatePatternDropdown(editTowerPattern, TOWER_SETTINGS.defaultPattern);
  
  // Edit tower input handlers
  const updateSelectedTower = (property, value) => {
    if (state.selectedTowerIndex >= 0 && state.selectedTowerIndex < state.towers.length) {
      state.towers[state.selectedTowerIndex][property] = value;
      updateTowerUI();
    }
  };
  
  if (editTowerRadius) {
    editTowerRadius.addEventListener("input", () => {
      const val = parseFloat(editTowerRadius.value);
      if (editTowerRadiusValue) editTowerRadiusValue.textContent = val.toFixed(2);
      updateSelectedTower("radius", val);
    });
  }
  if (editTowerFreq) {
    editTowerFreq.addEventListener("input", () => {
      const val = parseFloat(editTowerFreq.value);
      if (editTowerFreqValue) editTowerFreqValue.textContent = `${Math.round(val)} Hz`;
      updateSelectedTower("frequency", val);
    });
  }
  if (editTowerStrength) {
    editTowerStrength.addEventListener("input", () => {
      const val = parseFloat(editTowerStrength.value);
      if (editTowerStrengthValue) editTowerStrengthValue.textContent = val.toFixed(2);
      updateSelectedTower("strength", val);
    });
  }
  if (editTowerPattern) {
    editTowerPattern.addEventListener("change", () => {
      updateSelectedTower("pattern", parseInt(editTowerPattern.value));
    });
  }

  // Handle click on canvas for tower placement
  const canvas = state.canvas;
  canvas.addEventListener("click", (e) => {
    if (state.towerPlacementMode) {
      placeTower();
    }
  });
  
  // Initialize tower UI
  updateTowerUI();

  // Initialize game HUD
  updateGameHUD();

  buildParamControls();
}
