// Per-player settings panel: opens on the presser's own side when they hit Start,
// and play carries on around it — the other player is never interrupted. Up/down
// picks a row, left/right changes that row's value; A cycles a value or opens a
// submenu. The rest of that side is covered by the large controller reference while
// the panel is open.
//
// Volume is the one shared audio screen: it holds both levels and the playlist, because
// both players hear the same speakers.
import {
  SPRINT_MODES,
  SPRINT_LABELS,
  UI_SIZES,
  UI_SIZE_LABELS,
} from './settings.js';
import { createControlsGuide } from './controlsGuide.js';

const ROWS = [
  { key: 'sprintMode', label: 'Sprint', options: SPRINT_MODES, labels: SPRINT_LABELS },
  { key: 'uiSize', label: 'UI size', options: UI_SIZES, labels: UI_SIZE_LABELS },
  // Opens the shared audio screen rather than cycling a value in place.
  { key: 'volume', label: 'Volume', submenu: 'volume' },
  // Not an option: A here saves the session and drops back to the launch screen.
  { key: 'save', label: 'Save & exit', action: 'save' },
];

// One shared audio screen. The first two rows are 0-1 levels with a bar; the other two
// choose what the speakers play: the song from the playlist, and whether the playlist
// shuffles instead of running in order.
const AUDIO_ROWS = [
  { key: 'volume', label: 'Sound effects', level: true, value: 'data-volume-value', fill: 'data-volume-fill' },
  { key: 'music', label: 'Music', level: true, value: 'data-music-value', fill: 'data-music-fill' },
  { key: 'track', label: 'Song', value: 'data-track-value' },
  { key: 'shuffle', label: 'Shuffle', value: 'data-shuffle-value' },
];

export function createSettingsPanel({ settings, side, onSave, volume, musicVolume, music }) {
  const levels = { volume, music: musicVolume };
  // The guide is appended first so the settings pane paints above it.
  const guide = createControlsGuide({ side });
  const el = document.createElement('div');
  el.className = `crafting settings ${side} hidden`;
  el.innerHTML =
    '<div class="settings-view settings-main">' +
    '<h2>Settings</h2>' +
    ROWS.map((row, index) => {
      let options;
      if (row.action) {
        options = '<span class="opt" data-row="' + index + '">Save</span>';
      } else if (row.submenu) {
        options = `<span class="opt" data-row="${index}" data-volume-value>100%</span>`;
      } else {
        options = row.options
          .map(
            (value) =>
              `<span class="opt" data-row="${index}" data-value="${value}">${row.labels[value]}</span>`
          )
          .join('');
      }
      return (
        `<div class="row${row.action ? ' action' : ''}" data-row="${index}">` +
        `<span class="label">${row.label}</span>` +
        `<span class="options">${options}</span></div>`
      );
    }).join('') +
    '<p class="foot">D-pad/left stick: row &nbsp;·&nbsp; left/right or A: change &nbsp;·&nbsp; Start: close</p>' +
    '</div>' +
    '<div class="settings-view settings-volume hidden">' +
    '<h2>Settings <span class="crumb">/ Volume</span></h2>' +
    AUDIO_ROWS.map((row, index) => {
      const bar = row.level
        ? `<div class="volume-track"><span class="volume-fill" ${row.fill}></span></div>`
        : '';
      return (
        `<div class="volume-item" data-level="${row.key}">` +
        `<div class="row" data-volume-row="${index}">` +
        `<span class="label">${row.label}</span>` +
        `<span class="options"><span class="opt active" ${row.value}>${row.level ? '100%' : '—'}</span></span>` +
        '</div>' +
        bar +
        '</div>'
      );
    }).join('') +
    '<p class="foot">D-pad/left stick: row &nbsp;·&nbsp; left/right: change &nbsp;·&nbsp; A: back &nbsp;·&nbsp; Start: close</p>' +
    '</div>';
  document.getElementById('stage').appendChild(el);

  const views = {
    main: el.querySelector('.settings-main'),
    volume: el.querySelector('.settings-volume'),
  };
  const rowEls = [...views.main.querySelectorAll('.row')];
  const options = [...views.main.querySelectorAll('.opt')];
  const levelRows = [...views.volume.querySelectorAll('[data-volume-row]')];

  let focus = 0;
  let levelFocus = 0;
  let open = false;
  let view = 'main';

  function renderLevels() {
    for (const row of AUDIO_ROWS) {
      if (!row.level) continue;
      const percent = Math.round(levels[row.key].get() * 100);
      for (const node of el.querySelectorAll(`[${row.value}]`)) {
        node.textContent = `${percent}%`;
      }
      for (const node of el.querySelectorAll(`[${row.fill}]`)) {
        node.style.width = `${percent}%`;
      }
    }
    if (!music) return;
    const song = el.querySelector('[data-track-value]');
    if (song) song.textContent = music.trackTitle;
    const shuffle = el.querySelector('[data-shuffle-value]');
    if (shuffle) shuffle.textContent = music.shuffle ? 'On' : 'Off';
  }

  function render() {
    for (const [name, node] of Object.entries(views)) {
      node.classList.toggle('hidden', view !== name);
    }
    renderLevels();
    for (const row of rowEls) {
      row.classList.toggle('focused', Number(row.dataset.row) === focus);
    }
    for (const row of levelRows) {
      row.classList.toggle('focused', Number(row.dataset.volumeRow) === levelFocus);
    }
    for (const option of options) {
      const row = ROWS[Number(option.dataset.row)];
      // Action rows and the volume row are not a set of values to highlight.
      if (row.action || row.submenu) continue;
      option.classList.toggle('active', option.dataset.value === settings[row.key]);
    }
  }

  function setOpen(value) {
    open = value;
    el.classList.toggle('hidden', !value);
    guide.setOpen(value);
    if (value) {
      // Every visit starts at the top level.
      view = 'main';
      levelFocus = 0;
      render();
    }
  }

  function adjustLevel(levelKey, direction) {
    const api = levels[levelKey];
    // Right is +1, so it raises the level; keep the value in 10% steps.
    const next = Math.max(0, Math.min(1, api.get() + direction * 0.1));
    api.set(Math.round(next * 10) / 10);
    renderLevels();
  }

  // Left/right on the audio screen: nudge a level, step through the playlist, or flip
  // shuffle. Right plays the next song, left the previous one.
  function adjustAudio(direction) {
    const row = AUDIO_ROWS[levelFocus];
    if (row.level) {
      adjustLevel(row.key, direction);
      return;
    }
    if (!music) return;
    if (row.key === 'track') music.cycleTrack(direction);
    else music.toggleShuffle();
    renderLevels();
  }

  function adjust(direction) {
    if (view === 'volume') {
      adjustAudio(direction);
      return;
    }
    const row = ROWS[focus];
    if (row.options) {
      settings.cycle(row.key, direction);
      render();
    }
  }

  render();

  return {
    toggle() {
      setOpen(!open);
    },
    setOpen,
    moveFocus(dir) {
      if (view === 'volume') {
        levelFocus = (levelFocus + dir + AUDIO_ROWS.length) % AUDIO_ROWS.length;
        render();
        return;
      }
      focus = (focus + dir + ROWS.length) % ROWS.length;
      render();
    },
    // Left/right: adjust a level on the Volume screen, or step an option on the
    // top-level list.
    adjust,
    activate() {
      if (view === 'volume') {
        view = 'main';
        render();
        return;
      }
      const row = ROWS[focus];
      if (row.action === 'save') {
        if (onSave) onSave();
        return;
      }
      if (row.submenu) {
        view = row.submenu;
        levelFocus = 0;
        render();
        return;
      }
      settings.cycle(row.key);
      render();
    },
    get isOpen() {
      return open;
    },
    refreshAudio() {
      renderLevels();
    },
  };
}
