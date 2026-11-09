// Trees: the first of the island's renewable structures. They are scattered across the
// grass band from a fixed seed, so the same island grows back in the same places on every
// load. Each one can be chopped down for sticks and leaves a stump behind; regrowth is a
// later slice, but the record already carries everything it will need for it. Bushes grow
// against the outside of the child trees and give up fiber and sticks when cut.
import * as THREE from 'three';
import { heightAt, ISLAND_RADIUS } from './island.js';

// The same seed on every run: the forest is part of the island, not a fresh roll.
const SEED = 0x5eed1234;
// Spread is built from patterns rather than scattered evenly. Pattern one is radial
// clumping: a mother tree on the grass, then a designated brood of shorter children
// ringing her. More patterns will sit beside this one.
const CLUMP_COUNT = 14;
const CHILDREN_MIN = 4;
const CHILDREN_MAX = 8;
// How far children can land from their mother: a tight family, not a new forest.
const CLUMP_RADIUS_MIN = 4.2;
const CLUMP_RADIUS_MAX = 7.4;
// Mother trees keep their distance from each other, so the clumps stay separate.
const MOTHER_SPACING = 13;
// Trunks keep their distance even when the canopies touch and close the roof.
const MIN_SPACING = 2.3;
// Clear of the sand below and the rocky crown above — the same band the grass uses.
const MIN_HEIGHT = 2.9;
const MAX_HEIGHT = 6.65;
// Height bands in world units. Every child is a fraction of her own mother's height,
// so a clump always reads as one tall tree with smaller ones gathered beneath it.
const MOTHER_HEIGHT_MIN = 6.6;
const MOTHER_HEIGHT_MAX = 8.4;
const CHILD_HEIGHT_MIN = 0.45;
const CHILD_HEIGHT_MAX = 0.78;
// A bush hugs the outward side of a child tree, just clear of its trunk.
const BUSH_OFFSET_MIN = 0.62;
const BUSH_OFFSET_MAX = 0.88;
// Bushes need an edge: the simple tool takes five hits to clear one, the axe one.
// A fist only rustles them.
const BUSH_HITS = 5;
const BUSH_DROP_FIBER = 2;
const BUSH_DROP_STICK = 2;
// A felled tree breaks into logs first: a mother gives more timber than a child.
const MOTHER_LOG_DROP = 6;
const CHILD_LOG_DROP = 4;
// How close a player has to be for a tree to be worth swinging at.
const REACH = 4.5;
// Trunks are measured in punches. A bare fist needs fifty straight hits; the simple
// stone tool bites harder, so the same trunk comes down in thirty-five, and the
// rugged axe harder still: ten.
const PUNCHES_TO_FELL = 50;
const SIMPLE_TOOL_HITS = 35;
const SIMPLE_TOOL_DAMAGE = PUNCHES_TO_FELL / SIMPLE_TOOL_HITS;
const AXE_HITS = 10;
const AXE_DAMAGE = PUNCHES_TO_FELL / AXE_HITS;
// How long the trunk takes to tip all the way over.
const FALL_TIME = 1.15;
// A short rock on the ground after the trunk lands, so the handoff to the stump and
// logs isn't a hard stop.
const FALL_SETTLE = 0.35;
// The fall stops a little short of flat so the crown rests in the grass rather than
// disappearing through it.
const FALL_ANGLE = Math.PI * 0.47;
// The white shell around an aimed tree, same trick the ground items use.
const OUTLINE_PAD = 1.018;

const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();

function material(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

const BARK = new THREE.Color(0x6b4a2f);
const BARK_DARK = new THREE.Color(0x4b3421);
const BARK_LIGHT = new THREE.Color(0x8a6440);
const LEAF = new THREE.Color(0x3f7f3a);
const LEAF_LIGHT = new THREE.Color(0x62a447);
const LEAF_DARK = new THREE.Color(0x2d5f2c);
const LEAF_LIME = new THREE.Color(0x7bb650);

// One material for every tree in the island: the colour lives in the merged geometry,
// so a whole tree is a single draw call instead of twenty boxes' worth.
const TREE_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const OUTLINE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.BackSide,
});

// Small deterministic PRNG (mulberry32). The tree layout must not drift between loads.
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Grow one tree into a single merged vertex-coloured geometry. Every box becomes a
// handful of triangles with its own flat colour, which keeps the chunky look while
// letting a whole tree draw in one call.
function buildTreeGeometry(random, mother = false) {
  const positions = [];
  const normals = [];
  const colors = [];
  const box = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const colour = new THREE.Color();

  const basePos = BOX.attributes.position;
  const baseNorm = BOX.attributes.normal;

  function add(colourHex, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    colour.setHex(colourHex);
    euler.set(rx, ry, rz);
    rotation.setFromEuler(euler);
    position.set(x, y, z);
    scale.set(w, h, d);
    box.compose(position, rotation, scale);
    normalMatrix.getNormalMatrix(box);

    for (let i = 0; i < basePos.count; i++) {
      vertex.fromBufferAttribute(basePos, i).applyMatrix4(box);
      positions.push(vertex.x, vertex.y, vertex.z);
      normal.fromBufferAttribute(baseNorm, i).applyMatrix3(normalMatrix).normalize();
      normals.push(normal.x, normal.y, normal.z);
      colors.push(colour.r, colour.g, colour.b);
    }
  }

  // A mother tree is old, thick and broad; a child is young, slender and compact.
  // They share the block-built language but not the silhouette.
  const trunkHeight = mother ? 4.4 + random() * 1.1 : 2.3 + random() * 1.0;
  const trunkWidth = mother ? 0.54 + random() * 0.16 : 0.24 + random() * 0.1;
  const segments = mother ? 5 : 3;
  const segmentHeight = trunkHeight / segments;
  const barkA = mother ? 0x5b4029 : 0x6b4a2f;
  const barkB = mother ? 0x4b3421 : 0x5b4029;

  let leanX = 0;
  let leanZ = 0;
  let topY = 0;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const width = trunkWidth * (1 - t * (mother ? 0.46 : 0.32));
    leanX += (random() - 0.5) * (mother ? 0.09 : 0.06);
    leanZ += (random() - 0.5) * (mother ? 0.09 : 0.06);
    add(
      i % 2 === 0 ? barkA : barkB,
      width,
      segmentHeight * 1.06,
      width,
      leanX,
      topY + segmentHeight * 0.5,
      leanZ,
      (random() - 0.5) * 0.06,
      random() * Math.PI,
      (random() - 0.5) * 0.06
    );
    topY += segmentHeight;
  }

  // Roots: the mother grips the ground with a wide flare; the child has small
  // footholds.
  const roots = mother ? 6 : 3;
  for (let i = 0; i < roots; i++) {
    const angle = (i / roots) * Math.PI * 2 + random() * 0.5;
    const reach = mother ? 0.44 + random() * 0.3 : 0.2 + random() * 0.12;
    const length = mother ? 0.72 + random() * 0.35 : 0.34 + random() * 0.18;
    add(
      i % 2 === 0 ? 0x4b3421 : 0x5b4029,
      mother ? 0.2 + random() * 0.12 : 0.11 + random() * 0.05,
      mother ? 0.24 : 0.16,
      length,
      Math.cos(angle) * reach,
      mother ? 0.12 : 0.08,
      Math.sin(angle) * reach,
      mother ? 0.62 : 0.5,
      angle,
      0
    );
  }

  // Moss gathers around an old trunk's foot.
  if (mother) {
    for (let i = 0; i < 6; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.22 + random() * 0.28;
      add(
        random() < 0.5 ? 0x2f5a2a : 0x3f6f33,
        0.16 + random() * 0.16,
        0.06 + random() * 0.05,
        0.18 + random() * 0.18,
        Math.cos(angle) * radius,
        0.16 + random() * 0.32,
        Math.sin(angle) * radius,
        random() * 0.4,
        random() * Math.PI,
        random() * 0.4
      );
    }
  }

  // Branches: the mother splits into a broad set of long limbs; the child has a few
  // thin twigs under a compact tuft.
  const branches = mother ? 6 : 3;
  for (let i = 0; i < branches; i++) {
    const angle = (i / branches) * Math.PI * 2 + random() * 0.75;
    const y = trunkHeight * (mother ? 0.52 + random() * 0.38 : 0.55 + random() * 0.24);
    const length = mother ? 1.2 + random() * 1.2 : 0.5 + random() * 0.5;
    const thickness = mother ? 0.15 + random() * 0.07 : 0.08 + random() * 0.03;
    add(
      mother ? 0x5b4029 : 0x6b4a2f,
      thickness,
      thickness,
      length,
      Math.cos(angle) * (length * 0.5 + trunkWidth * 0.28),
      y,
      Math.sin(angle) * (length * 0.5 + trunkWidth * 0.28),
      mother ? 0.12 + random() * 0.2 : 0.18 + random() * 0.14,
      angle,
      mother ? 0.18 + random() * 0.2 : 0.1
    );

    if (mother && random() < 0.7) {
      const bend = angle + (random() - 0.5) * 0.8;
      const second = 0.6 + random() * 0.7;
      add(
        0x4b3421,
        thickness * 0.7,
        thickness * 0.7,
        second,
        Math.cos(angle) * length + Math.cos(bend) * second * 0.5,
        y + 0.24 + random() * 0.3,
        Math.sin(angle) * length + Math.sin(bend) * second * 0.5,
        0.05 + random() * 0.12,
        bend,
        0.35 + random() * 0.2
      );
    }
  }

  // A child's young branches carry a couple of leaf tufts before the main crown.
  if (!mother) {
    for (let i = 0; i < 2; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.55 + random() * 0.25;
      const size = 0.4 + random() * 0.2;
      add(
        random() < 0.5 ? 0x62a447 : 0x7bb650,
        size,
        size * 0.8,
        size,
        Math.cos(angle) * radius,
        trunkHeight * 0.62 + random() * 0.35,
        Math.sin(angle) * radius,
        random() * 0.3,
        random() * Math.PI,
        random() * 0.3
      );
    }
  }

  // Crown. The mother is wide, layered and slightly drooping; the child is a compact,
  // bright teardrop of young leaves.
  const crownY = trunkHeight + (mother ? 0.65 : 0.35);
  const crownRadius = mother ? 2.1 + random() * 0.85 : 0.9 + random() * 0.38;
  const blobs = mother ? 22 + Math.floor(random() * 8) : 8 + Math.floor(random() * 5);
  const spreadY = mother ? 2.4 : 0.95;
  for (let i = 0; i < blobs; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * crownRadius;
    const y = crownY + (random() - (mother ? 0.42 : 0.35)) * spreadY;
    const size = mother ? 0.78 + random() * 0.62 : 0.52 + random() * 0.34;
    const shade = random();
    let hex;
    if (mother) {
      hex = shade < 0.4 ? 0x3f7f3a : shade < 0.7 ? 0x2d5f2c : shade < 0.9 ? 0x4f9c39 : 0x7bb650;
    } else {
      hex = shade < 0.35 ? 0x4f9c39 : shade < 0.62 ? 0x62a447 : shade < 0.85 ? 0x7bb650 : 0x8acb5a;
    }
    add(
      hex,
      size,
      size * (0.65 + random() * 0.3),
      size,
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius,
      (random() - 0.5) * 0.7,
      random() * Math.PI,
      (random() - 0.5) * 0.7
    );
  }

  if (mother) {
    // A lower fringe makes the canopy read as an old, heavy crown.
    const drapes = 4 + Math.floor(random() * 3);
    for (let i = 0; i < drapes; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 1.1 + random() * 1.0;
      const size = 0.65 + random() * 0.45;
      add(
        random() < 0.5 ? 0x2d5f2c : 0x3f7f3a,
        size,
        size * 0.7,
        size,
        Math.cos(angle) * radius,
        crownY - 0.85 - random() * 0.7,
        Math.sin(angle) * radius,
        (random() - 0.5) * 0.5,
        random() * Math.PI,
        (random() - 0.5) * 0.5
      );
    }

    add(0x2d5f2c, 1.7, 1.2, 1.6, 0, crownY + 0.15, 0, 0.2, 0.4, 0.1);
    add(0x3f7f3a, 1.5, 1.05, 1.4, 0.3, crownY + 0.95, -0.25, -0.15, 1.1, 0.25);

    // Mossy strands hanging out of the underside.
    for (let i = 0; i < 3; i++) {
      const angle = random() * Math.PI * 2;
      const length = 0.6 + random() * 0.7;
      add(
        0x2f5a2a,
        0.07,
        length,
        0.07,
        Math.cos(angle) * crownRadius * 0.72,
        crownY - length * 0.5 + 0.1,
        Math.sin(angle) * crownRadius * 0.72,
        (random() - 0.5) * 0.15,
        0,
        (random() - 0.5) * 0.15
      );
    }
  } else {
    add(0x4f9c39, 0.92, 0.78, 0.88, 0, crownY + 0.1, 0, 0.2, 0.4, 0.1);
    add(0x62a447, 0.68, 0.58, 0.66, 0.14, crownY + 0.5, -0.1, -0.15, 1.1, 0.25);
    // A bright young leader shoot at the top.
    add(0x8acb5a, 0.28, 0.42, 0.28, 0.1, crownY + 0.92, 0.02, 0.1, 0.6, 0.1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  let top = 0;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] > top) top = positions[i];
  }
  return { geometry, height: top, radius: trunkWidth * 0.62 };
}

// A stump is a short, ragged block where the trunk was: it stays behind as the marker
// that something grew here, and the future regrowth slot.
function buildStumpGeometry() {
  const positions = [];
  const normals = [];
  const colors = [];
  const box = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const colour = new THREE.Color();
  const basePos = BOX.attributes.position;
  const baseNorm = BOX.attributes.normal;

  function add(colourHex, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    colour.setHex(colourHex);
    euler.set(rx, ry, rz);
    rotation.setFromEuler(euler);
    position.set(x, y, z);
    scale.set(w, h, d);
    box.compose(position, rotation, scale);
    normalMatrix.getNormalMatrix(box);
    for (let i = 0; i < basePos.count; i++) {
      vertex.fromBufferAttribute(basePos, i).applyMatrix4(box);
      positions.push(vertex.x, vertex.y, vertex.z);
      normal.fromBufferAttribute(baseNorm, i).applyMatrix3(normalMatrix).normalize();
      normals.push(normal.x, normal.y, normal.z);
      colors.push(colour.r, colour.g, colour.b);
    }
  }

  add(0x6b4a2f, 0.52, 0.3, 0.52, 0, 0.15, 0);
  add(0x5b4029, 0.44, 0.16, 0.46, 0.03, 0.36, -0.02, 0.08, 0.3, 0.05);
  add(0x4b3421, 0.3, 0.09, 0.32, 0.06, 0.47, 0.02, 0.1, 0.8, 0.12);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

const STUMP_GEO = buildStumpGeometry();

// A bush is a low dome of leaf blocks huddled against a child tree: no trunk, a few
// twigs poking out and a scatter of berries so it reads as undergrowth rather than a
// second canopy. Built as one merged mesh like the trees.
function buildBushGeometry(random) {
  const positions = [];
  const normals = [];
  const colors = [];
  const box = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  const colour = new THREE.Color();
  const basePos = BOX.attributes.position;
  const baseNorm = BOX.attributes.normal;

  function add(colourHex, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    colour.setHex(colourHex);
    euler.set(rx, ry, rz);
    rotation.setFromEuler(euler);
    position.set(x, y, z);
    scale.set(w, h, d);
    box.compose(position, rotation, scale);
    normalMatrix.getNormalMatrix(box);
    for (let i = 0; i < basePos.count; i++) {
      vertex.fromBufferAttribute(basePos, i).applyMatrix4(box);
      positions.push(vertex.x, vertex.y, vertex.z);
      normal.fromBufferAttribute(baseNorm, i).applyMatrix3(normalMatrix).normalize();
      normals.push(normal.x, normal.y, normal.z);
      colors.push(colour.r, colour.g, colour.b);
    }
  }

  // The dense lower mass, then a loose crown of smaller leaf blocks on top and around.
  add(0x2d5f2c, 1.05, 0.5, 1.0, 0, 0.34, 0, 0.05, 0.4, 0.03);
  add(0x3f7f3a, 0.82, 0.5, 0.86, 0.12, 0.58, -0.08, -0.08, 0.9, 0.1);
  add(0x2d5f2c, 0.7, 0.38, 0.72, -0.28, 0.3, 0.2, 0.12, 0.2, -0.05);

  const blobs = 9 + Math.floor(random() * 5);
  for (let i = 0; i < blobs; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 0.25 + Math.sqrt(random()) * 0.48;
    const size = 0.3 + random() * 0.28;
    const shade = random();
    const hex = shade < 0.4 ? 0x3f7f3a : shade < 0.72 ? 0x2d5f2c : shade < 0.9 ? 0x62a447 : 0x7bb650;
    add(
      hex,
      size,
      size * (0.7 + random() * 0.35),
      size,
      Math.cos(angle) * radius,
      0.4 + random() * 0.5,
      Math.sin(angle) * radius,
      (random() - 0.5) * 0.6,
      random() * Math.PI,
      (random() - 0.5) * 0.6
    );
  }

  // A handful of dry twigs sticking out at low angles, so the bush has a scratchy edge.
  for (let i = 0; i < 4; i++) {
    const angle = random() * Math.PI * 2;
    add(
      0x4b3421,
      0.045,
      0.045,
      0.5 + random() * 0.3,
      Math.cos(angle) * 0.45,
      0.22,
      Math.sin(angle) * 0.45,
      0.18,
      angle,
      0.45
    );
  }

  // Berries: tiny dark-red boxes dotted through the top of the bush.
  for (let i = 0; i < 4; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 0.2 + random() * 0.4;
    add(
      0xc0504a,
      0.075,
      0.075,
      0.075,
      Math.cos(angle) * radius,
      0.5 + random() * 0.4,
      Math.sin(angle) * radius
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return { geometry, radius: 0.72 };
}

// Is this point somewhere trees grow? Returns the ground height, or null on sand and
// rock.
function plantedHeight(x, z) {
  const y = heightAt(x, z);
  return y >= MIN_HEIGHT && y <= MAX_HEIGHT ? y : null;
}

function clearOf(spots, x, z, spacing) {
  for (const spot of spots) {
    const dx = spot.x - x;
    const dz = spot.z - z;
    if (dx * dx + dz * dz < spacing * spacing) return false;
  }
  return true;
}

function clearOfExcept(spots, except, x, z, spacing) {
  for (const spot of spots) {
    if (spot === except) continue;
    const dx = spot.x - x;
    const dz = spot.z - z;
    if (dx * dx + dz * dz < spacing * spacing) return false;
  }
  return true;
}

// Pattern one: radial clumping. Each clump is a mother tree with a brood of children
// around her. Every child's height is drawn as a fraction of its own mother's, so the
// hierarchy is guaranteed no matter how the underlying trunk shape rolls.
function scatterClumps(random, bushRandom) {
  const spots = [];
  const mothers = [];
  const clumps = [];
  const bushSpots = [];

  for (let c = 0; c < CLUMP_COUNT; c++) {
    let mother = null;
    for (let attempt = 0; attempt < 240; attempt++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * ISLAND_RADIUS * 0.98;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = plantedHeight(x, z);
      if (y === null) continue;
      if (!clearOf(mothers, x, z, MOTHER_SPACING)) continue;
      mother = { x, y, z };
      break;
    }
    if (!mother) continue;

    const height = MOTHER_HEIGHT_MIN + random() * (MOTHER_HEIGHT_MAX - MOTHER_HEIGHT_MIN);
    const motherSpot = { ...mother, height, mother: true, clump: c };
    spots.push(motherSpot);
    mothers.push(motherSpot);

    const children = CHILDREN_MIN + Math.floor(random() * (CHILDREN_MAX - CHILDREN_MIN + 1));
    const spread = CLUMP_RADIUS_MIN + random() * (CLUMP_RADIUS_MAX - CLUMP_RADIUS_MIN);
    let placed = 0;

    // Children are tried around the mother until the brood is full; a ring point that
    // falls onto sand or too close to another trunk is simply re-rolled.
    for (let attempt = 0; attempt < children * 40 && placed < children; attempt++) {
      const angle = random() * Math.PI * 2;
      const radius = (0.18 + 0.82 * Math.sqrt(random())) * spread;
      const x = mother.x + Math.cos(angle) * radius;
      const z = mother.z + Math.sin(angle) * radius;
      const y = plantedHeight(x, z);
      if (y === null) continue;
      if (!clearOf(spots, x, z, MIN_SPACING)) continue;
      const childHeight = height * (CHILD_HEIGHT_MIN + random() * (CHILD_HEIGHT_MAX - CHILD_HEIGHT_MIN));
      const childSpot = { x, y, z, height: childHeight, mother: false, clump: c };
      spots.push(childSpot);
      placed++;

      // One bush against the outside of its child: the side away from the mother, so
      // each clump's undergrowth faces out rather than filling the family's centre.
      // A ring point that lands on sand or inside another trunk is re-rolled.
      const outward = Math.atan2(z - mother.z, x - mother.x);
      for (let attemptBush = 0; attemptBush < 6; attemptBush++) {
        const bushAngle = outward + (bushRandom() - 0.5) * 1.1;
        const offset = BUSH_OFFSET_MIN + bushRandom() * (BUSH_OFFSET_MAX - BUSH_OFFSET_MIN);
        const bx = x + Math.cos(bushAngle) * offset;
        const bz = z + Math.sin(bushAngle) * offset;
        const by = plantedHeight(bx, bz);
        if (by === null) continue;
        if (!clearOfExcept(spots, childSpot, bx, bz, 0.72)) continue;
        bushSpots.push({ x: bx, y: by, z: bz, clump: c });
        break;
      }
    }

    clumps.push({ x: mother.x, z: mother.z, height, spread, children: placed });
  }

  return { spots, clumps, bushSpots };
}

export function createTrees({ scene, drop } = {}) {
  const random = makeRandom(SEED);
  // Bushes draw from their own stream so adding one to a clump can never nudge the
  // tree layout around: the forest stays exactly where it was.
  const bushRandom = makeRandom(SEED ^ 0x9e3779b9);
  const records = [];
  const bushes = [];
  // Everything the crosshair can raycast: tree bodies and bush meshes. Felled trees and
  // broken bushes are removed from this list.
  const targets = [];
  const raycaster = new THREE.Raycaster();
  const CENTRE = new THREE.Vector2(0, 0);
  const aimed = [null, null];

  const { spots, clumps, bushSpots } = scatterClumps(random, bushRandom);

  for (const spot of spots) {
    const { geometry, height: baseHeight, radius: baseRadius } = buildTreeGeometry(random, spot.mother);
    // Stretch the built tree to the height its place in the clump calls for. Scaling
    // the whole mesh also thins the children, which is what makes the hierarchy read.
    const stature = spot.height / baseHeight;

    // The pivot sits at the foot of the trunk; the fall rotates this whole pivot so
    // the tree tips over its own base instead of swinging around its middle.
    const pivot = new THREE.Group();
    pivot.position.set(spot.x, spot.y, spot.z);

    const body = new THREE.Mesh(geometry, TREE_MAT);
    body.castShadow = true;
    body.receiveShadow = true;
    body.rotation.y = random() * Math.PI * 2;
    body.scale.setScalar(stature);
    pivot.add(body);

    const outline = new THREE.Mesh(geometry, OUTLINE_MAT);
    outline.scale.setScalar(OUTLINE_PAD);
    outline.visible = false;
    body.add(outline);

    scene.add(pivot);

    const record = {
      index: records.length,
      kind: 'tree',
      name: spot.mother ? 'Mother tree' : 'Child tree',
      x: spot.x,
      y: spot.y,
      z: spot.z,
      height: spot.height,
      radius: baseRadius * stature,
      // Which clump this tree belongs to, and whether it is that clump's mother. The
      // regeneration pass will need both.
      clump: spot.clump,
      mother: spot.mother,
      health: PUNCHES_TO_FELL,
      maxHealth: PUNCHES_TO_FELL,
      // True once the trunk has finished falling. A stump is no longer a target; the
      // spot stays in the record for the regeneration pass that comes later.
      stump: false,
      felling: null,
      fallAxis: new THREE.Vector3(1, 0, 0),
      shake: 0,
      shakeTime: 0,
      mesh: pivot,
      body,
      outline,
      stumpMesh: new THREE.Mesh(STUMP_GEO, TREE_MAT),
    };

    record.stumpMesh.position.set(spot.x, spot.y, spot.z);
    record.stumpMesh.rotation.y = random() * Math.PI * 2;
    // A stump follows the trunk that stood there: broad under a mother, small under a
    // child, so the leftover marker keeps the scale of the tree it replaces.
    record.stumpMesh.scale.setScalar(Math.min(1.3, Math.max(0.5, record.radius / 0.3)));
    record.stumpMesh.castShadow = true;
    record.stumpMesh.receiveShadow = true;
    record.stumpMesh.visible = false;
    scene.add(record.stumpMesh);

    body.userData.tree = record;
    records.push(record);
    targets.push(body);
  }

  // One bush at the outward side of each child that found room for it.
  for (const spot of bushSpots) {
    const { geometry, radius } = buildBushGeometry(random);
    const mesh = new THREE.Mesh(geometry, TREE_MAT);
    mesh.position.set(spot.x, spot.y, spot.z);
    mesh.rotation.y = random() * Math.PI * 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const outline = new THREE.Mesh(geometry, OUTLINE_MAT);
    outline.scale.setScalar(OUTLINE_PAD);
    outline.visible = false;
    mesh.add(outline);

    const record = {
      index: bushes.length,
      kind: 'bush',
      name: 'Bush',
      x: spot.x,
      y: spot.y,
      z: spot.z,
      radius,
      clump: spot.clump,
      health: BUSH_HITS,
      maxHealth: BUSH_HITS,
      broken: false,
      shake: 0,
      shakeTime: 0,
      mesh,
      outline,
    };

    mesh.userData.bush = record;
    bushes.push(record);
    targets.push(mesh);
  }

  function refreshOutlines() {
    for (const record of records) {
      record.outline.visible = record === aimed[0] || record === aimed[1];
    }
    for (const record of bushes) {
      record.outline.visible = record === aimed[0] || record === aimed[1];
    }
  }

  function standing(record) {
    return !record.stump && !record.felling;
  }

  // The fall curve: gravity tips the trunk faster and faster, then it rocks once on
  // the ground before the stump and logs take over.
  function fallAngle(time) {
    if (time < FALL_TIME) {
      const k = Math.max(0, time) / FALL_TIME;
      return FALL_ANGLE * (k * k);
    }
    const settle = Math.min(time - FALL_TIME, FALL_SETTLE);
    return FALL_ANGLE - Math.sin(settle * 24) * 0.05 * Math.exp(-settle * 8);
  }

  // Can this target still be hit? Trees stand until they fall; bushes last until they
  // are cut out.
  function strikeable(record) {
    return record.kind === 'bush' ? !record.broken : standing(record);
  }

  // The direction the trunk falls comes from where the swing was made: away from the
  // player, so the crown drops on the far side of the stump rather than on top of them.
  function beginFall(record, player) {
    let dx = 0;
    let dz = 1;
    if (player) {
      dx = record.x - player.position.x;
      dz = record.z - player.position.z;
    }
    const length = Math.hypot(dx, dz) || 1;
    dx /= length;
    dz /= length;
    // The horizontal axis whose rotation tips +Y toward (dx, dz).
    record.fallAxis.set(dz, 0, -dx).normalize();
    record.felling = { time: 0 };
    record.mesh.rotation.set(0, 0, 0);
  }

  function finishFall(record) {
    record.felling = null;
    record.stump = true;
    record.mesh.visible = false;
    record.stumpMesh.visible = true;

    const at = targets.indexOf(record.body);
    if (at >= 0) targets.splice(at, 1);
    if (aimed[0] === record) aimed[0] = null;
    if (aimed[1] === record) aimed[1] = null;

    // The trunk comes apart into logs first. They can be broken down into sticks later;
    // a mother tree carries more timber than any one of her children.
    if (drop) {
      const logs = record.mother ? MOTHER_LOG_DROP : CHILD_LOG_DROP;
      for (let i = 0; i < logs; i++) {
        drop(
          'log',
          record.x + (Math.random() - 0.5) * 2.4,
          record.z + (Math.random() - 0.5) * 2.4,
          true
        );
      }
    }
  }

  // Cut out: the bush is gone and spills the fiber and sticks it was holding.
  function breakBush(record) {
    record.broken = true;
    record.mesh.visible = false;
    const at = targets.indexOf(record.mesh);
    if (at >= 0) targets.splice(at, 1);
    if (aimed[0] === record) aimed[0] = null;
    if (aimed[1] === record) aimed[1] = null;

    if (!drop) return;
    for (let i = 0; i < BUSH_DROP_FIBER; i++) {
      drop('fiber', record.x + (Math.random() - 0.5) * 1.3, record.z + (Math.random() - 0.5) * 1.3);
    }
    for (let i = 0; i < BUSH_DROP_STICK; i++) {
      drop('stick', record.x + (Math.random() - 0.5) * 1.3, record.z + (Math.random() - 0.5) * 1.3);
    }
  }

  return {
    // Merge the crosshair reading from the trees and bushes with the caller's own. Each
    // entry is the target's name and how far away it is, so the caller can pick whichever
    // target is closest between greenery and ground items. `inventories` lets the label
    // say when a bush needs an edged tool.
    aim(cameras, inventories) {
      const names = [null, null];
      const dist = [null, null];

      for (let i = 0; i < 2; i++) {
        // Last frame's reading doesn't carry over: looking at nothing has to let go of
        // the outline and the chop target as surely as looking at a stump does.
        aimed[i] = null;
        dist[i] = null;
        const camera = cameras[i];
        if (!camera) continue;
        raycaster.setFromCamera(CENTRE, camera);
        raycaster.far = REACH;
        const found = raycaster.intersectObjects(targets, true);
        if (!found.length) continue;

        // Take the closest thing that is still standing or still rooted. A falling tree
        // or an already-cut bush in front of a live target shouldn't steal the crosshair.
        let record = null;
        let hitDistance = 0;
        for (const hit of found) {
          let node = hit.object;
          while (node && !node.userData.tree && !node.userData.bush) node = node.parent;
          const candidate = node ? node.userData.tree || node.userData.bush : null;
          if (!candidate || !strikeable(candidate)) continue;
          record = candidate;
          hitDistance = hit.distance;
          break;
        }
        if (!record) continue;

        aimed[i] = record;
        dist[i] = hitDistance;

        const item = inventories && inventories[i] ? inventories[i].item : null;
        const edged = item && (item.id === 'simple_tool' || item.id === 'rugged_axe');
        // Names only: no remaining-hit counter on either. A bush still says when the
        // wrong thing is in hand, since that is a requirement rather than a tally.
        names[i] =
          record.kind === 'bush' && !edged ? `${record.name} · needs tool` : record.name;
      }

      refreshOutlines();
      return { names, dist };
    },

    // Drop one camera's reading, for when a ground item in front of the tree won the
    // crosshair. The next `aim` puts it all back.
    clearAim(index) {
      aimed[index] = null;
      refreshOutlines();
    },

    // The tree or bush player `index` is looking at, while it can still be hit. Any
    // swing can find bark; a bush ignores everything but an edged tool.
    chopTarget(index) {
      const record = aimed[index];
      if (!record || !strikeable(record)) return null;
      return record;
    },

    // One swing: trees shudder and lose health, and the last point starts a fall.
    // Bushes only give way to an edged tool: five simple-tool hits, or one axe hit,
    // and they spill their fiber and sticks. A fist (or any other item) leaves a
    // bush untouched.
    chop(index, player, inventory) {
      const record = aimed[index];
      if (!record || !strikeable(record)) return false;
      const item = inventory ? inventory.item : null;
      const simpleTool = item && item.id === 'simple_tool';
      const axe = item && item.id === 'rugged_axe';

      if (record.kind === 'bush') {
        if (!simpleTool && !axe) return false;
        record.health -= axe ? BUSH_HITS : 1;
        record.shake = 1;
        record.shakeTime = 0;
        if (record.health <= 0) breakBush(record);
        return true;
      }

      const damage = axe ? AXE_DAMAGE : simpleTool ? SIMPLE_TOOL_DAMAGE : 1;
      record.health -= damage;
      record.shake = 1;
      record.shakeTime = 0;
      if (record.health <= 0) beginFall(record, player);
      return true;
    },

    // Bodies a walking player cannot pass through. Stumps are low enough to step over,
    // and a tree in mid-fall still blocks until it is down.
    blocks(x, z) {
      for (const record of records) {
        if (record.stump) continue;
        const dx = x - record.x;
        const dz = z - record.z;
        const reach = record.radius + 0.32;
        if (dx * dx + dz * dz < reach * reach) return true;
      }
      return false;
    },

    update(dt) {
      for (const record of records) {
        if (record.felling) {
          record.felling.time += dt;
          record.mesh.quaternion.setFromAxisAngle(
            record.fallAxis,
            fallAngle(record.felling.time)
          );
          if (record.felling.time >= FALL_TIME + FALL_SETTLE) finishFall(record);
          continue;
        }

        if (record.shake > 0.002) {
          record.shakeTime += dt;
          record.shake *= Math.exp(-9 * dt);
          const amp = record.shake * 0.05;
          record.mesh.rotation.z = Math.sin(record.shakeTime * 38) * amp;
          record.mesh.rotation.x = Math.cos(record.shakeTime * 29) * amp * 0.6;
          if (record.shake <= 0.002) record.mesh.rotation.set(0, 0, 0);
        }
      }

      // Bushes rustle in the same rhythm when the tool bites into them. Their yaw is
      // part of the model, so only the lean axes are disturbed and cleared.
      for (const record of bushes) {
        if (record.broken || record.shake <= 0.002) continue;
        record.shakeTime += dt;
        record.shake *= Math.exp(-9 * dt);
        const amp = record.shake * 0.07;
        record.mesh.rotation.z = Math.sin(record.shakeTime * 41) * amp;
        record.mesh.rotation.x = Math.cos(record.shakeTime * 31) * amp * 0.7;
        if (record.shake <= 0.002) {
          record.mesh.rotation.x = 0;
          record.mesh.rotation.z = 0;
        }
      }
    },

    // Only the trees and bushes that differ from a fresh island need saving: the layout
    // itself is rebuilt from the seed, so a save stores just damage, stumps, cut bushes
    // and any fall caught in progress. The object shape replaces the old bare array of
    // tree entries; `fromJSON` still accepts that array so a save from before bushes
    // existed still loads.
    toJSON() {
      return {
        trees: records
          .filter(
            (record) => record.stump || record.felling || record.health < record.maxHealth
          )
          .map((record) => ({
            index: record.index,
            health: record.health,
            stump: record.stump,
            // A trunk caught mid-topple keeps its fall, so loading finishes the drop
            // rather than standing it back up on its stump.
            felling: record.felling ? record.felling.time : null,
            fall: record.felling
              ? [record.fallAxis.x, record.fallAxis.y, record.fallAxis.z]
              : null,
          })),
        bushes: bushes
          .filter((record) => record.broken || record.health < record.maxHealth)
          .map((record) => ({
            index: record.index,
            health: record.health,
            broken: record.broken,
          })),
      };
    },

    // Put the forest back the way a save left it: every trunk standing first, then the
    // felled ones laid back down as stumps and the cut bushes cleared away.
    fromJSON(state) {
      const treeList = Array.isArray(state) ? state : state ? state.trees : null;
      const bushList = !Array.isArray(state) && state ? state.bushes : null;

      for (const record of records) {
        record.health = record.maxHealth;
        record.stump = false;
        record.felling = null;
        record.shake = 0;
        record.mesh.visible = true;
        record.mesh.rotation.set(0, 0, 0);
        record.mesh.quaternion.identity();
        record.stumpMesh.visible = false;
      }
      for (const record of bushes) {
        record.health = record.maxHealth;
        record.broken = false;
        record.shake = 0;
        record.mesh.visible = true;
        record.mesh.rotation.x = 0;
        record.mesh.rotation.z = 0;
      }

      targets.length = 0;
      for (const record of records) targets.push(record.body);
      for (const record of bushes) targets.push(record.mesh);

      if (Array.isArray(treeList)) {
        for (const entry of treeList) {
          const record = records[entry.index];
          if (!record) continue;
          if (Number.isFinite(entry.health)) {
            record.health = THREE.MathUtils.clamp(entry.health, 0, record.maxHealth);
          }
          if (entry.stump) {
            record.stump = true;
            record.mesh.visible = false;
            record.stumpMesh.visible = true;
            const at = targets.indexOf(record.body);
            if (at >= 0) targets.splice(at, 1);
          } else if (Number.isFinite(entry.felling)) {
            // Pick the fall back up where the save left it. Without an axis it tips
            // the default way, which is still a tree coming down rather than standing.
            record.felling = { time: Math.max(0, entry.felling) };
            if (Array.isArray(entry.fall)) {
              record.fallAxis.set(entry.fall[0] || 0, entry.fall[1] || 0, entry.fall[2] || 0);
              if (record.fallAxis.lengthSq() < 1e-6) record.fallAxis.set(1, 0, 0);
              record.fallAxis.normalize();
            }
            record.mesh.quaternion.setFromAxisAngle(
              record.fallAxis,
              fallAngle(record.felling.time)
            );
          }
        }
      }

      if (Array.isArray(bushList)) {
        for (const entry of bushList) {
          const record = bushes[entry.index];
          if (!record) continue;
          if (Number.isFinite(entry.health)) {
            record.health = THREE.MathUtils.clamp(entry.health, 0, record.maxHealth);
          }
          if (entry.broken || record.health <= 0) {
            record.broken = true;
            record.mesh.visible = false;
            const at = targets.indexOf(record.mesh);
            if (at >= 0) targets.splice(at, 1);
          }
        }
      }
    },

    get count() {
      return records.length;
    },
    get stumps() {
      return records.filter((record) => record.stump).length;
    },
    get bushCount() {
      return bushes.length;
    },
    get cutBushes() {
      return bushes.filter((record) => record.broken).length;
    },
    // The clump layout (mother position, spread, how many children took root), kept
    // for debugging and for the regeneration pass.
    get clumps() {
      return clumps;
    },
    get bushRecords() {
      return bushes;
    },
    records,
  };
}
