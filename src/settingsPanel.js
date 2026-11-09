// Per-player settings panel: opens on the presser's own side when they hit Start,
// and play carries on around it — the other player is never interrupted. Up/down
// picks a row, A cycles that player's own value. The rest of that side is covered
// by the large controller reference while the panel is open.
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
  // Not an option: A here saves the session and drops back to the launch screen.
  { key: 'save', label: 'Save & exit', action: 'save' },
];

export function createSettingsPanel({ settings, side, onSave }) {
  // The guide is appended first so the settings pane paints above it.
  const guide = createControlsGuide({ side });
  const el = document.createElement('div');
  el.className = `crafting settings ${side} hidden`;
  el.innerHTML =
    '<h2>Settings</h2>' +
    ROWS.map((row, index) => {
      const options = row.action
        ? '<span class="opt" data-row="' + index + '">Save</span>'
        : row.options
            .map(
              (value) =>
                `<span class="opt" data-row="${index}" data-value="${value}">${row.labels[value]}</span>`
            )
            .join('');
      return (
        `<div class="row${row.action ? ' action' : ''}" data-row="${index}">` +
        `<span class="label">${row.label}</span>` +
        `<span class="options">${options}</span></div>`
      );
    }).join('') +
    '<p class="foot">D-pad/left stick: row &nbsp;·&nbsp; A: change or save &nbsp;·&nbsp; Start: close</p>';
  document.getElementById('stage').appendChild(el);

  const rowEls = [...el.querySelectorAll('.row')];
  const options = [...el.querySelectorAll('.opt')];

  let focus = 0;
  let open = false;

  function render() {
    for (const row of rowEls) {
      row.classList.toggle('focused', Number(row.dataset.row) === focus);
    }
    for (const option of options) {
      const row = ROWS[Number(option.dataset.row)];
      // Action rows have nothing to be active about.
      if (row.action) continue;
      option.classList.toggle('active', option.dataset.value === settings[row.key]);
    }
  }

  function setOpen(value) {
    open = value;
    el.classList.toggle('hidden', !value);
    guide.setOpen(value);
    if (value) render();
  }

  render();

  return {
    toggle() {
      setOpen(!open);
    },
    setOpen,
    moveFocus(dir) {
      focus = (focus + dir + ROWS.length) % ROWS.length;
      render();
    },
    activate() {
      const row = ROWS[focus];
      if (row.action === 'save') {
        if (onSave) onSave();
        return;
      }
      settings.cycle(row.key);
      render();
    },
    get isOpen() {
      return open;
    },
  };
}
