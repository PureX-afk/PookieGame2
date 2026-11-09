// Items the hotbar can hold. The fishing rod only exists as a model for now: no
// crafting, no fishing, just something in the hand.
import * as THREE from 'three';

// `stack` is how many fit in one slot. Unique items say 1 and never share a slot.
export const ITEMS = {
  // `durability` is how many uses a unique tool gets before it breaks. Tools wear out
  // use by use instead of vanishing; anything without it never wears at all.
  // A tool is never set down: `placeable: false` keeps it out of the placement ghost.
  fishing_rod: { id: 'fishing_rod', name: 'Fishing rod', stack: 1, durability: 50, placeable: false },
  fish: { id: 'fish', name: 'Fish', stack: 32 },
  // What a fish becomes after its time over the fire: a small meat worth six hunger
  // points, which is three of the ten drumsticks on the bar.
  cooked_fish: {
    id: 'cooked_fish',
    name: 'Cooked fish',
    stack: 16,
    meat: 'small',
    hunger: 6,
  },
  // A fish left too long on the spit. No hunger of its own, so it can never be eaten.
  burned_fish: { id: 'burned_fish', name: 'Burned fish', stack: 16 },
  stick: { id: 'stick', name: 'Stick', stack: 32 },
  log: { id: 'log', name: 'Log', stack: 16 },
  rock: { id: 'rock', name: 'Rock', stack: 32 },
  // A bundle of plant fiber: future lashings and bindings start here.
  fiber: { id: 'fiber', name: 'Fiber', stack: 32 },
  // A crude stone tool: a knapped flake lashed to a short handle. It is the first tool
  // that works wood: its edge fells a tree in thirty-five hits, where a bare fist
  // needs fifty.
  simple_tool: { id: 'simple_tool', name: 'Simple Tool', stack: 1 },
  // A proper chopping axe: a stone head bound to a long haft with twine. It swings
  // like every other held thing, and the upright grip puts the edge first.
  rugged_axe: { id: 'rugged_axe', name: 'Rugged Axe', stack: 1 },
  kindling: { id: 'kindling', name: 'Kindling', stack: 1, durability: 4 },
  // Structures get a placement ghost; loose things like fish and sticks just get set down.
  campfire: { id: 'campfire', name: 'Campfire', stack: 1, structure: true },
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
// A faceted lump for rocks: flat-shaded, so every face catches the light
// differently instead of reading as one more box on the ground.
const LUMP = new THREE.DodecahedronGeometry(0.5, 0);
// Reel parts. The spool is a short cylinder lying across the rod, with two wider
// cheek plates; the pale line band sits between them, and the crank and drag star
// cap either side. Low segment counts keep the reel faceted like the world.
const SPOOL = new THREE.CylinderGeometry(0.052, 0.052, 0.08, 14);
const SPOOL_LINE = new THREE.CylinderGeometry(0.058, 0.058, 0.05, 14);
const SPOOL_PLATE = new THREE.CylinderGeometry(0.078, 0.078, 0.014, 14);
const DRAG_STAR = new THREE.CylinderGeometry(0.03, 0.03, 0.012, 8);
const CRANK_AXLE = new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8);
// Line guides are faceted rings rather than smooth circles: a four-sided tube and
// eight steps around, which is enough to read as a ring at arm's length.
const GUIDE = new THREE.TorusGeometry(0.012, 0.0035, 4, 8);

function material(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

const MATS = {
  grip: material(0xb07c48),
  gripDark: material(0x7d5230),
  blank: material(0x6a4226),
  metal: material(0x38434c),
  metalLight: material(0x69757e),
  wrap: material(0x9c3f33),
  line: material(0xe8ddc0),
};

// Built along -Z with the grip at the origin, so a camera-space holder points it at
// the view and a body holder only has to turn the whole group around.
export function createFishingRod() {
  const group = new THREE.Group();
  group.name = 'fishingRod';

  function box(mat, w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(BOX, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // A cylinder lying across the rod: the axis of every round reel part.
  function cross(mat, geometry, x, y, z) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Cork grip: three blocks swelling at the butt and tapering into the foregrip,
  // with darker cork-washer rings at the joins so the handle reads as built up
  // rather than cut from one slab.
  box(MATS.grip, 0.062, 0.062, 0.09, 0, 0, 0.145);
  box(MATS.grip, 0.058, 0.058, 0.1, 0, 0, 0.05);
  box(MATS.grip, 0.052, 0.052, 0.07, 0, 0, -0.035);
  box(MATS.gripDark, 0.065, 0.065, 0.012, 0, 0, 0.19);
  box(MATS.gripDark, 0.061, 0.061, 0.012, 0, 0, 0.1);
  box(MATS.gripDark, 0.055, 0.055, 0.012, 0, 0, 0);
  box(MATS.gripDark, 0.053, 0.053, 0.012, 0, 0, -0.07);

  // A metal winding band and a dark rubber bumper cap the butt, so the handle stops
  // the hand at one end without ending in a bare slab of cork.
  box(MATS.metal, 0.064, 0.064, 0.016, 0, 0, 0.198);
  box(MATS.gripDark, 0.07, 0.07, 0.02, 0, 0, 0.216);

  // Foregrip ahead of the reel, then the metal seat the reel is bolted to.
  box(MATS.grip, 0.05, 0.05, 0.05, 0, 0, -0.085);
  box(MATS.metal, 0.046, 0.046, 0.05, 0, 0, -0.135);

  // The blank: six tapering sections, each a little narrower than the last, with a
  // metal ferrule hiding the step at every join. Six keeps the flat-shaded block
  // look while still reading as a smooth taper in the hand.
  const BLANK = [
    { z: -0.25, length: 0.18, width: 0.034 },
    { z: -0.43, length: 0.18, width: 0.029 },
    { z: -0.61, length: 0.18, width: 0.0245 },
    { z: -0.79, length: 0.18, width: 0.02 },
    { z: -0.96, length: 0.16, width: 0.016 },
    { z: -1.09, length: 0.1, width: 0.012 },
  ];

  for (const section of BLANK) {
    box(MATS.blank, section.width, section.width, section.length, 0, 0, section.z);
  }

  // Ferrules at the joins, each paired with a red thread wrap on the thin side:
  // the trim a rod builder puts where one section slides into the next.
  for (let i = 1; i < BLANK.length; i++) {
    const join = BLANK[i].z + BLANK[i].length / 2;
    const wide = BLANK[i - 1].width;
    box(MATS.metal, wide + 0.004, wide + 0.004, 0.016, 0, 0, join);
    box(MATS.wrap, BLANK[i].width + 0.0035, BLANK[i].width + 0.0035, 0.018, 0, 0, join - 0.018);
  }

  // Red trim at the butt of the blank and just below the tip, framing the taper.
  box(MATS.wrap, 0.036, 0.036, 0.022, 0, 0, -0.178);
  box(MATS.wrap, 0.015, 0.015, 0.02, 0, 0, -1.075);

  // Line guides hanging under the blank, shrinking with it, plus the ring at the
  // very tip. The tip ring sits on the rod's axis, where a cast starts.
  function guide(z, rodWidth, scale = 1) {
    const half = rodWidth / 2;
    box(MATS.metalLight, 0.006, 0.016, 0.006, 0, -half - 0.002, z);
    const ring = new THREE.Mesh(GUIDE, MATS.metalLight);
    ring.scale.setScalar(scale);
    ring.position.set(0, -half - 0.013, z);
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);
  }

  guide(-0.31, 0.034);
  guide(-0.49, 0.029);
  guide(-0.67, 0.0245);
  guide(-0.85, 0.02);
  guide(-1.01, 0.016, 0.85);
  guide(-1.11, 0.012, 0.7);

  // Tip guide: centred so the cast line leaves exactly from its middle.
  const tipGuide = new THREE.Mesh(GUIDE, MATS.metalLight);
  tipGuide.position.set(0, 0, -1.14);
  tipGuide.scale.setScalar(0.65);
  tipGuide.castShadow = true;
  tipGuide.receiveShadow = true;
  group.add(tipGuide);

  // Reel: a wide spool slung under the seat, its cheeks in dark metal and the line
  // wound pale between them. The crank hangs off the near cheek and the drag star
  // off the far one, so the whole assembly reads from either side.
  const REEL_Y = -0.118;
  const REEL_Z = -0.145;

  // Foot rising from the spool to the reel seat.
  box(MATS.metal, 0.03, 0.05, 0.055, 0, -0.042, REEL_Z);

  cross(MATS.metal, SPOOL, 0, REEL_Y, REEL_Z);
  cross(MATS.line, SPOOL_LINE, 0, REEL_Y, REEL_Z);
  cross(MATS.metal, SPOOL_PLATE, -0.047, REEL_Y, REEL_Z);
  cross(MATS.metal, SPOOL_PLATE, 0.047, REEL_Y, REEL_Z);
  cross(MATS.metalLight, CRANK_AXLE, 0.066, REEL_Y, REEL_Z);
  cross(MATS.metalLight, DRAG_STAR, -0.058, REEL_Y, REEL_Z);

  // Crank arm and knob, reaching toward the player's thumb.
  box(MATS.metalLight, 0.012, 0.012, 0.08, 0.08, REEL_Y, REEL_Z + 0.035);
  box(MATS.gripDark, 0.022, 0.026, 0.026, 0.08, REEL_Y, REEL_Z + 0.078);

  // Where a cast starts: the tip guide's centre, looked up by name from outside.
  const tip = new THREE.Object3D();
  tip.name = 'rodTip';
  tip.position.set(0, 0, -1.14);
  group.add(tip);

  return group;
}

// The rod model is a set of rigid blocks, so bending is faked: each block slides and
// tilts along a cantilever curve from the grip outward. `amount` is the tip deflection
// as a fraction of the rod's reach, and `dirX`/`dirY` pick the local direction in the
// rod's XY plane (defaults to +Y, the blank's "up"). Blocks are measured from their
// baseline every time, so any amount — including zero — restores the straight rod.
export function createRodBend(rod) {
  const parts = rod.children.map((part) => ({
    part,
    position: part.position.clone(),
    quaternion: part.quaternion.clone(),
    partReach: Math.max(0, -part.position.z),
  }));
  const reach = parts.reduce((max, part) => Math.max(max, part.partReach), 0.001);
  const axis = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  return function bendRod(amount, dirX = 0, dirY = 1) {
    const length = Math.hypot(dirX, dirY);
    const dx = length > 0.0001 ? dirX / length : 0;
    const dy = length > 0.0001 ? dirY / length : 1;
    // Rotating a -Z blank toward (dx, dy): axis = (0, 0, -1) × dir.
    axis.set(dy, -dx, 0);
    for (const { part, position, quaternion, partReach } of parts) {
      const s = Math.min(1, partReach / reach);
      const offset = amount * reach * s * s;
      const slope = 2 * amount * s;
      part.position.set(
        position.x + dx * offset,
        position.y + dy * offset,
        position.z
      );
      quat.setFromAxisAngle(axis, Math.atan(slope));
      part.quaternion.copy(quaternion).multiply(quat);
    }
  };
}

const FISH_MATS = {
  body: material(0x3f8f72),
  bodyDark: material(0x2c6b53),
  bodyLight: material(0x86c1ad),
  fin: material(0x93b7c9),
  finDark: material(0x5b7f95),
  eye: material(0x14202a),
};

// A chunky little fish in the same voxel idiom as the rest of the world: a blocky
// body in three greens, a pale belly, a steel tail fan and a dark eye. Built along
// -Z with the head forward, so a hand can point it the way it is looking.
export function createFish() {
  const group = new THREE.Group();
  group.name = 'fish';

  function box(mat, w, h, d, x, y, z, rx = 0) {
    const mesh = new THREE.Mesh(BOX, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Head, middle and rear, stepping down so the body tapers to the tail.
  box(FISH_MATS.body, 0.085, 0.125, 0.09, 0, 0, -0.115);
  box(FISH_MATS.body, 0.105, 0.155, 0.11, 0, 0.005, -0.02);
  box(FISH_MATS.bodyDark, 0.082, 0.115, 0.1, 0, 0, 0.075);
  box(FISH_MATS.bodyDark, 0.05, 0.075, 0.07, 0, 0, 0.145);

  // Pale belly and a darker back, both inset so they read as bands, not slabs.
  box(FISH_MATS.bodyLight, 0.088, 0.045, 0.2, 0, -0.062, -0.02);
  box(FISH_MATS.bodyDark, 0.086, 0.035, 0.19, 0, 0.078, -0.02);

  // Speckles, the mottling the reference has across the flank.
  box(FISH_MATS.bodyLight, 0.024, 0.024, 0.024, -0.048, 0.02, -0.07);
  box(FISH_MATS.bodyLight, 0.022, 0.022, 0.022, 0.05, -0.02, 0.01);
  box(FISH_MATS.bodyLight, 0.02, 0.02, 0.02, -0.05, -0.03, 0.05);
  box(FISH_MATS.bodyDark, 0.018, 0.018, 0.018, 0.052, 0.03, -0.09);

  // Dorsal fin, and the tail fan angled up and down behind the body.
  box(FISH_MATS.finDark, 0.026, 0.075, 0.1, 0, 0.115, -0.005);
  box(FISH_MATS.fin, 0.022, 0.13, 0.085, 0, 0.055, 0.205, 0.55);
  box(FISH_MATS.fin, 0.022, 0.11, 0.075, 0, -0.045, 0.195, -0.5);

  // Eye on each flank, just behind the snout, and a small mouth.
  box(FISH_MATS.eye, 0.018, 0.022, 0.022, -0.045, 0.025, -0.135);
  box(FISH_MATS.eye, 0.018, 0.022, 0.022, 0.045, 0.025, -0.135);
  box(FISH_MATS.eye, 0.03, 0.018, 0.014, 0, -0.028, -0.16);

  return group;
}

const COOKED_FISH_MATS = {
  body: material(0xb0763c),
  bodyDark: material(0x8a5628),
  bodyLight: material(0xe0b47a),
  fin: material(0xcf9a63),
  finDark: material(0xa9713f),
  eye: material(0x2a1a10),
};

// The same fish cooked through: the raw model with every material swapped for its
// browned twin, so the two stages read as one piece of food.
export function createCookedFish() {
  const group = createFish();
  group.name = 'cookedFish';

  const swap = new Map([
    [FISH_MATS.body, COOKED_FISH_MATS.body],
    [FISH_MATS.bodyDark, COOKED_FISH_MATS.bodyDark],
    [FISH_MATS.bodyLight, COOKED_FISH_MATS.bodyLight],
    [FISH_MATS.fin, COOKED_FISH_MATS.fin],
    [FISH_MATS.finDark, COOKED_FISH_MATS.finDark],
    [FISH_MATS.eye, COOKED_FISH_MATS.eye],
  ]);

  group.traverse((object) => {
    if (!object.isMesh) return;
    object.material = swap.get(object.material) || COOKED_FISH_MATS.body;
  });

  return group;
}

const BURNED_FISH_MATS = {
  body: material(0x2f2622),
  bodyDark: material(0x1f1917),
  bodyLight: material(0x453832),
  fin: material(0x241d1a),
  finDark: material(0x1a1512),
  eye: material(0x120e0c),
};

// The same fish, charred all through: what a fish becomes after one turn too many.
export function createBurnedFish() {
  const group = createFish();
  group.name = 'burnedFish';

  const swap = new Map([
    [FISH_MATS.body, BURNED_FISH_MATS.body],
    [FISH_MATS.bodyDark, BURNED_FISH_MATS.bodyDark],
    [FISH_MATS.bodyLight, BURNED_FISH_MATS.bodyLight],
    [FISH_MATS.fin, BURNED_FISH_MATS.fin],
    [FISH_MATS.finDark, BURNED_FISH_MATS.finDark],
    [FISH_MATS.eye, BURNED_FISH_MATS.eye],
  ]);

  group.traverse((object) => {
    if (!object.isMesh) return;
    object.material = swap.get(object.material) || BURNED_FISH_MATS.body;
  });

  return group;
}

const SPIT_MATS = {
  stick: material(0x6b4a2f),
};

// A spit for a campfire: a stick pushed into the ground and leaning in over the coals,
// with the fish skewered near the top. It carries both stages at once, one hidden, so
// the same spit flips from raw to cooked in place.
export function createFishSpit() {
  const group = new THREE.Group();
  group.name = 'fishSpit';

  // A pivot at the foot of the stick does the leaning, so the base stays in the dirt.
  // The lean is steep enough that the fish reaches the middle of a fire while the foot
  // of the stick still stands outside the ring of stones.
  const lean = new THREE.Group();
  lean.rotation.z = 0.78;
  group.add(lean);

  const stick = new THREE.Mesh(BOX, SPIT_MATS.stick);
  stick.scale.set(0.045, 1.15, 0.045);
  stick.position.y = 0.575;
  stick.castShadow = true;
  stick.receiveShadow = true;
  lean.add(stick);

  // Skewered lengthwise near the top, head up the stick: the fish model runs along
  // -Z with its head forward, so a quarter turn stands it on end.
  const raw = createFish();
  raw.rotation.x = Math.PI / 2;
  raw.position.y = 0.72;
  lean.add(raw);

  const cooked = createCookedFish();
  cooked.rotation.x = Math.PI / 2;
  cooked.position.y = 0.72;
  cooked.visible = false;
  lean.add(cooked);

  // And the charred stage, for a fish burnt through by careless turning.
  const charred = createBurnedFish();
  charred.rotation.x = Math.PI / 2;
  charred.position.y = 0.72;
  charred.visible = false;
  lean.add(charred);

  // Where the fish ends up relative to the foot of the stick. The fire stands the foot
  // back by exactly this much, which is what puts the fish over the middle of it.
  lean.updateMatrix();
  const fishOffset = raw.position.clone().applyMatrix4(lean.matrix);

  return { group, raw, cooked, charred, fishOffset };
}

const KINDLING_MATS = {
  twig: material(0x6b4a2f),
  twigDark: material(0x4b3421),
  tinder: material(0xd9b26a),
  band: material(0x8a6a45),
};

const FIBER_MATS = {
  blade: material(0x6b8f2a),
  bladeDark: material(0x435e1c),
  tie: material(0x9a7a4d),
};

// A fistful of green blades bound at the middle with twine: the same bundle shape
// as kindling, leafy instead of woody. Built around the origin so it sits in a
// hand like a small torch and drops flat like one too.
export function createFiber() {
  const group = new THREE.Group();
  group.name = 'fiber';

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const blade = new THREE.Mesh(BOX, i % 2 ? FIBER_MATS.bladeDark : FIBER_MATS.blade);
    blade.scale.set(0.028, 0.02, 0.4);
    blade.position.set(Math.cos(angle) * 0.03, Math.sin(angle) * 0.026, 0);
    blade.rotation.set(0.12 * Math.cos(angle), 0.2 * Math.sin(angle), 0.12 * Math.sin(angle));
    group.add(blade);
  }

  // Leaves bunched around the middle, held on by a wrapped tie.
  const heart = new THREE.Mesh(BOX, FIBER_MATS.blade);
  heart.scale.set(0.1, 0.085, 0.13);
  group.add(heart);
  const tie = new THREE.Mesh(BOX, FIBER_MATS.tie);
  tie.scale.set(0.12, 0.1, 0.045);
  group.add(tie);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

// A fistful of dry twigs bound in tinder: the bundle you push under a fire to get it
// going. Built around the origin so it sits in a hand like a small torch.
export function createKindling() {
  const group = new THREE.Group();
  group.name = 'kindling';

  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const twig = new THREE.Mesh(BOX, i % 2 ? KINDLING_MATS.twigDark : KINDLING_MATS.twig);
    twig.scale.set(0.032, 0.032, 0.44);
    twig.position.set(Math.cos(angle) * 0.045, Math.sin(angle) * 0.04, 0);
    twig.rotation.set(0.14 * Math.cos(angle), 0.24 * Math.sin(angle), 0.14 * Math.sin(angle));
    group.add(twig);
  }

  // Tinder bunched around the middle, held on by a wrapped band.
  const tinder = new THREE.Mesh(BOX, KINDLING_MATS.tinder);
  tinder.scale.set(0.115, 0.1, 0.14);
  group.add(tinder);
  const band = new THREE.Mesh(BOX, KINDLING_MATS.band);
  band.scale.set(0.135, 0.115, 0.05);
  group.add(band);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

const FIRE_MATS = {
  stone: material(0x8d949b),
  stoneDark: material(0x6d747b),
  log: material(0x6b4a2f),
  ash: material(0x3a3f42),
  flameOuter: new THREE.MeshLambertMaterial({
    color: 0xff8a3c,
    emissive: 0xd1470f,
    flatShading: true,
  }),
  flameMid: new THREE.MeshLambertMaterial({
    color: 0xffc247,
    emissive: 0xc47a06,
    flatShading: true,
  }),
  flameCore: new THREE.MeshLambertMaterial({
    color: 0xfff0be,
    emissive: 0xb89b45,
    flatShading: true,
  }),
};

// Five-sided, unit-tall: scaled per flame layer so the fire is a stack of cones.
const CONE = new THREE.ConeGeometry(0.5, 1, 5);

// A ring of stones around three crossed logs. It starts cold: the flame group named
// 'fire' is hidden until kindling is put to it, so a carried campfire never glows.
export function createCampfire() {
  const group = new THREE.Group();
  group.name = 'campfire';

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(BOX, i % 2 ? FIRE_MATS.stone : FIRE_MATS.stoneDark);
    stone.scale.set(0.16, 0.13, 0.15);
    stone.position.set(Math.cos(angle) * 0.42, 0.055, Math.sin(angle) * 0.42);
    stone.rotation.y = angle + 0.3;
    group.add(stone);
  }

  // Ash bed inside the ring, so the logs don't sit on bare grass.
  const ash = new THREE.Mesh(BOX, FIRE_MATS.ash);
  ash.scale.set(0.52, 0.03, 0.52);
  ash.position.y = 0.02;
  group.add(ash);

  // Three logs crossing in the middle.
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const log = new THREE.Mesh(BOX, FIRE_MATS.log);
    log.scale.set(0.09, 0.09, 0.66);
    log.position.set(Math.cos(angle) * 0.1, 0.085, Math.sin(angle) * 0.1);
    log.rotation.y = angle;
    group.add(log);
  }

  // The flame: three cones of shrinking size, plus the warm light they throw.
  const fire = new THREE.Group();
  fire.name = 'fire';
  fire.position.y = 0.08;
  fire.visible = false;

  function flame(mat, width, height, y) {
    const mesh = new THREE.Mesh(CONE, mat);
    mesh.scale.set(width, height, width);
    mesh.position.y = y;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    fire.add(mesh);
    return mesh;
  }

  flame(FIRE_MATS.flameOuter, 0.36, 0.44, 0.22);
  flame(FIRE_MATS.flameMid, 0.24, 0.3, 0.15);
  flame(FIRE_MATS.flameCore, 0.12, 0.18, 0.09);

  const light = new THREE.PointLight(0xffa858, 2.6, 9, 1.8);
  light.position.y = 0.4;
  light.castShadow = false;
  fire.add(light);
  group.add(fire);

  group.traverse((object) => {
    if (object.isMesh && !object.material.emissive) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

const STICK_MATS = {
  bark: material(0x6b4a2f),
  barkDark: material(0x4b3421),
};

const LOG_MATS = {
  bark: material(0x6b4a2f),
  barkDark: material(0x4b3421),
  cut: material(0xc9a26b),
  ring: material(0xa97f4e),
};

// A felled section of trunk: a blocky length of bark with pale cut ends and a broken
// branch stub. Built lying along Z with its underside on the origin, so it rests on
// the ground and sits in a hand the same way the stick does.
export function createLog() {
  const group = new THREE.Group();
  group.name = 'log';

  const body = new THREE.Mesh(BOX, LOG_MATS.bark);
  body.scale.set(0.24, 0.22, 0.72);
  body.position.y = 0.11;
  group.add(body);

  // A bark ridge along the top, so the length reads as a trunk rather than a plank.
  const ridge = new THREE.Mesh(BOX, LOG_MATS.barkDark);
  ridge.scale.set(0.07, 0.025, 0.5);
  ridge.position.set(-0.055, 0.228, 0.02);
  group.add(ridge);

  // Pale cut faces at both ends, each with a darker ring inset.
  for (const z of [-0.365, 0.365]) {
    const cut = new THREE.Mesh(BOX, LOG_MATS.cut);
    cut.scale.set(0.2, 0.18, 0.03);
    cut.position.set(0, 0.11, z);
    group.add(cut);

    const ring = new THREE.Mesh(BOX, LOG_MATS.ring);
    ring.scale.set(0.1, 0.09, 0.012);
    ring.position.set(0, 0.11, z + Math.sign(z) * 0.018);
    group.add(ring);
  }

  // A snapped branch stub sticking up near one end.
  const stub = new THREE.Mesh(BOX, LOG_MATS.barkDark);
  stub.scale.set(0.06, 0.16, 0.06);
  stub.position.set(0.09, 0.19, 0.1);
  stub.rotation.z = -0.45;
  group.add(stub);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

const ROCK_MATS = {
  stone: material(0x8d949b),
  stoneDark: material(0x6d747b),
};

// A loose rock big enough to pick out from the textured ground: two faceted lumps
// leaning on different axes, so faces slope and catch the light instead of reading
// as squares. Still small enough to sit beside the half-metre sticks as litter.
export function createRock() {
  const group = new THREE.Group();
  group.name = 'rock';

  const main = new THREE.Mesh(LUMP, ROCK_MATS.stone);
  main.scale.set(0.34, 0.22, 0.3);
  main.position.y = 0.17;
  main.rotation.set(0.3, 0.4, 0.15);
  group.add(main);

  const chip = new THREE.Mesh(LUMP, ROCK_MATS.stoneDark);
  chip.scale.set(0.18, 0.13, 0.16);
  chip.position.set(0.18, 0.13, 0.06);
  chip.rotation.set(0.9, 0.2, 0.7);
  group.add(chip);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

// A crude stone tool: a short handle with a knapped flake lashed to one end, lying
// flat like a stick so it drops and rests the same way.
export function createSimpleTool() {
  const group = new THREE.Group();
  group.name = 'simple_tool';

  const handle = new THREE.Mesh(BOX, STICK_MATS.bark);
  handle.scale.set(0.05, 0.05, 0.42);
  handle.position.y = 0.028;
  group.add(handle);

  const head = new THREE.Mesh(LUMP, ROCK_MATS.stoneDark);
  head.scale.set(0.16, 0.1, 0.13);
  head.position.set(0, 0.07, 0.19);
  head.rotation.set(0.4, 0.3, 0.2);
  group.add(head);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

const AXE_MATS = {
  binding: material(0x7a7a2e),
};

// A rugged axe: a long haft with a stone head bound across its top end, the joint
// wrapped twice in olive twine the way the reference art lashes it. Built along +Z
// with the head at the far end, so the hands stand it upright the way they do the
// simple tool — edge up and out — and lying flat it drops like a long stick.
export function createRuggedAxe() {
  const group = new THREE.Group();
  group.name = 'rugged_axe';

  const haft = new THREE.Mesh(BOX, STICK_MATS.bark);
  haft.scale.set(0.055, 0.055, 0.5);
  haft.position.y = 0.03;
  group.add(haft);

  const head = new THREE.Mesh(LUMP, ROCK_MATS.stone);
  head.scale.set(0.15, 0.16, 0.1);
  head.position.set(0, 0.09, 0.22);
  head.rotation.set(0.2, 0.3, 0.15);
  group.add(head);

  // Two twine wraps lashing the head to the haft.
  for (const z of [0.12, 0.16]) {
    const wrap = new THREE.Mesh(BOX, AXE_MATS.binding);
    wrap.scale.set(0.075, 0.075, 0.035);
    wrap.position.set(0, 0.03, z);
    group.add(wrap);
  }

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}

// A fallen twig: a length of bark with a short branch across it, lying flat. Same
// primitives as everything else, and small enough to read as litter from standing up.
export function createStick() {
  const group = new THREE.Group();
  group.name = 'stick';

  const main = new THREE.Mesh(BOX, STICK_MATS.bark);
  main.scale.set(0.055, 0.05, 0.62);
  main.position.y = 0.028;
  group.add(main);

  const branch = new THREE.Mesh(BOX, STICK_MATS.barkDark);
  branch.scale.set(0.042, 0.04, 0.26);
  branch.position.set(0.05, 0.035, 0.05);
  branch.rotation.y = 0.75;
  group.add(branch);

  group.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return group;
}
