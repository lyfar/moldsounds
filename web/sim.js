import { initWebGPU, configureCanvas } from "./gpu.js";
import { PARAMS_DIMENSION, SOUND_WAVE_MODES } from "./config.js";
import {
  buildUniforms,
  writePointSettings,
  setRandomSpawn,
  updateActionAreaSizeSigma,
  currentTransitionProgress,
  updatePenIndicator,
  clamp,
} from "./utils.js";
import { initSimInputs } from "./sim/inputs.js";
import { createGpuResources } from "./sim/resources.js";
import { createPipelines } from "./sim/pipelines.js";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PRIME_LOG_RANGE = Math.log(10000);
const PRIME_CACHE = [2, 3];
const SOUND_PATTERN_COUNT = SOUND_WAVE_MODES.length;

const isPrime = (value) => {
  if (value <= 1) {
    return false;
  }
  if (value % 2 === 0) {
    return value === 2;
  }
  const limit = Math.floor(Math.sqrt(value));
  for (let i = 3; i <= limit; i += 2) {
    if (value % i === 0) {
      return false;
    }
  }
  return true;
};

const getPrime = (index) => {
  if (index < 0) {
    return 2;
  }
  let candidate = PRIME_CACHE[PRIME_CACHE.length - 1] + 2;
  while (PRIME_CACHE.length <= index) {
    while (!isPrime(candidate)) {
      candidate += 2;
    }
    PRIME_CACHE.push(candidate);
    candidate += 2;
  }
  return PRIME_CACHE[index];
};

const primeToFrequency = (prime) => {
  const normalized = Math.log(Math.max(prime, 2)) / PRIME_LOG_RANGE;
  return clamp(20 + normalized * 1980, 20, 2000);
};

export async function startSimulation({
  canvas,
  statusEl,
  debugLog,
  penIndicator,
  settings,
  qualityLabel,
  debugDefaultEnabled,
  pointsManager,
}) {
  const gpu = await initWebGPU(canvas, statusEl);
  if (!gpu) {
    return null;
  }

  const { device, context, format, supportsStorage16 } = gpu;
  const appendDebug = (message) => {
    if (!debugLog) {
      return;
    }
    const lines = debugLog.textContent ? debugLog.textContent.split("\n") : [];
    lines.push(message);
    while (lines.length > 6) {
      lines.shift();
    }
    debugLog.textContent = lines.join("\n");
  };

  device.onuncapturederror = (event) => {
    console.error(event.error);
    statusEl.textContent = `WebGPU error: ${event.error.message}`;
    appendDebug(`error: ${event.error.message}`);
  };
  device.lost.then((info) => {
    const message = `WebGPU device lost: ${info.message || "unknown"}`;
    statusEl.textContent = message;
    appendDebug(`error: ${message}`);
  });

  const trailFormat = supportsStorage16 ? "rgba16float" : "rgba8unorm";
  const trailBytesPerPixel = supportsStorage16 ? 8 : 4;
  const displayBoost = supportsStorage16 ? 1.0 : 4.0;
  appendDebug(
    supportsStorage16
      ? "info: texture-storage-16-bit enabled (rgba16float trails)"
      : "info: using rgba8unorm trails (no texture-storage-16-bit support)"
  );
  if (!supportsStorage16) {
    appendDebug(`info: display boost x${displayBoost.toFixed(1)} for 8-bit trails`);
  }

  const maxInvocations = device.limits.maxComputeInvocationsPerWorkgroup;
  const maxWorkgroupSizeX = device.limits.maxComputeWorkgroupSizeX;
  const maxWorkgroupSizeY = device.limits.maxComputeWorkgroupSizeY;
  const gridWorkgroupLimit = Math.max(
    1,
    Math.min(maxWorkgroupSizeX, maxWorkgroupSizeY, Math.floor(Math.sqrt(maxInvocations)))
  );
  const gridWorkgroupSize = Math.max(1, Math.min(settings.gridWorkgroupSize, gridWorkgroupLimit));
  const particleWorkgroupLimit = Math.max(1, Math.min(maxWorkgroupSizeX, maxInvocations));
  const particleWorkgroupSize = Math.max(
    1,
    Math.min(settings.particleWorkgroupSize, particleWorkgroupLimit)
  );
  const gpuSettings = { ...settings, gridWorkgroupSize, particleWorkgroupSize };
  if (
    gridWorkgroupSize !== settings.gridWorkgroupSize ||
    particleWorkgroupSize !== settings.particleWorkgroupSize
  ) {
    appendDebug(
      `info: adjusted workgroups grid=${gridWorkgroupSize} particles=${particleWorkgroupSize}`
    );
  } else {
    appendDebug(`info: workgroups grid=${gridWorkgroupSize} particles=${particleWorkgroupSize}`);
  }

  const simWidth = settings.simWidth;
  const simHeight = settings.simHeight;
  const particlesPerPixel = settings.particleDensity;
  
  // Check GPU limits for storage buffer size (4 floats per particle = 16 bytes)
  const maxStorageBufferSize = device.limits.maxStorageBufferBindingSize;
  const bytesPerParticle = 16; // 4 floats: x, y, heading, pad
  const maxParticlesByLimit = Math.floor(maxStorageBufferSize / bytesPerParticle);
  
  let numParticles =
    Math.floor((simWidth * simHeight * particlesPerPixel) / gpuSettings.particleWorkgroupSize) *
    gpuSettings.particleWorkgroupSize;
  
  // Clamp to GPU limit
  if (numParticles > maxParticlesByLimit) {
    const clampedParticles = Math.floor(maxParticlesByLimit / gpuSettings.particleWorkgroupSize) * gpuSettings.particleWorkgroupSize;
    console.warn(`Particle count ${numParticles.toLocaleString()} exceeds GPU limit, clamping to ${clampedParticles.toLocaleString()}`);
    appendDebug(`warn: particles clamped to ${clampedParticles.toLocaleString()} (GPU limit)`);
    numParticles = clampedParticles;
  }

  const state = {
    simWidth,
    simHeight,
    numParticles,
    time: 0,
    actionX: simWidth / 2,
    actionY: simHeight / 2,
    moveBiasActionX: 0,
    moveBiasActionY: 0,
    mouseXchange: 0.5,
    screenY: 0.5,
    L2Action: 0,
    spawnParticles: 0,
    requestRandomSpawn: false,
    randomSpawnNumber: settings.maxNumberOfRandomSpawn,
    randomSpawnX: new Float32Array(settings.maxNumberOfRandomSpawn),
    randomSpawnY: new Float32Array(settings.maxNumberOfRandomSpawn),
    waveX: new Float32Array(settings.maxNumberOfWaves),
    waveY: new Float32Array(settings.maxNumberOfWaves),
    waveTriggerTimes: new Float32Array(settings.maxNumberOfWaves),
    waveSavedSigmas: new Float32Array(settings.maxNumberOfWaves),
    currentWaveIndex: 0,
    currentActionAreaSizeSigma: 0.18,
    targetActionAreaSizeSigma: 0.18,
    latestSigmaChangeTime: -10,
    transitionTriggerTime: -10,
    colorModeType: 1,
    displayPen: true,
    triggerWave: false,
    soundEnabled: settings.soundEnabled === 1 || settings.soundEnabled === true,
    soundFrequency: settings.soundFrequency,
    soundStrength: settings.soundStrength,
    soundWaveMode: settings.soundWaveMode || 4,
    primeFieldEnabled: Boolean(settings.primeFieldEnabled),
    primeFieldSpeed: Number(settings.primeFieldSpeed ?? 0.35),
    primeFieldStrength: Number(settings.primeFieldStrength ?? 0.6),
    primeFieldSpread: Number(settings.primeFieldSpread ?? 0.45),
    // Sound Wave Towers
    towers: [],
    selectedTowerIndex: -1,
    towerPlacementMode: false,
    maxTowers: 8,
    weaponIndex: 0,
    weaponActions: [],
    canvas,
    debug: {
      enabled: debugDefaultEnabled,
      pending: false,
      frame: 0,
      counterBuffer: null,
      displayBuffer: null,
      logEl: debugLog,
    },
  };

  for (let i = 0; i < settings.maxNumberOfWaves; i += 1) {
    state.waveX[i] = simWidth / 2;
    state.waveY[i] = simHeight / 2;
    state.waveTriggerTimes[i] = -12345;
    state.waveSavedSigmas[i] = state.currentActionAreaSizeSigma;
  }

  setRandomSpawn(state, settings);

  initSimInputs({ canvas, state, settings, simWidth, simHeight });

  configureCanvas(canvas, context, format, device);
  window.addEventListener("resize", () => configureCanvas(canvas, context, format, device));

  const {
    uniformData,
    uniformBuffer,
    counterBuffer,
    particlesBuffer,
    paramsArray,
    paramsBuffer,
    extraData,
    extraOffsets,
    extraBuffer,
    trailRead,
    trailWrite,
    displayTexture,
  } = createGpuResources({
    device,
    simWidth,
    simHeight,
    settings,
    numParticles,
    trailFormat,
    trailBytesPerPixel,
  });

  const waveCount = settings.maxNumberOfWaves;
  const spawnCount = settings.maxNumberOfRandomSpawn;
  const maxTowers = state.maxTowers;

  const pipelines = await createPipelines({
    device,
    format,
    settings: gpuSettings,
    trailFormat,
    supportsStorage16,
    displayBoost,
    uniformBuffer,
    counterBuffer,
    trailRead,
    trailWrite,
    particlesBuffer,
    paramsBuffer,
    extraBuffer,
    displayTexture,
    statusEl,
    appendDebug,
  });

  if (!pipelines) {
    return null;
  }

  const {
    setterPipeline,
    movePipeline,
    depositPipeline,
    diffusionPipeline,
    renderPipeline,
    setterBindGroup,
    moveBindGroups,
    depositBindGroups,
    diffusionBindGroups,
    renderBindGroup,
  } = pipelines;

  const debugSampleCount = 4096;
  let trailIsA = true;

  const startTime = performance.now();
  statusEl.textContent = `WebGPU active - ${qualityLabel} - Particles ${numParticles.toLocaleString()}`;
  if (debugDefaultEnabled && debugLog) {
    debugLog.textContent = "Debug enabled.";
  }

  function frame() {
    state.time = (performance.now() - startTime) / 1000;
    if (state.debug.enabled) {
      state.debug.frame += 1;
    }

    if (state.requestRandomSpawn) {
      setRandomSpawn(state, settings);
      state.requestRandomSpawn = false;
    }

    updateActionAreaSizeSigma(state, settings);
    pointsManager.updateCurrentValuesFromTransitionProgress(currentTransitionProgress(state, settings));

    if (state.triggerWave) {
      const idx = state.currentWaveIndex;
      state.waveX[idx] = state.actionX;
      state.waveY[idx] = state.actionY;
      state.waveTriggerTimes[idx] = state.time;
      state.waveSavedSigmas[idx] = state.currentActionAreaSizeSigma;
      state.currentWaveIndex = (state.currentWaveIndex + 1) % settings.maxNumberOfWaves;
      state.triggerWave = false;
    }

    writePointSettings(pointsManager.currentPointValues[0], paramsArray, 0);
    writePointSettings(pointsManager.currentPointValues[1], paramsArray, PARAMS_DIMENSION);

    buildUniforms(state, settings, uniformData);

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    device.queue.writeBuffer(paramsBuffer, 0, paramsArray);
    for (let i = 0; i < waveCount; i += 1) {
      extraData[extraOffsets.waveX + i] = state.waveX[i];
      extraData[extraOffsets.waveY + i] = state.waveY[i];
      extraData[extraOffsets.waveTrigger + i] = state.waveTriggerTimes[i];
      extraData[extraOffsets.waveSigma + i] = state.waveSavedSigmas[i];
    }
    for (let i = 0; i < spawnCount; i += 1) {
      extraData[extraOffsets.spawnX + i] = state.randomSpawnX[i];
      extraData[extraOffsets.spawnY + i] = state.randomSpawnY[i];
    }
    // Write tower data
    const userTowerCount = Math.min(state.towers.length, maxTowers);
    let primeSlots = 0;
    let primeBaseIndex = 0;
    let primeSpin = 0;
    let primePhase = 0;
    let primeMaxRadius = 0;
    let primeRadius = 0;
    let primeStrength = 0;

    if (state.primeFieldEnabled && userTowerCount < maxTowers) {
      primeSlots = maxTowers - userTowerCount;
      const primeSpeed = clamp(state.primeFieldSpeed ?? 0, 0, 1);
      const primeSpread = clamp(state.primeFieldSpread ?? 0.45, 0.2, 0.7);
      primeStrength = clamp(state.primeFieldStrength ?? 0.6, 0.05, 1.5);
      primeBaseIndex = Math.floor(state.time * primeSpeed * 1.5);
      primeSpin = state.time * primeSpeed * 0.7;
      primePhase = state.time * primeSpeed * 2.0;
      primeMaxRadius = clamp(0.12 + primeSpread * 0.45, 0.12, 0.48);
      primeRadius = clamp(0.08 + primeSpread * 0.12, 0.05, 0.35);
    }

    const totalTowers = userTowerCount + primeSlots;
    extraData[extraOffsets.towerCount] = totalTowers;
    for (let i = 0; i < maxTowers; i += 1) {
      const tower = i < userTowerCount ? state.towers[i] : null;
      const baseIdx = extraOffsets.towerData + i * 6;
      if (tower) {
        extraData[baseIdx + 0] = tower.x;
        extraData[baseIdx + 1] = tower.y;
        extraData[baseIdx + 2] = tower.radius;
        extraData[baseIdx + 3] = tower.frequency;
        extraData[baseIdx + 4] = tower.strength;
        extraData[baseIdx + 5] = tower.pattern;
      } else if (i < totalTowers && primeSlots > 0) {
        const slot = i - userTowerCount;
        const primeIndex = primeBaseIndex + slot;
        const prime = getPrime(primeIndex);
        const angle = GOLDEN_ANGLE * (primeIndex + 1) + primeSpin;
        const spiral = Math.sqrt((slot + 1) / (primeSlots + 1));
        const radius = primeMaxRadius * spiral;
        const x = (0.5 + Math.cos(angle) * radius) * simWidth;
        const y = (0.5 + Math.sin(angle) * radius) * simHeight;
        const pulse = 0.7 + 0.3 * Math.sin(primePhase + primeIndex * 0.9);
        const pattern = SOUND_PATTERN_COUNT > 0 ? prime % SOUND_PATTERN_COUNT : 0;
        extraData[baseIdx + 0] = x;
        extraData[baseIdx + 1] = y;
        extraData[baseIdx + 2] = clamp(
          primeRadius * (0.85 + 0.15 * Math.cos(primeIndex * 0.3)),
          0.05,
          0.4
        );
        extraData[baseIdx + 3] = primeToFrequency(prime);
        extraData[baseIdx + 4] = clamp(primeStrength * pulse, 0.05, 1.5);
        extraData[baseIdx + 5] = pattern;
      } else {
        // Inactive tower
        extraData[baseIdx + 0] = 0;
        extraData[baseIdx + 1] = 0;
        extraData[baseIdx + 2] = 0;
        extraData[baseIdx + 3] = 0;
        extraData[baseIdx + 4] = 0;
        extraData[baseIdx + 5] = 0;
      }
    }
    device.queue.writeBuffer(extraBuffer, 0, extraData);

    const shouldCheckValidation = state.debug.enabled && state.debug.frame % 60 === 0;
    if (shouldCheckValidation) {
      device.pushErrorScope("validation");
    }

    const encoder = device.createCommandEncoder();

    const computePass = encoder.beginComputePass();
    computePass.setPipeline(setterPipeline);
    computePass.setBindGroup(0, setterBindGroup);
    computePass.dispatchWorkgroups(
      Math.ceil(simWidth / gpuSettings.gridWorkgroupSize),
      Math.ceil(simHeight / gpuSettings.gridWorkgroupSize)
    );

    const trailIndex = trailIsA ? 0 : 1;
    computePass.setPipeline(movePipeline);
    computePass.setBindGroup(0, moveBindGroups[trailIndex]);
    computePass.dispatchWorkgroups(
      Math.ceil(numParticles / gpuSettings.particleWorkgroupSize),
      1,
      1
    );

    computePass.setPipeline(depositPipeline);
    computePass.setBindGroup(0, depositBindGroups[trailIndex]);
    computePass.dispatchWorkgroups(
      Math.ceil(simWidth / gpuSettings.gridWorkgroupSize),
      Math.ceil(simHeight / gpuSettings.gridWorkgroupSize)
    );
    computePass.end();
    trailIsA = !trailIsA;

    const blurPasses = Math.max(0, Math.round(settings.blurPasses ?? 1));
    if (blurPasses > 0) {
      const diffusionPass = encoder.beginComputePass();
      diffusionPass.setPipeline(diffusionPipeline);
      for (let i = 0; i < blurPasses; i += 1) {
        const diffIndex = trailIsA ? 0 : 1;
        diffusionPass.setBindGroup(0, diffusionBindGroups[diffIndex]);
        diffusionPass.dispatchWorkgroups(
          Math.ceil(simWidth / gpuSettings.gridWorkgroupSize),
          Math.ceil(simHeight / gpuSettings.gridWorkgroupSize)
        );
        trailIsA = !trailIsA;
      }
      diffusionPass.end();
    }

    if (state.spawnParticles !== 0) {
      state.spawnParticles = 0;
    }

    if (state.debug.enabled && !state.debug.pending && state.debug.frame % 30 === 0) {
      if (!state.debug.counterBuffer) {
        state.debug.counterBuffer = device.createBuffer({
          size: debugSampleCount * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        state.debug.displayBuffer = device.createBuffer({
          size: 256,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
      }

      state.debug.pending = true;
      encoder.copyBufferToBuffer(counterBuffer, 0, state.debug.counterBuffer, 0, debugSampleCount * 4);
      encoder.copyTextureToBuffer(
        { texture: displayTexture, origin: { x: Math.floor(simWidth / 2), y: Math.floor(simHeight / 2) } },
        { buffer: state.debug.displayBuffer, bytesPerRow: 256, rowsPerImage: 1 },
        { width: 1, height: 1, depthOrArrayLayers: 1 }
      );
    }

    const textureView = context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([encoder.finish()]);
    if (shouldCheckValidation) {
      device.popErrorScope().then((error) => {
        if (error) {
          console.error("frame validation error", error);
          statusEl.textContent = `WebGPU validation error: ${error.message}`;
          appendDebug(`error: frame - ${error.message}`);
        }
      });
    }

    if (state.debug.enabled && state.debug.pending) {
      device.queue.onSubmittedWorkDone().then(async () => {
        if (!state.debug.counterBuffer || !state.debug.displayBuffer) {
          state.debug.pending = false;
          return;
        }

        await state.debug.counterBuffer.mapAsync(GPUMapMode.READ);
        const counterData = new Uint32Array(state.debug.counterBuffer.getMappedRange());
        let maxCount = 0;
        let sumCount = 0;
        for (let i = 0; i < counterData.length; i += 1) {
          maxCount = Math.max(maxCount, counterData[i]);
          sumCount += counterData[i];
        }
        state.debug.counterBuffer.unmap();

        await state.debug.displayBuffer.mapAsync(GPUMapMode.READ);
        const pixel = new Uint8Array(state.debug.displayBuffer.getMappedRange(), 0, 4);
        state.debug.displayBuffer.unmap();

        const logLine = `debug: maxCount=${maxCount} sum=${sumCount} centerRGB=${pixel[0]},${pixel[1]},${pixel[2]}`;
        if (state.debug.logEl) {
          state.debug.logEl.textContent = logLine;
        }
        statusEl.textContent = `WebGPU active - ${qualityLabel} - Particles ${numParticles.toLocaleString()} - maxCount ${maxCount}`;
        state.debug.pending = false;
      });
    }

    updatePenIndicator(state, penIndicator, canvas);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return state;
}
