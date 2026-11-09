// The sea: one big flat-shaded plane with per-vertex waves, calm in the lagoon,
// livelier out at sea. Normals are left to the flat-shading shader.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { ISLAND_RADIUS } from './island.js';

const SIZE = 1200;
const SEGMENTS = 76;

export function createOcean() {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const count = pos.count;
  const baseX = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const amplitude = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const shallow = new THREE.Color(PALETTE.waterShallow);
  const deep = new THREE.Color(PALETTE.waterDeep);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const d = Math.hypot(x, z) / ISLAND_RADIUS;

    baseX[i] = x;
    baseZ[i] = z;
    // Swell builds past the swimmable water rather than inside it, so a floating
    // player is never dunked by a wave they can reach.
    amplitude[i] = 0.28 + Math.min(Math.max((d - 1.55) / 2.2, 0), 1) * 1.05;


    color.copy(shallow).lerp(deep, Math.min(Math.max((d - 1) / 2.4, 0), 1));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

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

  // The surface height at a point and a moment, shared with the vertex update so
  // anything floating on the sea sits on the same waves you can see.
  function waveHeight(x, z, t, a) {
    return (
      a *
      (Math.sin(x * 0.055 + t * 1.1) * 0.6 +
        Math.sin(z * 0.082 - t * 0.85) * 0.5 +
        Math.sin((x + z) * 0.038 + t * 1.6) * 0.45)
    );
  }

  function amplitudeAt(x, z) {
    const d = Math.hypot(x, z) / ISLAND_RADIUS;
    return 0.28 + Math.min(Math.max((d - 1.55) / 2.2, 0), 1) * 1.05;
  }

  function heightAt(x, z) {
    return waveHeight(x, z, time, amplitudeAt(x, z));
  }

  function update(dt) {
    time += dt;
    for (let i = 0; i < count; i++) {
      pos.setY(i, waveHeight(baseX[i], baseZ[i], time, amplitude[i]));
    }
    pos.needsUpdate = true;
  }

  update(0);

  return { mesh, update, heightAt };
}
