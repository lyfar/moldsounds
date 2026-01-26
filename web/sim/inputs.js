import { TOWER_SETTINGS } from "../config.js";
import { clamp, setRandomSpawn } from "../utils.js";

export function initSimInputs({ canvas, state, settings, simWidth, simHeight }) {
  const pinchState = {
    pointers: new Map(),
    startDistance: null,
    startRadius: null,
    tower: null,
  };

  const getActiveTower = () => {
    if (!Array.isArray(state.towers) || state.towers.length === 0) {
      return null;
    }
    if (state.selectedTowerIndex >= 0 && state.selectedTowerIndex < state.towers.length) {
      return state.towers[state.selectedTowerIndex];
    }
    const defaultTower = state.towers.find((tower) => tower?.isDefaultTrack);
    return defaultTower || state.towers[0];
  };

  const getTowerBaseRadius = (tower) =>
    Number.isFinite(tower.baseRadius) ? tower.baseRadius : tower.radius;

  const setTowerRadius = (tower, value) => {
    const next = clamp(value, TOWER_SETTINGS.minRadius, TOWER_SETTINGS.maxRadius);
    if (tower.audio) {
      tower.baseRadius = next;
    }
    tower.radius = next;
  };

  const resetPinch = () => {
    pinchState.startDistance = null;
    pinchState.startRadius = null;
    pinchState.tower = null;
  };

  const getPinchDistance = (points) => {
    if (points.length < 2) {
      return null;
    }
    const dx = points[1].x - points[0].x;
    const dy = points[1].y - points[0].y;
    return Math.hypot(dx, dy);
  };

  const updatePinch = (distance) => {
    if (!Number.isFinite(distance) || distance <= 0) {
      return false;
    }
    if (!pinchState.tower) {
      pinchState.tower = getActiveTower();
    }
    if (!pinchState.tower) {
      resetPinch();
      return false;
    }
    if (!pinchState.startDistance) {
      pinchState.startDistance = distance;
      pinchState.startRadius = getTowerBaseRadius(pinchState.tower);
      return true;
    }
    const scale = distance / pinchState.startDistance;
    setTowerRadius(pinchState.tower, pinchState.startRadius * scale);
    if (typeof state.refreshTowerUI === "function") {
      state.refreshTowerUI();
    }
    return true;
  };

  const handlePointerPinch = (event) => {
    if (event.pointerType !== "touch" || event.target !== canvas) {
      return false;
    }
    pinchState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchState.pointers.size < 2) {
      return false;
    }
    const points = Array.from(pinchState.pointers.values());
    const distance = getPinchDistance(points);
    return updatePinch(distance);
  };

  const handleTouchPinch = (event) => {
    if (!event.touches || event.touches.length < 2) {
      return false;
    }
    const t0 = event.touches[0];
    const t1 = event.touches[1];
    const distance = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    return updatePinch(distance);
  };

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
    if (handlePointerPinch(event)) {
      event.preventDefault();
      return;
    }
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
    if (event.pointerType === "touch") {
      pinchState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinchState.pointers.size >= 2) {
        handlePointerPinch(event);
        event.preventDefault();
        return;
      }
      if (event.isPrimary === false) {
        return;
      }
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
    if (event.pointerType === "touch") {
      pinchState.pointers.delete(event.pointerId);
      if (pinchState.pointers.size < 2) {
        resetPinch();
      }
    }
    if (canvas.releasePointerCapture) {
      canvas.releasePointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "touch") {
      pinchState.pointers.delete(event.pointerId);
      if (pinchState.pointers.size < 2) {
        resetPinch();
      }
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
      if (handleTouchPinch(event)) {
        event.preventDefault();
        return;
      }
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
      if (handleTouchPinch(event)) {
        event.preventDefault();
        return;
      }
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
      if (event.touches.length < 2) {
        resetPinch();
      }
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
