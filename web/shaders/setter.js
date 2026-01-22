export const createSetterShader = ({ gridWorkgroupSize }) => `
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

@compute @workgroup_size(${gridWorkgroupSize}, ${gridWorkgroupSize}, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let width = u32(sim.width);
  let height = u32(sim.height);
  if (id.x >= width || id.y >= height) {
    return;
  }
  let idx = i32(id.x * height + id.y);
  atomicStore(&particlesCounter[idx], 0u);
}
`;
