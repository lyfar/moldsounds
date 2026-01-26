import { SOUND_WAVE_MODES, TOWER_SETTINGS, INSTRUMENT_PARAM } from "./config.js";
import { clamp } from "./utils.js";
import { applyPresetPayload } from "./presets/payload.js";
import { loadPresetLibrary, updatePresetInfo } from "./presets/library.js";
import { createHealingAudio } from "./healing/audioEngine.js";
import { PRESET_ICONS } from "./healing/presetIcons.js";
import {
  SACRED_FREQUENCIES,
  INSTRUMENTS,
  RIEMANN_ZEROS,
  DRUM_RATIOS,
  KOSHI_INTERVALS,
} from "./healing/instruments.js";

const DEFAULTS = {
  activeInstrument: "bowl",
  selectedPreset: 4,
  frequency: 528,
  decay: 12.7,
  binauralBeat: 12.9,
  reverbMix: 0.94,
  radius: 0.32,
  strength: 0.55,
  response: 1.4,
  pattern: 1,
};

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const BOWL_RATIOS = [1.0, 2.78, 5.16, 8.13, 11.52];
const BOWL_NORM = average(BOWL_RATIOS) / 12;
const RIEMANN_NORM = average(RIEMANN_ZEROS) / 33;
const DRUM_NORM = average(DRUM_RATIOS) / 3;
const KOSHI_NORM = average(KOSHI_INTERVALS) / 2;

const calculateIntentionMath = (text) => {
  if (!text) {
    return 1.0;
  }
  let sum = 0;
  for (let i = 0; i < text.length; i += 1) {
    sum += text.charCodeAt(i) * (i + 1);
  }
  return 0.8 + (sum % 400) / 1000;
};

export function initHealingControls({ state, settings, pointsManager }) {
  const ui = {
    instrumentGrid: document.getElementById("instrumentGrid"),
    status: document.getElementById("healingStatus"),
    meter: document.getElementById("healingMeter"),
    settingsToggle: document.getElementById("healingSettingsToggle"),
    intentionText: document.getElementById("intentionText"),
    intentionSeed: document.getElementById("intentionSeed"),
    frequencyPresets: document.getElementById("frequencyPresets"),
    frequency: document.getElementById("frequency"),
    frequencyValue: document.getElementById("frequencyValue"),
    decay: document.getElementById("decay"),
    decayValue: document.getElementById("decayValue"),
    binauralBeat: document.getElementById("binauralBeat"),
    binauralBeatValue: document.getElementById("binauralBeatValue"),
    reverbMix: document.getElementById("reverbMix"),
    reverbMixValue: document.getElementById("reverbMixValue"),
    size: document.getElementById("bowlSize"),
    sizeValue: document.getElementById("bowlSizeValue"),
    strength: document.getElementById("bowlStrength"),
    strengthValue: document.getElementById("bowlStrengthValue"),
    response: document.getElementById("bowlResponse"),
    responseValue: document.getElementById("bowlResponseValue"),
    pattern: document.getElementById("bowlPattern"),
    presetLibrary: document.getElementById("presetLibrary"),
    presetInfo: document.getElementById("presetInfo"),
    presetApplyTarget: document.getElementById("presetApplyTarget"),
    applyPresetBtn: document.getElementById("applyPresetBtn"),
  };

  const audio = createHealingAudio();

  const renderBase = {
    depositFactor: settings.depositFactor ?? 0.003,
    drawOpacity: settings.drawOpacity ?? 1,
    fillOpacity: settings.fillOpacity ?? 0,
  };

  let activeInstrument = DEFAULTS.activeInstrument;
  let selectedPresetIndex = DEFAULTS.selectedPreset;
  let frequency = DEFAULTS.frequency;
  let decay = DEFAULTS.decay;
  let binauralBeat = DEFAULTS.binauralBeat;
  let reverbMix = DEFAULTS.reverbMix;
  let intentionText = "";
  let intentionSeed = 1.0;
  let responseStrength = DEFAULTS.response;
  const instrumentParams = state.instrumentParams;

  const bowl = {
    x: state.simWidth / 2,
    y: state.simHeight / 2,
    radius: DEFAULTS.radius,
    frequency,
    strength: DEFAULTS.strength,
    pattern: DEFAULTS.pattern,
  };
  bowl.baseRadius = bowl.radius;
  bowl.baseStrength = bowl.strength;

  state.towers = [bowl];
  state.selectedTowerIndex = 0;
  state.weaponIndex = 0;
  state.displayPen = false;

  const setStatus = (message) => {
    if (ui.status) {
      ui.status.textContent = message;
    }
  };

  const updateMeter = (level) => {
    if (ui.meter) {
      ui.meter.style.width = `${Math.round(level * 100)}%`;
    }
  };

  const updateFrequencyLabel = (value) => {
    if (ui.frequencyValue) {
      const formatted = Math.abs(value % 1) > 0.001 ? value.toFixed(2) : Math.round(value);
      ui.frequencyValue.textContent = `${formatted} Hz`;
    }
  };

  const updateDecayLabel = (value) => {
    if (ui.decayValue) {
      ui.decayValue.textContent = `${value.toFixed(1)}s`;
    }
  };

  const updateBinauralLabel = (value) => {
    if (ui.binauralBeatValue) {
      ui.binauralBeatValue.textContent = `${value.toFixed(2)} Hz`;
    }
  };

  const updateReverbLabel = (value) => {
    if (ui.reverbMixValue) {
      ui.reverbMixValue.textContent = value.toFixed(3);
    }
  };

  const updateSizeLabel = (value) => {
    if (ui.sizeValue) {
      ui.sizeValue.textContent = value.toFixed(2);
    }
  };

  const updateStrengthLabel = (value) => {
    if (ui.strengthValue) {
      ui.strengthValue.textContent = value.toFixed(2);
    }
  };

  const updateResponseLabel = (value) => {
    if (ui.responseValue) {
      ui.responseValue.textContent = value.toFixed(2);
    }
  };

  const updateIntentionSeed = (text) => {
    intentionSeed = calculateIntentionMath(text);
    if (ui.intentionSeed) {
      ui.intentionSeed.textContent = intentionSeed.toFixed(6);
    }
  };

  const instrumentButtons = new Map();
  const formatFrequency = (value) =>
    Math.abs(value % 1) > 0.001 ? value.toFixed(2) : Math.round(value);
  const emitSound = () => {
    audio.triggerInstrument(activeInstrument, {
      frequency,
      decay,
      binauralBeat,
      reverbMix,
      intentionSeed,
    });
    const label = INSTRUMENTS.find((item) => item.id === activeInstrument)?.label || activeInstrument;
    setStatus(`${label} emitted.`);
  };
  state.weaponActions = [emitSound];
  const getInstrumentIndex = () => {
    const idx = INSTRUMENTS.findIndex((item) => item.id === activeInstrument);
    return idx >= 0 ? idx : 0;
  };
  const buildInstrumentMix = () => {
    const binauralNorm = clamp(binauralBeat / 15, 0, 1);
    const decayNorm = clamp(decay / 15, 0, 1);
    const seedBoost = clamp((intentionSeed - 0.8) / 0.6, 0, 1);
    const reverbBias = clamp(reverbMix, 0, 1);

    switch (activeInstrument) {
      case "gong":
        return {
          mixChladni: 0.2,
          mixCymatics: 0.8 + RIEMANN_NORM * 0.2,
          mixSpiral: 0.35 + reverbBias * 0.35,
          mixStanding: 0.35 + decayNorm * 0.2,
          radialMod: RIEMANN_NORM,
          angularMod: 0.35 + binauralNorm * 0.4,
        };
      case "wood":
        return {
          mixChladni: 0.25,
          mixCymatics: 0.35,
          mixSpiral: 0.2,
          mixStanding: 0.9,
          radialMod: 0.35 + DRUM_NORM * 0.2,
          angularMod: 0.15 + binauralNorm * 0.2,
        };
      case "crystal":
        return {
          mixChladni: 0.3,
          mixCymatics: 0.6 + seedBoost * 0.2,
          mixSpiral: 0.85 + seedBoost * 0.2,
          mixStanding: 0.2,
          radialMod: 0.4 + seedBoost * 0.4,
          angularMod: 0.25 + binauralNorm * 0.45,
        };
      case "drum":
        return {
          mixChladni: 0.4,
          mixCymatics: 0.25,
          mixSpiral: 0.1,
          mixStanding: 0.95,
          radialMod: DRUM_NORM,
          angularMod: 0.2 + decayNorm * 0.2,
        };
      case "chime":
        return {
          mixChladni: 0.2,
          mixCymatics: 0.65,
          mixSpiral: 0.75 + KOSHI_NORM * 0.2,
          mixStanding: 0.25,
          radialMod: 0.35 + KOSHI_NORM * 0.3,
          angularMod: 0.6 + binauralNorm * 0.3,
        };
      case "bowl":
      default:
        return {
          mixChladni: 0.75 + BOWL_NORM * 0.2,
          mixCymatics: 0.45 + RIEMANN_NORM * 0.15,
          mixSpiral: 0.25 + binauralNorm * 0.25,
          mixStanding: 0.35 + decayNorm * 0.2,
          radialMod: BOWL_NORM,
          angularMod: 0.3 + binauralNorm * 0.35,
        };
    }
  };
  const syncInstrumentParams = (audioLevel = 0) => {
    if (!instrumentParams) {
      return;
    }
    const mix = buildInstrumentMix();
    instrumentParams[INSTRUMENT_PARAM.instrumentId] = getInstrumentIndex();
    instrumentParams[INSTRUMENT_PARAM.intentionSeed] = intentionSeed;
    instrumentParams[INSTRUMENT_PARAM.binauralBeat] = binauralBeat;
    instrumentParams[INSTRUMENT_PARAM.decay] = decay;
    instrumentParams[INSTRUMENT_PARAM.reverbMix] = reverbMix;
    instrumentParams[INSTRUMENT_PARAM.audioLevel] = audioLevel;
    instrumentParams[INSTRUMENT_PARAM.mixChladni] = mix.mixChladni;
    instrumentParams[INSTRUMENT_PARAM.mixCymatics] = mix.mixCymatics;
    instrumentParams[INSTRUMENT_PARAM.mixSpiral] = mix.mixSpiral;
    instrumentParams[INSTRUMENT_PARAM.mixStanding] = mix.mixStanding;
    instrumentParams[INSTRUMENT_PARAM.radialMod] = mix.radialMod;
    instrumentParams[INSTRUMENT_PARAM.angularMod] = mix.angularMod;
  };
  const setActiveInstrument = (instrumentId) => {
    activeInstrument = instrumentId;
    instrumentButtons.forEach((button, id) => {
      button.classList.toggle("weapon--active", id === activeInstrument);
    });
    const label = INSTRUMENTS.find((item) => item.id === instrumentId)?.label || instrumentId;
    setStatus(`${label} ready. Choose a frequency below or tap the visual.`);
    syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
  };

  if (ui.instrumentGrid) {
    ui.instrumentGrid.innerHTML = "";
    INSTRUMENTS.forEach((instrument, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `weapon healing-weapon healing-weapon--${instrument.id}`;
      button.innerHTML = `
        <span class="weapon__preview">
          <span class="weapon__key">${index + 1}</span>
        </span>
        <span class="weapon__label">${instrument.label}</span>
      `;
      button.addEventListener("click", () => setActiveInstrument(instrument.id));
      instrumentButtons.set(instrument.id, button);
      ui.instrumentGrid.appendChild(button);
    });
    setActiveInstrument(activeInstrument);
  }

  const presetButtons = [];
  const setPresetIndex = (index) => {
    selectedPresetIndex = index;
    const preset = SACRED_FREQUENCIES[index];
    if (!preset) {
      return;
    }
    frequency = preset.hz;
    bowl.frequency = frequency;
    if (ui.frequency) {
      ui.frequency.value = String(frequency);
    }
    updateFrequencyLabel(frequency);
    presetButtons.forEach((button, idx) => {
      button.classList.toggle("healing-preset--active", idx === selectedPresetIndex);
    });
    syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
  };

  if (ui.frequencyPresets) {
    ui.frequencyPresets.innerHTML = "";
    SACRED_FREQUENCIES.forEach((preset, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "healing-preset";
      const iconSrc = PRESET_ICONS[preset.label];
      button.title = preset.desc;
      button.innerHTML = `
        <span class="healing-preset__icon" aria-hidden="true">
          ${iconSrc ? `<img src="${iconSrc}" alt="" loading="lazy" />` : ""}
        </span>
        <span class="healing-preset__content">
          <span class="healing-preset__hz">${formatFrequency(preset.hz)} Hz</span>
          <span class="healing-preset__label">${preset.label}</span>
        </span>
      `;
      button.addEventListener("click", () => setPresetIndex(index));
      presetButtons.push(button);
      ui.frequencyPresets.appendChild(button);
    });
    setPresetIndex(selectedPresetIndex);
  }

  if (ui.frequency) {
    ui.frequency.value = String(frequency);
    updateFrequencyLabel(frequency);
    ui.frequency.addEventListener("input", () => {
      frequency = Number(ui.frequency.value);
      bowl.frequency = frequency;
      updateFrequencyLabel(frequency);
      selectedPresetIndex = -1;
      presetButtons.forEach((button) => button.classList.remove("healing-preset--active"));
      syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
    });
  }

  if (ui.decay) {
    ui.decay.value = String(decay);
    updateDecayLabel(decay);
    ui.decay.addEventListener("input", () => {
      decay = Number(ui.decay.value);
      updateDecayLabel(decay);
      syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
    });
  }

  if (ui.binauralBeat) {
    ui.binauralBeat.value = String(binauralBeat);
    updateBinauralLabel(binauralBeat);
    ui.binauralBeat.addEventListener("input", () => {
      binauralBeat = Number(ui.binauralBeat.value);
      updateBinauralLabel(binauralBeat);
      syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
    });
  }

  if (ui.reverbMix) {
    ui.reverbMix.value = String(reverbMix);
    updateReverbLabel(reverbMix);
    ui.reverbMix.addEventListener("input", () => {
      reverbMix = clamp(Number(ui.reverbMix.value), 0, 1);
      updateReverbLabel(reverbMix);
      syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
    });
  }

  if (ui.intentionText) {
    ui.intentionText.value = intentionText;
    updateIntentionSeed(intentionText);
    ui.intentionText.addEventListener("input", () => {
      intentionText = ui.intentionText.value;
      updateIntentionSeed(intentionText);
      syncInstrumentParams(instrumentParams?.[INSTRUMENT_PARAM.audioLevel] ?? 0);
    });
  }

  if (ui.size) {
    ui.size.value = String(bowl.baseRadius);
    updateSizeLabel(bowl.baseRadius);
    ui.size.addEventListener("input", () => {
      const value = Number(ui.size.value);
      bowl.baseRadius = clamp(value, TOWER_SETTINGS.minRadius, TOWER_SETTINGS.maxRadius);
      bowl.radius = bowl.baseRadius;
      updateSizeLabel(bowl.baseRadius);
    });
  }

  if (ui.strength) {
    ui.strength.value = String(bowl.baseStrength);
    updateStrengthLabel(bowl.baseStrength);
    ui.strength.addEventListener("input", () => {
      bowl.baseStrength = clamp(Number(ui.strength.value), 0.05, 1.5);
      updateStrengthLabel(bowl.baseStrength);
    });
  }

  if (ui.response) {
    ui.response.value = String(responseStrength);
    updateResponseLabel(responseStrength);
    ui.response.addEventListener("input", () => {
      responseStrength = clamp(Number(ui.response.value), 0.6, 2.4);
      updateResponseLabel(responseStrength);
    });
  }

  if (ui.pattern) {
    ui.pattern.innerHTML = "";
    SOUND_WAVE_MODES.forEach((mode) => {
      const option = document.createElement("option");
      option.value = String(mode.id);
      option.textContent = mode.label;
      ui.pattern.appendChild(option);
    });
    ui.pattern.value = String(bowl.pattern);
    ui.pattern.addEventListener("change", () => {
      bowl.pattern = Number(ui.pattern.value);
    });
  }

  if (ui.settingsToggle) {
    ui.settingsToggle.addEventListener("click", () => {
      document.body.classList.toggle("healing-show-settings");
    });
  }

  let presetLibraryEntries = [];
  const notify = (message) => setStatus(message);

  if (ui.presetLibrary) {
    ui.presetLibrary.addEventListener("change", () => {
      updatePresetInfo(ui.presetInfo, presetLibraryEntries[ui.presetLibrary.selectedIndex]);
    });
    loadPresetLibrary({ presetLibrary: ui.presetLibrary, presetInfo: ui.presetInfo }).then(
      (entries) => {
        presetLibraryEntries = entries;
      }
    );
  }

  const applyRenderSettingsFromParams = (params, offset = 14) => {
    if (!Array.isArray(params) || params.length < offset + 6) {
      return;
    }
    settings.depositFactor = clamp(params[offset], 0, 1);
    settings.decayFactor = clamp(params[offset + 1], 0, 1);
    settings.blurPasses = Math.max(0, Math.round(params[offset + 2]));
    settings.drawOpacity = clamp(params[offset + 3], 0, 1);
    settings.fillOpacity = clamp(params[offset + 4], 0, 1);
    settings.dotSize = clamp(params[offset + 5], 0, 50);
    renderBase.depositFactor = settings.depositFactor;
    renderBase.drawOpacity = settings.drawOpacity ?? renderBase.drawOpacity;
    renderBase.fillOpacity = settings.fillOpacity ?? renderBase.fillOpacity;
  };

  const applyPresetSelection = async () => {
    if (!ui.presetLibrary || presetLibraryEntries.length === 0) {
      notify("Preset library is empty.");
      return;
    }
    const entry = presetLibraryEntries[Math.max(0, ui.presetLibrary.selectedIndex)];
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
      const targetIndex = ui.presetApplyTarget ? Number(ui.presetApplyTarget.value) : 2;
      applyPresetPayload({
        payload,
        targetIndex,
        pointsManager,
        applyRenderSettingsFromParams,
        updateAdvancedValues: null,
        state,
        notify,
      });
      updatePresetInfo(ui.presetInfo, entry);
    } catch (error) {
      console.error(error);
      notify("Failed to load preset.");
    }
  };

  if (ui.applyPresetBtn) {
    ui.applyPresetBtn.addEventListener("click", () => {
      void applyPresetSelection();
    });
  }

  const animationLoop = () => {
    const level = audio.updateLevel();
    const mod = clamp(level * responseStrength, 0, 1.5);
    const activeLevel = mod > 0.02 ? mod : 0;
    const visibility = clamp(activeLevel, 0, 1);
    bowl.strength = clamp(bowl.baseStrength * activeLevel, 0, 1.8);
    bowl.radius = bowl.baseRadius;
    settings.depositFactor = renderBase.depositFactor * visibility;
    settings.drawOpacity = renderBase.drawOpacity * visibility;
    settings.fillOpacity = renderBase.fillOpacity * visibility;
    syncInstrumentParams(level);
    updateMeter(level);
    requestAnimationFrame(animationLoop);
  };

  setStatus("Choose an instrument, then tap the visual to emit.");
  updateIntentionSeed(intentionText);
  syncInstrumentParams(0);
  animationLoop();
}
