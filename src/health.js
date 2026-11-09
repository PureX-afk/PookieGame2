// Health on a twenty-point scale: ten hearts of two points each, matching the hunger
// bar. Each heart is drawn half-full at one point, which is how the original reads.
// Taking any damage holds regeneration off for ten seconds, so a beating cannot be
// healed away while it is still happening.
const MAX_POINTS = 20;
const MAX_HEARTS = 10;
export const POINTS_PER_HEART = MAX_POINTS / MAX_HEARTS;
export const REGEN_DELAY = 10;

export function createHealthBar(side) {
  const el = document.createElement('div');
  el.className = `hp ${side}`;

  const fills = Array.from({ length: MAX_HEARTS }, () => {
    const heart = document.createElement('span');
    heart.className = 'heart';
    const fill = document.createElement('span');
    fill.className = 'heart-fill';
    heart.appendChild(fill);
    el.appendChild(heart);
    return fill;
  });

  document.getElementById('stage').appendChild(el);

  let hp = MAX_POINTS;
  let lastDamage = -Infinity;

  function render() {
    for (let i = 0; i < fills.length; i++) {
      const inHeart = Math.min(Math.max(hp - i * POINTS_PER_HEART, 0), POINTS_PER_HEART);
      fills[i].style.width = `${(inHeart / POINTS_PER_HEART) * 100}%`;
    }
  }

  function setHp(value) {
    hp = Math.min(Math.max(value, 0), MAX_POINTS);
    render();
  }

  render();

  return {
    damage(points) {
      if (!(points > 0)) return;
      lastDamage = performance.now();
      setHp(hp - points);
    },
    heal(points) {
      if (points > 0) setHp(hp + points);
    },
    setHp,
    get hp() {
      return hp;
    },
    get maxHp() {
      return MAX_POINTS;
    },
    get dead() {
      return hp <= 0;
    },
    // True for ten seconds after the last damage, during which hunger can't heal.
    get regenBlocked() {
      return performance.now() - lastDamage < REGEN_DELAY * 1000;
    },
  };
}
