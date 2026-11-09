// A tint over one player's half of the screen when their eyes drop below the
// surface. The split-screen view is a single canvas, so this is a DOM overlay
// clipped to that player's viewport rather than anything in the renderer.
export function createUnderwaterOverlay(side) {
  const el = document.createElement('div');
  el.className = `underwater ${side}`;
  document.getElementById('stage').appendChild(el);

  let opacity = 0;

  function update(dt, eyeY) {
    const target = eyeY < 0 ? 1 : 0;
    opacity += (target - opacity) * (1 - Math.exp(-9 * dt));
    el.style.opacity = opacity.toFixed(3);
  }

  return { update };
}
