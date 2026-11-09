// First-person camera: sits at the player's eyes, rigid to their yaw so turning
// feels direct, with a walk bob and a little idle breathing. It can also lean in on a
// point — used while a player works on a campfire — by stepping in along the line from
// their eyes to that point and narrowing the view.
import * as THREE from 'three';

const EYE_HEIGHT = 1.72;
const FOV = 66;
const FOCUS_FOV = 44;
// How far in front of the focus point the camera settles, and how high.
const FOCUS_DISTANCE = 1.5;
const FOCUS_HEIGHT = 0.85;
const FOCUS_AIM_Y = 0.28;
const FOCUS_EASE = 8; // per second

export function createCameraRig(player) {
  const camera = new THREE.PerspectiveCamera(FOV, 0.5, 0.1, 4000);
  const target = new THREE.Vector3();
  const normalPos = new THREE.Vector3();
  const normalTarget = new THREE.Vector3();
  const focusPos = new THREE.Vector3();
  const focusTarget = new THREE.Vector3();
  const focusPoint = new THREE.Vector3();
  const toward = new THREE.Vector3();
  let moveBlend = 0;
  let airBlend = 0;
  let time = 0;
  let focused = false;
  let focusBlend = 0;

  function update(dt) {
    time += dt;
    moveBlend += ((player.moving ? 1 : 0) - moveBlend) * (1 - Math.exp(-9 * dt));
    // Footfall bob belongs on the ground; fade it out in the air so a running
    // jump reads as one clean arc instead of shaking.
    airBlend += ((player.grounded ? 0 : 1) - airBlend) * (1 - Math.exp(-14 * dt));

    const bob = Math.abs(Math.sin(player.gait)) * 0.045 * moveBlend * (1 - airBlend);
    const breathe = Math.sin(time * 1.6) * 0.006 * (1 - moveBlend);

    const p = player.position;
    const yaw = player.yaw;
    const eye = p.y + EYE_HEIGHT + bob + breathe;
    // Pitch comes from the right stick; it defaults to a hair down so the ground reads.
    const level = Math.cos(player.pitch);

    normalPos.set(p.x, eye, p.z);
    normalTarget.set(
      p.x + Math.sin(yaw) * level * 10,
      eye + Math.sin(player.pitch) * 10,
      p.z + Math.cos(yaw) * level * 10
    );

    focusBlend += ((focused ? 1 : 0) - focusBlend) * (1 - Math.exp(-FOCUS_EASE * dt));

    let fov = FOV;
    if (focusBlend > 0.001) {
      // Straight in from the player's side of the fire, so the flames stay between
      // them and the ground rather than being looked at from underneath.
      toward.copy(normalPos).sub(focusPoint);
      toward.y = 0;
      if (toward.lengthSq() < 0.0001) toward.set(Math.sin(yaw), 0, Math.cos(yaw));
      toward.normalize();

      focusPos.copy(focusPoint).addScaledVector(toward, FOCUS_DISTANCE);
      focusPos.y = focusPoint.y + FOCUS_HEIGHT;
      focusTarget.copy(focusPoint);
      focusTarget.y += FOCUS_AIM_Y;

      camera.position.lerpVectors(normalPos, focusPos, focusBlend);
      target.lerpVectors(normalTarget, focusTarget, focusBlend);
      fov = FOV + (FOCUS_FOV - FOV) * focusBlend;
    } else {
      camera.position.copy(normalPos);
      target.copy(normalTarget);
    }

    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target);
  }

  update(0);

  return {
    camera,
    update,
    // Lean in on a world point; clearFocus eases back out to the eyes.
    setFocus(point) {
      focusPoint.copy(point);
      focused = true;
    },
    clearFocus() {
      focused = false;
    },
    get isFocused() {
      return focused;
    },
  };
}
