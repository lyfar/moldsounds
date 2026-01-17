export async function initWebGPU(canvas, statusEl) {
  if (!navigator.gpu) {
    statusEl.textContent = "WebGPU not supported in this browser.";
    return null;
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    statusEl.textContent =
      "Failed to create WebGPU context. Use https/localhost and ensure WebGPU is enabled.";
    return null;
  }

  let adapter = null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  } catch (error) {
    statusEl.textContent = `WebGPU adapter request failed: ${error.message || error}`;
    return null;
  }
  if (!adapter) {
    statusEl.textContent =
      "Unable to acquire a WebGPU adapter. Try reloading or restarting the browser.";
    return null;
  }

  let supportsStorage16 = adapter.features.has("texture-storage-16-bit");
  const adapterLimits = adapter.limits;
  const requiredLimits = {};
  const desiredInvocations = 1024;
  const desiredWorkgroupSize = 32;

  if (adapterLimits.maxComputeInvocationsPerWorkgroup >= desiredInvocations) {
    requiredLimits.maxComputeInvocationsPerWorkgroup = desiredInvocations;
  }
  if (adapterLimits.maxComputeWorkgroupSizeX >= desiredWorkgroupSize) {
    requiredLimits.maxComputeWorkgroupSizeX = desiredWorkgroupSize;
  }
  if (adapterLimits.maxComputeWorkgroupSizeY >= desiredWorkgroupSize) {
    requiredLimits.maxComputeWorkgroupSizeY = desiredWorkgroupSize;
  }

  let device;
  try {
    device = await adapter.requestDevice({
      requiredFeatures: supportsStorage16 ? ["texture-storage-16-bit"] : [],
      requiredLimits,
    });
  } catch (error) {
    supportsStorage16 = false;
    device = await adapter.requestDevice();
  }
  const format = navigator.gpu.getPreferredCanvasFormat();

  return { device, context, format, supportsStorage16 };
}

export function configureCanvas(canvas, context, format, device) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  context.configure({ device, format, alphaMode: "premultiplied" });
}
