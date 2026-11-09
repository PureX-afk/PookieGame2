// System menu: the Guide button's dedicated panel, one per side. Saving is global,
// so both panels do the same two things — save and keep playing, or save and leave
// for the launch screen. Like the settings panel, play carries on around it.
const ROWS = [
  { key: 'save', label: 'Save', action: 'save' },
  { key: 'saveExit', label: 'Save & exit', action: 'saveExit' },
];

const FOOT = 'D-pad: row &nbsp;·&nbsp; A: choose &nbsp;·&nbsp; Guide: close';
const SAVED_FOOT = 'Saved — keep playing';

export function createSystemMenu({ side, onSave, onSaveExit }) {
  const el = document.createElement('div');
  el.className = `crafting settings ${side} hidden`;
  el.innerHTML =
    '<h2>Menu</h2>' +
    ROWS.map(
      (row, index) =>
        `<div class="row action" data-row="${index}">` +
        `<span class="label">${row.label}</span>` +
        `<span class="options"><span class="opt" data-row="${index}">Choose</span></span></div>`
    ).join('') +
    `<p class="foot">${FOOT}</p>`;
  document.getElementById('stage').appendChild(el);

  const rowEls = [...el.querySelectorAll('.row')];
  const footEl = el.querySelector('.foot');

  let focus = 0;
  let open = false;
  let savedTimer = 0;

  function render() {
    for (const row of rowEls) {
      row.classList.toggle('focused', Number(row.dataset.row) === focus);
    }
  }

  function setOpen(value) {
    open = value;
    el.classList.toggle('hidden', !value);
    if (value) {
      if (savedTimer) {
        clearTimeout(savedTimer);
        savedTimer = 0;
      }
      footEl.innerHTML = FOOT;
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
      focus = (focus + dir + ROWS.length) % ROWS.length;
      render();
    },
    activate() {
      const row = ROWS[focus];
      if (row.action === 'saveExit') {
        if (onSaveExit) onSaveExit();
        return;
      }
      if (onSave) onSave();
      // The game doesn't go anywhere, so say so — then put the hint back.
      footEl.textContent = SAVED_FOOT;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        footEl.innerHTML = FOOT;
        savedTimer = 0;
      }, 1500);
    },
    get isOpen() {
      return open;
    },
  };
}
