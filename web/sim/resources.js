import { PARAMS_DIMENSION } from "../config.js";
import { createParticlesBuffer, writeZeroTexture } from "../utils.js";

export function createGpuResources({
  device,
  simWidth,
  simHeight,
  settings,
  numParticles,
  trailFormat,
  trailBytesPerPixel,
}) {
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
  const extraData = new Float32Array(waveCount * 4 + spawnCount * 2 + maxTowers * 6 + 1);
  const extraOffsets = {
    waveX: 0,
    waveY: waveCount,
    waveTrigger: waveCount * 2,
    waveSigma: waveCount * 3,
    spawnX: waveCount * 4,
    spawnY: waveCount * 4 + spawnCount,
    towerCount: waveCount * 4 + spawnCount * 2,
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

  return {
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
  };
}
