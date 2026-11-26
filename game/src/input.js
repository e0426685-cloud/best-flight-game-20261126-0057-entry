// Input for Island Hopper: keyboard and mouse, one place.
// One job: turn key presses and mouse movement into the stick the flight
// model reads, and expose the one-shot keys (pause, restart, mute, flaps).

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseX: 0.5, // 0..1 across the canvas
    mouseY: 0.5, // 0..1 down the canvas
    mouseActive: false,
    mouseDown: false,
    pressed: new Set(), // one-shot keys, consumed by the game loop
  };

  function codeOf(e) {
    return e.code || e.key;
  }

  window.addEventListener('keydown', (e) => {
    const c = codeOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) {
      e.preventDefault();
    }
    if (!e.repeat) state.pressed.add(c);
    keys.add(c);
  });
  window.addEventListener('keyup', (e) => keys.delete(codeOf(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    state.mouseX = (e.clientX - r.left) / Math.max(1, r.width);
    state.mouseY = (e.clientY - r.top) / Math.max(1, r.height);
    state.mouseActive = true;
  });
  canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    state.mouseDown = true;
    state.pressed.add('MouseClick');
  });
  window.addEventListener('mouseup', () => {
    state.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return state;
}

function down(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

// Read the stick this frame: pitch -1..1 (positive = pull up), roll -1..1
// (positive = bank right), throttleDelta per second, brake.
export function readStick(input) {
  let pitch = 0;
  let roll = 0;
  if (down(input, 'ArrowUp', 'KeyW')) pitch += 1;
  if (down(input, 'ArrowDown', 'KeyS')) pitch -= 1;
  if (down(input, 'ArrowLeft', 'KeyA')) roll -= 1;
  if (down(input, 'ArrowRight', 'KeyD')) roll += 1;

  // The mouse is a yoke: push it from centre and the plane follows.
  if (input.mouseActive && !input.mouseDown) {
    const mx = (input.mouseX - 0.5) * 2;
    const my = (input.mouseY - 0.5) * 2;
    if (Math.abs(mx) > 0.08) roll += Math.max(-1, Math.min(1, mx * 1.2));
    if (Math.abs(my) > 0.08) pitch += Math.max(-1, Math.min(1, -my * 1.2));
  }

  let throttleDelta = 0;
  if (down(input, 'ShiftLeft', 'ShiftRight', 'KeyE')) throttleDelta += 1;
  if (down(input, 'ControlLeft', 'ControlRight', 'KeyQ')) throttleDelta -= 1;
  // S doubles as pitch-down on the keyboard, so throttle-down is Q/Ctrl only.
  const brake = down(input, 'Space', 'KeyB');

  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttleDelta,
    brake,
  };
}

// One-shot keys: call once per frame, each press reports exactly once.
export function consumePress(input, ...codes) {
  for (const c of codes) {
    if (input.pressed.has(c)) {
      input.pressed.delete(c);
      return true;
    }
  }
  return false;
}

export function clearPresses(input) {
  input.pressed.clear();
}
