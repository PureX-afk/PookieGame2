// "You died" — covers one player's half of the split screen at zero hearts and waits
// for them to respawn. The other player keeps playing underneath it.
export function createDeathScreen(side) {
  const el = document.createElement('div');
  el.className = `death ${side} hidden`;
  const key = side === 'left' ? 'Space' : 'Enter';
  el.innerHTML =
    '<div class="death-card">' +
    '<h2>You died</h2>' +
    '<p class="death-sub">The sea got you.</p>' +
    `<p class="death-key">Press <b>A</b> on the pad or <b>${key}</b> to respawn</p>` +
    '</div>';
  document.getElementById('stage').appendChild(el);

  let open = false;

  function setOpen(value) {
    open = value;
    el.classList.toggle('hidden', !value);
  }

  return {
    show() {
      setOpen(true);
    },
    hide() {
      setOpen(false);
    },
    get isOpen() {
      return open;
    },
  };
}
