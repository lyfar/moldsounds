import { createShaders } from "./shaders.js";
import { initWebGPU, configureCanvas } from "./gpu.js";
import { PARAMS_DIMENSION, SOUND_WAVE_MODES } from "./config.js";
import {
  buildUniforms,
  writePointSettings,
  setRandomSpawn,
  createParticlesBuffer,
  updateActionAreaSizeSigma,
  currentTransitionProgress,
  updatePenIndicator,
  writeZeroTexture,
  clamp,
} from "./utils.js";

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

  const updateActionFromPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    // Direct mapping - no flips. Y=0 is top of screen and simulation.
    state.actionX = clampedX * simWidth;
    state.actionY = clampedY * simHeight;
    state.mouseXchange = clampedX;
    state.screenY = clampedY;
  };

  const updateActionFromTouch = (touch) => {
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    state.actionX = clampedX * simWidth;
    state.actionY = clampedY * simHeight;
    state.mouseXchange = clampedX;
    state.screenY = clampedY;
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointermove", (event) => {
    // Ignore secondary touch points (multi-touch)
    if (event.pointerType === "touch" && event.isPrimary === false) {
      return;
    }
    // Only handle events that target the canvas itself
    if (event.target !== canvas) {
      return;
    }
    // Prevent default to stop scrolling/panning on mobile during drag
    event.preventDefault();
    updateActionFromPointer(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    // Ignore secondary touch points (multi-touch)
    if (event.pointerType === "touch" && event.isPrimary === false) {
      return;
    }
    // Only handle events that target the canvas itself
    if (event.target !== canvas) {
      return;
    }
    // Prevent default to stop double-tap zoom on mobile
    event.preventDefault();
    
    updateActionFromPointer(event);
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
    // For mouse, only respond to left button
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    // Fire weapon action for both mouse and touch
    const action = state.weaponActions[state.weaponIndex];
    if (typeof action === "function") {
      action("pointer");
    } else {
      state.spawnParticles = 2;
      setRandomSpawn(state, settings);
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (canvas.releasePointerCapture) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  if (!("PointerEvent" in window)) {
    let activeTouchId = null;
    const findTouchById = (touchList, identifier) => {
      for (let i = 0; i < touchList.length; i += 1) {
        if (touchList[i].identifier === identifier) {
          return touchList[i];
        }
      }
      return null;
    };

    const handleTouchStart = (event) => {
      if (activeTouchId === null && event.touches.length > 0) {
        activeTouchId = event.touches[0].identifier;
        updateActionFromTouch(event.touches[0]);
      } else if (activeTouchId !== null) {
        const touch = findTouchById(event.touches, activeTouchId);
        if (touch) {
          updateActionFromTouch(touch);
        }
      }
      event.preventDefault();
    };

    const handleTouchMove = (event) => {
      let touch = null;
      if (activeTouchId !== null) {
        touch = findTouchById(event.touches, activeTouchId);
      }
      if (!touch && event.touches.length > 0) {
        touch = event.touches[0];
        activeTouchId = touch.identifier;
      }
      if (touch) {
        updateActionFromTouch(touch);
      }
      event.preventDefault();
    };

    const handleTouchEnd = (event) => {
      if (activeTouchId === null) {
        return;
      }
      const touch = findTouchById(event.touches, activeTouchId);
      if (!touch) {
        activeTouchId = null;
      }
      event.preventDefault();
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
  }

  configureCanvas(canvas, context, format, device);
  window.addEventListener("resize", () => configureCanvas(canvas, context, format, device));

  const uniformData = new Float32Array(28);
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const counterBuffer = device.createBuffer({
    size: simWidth * simHeight * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });

  const particlesData = createParticlesBuffer(numParticles, simWidth, simHeight);
  const particlesBuffer = device.createBuffer({
    size: particlesData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(particlesBuffer, 0, particlesData);

  const paramsArray = new Float32Array(2 * PARAMS_DIMENSION);
  const paramsBuffer = device.createBuffer({
    size: paramsArray.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const waveCount = settings.maxNumberOfWaves;
  const spawnCount = settings.maxNumberOfRandomSpawn;
  const maxTowers = 8;
  // Extra data: waves (4 arrays) + spawn (2 arrays) + towers (6 values each) + tower count
  const extraData = new Float32Array(waveCount * 4 + spawnCount * 2 + maxTowers * 6 + 1);
  const extraOffsets = {
    waveX: 0,
    waveY: waveCount,
    waveTrigger: waveCount * 2,
    waveSigma: waveCount * 3,
    spawnX: waveCount * 4,
    spawnY: waveCount * 4 + spawnCount,
    towerCount: waveCount * 4 + spawnCount * 2,
    // Each tower: x, y, radius, frequency, strength, pattern
    towerData: waveCount * 4 + spawnCount * 2 + 1,
  };
  const extraBuffer = device.createBuffer({
    size: extraData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const trailRead = device.createTexture({
    size: [simWidth, simHeight],
    format: trailFormat,
    usage:
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });

  const trailWrite = device.createTexture({
    size: [simWidth, simHeight],
    format: trailFormat,
    usage:
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST,
  });

  const displayTexture = device.createTexture({
    size: [simWidth, simHeight],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
  });

  writeZeroTexture(device, trailRead, simWidth, simHeight, trailBytesPerPixel);
  writeZeroTexture(device, trailWrite, simWidth, simHeight, trailBytesPerPixel);
  writeZeroTexture(device, displayTexture, simWidth, simHeight, 4);

  const reportShaderIssues = async (module, label) => {
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((msg) => msg.type === "error");
    if (errors.length) {
      console.error(`${label} shader errors`, errors);
      const first = errors[0];
      const loc = Number.isFinite(first.lineNum) ? `:${first.lineNum}:${first.linePos || 0}` : "";
      statusEl.textContent = `Shader error in ${label}${loc}: ${first.message}`;
      appendDebug(`shader error (${label}${loc}): ${first.message}`);
      for (const err of errors.slice(1, 4)) {
        const errLoc = Number.isFinite(err.lineNum) ? `:${err.lineNum}:${err.linePos || 0}` : "";
        appendDebug(`shader error (${label}${errLoc}): ${err.message}`);
      }
    }
    return errors.length;
  };

  const shaders = createShaders({
    ...gpuSettings,
    trailStorageFormat: trailFormat,
    trailClampMax: supportsStorage16 ? 1000.0 : 1.0,
    displayBoost,
  });
  const setterModule = device.createShaderModule({ label: "setter", code: shaders.setter });
  const moveModule = device.createShaderModule({ label: "move", code: shaders.move });
  const depositModule = device.createShaderModule({ label: "deposit", code: shaders.deposit });
  const diffusionModule = device.createShaderModule({ label: "diffusion", code: shaders.diffusion });
  const renderModule = device.createShaderModule({ label: "render", code: shaders.render });

  const shaderErrorCounts = await Promise.all([
    reportShaderIssues(setterModule, "setter"),
    reportShaderIssues(moveModule, "move"),
    reportShaderIssues(depositModule, "deposit"),
    reportShaderIssues(diffusionModule, "diffusion"),
    reportShaderIssues(renderModule, "render"),
  ]);

  if (shaderErrorCounts.some((count) => count > 0)) {
    appendDebug("error: shader compilation failed; aborting.");
    return null;
  }

  const createWithValidation = async (label, createFn) => {
    device.pushErrorScope("validation");
    let result;
    let thrown = null;
    try {
      result = await createFn();
    } catch (error) {
      thrown = error;
    }
    const scopeError = await device.popErrorScope();
    if (scopeError) {
      console.error(`${label} validation error`, scopeError);
      appendDebug(`error: ${label} - ${scopeError.message}`);
    }
    if (thrown) {
      const message = thrown.message || thrown;
      console.error(`${label} create error`, thrown);
      appendDebug(`error: ${label} - ${message}`);
    }
    if (scopeError || thrown) {
      statusEl.textContent = `WebGPU pipeline error: ${label}`;
      throw scopeError || thrown;
    }
    return result;
  };

  const createComputePipeline = (descriptor) =>
    device.createComputePipelineAsync
      ? device.createComputePipelineAsync(descriptor)
      : device.createComputePipeline(descriptor);

  const createRenderPipeline = (descriptor) =>
    device.createRenderPipelineAsync
      ? device.createRenderPipelineAsync(descriptor)
      : device.createRenderPipeline(descriptor);

  let setterPipeline;
  let movePipeline;
  let depositPipeline;
  let diffusionPipeline;
  let renderPipeline;
  let setterBindGroup;
  let moveBindGroups;
  let depositBindGroups;
  let diffusionBindGroups;
  let renderBindGroup;

  try {
    setterPipeline = await createWithValidation("setter pipeline", () =>
      createComputePipeline({
        label: "setter pipeline",
        layout: "auto",
        compute: { module: setterModule, entryPoint: "main" },
      })
    );

    movePipeline = await createWithValidation("move pipeline", () =>
      createComputePipeline({
        label: "move pipeline",
        layout: "auto",
        compute: { module: moveModule, entryPoint: "main" },
      })
    );

    depositPipeline = await createWithValidation("deposit pipeline", () =>
      createComputePipeline({
        label: "deposit pipeline",
        layout: "auto",
        compute: { module: depositModule, entryPoint: "main" },
      })
    );

    diffusionPipeline = await createWithValidation("diffusion pipeline", () =>
      createComputePipeline({
        label: "diffusion pipeline",
        layout: "auto",
        compute: { module: diffusionModule, entryPoint: "main" },
      })
    );

    setterBindGroup = await createWithValidation("setter bind group", () =>
      device.createBindGroup({
        label: "setter bind group",
        layout: setterPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: counterBuffer } },
        ],
      })
    );

    moveBindGroups = [
      await createWithValidation("move bind group A", () =>
        device.createBindGroup({
          label: "move bind group A",
          layout: movePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: trailRead.createView() },
            { binding: 2, resource: { buffer: counterBuffer } },
            { binding: 3, resource: { buffer: particlesBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } },
            { binding: 5, resource: { buffer: extraBuffer } },
          ],
        })
      ),
      await createWithValidation("move bind group B", () =>
        device.createBindGroup({
          label: "move bind group B",
          layout: movePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: trailWrite.createView() },
            { binding: 2, resource: { buffer: counterBuffer } },
            { binding: 3, resource: { buffer: particlesBuffer } },
            { binding: 4, resource: { buffer: paramsBuffer } },
            { binding: 5, resource: { buffer: extraBuffer } },
          ],
        })
      ),
    ];

    depositBindGroups = [
      await createWithValidation("deposit bind group A", () =>
        device.createBindGroup({
          label: "deposit bind group A",
          layout: depositPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: counterBuffer } },
            { binding: 2, resource: trailRead.createView() },
            { binding: 3, resource: trailWrite.createView() },
            { binding: 4, resource: displayTexture.createView() },
          ],
        })
      ),
      await createWithValidation("deposit bind group B", () =>
        device.createBindGroup({
          label: "deposit bind group B",
          layout: depositPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: { buffer: counterBuffer } },
            { binding: 2, resource: trailWrite.createView() },
            { binding: 3, resource: trailRead.createView() },
            { binding: 4, resource: displayTexture.createView() },
          ],
        })
      ),
    ];

    diffusionBindGroups = [
      await createWithValidation("diffusion bind group A", () =>
        device.createBindGroup({
          label: "diffusion bind group A",
          layout: diffusionPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: trailRead.createView() },
            { binding: 2, resource: trailWrite.createView() },
          ],
        })
      ),
      await createWithValidation("diffusion bind group B", () =>
        device.createBindGroup({
          label: "diffusion bind group B",
          layout: diffusionPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: trailWrite.createView() },
            { binding: 2, resource: trailRead.createView() },
          ],
        })
      ),
    ];

    renderPipeline = await createWithValidation("render pipeline", () =>
      createRenderPipeline({
        label: "render pipeline",
        layout: "auto",
        vertex: { module: renderModule, entryPoint: "vs" },
        fragment: {
          module: renderModule,
          entryPoint: "fs",
          targets: [{ format }],
        },
        primitive: { topology: "triangle-list" },
      })
    );

    const displaySampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
    renderBindGroup = await createWithValidation("render bind group", () =>
      device.createBindGroup({
        label: "render bind group",
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: displaySampler },
          { binding: 1, resource: displayTexture.createView() },
        ],
      })
    );
  } catch (error) {
    appendDebug("error: pipeline creation failed; simulation halted.");
    return null;
  }

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
