# WebGPU version

This folder contains a WebGPU port of the interactive physarum simulation with mouse input and a browser control panel.

## Run locally

From the repo root:

```bash
cd web
python3 -m http.server 8080
```

Then open:

```
http://localhost:8080
```

Use a WebGPU-capable browser (Chrome or Edge recommended).

### Quality presets

Append `?quality=low|medium|high|ultra` to the URL to switch resolution presets.

### Debug

Enable the Debug panel in the UI, or add `?debug=1` to start with debug logging on.

## Controls

- Mouse move: pen position
- Left click: spawn burst
- Right click: spawn ring
- Middle click: wave
- Control panel: point selection, pen size, flow, inertia, color, etc.
