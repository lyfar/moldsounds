export const createDepositShader = ({
  trailStorageFormat,
  trailClampMax,
  displayBoost,
  gridWorkgroupSize,
}) => `
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

@group(0) @binding(0) var<uniform> sim: SimUniforms;
@group(0) @binding(1) var<storage, read_write> particlesCounter: array<atomic<u32>>;
@group(0) @binding(2) var trailRead: texture_2d<f32>;
@group(0) @binding(3) var trailWrite: texture_storage_2d<${trailStorageFormat}, write>;
@group(0) @binding(4) var displayWrite: texture_storage_2d<rgba8unorm, write>;

fn interpolateGradient5(f: f32, cols: array<vec3<f32>, 5>) -> vec3<f32> {
  let t = clamp(f, 0.0, 1.0);
  let cur = t * 4.0;
  let icur = i32(floor(cur));
  let next = min(icur + 1, 4);
  return mix(cols[icur], cols[next], fract(cur));
}

fn interpolateGradient6(f: f32, cols: array<vec3<f32>, 6>) -> vec3<f32> {
  let t = clamp(f, 0.0, 1.0);
  let cur = t * 5.0;
  let icur = i32(floor(cur));
  let next = min(icur + 1, 5);
  return mix(cols[icur], cols[next], fract(cur));
}

fn interpolateGradient7(f: f32, cols: array<vec3<f32>, 7>) -> vec3<f32> {
  let t = clamp(f, 0.0, 1.0);
  let cur = t * 6.0;
  let icur = i32(floor(cur));
  let next = min(icur + 1, 6);
  return mix(cols[icur], cols[next], fract(cur));
}

const zorgPurple: array<vec3<f32>, 5> = array<vec3<f32>, 5>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.07, 0.18, 0.38),
  vec3<f32>(1.0, 0.0, 0.56),
  vec3<f32>(0.58, 1.0, 0.2)
);

const orangeBlue: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.1, 0.2, 0.4),
  vec3<f32>(0.0, 0.5, 0.6),
  vec3<f32>(0.8, 0.4, 0.2),
  vec3<f32>(0.9, 0.6, 0.3),
  vec3<f32>(1.0, 0.9, 0.0)
);

const green: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.3, 0.2),
  vec3<f32>(0.1, 0.7, 0.7),
  vec3<f32>(0.8, 0.5, 0.3),
  vec3<f32>(0.9, 0.7, 0.5),
  vec3<f32>(1.0, 1.0, 1.0)
);

const tealSunset: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.05, 0.2, 0.3),
  vec3<f32>(0.2, 0.4, 0.5),
  vec3<f32>(0.6, 0.3, 0.4),
  vec3<f32>(0.8, 0.4, 0.3),
  vec3<f32>(1.0, 0.5, 0.2)
);

const forestNight: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.1, 0.0),
  vec3<f32>(0.0, 0.3, 0.2),
  vec3<f32>(0.1, 0.4, 0.4),
  vec3<f32>(0.3, 0.6, 0.6),
  vec3<f32>(0.8, 0.9, 1.0)
);

const purpleFire: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.1, 0.3, 0.6),
  vec3<f32>(0.3, 0.2, 0.5),
  vec3<f32>(0.7, 0.2, 0.3),
  vec3<f32>(0.9, 0.5, 0.2),
  vec3<f32>(1.0, 0.9, 0.1)
);

const arctic: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.1, 0.3),
  vec3<f32>(0.0, 0.3, 0.5),
  vec3<f32>(0.1, 0.6, 0.8),
  vec3<f32>(0.4, 0.8, 1.0),
  vec3<f32>(0.85, 0.96, 1.0)
);

const cyan: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.3, 0.4),
  vec3<f32>(0.0, 0.5, 0.6),
  vec3<f32>(0.1, 0.7, 0.8),
  vec3<f32>(0.3, 0.9, 0.9),
  vec3<f32>(0.6, 1.0, 1.0)
);

const neonInferno: array<vec3<f32>, 6> = array<vec3<f32>, 6>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.2, 0.0, 0.3),
  vec3<f32>(0.6, 0.0, 0.6),
  vec3<f32>(0.8, 0.1, 0.2),
  vec3<f32>(1.0, 0.5, 0.1),
  vec3<f32>(1.0, 1.0, 1.0)
);

const solarDrift: array<vec3<f32>, 7> = array<vec3<f32>, 7>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.3, 0.1, 0.0),
  vec3<f32>(0.6, 0.2, 0.0),
  vec3<f32>(0.9, 0.5, 0.1),
  vec3<f32>(1.0, 0.8, 0.2),
  vec3<f32>(1.0, 0.95, 0.7)
);

const plasmaTwilight: array<vec3<f32>, 5> = array<vec3<f32>, 5>(
  vec3<f32>(0.0, 0.0, 0.0),
  vec3<f32>(0.0, 0.2, 0.5),
  vec3<f32>(0.2, 0.4, 0.9),
  vec3<f32>(0.5, 0.2, 0.7),
  vec3<f32>(1.0, 0.3, 0.7)
);

fn gradZorgPurple(f: f32) -> vec3<f32> {
  return interpolateGradient5(f, zorgPurple);
}
fn gradOrangeBlue(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, orangeBlue);
}
fn gradGreen(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, green);
}
fn gradTealSunset(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, tealSunset);
}
fn gradForestNight(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, forestNight);
}
fn gradPurpleFire(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, purpleFire);
}
fn gradArctic(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, arctic);
}
fn gradCyan(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, cyan);
}
fn gradNeonInferno(f: f32) -> vec3<f32> {
  return interpolateGradient6(f, neonInferno);
}
fn gradSolarDrift(f: f32) -> vec3<f32> {
  return interpolateGradient7(f, solarDrift);
}
fn gradPlasmaTwilight(f: f32) -> vec3<f32> {
  return interpolateGradient5(f, plasmaTwilight);
}

@compute @workgroup_size(${gridWorkgroupSize}, ${gridWorkgroupSize}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let width = u32(sim.width);
  let height = u32(sim.height);
  if (id.x >= width || id.y >= height) {
    return;
  }

  let pix = vec2<i32>(id.xy);
  let prevColor = textureLoad(trailRead, pix, 0).xy;
  let count = f32(atomicLoad(&particlesCounter[i32(id.x * height + id.y)]));

  let dotScale = max(0.1, sim.dotSize / 10.0);
  let limit = 100.0 * dotScale;
  let limitedCount = min(count, limit);
  let addedDeposit = sqrt(limitedCount) * sim.depositFactor * dotScale;

  let val = min(prevColor.x + addedDeposit, ${trailClampMax});
  textureStore(trailWrite, pix, vec4<f32>(val, prevColor.y, 0.0, 0.0));

  var drawValue = pow(tanh(7.5 * pow(max(0.0, (count - 1.0) / 1000.0), 0.3)), 8.5) * 1.1;
  drawValue = min(1.0, drawValue * sim.drawOpacity * dotScale * ${displayBoost});

  var fillValue = pow(tanh(9.0 * pow(max(0.0, (250.0 * prevColor.y - 1.0) / 1100.0), 0.3)), 8.5) * 1.05;
  fillValue = min(1.0, fillValue * sim.fillOpacity * dotScale * ${displayBoost});

  let combinedValue = clamp(drawValue + fillValue, 0.0, 1.0);

  var pos = vec2<f32>(pix) - vec2<f32>(sim.width * 0.5, sim.height * 0.5);
  pos *= (2.0 / (sim.width + sim.height)) * 0.6;
  let offset = length(pos);

  let temporalDiff = prevColor.x - prevColor.y;
  let blend = tanh(500.0 * temporalDiff + 2.0 * offset);
  let col2 = vec3<f32>(combinedValue);

  var col = vec3<f32>(0.0, 1.0, 0.0);
  let mode = i32(sim.colorModeType + 0.5);

  if (mode == 0) {
    col = vec3<f32>(combinedValue);
  } else if (mode == 1) {
    let col1 = gradPurpleFire(tanh(combinedValue * 1.3));
    let col3 = gradArctic(tanh(combinedValue * 1.3));
    col = mix(col1, col3, blend);
    col = clamp(1.25 * col, vec3<f32>(0.0), vec3<f32>(1.0));
  } else if (mode == 2) {
    let col1 = gradArctic(fract(tanh(combinedValue * 0.6 + offset) + 0.15));
    col = mix(col1, col2, blend);
  } else if (mode == 3) {
    let col1 = gradPurpleFire(tanh(combinedValue * 1.3));
    col = mix(col1, col2, blend);
  } else if (mode == 4) {
    let col1 = gradOrangeBlue(tanh(combinedValue * 1.3 + offset));
    col = mix(col1, col2, blend);
  } else if (mode == 5) {
    let col1 = gradNeonInferno(tanh(combinedValue * 1.3));
    col = mix(col1, col2, blend);
  } else if (mode == 6) {
    let col1 = gradZorgPurple(fract(tanh(combinedValue * 0.6 + offset) + 0.15));
    col = mix(col1, col2, blend);
    let col3 = gradArctic(tanh(combinedValue * 1.3));
    col = mix(col1, col3, blend);
    col = clamp(1.5 * pow(col, vec3<f32>(1.1)), vec3<f32>(0.0), vec3<f32>(1.0));
  } else if (mode == 7) {
    let col1 = gradNeonInferno(tanh(combinedValue * 1.3));
    let col3 = gradArctic(tanh(combinedValue * 1.3));
    col = mix(col1, col3, blend);
    col = clamp(1.1 * col, vec3<f32>(0.0), vec3<f32>(1.0));
  } else if (mode == 8) {
    let col1 = gradOrangeBlue(tanh(combinedValue * 1.3 + offset));
    let colGreen = gradGreen(tanh(combinedValue * 2.3 + offset));
    let col2_ = mix(vec3<f32>(clamp(1.3 * combinedValue, 0.0, 1.0)), colGreen, 0.5);
    let col3 = mix(col2_, col1, 1.0 - 0.6 * tanh(sin(-1500.0 * abs(temporalDiff)) + 2.0 * offset));
    let col4 = gradOrangeBlue(tanh(combinedValue * 1.3 + offset));
    let col5 = vec3<f32>(combinedValue);
    var col6 = 1.25 * mix(col4, col5, tanh(500.0 * temporalDiff + 2.0 * offset));
    col6 = pow(col6, vec3<f32>(2.0));
    col = max(col6, col3);
  } else if (mode == 9) {
    let col1 = gradGreen(tanh(combinedValue * 1.3));
    col = mix(col1, col2, blend);
  } else if (mode == 10000) {
    col = vec3<f32>(drawValue, fillValue, fillValue);
  }

  col = clamp(col, vec3<f32>(0.0), vec3<f32>(1.0));
  textureStore(displayWrite, pix, vec4<f32>(col, 1.0));
}
`;
