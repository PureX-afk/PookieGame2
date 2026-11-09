// Lighting a campfire is both hands: alternate the triggers and the bar fills. Only a
// press that swaps sides counts, so mashing one trigger gets you nowhere, and the bar
// sags while you stall — rhythm works, panic doesn't have to.
const GAIN = 0.085; // per alternating press
const DECAY = 0.16; // per second while the hands stall

export function createLightingGame(side) {
  const el = document.createElement('div');
  el.className = `lighting ${side} hidden`;
  el.innerHTML =
    '<p class="lighting-title">Get the fire going</p>' +
    '<div class="lighting-track"><span class="lighting-fill"></span></div>' +
    '<p class="lighting-hint">Alternate <b>LT</b> / <b>RT</b> &nbsp;·&nbsp; B: stop</p>';
  document.getElementById('stage').appendChild(el);

  const fillEl = el.querySelector('.lighting-fill');

  let running = false;
  let progress = 0;
  // Which hand went last. The first press of either kind always counts.
  let last = null;

  function render() {
    const shown = Math.min(progress, 1);
    fillEl.style.width = `${(shown * 100).toFixed(1)}%`;
    fillEl.classList.toggle('low', shown < 0.34);
  }

  return {
    start() {
      running = true;
      progress = 0;
      last = null;
      el.classList.remove('hidden');
      render();
    },

    stop() {
      running = false;
      el.classList.add('hidden');
    },

    // 'lit' when the bar fills, 'cancelled' when the player backs out, else null.
    update(dt, controls) {
      if (!running) return null;

      if (controls.cancelPressed) {
        running = false;
        el.classList.add('hidden');
        return 'cancelled';
      }

      // A press only pushes the bar up when it comes from the other hand.
      if (controls.ltPressed && last !== 'lt') {
        last = 'lt';
        progress += GAIN;
      }
      if (controls.rtPressed && last !== 'rt') {
        last = 'rt';
        progress += GAIN;
      }

      // The fire cools while you think about it.
      progress = Math.max(0, progress - DECAY * dt);
      render();

      if (progress >= 1) {
        running = false;
        el.classList.add('hidden');
        return 'lit';
      }
      return null;
    },

    get isOpen() {
      return running;
    },
    get progress() {
      return progress;
    },
  };
}
