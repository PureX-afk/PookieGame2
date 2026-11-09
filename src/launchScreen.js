// The launch screen: pick a session, then pick what you're holding. The mouse clicks
// straight through; a plugged-in controller can drive it too (d-pad or left stick to
// move, A to choose, B to go back). Play and Settings share the one panel, and the
// Settings tab holds the shared audio levels. The game itself doesn't step until a
// choice is made, so the menu polls its own pad on its own animation frame.
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

export function createLaunchScreen({ onStart, loadSave, volume, musicVolume, music }) {
  const levels = [
    { label: 'Sound effects', api: volume },
    { label: 'Music', api: musicVolume },
  ];

  const el = document.createElement('div');
  el.className = 'launch';
  el.innerHTML =
    '<div class="launch-panel">' +
    '<h1 class="launch-title">Driftwood</h1>' +
    '<p class="launch-subtitle">Stranded together</p>' +
    '<div class="launch-play">' +
    '<p class="launch-step"></p>' +
    '<div class="launch-options"></div>' +
    '<p class="launch-back hidden">← Back</p>' +
    '<p class="launch-foot launch-play-foot">Click to choose</p>' +
    '</div>' +
    '<div class="launch-settings hidden">' +
    '<p class="launch-step">Audio</p>' +
    '<div class="launch-levels"></div>' +
    '<p class="launch-back launch-settings-back">← Back to play</p>' +
    '<p class="launch-foot launch-settings-foot">Click the controls to change</p>' +
    '</div>' +
    '</div>' +
    '<p class="launch-version">driftwood 0.1 · slice 1</p>' +
    '<p class="launch-tag">two survivors · one island</p>';
  // Outside the game container on purpose: while this is up, there is no game.
  document.body.appendChild(el);

  const playEl = el.querySelector('.launch-play');
  const settingsEl = el.querySelector('.launch-settings');
  const stepEl = el.querySelector('.launch-step');
  const optionsEl = el.querySelector('.launch-options');
  const backEl = el.querySelector('.launch-back');
  const playFootEl = el.querySelector('.launch-play-foot');
  const settingsFootEl = el.querySelector('.launch-settings-foot');
  const levelsEl = el.querySelector('.launch-levels');
  const settingsBackEl = el.querySelector('.launch-settings-back');
  const PAD_FOOT = 'D-pad to move · A to choose · B to go back';
  const PAD_SETTINGS_FOOT = 'D-pad: row · left/right: change · B: back';
  const KEY_FOOT = 'Arrows/WASD: move · Enter: choose · Esc: back';
  const KEY_SETTINGS_FOOT = 'Arrows/WASD: row · left/right: change · Esc: back';

  levelsEl.innerHTML =
    levels
      .map(
        (level, index) =>
          `<div class="launch-level" data-level="${index}">` +
          '<div class="launch-level-head">' +
          `<span class="launch-level-label">${level.label}</span>` +
          '<span class="launch-level-controls">' +
          `<button class="launch-level-step" type="button" data-delta="-1" aria-label="Lower ${level.label}">−</button>` +
          '<span class="launch-level-value">100%</span>' +
          `<button class="launch-level-step" type="button" data-delta="1" aria-label="Raise ${level.label}">+</button>` +
          '</span></div>' +
          '<div class="launch-level-track"><span class="launch-level-fill"></span></div>' +
          '</div>'
      )
      .join('') +
    '<div class="launch-level" data-level="2">' +
    '<div class="launch-level-head">' +
    '<span class="launch-level-label">Song</span>' +
    '<span class="launch-level-controls">' +
    '<button class="launch-level-step" type="button" data-delta="-1" aria-label="Previous song">−</button>' +
    '<span class="launch-level-value launch-song-value">Beginning</span>' +
    '<button class="launch-level-step" type="button" data-delta="1" aria-label="Next song">+</button>' +
    '</span></div></div>' +
    '<div class="launch-level" data-level="3">' +
    '<div class="launch-level-head">' +
    '<span class="launch-level-label">Shuffle</span>' +
    '<span class="launch-level-controls">' +
    '<button class="launch-level-step launch-shuffle-toggle" type="button" aria-label="Toggle shuffle">Off</button>' +
    '</span></div></div>';
  const levelRows = [...levelsEl.querySelectorAll('.launch-level')];

  let step = 0;
  let players = 2;
  // Which tab is showing, and which audio row the pad is on.
  let tab = 'play';
  let settingsFocus = 0;
  // The choices on screen right now, and which one the pad (or a hovering mouse)
  // is sitting on.
  let choices = [];
  let selected = 0;
  let padSeen = false;
  let keyboardSeen = false;
  let polling = false;
  let upHeld = false;
  let downHeld = false;
  let leftHeld = false;
  let rightHeld = false;
  let aHeld = false;
  let bHeld = false;

  // Keyboard parity with the mouse and pad. The launch screen owns these keys while
  // it is open; the in-game input layer only reads them once a session starts.
  function onKeyDown(event) {
    if (el.classList.contains('hidden')) return;
    const code = event.code;
    const isUp = code === 'ArrowUp' || code === 'KeyW';
    const isDown = code === 'ArrowDown' || code === 'KeyS';
    const isLeft = code === 'ArrowLeft' || code === 'KeyA';
    const isRight = code === 'ArrowRight' || code === 'KeyD';
    const confirm = code === 'Enter' || code === 'Space';
    const back = code === 'Escape';
    if (!isUp && !isDown && !isLeft && !isRight && !confirm && !back) return;
    event.preventDefault();
    if (event.repeat) return;

    if (!keyboardSeen) {
      keyboardSeen = true;
      updateFoot();
    }

    if (tab === 'settings') {
      if (isUp) {
        settingsFocus = (settingsFocus - 1 + levelRows.length) % levelRows.length;
        renderLevels();
      } else if (isDown) {
        settingsFocus = (settingsFocus + 1) % levelRows.length;
        renderLevels();
      } else if (isLeft) {
        adjustAudio(-1);
      } else if (isRight) {
        adjustAudio(1);
      } else if (back || confirm) {
        showTab('play');
      }
      return;
    }

    if (isUp) select(selected - 1);
    else if (isDown) select(selected + 1);
    else if (confirm) {
      if (choices[selected]) choices[selected].pick();
    } else if (back && step === 1) {
      chooseMode();
    }
  }
  window.addEventListener('keydown', onKeyDown);

  function renderLevels() {
    levelRows.forEach((row, index) => {
      row.classList.toggle('focused', index === settingsFocus);
    });
    levels.forEach((level, index) => {
      const percent = Math.round(level.api.get() * 100);
      const row = levelRows[index];
      row.querySelector('.launch-level-value').textContent = `${percent}%`;
      row.querySelector('.launch-level-fill').style.width = `${percent}%`;
    });
    if (!music) return;
    const song = el.querySelector('.launch-song-value');
    if (song) song.textContent = music.trackTitle;
    const shuffle = el.querySelector('.launch-shuffle-toggle');
    if (shuffle) {
      shuffle.textContent = music.shuffle ? 'On' : 'Off';
      shuffle.classList.toggle('on', music.shuffle);
    }
  }

  function adjustAudio(direction) {
    if (settingsFocus < levels.length) {
      const api = levels[settingsFocus].api;
      // Right is +1, so it raises the level; keep it in 10% steps.
      const next = Math.max(0, Math.min(1, api.get() + direction * 0.1));
      api.set(Math.round(next * 10) / 10);
      renderLevels();
      return;
    }
    if (!music) return;
    if (settingsFocus === 2) music.cycleTrack(direction);
    else music.toggleShuffle();
    renderLevels();
  }

  function updateFoot() {
    if (tab === 'settings') {
      settingsFootEl.textContent = padSeen
        ? PAD_SETTINGS_FOOT
        : keyboardSeen
          ? KEY_SETTINGS_FOOT
          : 'Click the controls to change';
    } else {
      playFootEl.textContent = padSeen
        ? PAD_FOOT
        : keyboardSeen
          ? KEY_FOOT
          : 'Click to choose';
    }
  }

  function showTab(name) {
    tab = name;
    playEl.classList.toggle('hidden', name !== 'play');
    settingsEl.classList.toggle('hidden', name !== 'settings');
    renderLevels();
    updateFoot();
    ensurePolling();
  }

  settingsBackEl.addEventListener('click', () => showTab('play'));

  levelRows.forEach((row, index) => {
    row.addEventListener('mouseenter', () => {
      settingsFocus = index;
      renderLevels();
    });
  });
  for (const button of el.querySelectorAll('.launch-level-step')) {
    button.addEventListener('click', () => {
      const row = Number(button.closest('.launch-level').dataset.level);
      settingsFocus = row;
      if (row === 3) {
        if (music) music.toggleShuffle();
        renderLevels();
        return;
      }
      adjustAudio(Number(button.dataset.delta) || 0);
    });
  }

  if (music && music.onChange) {
    music.onChange(() => {
      if (tab === 'settings') renderLevels();
    });
  }

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
    const stickX = pad.axes && pad.axes[0] ? pad.axes[0] : 0;
    const up = pressed(12) || stickY < -0.55;
    const down = pressed(13) || stickY > 0.55;
    const left = pressed(14) || stickX < -0.55;
    const right = pressed(15) || stickX > 0.55;
    const confirm = pressed(0);
    const back = pressed(1);
    if (!padSeen && (up || down || left || right || confirm || back)) {
      padSeen = true;
      updateFoot();
    }

    if (tab === 'settings') {
      if (up && !upHeld) {
        settingsFocus = (settingsFocus - 1 + levelRows.length) % levelRows.length;
        renderLevels();
      }
      if (down && !downHeld) {
        settingsFocus = (settingsFocus + 1) % levelRows.length;
        renderLevels();
      }
      if (left && !leftHeld) adjustAudio(-1);
      if (right && !rightHeld) adjustAudio(1);
      if ((confirm && !aHeld) || (back && !bHeld)) showTab('play');
    } else {
      if (up && !upHeld) select(selected - 1);
      if (down && !downHeld) select(selected + 1);
      if (confirm && !aHeld && choices[selected]) choices[selected].pick();
      if (back && !bHeld && step === 1) chooseMode();
    }

    upHeld = up;
    downHeld = down;
    leftHeld = left;
    rightHeld = right;
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
      })),
      // The tab is clickable with a mouse; this gives a pad a way in too.
      {
        label: 'Settings',
        note: 'Sound effects, music and playlist',
        pick: () => showTab('settings'),
      }
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
  renderLevels();
  showTab('play');

  return {
    // Back to the first question, used when a session saves and exits.
    open() {
      el.classList.remove('hidden');
      settingsFocus = 0;
      chooseMode();
      showTab('play');
    },
    get isOpen() {
      return step >= 0 && !el.classList.contains('hidden');
    },
  };
}
