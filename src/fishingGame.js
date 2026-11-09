// The catching minigame. A vertical gauge with three things in it: the green bar you
// fly like a balloon (hold to rise, release to sink), the fish, which picks a new
// depth every few seconds and swims at it, and a meter that fills while the bar covers
// the fish and drains fast when it doesn't.
const LIFT = 3.4;
const GRAVITY = 4.2;
const DAMPING = 1.8;
const MAX_SPEED = 1.1;
const BAR_HEIGHT = 0.2;
const FISH_HEIGHT = 0.08;
const GAIN = 0.34;
const LOSS = 0.5;

// Fish difficulty: top swimming speed, how quickly it picks up and sheds that speed
// (`smooth`), how often it changes its mind, and how much it wobbles. Only one fish
// exists yet, so everything uses `normal`.
export const FISH_SKILL = {
  easy: { speed: 0.35, smooth: 2.6, retarget: [1.1, 2.4], jitter: 0.4 },
  normal: { speed: 0.55, smooth: 4, retarget: [0.8, 1.7], jitter: 1.2 },
  hard: { speed: 0.8, smooth: 7, retarget: [0.5, 1.1], jitter: 3 },
};

export function createFishingGame(side) {
  const el = document.createElement('div');
  el.className = `catch-game ${side} hidden`;
  el.innerHTML =
    '<div class="gauge">' +
    '<div class="gauge-water">' +
    '<div class="gauge-bar"></div>' +
    '<div class="catch-fish"></div>' +
    '</div>' +
    '</div>' +
    '<div class="progress"><div class="progress-fill"></div></div>';
  document.getElementById('stage').appendChild(el);

  const barEl = el.querySelector('.gauge-bar');
  const fishEl = el.querySelector('.catch-fish');
  const progressEl = el.querySelector('.progress-fill');

  let running = false;
  let barY = 0.5;
  let barVel = 0;
  let fishY = 0.6;
  let fishVel = 0;
  let fishTarget = 0.6;
  let fishTimer = 0.6;
  let progress = 0.35;
  let skill = FISH_SKILL.normal;
  let time = 0;

  function render() {
    // The gauge runs bottom-up, DOM positions run top-down. barY is the bar's centre,
    // so the offset by half its height keeps the whole bar inside the gauge at the
    // top and bottom limits.
    barEl.style.top = `${(1 - barY) * 100 - (BAR_HEIGHT * 100) / 2}%`;
    barEl.style.height = `${BAR_HEIGHT * 100}%`;
    fishEl.style.top = `${(1 - fishY) * 100}%`;
    progressEl.style.height = `${(progress * 100).toFixed(1)}%`;
    progressEl.classList.toggle('low', progress < 0.35);
  }

  function retarget() {
    fishTarget = 0.08 + Math.random() * 0.84;
    fishTimer =
      skill.retarget[0] + Math.random() * (skill.retarget[1] - skill.retarget[0]);
  }

  return {
    start(difficulty = 'normal') {
      skill = FISH_SKILL[difficulty] ?? FISH_SKILL.normal;
      running = true;
      time = 0;
      barY = 0.5;
      barVel = 0;
      fishY = 0.6;
      fishVel = 0;
      fishTarget = 0.6;
      fishTimer = 0.6;
      progress = 0.35;
      el.classList.remove('hidden', 'on-target');
      render();
    },

    stop() {
      running = false;
      el.classList.add('hidden');
    },

    // 'caught', 'escaped', or null while the fight is still on.
    update(dt, held) {
      if (!running) return null;
      time += dt;

      // The bar is a balloon: holding lifts it, letting go drops it.
      barVel += (held ? LIFT : -GRAVITY) * dt;
      barVel *= Math.exp(-DAMPING * dt);
      barVel = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, barVel));
      barY += barVel * dt;
      const half = BAR_HEIGHT / 2;
      if (barY < half) {
        barY = half;
        const impact = -barVel;
        // Letting the bar drop onto the floor gives it a kick back up. The harder it
        // lands, the livelier the rebound; holding the lift keeps it pinned instead.
        if (!held && impact > 0.05) {
          const restitution = Math.min(0.72, 0.2 + impact * 0.5);
          barVel = impact * restitution;
        } else {
          barVel = 0;
        }
      } else if (barY > 1 - half) {
        barY = 1 - half;
        barVel = 0;
      }

      // The fish heads for a new depth every few seconds. It swims rather than jumps:
      // its velocity eases toward a speed in proportion to the remaining distance, so
      // it accelerates out of a turn and settles on the new depth instead of snapping
      // to full speed and stopping dead.
      fishTimer -= dt;
      if (fishTimer <= 0) retarget();
      const wanted = Math.max(
        -skill.speed,
        Math.min(skill.speed, (fishTarget - fishY) * 3)
      );
      fishVel += (wanted - fishVel) * (1 - Math.exp(-skill.smooth * dt));
      fishY += fishVel * dt;
      fishY += Math.sin(time * 7) * 0.01 * skill.jitter * dt;
      if (fishY < 0.05) {
        fishY = 0.05;
        fishVel = 0;
      } else if (fishY > 0.95) {
        fishY = 0.95;
        fishVel = 0;
      }

      const covering = Math.abs(fishY - barY) < half + FISH_HEIGHT / 2;
      el.classList.toggle('on-target', covering);
      progress += (covering ? GAIN : -LOSS) * dt;
      render();

      if (progress >= 1) {
        // Stay at full progress: the fishing module keeps the finished gauge on
        // screen through the catch celebration, then stop() hides it.
        running = false;
        return 'caught';
      }
      if (progress <= 0) {
        running = false;
        el.classList.add('hidden');
        return 'escaped';
      }
      return null;
    },

    get isOpen() {
      return running;
    },
  };
}
