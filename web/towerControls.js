import { SOUND_WAVE_MODES, TOWER_SETTINGS } from "./config.js";
import {
  ensureTowerBaseValues,
  getTowerBaseRadius,
  getTowerBaseStrength,
  initTowerAudioControls,
  setTowerBaseValue,
} from "./towerAudioControls.js";

export function initTowerControls(state) {
  const towerCountEl = document.getElementById("towerCount");
  const placeTowerBtn = document.getElementById("placeTowerBtn");
  const towerListEl = document.getElementById("towerList");
  const clearTowersBtn = document.getElementById("clearTowersBtn");
  const simpleTower = document.getElementById("simpleTower");
  const simpleTowerBtn = document.getElementById("simpleTowerButton");
  const simpleTowerLabel = simpleTowerBtn
    ? simpleTowerBtn.querySelector("[data-role=\"simpleTowerLabel\"]")
    : null;
  const newTowerRadius = document.getElementById("newTowerRadius");
  const newTowerFreq = document.getElementById("newTowerFreq");
  const newTowerStrength = document.getElementById("newTowerStrength");
  const newTowerPattern = document.getElementById("newTowerPattern");
  const newTowerRadiusValue = document.getElementById("newTowerRadiusValue");
  const newTowerFreqValue = document.getElementById("newTowerFreqValue");
  const newTowerStrengthValue = document.getElementById("newTowerStrengthValue");
  const newTowerSection = document.getElementById("newTowerSection");
  const newTowerTypeHz = document.getElementById("newTowerTypeHz");
  const newTowerTypeAudio = document.getElementById("newTowerTypeAudio");

  const editTowerSection = document.getElementById("editTowerSection");
  const editTowerNum = document.getElementById("editTowerNum");
  const editTowerRadius = document.getElementById("editTowerRadius");
  const editTowerFreq = document.getElementById("editTowerFreq");
  const editTowerStrength = document.getElementById("editTowerStrength");
  const editTowerPattern = document.getElementById("editTowerPattern");
  const editTowerRadiusValue = document.getElementById("editTowerRadiusValue");
  const editTowerFreqValue = document.getElementById("editTowerFreqValue");
  const editTowerStrengthValue = document.getElementById("editTowerStrengthValue");

  const audioTowerSection = document.getElementById("audioTowerSection");
  const audioTowerFile = document.getElementById("audioTowerFile");
  const audioTowerUrl = document.getElementById("audioTowerUrl");
  const audioTowerLoadUrl = document.getElementById("audioTowerLoadUrl");
  const audioTowerUseMic = document.getElementById("audioTowerUseMic");
  const audioTowerStatus = document.getElementById("audioTowerStatus");
  const audioTowerMeter = document.getElementById("audioTowerMeter");
  const isMobileLayout = () =>
    window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 700px)").matches;
  let audioControls = null;

  const getNewTowerType = () => audioControls?.getNewTowerType?.() ?? "hz";
  const hasAudioSource = () => audioControls?.hasAudioSource?.() ?? false;
  const setAudioStatus = (message, isError) =>
    audioControls?.setAudioStatus?.(message, isError);
  const updateAudioSectionVisibility = (hasSelection) =>
    audioControls?.updateAudioSectionVisibility?.(hasSelection);
  const destroyTowerAudio = (tower) => audioControls?.destroyTowerAudio?.(tower);
  const attachAudioToTower = (tower) => audioControls?.attachAudioToTower?.(tower);
  const ensureDefaultAudioSource = () => audioControls?.ensureDefaultAudioSource?.();
  const applyAudioPulse = (tower, level) => audioControls?.applyAudioPulse?.(tower, level);
  const updateAudioMeter = (level) => audioControls?.updateAudioMeter?.(level);

  const updateSimpleTowerButton = () => {
    if (!simpleTowerBtn) {
      return;
    }
    const hasDefaultTower = state.towers.some((tower) => tower?.isDefaultTrack);
    simpleTowerBtn.classList.toggle("simple-tower__button--active", hasDefaultTower);
    if (simpleTowerLabel) {
      simpleTowerLabel.textContent = hasDefaultTower ? "Tower added" : "Start";
    }
    if (simpleTower) {
      simpleTower.classList.toggle("simple-tower--active", hasDefaultTower);
      simpleTower.classList.toggle("simple-tower--hidden", hasDefaultTower);
    }
  };

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
        const baseStrength = getTowerBaseStrength(tower);
        const baseInfo = `${Math.round(tower.frequency)}Hz, ${(baseStrength * 100).toFixed(0)}%`;
        const audioLabel = tower.audio ? `Audio: ${tower.audioLabel || "Source"}` : null;
        const infoLabel = audioLabel ? `${audioLabel} • ${baseInfo}` : baseInfo;
        item.innerHTML = `
          <span class="tower-item__num">#${index + 1}</span>
          <span class="tower-item__info">${infoLabel}</span>
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
      towerListEl.querySelectorAll(".tower-item__delete").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          const tower = state.towers[idx];
          destroyTowerAudio(tower);
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
    updateAudioSectionVisibility(hasSelection);
    if (editTowerSection) {
      editTowerSection.classList.toggle("hidden", !hasSelection);

      if (hasSelection) {
        const tower = state.towers[state.selectedTowerIndex];
        const baseRadius = getTowerBaseRadius(tower);
        const baseStrength = getTowerBaseStrength(tower);
        if (editTowerNum) editTowerNum.textContent = String(state.selectedTowerIndex + 1);
        if (editTowerRadius) {
          editTowerRadius.value = String(baseRadius);
          if (editTowerRadiusValue) editTowerRadiusValue.textContent = baseRadius.toFixed(2);
        }
        if (editTowerFreq) {
          editTowerFreq.value = String(tower.frequency);
          if (editTowerFreqValue) editTowerFreqValue.textContent = `${Math.round(tower.frequency)} Hz`;
        }
        if (editTowerStrength) {
          editTowerStrength.value = String(baseStrength);
          if (editTowerStrengthValue) editTowerStrengthValue.textContent = baseStrength.toFixed(2);
        }
        if (editTowerPattern) {
          editTowerPattern.value = String(tower.pattern);
        }
      }
    }

    updateSimpleTowerButton();
  };

  const scheduleTowerUiRefresh = () => {
    if (state.towerUiRaf) {
      return;
    }
    state.towerUiRaf = requestAnimationFrame(() => {
      state.towerUiRaf = null;
      updateTowerUI();
    });
  };
  state.refreshTowerUI = scheduleTowerUiRefresh;

  audioControls = initTowerAudioControls({
    state,
    ui: {
      placeTowerBtn,
      audioTowerSection,
      audioTowerFile,
      audioTowerUrl,
      audioTowerLoadUrl,
      audioTowerUseMic,
      audioTowerStatus,
      audioTowerMeter,
      newTowerTypeHz,
      newTowerTypeAudio,
    },
    updateTowerUI,
  });

  const createTower = () => ({
    x: state.actionX,
    y: state.actionY,
    radius: newTowerRadius ? parseFloat(newTowerRadius.value) : TOWER_SETTINGS.defaultRadius,
    frequency: newTowerFreq ? parseFloat(newTowerFreq.value) : TOWER_SETTINGS.defaultFrequency,
    strength: newTowerStrength ? parseFloat(newTowerStrength.value) : TOWER_SETTINGS.defaultStrength,
    pattern: newTowerPattern ? parseInt(newTowerPattern.value) : TOWER_SETTINGS.defaultPattern,
    health: TOWER_SETTINGS.defaultHealth ?? 100,
    maxHealth: TOWER_SETTINGS.defaultHealth ?? 100,
  });

  // Place tower at current cursor position
  const placeTower = async () => {
    if (state.towers.length >= state.maxTowers) {
      return;
    }
    if (getNewTowerType() === "audio" && !hasAudioSource()) {
      setAudioStatus("Load a file, URL, or mic first.", true);
      return;
    }

    const tower = createTower();

    state.towers.push(tower);
    state.selectedTowerIndex = state.towers.length - 1;
    state.towerPlacementMode = false;

    if (placeTowerBtn) {
      placeTowerBtn.classList.remove("tower-panel__place-btn--active");
    }

    updateTowerUI();

    if (getNewTowerType() === "audio") {
      await attachAudioToTower(tower);
    }

    if (isMobileLayout()) {
      document.body.classList.remove("mobile-show-towers", "mobile-panel-open");
    }
  };

  const placeDefaultAudioTower = async () => {
    if (state.towers.length >= state.maxTowers) {
      updateSimpleTowerButton();
      return;
    }
    const existingIndex = state.towers.findIndex((tower) => tower?.isDefaultTrack);
    if (existingIndex >= 0) {
      state.selectedTowerIndex = existingIndex;
      updateTowerUI();
      return;
    }
    ensureDefaultAudioSource();
    const tower = createTower();
    tower.x = state.simWidth / 2;
    tower.y = state.simHeight / 2;
    tower.isDefaultTrack = true;
    state.towers.push(tower);
    state.selectedTowerIndex = state.towers.length - 1;
    state.towerPlacementMode = false;
    updateTowerUI();
    await attachAudioToTower(tower);
  };

  // Tower placement mode toggle
  if (placeTowerBtn) {
    placeTowerBtn.addEventListener("click", () => {
      if (state.towers.length >= state.maxTowers) {
        return;
      }
      const nextMode = !state.towerPlacementMode;
      if (nextMode && getNewTowerType() === "audio" && !hasAudioSource()) {
        setAudioStatus("Load a file, URL, or mic first.", true);
        return;
      }
      state.towerPlacementMode = nextMode;
      placeTowerBtn.classList.toggle("tower-panel__place-btn--active", state.towerPlacementMode);
    });
  }

  if (simpleTowerBtn) {
    let lastTrigger = 0;
    const triggerSimpleTower = (event) => {
      const now = Date.now();
      if (now - lastTrigger < 400) {
        return;
      }
      lastTrigger = now;
      event.preventDefault();
      event.stopPropagation();
      void placeDefaultAudioTower();
    };
    simpleTowerBtn.addEventListener("pointerup", triggerSimpleTower);
    simpleTowerBtn.addEventListener("touchend", triggerSimpleTower, { passive: false });
    simpleTowerBtn.addEventListener("click", triggerSimpleTower);
  }

  // Clear all towers
  if (clearTowersBtn) {
    clearTowersBtn.addEventListener("click", () => {
      state.towers.forEach((tower) => destroyTowerAudio(tower));
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
    SOUND_WAVE_MODES.forEach((mode) => {
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
      const tower = state.towers[state.selectedTowerIndex];
      setTowerBaseValue(tower, property, value);
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
  if (canvas) {
    canvas.addEventListener("pointerup", (event) => {
      if (event.pointerType === "touch" && event.isPrimary === false) {
        return;
      }
      if (state.towerPlacementMode) {
        void placeTower();
      }
    });
  }

  // Initialize tower UI
  updateTowerUI();

  const audioPulseLoop = () => {
    let meterLevel = 0;
    state.towers.forEach((tower, index) => {
      if (!tower.audio) {
        return;
      }
      const level = tower.audio.updateLevel();
      tower.audioLevel = level;
      applyAudioPulse(tower, level);
      if (index === state.selectedTowerIndex) {
        meterLevel = level;
      }
    });
    updateAudioMeter(meterLevel);
    requestAnimationFrame(audioPulseLoop);
  };
  audioPulseLoop();
}
