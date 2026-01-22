import { SOUND_WAVE_MODES, TOWER_SETTINGS } from "./config.js";
import { clamp, lerp } from "./utils.js";
import { getAudioContext, getMasterGain } from "./audio.js";

const DEFAULT_TRACK_FILE = "Nicolas Jaar - Space Is Only Noise If You Can See.mp3";

export const getTowerBaseRadius = (tower) =>
  Number.isFinite(tower.baseRadius) ? tower.baseRadius : tower.radius;

export const getTowerBaseStrength = (tower) =>
  Number.isFinite(tower.baseStrength) ? tower.baseStrength : tower.strength;

export const setTowerBaseValue = (tower, property, value) => {
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

export const ensureTowerBaseValues = (tower) => {
  if (!Number.isFinite(tower.baseRadius)) {
    tower.baseRadius = tower.radius;
  }
  if (!Number.isFinite(tower.baseStrength)) {
    tower.baseStrength = tower.strength;
  }
};

export function initTowerAudioControls({ state, ui, updateTowerUI }) {
  const {
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
  } = ui;

  let audioSourceConfig = null;
  let newTowerType = "hz";
  let sharedMicStream = null;
  let sharedMicUsers = 0;

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

  return {
    getNewTowerType: () => newTowerType,
    hasAudioSource: () => Boolean(audioSourceConfig),
    setTowerType,
    setAudioStatus,
    setAudioSourceConfig,
    ensureDefaultAudioSource,
    attachAudioToTower,
    destroyTowerAudio,
    applyAudioPulse,
    updateAudioMeter,
    updateAudioSectionVisibility,
  };
}
