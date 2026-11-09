// The sea: a radial flat-shaded disc with per-vertex waves. The rings are dense
// around the island so short waves can roll in to the beach, then spread out again
// for the open water. Normals are left to the flat-shading shader.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { ISLAND_RADIUS } from './island.js';

const RADIUS = 600;
const ANGULAR = 160;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Radial rings: sparse under the island, fine through the shallows, then growing
// spacing out to the horizon. The fine band is what makes a shore wave visible.
function ringRadii() {
  const radii = [];
  for (let r = 0.75; r < 50; r += 6) radii.push(r);
  for (let r = 50; r <= 120; r += 1.75) radii.push(r);
  const outer = 26;
  for (let i = 1; i <= outer; i++) {
    radii.push(120 + (RADIUS - 120) * (i / outer) ** 1.7);
  }
  return radii;
}

export function createOcean() {
  const radii = ringRadii();
  const rings = radii.length;
  const count = rings * ANGULAR;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseX = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const baseR = new Float32Array(count);
  const baseAngle = new Float32Array(count);
  const swellAmp = new Float32Array(count);
  const shoreAmp = new Float32Array(count);

  const shallow = new THREE.Color(PALETTE.waterShallow);
  const deep = new THREE.Color(PALETTE.waterDeep);
  const foamColor = new THREE.Color(0xf6ffff);
  const color = new THREE.Color();

  for (let i = 0; i < rings; i++) {
    const r = radii[i];
    const d = r / ISLAND_RADIUS;
    // Swell builds past the swimmable water rather than inside it, so a floating
    // player is never dunked by a wave they can reach.
    const amp = 0.28 + clamp01((d - 1.55) / 2.2) * 1.05;
    color.copy(shallow).lerp(deep, clamp01((d - 1) / 2.4));

    for (let j = 0; j < ANGULAR; j++) {
      const angle = (j / ANGULAR) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const index = i * ANGULAR + j;

      baseX[index] = x;
      baseZ[index] = z;
      baseR[index] = r;
      baseAngle[index] = angle;
      swellAmp[index] = amp;
      shoreAmp[index] = shoreAmplitudeAt(r);

      positions[index * 3] = x;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = z;

      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
  }

  const indices = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < ANGULAR; j++) {
      const next = (j + 1) % ANGULAR;
      const a = i * ANGULAR + j;
      const b = i * ANGULAR + next;
      const c = (i + 1) * ANGULAR + j;
      const d = (i + 1) * ANGULAR + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  const baseColors = colors.slice();

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    // Two-sided so the surface still exists when you are under it, looking up.
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'ocean';
  mesh.renderOrder = 2;

  let time = 0;

  // The broad offshore swell.
  function swellHeight(x, z, t, a) {
    return (
      a *
      (Math.sin(x * 0.055 + t * 1.1) * 0.6 +
        Math.sin(z * 0.082 - t * 0.85) * 0.5 +
        Math.sin((x + z) * 0.038 + t * 1.6) * 0.45)
    );
  }

  // Wave height in the shallows: crests travel inward (phase grows as r grows), and
  // the angular wobble keeps them from reading as perfect circles. The amplitude
  // fades out before the open sea and again under the beach.
  function shoreAmplitudeAt(r) {
    return smoothstep(52, 66, r) * (1 - smoothstep(78, 118, r)) * 0.5;
  }

  function shoreHeightAt(r, angle, t, amp) {
    if (amp <= 0) return 0;
    const phase =
      r * 0.44 +
      t * 1.32 +
      Math.sin(angle * 5 + t * 0.21) * 0.9 +
      Math.sin(angle * 3 - t * 0.17) * 1.2;
    return amp * (Math.sin(phase) * 0.8 + Math.sin(phase * 2 + 1.3) * 0.15);
  }

  function shoreHeight(x, z, t) {
    const r = Math.hypot(x, z);
    return shoreHeightAt(r, Math.atan2(z, x), t, shoreAmplitudeAt(r));
  }

  // The surface height at a point and a moment, shared with the vertex update so
  // anything floating on the sea sits on the same waves you can see.
  function waveHeight(x, z, t, a) {
    return swellHeight(x, z, t, a) + shoreHeight(x, z, t);
  }

  function amplitudeAt(x, z) {
    const d = Math.hypot(x, z) / ISLAND_RADIUS;
    return 0.28 + clamp01((d - 1.55) / 2.2) * 1.05;
  }

  function heightAt(x, z) {
    return waveHeight(x, z, time, amplitudeAt(x, z));
  }

  function update(dt) {
    time += dt;
    const pos = geo.attributes.position;
    const colorAttr = geo.attributes.color;
    for (let i = 0; i < count; i++) {
      const swell = swellHeight(baseX[i], baseZ[i], time, swellAmp[i]);
      // Only the shore rings carry the short wave; skip its trig elsewhere.
      const shore = shoreAmp[i] > 0 ? shoreHeightAt(baseR[i], baseAngle[i], time, shoreAmp[i]) : 0;
      pos.setY(i, swell + shore);

      if (shoreAmp[i] > 0) {
        // A pale crest on the shore waves: at a shallow camera angle the foam line
        // reads as a wave far better than the height change alone. The slow angular
        // modulation breaks the crest into patches instead of one clean ring.
        const crest = shore / shoreAmp[i];
        const patches = 0.75 + 0.25 * Math.sin(baseAngle[i] * 11 + time * 0.45);
        const foam = smoothstep(0.45, 0.85, crest) * 0.72 * patches;
        if (foam > 0.002) {
          color
            .setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2])
            .lerp(foamColor, foam);
          colorAttr.setXYZ(i, color.r, color.g, color.b);
        } else {
          colorAttr.setXYZ(i, baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
        }
      }
    }
    pos.needsUpdate = true;
    colorAttr.needsUpdate = true;
  }

  update(0);

  return { mesh, update, heightAt };
}
