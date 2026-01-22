import { createShaders } from "../shaders.js";

export async function createPipelines({
  device,
  format,
  settings,
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
}) {
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
    ...settings,
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

  return {
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
  };
}
