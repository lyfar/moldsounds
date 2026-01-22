export const createRenderShader = () => `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(2.0, 0.0),
    vec2<f32>(0.0, 2.0)
  );
  var out: VertexOut;
  out.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  out.uv = uvs[vertexIndex];
  return out;
}

@group(0) @binding(0) var displaySampler: sampler;
@group(0) @binding(1) var displayTexture: texture_2d<f32>;

@fragment
fn fs(input: VertexOut) -> @location(0) vec4<f32> {
  // Flip Y so texture coordinates line up with DOM screen coordinates (top=0).
  return textureSample(displayTexture, displaySampler, vec2<f32>(input.uv.x, 1.0 - input.uv.y));
}
`;
