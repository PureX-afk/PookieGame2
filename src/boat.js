// A little rowboat drifting offshore. It rides the same swell the sea uses, so it sits
// on the water rather than near it, and turns as it goes slowly round the island.
import * as THREE from 'three';

const BOX = new THREE.BoxGeometry(1, 1, 1);

function material(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

const MATS = {
  hull: material(0x8a5a34),
  hullDark: material(0x5d3c22),
  trim: material(0xc9a678),
  oar: material(0x9c6b3f),
};

export function createBoat({ ocean }) {
  const group = new THREE.Group();
  group.name = 'rowboat';

  function box(mat, w, h, d, x, y, z, ry = 0) {
    const mesh = new THREE.Mesh(BOX, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  // Shallow hull: a floor plank, two long sides and two ends turned in at an angle.
  box(MATS.hull, 2.1, 0.12, 0.78, 0, 0.06, 0);
  box(MATS.hullDark, 2.1, 0.34, 0.09, 0, 0.24, 0.36);
  box(MATS.hullDark, 2.1, 0.34, 0.09, 0, 0.24, -0.36);
  box(MATS.hull, 0.14, 0.34, 0.78, 1.02, 0.24, 0, 0.5);
  box(MATS.hull, 0.14, 0.34, 0.78, -1.02, 0.24, 0, -0.5);

  // Gunnel trim round the rim and a bench across the middle.
  box(MATS.trim, 2.2, 0.06, 0.11, 0, 0.42, 0.36);
  box(MATS.trim, 2.2, 0.06, 0.11, 0, 0.42, -0.36);
  box(MATS.trim, 0.7, 0.07, 0.74, 0.15, 0.26, 0);

  // A pair of oars laid across the boat.
  box(MATS.oar, 1.9, 0.06, 0.06, 0, 0.46, 0.16, 0.14);
  box(MATS.oar, 1.9, 0.06, 0.06, 0, 0.46, -0.12, -0.1);

  // Well out from the beach, drifting slowly round the island.
  let angle = 2.9;
  let time = 0;
  const radius = 84;

  function update(dt) {
    time += dt;
    angle += dt * 0.012;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const swell = ocean.heightAt(x, z);
    group.position.set(x, swell + 0.1 + Math.sin(time * 0.9) * 0.035, z);

    // The long axis points along the way it is heading, then it leans with the swell.
    group.rotation.y = -(angle + Math.PI / 2);
    group.rotation.z = Math.sin(time * 1.3) * 0.05;
    group.rotation.x = Math.sin(time * 1.1 + 1) * 0.035;
  }

  update(0);

  return { group, update };
}
