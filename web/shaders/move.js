export const createMoveShader = ({
  maxNumberOfWaves,
  maxNumberOfRandomSpawn,
  particleWorkgroupSize,
}) => `
const MAX_NUMBER_OF_WAVES: u32 = ${maxNumberOfWaves}u;
const MAX_NUMBER_OF_RANDOM_SPAWN: u32 = ${maxNumberOfRandomSpawn}u;
const PI: f32 = 3.141592;

struct SimUniforms {
  width: f32,
  height: f32,
  numParticles: f32,
  time: f32,
  actionAreaSizeSigma: f32,
  actionX: f32,
  actionY: f32,
  moveBiasActionX: f32,
  moveBiasActionY: f32,
  mouseXchange: f32,
  L2Action: f32,
  spawnParticles: f32,
  spawnFraction: f32,
  randomSpawnNumber: f32,
  pixelScaleFactor: f32,
  colorModeType: f32,
  numberOfColorModes: f32,
  depositFactor: f32,
  decayFactor: f32,
  drawOpacity: f32,
  fillOpacity: f32,
  dotSize: f32,
  blurPasses: f32,
  soundFrequency: f32,
  soundStrength: f32,
  soundEnabled: f32,
  soundWaveMode: f32,
  pad0: f32,
};

struct PointSettings {
  defaultScalingFactor: f32,
  SensorDistance0: f32,
  SD_exponent: f32,
  SD_amplitude: f32,
  SensorAngle0: f32,
  SA_exponent: f32,
  SA_amplitude: f32,
  RotationAngle0: f32,
  RA_exponent: f32,
  RA_amplitude: f32,
  MoveDistance0: f32,
  MD_exponent: f32,
  MD_amplitude: f32,
  SensorBias1: f32,
  SensorBias2: f32,
};

struct SoundTower {
  x: f32,
  y: f32,
  radius: f32,
  frequency: f32,
  strength: f32,
  pattern: f32,
};

struct ExtraData {
  waveX: array<f32, ${maxNumberOfWaves}>,
  waveY: array<f32, ${maxNumberOfWaves}>,
  waveTriggerTimes: array<f32, ${maxNumberOfWaves}>,
  waveSavedSigmas: array<f32, ${maxNumberOfWaves}>,
  randomSpawnX: array<f32, ${maxNumberOfRandomSpawn}>,
  randomSpawnY: array<f32, ${maxNumberOfRandomSpawn}>,
  towerCount: f32,
  towers: array<SoundTower, 8>,
};

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var trailRead: texture_2d<f32>;
@group(0) @binding(2) var<storage, read_write> particlesCounter: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> particlesArray: array<f32>;
@group(0) @binding(4) var<storage, read> params: array<PointSettings>;
@group(0) @binding(5) var<storage, read> extras: ExtraData;

fn fmod(x: f32, y: f32) -> f32 {
  return x - y * floor(x / y);
}

fn fmod2(x: vec2<f32>, y: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(fmod(x.x, y.x), fmod(x.y, y.y));
}

// Calculate sound pattern at a position relative to a tower center
fn calcSoundPattern(
  localX: f32, localY: f32, // Position relative to tower center (-0.5 to 0.5 in tower radius)
  freq: f32, strength: f32, pattern: i32, time: f32, aspectRatio: f32
) -> f32 {
  let freqNorm = (freq - 20.0) / 1980.0;
  let baseK = 3.0 + freqNorm * 12.0;
  let timePhase = time * (0.5 + freqNorm * 2.0);
  
  // Apply aspect ratio correction to Y to maintain circular patterns on screen
  // On portrait screens (aspectRatio > 1), multiply localY by aspectRatio
  // so that equal pixel distances produce equal pattern coordinates
  let cx = localX;
  let cy = localY * aspectRatio;
  let r = sqrt(cx * cx + cy * cy);
  let theta = atan2(cy, cx);
  
  // Chladni pattern
  let m = 2.0 + floor(freqNorm * 6.0);
  let n = 3.0 + floor(freqNorm * 5.0);
  let chX = cx + 0.5;
  let chY = cy + 0.5;
  let ch1 = sin(m * PI * chX) * sin(n * PI * chY);
  let ch2 = sin(n * PI * chX) * sin(m * PI * chY);
  let chladni = (ch1 + ch2) * cos(timePhase * 0.5);
  
  // Cymatics pattern
  let radialFreq = baseK * 2.5;
  let angularMode = floor(3.0 + freqNorm * 8.0);
  let radial = cos(radialFreq * r * PI) * exp(-r * 2.0);
  let angular = cos(angularMode * theta + timePhase);
  let cymatics = radial * (0.6 + 0.4 * angular);
  
  // Spiral pattern
  let spiralArms = 2.0 + floor(freqNorm * 4.0);
  let spiralTight = 4.0 + freqNorm * 8.0;
  let spiralPh = spiralArms * theta + spiralTight * r * PI - timePhase * 1.5;
  let spiral = sin(spiralPh) * exp(-r * 1.5);
  
  // Standing waves
  let k1 = baseK * PI;
  let k2 = baseK * PI * 1.414;
  let st1 = sin(k1 * cx + timePhase * 0.3) * sin(k1 * cy - timePhase * 0.3);
  let st2 = sin(k2 * (cx + cy) * 0.707) * sin(k2 * (cx - cy) * 0.707 + timePhase * 0.2);
  let standing = (st1 + st2 * 0.5) * 0.67;
  
  // Select pattern
  if (pattern == 0) {
    return chladni * strength;
  } else if (pattern == 1) {
    return cymatics * 1.5 * strength;
  } else if (pattern == 2) {
    return spiral * 1.2 * strength;
  } else if (pattern == 3) {
    return standing * 1.3 * strength;
  } else {
    // Auto blend
    let low = max(0.0, 1.0 - freqNorm * 3.0);
    let mid = max(0.0, 1.0 - abs(freqNorm - 0.5) * 3.0);
    let high = max(0.0, (freqNorm - 0.5) * 2.0);
    let total = low + mid + high + 0.001;
    return (chladni * low + cymatics * mid * 1.5 + spiral * high + standing * 0.3) / total * strength;
  }
}

fn random3(st: vec3<f32>) -> f32 {
  return fract(sin(dot(st, vec3<f32>(12.9898, 78.233, 151.7182))) * 43758.5453123);
}

fn noise(st: vec3<f32>) -> f32 {
  let i = floor(st);
  let f = fract(st);
  let a = random3(i);
  let b = random3(i + vec3<f32>(1.0, 0.0, 0.0));
  let c = random3(i + vec3<f32>(0.0, 1.0, 0.0));
  let d = random3(i + vec3<f32>(1.0, 1.0, 0.0));
  let e = random3(i + vec3<f32>(0.0, 0.0, 1.0));
  let f2 = random3(i + vec3<f32>(1.0, 0.0, 1.0));
  let g = random3(i + vec3<f32>(0.0, 1.0, 1.0));
  let h = random3(i + vec3<f32>(1.0, 1.0, 1.0));
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
    mix(mix(e, f2, u.x), mix(g, h, u.x), u.y),
    u.z
  );
}

fn pcg_hash(v: u32) -> u32 {
  var state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn randFloat(state: ptr<function, u32>) -> f32 {
  (*state) = pcg_hash(*state);
  return f32(*state) * (1.0 / 4294967296.0);
}

fn randomPosFromParticle(particlePos: vec2<f32>) -> vec2<f32> {
  let ipos = vec2<i32>(floor(particlePos));
  let seed = (u32(ipos.x) & 0xFFFFu) | ((u32(ipos.y) & 0xFFFFu) << 16u);
  var state = seed;
  let rx = randFloat(&state);
  let ry = randFloat(&state);
  return vec2<f32>(rx * sim.width, ry * sim.height);
}

fn random01FromParticle(particlePos: vec2<f32>) -> f32 {
  let ipos = vec2<i32>(floor(particlePos));
  let seed = (u32(ipos.x) & 0xFFFFu) | ((u32(ipos.y) & 0xFFFFu) << 16u);
  var state = seed;
  return randFloat(&state);
}

fn getGridValue(pos: vec2<f32>) -> f32 {
  let width = sim.width;
  let height = sim.height;
  let ix = i32(floor(fmod(pos.x + 0.5 + width, width)));
  let iy = i32(floor(fmod(pos.y + 0.5 + height, height)));
  return textureLoad(trailRead, vec2<i32>(ix, iy), 0).x;
}

fn senseFromAngle(angle: f32, pos: vec2<f32>, heading: f32, so: f32) -> f32 {
  return getGridValue(vec2<f32>(pos.x + so * cos(heading + angle), pos.y + so * sin(heading + angle)));
}

fn propagatedWaveFunction(x: f32, sigma: f32) -> f32 {
  let waveSigma = 0.15 + 0.4 * sigma;
  return select(0.0, exp(-x * x / waveSigma / waveSigma), x <= 0.0);
}

@compute @workgroup_size(${particleWorkgroupSize}, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let particleIndex = id.x;
  if (particleIndex >= u32(sim.numParticles)) {
    return;
  }

  let width = sim.width;
  let height = sim.height;
  let base = i32(particleIndex) * 6;

  let currentParams_1 = params[1];
  let currentParams_2 = params[0];

  let particlePos = vec2<f32>(particlesArray[base], particlesArray[base + 1]);
  let heading = particlesArray[base + 2];
  let curA = particlesArray[base + 3];
  let velocity = vec2<f32>(particlesArray[base + 4], particlesArray[base + 5]);

  let direction = vec2<f32>(cos(heading), sin(heading));

  let normalizedPosition = vec2<f32>(particlePos.x / width, particlePos.y / height);
  let normalizedActionPosition = vec2<f32>(sim.actionX / width, sim.actionY / height);

  var positionForNoise1 = normalizedPosition;
  positionForNoise1.x *= width / height;
  var positionForNoise2 = positionForNoise1;
  let noiseScale = 20.0;
  positionForNoise1 *= noiseScale;
  let noiseScale2 = 6.0;
  positionForNoise2 *= noiseScale2;

  var positionFromAction = normalizedPosition - normalizedActionPosition;
  positionFromAction.x *= width / height;
  let distanceNoiseFactor = 0.9 + 0.2 * noise(vec3<f32>(positionForNoise2.x, positionForNoise2.y, 0.6 * sim.time));
  let distanceFromAction = distance(positionFromAction, vec2<f32>(0.0)) * distanceNoiseFactor;
  let lerper = exp(-distanceFromAction * distanceFromAction / sim.actionAreaSizeSigma / sim.actionAreaSizeSigma);

  var waveSum = 0.0;
  let noiseVariationFactor = 0.95 + 0.1 * noise(vec3<f32>(positionForNoise1.x, positionForNoise1.y, 0.3 * sim.time));
  let maxWaveTime = 5.0;

  for (var i: u32 = 0u; i < MAX_NUMBER_OF_WAVES; i = i + 1u) {
    if ((sim.time - extras.waveTriggerTimes[i]) <= maxWaveTime) {
      let normalizedWaveCenter = vec2<f32>(extras.waveX[i] / width, extras.waveY[i] / height);
      var relDiffWave = normalizedPosition - normalizedWaveCenter;
      relDiffWave.x *= width / height;
      let diffDistWave = distance(relDiffWave, vec2<f32>(0.0));
      let angleToCenter = atan2(relDiffWave.y, relDiffWave.x);
      let dir = select(1.0, -1.0, (i % 2u) == 1u);
      let delay = -0.1 + diffDistWave / 0.3 * noiseVariationFactor + 0.4 * pow(0.5 + 0.5 * cos(18.0 * angleToCenter + 10.0 * dir * diffDistWave), 0.3);
      let varWave = delay - (sim.time - extras.waveTriggerTimes[i]);
      let sigmaVariation = pow(extras.waveSavedSigmas[i], 0.75);
      waveSum += 0.6 * propagatedWaveFunction(varWave, extras.waveSavedSigmas[i]) * max(0.0, 1.0 - 0.3 * diffDistWave / sigmaVariation * noiseVariationFactor);
    }
  }

  waveSum = 1.7 * tanh(waveSum / 1.7) + 0.4 * tanh(4.0 * waveSum);

  var tunedSensorScaler_1 = currentParams_1.defaultScalingFactor;
  var tunedSensorScaler_2 = currentParams_2.defaultScalingFactor;
  var tunedSensorScaler_mix = mix(tunedSensorScaler_1, tunedSensorScaler_2, lerper);
  tunedSensorScaler_mix *= 1.0 + 0.3 * waveSum;

  let SensorBias1_mix = mix(currentParams_1.SensorBias1, currentParams_2.SensorBias1, lerper);
  let SensorBias2_mix = mix(currentParams_1.SensorBias2, currentParams_2.SensorBias2, lerper);

  var currentSensedValue = getGridValue(particlePos + SensorBias2_mix * direction + vec2<f32>(0.0, SensorBias1_mix)) * tunedSensorScaler_mix;
  currentSensedValue = clamp(currentSensedValue, 0.000000001, 1.0);

  let SensorDistance0_mix = mix(currentParams_1.SensorDistance0, currentParams_2.SensorDistance0, lerper);
  let SD_amplitude_mix = mix(currentParams_1.SD_amplitude, currentParams_2.SD_amplitude, lerper);
  let SD_exponent_mix = mix(currentParams_1.SD_exponent, currentParams_2.SD_exponent, lerper);

  let MoveDistance0_mix = mix(currentParams_1.MoveDistance0, currentParams_2.MoveDistance0, lerper);
  let MD_amplitude_mix = mix(currentParams_1.MD_amplitude, currentParams_2.MD_amplitude, lerper);
  let MD_exponent_mix = mix(currentParams_1.MD_exponent, currentParams_2.MD_exponent, lerper);

  let SensorAngle0_mix = mix(currentParams_1.SensorAngle0, currentParams_2.SensorAngle0, lerper);
  let SA_amplitude_mix = mix(currentParams_1.SA_amplitude, currentParams_2.SA_amplitude, lerper);
  let SA_exponent_mix = mix(currentParams_1.SA_exponent, currentParams_2.SA_exponent, lerper);

  let RotationAngle0_mix = mix(currentParams_1.RotationAngle0, currentParams_2.RotationAngle0, lerper);
  let RA_amplitude_mix = mix(currentParams_1.RA_amplitude, currentParams_2.RA_amplitude, lerper);
  let RA_exponent_mix = mix(currentParams_1.RA_exponent, currentParams_2.RA_exponent, lerper);

  let sensorDistance = SensorDistance0_mix + SD_amplitude_mix * pow(currentSensedValue, SD_exponent_mix) * sim.pixelScaleFactor;
  let moveDistance = MoveDistance0_mix + MD_amplitude_mix * pow(currentSensedValue, MD_exponent_mix) * sim.pixelScaleFactor;
  let sensorAngle = SensorAngle0_mix + SA_amplitude_mix * pow(currentSensedValue, SA_exponent_mix);
  let rotationAngle = RotationAngle0_mix + RA_amplitude_mix * pow(currentSensedValue, RA_exponent_mix);

  let sensedLeft = senseFromAngle(-sensorAngle, particlePos, heading, sensorDistance);
  let sensedMiddle = senseFromAngle(0.0, particlePos, heading, sensorDistance);
  let sensedRight = senseFromAngle(sensorAngle, particlePos, heading, sensorDistance);

  var newHeading = heading;
  if (sensedMiddle > sensedLeft && sensedMiddle > sensedRight) {
  } else if (sensedMiddle < sensedLeft && sensedMiddle < sensedRight) {
    newHeading = select(heading - rotationAngle, heading + rotationAngle, random01FromParticle(particlePos) >= 0.5);
  } else if (sensedRight < sensedLeft) {
    newHeading = heading - rotationAngle;
  } else if (sensedLeft < sensedRight) {
    newHeading = heading + rotationAngle;
  }

  // Sound wave towers system
  var soundDir = vec2<f32>(0.0);
  var soundFieldStrength = 0.0;
  let aspectRatio = height / width;
  let towerCount = i32(extras.towerCount + 0.5);
  
  // Check if we have towers or use global sound
  let hasTowers = towerCount > 0;
  let useGlobalSound = sim.soundEnabled > 0.5 && !hasTowers;
  
  if (hasTowers || useGlobalSound) {
    var totalPattern = 0.0;
    var totalPatternDx = 0.0;
    var totalPatternDy = 0.0;
    let e = 0.008;
    
    if (hasTowers) {
      // Loop through all towers
      for (var t = 0; t < 8; t++) {
        if (t >= towerCount) { break; }
        
        let tower = extras.towers[t];
        if (tower.strength < 0.01 || tower.radius < 0.01) { continue; }
        
        // Calculate distance from particle to tower center
        let towerCenterX = tower.x / width;
        let towerCenterY = tower.y / height;
        let dx = normalizedPosition.x - towerCenterX;
        let dy = normalizedPosition.y - towerCenterY;
        // Apply aspect ratio correction to Y to make circles appear round on screen
        // On portrait screens (aspectRatio > 1), multiply dy by aspectRatio so that
        // equal pixel distances produce equal normalized distances
        let dyAspect = dy * aspectRatio;
        let dist = sqrt(dx * dx + dyAspect * dyAspect);
        
        // Tower radius in normalized coordinates
        let radiusNorm = tower.radius;

        // Falloff based on distance from tower (squared for smooth falloff)
        let rawFalloff = max(0.0, 1.0 - dist / radiusNorm);
        let falloff = rawFalloff * rawFalloff;

        if (falloff > 0.01) {
          // Local position relative to tower center
          let localX = dx / radiusNorm;
          let localY = dy / radiusNorm;
          
          let pattern = i32(tower.pattern + 0.5);
          let p = calcSoundPattern(localX, localY, tower.frequency, tower.strength, pattern, sim.time, aspectRatio);
          let pDx = calcSoundPattern(localX + e, localY, tower.frequency, tower.strength, pattern, sim.time, aspectRatio);
          let pDy = calcSoundPattern(localX, localY + e, tower.frequency, tower.strength, pattern, sim.time, aspectRatio);
          
          totalPattern += p * falloff;
          totalPatternDx += pDx * falloff;
          totalPatternDy += pDy * falloff;
        }
      }
    } else {
      // Global sound mode (backward compatible - centered)
      let localX = normalizedPosition.x - 0.5;
      let localY = normalizedPosition.y - 0.5;
      let pattern = i32(sim.soundWaveMode + 0.5);
      
      totalPattern = calcSoundPattern(localX, localY, sim.soundFrequency, sim.soundStrength, pattern, sim.time, aspectRatio);
      totalPatternDx = calcSoundPattern(localX + e, localY, sim.soundFrequency, sim.soundStrength, pattern, sim.time, aspectRatio);
      totalPatternDy = calcSoundPattern(localX, localY + e, sim.soundFrequency, sim.soundStrength, pattern, sim.time, aspectRatio);
    }
    
    soundFieldStrength = totalPattern;
    
    // Calculate gradient for particle steering
    let grad = vec2<f32>(totalPatternDx - totalPattern, totalPatternDy - totalPattern);
    let gradLen = length(grad);
    
    if (gradLen > 0.0001) {
      soundDir = grad / gradLen;
      let targetHeading = atan2(soundDir.y, soundDir.x);
      let effectiveStrength = select(sim.soundStrength, 0.8, hasTowers);
      let strength = effectiveStrength * (0.8 + 0.6 * abs(soundFieldStrength));
      newHeading = mix(newHeading, targetHeading, min(strength, 0.95));
    }
  }

  let noiseValue = noise(vec3<f32>(positionForNoise1.x, positionForNoise1.y, 0.8 * sim.time));
  let moveBiasFactor = 5.0 * lerper * noiseValue;
  let moveBias = moveBiasFactor * vec2<f32>(sim.moveBiasActionX, sim.moveBiasActionY);

  let classicNewPositionX = particlePos.x + moveDistance * cos(newHeading) + moveBias.x;
  let classicNewPositionY = particlePos.y + moveDistance * sin(newHeading) + moveBias.y;

  var nextVelocity = velocity * 0.98;
  let vf = 1.0;
  let velocityBias = 0.2 * sim.L2Action;
  // Sound waves create strong attraction to pattern antinodes (works with towers and global)
  let effectiveSoundStrength = select(sim.soundStrength, 0.7, hasTowers);
  let soundVelocityBoost = effectiveSoundStrength * (2.5 + 4.0 * abs(soundFieldStrength));
  let vx = nextVelocity.x + vf * cos(newHeading) + velocityBias * moveBias.x + soundDir.x * soundVelocityBoost;
  let vy = nextVelocity.y + vf * sin(newHeading) + velocityBias * moveBias.y + soundDir.y * soundVelocityBoost;

  let dt = 0.07 * pow(moveDistance, 1.4);
  let inertiaNewPositionX = particlePos.x + dt * vx + moveBias.x;
  let inertiaNewPositionY = particlePos.y + dt * vy + moveBias.y;

  // Sound enabled adds inertia to help particles form patterns (works with towers too)
  let hasSoundActive = sim.soundEnabled > 0.5 || hasTowers;
  let soundInertiaBoost = select(0.0, 0.4 * effectiveSoundStrength, hasSoundActive);
  let moveStyleLerper = 0.6 * sim.L2Action + 0.8 * waveSum + soundInertiaBoost;
  var px = mix(classicNewPositionX, inertiaNewPositionX, moveStyleLerper);
  var py = mix(classicNewPositionY, inertiaNewPositionY, moveStyleLerper);

  let spawnParticles = i32(sim.spawnParticles + 0.5);
  if (spawnParticles >= 1) {
    let randForChoice = random01FromParticle(particlePos * 1.1);
    if (randForChoice < sim.spawnFraction) {
      let randForRadius = random01FromParticle(particlePos * 2.2);
      if (spawnParticles == 1) {
        let randForTheta = random01FromParticle(particlePos * 3.3);
        let theta = randForTheta * PI * 2.0;
        let r1 = sim.actionAreaSizeSigma * 0.55 * (0.95 + 0.1 * randForRadius);
        let sx = r1 * cos(theta);
        let sy = r1 * sin(theta);
        var spos = vec2<f32>(sx, sy);
        spos *= height;
        px = sim.actionX + spos.x;
        py = sim.actionY + spos.y;
      }
      if (spawnParticles == 2) {
        let rawIndex = i32(floor(sim.randomSpawnNumber * random01FromParticle(particlePos * 4.4)));
        let maxIndex = max(0, i32(sim.randomSpawnNumber) - 1);
        let randIndex = clamp(rawIndex, 0, maxIndex);
        let sx = extras.randomSpawnX[randIndex];
        let sy = extras.randomSpawnY[randIndex];
        var spos = 0.65 * sim.actionAreaSizeSigma * vec2<f32>(sx, sy) * (0.9 + 0.1 * randForRadius);
        spos *= height;
        px = sim.actionX + spos.x;
        py = sim.actionY + spos.y;
      }
    }
  }

  let nextPos = fmod2(vec2<f32>(px + width, py + height), vec2<f32>(width, height));
  let ix = clamp(i32(round(nextPos.x)), 0, i32(width) - 1);
  let iy = clamp(i32(round(nextPos.y)), 0, i32(height) - 1);
  atomicAdd(&particlesCounter[ix * i32(height) + iy], 1u);

  let reinitSegment = 0.001;
  var finalPos = nextPos;
  if (curA < reinitSegment) {
    finalPos = randomPosFromParticle(particlePos);
  }
  let nextA = fract(curA + reinitSegment);

  let wrappedHeading = fmod(newHeading + 2.0 * PI, 2.0 * PI);

  particlesArray[base] = finalPos.x;
  particlesArray[base + 1] = finalPos.y;
  particlesArray[base + 2] = wrappedHeading;
  particlesArray[base + 3] = nextA;
  particlesArray[base + 4] = vx;
  particlesArray[base + 5] = vy;
}
`;
