// Hunger in the Minecraft shape: twenty hunger points drawn as ten drumsticks, a hidden
// saturation buffer that absorbs the drain, and a hidden exhaustion counter that is
// what actually spends it. Health is on the same twenty-point scale, so one health
// point here is one point off the heart bar.
const MAX_HUNGER = 20;
const MAX_SATURATION = 20;
const MAX_EXHAUSTION = 4;
const HEALTH_POINTS = 20;

const TICK = 0.5; // the whole system runs on this beat
const HEAL_TICKS = 8; // 8 * 0.5s = one heal every four seconds
const STARVE_TICKS = 8;
const HEAL_EXHAUSTION = 6;
const FULL_HUNGER = 20; // fast healing needs a completely full bar
const STANDARD_HUNGER = 18; // otherwise 18 or more heals slowly
const STEAKS = 10; // two hunger points each

// What activities cost, so hunger actually moves on its own.
export const EXHAUSTION = {
  // A point of hunger per eight metres at a sprint: sprinting everywhere should
  // cost real food, so a cooked fish (six hunger, six saturation) buys a trip,
  // not a lifestyle.
  sprintPerMetre: 0.5,
  swimPerMetre: 0.04,
  jump: 0.08,
  swing: 0.1,
};

export function createHungerMeter(side, { health }) {
  const el = document.createElement('div');
  el.className = `hunger ${side}`;

  const fills = Array.from({ length: STEAKS }, () => {
    const steak = document.createElement('span');
    steak.className = 'steak';
    const fill = document.createElement('span');
    fill.className = 'steak-fill';
    steak.appendChild(fill);
    el.appendChild(steak);
    return fill;
  });

  document.getElementById('stage').appendChild(el);

  let hunger = MAX_HUNGER;
  let saturation = MAX_SATURATION;
  let exhaustion = 0;
  let healTimer = 0;
  let starveTimer = 0;
  let clock = 0;

  // One point of the twenty-point health scale, in heart-bar points.
  const pointHp = () => health.maxHp / HEALTH_POINTS;
  const healthPoints = () => health.hp / pointHp();

  function render() {
    for (let i = 0; i < fills.length; i++) {
      const inSteak = Math.min(Math.max(hunger - i * 2, 0), 2);
      fills[i].style.width = `${(inSteak / 2) * 100}%`;
    }
  }

  // Saturation can never sit above hunger, so a hunger loss drags it down with it.
  function clampSaturation() {
    saturation = Math.min(Math.max(saturation, 0), hunger);
  }

  // Spend one point: the buffer first, then hunger itself.
  function spend() {
    if (saturation > 0) saturation -= 1;
    else if (hunger > 0) hunger -= 1;
    clampSaturation();
  }

  function tick() {
    // Ten seconds after the last damage, healing stays off — getting hurt shouldn't be
    // undone while it is still happening.
    const canRegenerate = health.hp < health.maxHp && !health.regenBlocked;
    if (canRegenerate) {
      if (hunger === FULL_HUNGER && saturation > 0) {
        // Fast healing: only while there is saturation to burn.
        health.heal(pointHp());
        healTimer = 0;
        // The cost goes back through the exhaustion counter, which is what spends
        // the saturation and eventually the hunger.
        addExhaustion(HEAL_EXHAUSTION);
      } else if (hunger >= STANDARD_HUNGER) {
        healTimer += 1;
        if (healTimer >= HEAL_TICKS) {
          healTimer = 0;
          health.heal(pointHp());
          addExhaustion(HEAL_EXHAUSTION);
        }
      } else {
        healTimer = 0;
      }
    } else {
      healTimer = 0;
    }

    if (hunger === 0) {
      // Starvation stops one point short, so it can never finish a player off.
      starveTimer += 1;
      if (starveTimer >= STARVE_TICKS) {
        starveTimer = 0;
        if (healthPoints() > 1) health.damage(pointHp());
      }
    } else {
      starveTimer = 0;
    }

    render();
  }

  function addExhaustion(amount) {
    if (!(amount > 0)) return;
    exhaustion = Math.min(exhaustion + amount, MAX_EXHAUSTION);
    while (exhaustion >= MAX_EXHAUSTION) {
      exhaustion -= MAX_EXHAUSTION;
      spend();
    }
    render();
  }

  // A meal: straight into the bar, with an equal amount of saturation behind it, so
  // eating does more than nudge the number up.
  function feed(points) {
    if (!(points > 0)) return;
    hunger = Math.min(hunger + points, MAX_HUNGER);
    saturation = Math.min(saturation + points, hunger);
    render();
  }

  function update(dt) {
    clock += dt;
    while (clock >= TICK) {
      clock -= TICK;
      tick();
    }
  }

  // Back where a save left the bars, with the tick timers cleared.
  function restore(state) {
    const points = (value, max) =>
      Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : max;
    hunger = points(state && state.hunger, MAX_HUNGER);
    saturation = points(state && state.saturation, MAX_SATURATION);
    exhaustion = points(state && state.exhaustion, MAX_EXHAUSTION);
    healTimer = 0;
    starveTimer = 0;
    clock = 0;
    clampSaturation();
    render();
  }

  // A respawn is a fresh start: no half-starved beach landing.
  function reset() {
    hunger = MAX_HUNGER;
    saturation = MAX_SATURATION;
    exhaustion = 0;
    healTimer = 0;
    starveTimer = 0;
    clock = 0;
    render();
  }

  render();

  return {
    update,
    addExhaustion,
    feed,
    reset,
    restore,
    get hunger() {
      return hunger;
    },
    // Nothing more will go down: hunger and saturation both clamp at their caps.
    get full() {
      return hunger >= MAX_HUNGER;
    },
    get saturation() {
      return saturation;
    },
    get exhaustion() {
      return exhaustion;
    },
  };
}
