import { INSTRUMENT_PARAM_COUNT } from "./config.js";
import { createSetterShader } from "./shaders/setter.js";
import { createMoveShader } from "./shaders/move.js";
import { createDepositShader } from "./shaders/deposit.js";
import { createDiffusionShader } from "./shaders/diffusion.js";
import { createRenderShader } from "./shaders/render.js";

export function createShaders(settings) {
  const trailStorageFormat = settings.trailStorageFormat || "rgba16float";
  const trailClampMax = Number.isFinite(settings.trailClampMax) ? settings.trailClampMax : 1000.0;
  const displayBoost = Number.isFinite(settings.displayBoost) ? settings.displayBoost : 1.0;
  const gridWorkgroupSize = Number.isFinite(settings.gridWorkgroupSize)
    ? settings.gridWorkgroupSize
    : 32;
  const particleWorkgroupSize = Number.isFinite(settings.particleWorkgroupSize)
    ? settings.particleWorkgroupSize
    : 128;

  const shared = {
    trailStorageFormat,
    trailClampMax,
    displayBoost,
    gridWorkgroupSize,
    particleWorkgroupSize,
    maxNumberOfWaves: settings.maxNumberOfWaves,
    maxNumberOfRandomSpawn: settings.maxNumberOfRandomSpawn,
    instrumentParamCount:
      Number.isFinite(settings.instrumentParamCount) && settings.instrumentParamCount > 0
        ? settings.instrumentParamCount
        : INSTRUMENT_PARAM_COUNT,
  };

  const setter = createSetterShader(shared);
  const move = createMoveShader(shared);
  const deposit = createDepositShader(shared);
  const diffusion = createDiffusionShader(shared);
  const render = createRenderShader();

  return { setter, move, deposit, diffusion, render };
}
