const formatPresetLabel = (entry) => {
  if (entry?.label) {
    return entry.label;
  }
  if (entry?.name && entry?.exported) {
    return `${entry.name} (${entry.exported.slice(0, 10)})`;
  }
  return entry?.name || entry?.file || "Preset";
};

export const updatePresetInfo = (presetInfo, entry) => {
  if (!presetInfo) {
    return;
  }
  if (!entry) {
    presetInfo.textContent = "No preset selected.";
    return;
  }
  const parts = [entry.name || entry.file];
  if (entry.exported) {
    parts.push(entry.exported);
  }
  presetInfo.textContent = parts.filter(Boolean).join(" \u2022 ");
};

export async function loadPresetLibrary({ presetLibrary, presetInfo }) {
  if (!presetLibrary) {
    return [];
  }
  presetLibrary.innerHTML = "";
  if (presetInfo) {
    presetInfo.textContent = "Loading presets...";
  }
  try {
    const response = await fetch("./36points-exports/index.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Preset index ${response.status}`);
    }
    const data = await response.json();
    const entries = Array.isArray(data?.presets) ? data.presets : [];
    entries.forEach((entry, index) => {
      const option = document.createElement("option");
      option.value = entry.file || String(index);
      option.textContent = formatPresetLabel(entry);
      presetLibrary.appendChild(option);
    });
    updatePresetInfo(presetInfo, entries[0]);
    return entries;
  } catch (error) {
    console.warn("Failed to load preset library", error);
    if (presetInfo) {
      presetInfo.textContent = "Preset library unavailable.";
    }
    return [];
  }
}
