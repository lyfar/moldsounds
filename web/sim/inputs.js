import { clamp, setRandomSpawn } from "../utils.js";

export function initSimInputs({ canvas, state, settings, simWidth, simHeight }) {
  const updateActionFromPointer = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    state.actionX = clampedX * simWidth;
    state.actionY = clampedY * simHeight;
    state.mouseXchange = clampedX;
    state.screenY = clampedY;
  };

  const updateActionFromTouch = (touch) => {
    const rect = canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    const clampedX = clamp(x, 0, 1);
    const clampedY = clamp(y, 0, 1);
    state.actionX = clampedX * simWidth;
    state.actionY = clampedY * simHeight;
    state.mouseXchange = clampedX;
    state.screenY = clampedY;
  };

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && event.isPrimary === false) {
      return;
    }
    if (event.target !== canvas) {
      return;
    }
    event.preventDefault();
    updateActionFromPointer(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" && event.isPrimary === false) {
      return;
    }
    if (event.target !== canvas) {
      return;
    }
    event.preventDefault();

    updateActionFromPointer(event);
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const action = state.weaponActions[state.weaponIndex];
    if (typeof action === "function") {
      action("pointer");
    } else {
      state.spawnParticles = 2;
      setRandomSpawn(state, settings);
    }
  });
  canvas.addEventListener("pointerup", (event) => {
    if (canvas.releasePointerCapture) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  if (!("PointerEvent" in window)) {
    let activeTouchId = null;
    const findTouchById = (touchList, identifier) => {
      for (let i = 0; i < touchList.length; i += 1) {
        if (touchList[i].identifier === identifier) {
          return touchList[i];
        }
      }
      return null;
    };

    const handleTouchStart = (event) => {
      if (activeTouchId === null && event.touches.length > 0) {
        activeTouchId = event.touches[0].identifier;
        updateActionFromTouch(event.touches[0]);
      } else if (activeTouchId !== null) {
        const touch = findTouchById(event.touches, activeTouchId);
        if (touch) {
          updateActionFromTouch(touch);
        }
      }
      event.preventDefault();
    };

    const handleTouchMove = (event) => {
      let touch = null;
      if (activeTouchId !== null) {
        touch = findTouchById(event.touches, activeTouchId);
      }
      if (!touch && event.touches.length > 0) {
        touch = event.touches[0];
        activeTouchId = touch.identifier;
      }
      if (touch) {
        updateActionFromTouch(touch);
      }
      event.preventDefault();
    };

    const handleTouchEnd = (event) => {
      if (activeTouchId === null) {
        return;
      }
      const touch = findTouchById(event.touches, activeTouchId);
      if (!touch) {
        activeTouchId = null;
      }
      event.preventDefault();
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
  }
}
