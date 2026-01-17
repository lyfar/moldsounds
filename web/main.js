import { resolveSettingsFromUrl, QUALITY_PRESETS } from "./config.js";
import { PointsDataManager } from "./points.js";
import { initControls } from "./controls.js";
import { startSimulation } from "./sim.js";

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
  initControls(state, pointsManager, settings, qualityKey);
});
