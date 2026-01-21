import { SOUND_WAVE_MODES, TOWER_SETTINGS } from "./config.js";
import { clamp, lerp } from "./utils.js";
import { getAudioContext, getMasterGain } from "./audio.js";

const DEFAULT_TRACK_FILE = "Nicolas Jaar - Space Is Only Noise If You Can See.mp3";

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

  let audioSourceConfig = null;
  let newTowerType = "hz";
  let sharedMicStream = null;
  let sharedMicUsers = 0;
  const isMobileLayout = () =>
    window.matchMedia && window.matchMedia("(max-width: 900px), (max-height: 700px)").matches;

  const setAudioStatus = (message, isError = false) => {
    if (!audioTowerStatus) {
      return;
    }
    audioTowerStatus.textContent = message;
    audioTowerStatus.classList.toggle("tower-audio__status--error", isError);
  };

  const formatAudioLabel = (label) => {
    if (!label) {
      return "Audio";
    }
    const trimmed = String(label).trim();
    if (trimmed.length <= 18) {
      return trimmed;
    }
    return `${trimmed.slice(0, 18)}...`;
  };

  const buildAudioLabel = (config) => {
    if (!config) {
      return "Audio";
    }
    if (config.type === "file") {
      return config.file?.name || "File";
    }
    if (config.type === "url") {
      try {
        const parsed = new URL(config.url, window.location.href);
        const last = parsed.pathname.split("/").pop();
        return last || parsed.hostname || config.url;
      } catch {
        return config.url;
      }
    }
    if (config.type === "mic") {
      return "Microphone";
    }
    return "Audio";
  };

  const updatePlaceTowerLabel = () => {
    if (!placeTowerBtn) {
      return;
    }
    const label = placeTowerBtn.querySelector("span");
    if (label) {
      label.textContent = newTowerType === "audio" ? "Place Audio Tower" : "Place Tower";
    }
  };

  const updateAudioSectionVisibility = (hasSelection) => {
    if (!audioTowerSection) {
      return;
    }
    const showAudio = !hasSelection && newTowerType === "audio";
    audioTowerSection.classList.toggle("hidden", !showAudio);
  };

  const setTowerType = (type, { silent = false } = {}) => {
    newTowerType = type === "audio" ? "audio" : "hz";
    if (newTowerTypeHz) {
      const isActive = newTowerType === "hz";
      newTowerTypeHz.classList.toggle("tower-type-btn--active", isActive);
      newTowerTypeHz.setAttribute("aria-pressed", String(isActive));
    }
    if (newTowerTypeAudio) {
      const isActive = newTowerType === "audio";
      newTowerTypeAudio.classList.toggle("tower-type-btn--active", isActive);
      newTowerTypeAudio.setAttribute("aria-pressed", String(isActive));
    }
    updatePlaceTowerLabel();
    const hasSelection =
      state.selectedTowerIndex >= 0 && state.selectedTowerIndex < state.towers.length;
    updateAudioSectionVisibility(hasSelection);
    if (state.towerPlacementMode && newTowerType === "audio" && !audioSourceConfig) {
      state.towerPlacementMode = false;
      if (placeTowerBtn) {
        placeTowerBtn.classList.remove("tower-panel__place-btn--active");
      }
    }
    if (!silent && newTowerType === "audio" && !audioSourceConfig) {
      setAudioStatus("Choose a file, URL, or mic.");
    }
  };

  const setAudioSourceConfig = (config) => {
    audioSourceConfig = config;
    const label = formatAudioLabel(buildAudioLabel(config));
    if (audioSourceConfig) {
      audioSourceConfig.label = label;
    }
    setAudioStatus(audioSourceConfig ? `Loaded: ${label}` : "No audio loaded.");
    if (audioSourceConfig) {
      setTowerType("audio", { silent: true });
    }
  };

  const getDefaultAudioUrl = () => new URL(DEFAULT_TRACK_FILE, window.location.href).toString();

  const ensureDefaultAudioSource = () => {
    setAudioSourceConfig({ type: "url", url: getDefaultAudioUrl() });
  };

  const getTowerBaseRadius = (tower) =>
    Number.isFinite(tower.baseRadius) ? tower.baseRadius : tower.radius;

  const getTowerBaseStrength = (tower) =>
    Number.isFinite(tower.baseStrength) ? tower.baseStrength : tower.strength;

  const setTowerBaseValue = (tower, property, value) => {
    if (tower.audio && (property === "radius" || property === "strength")) {
      if (property === "radius") {
        tower.baseRadius = value;
      }
      if (property === "strength") {
        tower.baseStrength = value;
      }
    }
    tower[property] = value;
  };

  const ensureTowerBaseValues = (tower) => {
    if (!Number.isFinite(tower.baseRadius)) {
      tower.baseRadius = tower.radius;
    }
    if (!Number.isFinite(tower.baseStrength)) {
      tower.baseStrength = tower.strength;
    }
  };

  const acquireMicStream = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not supported in this browser.");
    }
    if (!sharedMicStream) {
      sharedMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    sharedMicUsers += 1;
    return sharedMicStream;
  };

  const releaseMicStream = () => {
    sharedMicUsers = Math.max(0, sharedMicUsers - 1);
    if (sharedMicStream && sharedMicUsers === 0) {
      sharedMicStream.getTracks().forEach((track) => track.stop());
      sharedMicStream = null;
    }
  };

  const createAudioTowerSource = async (config) => {
    if (!config) {
      return null;
    }
    const ctx = getAudioContext();
    const masterGain = getMasterGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    const timeData = new Uint8Array(analyser.fftSize);
    const gain = ctx.createGain();
    let element = null;
    let objectUrl = null;
    let sourceNode = null;
    let stream = null;
    let usesSharedMic = false;

    if (config.type === "file" && config.file) {
      objectUrl = URL.createObjectURL(config.file);
      element = new Audio();
      element.src = objectUrl;
      element.loop = true;
      element.preload = "auto";
      element.crossOrigin = "anonymous";
      sourceNode = ctx.createMediaElementSource(element);
      gain.gain.value = 0.65;
    } else if (config.type === "url" && config.url) {
      element = new Audio();
      element.src = config.url;
      element.loop = true;
      element.preload = "auto";
      element.crossOrigin = "anonymous";
      sourceNode = ctx.createMediaElementSource(element);
      gain.gain.value = 0.65;
    } else if (config.type === "mic") {
      stream = await acquireMicStream();
      usesSharedMic = true;
      sourceNode = ctx.createMediaStreamSource(stream);
      gain.gain.value = 0.0;
    }

    if (!sourceNode) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      return null;
    }

    sourceNode.connect(analyser);
    analyser.connect(gain);
    gain.connect(masterGain);

    return {
      type: config.type,
      label: config.label || formatAudioLabel(buildAudioLabel(config)),
      analyser,
      timeData,
      gain,
      element,
      objectUrl,
      sourceNode,
      stream,
      usesSharedMic,
      level: 0,
      updateLevel() {
        this.analyser.getByteTimeDomainData(this.timeData);
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i += 1) {
          const v = (this.timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.timeData.length);
        const boosted = clamp((rms - 0.02) * 4.0, 0, 1);
        this.level = lerp(this.level, boosted, 0.2);
        return this.level;
      },
      destroy() {
        try {
          this.sourceNode?.disconnect();
        } catch {
          // noop
        }
        try {
          this.analyser?.disconnect();
        } catch {
          // noop
        }
        try {
          this.gain?.disconnect();
        } catch {
          // noop
        }
        if (this.element) {
          this.element.pause();
          this.element.src = "";
          this.element.load();
        }
        if (this.objectUrl) {
          URL.revokeObjectURL(this.objectUrl);
        }
        if (this.usesSharedMic) {
          releaseMicStream();
        } else if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
        }
      },
    };
  };

  const destroyTowerAudio = (tower) => {
    if (!tower?.audio) {
      return;
    }
    tower.audio.destroy();
    tower.audio = null;
    tower.audioLabel = null;
    if (Number.isFinite(tower.baseRadius)) {
      tower.radius = tower.baseRadius;
    }
    if (Number.isFinite(tower.baseStrength)) {
      tower.strength = tower.baseStrength;
    }
    delete tower.baseRadius;
    delete tower.baseStrength;
    delete tower.audioLevel;
  };

  const attachAudioToTower = async (tower) => {
    if (!tower) {
      return;
    }
    if (!audioSourceConfig) {
      setAudioStatus("Load a file, URL, or mic first.", true);
      return;
    }
    destroyTowerAudio(tower);
    ensureTowerBaseValues(tower);
    let audio = null;
    try {
      audio = await createAudioTowerSource(audioSourceConfig);
    } catch (error) {
      setAudioStatus("Failed to attach audio source.", true);
      console.error(error);
      return;
    }
    if (!audio) {
      setAudioStatus("Failed to attach audio source.", true);
      return;
    }
    tower.audio = audio;
    tower.audioLabel = audio.label;
    setAudioStatus(`Attached: ${audio.label}`);
    if (audio.element) {
      audio.element.play().catch((error) => {
        console.warn("Audio play blocked", error);
        setAudioStatus("Audio playback blocked. Tap to start.", true);
      });
    }
    updateTowerUI();
  };

  const applyAudioPulse = (tower, level) => {
    const baseStrength = getTowerBaseStrength(tower);
    const baseRadius = getTowerBaseRadius(tower);
    tower.strength = clamp(baseStrength * (0.4 + 1.4 * level), 0, 1.5);
    tower.radius = clamp(
      baseRadius * (0.85 + 0.35 * level),
      TOWER_SETTINGS.minRadius,
      TOWER_SETTINGS.maxRadius
    );
  };

  const updateAudioMeter = (level) => {
    if (!audioTowerMeter) {
      return;
    }
    audioTowerMeter.style.width = `${Math.round(level * 100)}%`;
  };

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
    if (newTowerType === "audio" && !audioSourceConfig) {
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

    if (newTowerType === "audio") {
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
      if (nextMode && newTowerType === "audio" && !audioSourceConfig) {
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

  if (newTowerTypeHz) {
    newTowerTypeHz.addEventListener("click", () => {
      setTowerType("hz");
    });
  }

  if (newTowerTypeAudio) {
    newTowerTypeAudio.addEventListener("click", () => {
      setTowerType("audio");
    });
  }

  setTowerType(newTowerType, { silent: true });

  if (audioTowerFile) {
    audioTowerFile.addEventListener("change", () => {
      const file = audioTowerFile.files && audioTowerFile.files[0];
      if (!file) {
        return;
      }
      setAudioSourceConfig({ type: "file", file });
    });
  }

  if (audioTowerLoadUrl && audioTowerUrl) {
    audioTowerLoadUrl.addEventListener("click", () => {
      const url = audioTowerUrl.value.trim();
      if (!url) {
        setAudioStatus("Enter a URL to load.", true);
        return;
      }
      setAudioSourceConfig({ type: "url", url });
      setAudioStatus("URL loaded. Place an audio tower to start.", false);
    });
  }

  if (audioTowerUseMic) {
    audioTowerUseMic.addEventListener("click", async () => {
      try {
        await acquireMicStream();
        releaseMicStream();
        setAudioSourceConfig({ type: "mic" });
        setAudioStatus("Microphone ready. Place an audio tower to start.", false);
      } catch (error) {
        console.error(error);
        setAudioStatus("Microphone access failed.", true);
      }
    });
  }

  if (audioTowerStatus && !audioSourceConfig) {
    setAudioStatus("No audio loaded.");
  }

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
