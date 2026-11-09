// Breath, in bubbles: fifteen of them. One is spent per second underwater and one
// comes back every half second at the surface. An empty bar costs a heart a second,
// so a long dive is a risk rather than a free way to cross the bay.
const MAX_BUBBLES = 15;
const DRAIN_INTERVAL = 1;
const REFILL_INTERVAL = 0.5;

// onEmpty fires once per drain tick while breath is already at zero, which is one
// call per second underwater.
export function createBreathMeter(side, { onEmpty } = {}) {
  const el = document.createElement('div');
  el.className = `breath ${side} hidden`;

  const bubbles = Array.from({ length: MAX_BUBBLES }, () => {
    const bubble = document.createElement('span');
    bubble.className = 'bubble';
    el.appendChild(bubble);
    return bubble;
  });

  document.getElementById('stage').appendChild(el);

  let breath = MAX_BUBBLES;
  let timer = 0;
  let submerged = false;
  let shown = false;

  function render() {
    for (let i = 0; i < bubbles.length; i++) {
      bubbles[i].classList.toggle('spent', i >= breath);
    }

    // The bar only appears once breath is missing, or while you are actually under.
    const visible = submerged || breath < MAX_BUBBLES;
    if (visible !== shown) {
      shown = visible;
      el.classList.toggle('hidden', !visible);
    }
  }

  function update(dt, underwater) {
    if (underwater !== submerged) {
      // Restart the tick on a state change so surfacing never refunds instantly.
      submerged = underwater;
      timer = 0;
    }

    timer += dt;
    const interval = submerged ? DRAIN_INTERVAL : REFILL_INTERVAL;
    while (timer >= interval) {
      timer -= interval;
      if (submerged) {
        if (breath > 0) breath -= 1;
        else if (onEmpty) onEmpty();
      } else if (breath < MAX_BUBBLES) {
        breath += 1;
      }
    }

    if (!submerged && breath === MAX_BUBBLES) timer = 0;
    render();
  }

  // Back to whatever a save left in the lungs.
  function restore(value) {
    breath = Number.isFinite(value)
      ? Math.min(Math.max(value, 0), MAX_BUBBLES)
      : MAX_BUBBLES;
    timer = 0;
    submerged = false;
    render();
  }

  // Back to a full lung, used when a dead player respawns.
  function reset() {
    breath = MAX_BUBBLES;
    timer = 0;
    submerged = false;
    render();
  }

  render();

  return {
    update,
    reset,
    restore,
    get breath() {
      return breath;
    },
    get submerged() {
      return submerged;
    },
  };
}
