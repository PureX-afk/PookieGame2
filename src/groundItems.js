// Things lying on the ground: sticks scattered across the island, plus anything a
// player drops. Look one through your crosshair and it is outlined with its name under
// the reticle; pressing pick puts it back in the hotbar.
import * as THREE from 'three';
import { heightAt, isWalkable, ISLAND_RADIUS } from './island.js';
import {
  ITEMS,
  createCampfire,
  createCookedFish,
  createBurnedFish,
  createFish,
  createFishSpit,
  createKindling,
  createFiber,
  createLog,
  createRock,
  createRuggedAxe,
  createSimpleTool,
  createStick,
} from './items.js';

const COUNT = 60;
// Small rocks scattered the same way, fewer than the sticks so fires still need wood.
const ROCK_COUNT = 40;
const REACH = 4.5;
// Wood-cutting tools can break a ground log down into sticks.
const WOOD_TOOLS = new Set(['simple_tool', 'rugged_axe']);
// A log yields this many sticks when broken down.
const LOG_STICKS = 5;
// How long a fish takes over a fire before it is cooked through.
const COOK_TIME = 45;
// Every clean flip takes this much of the whole cook off the clock — of the full 45
// seconds, not of whatever is left, so a turn is worth the same whenever it is taken.
const FLIP_SAVE = 0.15;
// How long a lit campfire burns on one bundle of fuel. Lighting starts the clock and
// each stick put to the fire resets it, so a fire is really a five-minute fuse that
// feeding keeps relighting.
export const FUEL_TIME = 300;
// How fast a fish rolls a half turn around the stick when a hand-cooking flip turns it.
const FLIP_SPEED = 14;
// A campfire is low and mostly gaps between stones, so looking near one counts as
// hovering over it: `HOVER_COS` is the widest angle off the view direction, and
// `HOVER_REACH` how far away it can still be and count.
const HOVER_COS = 0.9;
const HOVER_REACH = 4.2;
// How much room each kind of item needs around it when it is set down, so a campfire
// never lands inside another one or on top of the sticks.
const CLEARANCE = { campfire: 0.85, default: 0.28 };

// The ghost of a held item, shown where it would land: cool when the spot is clear,
// warm when something is already in the way.
const GHOST_MAT = new THREE.MeshBasicMaterial({
  color: 0xa8f0d0,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
});

const GHOST_BLOCKED_MAT = new THREE.MeshBasicMaterial({
  color: 0xff9a86,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
});
// Scatter only goes on dry land: above the waterline, below the crown.
const MIN_HEIGHT = 0.9;
const MAX_HEIGHT = 6.6;
// Drops are allowed a little closer to the water than the scatter is.
const DROP_MIN_HEIGHT = 0.35;
// How far the white shell sits outside the item, per side.
const OUTLINE_PAD = 0.02;

const UP = new THREE.Vector3(0, 1, 0);

const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.BackSide,
});

export function createGroundItems({ scene, blockedAt }) {
  const items = [];
  const meshes = [];
  // One placement ghost per player, kept between frames while the held item is the same.
  const previews = [];
  const raycaster = new THREE.Raycaster();
  const CENTRE = new THREE.Vector2(0, 0);
  const aimed = [null, null];
  const VIEW_DIR = new THREE.Vector3();
  const TO_ITEM = new THREE.Vector3();
  let time = 0;

  // A white back-faced shell around every piece of the item: the classic outline,
  // hidden until the crosshair finds it.
  function addOutline(group) {
    const outline = new THREE.Group();
    for (const child of group.children) {
      if (!child.isMesh) continue;
      const shell = new THREE.Mesh(child.geometry, OUTLINE_MAT);
      shell.position.copy(child.position);
      shell.rotation.copy(child.rotation);
      shell.scale.copy(child.scale).addScalar(OUTLINE_PAD * 2);
      outline.add(shell);
    }
    outline.visible = false;
    group.add(outline);
    return outline;
  }

  function makeMesh(id) {
    if (id === 'fish') return createFish();
    if (id === 'cooked_fish') return createCookedFish();
    if (id === 'burned_fish') return createBurnedFish();
    if (id === 'campfire') return createCampfire();
    if (id === 'kindling') return createKindling();
    if (id === 'rock') return createRock();
    if (id === 'log') return createLog();
    if (id === 'simple_tool') return createSimpleTool();
    if (id === 'fiber') return createFiber();
    if (id === 'rugged_axe') return createRuggedAxe();
    return createStick();
  }

  // The terrain height at a point, or null when it isn't somewhere an item can lie.
  // `blockedAt` is the world's other solid things (currently tree trunks), so litter
  // and placed structures keep clear of them instead of growing through bark.
  function dryHeight(x, z, minHeight) {
    const y = heightAt(x, z);
    if (!isWalkable(x, z) || y < minHeight || y > MAX_HEIGHT) return null;
    if (blockedAt && blockedAt(x, z)) return null;
    return y;
  }

  // Somewhere on the island for a scattered stick.
  function randomSpot() {
    for (let tries = 0; tries < 60; tries++) {
      const angle = Math.random() * Math.PI * 2;
      // sqrt keeps the scatter even across the disc instead of bunching at the centre.
      const radius = Math.sqrt(Math.random()) * ISLAND_RADIUS * 0.98;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = dryHeight(x, z, MIN_HEIGHT);
      if (y !== null) return { x, z, y };
    }
    return null;
  }

  // Somewhere near a requested point, for something dropped out of a hand.
  function nearbySpot(x, z) {
    for (let tries = 0; tries < 24; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = tries === 0 ? 0 : Math.random() * 2.2;
      const tx = x + Math.cos(angle) * radius;
      const tz = z + Math.sin(angle) * radius;
      const y = dryHeight(tx, tz, DROP_MIN_HEIGHT);
      if (y !== null) return { x: tx, z: tz, y };
    }
    return null;
  }

  function spawn(id, spot, exact = false, animate = false) {
    const mesh = makeMesh(id);
    // A stick model sits above its own origin; the fish is centred on it. A restored
    // item already carries its finished height, so it lands exactly as it was left.
    const lift = exact
      ? 0
      : id === 'fish' || id === 'cooked_fish' || id === 'burned_fish'
        ? 0.06
        : 0.02;
    const baseY = spot.y + lift;
    mesh.position.set(spot.x, baseY, spot.z);
    mesh.rotation.y = Math.random() * Math.PI;
    scene.add(mesh);

    // A campfire carries a hidden flame group and its light; everything else has none.
    const fire = mesh.getObjectByName('fire') || null;
    const record = {
      id,
      name: ITEMS[id] ? ITEMS[id].name : id,
      mesh,
      outline: addOutline(mesh),
      taken: false,
      fire,
      light: fire ? fire.children.find((child) => child.isPointLight) || null : null,
      lit: false,
      // Seconds left on the fire's current bundle. Meaningful only while lit; a fire
      // that has burned out can be lit again from the top with fresh kindling.
      fuel: 0,
      // A fish on a spit, while one is cooking: { group, raw, cooked, time }.
      cook: null,
      // A short landing animation for things dropped out of a falling tree.
      dropIn: null,
      seed: Math.random() * Math.PI * 2,
    };

    if (animate) {
      mesh.position.y = baseY + 0.38;
      mesh.scale.setScalar(0.35);
      record.dropIn = {
        time: 0,
        duration: 0.28 + Math.random() * 0.14,
        baseY,
        height: 0.3 + Math.random() * 0.2,
      };
    }

    mesh.userData.pickable = record;
    items.push(record);
    meshes.push(mesh);
    return record;
  }

  // Put a fish on a spit beside a fire, already `time` seconds into cooking. The foot
  // of the stick stands back by exactly the reach of its lean, so the fish always
  // hangs over the middle of the fire instead of off to one side of it.
  function stickFish(record, time = 0) {
    const spit = createFishSpit();
    spit.group.rotation.y = record.seed;
    // The foot stands back by the horizontal reach of the lean, turned with the spit,
    // which cancels out where the lean carries the fish and leaves it dead centre.
    const back = new THREE.Vector3(-spit.fishOffset.x, 0, -spit.fishOffset.z);
    back.applyAxisAngle(UP, record.seed);
    spit.group.position.copy(back);
    record.mesh.add(spit.group);
    record.cook = {
      group: spit.group,
      raw: spit.raw,
      cooked: spit.cooked,
      charred: spit.charred,
      // Set once the fish has been burnt through, and never cleared: it comes off the
      // spit as a burned fish.
      burned: false,
      time,
      // Where a flip wants the fish rolled to, and where it is now: a flip is a quick
      // half turn around the stick rather than a jump.
      turn: 0,
      roll: 0,
      // True while a player has this fish in the hand-cooking game, which runs the cook
      // clock at its own faster rate instead of the fire's.
      manual: false,
    };
    if (time >= COOK_TIME) finishCook(record);
    return record.cook;
  }

  // Move the cook clock by hand, positive or negative, never past the ends of the
  // cook. Returns true when that took the fish all the way off the fire.
  function advanceCook(record, seconds) {
    const cook = record && record.cook;
    if (!cook || cook.burned || !seconds) return false;
    const done = cook.time >= COOK_TIME;
    cook.time = Math.max(0, Math.min(COOK_TIME, cook.time + seconds));
    if (cook.time >= COOK_TIME && !done) {
      finishCook(record);
      return true;
    }
    return false;
  }

  // Off the heat: the browned fish takes the raw one's place on the stick.
  function finishCook(record) {
    const cook = record.cook;
    if (!cook || cook.burned) return;
    cook.time = COOK_TIME;
    cook.raw.visible = false;
    cook.cooked.visible = true;
  }

  // Too many burnt edges and there is no saving it: the charred fish takes the place of
  // both other stages, and from then on it only picks up as a burned fish.
  function burnCook(record) {
    const cook = record && record.cook;
    if (!cook || cook.burned) return;
    cook.burned = true;
    cook.time = COOK_TIME;
    cook.raw.visible = false;
    cook.cooked.visible = false;
    cook.charred.visible = true;
  }

  for (let i = 0; i < COUNT; i++) {
    const spot = randomSpot();
    if (spot) spawn('stick', spot);
  }

  for (let i = 0; i < ROCK_COUNT; i++) {
    const spot = randomSpot();
    if (spot) spawn('rock', spot);
  }

  // The campfire closest to the middle of this camera's view, if one is near enough
  // to count as hovered. Null when the view has moved off every fire.
  function hoveredFire(camera) {
    camera.getWorldDirection(VIEW_DIR);
    let best = null;
    let bestDot = HOVER_COS;

    for (const record of items) {
      if (record.taken || !record.fire) continue;
      // Aim at the middle of the fire, not at the ground it sits on.
      TO_ITEM.copy(record.mesh.position);
      TO_ITEM.y += 0.25;
      TO_ITEM.sub(camera.position);
      const distance = TO_ITEM.length();
      if (distance < 0.001 || distance > HOVER_REACH) continue;
      const dot = TO_ITEM.divideScalar(distance).dot(VIEW_DIR);
      if (dot > bestDot) {
        bestDot = dot;
        best = record;
      }
    }

    return best;
  }

  return {
    // What each camera is looking at right now, and the outline that goes with it.
    aim(cameras) {
      const names = [null, null];
      const hits = [null, null];
      const dist = [null, null];

      for (let i = 0; i < 2; i++) {
        const camera = cameras[i];
        if (!camera) continue;
        raycaster.setFromCamera(CENTRE, camera);
        raycaster.far = REACH;
        const found = raycaster.intersectObjects(meshes, true);
        // Take the closest hit that is still lying there. A picked-up item's mesh is
        // hidden but still in the world, and raycasting ignores visibility, so the
        // first thing the ray meets is not necessarily something a player can pick up.
        for (const hit of found) {
          let node = hit.object;
          while (node && !node.userData.pickable) node = node.parent;
          const record = node ? node.userData.pickable : null;
          if (!record || record.taken) continue;
          hits[i] = record;
          dist[i] = hit.distance;
          break;
        }
        // Looking just past a fire still counts: the stones are small and easy to
        // miss, and a fire is the one thing you want to interact with by hovering.
        if (!hits[i]) {
          hits[i] = hoveredFire(camera);
          if (hits[i]) dist[i] = camera.position.distanceTo(hits[i].mesh.position);
        }
      }

      for (const record of items) {
        if (record.taken) continue;
        record.outline.visible = record === hits[0] || record === hits[1];
      }

      aimed[0] = hits[0];
      aimed[1] = hits[1];

      // A fire with something on it says what, and whether it is done. A burning one
      // also says how long the current bundle has left.
      for (let i = 0; i < 2; i++) {
        const record = hits[i];
        if (!record) continue;
        const cook = record.cook;
        names[i] = cook
          ? cook.burned
            ? ITEMS.burned_fish.name
            : cook.time >= COOK_TIME
              ? ITEMS.cooked_fish.name
              : `${ITEMS.fish.name} · cooking`
          : record.name;
        if (record.lit) {
          const left = Math.max(0, Math.ceil(record.fuel));
          names[i] = `${names[i]} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        }
      }

      return { names, dist };
    },

    // Drop one camera's reading, for when a tree in front won the crosshair. The next
    // `aim` puts it back.
    clearAim(index) {
      aimed[index] = null;
      for (const record of items) {
        if (record.taken) continue;
        record.outline.visible = record === aimed[0] || record === aimed[1];
      }
    },

    // Take whatever player `index` is aiming at. False when there's nothing there or
    // no room in the bag.
    pick(index, inventory) {
      const record = aimed[index];
      if (!record || record.taken) return false;
      // A finished fish comes off the spit, burnt or not. One still over live coals is
      // still cooking and stays put — but one left on a fire that has gone out comes
      // back raw rather than being stuck on cold stones forever.
      if (record.cook) {
        const done = record.cook.time >= COOK_TIME;
        if (!done && record.lit) return false;
        const take = record.cook.burned ? 'burned_fish' : done ? 'cooked_fish' : 'fish';
        if (!inventory.add(take)) return false;
        record.mesh.remove(record.cook.group);
        record.cook = null;
        aimed[index] = null;
        return true;
      }
      if (!inventory.add(record.id)) return false;
      record.taken = true;
      record.mesh.visible = false;
      record.outline.visible = false;
      // It is nothing the crosshair should find any more, so it leaves the raycast
      // list the same way a broken log does.
      const at = meshes.indexOf(record.mesh);
      if (at >= 0) meshes.splice(at, 1);
      aimed[index] = null;
      return true;
    },

    // A log player `index` is aiming at, with a wood-cutting tool in hand to break it
    // down. Picking the log up is still X; this is the RT action.
    logTarget(index, inventory) {
      const record = aimed[index];
      if (!record || record.taken || record.id !== 'log') return null;
      return inventory.item && WOOD_TOOLS.has(inventory.item.id) ? record : null;
    },

    // Break a log down into a pile of sticks. One swing is enough: the log is spent and
    // five sticks fall around where it lay.
    breakLog(record) {
      if (!record || record.taken || record.id !== 'log') return false;
      record.taken = true;
      record.mesh.visible = false;
      record.outline.visible = false;
      const at = meshes.indexOf(record.mesh);
      if (at >= 0) meshes.splice(at, 1);
      for (let i = 0; i < 2; i++) {
        if (aimed[i] === record) aimed[i] = null;
      }
      for (let i = 0; i < LOG_STICKS; i++) {
        const spot = nearbySpot(record.mesh.position.x, record.mesh.position.z);
        if (spot) spawn('stick', spot);
      }
      return true;
    },

    // Put an item on the ground near a point. False when there's nowhere dry.
    drop(id, x, z, animate = false) {
      const spot = nearbySpot(x, z);
      if (!spot) return false;
      return spawn(id, spot, false, animate);
    },

    // Can something go down here? Dry, walkable ground, clear of everything already
    // lying about. The clearance grows with the item, so fires keep their distance.
    canPlace(id, x, z) {
      if (dryHeight(x, z, DROP_MIN_HEIGHT) === null) return false;
      const own = CLEARANCE[id] ?? CLEARANCE.default;
      for (const record of items) {
        if (record.taken) continue;
        const gap = own + (CLEARANCE[record.id] ?? CLEARANCE.default);
        const dx = record.mesh.position.x - x;
        const dz = record.mesh.position.z - z;
        if (dx * dx + dz * dz < gap * gap) return false;
      }
      return true;
    },

    // Set an item down on an exact spot, rather than somewhere near a point.
    place(id, x, z, yaw = 0) {
      // The same clearance rule a drop follows: nothing is set down on top of something
      // else, however it got here — including a fish landed by a player with a full bag.
      if (!this.canPlace(id, x, z)) return false;
      const y = dryHeight(x, z, DROP_MIN_HEIGHT);
      if (y === null) return false;
      const record = spawn(id, { x, z, y });
      if (record) record.mesh.rotation.y = yaw;
      return record;
    },

    // The translucent copy of what player `index` is holding, standing where it would
    // land. A null id hides it; the mesh is rebuilt only when the item changes.
    setPreview(index, id, x, z, yaw, ok) {
      const current = previews[index];
      if (!id) {
        if (current) current.mesh.visible = false;
        return;
      }

      let preview = current;
      if (!preview || preview.id !== id) {
        if (preview) scene.remove(preview.mesh);
        const mesh = makeMesh(id);
        const material = ok ? GHOST_MAT : GHOST_BLOCKED_MAT;
        mesh.traverse((object) => {
          if (!object.isMesh) return;
          object.material = material;
          object.castShadow = false;
          object.receiveShadow = false;
        });
        scene.add(mesh);
        preview = { id, mesh, ok };
        previews[index] = preview;
      }

      if (preview.ok !== ok) {
        preview.ok = ok;
        const material = ok ? GHOST_MAT : GHOST_BLOCKED_MAT;
        preview.mesh.traverse((object) => {
          if (object.isMesh) object.material = material;
        });
      }

      preview.mesh.visible = true;
      preview.mesh.position.set(x, heightAt(x, z) + 0.02, z);
      preview.mesh.rotation.y = yaw;
    },

    // The cold campfire player `index` is looking at, whatever is in hand.
    coldFire(index) {
      const record = aimed[index];
      return record && !record.taken && record.fire && !record.lit ? record : null;
    },

    // The cold campfire player `index` is looking at, provided they have kindling in
    // hand to put to it. Null when there is nothing worth lighting. The bundle has to
    // be the held item: lighting is something done with the kindling, not from the bag.
    lightTarget(index, inventory) {
      const record = aimed[index];
      if (!record || record.taken || !record.fire || record.lit) return null;
      return inventory.item && inventory.item.id === 'kindling' ? record : null;
    },

    // The fire takes: the flames come up, the light starts to breathe, and the first
    // bundle begins to burn down.
    light(record) {
      if (!record || record.taken || record.lit) return false;
      record.lit = true;
      record.fuel = FUEL_TIME;
      record.fire.visible = true;
      return true;
    },

    // The lit campfire player `index` is aiming at, provided they have a fish in hand
    // and nothing is already on the spit.
    cookTarget(index, inventory) {
      const record = aimed[index];
      if (!record || record.taken || !record.fire || !record.lit || record.cook) return null;
      return inventory.item && inventory.item.id === 'fish' ? record : null;
    },

    // The burning campfire player `index` is aiming at, with a stick in hand to feed
    // it. A cold fire takes kindling instead, so sticks are only for keeping one alive.
    stokeTarget(index, inventory) {
      const record = aimed[index];
      if (!record || record.taken || !record.fire || !record.lit) return null;
      return inventory.item && inventory.item.id === 'stick' ? record : null;
    },

    // A stick goes on: the five minutes start again from the top. It is one stick per
    // press, straight out of the bag.
    stoke(record, inventory) {
      if (!record || record.taken || !record.lit) return false;
      if (!inventory.take('stick', 1)) return false;
      record.fuel = FUEL_TIME;
      return true;
    },

    // The fire a player is looking at with a fish partway through cooking: the one that
    // can be cooked by hand. Quiet once the fish is done, so it can't be picked up again.
    cookGameTarget(index) {
      const record = aimed[index];
      // A fire that has burned out is only cold stones: the fish left on the spit is
      // not taken in hand over dead coals.
      if (!record || record.taken || !record.cook || !record.lit) return null;
      return record.cook.time < COOK_TIME ? record : null;
    },

    advanceCook,
    burnCook,

    // Turn the fish over on the spit, and take a flat share of the whole cook off the
    // clock while it rolls — however much of the cook is already behind it. Returns true
    // when the flip finished it.
    flipFish(record, seconds = COOK_TIME * FLIP_SAVE) {
      const cook = record && record.cook;
      if (!cook || cook.burned) return false;
      cook.turn += Math.PI;
      return advanceCook(record, seconds);
    },

    // The length of a full cook, so the caller can tell when the fish is off the clock.
    get cookTime() {
      return COOK_TIME;
    },

    // Skewer one fish and start the clock.
    cook(record, inventory) {
      if (!record || record.taken || !record.lit || record.cook) return false;
      if (!inventory.take('fish', 1)) return false;
      stickFish(record);
      return true;
    },

    // Lit fires breathe a little: the flames and their light share one flicker.
    update(dt) {
      time += dt;
      for (const record of items) {
        if (record.taken) continue;
        if (record.dropIn) {
          const drop = record.dropIn;
          drop.time += dt;
          const k = Math.min(drop.time / drop.duration, 1);
          const eased = 1 - (1 - k) ** 3;
          record.mesh.scale.setScalar(0.35 + 0.65 * eased);
          record.mesh.position.y = drop.baseY + (1 - eased) * drop.height;
          if (k >= 1) {
            record.mesh.scale.setScalar(1);
            record.mesh.position.y = drop.baseY;
            record.dropIn = null;
          }
        }
        // The spit stays where it was planted; only the clock runs, and the fish
        // browns when it is done. A fish someone is cooking by hand runs on their
        // clock instead, so the fire leaves it alone here.
        if (record.cook) {
          const cook = record.cook;
          if (cook.roll !== cook.turn) {
            const step = FLIP_SPEED * dt;
            cook.roll =
              Math.abs(cook.turn - cook.roll) <= step
                ? cook.turn
                : cook.roll + Math.sign(cook.turn - cook.roll) * step;
            cook.raw.rotation.z = cook.roll;
            cook.cooked.rotation.z = cook.roll;
          }
          if (cook.time < COOK_TIME && !cook.manual && record.lit) {
            cook.time += dt;
            if (cook.time >= COOK_TIME) finishCook(record);
          }
        }
        if (!record.lit) continue;
        // The current bundle burns down in real time. Nothing feeds the fire here — a
        // stick put to it resets the clock — and when it runs out the fire goes dark,
        // leaving cold stones that take kindling again to bring back.
        record.fuel -= dt;
        if (record.fuel <= 0) {
          record.lit = false;
          record.fuel = 0;
          record.fire.visible = false;
          continue;
        }
        const flicker =
          0.85 +
          Math.sin(time * 8.5 + record.seed) * 0.1 +
          Math.sin(time * 21 + record.seed * 3) * 0.05;
        record.fire.scale.setScalar(flicker);
        if (record.light) record.light.intensity = 2.6 * flicker;
      }
    },

    // Everything still lying about, for a save file.
    toJSON() {
      return items
        .filter((record) => !record.taken)
        .map((record) => ({
          id: record.id,
          x: record.mesh.position.x,
          // A log still landing is saved at its resting height, not mid-bob.
          y: record.dropIn ? record.dropIn.baseY : record.mesh.position.y,
          z: record.mesh.position.z,
          rotation: record.mesh.rotation.y,
          lit: record.lit,
          // Seconds left on the burning bundle, so a saved fire resumes its countdown.
          fuel: record.fuel,
          // Seconds on the spit, so a fish half cooked is still half cooked on load.
          cook: record.cook ? record.cook.time : null,
          burned: record.cook ? record.cook.burned : false,
        }));
    },

    // Rebuild the ground from a save: whatever was lying about live is dropped first,
    // so loading twice in one session can't stack two islands' worth of sticks.
    fromJSON(list) {
      for (const record of items) scene.remove(record.mesh);
      items.length = 0;
      meshes.length = 0;
      aimed[0] = null;
      aimed[1] = null;
      if (!Array.isArray(list)) return;

      for (const entry of list) {
        const record = spawn(entry.id, { x: entry.x, y: entry.y, z: entry.z }, true);
        if (!record) continue;
        record.mesh.rotation.y = entry.rotation || 0;
        if (entry.lit && record.fire) {
          record.lit = true;
          record.fire.visible = true;
          // A finite stored bundle resumes where it left off; a fire saved lit without
          // one starts a fresh bundle rather than going dark on the first frame.
          record.fuel = Number.isFinite(entry.fuel) ? Math.max(0, entry.fuel) : FUEL_TIME;
        }
        if (Number.isFinite(entry.cook)) {
          stickFish(record, entry.cook);
          if (entry.burned) burnCook(record);
        }
      }
    },

    get remaining() {
      return items.filter((item) => !item.taken).length;
    },
  };
}
