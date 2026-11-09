// The launch screen: pick a session, then pick what you're holding. The mouse clicks
// straight through; a plugged-in controller can drive it too (d-pad or left stick to
// move, A to choose, B to go back). The game itself doesn't step until a choice
// is made, so the menu polls its own pad on its own animation frame.
const MODES = [
  {
    id: 'single',
    label: 'Single player',
    note: 'One survivor, one full screen',
    players: 1,
  },
  {
    id: 'multi',
    label: 'Multiplayer',
    note: 'Two survivors, split screen',
    players: 2,
  },
];

const DEVICES = [
  {
    id: 'keyboard',
    label: 'Mouse & keyboard',
    note: 'WASD to move, mouse to look, clicks to act',
    device: 'keyboard',
  },
  {
    id: 'pad',
    label: 'Controller',
    note: 'Two sticks, triggers and face buttons',
    device: 'pad',
  },
];

// "Saved today at 14:32" / "Saved Nov 3 at 09:07" — enough to recognise the run.
function describeWhen(timestamp) {
  if (!Number.isFinite(timestamp)) return 'Saved earlier';
  const saved = new Date(timestamp);
  const time = saved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (saved.toDateString() === new Date().toDateString()) return `Saved today at ${time}`;
  const day = saved.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `Saved ${day} at ${time}`;
}

function describePlayTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 60) return 'under a minute played';
  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours && minutes) return `${hours}h ${minutes}m played`;
  if (hours) return `${hours}h played`;
  return `${minutes}m played`;
}

export function createLaunchScreen({ onStart, loadSave }) {
  const el = document.createElement('div');
  el.className = 'launch';
  el.innerHTML =
    '<div class="launch-panel">' +
    '<h1 class="launch-title">Driftwood</h1>' +
    '<p class="launch-subtitle">Stranded together</p>' +
    '<p class="launch-step"></p>' +
    '<div class="launch-options"></div>' +
    '<p class="launch-back hidden">← Back</p>' +
    '<p class="launch-foot">Click to choose</p>' +
    '</div>' +
    '<p class="launch-version">driftwood 0.1 · slice 1</p>' +
    '<p class="launch-tag">two survivors · one island</p>';
  // Outside the game container on purpose: while this is up, there is no game. 
  document.body.appendChild(el);

  const stepEl = el.querySelector('.launch-step');
  const optionsEl = el.querySelector('.launch-options');
  const backEl = el.querySelector('.launch-back');
  const footEl = el.querySelector('.launch-foot');
  const PAD_FOOT = 'D-pad to move · A to choose · B to go back';

  let step = 0;
  let players = 2;
  // The choices on screen right now, and which one the pad (or a hovering mouse)
  // is sitting on.
  let choices = [];
  let selected = 0;
  let padSeen = false;
  let polling = false;
  let upHeld = false;
  let downHeld = false;
  let aHeld = false;
  let bHeld = false;

  // Keys have no say here: the menu is a mouse and controller surface.
  el.addEventListener('keydown', (event) => event.preventDefault());

  function highlight() {
    const buttons = optionsEl.querySelectorAll('.launch-option');
    buttons.forEach((button, index) => button.classList.toggle('selected', index === selected));
  }

  function select(index) {
    if (!choices.length) return;
    selected = (index + choices.length) % choices.length;
    highlight();
  }

  // One connected pad is enough for the menu: the first one found drives it.
  function readMenuPad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const candidate of list) {
      if (candidate && candidate.connected !== false) {
        pad = candidate;
        break;
      }
    }
    if (!pad) return;
    const pressed = (index) => !!(pad.buttons[index] && pad.buttons[index].pressed);
    const stickY = pad.axes && pad.axes[1] ? pad.axes[1] : 0;
    const up = pressed(12) || stickY < -0.55;
    const down = pressed(13) || stickY > 0.55;
    const confirm = pressed(0);
    const back = pressed(1);
    if (!padSeen && (up || down || confirm || back)) {
      padSeen = true;
      footEl.textContent = PAD_FOOT;
    }
    if (up && !upHeld) select(selected - 1);
    if (down && !downHeld) select(selected + 1);
    if (confirm && !aHeld && choices[selected]) choices[selected].pick();
    if (back && !bHeld && step === 1) chooseMode();
    upHeld = up;
    downHeld = down;
    aHeld = confirm;
    bHeld = back;
  }

  // The menu's own frame loop: it runs only while the menu is showing and stops
  // the moment a choice starts the game.
  function poll() {
    if (el.classList.contains('hidden')) {
      polling = false;
      return;
    }
    polling = true;
    readMenuPad();
    requestAnimationFrame(poll);
  }

  function ensurePolling() {
    if (!polling) poll();
  }

  function showStep(stepChoices, label) {
    stepEl.textContent = label;
    optionsEl.innerHTML = '';
    choices = stepChoices;
    selected = 0;
    for (let index = 0; index < stepChoices.length; index++) {
      const choice = stepChoices[index];
      const button = document.createElement('button');
      button.className = 'launch-option';
      button.type = 'button';
      button.innerHTML =
        `<span class="launch-option-label">${choice.label}</span>` +
        `<span class="launch-option-note">${choice.note}</span>`;
      button.addEventListener('click', () => choice.pick());
      // A hovering mouse moves the pad cursor with it, so both agree on highlight.
      button.addEventListener('mouseenter', () => select(index));
      optionsEl.appendChild(button);
    }
    highlight();
    ensurePolling();
  }

  function chooseMode() {
    step = 0;
    backEl.classList.add('hidden');

    const options = [];
    // A save is offered first: it brings its own player count and device with it, and
    // says when it was made and how long that run has been going.
    const saved = loadSave ? loadSave() : null;
    if (saved) {
      options.push({
        label: 'Continue',
        note: `${describeWhen(saved.savedAt)} · ${describePlayTime(saved.playTime)}`,
        pick: () => {
          startSession({
            players: saved.players === 1 ? 1 : 2,
            device: saved.device === 'keyboard' ? 'keyboard' : 'pad',
            state: saved,
          });
        },
      });
    }

    options.push(
      ...MODES.map((mode) => ({
        label: mode.label,
        note: mode.note,
        pick: () => {
          players = mode.players;
          chooseDevice();
        },
      }))
    );

    showStep(options, '1 · How many survivors?');
  }

  function chooseDevice() {
    step = 1;
    backEl.classList.remove('hidden');
    showStep(
      DEVICES.map((device) => ({
        label: device.label,
        note: device.note,
        pick: () => start(device.device),
      })),
      '2 · What are you playing with?'
    );
  }

  function startSession(session) {
    el.classList.add('hidden');
    onStart(session);
  }

  function start(device) {
    startSession({ players, device });
  }

  backEl.addEventListener('click', chooseMode);

  chooseMode();

  return {
    // Back to the first question, used when a session saves and exits.
    open() {
      el.classList.remove('hidden');
      chooseMode();
    },
    get isOpen() {
      return step >= 0 && !el.classList.contains('hidden');
    },
  };
}
