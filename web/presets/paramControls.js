import { PARAMS_DIMENSION } from "../config.js";
import { clamp } from "../utils.js";

export function initParamControls({ pointsManager, state, ui }) {
  const { penSelect, bgSelect, editTarget, editPointLabel, paramList } = ui;
  const paramControls = [];

  const syncPointSelectors = () => {
    if (penSelect) {
      penSelect.value = String(pointsManager.selectedIndices[0]);
    }
    if (bgSelect) {
      bgSelect.value = String(pointsManager.selectedIndices[1]);
    }
  };

  const setParamValue = (index, value) => {
    const control = paramControls[index];
    if (!control) {
      return;
    }
    const min = Number(control.range.min);
    const max = Number(control.range.max);
    const clamped = clamp(value, min, max);
    pointsManager.setValue(index, clamped);
    control.range.value = String(clamped);
    control.number.value = clamped.toFixed(3);
  };

  const updateAdvancedValues = () => {
    if (!editTarget) {
      return;
    }
    const targetIndex = Number(editTarget.value);
    pointsManager.setCurrentSelectionIndex(targetIndex);
    const pointIndex = pointsManager.selectedIndices[targetIndex];
    const targetLabel = targetIndex === 0 ? "Pen" : "Background";
    if (editPointLabel) {
      editPointLabel.textContent = `Editing ${targetLabel}: ${pointsManager.getPointName(pointIndex)}`;
    }

    for (let i = 0; i < paramControls.length; i += 1) {
      const value = pointsManager.getValue(i);
      paramControls[i].range.value = String(value);
      paramControls[i].number.value = value.toFixed(3);
    }
  };

  const buildParamControls = () => {
    if (!paramList) {
      return;
    }
    paramList.innerHTML = "";
    paramControls.length = 0;

    for (let i = 0; i < PARAMS_DIMENSION; i += 1) {
      const row = document.createElement("div");
      row.className = "param-row";

      const label = document.createElement("label");
      label.textContent = pointsManager.getSettingName(i);

      const controls = document.createElement("div");
      controls.className = "param-controls";

      const range = document.createElement("input");
      range.type = "range";
      const number = document.createElement("input");
      number.type = "number";

      const { min, max, step } = pointsManager.getParamRange(i);
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      number.min = String(min);
      number.max = String(max);
      number.step = String(step);

      range.addEventListener("input", () => {
        setParamValue(i, Number(range.value));
      });
      number.addEventListener("input", () => {
        setParamValue(i, Number(number.value));
      });

      controls.append(range, number);
      row.append(label, controls);
      paramList.appendChild(row);

      paramControls.push({ range, number });
    }

    updateAdvancedValues();
  };

  const populatePointSelectors = () => {
    if (penSelect) {
      penSelect.innerHTML = "";
    }
    if (bgSelect) {
      bgSelect.innerHTML = "";
    }
    for (let i = 0; i < pointsManager.getNumberOfPoints(); i += 1) {
      const label = pointsManager.getPointName(i);
      if (penSelect) {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = label;
        penSelect.appendChild(option);
      }
      if (bgSelect) {
        const option = document.createElement("option");
        option.value = String(i);
        option.textContent = label;
        bgSelect.appendChild(option);
      }
    }
    syncPointSelectors();
  };

  const bindPointSelectors = () => {
    if (penSelect) {
      penSelect.addEventListener("change", () => {
        pointsManager.setSelectedIndex(0, Number(penSelect.value));
        state.transitionTriggerTime = state.time;
        updateAdvancedValues();
      });
    }

    if (bgSelect) {
      bgSelect.addEventListener("change", () => {
        pointsManager.setSelectedIndex(1, Number(bgSelect.value));
        state.transitionTriggerTime = state.time;
        updateAdvancedValues();
      });
    }
  };

  const bindEditTarget = () => {
    if (!editTarget) {
      return;
    }
    editTarget.addEventListener("change", () => {
      updateAdvancedValues();
    });
  };

  if (penSelect || bgSelect) {
    populatePointSelectors();
  }
  bindPointSelectors();
  bindEditTarget();

  return {
    buildParamControls,
    updateAdvancedValues,
    syncPointSelectors,
    paramControls,
  };
}
