import { COLOR_MODES, QUALITY_PRESETS, SOUND_WAVE_MODES } from "../config.js";
import { clamp } from "../utils.js";
import { playSoundToggle, setMasterVolume } from "../audio.js";

export function initUiControls({
  state,
  settings,
  ui,
  qualityKey,
  onInertiaChange,
  onSoundToggle,
}) {
  const {
    penSize,
    penSizeQuick,
    penSizeQuickValue,
    inertia,
    flowX,
    flowY,
    flowValue,
    inertiaValue,
    flowControlHud,
    flowXMobile,
    flowYMobile,
    inertiaMobile,
    flowReset,
    colorMode,
    quality,
    showPen,
    depositFactor,
    decayFactor,
    blurPasses,
    drawOpacity,
    fillOpacity,
    dotSize,
    depositFactorValue,
    decayFactorValue,
    blurPassesValue,
    drawOpacityValue,
    fillOpacityValue,
    dotSizeValue,
    particleDensity,
    particleDensityValue,
    particleInfo,
    debugToggle,
    debugLog,
    soundToggle,
    soundFrequency,
    soundStrength,
    soundFrequencyValue,
    soundStrengthValue,
    soundWaveMode,
    weaponVolume,
    weaponVolumeValue,
    primeMode,
    primeSpeed,
    primeSpeedValue,
    primeStrength,
    primeStrengthValue,
    primeSpread,
    primeSpreadValue,
    annihilatorPanel,
    annihilatorStatus,
  } = ui;

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

  const applyPenSizeDelta = (delta) => {
    const min = Number(penSize.min);
    const max = Number(penSize.max);
    const next = clamp(state.targetActionAreaSizeSigma + delta, min, max);
    state.targetActionAreaSizeSigma = next;
    state.latestSigmaChangeTime = state.time;
    syncPenSizeInputs(next);
  };

  inertia.value = String(state.L2Action);
  inertia.addEventListener("input", () => {
    state.L2Action = Number(inertia.value);
    if (typeof onInertiaChange === "function") {
      onInertiaChange(state.L2Action);
    }
  });

  flowX.value = String(state.moveBiasActionX);
  flowY.value = String(state.moveBiasActionY);
  flowX.addEventListener("input", () => {
    state.moveBiasActionX = Number(flowX.value);
  });
  flowY.addEventListener("input", () => {
    state.moveBiasActionY = Number(flowY.value);
  });

  const updateFlowControlHud = () => {
    if (!flowControlHud) {
      return;
    }
    const flowXVal = state.moveBiasActionX || 0;
    const flowYVal = state.moveBiasActionY || 0;
    const inertiaVal = state.L2Action ?? 0;
    if (flowValue) {
      flowValue.textContent = `X: ${flowXVal > 0 ? "+" : ""}${flowXVal.toFixed(2)} | Y: ${
        flowYVal > 0 ? "+" : ""
      }${flowYVal.toFixed(2)}`;
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
  };

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
      if (typeof onInertiaChange === "function") {
        onInertiaChange(state.L2Action);
      }
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

  const setSoundEnabled = (enabled, options = {}) => {
    const { silent = false } = options;
    state.soundEnabled = enabled;
    if (!silent) {
      playSoundToggle(enabled);
    }
    if (enabled) {
      if (!silent) {
        ensureAudio();
      }
      if (gain && audioCtx) {
        gain.gain.setTargetAtTime(0.06, audioCtx.currentTime, 0.08);
      }
    } else if (gain && audioCtx) {
      gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.08);
    }
    updateSoundUi();
    if (annihilatorPanel) {
      annihilatorPanel.classList.toggle("annihilator-panel--active", enabled);
    }
    if (annihilatorStatus) {
      annihilatorStatus.textContent = enabled ? "ON" : "OFF";
    }
    if (soundToggle) {
      soundToggle.checked = enabled;
    }
    if (typeof onSoundToggle === "function") {
      onSoundToggle(enabled);
    }
  };

  if (soundToggle) {
    soundToggle.checked = state.soundEnabled;
    soundToggle.addEventListener("change", () => {
      setSoundEnabled(soundToggle.checked);
    });
  }

  if (debugToggle && debugLog) {
    debugToggle.checked = state.debug.enabled;
    debugToggle.addEventListener("change", () => {
      state.debug.enabled = debugToggle.checked;
      debugLog.textContent = state.debug.enabled ? "Debug enabled." : "Debug disabled.";
    });
  }

  return {
    updateRenderValues,
    updateFlowControlHud,
    updatePrimeUi,
    updateSoundUi,
    setSoundEnabled,
    applyPenSizeDelta,
    syncPenSizeInputs,
    updateParticleInfo,
  };
}
