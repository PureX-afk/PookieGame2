// The island: an analytic height field used both for the mesh and for walking on it.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const ISLAND_RADIUS = 70;

// How deep the water can get before you are turned back. The floor now shelves down
// well past the island, so this sits far out at roughly 145 units from the centre —
// open water you can actually dive into, still inside the seabed mesh.
export const SWIM_DEPTH_LIMIT = -11;

function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = ease(x - ix);
  const fz = ease(z - iz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fz;
}

function fbm(x, z) {
  return (
    valueNoise(x, z) * 0.6 +
    valueNoise(x * 2.07 + 13.5, z * 2.07 + 7.1) * 0.28 +
    valueNoise(x * 4.3 - 5.2, z * 4.3 + 19.7) * 0.12
  );
}

// Fine procedural grain, drawn once to a canvas and tiled over the ground. It is
// near-white so it multiplies the vertex colours instead of replacing them: sand
// gains a speckled surface while grass keeps its own hue.
function createSandGrain() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7f7f5';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3200; i++) {
    const x = Math.floor(hash2(i, 17) * size);
    const y = Math.floor(hash2(i, 91) * size);
    const shade = hash2(i, 41);
    // Mostly darker grit, with the odd bright fleck of shell.
    const tone = shade < 0.7 ? 198 + shade * 46 : 252;
    ctx.fillStyle = `rgb(${tone | 0},${(tone - 3) | 0},${(tone - 9) | 0})`;
    const wide = hash2(i, 7) > 0.88 ? 2 : 1;
    ctx.fillRect(x, y, wide, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(34, 34);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  return texture;
}

// Pebbles, grit and the odd small rock strewn across the sand, all in a single
// instanced draw call. They are placed only on the beach band, which is where the
// eye spends its time, and sunk slightly so they sit in the surface.
const PEBBLE_GEO = new THREE.IcosahedronGeometry(1, 0);

function createBeachLitter() {
  const count = 420;
  const mesh = new THREE.InstancedMesh(
    PEBBLE_GEO,
    new THREE.MeshLambertMaterial({ flatShading: true }),
    count
  );
  mesh.name = 'beach-litter';

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();
  const sand = new THREE.Color(PALETTE.sand);
  const sandWet = new THREE.Color(PALETTE.sandWet);
  const rock = new THREE.Color(PALETTE.rock);

  let placed = 0;
  for (let i = 0; i < 12000 && placed < count; i++) {
    const angle = hash2(i, 3) * Math.PI * 2;
    const radius = Math.sqrt(hash2(i, 11)) * ISLAND_RADIUS * 1.08;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const h = heightAt(x, z);
    // Sand only: above the waterline, below where the grass takes over.
    if (h < 0.2 || h > 2.4) continue;

    const rarity = hash2(i, 29);
    const size = rarity > 0.94 ? 0.16 + hash2(i, 31) * 0.16 : 0.045 + hash2(i, 37) * 0.075;

    euler.set(hash2(i, 43) * 0.6, hash2(i, 47) * Math.PI, hash2(i, 53) * 0.6);
    quaternion.setFromEuler(euler);
    scale.set(size, size * (0.5 + hash2(i, 59) * 0.3), size * (0.8 + hash2(i, 61) * 0.4));
    position.set(x, h - size * 0.3, z);

    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(placed, matrix);

    const pick = hash2(i, 67);
    if (pick < 0.58) color.copy(sand).multiplyScalar(0.78 + hash2(i, 71) * 0.2);
    else if (pick < 0.82) color.copy(sandWet).multiplyScalar(0.9 + hash2(i, 73) * 0.25);
    else if (pick < 0.94) color.copy(rock).multiplyScalar(0.9 + hash2(i, 79) * 0.2);
    else color.setRGB(0.97, 0.96, 0.92); // shell fleck
    mesh.setColorAt(placed, color);

    placed++;
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// Three crossed, tapered blades — the cheapest thing that reads as tall tropical
// grass at ground level. Non-indexed so flat shading gives each blade a facet.
function createTuftGeometry() {
  // Five blades, each at its own angle, height, width and lean, so a single
  // instance already reads as a small tuft rather than a flat cross.
  const blades = [
    { angle: 0.0, height: 0.5, lean: 0.14, width: 0.05 },
    { angle: 1.19, height: 0.36, lean: 0.22, width: 0.042 },
    { angle: 2.31, height: 0.44, lean: -0.18, width: 0.046 },
    { angle: 3.42, height: 0.29, lean: 0.1, width: 0.036 },
    { angle: 4.51, height: 0.47, lean: -0.24, width: 0.044 },
  ];
  const positions = [];

  for (const blade of blades) {
    const cos = Math.cos(blade.angle);
    const sin = Math.sin(blade.angle);
    const halfWidth = blade.width / 2;
    const tipWidth = blade.width * 0.28;
    const quad = [
      [-halfWidth, 0, 0],
      [halfWidth, 0, 0],
      [blade.lean + tipWidth, blade.height, 0],
      [-halfWidth, 0, 0],
      [blade.lean + tipWidth, blade.height, 0],
      [blade.lean - tipWidth, blade.height * 0.98, 0],
    ];
    for (const [x, y, z] of quad) {
      positions.push(x * cos - z * sin, y, x * sin + z * cos);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function createGrassTufts() {
  const count = 1400;
  const mesh = new THREE.InstancedMesh(
    createTuftGeometry(),
    new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide }),
    count
  );
  mesh.name = 'grass-tufts';

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const color = new THREE.Color();

  const axis = new THREE.Vector3(0, 1, 0);

  let placed = 0;
  for (let seed = 0; seed < 3000 && placed < count; seed++) {
    // Clump centres are rejection-sampled on the grass band, and a broad noise mask
    // leaves bare ground between them, so the grass grows in areas instead of as one
    // even carpet. Height is a property of the clump, then varied per tuft.
    const angle = hash2(seed, 201) * Math.PI * 2;
    const radius = Math.sqrt(hash2(seed, 203)) * ISLAND_RADIUS * 1.02;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    const ch = heightAt(cx, cz);
    if (ch < 3 || ch > 6.6) continue;
    if (fbm(cx * 0.035 + 21.5, cz * 0.035 - 9.1) < 0.42) continue;

    const clumpCount = 4 + Math.floor(hash2(seed, 211) * 13); // 4..16 tufts
    const clumpScale = 0.85 + hash2(seed, 223) * 0.6; // this clump's bulk
    const spread = 0.6 + hash2(seed, 227) * 1.7; // and how far it spreads

    for (let k = 0; k < clumpCount && placed < count; k++) {
      const t = seed * 977 + k * 131;
      const a = hash2(t, 229) * Math.PI * 2;
      const r = Math.sqrt(hash2(t, 233)) * spread;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const h = heightAt(x, z);
      // Keep clear of the sand and of the rocky crown.
      if (h < 2.95 || h > 6.7) continue;

      // About one tuft in seven stands well proud of its clump.
      const tall = hash2(t, 239) > 0.86 ? 1.55 + hash2(t, 241) * 0.35 : 1;
      const width = clumpScale * (0.8 + hash2(t, 251) * 0.5);
      const height = clumpScale * (0.6 + hash2(t, 253) * 0.55) * tall;

      quaternion.setFromAxisAngle(axis, hash2(t, 257) * Math.PI * 2);
      scale.set(width, height, width);
      position.set(x, h - 0.02, z);

      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(placed, matrix);

      color.copy(C_GRASS).lerp(C_GRASS_LUSH, hash2(t, 263));
      color.multiplyScalar(0.88 + hash2(t, 269) * 0.2);
      mesh.setColorAt(placed, color);

      placed++;
    }
  }

  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

// Height in world units. Sea level is y = 0.
export function heightAt(x, z) {
  const u =
    Math.hypot(x, z) / ISLAND_RADIUS +
    (fbm(x * 0.013 + 3.1, z * 0.013 - 7.4) - 0.5) * 0.34;

  // A low, broad island: the crown barely rises and the slope down to the beach is
  // long, so the steepest ground is around 11 degrees instead of nearly 30.
  let h;
  if (u < 0.42) {
    h = 7 - 1.9 * (u / 0.42) ** 2; // grassy crown, gently domed
  } else if (u < 0.8) {
    const k = (u - 0.42) / 0.38;
    h = 5.1 - 3.6 * ease(k); // long easy slope down to the beach
  } else if (u < 1.02) {
    const k = (u - 0.8) / 0.22;
    h = 1.5 - 2.2 * k; // beach
  } else {
    const k = Math.min((u - 1.02) / 0.55, 1);
    // Seabed, then a long outer shelf that keeps dropping past the island so the open
    // water is genuinely deep rather than a shallow pan with a wall around it.
    h = -0.7 - 8.2 * k - 6 * Math.max(0, u - 1.57);
  }

  // Rolling detail, faded out towards the water so the beach stays smooth.
  const land = Math.max(0, 1 - Math.max(u - 0.5, 0) / 0.5);
  h += (fbm(x * 0.045, z * 0.045) - 0.5) * 1.8 * land;
  h += (valueNoise(x * 0.21 + 41.3, z * 0.21 - 17.9) - 0.5) * 0.5 * land;
  return h;
}

export function isWalkable(x, z) {
  return heightAt(x, z) > SWIM_DEPTH_LIMIT;
}

const C_SAND = new THREE.Color(PALETTE.sand);
const C_SAND_WET = new THREE.Color(PALETTE.sandWet);
const C_GRASS = new THREE.Color(PALETTE.grass);
const C_GRASS_LUSH = new THREE.Color(PALETTE.grassLush);
const C_GRASS_DARK = new THREE.Color(PALETTE.grassDark);
const C_ROCK = new THREE.Color(PALETTE.rock);

function colorAt(h, x, z, out) {
  const n = valueNoise(x * 0.26, z * 0.26);

  if (h < 0.5) out.copy(C_SAND_WET);
  else if (h < 2.2) out.copy(C_SAND);
  else if (h < 3.2) out.copy(C_SAND).lerp(C_GRASS, (h - 2.2) / 1.0);
  else if (h < 6.4) {
    // Two scales of green: broad sunlit clumps, then fine mottling on top, so the
    // turf reads as lush and patchy rather than one flat shade.
    const patch = fbm(x * 0.055 + 8.2, z * 0.055 - 3.7);
    out.copy(C_GRASS).lerp(C_GRASS_LUSH, THREE.MathUtils.clamp((patch - 0.42) * 2.4, 0, 1));
    out.lerp(C_GRASS_DARK, THREE.MathUtils.clamp(n * 0.6 + (0.55 - patch) * 0.9, 0, 1));
  }
  else if (h < 7.6) out.copy(C_GRASS_DARK).lerp(C_ROCK, (h - 6.4) / 1.2);
  else out.copy(C_ROCK);

  // A touch of per-vertex variation keeps flat facets from banding.
  out.multiplyScalar(0.93 + n * 0.14);
}

export function createIsland() {
  const size = 360;
  const segments = 130;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    colorAt(h, x, z, color);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    map: createSandGrain(),
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'island';
  mesh.receiveShadow = true;
  mesh.add(createBeachLitter(), createGrassTufts());
  return mesh;
}
