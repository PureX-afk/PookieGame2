// Ten hotbar slots per player, holding stacks. An empty slot means the bare hand.
// Stackable items (sticks, fish) top up an existing stack before taking a new slot and
// cap at what the item allows; unique items like the rod own their slot alone. LB and
// RB step between slots and wrap at both ends.
import { ITEMS } from './items.js';

export const SLOT_COUNT = 10;

// What each player starts carrying, in slot order: rod and fish to live on, a
// campfire and kindling so the first fire is a lesson in lighting, not crafting,
// and fiber for whatever gets lashed together next.
const STARTING_ITEMS = ['fishing_rod', 'fish', 'campfire', 'kindling', 'fiber', 'rugged_axe'];

export function createInventory(side) {
  const el = document.createElement('div');
  el.className = `inv ${side}`;

  // One entry per slot: { id, count } or null.
  const stacks = Array.from({ length: SLOT_COUNT }, () => null);
  const slots = [];

  function makeIcon(id) {
    const icon = document.createElement('span');
    icon.className = `slot-icon ${id}`;
    return icon;
  }

  for (let index = 0; index < SLOT_COUNT; index++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.slot = String(index);
    const count = document.createElement('span');
    count.className = 'slot-count';
    slot.appendChild(count);
    el.appendChild(slot);
    slots.push({ el: slot, count, dura: null });
  }

  document.getElementById('stage').appendChild(el);

  let selected = 0;

  // A fresh stack of one item, wearing out if the item carries a durability.
  function makeStack(id) {
    const item = ITEMS[id];
    const durability = item && item.durability != null ? item.durability : null;
    return { id, count: 1, durability, maxDurability: durability };
  }

  // Redraw one slot: the icon changes with the item, the badge with the count, and a
  // thin bar along the bottom for anything that wears out.
  function draw(index) {
    const slot = slots[index];
    const stack = stacks[index];
    const old = slot.el.querySelector('.slot-icon');
    if (old) old.remove();
    if (stack) {
      slot.el.insertBefore(makeIcon(stack.id), slot.count);
      slot.count.textContent = stack.count > 1 ? String(stack.count) : '';
    } else {
      slot.count.textContent = '';
    }

    if (stack && stack.durability != null) {
      if (!slot.dura) {
        slot.dura = document.createElement('span');
        slot.dura.className = 'slot-durability';
        slot.dura.innerHTML = '<span class="slot-durability-fill"></span>';
        slot.el.appendChild(slot.dura);
      }
      const fraction = Math.max(0, stack.durability / stack.maxDurability);
      const fill = slot.dura.firstChild;
      fill.style.width = `${(fraction * 100).toFixed(1)}%`;
      fill.classList.toggle('low', fraction <= 0.25);
    } else if (slot.dura) {
      slot.dura.remove();
      slot.dura = null;
    }
  }

  // How many of an item the bag is holding, across every slot.
  function totalOf(id) {
    let total = 0;
    for (const stack of stacks) if (stack && stack.id === id) total += stack.count;
    return total;
  }

  function render() {
    for (let i = 0; i < SLOT_COUNT; i++) {
      slots[i].el.classList.toggle('selected', i === selected);
    }
  }

  STARTING_ITEMS.forEach((id, index) => {
    if (index < SLOT_COUNT) stacks[index] = makeStack(id);
  });
  for (let i = 0; i < SLOT_COUNT; i++) draw(i);
  render();

  return {
    next() {
      selected = (selected + 1) % SLOT_COUNT;
      render();
    },
    prev() {
      selected = (selected + SLOT_COUNT - 1) % SLOT_COUNT;
      render();
    },
    // Jump straight to a slot, for a save put away with a different one showing.
    // Anything out of range falls back to the first slot.
    select(index) {
      const at = Math.trunc(Number(index));
      selected = Number.isFinite(at) ? Math.min(Math.max(at, 0), SLOT_COUNT - 1) : 0;
      render();
    },
    // Put an item away. Returns false when there is nowhere for it to go.
    add(id) {
      const limit = ITEMS[id] ? ITEMS[id].stack ?? 1 : 1;

      // Stackable items top up an existing stack first.
      if (limit > 1) {
        for (let i = 0; i < SLOT_COUNT; i++) {
          const stack = stacks[i];
          if (stack && stack.id === id && stack.count < limit) {
            stack.count += 1;
            draw(i);
            return true;
          }
        }
      }

      const free = stacks.indexOf(null);
      if (free < 0) return false;
      stacks[free] = makeStack(id);
      draw(free);
      return true;
    },
    // Spend a use of a tool. The item goes away only when the wear runs out; returns
    // true when it broke.
    wear(id, amount = 1) {
      for (let i = 0; i < SLOT_COUNT; i++) {
        const stack = stacks[i];
        if (!stack || stack.id !== id || stack.durability == null) continue;
        stack.durability -= amount;
        if (stack.durability <= 0) {
          stacks[i] = null;
          draw(i);
          return true;
        }
        draw(i);
        return false;
      }
      return false;
    },
    // Take one of the selected item back out. False when the slot is already empty.
    removeSelected() {
      const stack = stacks[selected];
      if (!stack) return false;
      stack.count -= 1;
      if (stack.count <= 0) stacks[selected] = null;
      draw(selected);
      return true;
    },
    countOf(id) {
      return totalOf(id);
    },
    // Take `amount` of an item out, across slots. Nothing is removed when the bag
    // doesn't hold enough, so a failed craft can't half-eat the ingredients.
    take(id, amount) {
      if (totalOf(id) < amount) return false;
      let left = amount;
      for (let i = 0; i < SLOT_COUNT && left > 0; i++) {
        const stack = stacks[i];
        if (!stack || stack.id !== id) continue;
        const used = Math.min(stack.count, left);
        stack.count -= used;
        left -= used;
        if (stack.count <= 0) stacks[i] = null;
        draw(i);
      }
      return true;
    },
    // The bag and everything in it, for a save file.
    toJSON() {
      return stacks.map((stack) =>
        stack
          ? { id: stack.id, count: stack.count, durability: stack.durability }
          : null
      );
    },
    // Put a saved bag back, slot for slot. Anything unrecognised empties that slot.
    fromJSON(list) {
      if (!Array.isArray(list)) return;
      for (let i = 0; i < SLOT_COUNT; i++) {
        const entry = list[i];
        const item = entry && ITEMS[entry.id];
        if (!item) {
          stacks[i] = null;
        } else {
          const fresh = makeStack(entry.id);
          // The game only ever writes sensible stacks, but a hand-edited or damaged
          // save shouldn't be able to conjure a hundred logs or a bar past full.
          const limit = item.stack ?? 1;
          const count = Number.isFinite(entry.count) ? Math.floor(entry.count) : 1;
          fresh.count = Math.min(Math.max(1, count), limit);
          if (fresh.durability != null && Number.isFinite(entry.durability)) {
            fresh.durability = Math.min(Math.max(0, entry.durability), fresh.maxDurability);
          }
          stacks[i] = fresh;
        }
        draw(i);
      }
      render();
    },
    get selected() {
      return selected;
    },
    get item() {
      const stack = stacks[selected];
      return stack ? ITEMS[stack.id] : null;
    },
    get count() {
      const stack = stacks[selected];
      return stack ? stack.count : 0;
    },
  };
}
