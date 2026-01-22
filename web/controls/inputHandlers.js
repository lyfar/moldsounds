import { clamp, lerp } from "../utils.js";

export function initInputHandlers({
  state,
  ui,
  isSimpleMode,
  setWeaponIndex,
  runNextLevel,
  applyPenSizeDelta,
  updateFlowControlHud,
  baseL2ActionRef,
}) {
  const {
    penSize,
    flowX,
    flowY,
    inertia,
    flowXMobile,
    flowYMobile,
    inertiaMobile,
    placeTowerBtn,
    showPen,
  } = ui;

  const editableTags = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);
  const isEditableTarget = (target) =>
    target && (editableTags.has(target.tagName) || target.isContentEditable);

  const moveActionBy = (dx, dy) => {
    state.actionX = clamp(state.actionX + dx, 0, state.simWidth);
    state.actionY = clamp(state.actionY + dy, 0, state.simHeight);
    state.mouseXchange = state.actionX / state.simWidth;
    state.screenY = state.actionY / state.simHeight;
  };

  const heldKeys = new Set();

  const applyHeldKeys = () => {
    if (heldKeys.has("a")) {
      state.moveBiasActionX = clamp(state.moveBiasActionX - 0.02, -1, 1);
    } else if (heldKeys.has("d")) {
      state.moveBiasActionX = clamp(state.moveBiasActionX + 0.02, -1, 1);
    } else {
      state.moveBiasActionX = lerp(state.moveBiasActionX, 0, 0.1);
      if (Math.abs(state.moveBiasActionX) < 0.01) state.moveBiasActionX = 0;
    }

    if (heldKeys.has("w")) {
      state.moveBiasActionY = clamp(state.moveBiasActionY + 0.02, -1, 1);
    } else if (heldKeys.has("s")) {
      state.moveBiasActionY = clamp(state.moveBiasActionY - 0.02, -1, 1);
    } else {
      state.moveBiasActionY = lerp(state.moveBiasActionY, 0, 0.1);
      if (Math.abs(state.moveBiasActionY) < 0.01) state.moveBiasActionY = 0;
    }

    const baseL2Action = baseL2ActionRef?.value ?? 0;
    if (heldKeys.has("e")) {
      state.L2Action = clamp((state.L2Action ?? baseL2Action) + 0.015, 0, 1);
    } else if (heldKeys.has("q")) {
      state.L2Action = clamp((state.L2Action ?? baseL2Action) - 0.015, 0, 1);
    } else {
      state.L2Action = lerp(state.L2Action ?? baseL2Action, baseL2Action, 0.05);
      if (Math.abs(state.L2Action - baseL2Action) < 0.01) {
        state.L2Action = baseL2Action;
      }
    }

    if (flowX) flowX.value = String(state.moveBiasActionX);
    if (flowY) flowY.value = String(state.moveBiasActionY);
    if (inertia) inertia.value = String(state.L2Action);
    if (flowXMobile) flowXMobile.value = String(state.moveBiasActionX);
    if (flowYMobile) flowYMobile.value = String(state.moveBiasActionY);
    if (inertiaMobile) inertiaMobile.value = String(state.L2Action);

    if (typeof updateFlowControlHud === "function") {
      updateFlowControlHud();
    }
  };

  const flowControlLoop = () => {
    applyHeldKeys();
    requestAnimationFrame(flowControlLoop);
  };
  flowControlLoop();

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }

    const rawKey = event.key;
    const key = rawKey.toLowerCase();

    const flowKeys = ["w", "a", "s", "d", "q", "e"];
    if (flowKeys.includes(key)) {
      heldKeys.add(key);
      event.preventDefault();
      return;
    }

    const isMoveKey = ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key);
    if (!isMoveKey && event.repeat) {
      return;
    }

    const moveStep = (event.shiftKey ? 0.01 : 0.03) * Math.min(state.simWidth, state.simHeight);
    const penStep = event.shiftKey ? 0.05 : 0.02;
    let handled = true;

    switch (key) {
      case "1":
      case "2":
      case "3":
      case "4":
      case "5": {
        const index = Number(rawKey) - 1;
        setWeaponIndex(index);
        const action = state.weaponActions[index];
        if (typeof action === "function") {
          action("keyboard");
        }
        break;
      }
      case "6":
        if (!document.body.classList.contains("view-expert")) {
          break;
        }
        if (state.towers.length < state.maxTowers) {
          state.towerPlacementMode = !state.towerPlacementMode;
          if (placeTowerBtn) {
            placeTowerBtn.classList.toggle("tower-panel__place-btn--active", state.towerPlacementMode);
          }
        }
        break;
      case "arrowup":
        moveActionBy(0, -moveStep);
        break;
      case "arrowdown":
        moveActionBy(0, moveStep);
        break;
      case "arrowleft":
        moveActionBy(-moveStep, 0);
        break;
      case "arrowright":
        moveActionBy(moveStep, 0);
        break;
      case " ":
      case "enter":
        if (!isSimpleMode()) {
          runNextLevel();
        } else {
          handled = false;
        }
        break;
      case "p":
        state.displayPen = !state.displayPen;
        if (showPen) showPen.checked = state.displayPen;
        break;
      case "[":
      case "-":
        applyPenSizeDelta(-penStep);
        break;
      case "]":
      case "=":
        applyPenSizeDelta(penStep);
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      event.preventDefault();
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    heldKeys.delete(key);
  });

  window.addEventListener("blur", () => {
    heldKeys.clear();
  });
}
