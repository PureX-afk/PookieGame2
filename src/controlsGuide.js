// A large, non-interactive controller reference. While a player's settings panel is
// open, this fills the rest of their side of the screen (their half in split screen,
// the whole screen when playing alone). The binding notes sit directly on the pad,
// next to the control they describe, so the diagram reads at a glance.
//
// Controller art: "Xbox Controller.svg" by Jishenaz, via Wikimedia Commons (CC0).
// The baked-in number labels were removed from the local copy.
const CONTROLLER_ART = new URL('../assets/xbox-controller.svg', import.meta.url).href;

// Positions are percentages of the controller artwork's box, so the notes stay
// pinned to the right button at every size.
const NOTES = [
  { key: 'LT', action: 'Alt', x: 25.5, y: 4 },
  { key: 'RT', action: 'Use', x: 74.5, y: 4 },
  { key: 'LB', action: 'Prev item', x: 12.5, y: 16.5 },
  { key: 'RB', action: 'Next item', x: 87.5, y: 16.5 },
  { key: 'L Stick', action: 'Move', x: 22.5, y: 65 },
  { key: 'L3', action: 'Sprint', x: 22.5, y: 72 },
  { key: 'D-pad', action: 'Menus', x: 35.5, y: 55 },
  { key: 'R Stick', action: 'Look', x: 62.5, y: 57 },
  { key: 'Guide', action: 'Menu', x: 50, y: 22 },
  { key: 'View', action: '', x: 38, y: 35.5 },
  { key: 'Start', action: 'Settings', x: 62, y: 35.5 },
  { key: 'Y', action: 'Craft', x: 78.4, y: 26, tone: 'y' },
  { key: 'X', action: 'Pick up', x: 67, y: 45.5, align: 'end', tone: 'x' },
  { key: 'B', action: 'Drop', x: 90.5, y: 49.8, align: 'start', tone: 'b' },
  { key: 'A', action: 'Jump', x: 79, y: 68, tone: 'a' },
];

function notesHtml() {
  return NOTES.map(({ key, action, x, y, align, tone }) => {
    const classes = align ? `pad-note ${align}` : 'pad-note';
    const keyClass = tone ? ` class="tone-${tone}"` : '';
    const actionHtml = action ? `<span class="pad-note-act">${action}</span>` : '';
    return (
      `<span class="${classes}" style="left:${x}%;top:${y}%">` +
      `<b${keyClass}>${key}</b>${actionHtml}</span>`
    );
  }).join('');
}

export function createControlsGuide({ side }) {
  const el = document.createElement('div');
  el.className = `controls-guide ${side} hidden`;
  el.innerHTML =
    '<div class="controls-card">' +
    '<div class="controls-head">' +
    '<h2>Controller</h2>' +
    '<span>Default Xbox bindings</span>' +
    '</div>' +
    '<div class="pad-stage">' +
    `<img class="pad-render" src="${CONTROLLER_ART}" alt="Xbox controller">` +
    notesHtml() +
    '</div>' +
    '</div>';
  document.getElementById('stage').appendChild(el);

  return {
    setOpen(value) {
      el.classList.toggle('hidden', !value);
    },
    get isOpen() {
      return !el.classList.contains('hidden');
    },
  };
}
