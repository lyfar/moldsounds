import { resolveSettingsFromUrl, QUALITY_PRESETS } from "./config.js";
import { PointsDataManager } from "./points.js";
import { startSimulation } from "./sim.js";
import { initHealingControls } from "./healingControls.js";

const updateAppHeight = () => {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  if (Number.isFinite(viewportHeight)) {
    document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
  }
};

updateAppHeight();
window.addEventListener("resize", updateAppHeight);
window.addEventListener("orientationchange", updateAppHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateAppHeight);
  window.visualViewport.addEventListener("scroll", updateAppHeight);
}

const canvas = document.getElementById("gfx");
const statusEl = document.getElementById("status");
const debugLog = document.getElementById("debugLog");
const penIndicator = document.getElementById("pen-indicator");

if (!canvas || !statusEl) {
  throw new Error("Missing required DOM elements for simulation.");
}

const { settings, qualityKey, debugDefaultEnabled } = resolveSettingsFromUrl();
const qualityLabel = QUALITY_PRESETS[qualityKey].label;

const pointsManager = new PointsDataManager();

startSimulation({
  canvas,
  statusEl,
  debugLog,
  penIndicator,
  settings,
  qualityLabel,
  debugDefaultEnabled,
  pointsManager,
}).then((state) => {
  if (!state) {
    return;
  }
  initHealingControls({ state, settings, pointsManager });
});
