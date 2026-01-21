import { PARAMETERS_MATRIX, SELECTED_POINTS, PARAMS_DIMENSION, POINT_LABELS } from "./config.js";
import { lerp } from "./utils.js";

export class PointsDataManager {
  constructor() {
    this.selectedPoints = SELECTED_POINTS.slice();
    this.currentSelectionIndex = 0;
    this.usedPointsTargets = [[], []];
    this.selectedIndices = [21, 21];
    this.currentPointValues = [[], []];
    this.basePointsData = PARAMETERS_MATRIX.map((row) => row.slice());
    this.currentPointsData = PARAMETERS_MATRIX.map((row) => row.slice());
    this.mean = new Array(PARAMS_DIMENSION).fill(0);
    this.paramMin = new Array(PARAMS_DIMENSION).fill(Number.POSITIVE_INFINITY);
    this.paramMax = new Array(PARAMS_DIMENSION).fill(0);
    this.rebuildStats();

    this.reloadUsedPointsTargets();
    this.currentPointValues[0] = this.usedPointsTargets[0].slice();
    this.currentPointValues[1] = this.usedPointsTargets[1].slice();
  }

  rebuildStats() {
    this.mean.fill(0);
    this.paramMin.fill(Number.POSITIVE_INFINITY);
    this.paramMax.fill(0);

    for (const row of this.currentPointsData) {
      for (let j = 0; j < PARAMS_DIMENSION; j += 1) {
        this.mean[j] += row[j];
        this.paramMin[j] = Math.min(this.paramMin[j], row[j]);
        this.paramMax[j] = Math.max(this.paramMax[j], row[j]);
      }
    }
    for (let j = 0; j < PARAMS_DIMENSION; j += 1) {
      this.mean[j] /= this.currentPointsData.length;
      if (!Number.isFinite(this.paramMin[j])) {
        this.paramMin[j] = 0;
      }
    }
  }

  loadPointsData(pointsData) {
    if (!Array.isArray(pointsData) || pointsData.length !== this.currentPointsData.length) {
      return false;
    }

    const sanitized = pointsData.map((row) => {
      if (!Array.isArray(row)) {
        return null;
      }
      const values = new Array(PARAMS_DIMENSION).fill(0);
      for (let j = 0; j < PARAMS_DIMENSION; j += 1) {
        const value = Number(row[j]);
        values[j] = Number.isFinite(value) ? value : 0;
      }
      return values;
    });

    if (sanitized.some((row) => row === null)) {
      return false;
    }

    this.basePointsData = sanitized.map((row) => row.slice());
    this.currentPointsData = sanitized.map((row) => row.slice());
    this.rebuildStats();
    this.reloadUsedPointsTargets();
    this.currentPointValues[0] = this.usedPointsTargets[0].slice();
    this.currentPointValues[1] = this.usedPointsTargets[1].slice();
    return true;
  }

  getCurrentPointLineIndex() {
    return this.selectedPoints[this.selectedIndices[this.currentSelectionIndex]];
  }

  reloadUsedPointsTargets() {
    for (let i = 0; i < 2; i += 1) {
      const pointIndex = this.selectedPoints[this.selectedIndices[i]];
      this.usedPointsTargets[i] = this.currentPointsData[pointIndex].slice();
    }
  }

  updateCurrentValuesFromTransitionProgress(progress) {
    const lerperValue = Math.pow(progress, 1.5);
    for (let k = 0; k < 2; k += 1) {
      for (let j = 0; j < this.currentPointValues[k].length; j += 1) {
        this.currentPointValues[k][j] = lerp(
          this.currentPointValues[k][j],
          this.usedPointsTargets[k][j],
          lerperValue
        );
      }
    }
  }

  resetCurrentPoint() {
    const lineIndex = this.getCurrentPointLineIndex();
    this.currentPointsData[lineIndex] = this.basePointsData[lineIndex].slice();
    this.reloadUsedPointsTargets();
  }

  resetAllPoints() {
    for (const lineIndex of this.selectedPoints) {
      this.currentPointsData[lineIndex] = this.basePointsData[lineIndex].slice();
    }
    this.reloadUsedPointsTargets();
  }

  swapUsedPoints() {
    [this.usedPointsTargets[0], this.usedPointsTargets[1]] = [
      this.usedPointsTargets[1],
      this.usedPointsTargets[0],
    ];
    [this.selectedIndices[0], this.selectedIndices[1]] = [
      this.selectedIndices[1],
      this.selectedIndices[0],
    ];
  }

  useRandomIndices() {
    const sz = this.selectedPoints.length;
    this.selectedIndices[0] = Math.floor(Math.random() * sz);
    this.selectedIndices[1] = Math.floor(Math.random() * sz);
    this.reloadUsedPointsTargets();
  }

  setSelectedIndex(slot, value) {
    this.selectedIndices[slot] = value;
    this.reloadUsedPointsTargets();
  }

  setCurrentSelectionIndex(index) {
    this.currentSelectionIndex = index;
  }

  applyPointPreset(selectionIndex, values, scalingFactor) {
    if (!Array.isArray(values)) {
      return false;
    }
    const lineIndex = this.selectedPoints[this.selectedIndices[selectionIndex]];
    const next = this.currentPointsData[lineIndex].slice();
    const limit = Math.min(values.length, PARAMS_DIMENSION - 1);
    for (let j = 0; j < limit; j += 1) {
      const value = Number(values[j]);
      next[j] = Number.isFinite(value) ? value : next[j];
    }
    if (Number.isFinite(scalingFactor)) {
      next[PARAMS_DIMENSION - 1] = scalingFactor;
    }
    this.currentPointsData[lineIndex] = next.slice();
    this.basePointsData[lineIndex] = next.slice();
    this.rebuildStats();
    this.reloadUsedPointsTargets();
    this.currentPointValues[0] = this.usedPointsTargets[0].slice();
    this.currentPointValues[1] = this.usedPointsTargets[1].slice();
    return true;
  }

  getPointName(selectionIndex) {
    const baseIndex = this.selectedPoints[selectionIndex];
    const label = POINT_LABELS[baseIndex];
    const letter = String.fromCharCode(65 + selectionIndex);
    if (label) {
      return `${letter} - ${label}`;
    }
    return `Point ${letter}`;
  }

  getNumberOfPoints() {
    return this.selectedPoints.length;
  }

  getSettingName(settingIndex) {
    switch (settingIndex) {
      case 0:
        return "Sensing factor";
      case 1:
        return "Sensor Distance 0";
      case 2:
        return "SD exponent";
      case 3:
        return "SD amplitude";
      case 4:
        return "Sensor Angle 0";
      case 5:
        return "SA exponent";
      case 6:
        return "SA amplitude";
      case 7:
        return "Rotation Angle 0";
      case 8:
        return "RA exponent";
      case 9:
        return "RA amplitude";
      case 10:
        return "Move Distance 0";
      case 11:
        return "MD exponent";
      case 12:
        return "MD amplitude";
      case 13:
        return "SensorBias1";
      case 14:
        return "SensorBias2";
      default:
        return "Unknown";
    }
  }

  getValue(settingIndex) {
    const matrixColumnIndex = settingIndex === 0 ? PARAMS_DIMENSION - 1 : settingIndex - 1;
    const lineIndex = this.getCurrentPointLineIndex();
    return this.currentPointsData[lineIndex][matrixColumnIndex];
  }

  setValue(settingIndex, value) {
    const matrixColumnIndex = settingIndex === 0 ? PARAMS_DIMENSION - 1 : settingIndex - 1;
    const lineIndex = this.getCurrentPointLineIndex();
    this.currentPointsData[lineIndex][matrixColumnIndex] = Math.max(0, value);

    for (let i = 0; i < 2; i += 1) {
      if (this.selectedPoints[this.selectedIndices[i]] === lineIndex) {
        this.usedPointsTargets[i] = this.currentPointsData[lineIndex].slice();
      }
    }
  }

  getParamRange(settingIndex) {
    const matrixColumnIndex = settingIndex === 0 ? PARAMS_DIMENSION - 1 : settingIndex - 1;
    const maxValue = this.paramMax[matrixColumnIndex];
    const max = maxValue > 0 ? maxValue * 2 : 1;
    const min = 0;
    const step = Math.max(max / 500, 0.0001);
    return { min, max, step };
  }

  createRandomParameters() {
    this.resetAllPoints();
    const numberOfSelectedPoints = this.selectedPoints.length;
    const pointChoice0 = Math.floor(Math.random() * numberOfSelectedPoints);
    const lineIndex = this.getCurrentPointLineIndex();

    for (let j = 0; j < PARAMS_DIMENSION; j += 1) {
      const sourceIndex = this.selectedPoints[pointChoice0];
      this.currentPointsData[lineIndex][j] = this.currentPointsData[sourceIndex][j];
    }

    for (let j = 0; j < PARAMS_DIMENSION; j += 1) {
      if (Math.random() < 0.5) {
        continue;
      }

      let pointChoice = -1;
      let ok = false;
      while (!ok) {
        pointChoice = Math.floor(Math.random() * numberOfSelectedPoints);
        ok = pointChoice !== pointChoice0;
        if ([1, 4, 7, 10].includes(j)) {
          const candidate = this.currentPointsData[this.selectedPoints[pointChoice]][j];
          ok = ok && candidate >= 0.001;
        }
      }

      let value = this.currentPointsData[this.selectedPoints[pointChoice]][j];
      if (Math.random() < 0.5) {
        let pointChoice2 = Math.floor(Math.random() * numberOfSelectedPoints);
        while (pointChoice2 === pointChoice0) {
          pointChoice2 = Math.floor(Math.random() * numberOfSelectedPoints);
        }
        const value2 = this.currentPointsData[this.selectedPoints[pointChoice2]][j];
        const lerperValue = 0.01 * Math.floor(Math.random() * 100);
        value = (1 - lerperValue) * value + lerperValue * value2;
      }

      this.currentPointsData[lineIndex][j] = value;
    }

    this.reloadUsedPointsTargets();
  }
}
