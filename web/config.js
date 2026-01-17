export const BASE_SETTINGS = {
  simWidth: 960,
  simHeight: 540,
  particleDensity: 2.0,
  particleWorkgroupSize: 128,
  gridWorkgroupSize: 32,
  decayFactor: 0.75,
  depositFactor: 0.003,
  pixelScaleFactor: 250.0,
  numberOfColorModes: 10,
  maxNumberOfWaves: 5,
  maxNumberOfRandomSpawn: 5,
  transitionDuration: 0.5,
  actionSigmaChangeDuration: 0.26,
  spawnFraction: 0.1,
  penSizeMin: 0.02,
  penSizeMax: 0.85,
  blurPasses: 1,
  drawOpacity: 1.0,
  fillOpacity: 0.0,
  dotSize: 10.0,
  soundEnabled: 0,
  soundFrequency: 440,
  soundStrength: 0.65,
  soundWaveMode: 1,
  weaponSoundVolume: 0.5,
};

export const QUALITY_PRESETS = {
  low: { label: "Low (640x360) ~280K", simWidth: 640, simHeight: 360, particleDensity: 1.2 },
  medium: { label: "Medium (960x540) ~1M", simWidth: 960, simHeight: 540, particleDensity: 2.0 },
  high: { label: "High (1280x720) ~1.8M", simWidth: 1280, simHeight: 720, particleDensity: 2.0 },
  ultra: { label: "Ultra (1600x900) ~3.2M", simWidth: 1600, simHeight: 900, particleDensity: 2.2 },
  extreme: { label: "Extreme (1920x1080) ~6.2M", simWidth: 1920, simHeight: 1080, particleDensity: 3.0 },
  insane: { label: "Insane (2560x1440) ~11M", simWidth: 2560, simHeight: 1440, particleDensity: 3.0 },
  max4k: { label: "4K (3840x2160) ~25M", simWidth: 3840, simHeight: 2160, particleDensity: 3.0 },
};

export function resolveSettingsFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const requestedQuality = urlParams.get("quality");
  const qualityKey = QUALITY_PRESETS[requestedQuality] ? requestedQuality : "medium";
  const settings = { ...BASE_SETTINGS, ...QUALITY_PRESETS[qualityKey] };
  
  // Custom particle density from URL
  const densityParam = urlParams.get("density");
  if (densityParam) {
    const density = parseFloat(densityParam);
    if (!isNaN(density) && density >= 0.5 && density <= 5.0) {
      settings.particleDensity = density;
    }
  }
  
  const debugDefaultEnabled = urlParams.get("debug") === "1";
  return { settings, qualityKey, debugDefaultEnabled };
}

export const PARAMETERS_MATRIX = [
  [0.0, 4.0, 0.3, 0.1, 51.32, 20.0, 0.41, 4.0, 0.0, 0.1, 6.0, 0.1, 0.0, 0.0, 22.0],
  [0.0, 28.04, 14.53, 0.09, 1.0, 0.0, 0.01, 1.4, 1.12, 0.83, 3.0, 0.0, 0.57, 0.03, 36.0],
  [17.92, 2.0, 0.0, 0.52, 1.0, 0.0, 0.18, 1.0, 0.0, 0.1, 6.05, 0.17, 0.0, 0.0, 18.0],
  [3.0, 10.17, 0.4, 1.03, 2.3, 2.0, 1.42, 20.0, 0.75, 0.83, 1.56, 0.11, 1.07, 0.0, 13.0],
  [0.0, 8.51, 0.19, 0.61, 1.0, 0.0, 3.35, 1.0, 0.0, 0.75, 12.62, 0.06, 0.0, 0.0, 34.0],
  [0.0, 0.82, 0.03, 0.18, 1.0, 0.0, 0.26, 1.0, 0.0, 0.0, 20.0, 0.65, 0.2, 0.9, 31.5],
  [1.5, 1.94, 0.28, 1.73, 1.12, 0.71, 0.18, 2.22, 0.85, 0.5, 4.13, 0.11, 1.12, 0.0, 15.0],
  [2.87, 3.04, 0.28, 0.09, 1.0, 0.0, 0.44, 0.85, 0.0, 0.0, 2.22, 0.14, 0.3, 0.85, 11.0],
  [0.14, 1.12, 0.19, 0.27, 1.4, 0.0, 1.13, 2.0, 0.39, 0.75, 2.22, 0.19, 0.0, 7.14, 9.0],
  [0.001, 2.54, 0.08, 0.0, 1.0, 0.0, 3.35, 1.0, 0.0, 0.1, 12.62, 0.06, 0.0, 0.0, 30.5],
  [0.0, 28.04, 20.0, 0.18, 26.74, 20.0, 0.01, 1.4, 1.12, 0.83, 3.0, 0.0, 2.54, 0.0, 39.0],
  [0.0, 20.0, 3.0, 0.26, 2.15, 4.76, 0.41, 6.6, 12.62, 0.3, 6.6, 0.037, 0.4, 0.04, 28.0],
  [27.5, 2.0, 2.54, 0.88, 26.74, 0.0, 0.09, 2.0, 1.4, 0.1, 5.0, 7.41, 1.4, 14.25, 12.0],
  [0.0, 6.0, 100.0, 0.157, 1.0, 1.07, 0.0, 1.0, 5.0, 0.83, 5.0, 20.0, 0.4, 0.0, 8.0],
  [0.0, 15.0, 8.6, 0.03, 1.0, 0.0, 0.34, 2.0, 1.07, 0.22, 15.0, 0.1, 2.3, 0.82, 38.0],
  [0.0, 32.88, 402.0, 0.41, 3.0, 0.0, 0.1, 1.0, 0.0, 0.3, 6.0, 0.0, 0.0, 0.0, 32.0],
  [0.0, 0.8, 0.02, 5.2, 1.0, 0.0, 0.26, 0.1, 2.79, 0.83, 32.88, 37.74, 0.09, 0.33, 22.0],
  [3.0, 10.17, 0.4, 1.03, 0.308, 0.0, 0.148, 20.0, 0.75, 0.83, 1.56, 0.11, 1.07, 0.04, 9.0],
  [0.0, 5.0, 0.05, 0.9, 2.8, 0.0, 0.006, 0.84, 1.11, 0.75, 1.2, 0.0, 0.0, 0.0, 21.0],
  [27.5, 28.04, 0.0, 0.39, 1.4, 0.0, 0.09, 0.846, 1.4, 0.1, 2.031, 0.07, 1.4, 0.03, 15.3],
  [0.0, 8.5, 0.029, 0.27, 0.0, 0.0, 0.41, 0.0, 0.0, 0.75, 12.62, 0.06, 0.84, 0.0, 31.8],
  [0.0, 6.37, 5.425, 1.03, 0.0, 0.0, 0.18, 0.289, 0.443, 0.3, 2.2, 0.065, 1.07, 0.04, 19.0],
  [1.464, 20.0, 80.0, 0.26, 2.15, 4.76, 1.513, 2.0, 12.62, 0.385, 12.62, 0.037, 1.0, 0.0, 25.0],
  [0.0, 6.0, 100.0, 0.65, 0.175, 1.284, 0.0, 0.6, 5.0, 0.83, 5.395, 20.0, 0.4, 0.0, 8.6],
];

export const POINT_LABELS = [
  "pure_multiscale",
  "hex_hole_open",
  "vertebrata",
  "star_network",
  "enmeshed_singularities",
  "waves_upturn",
  "more_individuals",
  "sloppy_bucky",
  "massive_structure",
  "speed_modulation",
  "transmission_tower",
  "ink_on_white",
  "vanishing_points",
  "scaling_nodule_emergence",
  "hyp_offset",
  "strike",
  "clear_spaghetti",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];

export const SELECTED_POINTS = [0, 5, 2, 15, 3, 4, 6, 1, 7, 8, 9, 10, 11, 12, 14, 16, 13, 17, 18, 19, 20, 21];

export const PARAMS_DIMENSION = 15;

export const COLOR_MODES = [
  { id: 0, label: "Mono" },
  { id: 1, label: "Purple Fire" },
  { id: 2, label: "Icy" },
  { id: 3, label: "Amber Haze" },
  { id: 4, label: "Gold/Green" },
  { id: 5, label: "Neon Inferno" },
  { id: 6, label: "Zorg Purple" },
  { id: 7, label: "Inferno/Arctic" },
  { id: 8, label: "Experimental" },
  { id: 9, label: "Green" },
];

// Weapons 1-5 (Wave Annihilator is separate in the annihilator panel)
export const WEAPON_MODES = [
  { id: "burst", label: "Nova Burst", key: "1", cooldown: 0.2, description: "Scatter particles in random pattern" },
  { id: "ring", label: "Halo Ring", key: "2", cooldown: 0.3, description: "Spawn particles in a ring formation" },
  { id: "wave", label: "Void Wave", key: "3", cooldown: 0.8, description: "Emit expanding shockwave" },
  { id: "vortex", label: "Chaos Vortex", key: "4", cooldown: 1.0, description: "Create spinning particle tornado" },
  { id: "pulse", label: "Mold Pulse", key: "5", cooldown: 0.5, description: "Concentrated burst at cursor" },
];

export const SOUND_WAVE_MODES = [
  { id: 0, label: "Chladni Classic", description: "Rectangular plate vibration patterns" },
  { id: 1, label: "Cymatics Rings", description: "Radial Bessel-like standing waves" },
  { id: 2, label: "Spiral Storm", description: "Rotating interference spirals" },
  { id: 3, label: "Standing Waves", description: "Interference grid pattern" },
  { id: 4, label: "Auto Blend", description: "Frequency-based pattern mixing" },
];

// Sound Wave Towers system
export const TOWER_SETTINGS = {
  maxTowers: 8,
  defaultRadius: 0.15,      // 15% of screen size
  minRadius: 0.05,
  maxRadius: 0.5,
  defaultFrequency: 440,
  defaultStrength: 0.7,
  defaultPattern: 1,        // Cymatics Rings
};
