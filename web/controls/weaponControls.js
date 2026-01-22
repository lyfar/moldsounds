import { WEAPON_MODES } from "../config.js";
import { clamp, setRandomSpawn, setVortexSpawn, setPulseSpawn } from "../utils.js";
import {
  playWeaponSound,
  playQuantumShift,
  playNextLevel,
  playWeaponSelect,
} from "../audio.js";

export function initWeaponControls({
  state,
  settings,
  pointsManager,
  ui,
  isSimpleMode,
  incrementShots,
  incrementLevel,
  updateAdvancedValues,
  syncPointSelectors,
  applySimpleTowerDamage,
  setSoundEnabled,
}) {
  const {
    weaponList,
    actionList,
    weaponStatus,
    randomParams,
    randomize,
    swap,
    spawnBurst,
    spawnRing,
    wave,
    nextColor,
    saveImage,
    colorMode,
    quantumShiftBtn,
    nextLevelBtn,
  } = ui;

  const weaponButtons = [];
  const actionButtons = [];
  const weaponCooldowns = WEAPON_MODES.map(() => 0);

  const getCurrentPointValues = () => pointsManager.currentPointValues[0];

  const updateWeaponCooldownDisplay = () => {
    weaponButtons.forEach((button, index) => {
      const remaining = Math.max(0, weaponCooldowns[index] - state.time);
      if (remaining > 0) {
        button.classList.add("weapon--cooldown");
        button.style.setProperty(
          "--cooldown-progress",
          `${(remaining / (WEAPON_MODES[index].cooldown || 0.3)) * 100}%`
        );
      } else {
        button.classList.remove("weapon--cooldown");
        button.style.removeProperty("--cooldown-progress");
      }
    });
  };

  const isWeaponReady = (index) => state.time >= weaponCooldowns[index];

  const triggerWeaponCooldown = (index) => {
    const weapon = WEAPON_MODES[index];
    weaponCooldowns[index] = state.time + (weapon.cooldown || 0.3);
    updateWeaponCooldownDisplay();
  };

  const cooldownInterval = setInterval(() => {
    updateWeaponCooldownDisplay();
  }, 50);

  const weaponActions = [
    () => {
      if (!isWeaponReady(0)) return false;
      state.spawnParticles = 2;
      setRandomSpawn(state, settings);
      triggerWeaponCooldown(0);
      playWeaponSound(0, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(0);
      return true;
    },
    () => {
      if (!isWeaponReady(1)) return false;
      state.spawnParticles = 1;
      triggerWeaponCooldown(1);
      playWeaponSound(1, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(1);
      return true;
    },
    () => {
      if (!isWeaponReady(2)) return false;
      state.triggerWave = true;
      triggerWeaponCooldown(2);
      playWeaponSound(2, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(2);
      return true;
    },
    () => {
      if (!isWeaponReady(3)) return false;
      state.spawnParticles = 2;
      setVortexSpawn(state, settings);
      triggerWeaponCooldown(3);
      playWeaponSound(3, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(3);
      return true;
    },
    () => {
      if (!isWeaponReady(4)) return false;
      state.spawnParticles = 2;
      setPulseSpawn(state, settings);
      triggerWeaponCooldown(4);
      playWeaponSound(4, getCurrentPointValues(), state.currentActionAreaSizeSigma);
      incrementShots();
      applySimpleTowerDamage(4);
      return true;
    },
  ];

  const runRandomPoints = () => {
    pointsManager.useRandomIndices();
    syncPointSelectors();
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
  };

  const runQuantumSwap = () => {
    const oldValues = pointsManager.currentPointValues[0].slice();
    pointsManager.swapUsedPoints();
    syncPointSelectors();
    state.transitionTriggerTime = state.time;
    updateAdvancedValues();
    playQuantumShift(oldValues, pointsManager.currentPointValues[0]);
  };

  const runNextLevel = () => {
    if (isSimpleMode()) {
      return;
    }
    if (typeof incrementLevel === "function") {
      incrementLevel();
    }
    pointsManager.createRandomParameters();
    updateAdvancedValues();
    playNextLevel(getCurrentPointValues());
  };

  const setWeaponIndex = (index) => {
    const clamped = clamp(index, 0, WEAPON_MODES.length - 1);
    if (clamped !== state.weaponIndex) {
      playWeaponSelect(clamped);
    }
    state.weaponIndex = clamped;
    weaponButtons.forEach((button, i) => {
      if (i === clamped) {
        button.classList.add("weapon--active");
      } else {
        button.classList.remove("weapon--active");
      }
    });
    if (weaponStatus) {
      weaponStatus.textContent = `Weapon: ${WEAPON_MODES[clamped].label}`;
    }
  };

  state.weaponActions = weaponActions;

  if (weaponList) {
    weaponList.innerHTML = "";
    WEAPON_MODES.forEach((mode, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `weapon weapon--${mode.id}`;
      button.innerHTML = `
        <span class="weapon__preview" aria-hidden="true">
          <span class="weapon__key">${mode.key}</span>
        </span>
        <span class="weapon__label">${mode.label}</span>
      `;
      button.addEventListener("click", () => {
        setWeaponIndex(index);
        const action = weaponActions[index];
        if (typeof action === "function") {
          action("click");
        }
      });
      weaponList.appendChild(button);
      weaponButtons.push(button);
    });
    setWeaponIndex(state.weaponIndex);
  }

  if (actionList) {
    const actionItems = [
      {
        id: "sound",
        key: "4",
        label: "Sound Wave Annihilator",
        action: () => setSoundEnabled(!state.soundEnabled),
        toggle: true,
      },
      { id: "quantum", key: "Q", label: "Quantum Shift", action: runQuantumSwap },
      { id: "level", key: "Enter", label: "Next level", action: runNextLevel },
    ];

    actionList.innerHTML = "";
    actionItems.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action";
      button.dataset.actionId = item.id;
      if (item.toggle && state.soundEnabled) {
        button.classList.add("action--active");
      }
      button.innerHTML = `<span class="weapon__key">${item.key}</span><span class="weapon__label">${item.label}</span>`;
      button.addEventListener("click", () => {
        item.action();
      });
      actionList.appendChild(button);
      actionButtons.push(button);
    });
  }

  if (randomParams) {
    randomParams.addEventListener("click", () => {
      runNextLevel();
    });
  }

  if (randomize) {
    randomize.addEventListener("click", () => {
      runRandomPoints();
    });
  }

  if (swap) {
    swap.addEventListener("click", () => {
      runQuantumSwap();
    });
  }

  if (spawnBurst) {
    spawnBurst.addEventListener("click", () => {
      setWeaponIndex(0);
      weaponActions[0]();
    });
  }

  if (spawnRing) {
    spawnRing.addEventListener("click", () => {
      setWeaponIndex(1);
      weaponActions[1]();
    });
  }

  if (wave) {
    wave.addEventListener("click", () => {
      setWeaponIndex(2);
      weaponActions[2]();
    });
  }

  if (nextColor) {
    nextColor.addEventListener("click", () => {
      state.colorModeType = (state.colorModeType + 1) % settings.numberOfColorModes;
      if (colorMode) {
        colorMode.value = String(state.colorModeType);
      }
    });
  }

  if (saveImage) {
    saveImage.addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = `physarum_${Date.now()}.png`;
      link.href = state.canvas.toDataURL("image/png");
      link.click();
    });
  }

  if (quantumShiftBtn) {
    quantumShiftBtn.addEventListener("click", () => {
      runQuantumSwap();
    });
  }

  if (nextLevelBtn) {
    nextLevelBtn.addEventListener("click", () => {
      runNextLevel();
    });
  }

  return {
    weaponActions,
    setWeaponIndex,
    runNextLevel,
    runQuantumSwap,
    runRandomPoints,
    getCurrentPointValues,
    actionButtons,
    weaponButtons,
    cooldownInterval,
  };
}
