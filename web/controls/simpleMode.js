import { SOUND_WAVE_MODES, TOWER_SETTINGS } from "../config.js";
import { clamp } from "../utils.js";

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

export function initSimpleMode({
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
}) {
  const SIMPLE_PRESET_SOURCES = [
    {
      indexUrl: "./physarum-favorites/index.json",
      baseUrl: "./physarum-favorites/",
    },
    {
      indexUrl: "./36points-exports/index.json",
      baseUrl: "./36points-exports/",
    },
  ];
  const simplePresetState = {
    entries: [],
    index: 0,
    loading: null,
    applying: null,
    started: false,
    baseUrl: null,
  };
  let skipInitialSimplePresets = false;

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
    const radius = clamp(radiusRaw, TOWER_SETTINGS.minRadius, TOWER_SETTINGS.maxRadius);
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

  const loadSimplePresetEntries = async () => {
    if (simplePresetState.entries.length > 0) {
      return simplePresetState.entries;
    }
    if (simplePresetState.loading) {
      return simplePresetState.loading;
    }
    simplePresetState.loading = (async () => {
      for (const source of SIMPLE_PRESET_SOURCES) {
        try {
          const response = await fetch(source.indexUrl, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Preset index ${response.status}`);
          }
          const data = await response.json();
          const entries = Array.isArray(data?.presets) ? data.presets : [];
          if (entries.length === 0) {
            continue;
          }
          simplePresetState.entries = entries;
          simplePresetState.baseUrl = source.baseUrl;
          return entries;
        } catch (error) {
          console.warn("Failed to load simple preset list", error);
        }
      }
      return [];
    })();
    const entries = await simplePresetState.loading;
    simplePresetState.loading = null;
    return entries;
  };

  const applyNextSimplePreset = async () => {
    simplePresetState.started = true;
    if (typeof applyPresetPayload !== "function") {
      return false;
    }
    if (simplePresetState.applying) {
      return simplePresetState.applying;
    }
    simplePresetState.applying = (async () => {
      const entries = await loadSimplePresetEntries();
      if (!Array.isArray(entries) || entries.length === 0) {
        return false;
      }
      const baseUrl =
        simplePresetState.baseUrl || SIMPLE_PRESET_SOURCES[SIMPLE_PRESET_SOURCES.length - 1].baseUrl;
      while (simplePresetState.index < entries.length) {
        const entry = entries[simplePresetState.index];
        simplePresetState.index += 1;
        const file = entry?.file;
        if (!file) {
          continue;
        }
        try {
          const response = await fetch(`${baseUrl}${file}`);
          if (!response.ok) {
            throw new Error(`Preset ${response.status}`);
          }
          const payload = await response.json();
          if (applySimplePresetPayload(payload)) {
            return true;
          }
        } catch (error) {
          console.warn("Failed to apply simple preset", error);
        }
      }
      return false;
    })();
    const applied = await simplePresetState.applying;
    simplePresetState.applying = null;
    return applied;
  };

  const applySelectionFromPayload = (payload) => {
    const total = pointsManager.getNumberOfPoints();
    const selected = Array.isArray(payload?.selectedIndices) ? payload.selectedIndices : null;
    const settingsData = payload?.settings;
    const penIndex = Number.isFinite(selected?.[0])
      ? Number(selected[0])
      : Number.isFinite(settingsData?.penIndex)
        ? Number(settingsData.penIndex)
        : null;
    const bgIndex = Number.isFinite(selected?.[1])
      ? Number(selected[1])
      : Number.isFinite(settingsData?.bgIndex)
        ? Number(settingsData.bgIndex)
        : null;
    let updatedSelection = false;
    if (Number.isFinite(penIndex)) {
      pointsManager.setSelectedIndex(0, Math.round(clamp(penIndex, 0, total - 1)));
      updatedSelection = true;
    }
    if (Number.isFinite(bgIndex)) {
      pointsManager.setSelectedIndex(1, Math.round(clamp(bgIndex, 0, total - 1)));
      updatedSelection = true;
    }
    if (updatedSelection && typeof syncPointSelectors === "function") {
      syncPointSelectors();
    }
  };

  const applySimplePresetPayload = (payload) => {
    if (payload?.parameters && typeof applyPresetPayload === "function") {
      return applyPresetPayload(payload, 2);
    }

    if (!Array.isArray(payload?.points)) {
      return false;
    }

    if (!pointsManager.loadPointsData(payload.points)) {
      console.warn("Favorite preset did not match expected size.");
      return false;
    }

    applySelectionFromPayload(payload);

    if (payload?.settings && typeof applyPresetSettings === "function") {
      applyPresetSettings(payload.settings);
    }

    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
    if (typeof updateFlowControlHud === "function") {
      updateFlowControlHud();
    }
    return true;
  };

  const maybeStartSimplePresets = (force = false) => {
    if ((!force && skipInitialSimplePresets) || !isSimpleMode() || simplePresetState.started) {
      return;
    }
    void applyNextSimplePreset();
  };

  const advanceSimpleTowerLevel = (tower) => {
    rerollSimpleTower(tower);
    tower.health = tower.maxHealth;
    if (typeof incrementLevel === "function") {
      incrementLevel();
    } else {
      updateGameHUD();
    }
    const applyNext = async () => {
      const appliedPreset = await applyNextSimplePreset();
      if (!appliedPreset) {
        pointsManager.createRandomParameters();
        state.transitionTriggerTime = state.time;
        updateAdvancedValues();
      }
      playNextLevel(getCurrentPointValues());
    };
    applyNext();
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

  const markSkipInitialSimplePresets = () => {
    skipInitialSimplePresets = true;
  };

  return {
    applySimpleTowerDamage,
    maybeStartSimplePresets,
    markSkipInitialSimplePresets,
  };
}
