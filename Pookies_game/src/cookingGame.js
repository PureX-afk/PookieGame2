// Cooking by hand: leaning in over a fire runs the cook clock faster, but the fish has
// to be turned on the beat. A marker sweeps the track and a press inside the band rolls
// the fish over and gives it a burst of heat; a press outside it burns the edge and
// costs some of the time back. Every clean turn makes the next one harder — the sweep is
// quicker and the band is narrower — and a third burnt edge ruins the fish. The player
// can keep at it until the fish is done, or back out and let the fire finish it slowly.
const SWEEP_START = 0.85; // track widths per second, on the first turn
const SWEEP_STEP = 0.09; // and this much faster for every clean turn after it
const SWEEP_MAX = 1.75;
const ZONE_START = 0.15; // how wide the band starts out, as a fraction of the track
const ZONE_STEP = 0.013; // and how much it narrows with every clean turn
const ZONE_MIN = 0.045;
// Burnt edges a fish survives before there is no saving it.
export const MISS_LIMIT = 3;
// Seconds of cooking the fire does per second while a player has the fish in hand.
export const MANUAL_RATE = 2.5;
// A burnt edge gives this many back.
export const FLIP_LOSS = 1.5;
// How long the word on the last turn stays up before the marker sweeps again.
const FLIP_HOLD = 0.35;
const MISS_HOLD = 0.6;

export function createCookingGame(side) {
  const el = document.createElement('div');
  el.className = `cooking ${side} hidden`;
  el.innerHTML =
    '<p class="cooking-title">Cooking by hand <span class="cooking-clock"></span></p>' +
    '<div class="cooking-progress"><span class="cooking-bar"></span></div>' +
    '<div class="cooking-track">' +
    '<span class="cooking-zone"></span>' +
    '<span class="cooking-marker"></span>' +
    '</div>' +
    '<p class="cooking-chances">' +
    '<span></span>'.repeat(MISS_LIMIT) +
    '</p>' +
    '<p class="cooking-hint"><b>RT</b> / LMB: flip &nbsp;·&nbsp; <b>B</b>: back to the fire</p>' +
    '<p class="cooking-result"></p>';
  document.getElementById('stage').appendChild(el);

  const zoneEl = el.querySelector('.cooking-zone');
  const markerEl = el.querySelector('.cooking-marker');
  const barEl = el.querySelector('.cooking-bar');
  const clockEl = el.querySelector('.cooking-clock');
  const chanceEls = [...el.querySelectorAll('.cooking-chances span')];
  const resultEl = el.querySelector('.cooking-result');

  let running = false;
  let marker = 0;
  let direction = 1;
  let zoneStart = 0.42;
  // These two climb and shrink with every clean turn, which is the difficulty ramp.
  let zoneWidth = ZONE_START;
  let sweep = SWEEP_START;
  let hold = 0;
  let flips = 0;
  let misses = 0;
  // The press that opened the game is still down on the first frame, so it is ignored
  // until it has been let go of — otherwise the game flips on its own instantly.
  let armed = false;

  function render() {
    markerEl.style.left = `${(marker * 100).toFixed(2)}%`;
  }

  function say(kind, message) {
    resultEl.textContent = message;
    resultEl.className = `cooking-result ${kind}`;
  }

  // The band moves for every turn, so no two are in the same place.
  function nextZone() {
    zoneStart = 0.18 + Math.random() * Math.max(0.05, 0.74 - zoneWidth);
    zoneEl.style.left = `${(zoneStart * 100).toFixed(2)}%`;
    zoneEl.style.width = `${(zoneWidth * 100).toFixed(2)}%`;
  }

  // The chances left are the dots above the hint: one is put out for each burnt edge.
  function renderChances() {
    for (let i = 0; i < chanceEls.length; i++) {
      chanceEls[i].classList.toggle('spent', i < misses);
    }
  }

  function close() {
    running = false;
    el.classList.add('hidden');
  }

  return {
    start() {
      running = true;
      marker = 0;
      direction = 1;
      hold = 0;
      flips = 0;
      misses = 0;
      sweep = SWEEP_START;
      zoneWidth = ZONE_START;
      armed = false;
      barEl.style.width = '0%';
      clockEl.textContent = '';
      nextZone();
      renderChances();
      resultEl.textContent = '';
      resultEl.className = 'cooking-result';
      render();
      el.classList.remove('hidden');
    },

    stop() {
      close();
    },

    // How much of the cook is behind the player, and how long the fish has left.
    setProgress(fraction, secondsLeft) {
      const pct = Math.max(0, Math.min(1, fraction));
      barEl.style.width = `${(pct * 100).toFixed(2)}%`;
      clockEl.textContent = `${Math.max(0, Math.ceil(secondsLeft))}s`;
    },

    // 'flip' on a clean turn, 'miss' on a burnt edge, 'burned' when a third burnt edge
    // ruins the fish, 'cancelled' when the player backs out. Only a cancelled or ruined
    // fish stops the game; a clean turn or a single burn leaves the next turn up.
    update(dt, controls) {
      if (!running) return null;

      // Backing out works at any moment, including during the beat after a flip.
      if (controls.cancelPressed) {
        close();
        return 'cancelled';
      }

      // The word on the last turn holds for a moment, then the sweep picks up again.
      if (hold > 0) {
        hold -= dt;
        return null;
      }

      marker += direction * sweep * dt;
      if (marker >= 1) {
        marker = 1;
        direction = -1;
      } else if (marker <= 0) {
        marker = 0;
        direction = 1;
      }
      render();

      if (!armed) {
        if (controls.rtPressed) return null;
        armed = true;
      }

      if (!controls.rtPressed) return null;

      const inside = marker >= zoneStart && marker <= zoneStart + zoneWidth;
      if (!inside) {
        misses += 1;
        renderChances();
        if (misses >= MISS_LIMIT) {
          say('burn', 'Burnt through — the fish is ruined');
          close();
          return 'burned';
        }
        say('miss', `Burnt edge — ${MISS_LIMIT - misses} left`);
        hold = MISS_HOLD;
        return 'miss';
      }

      // A clean turn turns the fish and makes the next turn harder.
      flips += 1;
      sweep = Math.min(SWEEP_MAX, sweep + SWEEP_STEP);
      zoneWidth = Math.max(ZONE_MIN, zoneWidth - ZONE_STEP);
      say('hit', flips === 1 ? 'Flipped' : `Flipped · ${flips}`);
      nextZone();
      hold = FLIP_HOLD;
      return 'flip';
    },

    get isOpen() {
      return running;
    },
    get markerAt() {
      return marker;
    },
    get zone() {
      return zoneStart;
    },
    get zoneWidth() {
      return zoneWidth;
    },
    get flipCount() {
      return flips;
    },
    get missCount() {
      return misses;
    },
    get sweepSpeed() {
      return sweep;
    },
  };
}
