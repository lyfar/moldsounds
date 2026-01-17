export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + t * (b - a);
}

export function writePointSettings(pointData, output, offset) {
  output[offset + 0] = pointData[14];
  output[offset + 1] = pointData[0];
  output[offset + 2] = pointData[1];
  output[offset + 3] = pointData[2];
  output[offset + 4] = pointData[3];
  output[offset + 5] = pointData[4];
  output[offset + 6] = pointData[5];
  output[offset + 7] = pointData[6];
  output[offset + 8] = pointData[7];
  output[offset + 9] = pointData[8];
  output[offset + 10] = pointData[9];
  output[offset + 11] = pointData[10];
  output[offset + 12] = pointData[11];
  output[offset + 13] = pointData[12];
  output[offset + 14] = pointData[13];
}

export function buildUniforms(state, settings, uniforms) {
  uniforms[0] = state.simWidth;
  uniforms[1] = state.simHeight;
  uniforms[2] = state.numParticles;
  uniforms[3] = state.time;
  uniforms[4] = state.currentActionAreaSizeSigma;
  uniforms[5] = state.actionX;
  uniforms[6] = state.actionY;
  uniforms[7] = state.moveBiasActionX;
  uniforms[8] = state.moveBiasActionY;
  uniforms[9] = state.mouseXchange;
  uniforms[10] = state.L2Action;
  uniforms[11] = state.spawnParticles;
  uniforms[12] = settings.spawnFraction;
  uniforms[13] = state.randomSpawnNumber;
  uniforms[14] = settings.pixelScaleFactor;
  uniforms[15] = state.colorModeType;
  uniforms[16] = settings.numberOfColorModes;
  uniforms[17] = settings.depositFactor;
  uniforms[18] = settings.decayFactor;
  uniforms[19] = settings.drawOpacity ?? 1.0;
  uniforms[20] = settings.fillOpacity ?? 0.0;
  uniforms[21] = settings.dotSize ?? 10.0;
  uniforms[22] = settings.blurPasses ?? 1.0;
  uniforms[23] = state.soundFrequency;
  uniforms[24] = state.soundStrength;
  uniforms[25] = state.soundEnabled ? 1.0 : 0.0;
  uniforms[26] = state.soundWaveMode || 4;
  uniforms[27] = 0.0;
}

export function setRandomSpawn(state, settings) {
  state.randomSpawnNumber = settings.maxNumberOfRandomSpawn;
  for (let i = 0; i < state.randomSpawnNumber; i += 1) {
    const theta = Math.random() * Math.PI * 2.0;
    const r = Math.sqrt(Math.random());
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    state.randomSpawnX[i] = x;
    state.randomSpawnY[i] = y;
  }
}

export function setVortexSpawn(state, settings) {
  state.randomSpawnNumber = settings.maxNumberOfRandomSpawn;
  const arms = 3 + Math.floor(Math.random() * 3);
  const tightness = 2 + Math.random() * 4;
  for (let i = 0; i < state.randomSpawnNumber; i += 1) {
    const t = i / state.randomSpawnNumber;
    const baseAngle = t * Math.PI * 2 * arms;
    const spiralR = 0.1 + t * 0.8;
    const angle = baseAngle + spiralR * tightness;
    const x = spiralR * Math.cos(angle);
    const y = spiralR * Math.sin(angle);
    state.randomSpawnX[i] = x;
    state.randomSpawnY[i] = y;
  }
}

export function setPulseSpawn(state, settings) {
  state.randomSpawnNumber = settings.maxNumberOfRandomSpawn;
  for (let i = 0; i < state.randomSpawnNumber; i += 1) {
    const theta = Math.random() * Math.PI * 2.0;
    const r = 0.05 + Math.random() * 0.15;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    state.randomSpawnX[i] = x;
    state.randomSpawnY[i] = y;
  }
}

export function createParticlesBuffer(numParticles, width, height) {
  const packed = new Float32Array(numParticles * 6);
  for (let i = 0; i < numParticles; i += 1) {
    const base = i * 6;
    packed[base] = Math.random() * width;
    packed[base + 1] = Math.random() * height;
    packed[base + 2] = Math.random() * Math.PI * 2.0;
    packed[base + 3] = Math.random();
    packed[base + 4] = 0;
    packed[base + 5] = 0;
  }
  return packed;
}

export function updatePenIndicator(state, penEl, canvas) {
  if (!penEl) {
    return;
  }
  if (!state.displayPen) {
    penEl.style.opacity = "0";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const parentRect = (penEl.offsetParent || canvas.offsetParent || canvas.parentElement)?.getBoundingClientRect();
  const offsetLeft = parentRect ? rect.left - parentRect.left : rect.left;
  const offsetTop = parentRect ? rect.top - parentRect.top : rect.top;
  
  // Use uniform scale to keep pen circular
  const scale = Math.min(rect.width / state.simWidth, rect.height / state.simHeight);
  const pulse = 1.0 + 0.04 * Math.sin(state.time * 2.4);
  const radius = state.currentActionAreaSizeSigma * state.simHeight * pulse * scale;

  // Use stored screen position directly (mouseXchange for X, screenY for Y)
  const screenX = state.mouseXchange;
  const screenY = state.screenY;

  penEl.style.opacity = "1";
  penEl.style.width = `${radius * 2}px`;
  penEl.style.height = `${radius * 2}px`;
  penEl.style.left = `${offsetLeft + screenX * rect.width}px`;
  penEl.style.top = `${offsetTop + screenY * rect.height}px`;
}

export function updateActionAreaSizeSigma(state, settings) {
  const lerpFactor = Math.pow(
    clamp((state.time - state.latestSigmaChangeTime) / settings.actionSigmaChangeDuration, 0, 1),
    1.7
  );
  state.currentActionAreaSizeSigma = lerp(
    state.currentActionAreaSizeSigma,
    state.targetActionAreaSizeSigma,
    lerpFactor
  );
}

export function currentTransitionProgress(state, settings) {
  return clamp((state.time - state.transitionTriggerTime) / settings.transitionDuration, 0, 1);
}

export function writeZeroTexture(device, texture, width, height, bytesPerPixel) {
  const bytesPerRow = Math.ceil((width * bytesPerPixel) / 256) * 256;
  const zeroData = new Uint8Array(bytesPerRow * height);
  device.queue.writeTexture(
    { texture },
    zeroData,
    { bytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 }
  );
}
