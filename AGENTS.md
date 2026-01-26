# AGENTS

## File size guidelines

- Keep source files at or below 600 lines.
- If a file grows beyond 600 lines, refactor it by splitting it into smaller, focused modules before adding more changes.
- Preserve existing behavior and public APIs when refactoring; prefer moving cohesive sections into new files in the same folder.

## Icon generation guidelines

- Do not use SVGs for UI icons. Use the Replicate MCP to generate raster icons (PNG) instead.
- Style: minimal 3D, soft-rounded forms, subtle studio lighting, warm neutral base with a gentle teal accent, no text.
- Remove backgrounds (transparent PNG) and keep the icon style consistent across the set.
