// Crafting menu: the recipes one player can make out of what is in their own bag.
// D-pad steps the list, A crafts, Y closes. Each player gets their own panel on their
// own half of the screen, and only their own inventory is spent.
import { ITEMS } from './items.js';

const RECIPES = [
  {
    id: 'campfire',
    cost: { stick: 3 },
    note: 'Place it with B, then put kindling to it to light it. Feed it sticks with RT — each one buys five minutes of flame.',
  },
  {
    id: 'kindling',
    cost: { stick: 2 },
    note: 'Aim at a campfire within reach and hit RT to light it.',
  },
  {
    id: 'simple_tool',
    cost: { rock: 1 },
    note: 'A stone flake lashed to a handle. Hold it and swing with RT: a tree falls in thirty-five hits and a bush gives way in five. A bare fist can chop trees but not bushes.',
  },
  {
    id: 'rugged_axe',
    cost: { rock: 2, stick: 1, fiber: 1 },
    note: 'A stone head bound to a long haft. Ten swings fell a tree; one clears a bush.',
  },
];

export function createCraftingMenu({ side, inventory, onCraft }) {
  const el = document.createElement('div');
  el.className = `crafting ${side} hidden`;
  el.innerHTML =
    '<h2>Crafting</h2>' +
    RECIPES.map(
      (recipe, index) =>
        `<div class="row recipe" data-row="${index}">` +
        `<span class="label">${ITEMS[recipe.id] ? ITEMS[recipe.id].name : recipe.id}</span>` +
        '<span class="cost"></span></div>'
    ).join('') +
    '<p class="note"></p>' +
    '<p class="foot">D-pad: recipe &nbsp;·&nbsp; A: craft &nbsp;·&nbsp; Y: close</p>';
  document.getElementById('stage').appendChild(el);

  const rowEls = [...el.querySelectorAll('.recipe')];
  const noteEl = el.querySelector('.note');

  let focus = 0;
  let open = false;
  // Skip the DOM writes while nothing on screen actually differs.
  let signature = null;

  function canCraft(recipe) {
    return Object.entries(recipe.cost).every(([id, count]) => inventory.countOf(id) >= count);
  }

  function render() {
    const states = RECIPES.map((recipe) => (canCraft(recipe) ? '1' : '0')).join('');
    const next = `${open}|${focus}|${states}`;
    if (next === signature) return;
    signature = next;

    rowEls.forEach((row, index) => {
      const recipe = RECIPES[index];
      const isCraftable = canCraft(recipe);
      row.classList.toggle('focused', index === focus);
      row.classList.toggle('craftable', isCraftable);
      row.classList.toggle('missing', !isCraftable);
      row.querySelector('.cost').textContent = Object.entries(recipe.cost)
        .map(([id, count]) => `${ITEMS[id] ? ITEMS[id].name : id} ${inventory.countOf(id)}/${count}`)
        .join(' · ');
    });
    noteEl.textContent = RECIPES[focus].note;
  }

  function setOpen(value) {
    open = value;
    el.classList.toggle('hidden', !value);
    if (value) {
      signature = null;
      render();
    }
  }

  // Spend the ingredients and put the result in the bag. A full bag gives the
  // ingredients straight back instead of eating them.
  function craft() {
    const recipe = RECIPES[focus];
    if (!recipe || !canCraft(recipe)) return false;

    for (const [id, count] of Object.entries(recipe.cost)) inventory.take(id, count);
    if (!inventory.add(recipe.id)) {
      for (const [id, count] of Object.entries(recipe.cost)) {
        for (let i = 0; i < count; i++) inventory.add(id);
      }
      return false;
    }

    signature = null;
    render();
    if (onCraft) onCraft();
    return true;
  }

  render();

  return {
    toggle() {
      setOpen(!open);
    },
    setOpen,
    moveFocus(dir) {
      focus = (focus + dir + RECIPES.length) % RECIPES.length;
      render();
    },
    craft,
    refresh: render,
    get isOpen() {
      return open;
    },
  };
}
