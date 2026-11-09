// A small crosshair in the middle of each player's half of the screen, with the name
// of whatever it is pointed at underneath. Looking at something is how you interact.
export function createCrosshair(side) {
  const el = document.createElement('div');
  el.className = `crosshair ${side}`;

  const label = document.createElement('div');
  label.className = 'crosshair-label';
  label.innerHTML =
    '<span class="crosshair-name"></span><span class="crosshair-key">X</span>';
  el.appendChild(label);

  document.getElementById('stage').appendChild(el);

  const nameEl = label.querySelector('.crosshair-name');
  const keyEl = label.querySelector('.crosshair-key');
  let current = null;
  let currentKey = 'X';

  return {
    element: el,
    // The name of the aimed item, or null when looking at nothing. `key` is the badge
    // button: X normally, RT when the held item would be used on what is aimed at.
    setLabel(name, key = 'X') {
      if (key !== currentKey) {
        currentKey = key;
        keyEl.textContent = key;
      }
      if (name === current) return;
      current = name;
      nameEl.textContent = name ?? '';
      label.classList.toggle('visible', !!name);
      el.classList.toggle('aiming', !!name);
    },
  };
}
