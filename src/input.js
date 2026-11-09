// Two players, one keyboard or two gamepads. Each player gets {turn, move} in -1..1.
// The launch screen has already said what is plugged in: 'pad' reads only the pads,
// 'keyboard' reads both players' keys and player one's mouse.
const DEADZONE = 0.18;
// Radians of view per pixel of mouse movement.
const MOUSE_SENSITIVITY = 0.0022;

const KEYS = [
  { turnLeft: 'KeyA', turnRight: 'KeyD', forward: 'KeyW', back: 'KeyS' },
  { turnLeft: 'ArrowLeft', turnRight: 'ArrowRight', forward: 'ArrowUp', back: 'ArrowDown' },
];

const PREVENT = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  // Firefox opens quick-find on these two; both belong to player two's hands.
  'Slash',
  'Quote',
]);

function axis(value) {
  if (Math.abs(value) < DEADZONE) return 0;
  return (value - Math.sign(value) * DEADZONE) / (1 - DEADZONE);
}

export function createInput() {
  const down = new Set();
  // Filled in by the launch screen before the game starts stepping.
  const config = { device: 'pad', players: 2 };

  // The pad's Back/View button (standard mapping button 8) is a quick refresh too. It
  // is polled on its own light loop so it works on the launch screen as well as in-game,
  // where the normal pad read only happens once gameplay starts.
  let padBackHeld = false;
  function pollPadBack() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let pressed = false;
    for (const pad of list) {
      if (pad && pad.connected !== false && pad.buttons[8] && pad.buttons[8].pressed) {
        pressed = true;
        break;
      }
    }
    if (pressed && !padBackHeld) {
      window.location.reload();
      return;
    }
    padBackHeld = pressed;
    requestAnimationFrame(pollPadBack);
  }
  requestAnimationFrame(pollPadBack);

  window.addEventListener('keydown', (event) => {
    if (PREVENT.has(event.code)) event.preventDefault();
    down.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => down.clear());

  // Mouse: look deltas and the two triggers. Only read while the pointer is captured,
  // so the menu and the page around it stay clickable.
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseLeft = false;
  let mouseRight = false;
  let locked = false;

  document.addEventListener('pointerlockchange', () => {
    locked = !!document.pointerLockElement;
    if (!locked) {
      mouseLeft = false;
      mouseRight = false;
    }
  });
  window.addEventListener('mousemove', (event) => {
    if (!locked) return;
    mouseDX += event.movementX || 0;
    mouseDY += event.movementY || 0;
  });
  window.addEventListener('mousedown', (event) => {
    if (!locked) return;
    if (event.button === 0) mouseLeft = true;
    else if (event.button === 2) mouseRight = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseLeft = false;
    else if (event.button === 2) mouseRight = false;
  });
  // Right mouse is a trigger now, so no context menu.
  window.addEventListener('contextmenu', (event) => event.preventDefault());

  // Held keys that only matter as a rising edge.
  let jumpKeyHeld = false;
  let slotPrevKeyHeld = false;
  let slotNextKeyHeld = false;
  let craftKeyHeld = false;
  let pauseKeyHeld = false;
  let navUpKeyHeld = false;
  let navDownKeyHeld = false;
  let mouseLeftHeld = false;
  let mouseRightHeld = false;

  // Player two's keys: the action cluster beside the arrow keys, since their left
  // hand is not on WASD. Every action player one has a button for needs a key here
  // too, or a second player on one keyboard can't jump, craft or save.
  const P2_KEYS = {
    jump: 'Enter',
    sprint: 'ShiftRight',
    use: 'Slash',
    alt: 'Quote',
    pick: 'Period',
    drop: 'Comma',
    craft: 'Semicolon',
    pause: 'Minus',
    guide: 'Backslash',
    prev: 'BracketLeft',
    next: 'BracketRight',
  };
  const p2Held = new Map();
  const edge2 = (code) => {
    const now = down.has(code);
    const was = p2Held.get(code) || false;
    p2Held.set(code, now);
    return now && !was;
  };

  // Respawn keys for keyboard players: player one on Space, player two on Enter.
  let respawnHeld = [false, false];
  // One pick-up and one drop key per keyboard player, so a press belongs to one
  // player rather than moving something for both of them.
  let pickHeld = [false, false];
  let dropKeyHeld = [false, false];

  const pads = [
    { turn: 0, move: 0, lookY: 0, yHeld: false, startHeld: false, guideHeld: false, aHeld: false, l3Held: false, useHeld: false, lbHeld: false, rbHeld: false, craftPressed: false, pausePressed: false, guidePressed: false, jumpPressed: false, sprintToggle: false, sprintHeld: false, usePressed: false, slotPrev: false, slotNext: false, navUp: false, navDown: false, upHeld: false, downHeld: false, pickPressed: false, pickHeld: false, dropPressed: false, dropHeld: false, ltPressed: false, ltHeld: false, rtPressed: false },
    { turn: 0, move: 0, lookY: 0, yHeld: false, startHeld: false, guideHeld: false, aHeld: false, l3Held: false, useHeld: false, lbHeld: false, rbHeld: false, craftPressed: false, pausePressed: false, guidePressed: false, jumpPressed: false, sprintToggle: false, sprintHeld: false, usePressed: false, slotPrev: false, slotNext: false, navUp: false, navDown: false, upHeld: false, downHeld: false, pickPressed: false, pickHeld: false, dropPressed: false, dropHeld: false, ltPressed: false, ltHeld: false, rtPressed: false },
  ];

  function readPads() {
    const connected = [];
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of list) {
      if (pad && pad.connected !== false) connected.push(pad);
    }

    for (let i = 0; i < 2; i++) {
      const pad = connected[i];
      if (!pad) {
        pads[i].turn = 0;
        pads[i].move = 0;
        pads[i].lookY = 0;
        pads[i].craftPressed = false;
        pads[i].pausePressed = false;
        pads[i].guidePressed = false;
        pads[i].guideHeld = false;
        pads[i].jumpPressed = false;
        pads[i].sprintToggle = false;
        pads[i].sprintHeld = false;
        pads[i].usePressed = false;
        pads[i].useHeld = false;
        pads[i].slotPrev = false;
        pads[i].slotNext = false;
        pads[i].lbHeld = false;
        pads[i].rbHeld = false;
        pads[i].navUp = false;
        pads[i].navDown = false;
        pads[i].upHeld = false;
        pads[i].downHeld = false;
        pads[i].pickPressed = false;
        pads[i].pickHeld = false;
        pads[i].dropPressed = false;
        pads[i].dropHeld = false;
        pads[i].ltPressed = false;
        pads[i].ltHeld = false;
        pads[i].rtPressed = false;
        pads[i].yHeld = false;
        pads[i].startHeld = false;
        pads[i].aHeld = false;
        pads[i].l3Held = false;
        continue;
      }
      // Stick right is positive on axis 0, stick down is positive on axis 1.
      pads[i].turn = -axis(pad.axes[0] || 0);
      pads[i].move = -axis(pad.axes[1] || 0);
      // Right stick: X turns (same direction as the left stick), Y looks up/down.
      pads[i].turn += -axis(pad.axes[2] || 0);
      pads[i].lookY = -axis(pad.axes[3] || 0);
      // Y is button 3 in the standard mapping; fire once per press, not per frame.
      const y = !!(pad.buttons[3] && pad.buttons[3].pressed);
      pads[i].craftPressed = y && !pads[i].yHeld;
      pads[i].yHeld = y;
      // Start is button 9; same rising-edge treatment.
      const start = !!(pad.buttons[9] && pad.buttons[9].pressed);
      pads[i].pausePressed = start && !pads[i].startHeld;
      pads[i].startHeld = start;
      // Guide is button 16 in the standard mapping; edge-triggered so holding it
      // doesn't flap the menu open and shut.
      const guide = !!(pad.buttons[16] && pad.buttons[16].pressed);
      pads[i].guidePressed = guide && !pads[i].guideHeld;
      pads[i].guideHeld = guide;
      // A is button 0; edge-triggered so holding it doesn't bunny-hop.
      const a = !!(pad.buttons[0] && pad.buttons[0].pressed);
      pads[i].jumpPressed = a && !pads[i].aHeld;
      pads[i].aHeld = a;
      // Left stick click is button 10; clicking toggles sprint, so you don't have
      // to hold the stick down while steering.
      const l3 = !!(pad.buttons[10] && pad.buttons[10].pressed);
      pads[i].sprintToggle = l3 && !pads[i].l3Held;
      pads[i].sprintHeld = l3;
      pads[i].l3Held = l3;
      // Right trigger is button 7; analog value on most pads, edge-triggered.
      const rt = !!(pad.buttons[7] && (pad.buttons[7].pressed || (pad.buttons[7].value || 0) > 0.5));
      pads[i].usePressed = rt && !pads[i].useHeld;
      // Same press again under its own name, so freezing the punch during the fire
      // game doesn't also take away the trigger it needs.
      pads[i].rtPressed = pads[i].usePressed;
      pads[i].useHeld = rt;
      // Left trigger is button 6; the fire game alternates it with the right one.
      const lt = !!(pad.buttons[6] && (pad.buttons[6].pressed || (pad.buttons[6].value || 0) > 0.5));
      pads[i].ltPressed = lt && !pads[i].ltHeld;
      pads[i].ltHeld = lt;
      // Bumpers step the hotbar: LB is button 4, RB is button 5.
      const lb = !!(pad.buttons[4] && pad.buttons[4].pressed);
      pads[i].slotPrev = lb && !pads[i].lbHeld;
      pads[i].lbHeld = lb;
      const rb = !!(pad.buttons[5] && pad.buttons[5].pressed);
      pads[i].slotNext = rb && !pads[i].rbHeld;
      pads[i].rbHeld = rb;
      // Menu navigation: d-pad up/down, or the left stick pushed past half.
      const axisY = pad.axes && pad.axes[1] ? pad.axes[1] : 0;
      const up = !!((pad.buttons[12] && pad.buttons[12].pressed) || axisY < -0.55);
      const down = !!((pad.buttons[13] && pad.buttons[13].pressed) || axisY > 0.55);
      pads[i].navUp = up && !pads[i].upHeld;
      pads[i].navDown = down && !pads[i].downHeld;
      pads[i].upHeld = up;
      pads[i].downHeld = down;
      // X is button 2 in the standard mapping; edge-triggered so one press is one pick.
      const pick = !!(pad.buttons[2] && pad.buttons[2].pressed);
      pads[i].pickPressed = pick && !pads[i].pickHeld;
      pads[i].pickHeld = pick;
      // B is button 1; same rising-edge treatment so one press is one drop.
      const drop = !!(pad.buttons[1] && pad.buttons[1].pressed);
      pads[i].dropPressed = drop && !pads[i].dropHeld;
      pads[i].dropHeld = drop;
    }
  }

  const held = (a, b) => (down.has(a) ? 1 : 0) - (down.has(b) ? 1 : 0);
  const clamp = (v) => Math.max(-1, Math.min(1, v));

  return {
    // What the launch screen settled on. Read before creating the session.
    configure(next) {
      if (next.players) config.players = next.players;
      if (next.device) config.device = next.device;
    },
    get device() {
      return config.device;
    },
    get players() {
      return config.players;
    },
    get pointerLocked() {
      return locked;
    },

    read() {
      readPads();

      const padOn = config.device === 'pad';

      // Mouse look covers the frame, so it is handed over as a delta rather than a
      // speed; the deltas are cleared here so nothing is counted twice.
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      const leftPressed = mouseLeft && !mouseLeftHeld;
      mouseLeftHeld = mouseLeft;
      const rightPressed = mouseRight && !mouseRightHeld;
      mouseRightHeld = mouseRight;

      const jumpKey = down.has('Space');
      const jumpKeyPressed = jumpKey && !jumpKeyHeld;
      jumpKeyHeld = jumpKey;
      const slotPrevKey = down.has('KeyQ');
      const slotPrevPressed = slotPrevKey && !slotPrevKeyHeld;
      slotPrevKeyHeld = slotPrevKey;
      const slotNextKey = down.has('KeyE');
      const slotNextPressed = slotNextKey && !slotNextKeyHeld;
      slotNextKeyHeld = slotNextKey;
      const craftKey = down.has('KeyY');
      const craftKeyPressed = craftKey && !craftKeyHeld;
      craftKeyHeld = craftKey;
      const pauseKey = down.has('Escape');
      const pauseKeyPressed = pauseKey && !pauseKeyHeld;
      pauseKeyHeld = pauseKey;
      const navUpKey = down.has('KeyW');
      const navUpPressed = navUpKey && !navUpKeyHeld;
      navUpKeyHeld = navUpKey;
      const navDownKey = down.has('KeyS');
      const navDownPressed = navDownKey && !navDownKeyHeld;
      navDownKeyHeld = navDownKey;

      const respawnNow = [down.has('Space'), down.has('Enter') || down.has('NumpadEnter')];
      const respawnPressed = [
        respawnNow[0] && !respawnHeld[0],
        respawnNow[1] && !respawnHeld[1],
      ];
      respawnHeld = [...respawnNow];

      const pickNow = [down.has('KeyX'), down.has(P2_KEYS.pick)];
      const pickPressed = [pickNow[0] && !pickHeld[0], pickNow[1] && !pickHeld[1]];
      pickHeld = pickNow;
      const dropNow = [down.has('KeyB'), down.has(P2_KEYS.drop)];
      const dropPressed = [dropNow[0] && !dropKeyHeld[0], dropNow[1] && !dropKeyHeld[1]];
      dropKeyHeld = dropNow;

      // Player two's rising edges, read once a frame each so nothing is counted twice.
      const p2 = {
        jump: edge2(P2_KEYS.jump),
        use: edge2(P2_KEYS.use),
        alt: edge2(P2_KEYS.alt),
        craft: edge2(P2_KEYS.craft),
        pause: edge2(P2_KEYS.pause),
        guide: edge2(P2_KEYS.guide),
        prev: edge2(P2_KEYS.prev),
        next: edge2(P2_KEYS.next),
        navUp: edge2('ArrowUp'),
        navDown: edge2('ArrowDown'),
      };

      const list = KEYS.map((keys, i) => {
        const pad = pads[i];
        // Player one holds the mouse; player two and pads use their own devices.
        const mousePlayer = !padOn && i === 0;

        return {
          turn: clamp(held(keys.turnLeft, keys.turnRight) + (padOn ? pad.turn : 0)),
          move: clamp(held(keys.forward, keys.back) + (padOn ? pad.move : 0)),
          lookY: padOn ? clamp(pad.lookY) : 0,
          // Radians to add straight to this player's yaw and pitch.
          yawDelta: mousePlayer ? -dx * MOUSE_SENSITIVITY : 0,
          pitchDelta: mousePlayer ? -dy * MOUSE_SENSITIVITY : 0,
          craftPressed: padOn ? pad.craftPressed : mousePlayer ? craftKeyPressed : p2.craft,
          pausePressed: padOn ? pad.pausePressed : mousePlayer ? pauseKeyPressed : p2.pause,
          guidePressed: padOn ? pad.guidePressed : mousePlayer ? false : p2.guide,
          jumpPressed: padOn ? pad.jumpPressed : mousePlayer ? jumpKeyPressed : p2.jump,
          sprintToggle: padOn ? pad.sprintToggle : false,
          sprintHeld: padOn
            ? pad.sprintHeld
            : mousePlayer
              ? down.has('ShiftLeft') || down.has('ShiftRight')
              : down.has(P2_KEYS.sprint),
          usePressed: padOn ? pad.usePressed : mousePlayer ? leftPressed : p2.use,
          useHeld: padOn ? pad.useHeld : mousePlayer ? mouseLeft : down.has(P2_KEYS.use),
          slotPrev: padOn ? pad.slotPrev : mousePlayer ? slotPrevPressed : p2.prev,
          slotNext: padOn ? pad.slotNext : mousePlayer ? slotNextPressed : p2.next,
          navUp: padOn ? pad.navUp : mousePlayer ? navUpPressed : p2.navUp,
          navDown: padOn ? pad.navDown : mousePlayer ? navDownPressed : p2.navDown,
          // A on the pad, or that player's respawn key on the keyboard.
          respawnPressed: (padOn ? pad.jumpPressed : false) || respawnPressed[i],
          pickPressed: padOn ? pad.pickPressed : pickPressed[i],
          dropPressed: padOn ? pad.dropPressed : dropPressed[i],
          cancelPressed: padOn ? pad.dropPressed : dropPressed[i],
          // The two triggers, kept apart from the punch for the fire-lighting game.
          ltPressed: padOn ? pad.ltPressed : mousePlayer ? rightPressed : p2.alt,
          ltHeld: padOn ? pad.ltHeld : mousePlayer ? mouseRight : down.has(P2_KEYS.alt),
          rtPressed: padOn ? pad.rtPressed : mousePlayer ? leftPressed : p2.use,
        };
      });

      if (config.players === 1) {
        // One player means one set of controls; the second half stays asleep even if a
        // pad is plugged in.
        Object.assign(list[1], {
          turn: 0,
          move: 0,
          lookY: 0,
          yawDelta: 0,
          pitchDelta: 0,
          craftPressed: false,
          pausePressed: false,
          guidePressed: false,
          jumpPressed: false,
          sprintToggle: false,
          sprintHeld: false,
          usePressed: false,
          useHeld: false,
          slotPrev: false,
          slotNext: false,
          navUp: false,
          navDown: false,
          respawnPressed: false,
          pickPressed: false,
          dropPressed: false,
          cancelPressed: false,
          ltPressed: false,
          ltHeld: false,
          rtPressed: false,
        });
      }

      return list;
    },

    // Rumble player i's pad (0 or 1). Silent when the pad has no actuator, which is
    // the normal case for keyboard players.
    rumble(i, strong = 0.6, weak = 0.3, duration = 220) {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      const connected = [];
      for (const pad of list) {
        if (pad && pad.connected !== false) connected.push(pad);
      }
      const actuator = connected[i] && connected[i].vibrationActuator;
      if (!actuator || !actuator.playEffect) return;
      const played = actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        strongMagnitude: strong,
        weakMagnitude: weak,
      });
      if (played && played.catch) played.catch(() => {});
    },
  };
}
