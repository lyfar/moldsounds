export const createDiffusionShader = ({
  trailStorageFormat,
  trailClampMax,
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
@group(0) @binding(1) var trailRead: texture_2d<f32>;
@group(0) @binding(2) var trailWrite: texture_storage_2d<${trailStorageFormat}, write>;

fn loopedPosition(pos: vec2<i32>, width: i32, height: i32) -> vec2<i32> {
  let x = (pos.x % width + width) % width;
  let y = (pos.y % height + height) % height;
  return vec2<i32>(x, y);
}

@compute @workgroup_size(${gridWorkgroupSize}, ${gridWorkgroupSize}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let width = i32(sim.width);
  let height = i32(sim.height);
  if (i32(id.x) >= width || i32(id.y) >= height) {
    return;
  }

  let pos = vec2<i32>(id.xy);
  var csum = vec2<f32>(0.0);
  let kernelSize = 1;

  for (var i = -kernelSize; i <= kernelSize; i = i + 1) {
    for (var j = -kernelSize; j <= kernelSize; j = j + 1) {
      let samplePos = loopedPosition(pos - vec2<i32>(i, j), width, height);
      csum += textureLoad(trailRead, samplePos, 0).xy;
    }
  }

  let c = csum / pow(2.0 * f32(kernelSize) + 1.0, 2.0);
  let blurPasses = max(1.0, sim.blurPasses);
  let decayPerPass = pow(sim.decayFactor, 1.0 / blurPasses);
  let decayed = min(c.x * decayPerPass, ${trailClampMax});
  let cOutput = vec4<f32>(decayed, min(0.8 * decayed + 0.2 * c.y, ${trailClampMax}), 0.0, 0.0);
  textureStore(trailWrite, pos, cOutput);
}
`;
