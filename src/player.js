// A chunky avatar built from boxes, with turn-and-walk movement and a walk cycle.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { heightAt, isWalkable } from './island.js';
import {
  createBurnedFish,
  createCampfire,
  createCookedFish,
  createFishingRod,
  createFish,
  createKindling,
  createFiber,
  createLog,
  createRock,
  createRodBend,
  createRuggedAxe,
  createSimpleTool,
  createStick,
} from './items.js';

const TURN_SPEED = 2.9;
const WALK_SPEED = 6.6;
const BACK_SPEED = 3.6;
const WADE_SPEED = 0.6;
const SWIM_SPEED = 0.45;
// Past this terrain depth you stop wading and float, swimming instead.
const SWIM_DEPTH = -1.1;
// The waterline you settle at: walking into water clamps the feet here (chest deep)
// and swimming is capped here so you can't break the surface, but swimming down goes
// as deep as the seabed allows.
const FLOAT_Y = -1.05;
// How far above that anchor a body lying flat should float, which is just the depth of
// the anchor itself: the sea's mean surface is y = 0.
const FLOAT_LIFT = -FLOAT_Y;
const LOOK_SPEED = 1.5;
// Down goes all the way to the feet but stops one degree short of straight down:
// exactly vertical the view spins around its own axis, so -89 degrees reads as
// the feet without the roll.
const PITCH_MIN = -(89 * Math.PI) / 180;
const PITCH_MAX = 1.0;
const JUMP_SPEED = 5.2;
const GRAVITY = 18;
const SPRINT_MULT = 1.65;
// Three punches a second: the whole wind-up, hit and recovery is one third-second beat,
// so the animation itself is the rate limit.
const SWING_TIME = 1 / 3;
// Punch phases as fractions of the whole: cock back, drive out, hold, recover.
const SWING_WIND = 0.18;
const SWING_HIT = 0.42;
const SWING_HOLD = 0.55;
const IDLE_POSE = { out: 0, cock: 0 };

const easeOut = (t) => 1 - (1 - t) * (1 - t);
const smoothstep = (t) => t * t * (3 - 2 * t);

// One curve drives both the body arm and the first-person hand. `out` is the drive
// toward the target, `cock` is the wind-up that precedes it.
function poseFor(p) {
  if (p < SWING_WIND) return { out: 0, cock: easeOut(p / SWING_WIND) };
  if (p < SWING_HIT) {
    const k = (p - SWING_WIND) / (SWING_HIT - SWING_WIND);
    return { out: easeOut(k), cock: 1 - k };
  }
  if (p < SWING_HOLD) return { out: 1, cock: 0 };
  return { out: 1 - smoothstep((p - SWING_HOLD) / (1 - SWING_HOLD)), cock: 0 };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

function material(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function part(parent, mat, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(BOX, mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function createPlayer({ spawn, layer, shirt, pants, skin, hair, settings, surfaceAt, solidAt }) {
  const group = new THREE.Group();
  group.name = 'player';

  const body = new THREE.Group();
  group.add(body);

  const matShirt = material(shirt);
  const matPants = material(pants);
  const matSkin = material(skin);
  const matHair = material(hair);
  const matEye = material(PALETTE.eye);

  // Legs hang from a hip pivot so they can swing.
  const hips = new THREE.Group();
  hips.position.y = 0.68;
  body.add(hips);

  const legL = new THREE.Group();
  legL.position.x = -0.19;
  hips.add(legL);
  part(legL, matPants, 0.26, 0.68, 0.3, 0, -0.34, 0);

  const legR = new THREE.Group();
  legR.position.x = 0.19;
  hips.add(legR);
  part(legR, matPants, 0.26, 0.68, 0.3, 0, -0.34, 0);

  // Torso, belt, arms, head.
  part(body, matShirt, 0.78, 0.72, 0.46, 0, 1.06, 0);
  part(body, matPants, 0.8, 0.14, 0.48, 0, 0.74, 0);

  // A fist with a grip gap: the palm sits behind the gap and the four fingers curl over
  // its front, so held items at (0, -0.6, 0.025) are wrapped by the hand rather than
  // passing through a solid block.
  function buildArm(arm) {
    part(arm, matShirt, 0.26, 0.24, 0.28, 0, -0.08, 0);
    part(arm, matSkin, 0.22, 0.42, 0.24, 0, -0.29, 0);
    part(arm, matSkin, 0.22, 0.2, 0.07, 0, -0.6, -0.035);
    for (const y of [-0.52, -0.565, -0.61, -0.655]) {
      part(arm, matSkin, 0.22, 0.04, 0.07, 0, y, 0.085);
    }
  }

  const shoulderY = 1.32;
  const armL = new THREE.Group();
  armL.position.set(-0.5, shoulderY, 0);
  body.add(armL);
  buildArm(armL);

  const armR = new THREE.Group();
  armR.position.set(0.5, shoulderY, 0);
  body.add(armR);
  buildArm(armR);

  part(body, matSkin, 0.24, 0.14, 0.24, 0, 1.48, 0); // neck
  part(body, matSkin, 0.52, 0.48, 0.5, 0, 1.78, 0); // head
  part(body, matHair, 0.56, 0.16, 0.54, 0, 2.0, 0); // hair top
  part(body, matHair, 0.56, 0.3, 0.1, 0, 1.86, -0.23); // hair back
  part(body, matEye, 0.09, 0.1, 0.06, -0.13, 1.8, 0.26);
  part(body, matEye, 0.09, 0.1, 0.06, 0.13, 1.8, 0.26);

  // Held item, carried in the hand that reads as the owner's right: the avatar faces
  // +Z, so that is the -X arm. The rod's grip sits in the middle of the fist rather
  // than at the wrist, so the blank comes out of the hand and the reel hangs under it.
  const rodPivot = new THREE.Group();
  rodPivot.position.set(0, -0.6, 0.025);
  armL.add(rodPivot);
  const rod = createFishingRod();
  rodPivot.add(rod);
  rodPivot.visible = false;
  const rodTip = rod.getObjectByName('rodTip');
  const bendRod = createRodBend(rod);
  let heldItem = null;

  // The carried rod is aimed at the tip of the first-person rod and stretched to
  // reach it, so both players see the line start at the same point. The model's tip
  // sits on its own -Z axis, so aiming that axis at the target is the whole trick.
  const ROD_LENGTH = 1.14;
  const ROD_AXIS = new THREE.Vector3(0, 0, -1);
  const tipWorld = new THREE.Vector3();
  const pivotWorld = new THREE.Vector3();
  const rodDir = new THREE.Vector3();
  const rodQuat = new THREE.Quaternion();
  const bendWorld = new THREE.Vector3();
  const bendLocal = new THREE.Vector3();
  const bendQuat = new THREE.Quaternion();

  // Fish, carried in the other hand. Same trick as the rod: the model points -Z and
  // the avatar faces +Z, so the pivot turns it around with the head forward.
  const fishPivot = new THREE.Group();
  fishPivot.position.set(0, -0.6, 0.025);
  fishPivot.rotation.y = Math.PI;
  armR.add(fishPivot);
  const fish = createFish();
  fish.rotation.x = -0.25;
  fishPivot.add(fish);

  // The cooked version shares that hand: same grip, browned body.
  const cookedFish = createCookedFish();
  cookedFish.rotation.x = -0.25;
  cookedFish.visible = false;
  fishPivot.add(cookedFish);

  // The charred one shares the grip too, so a burnt fish is carried, not hidden.
  const burnedFish = createBurnedFish();
  burnedFish.rotation.x = -0.25;
  burnedFish.visible = false;
  fishPivot.add(burnedFish);
  fishPivot.visible = false;

  // A carried stick shares that same hand, gripped across the palm.
  const stickPivot = new THREE.Group();
  stickPivot.position.set(0, -0.6, 0.025);
  armR.add(stickPivot);
  const stick = createStick();
  stick.scale.setScalar(1.1);
  stick.rotation.set(0.2, 0.9, 0.4);
  stickPivot.add(stick);
  stickPivot.visible = false;

  // A carried log shares that same hand, heavy enough to lie across the palm rather
  // than hang from the fingers.
  const logPivot = new THREE.Group();
  logPivot.position.set(0, -0.6, 0.025);
  armR.add(logPivot);
  const log = createLog();
  log.scale.setScalar(0.8);
  log.rotation.set(0.1, 0.55, 0.15);
  logPivot.add(log);
  logPivot.visible = false;

  // A carried rock shares that same hand, cupped in the palm on its own pivot.
  // A carried bundle of fiber shares that same hand, on its own pivot like kindling.
  const fiberPivot = new THREE.Group();
  fiberPivot.position.set(0, -0.6, 0.025);
  armR.add(fiberPivot);
  const fiber = createFiber();
  fiber.rotation.set(0.2, 0.5, 0.3);
  fiberPivot.add(fiber);
  fiberPivot.visible = false;

  // A carried rugged axe shares that same hand: upright on its own pivot, head up
  // and tipped forward. The swing pitches the whole arm forward, so the upright
  // head sweeps down through the arc edge-first.
  const ruggedAxePivot = new THREE.Group();
  ruggedAxePivot.position.set(0, -0.6, 0.025);
  armR.add(ruggedAxePivot);
  const ruggedAxe = createRuggedAxe();
  ruggedAxe.scale.setScalar(0.8);
  ruggedAxe.rotation.set(-Math.PI / 2 + 0.7, 0, 0.15);
  ruggedAxePivot.add(ruggedAxe);
  ruggedAxePivot.visible = false;

  const rockPivot = new THREE.Group();
  rockPivot.position.set(0, -0.6, 0.025);
  armR.add(rockPivot);
  const rock = createRock();
  rock.scale.setScalar(0.7);
  rockPivot.add(rock);
  rockPivot.visible = false;

  // A carried simple tool shares that same hand, held upright with the stone end
  // up and tipped forward, the way a held blade faces out.
  const simpleToolPivot = new THREE.Group();
  simpleToolPivot.position.set(0, -0.6, 0.025);
  armR.add(simpleToolPivot);
  const simpleTool = createSimpleTool();
  simpleTool.scale.setScalar(0.7);
  simpleTool.rotation.set(-Math.PI / 2 + 0.7, 0, 0.15);
  simpleToolPivot.add(simpleTool);
  simpleToolPivot.visible = false;

  // Kindling and a carried campfire share that same hand, each on its own pivot.
  const kindlingPivot = new THREE.Group();
  kindlingPivot.position.set(0, -0.6, 0.025);
  armR.add(kindlingPivot);
  const kindling = createKindling();
  kindling.rotation.set(0.2, 0.5, 0.3);
  kindlingPivot.add(kindling);
  kindlingPivot.visible = false;

  const campfirePivot = new THREE.Group();
  campfirePivot.position.set(0, -0.6, 0.025);
  armR.add(campfirePivot);
  const campfire = createCampfire();
  campfire.scale.setScalar(0.5);
  campfirePivot.add(campfire);
  campfirePivot.visible = false;

  // The body keeps its own render layer so the owner's first-person camera can
  // leave it out while the other player still sees it.
  group.traverse((object) => {
    if (object.isMesh) object.layers.set(layer);
  });

  const pos = group.position;
  let yaw = spawn.yaw;
  pos.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
  group.rotation.y = yaw;

  let stride = 0;
  let moving = false;
  let pitch = -0.055;
  let vy = 0;
  let grounded = true;
  let sprinting = false;
  let sprintActive = false;
  let swingTime = -1;
  // True only on the frame a new punch actually starts, so the caller can hang an
  // effect (a tree taking damage, a stamina cost) off the swing rather than the press.
  let swingStarted = false;
  // True only on the frame the fist reaches the target, partway through the swing.
  // Strikes land then, so the shake or damage matches the arm rather than the trigger.
  let swingHit = false;
  // How much of the swim stroke is showing, and how far through the stroke we are.
  let swimBlend = 0;
  let stroke = 0;

  // Land you can stand on: walkable terrain that isn't taken up by a trunk. Axis
  // fallbacks let a body slide along a tree instead of stopping dead against it.
  function free(x, z) {
    return isWalkable(x, z) && (!solidAt || !solidAt(x, z));
  }

  function tryMove(dx, dz) {
    const nx = pos.x + dx;
    const nz = pos.z + dz;
    if (free(nx, nz)) {
      pos.x = nx;
      pos.z = nz;
    } else if (free(nx, pos.z)) {
      pos.x = nx;
    } else if (free(pos.x, nz)) {
      pos.z = nz;
    }
  }

  // canSprint arrives from the hunger meter: starving legs can't sprint, whatever
  // the hands are doing. True by default so a caller without hunger still runs.
  function update(dt, controls, canSprint = true) {
    swingStarted = false;
    swingHit = false;
    const turn = THREE.MathUtils.clamp(controls.turn || 0, -1, 1);
    const move = THREE.MathUtils.clamp(controls.move || 0, -1, 1);
    const lookY = THREE.MathUtils.clamp(controls.lookY || 0, -1, 1);

    // Mouse look arrives already scaled to the frame, so it is added on rather than
    // multiplied by dt the way the stick rate is.
    yaw += turn * TURN_SPEED * dt + (controls.yawDelta || 0);
    pitch = THREE.MathUtils.clamp(
      pitch + lookY * LOOK_SPEED * dt + (controls.pitchDelta || 0),
      PITCH_MIN,
      PITCH_MAX
    );
    group.rotation.y = yaw;

    if (settings && settings.sprintMode === 'toggle') {
      if (controls.sprintToggle) sprinting = !sprinting;
    } else {
      // Default: hold L3 down to sprint.
      sprinting = !!controls.sprintHeld;
    }

    // Right trigger starts a swing. It runs once through and can't be re-triggered
    // until it finishes, which caps punches at three a second.
    // RT throws a punch with a bare hand; with the rod it charges a cast instead.
    if (controls.usePressed && swingTime < 0 && heldItem !== 'fishing_rod') {
      swingTime = 0;
      swingStarted = true;
    }

    const ground = heightAt(pos.x, pos.z);
    // Water is enterable: wade where you can still touch the bottom, swim where you
    // cannot, and move slower in both. Swimming also cancels sprint.
    const swimming = ground < SWIM_DEPTH;
    const wading = !swimming && ground < -0.25;
    const waterSpeed = swimming ? SWIM_SPEED : wading ? WADE_SPEED : 1;
    // Sprint only carries you forward; backing up stays deliberate. And an empty
    // belly walks: at zero hunger the multiplier never applies.
    const sprint = sprinting && canSprint && move > 0.05 && !swimming ? SPRINT_MULT : 1;
    sprintActive = sprint > 1;
    const speed = (move >= 0 ? WALK_SPEED : BACK_SPEED) * waterSpeed * sprint;
    const step = move * speed * dt;

    if (step !== 0) {
      // Swimming follows where you look: looking down shortens the horizontal travel
      // and the rest of the step goes into depth.
      const reach = swimming ? Math.cos(pitch) : 1;
      tryMove(Math.sin(yaw) * step * reach, Math.cos(yaw) * step * reach);
    }

    const groundY = Math.max(heightAt(pos.x, pos.z), FLOAT_Y);

    if (swimming) {
      // Diving: swimming forward with the view pitched down takes you under, and
      // pitching up brings you back. No buoyancy — you hold whatever depth you swim
      // to, so stopping mid-water just hangs you there until you swim again.
      pos.y += Math.sin(pitch) * step;
      const seabed = heightAt(pos.x, pos.z) + 0.35;
      pos.y = Math.min(Math.max(pos.y, seabed), FLOAT_Y);
      vy = 0;
      grounded = true;
    } else if (controls.jumpPressed && grounded) {
      // Take off from the surface itself. While running the ground follow lags a
      // fraction below the terrain, which used to trip the landing check on the
      // very next frame and cancel the jump.
      pos.y = groundY;
      vy = JUMP_SPEED;
      grounded = false;
    }

    if (swimming) {
      // The swim block above already placed pos.y for this frame.
    } else if (grounded) {
      // Walk the ground smoothly so step-ups don't snap.
      pos.y += (groundY - pos.y) * (1 - Math.exp(-16 * dt));
    } else {
      vy -= GRAVITY * dt;
      pos.y += vy * dt;
      // Only land on the way down, never during the rising part of the arc.
      if (vy <= 0 && pos.y <= groundY) {
        pos.y = groundY;
        vy = 0;
        grounded = true;
      }
    }

    // Walk cycle: swing when moving, settle to a stand when idle.
    stride += Math.abs(step) * 1.7;
    moving = Math.abs(move) > 0.05;
    const swing = Math.sin(stride) * Math.min(Math.abs(move), 1) * 0.62;

    // Once the swim stroke is showing it owns the body's height, so the walk bob stays
    // out of it — left in, it pulls the floating body back down every frame.
    if (moving) {
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.75;
      armR.rotation.x = swing * 0.75;
      if (swimBlend < 0.01) body.position.y = Math.abs(Math.sin(stride)) * 0.05;
    } else {
      const k = 1 - Math.exp(-14 * dt);
      legL.rotation.x += -legL.rotation.x * k;
      legR.rotation.x += -legR.rotation.x * k;
      armL.rotation.x += -armL.rotation.x * k;
      armR.rotation.x += -armR.rotation.x * k;
      if (swimBlend < 0.01) body.position.y += -body.position.y * k;
    }

    // Swimming takes over from the walk cycle: arms reach out front and pull back
    // together, legs flutter underneath, and the body rolls and bobs on the water it
    // is pushing. The blend eases, so stepping off the beach doesn't snap into a
    // stroke, and the stroke speeds up the harder you swim.
    swimBlend += ((swimming ? 1 : 0) - swimBlend) * (1 - Math.exp(-6 * dt));
    if (swimBlend > 0.002) {
      const effort = 0.55 + Math.min(Math.abs(move), 1) * 0.45;
      stroke += dt * (1.7 + effort * 2.4);

      const reach = Math.sin(stroke);
      const scull = Math.cos(stroke);
      const kick = Math.sin(stroke * 1.35 + Math.PI * 0.5);
      const k = (1 - Math.exp(-14 * dt)) * swimBlend;

      armL.rotation.x += (-1.35 + reach * 0.7 - armL.rotation.x) * k;
      armR.rotation.x += (-1.35 + reach * 0.7 - armR.rotation.x) * k;
      armL.rotation.z += (-0.25 - scull * 0.3 - armL.rotation.z) * k;
      armR.rotation.z += (0.25 + scull * 0.3 - armR.rotation.z) * k;

      legL.rotation.x += (kick * 0.55 - legL.rotation.x) * k;
      legR.rotation.x += (-kick * 0.55 - legR.rotation.x) * k;

      body.rotation.z += (scull * 0.12 - body.rotation.z) * k;

      // Lying flat: the body tips forward around the feet until it is level with the
      // water, head first and legs trailing. The view pitch folds in on top, so
      // looking down tips the head under and looking up brings it back out.
      const lay = Math.PI / 2 - 0.15 - pitch * 0.9;
      body.rotation.x += (lay - body.rotation.x) * k;
      // Flat, the body reaches out ahead of the swimmer, so it is pulled back to sit
      // centred on the position.
      body.position.z += (-1 - body.position.z) * k;
      // Float height: the body lies centred on the sea itself, so it rises and falls
      // with the swell you can see rather than on a fixed line under it. Only while
      // the swimmer is up at the surface — under it the pose holds its height above
      // the swimmer, so diving isn't hauled back up.
      const atSurface = pos.y >= FLOAT_Y - 0.02;
      const swell = atSurface && surfaceAt ? surfaceAt(pos.x, pos.z) : 0;
      const floatY = FLOAT_LIFT + 0.08 + swell + reach * 0.04;
      body.position.y += (floatY - body.position.y) * k;
    } else {
      // Out of the water the stroke-only angles relax back to nothing.
      const k = 1 - Math.exp(-14 * dt);
      armL.rotation.z += -armL.rotation.z * k;
      armR.rotation.z += -armR.rotation.z * k;
      body.rotation.z += -body.rotation.z * k;
      body.rotation.x += -body.rotation.x * k;
      body.position.z += -body.position.z * k;
    }

    // The swimmer's posture is carried by the body itself, which lies flat, so the
    // group stays upright and only eases off any tilt left from an earlier swim.
    group.rotation.x += -group.rotation.x * (1 - Math.exp(-8 * dt));

    // Swing timer runs to completion; the crewmate sees it as a punch.
    if (swingTime >= 0) {
      const before = swingTime;
      swingTime += dt;
      // Cross the impact point of the animation: this is the one frame the strike
      // lands, whether that is a tree or anything else the fist is aimed at.
      if (before < SWING_TIME * SWING_HIT && swingTime >= SWING_TIME * SWING_HIT) {
        swingHit = true;
      }
      const { out } = poseFor(Math.min(swingTime / SWING_TIME, 1));
      armR.rotation.x = -1.65 * out;
      armR.rotation.z = -0.22 * out;
      // A hair of slack so accumulation error at 60 fps doesn't cost a whole extra
      // frame before the next punch can start.
      if (swingTime >= SWING_TIME - 0.0001) swingTime = -1;
    }
  }

  // Stop a punch where it is and put the arm back down, for death or a panel opening
  // partway through the swing.
  function cancelSwing() {
    swingTime = -1;
    swingStarted = false;
    swingHit = false;
    armR.rotation.x = 0;
    armR.rotation.z = 0;
  }

  // Back to the spot this player started the game on, standing and idle.
  function respawn() {
    pos.set(spawn.x, heightAt(spawn.x, spawn.z), spawn.z);
    yaw = spawn.yaw;
    pitch = -0.055;
    vy = 0;
    grounded = true;
    stride = 0;
    swingTime = -1;
    // A toggle-mode sprint doesn't survive death: coming back starts at a walk.
    sprinting = false;
    sprintActive = false;
    swimBlend = 0;
    stroke = 0;
    legL.rotation.set(0, 0, 0);
    legR.rotation.set(0, 0, 0);
    armL.rotation.set(0, 0, 0);
    armR.rotation.set(0, 0, 0);
    body.position.y = 0;
    body.position.z = 0;
    body.rotation.set(0, 0, 0);
    group.rotation.set(0, yaw, 0);
  }

  // Back where a save left this body: position, facing and look angle, standing still.
  function restore(state) {
    // Guarded one axis at a time: a save missing a coordinate keeps the live one
    // rather than putting the body at NaN.
    if (Number.isFinite(state.x)) pos.x = state.x;
    if (Number.isFinite(state.y)) pos.y = state.y;
    if (Number.isFinite(state.z)) pos.z = state.z;
    if (Number.isFinite(state.yaw)) yaw = state.yaw;
    if (Number.isFinite(state.pitch)) pitch = state.pitch;
    vy = 0;
    grounded = true;
    group.rotation.set(0, yaw, 0);
  }

  // Only the rod is modelled so far; anything else falls back to the bare hand.
  function setItem(id) {
    heldItem = id;
    rodPivot.visible = id === 'fishing_rod';
    fishPivot.visible = id === 'fish' || id === 'cooked_fish' || id === 'burned_fish';
    fish.visible = id === 'fish';
    cookedFish.visible = id === 'cooked_fish';
    burnedFish.visible = id === 'burned_fish';
    stickPivot.visible = id === 'stick';
    logPivot.visible = id === 'log';
    fiberPivot.visible = id === 'fiber';
    ruggedAxePivot.visible = id === 'rugged_axe';
    rockPivot.visible = id === 'rock';
    simpleToolPivot.visible = id === 'simple_tool';
    kindlingPivot.visible = id === 'kindling';
    campfirePivot.visible = id === 'campfire';
  }

  // World position of the rod's tip.
  function rodTipPosition(target) {
    rodTip.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(rodTip.matrixWorld);
  }

  // Aim the carried rod at another holder's tip (the first-person one) and scale it
  // to reach, so the tip lands exactly where the owner sees their rod end.
  function alignHeld(source) {
    if (!rodPivot.visible) return;
    source.rodTipPosition(tipWorld);
    rodPivot.updateWorldMatrix(true, false);
    rodPivot.getWorldPosition(pivotWorld);
    rodDir.copy(tipWorld).sub(pivotWorld);
    const length = rodDir.length();
    if (length < 0.01) return;
    rodDir.divideScalar(length);
    rodPivot.parent.getWorldQuaternion(rodQuat).invert();
    rodDir.applyQuaternion(rodQuat);
    rodPivot.quaternion.setFromUnitVectors(ROD_AXIS, rodDir);
    rod.scale.setScalar(length / ROD_LENGTH);

    // Match the owner's cast bend. The first-person rod reports the world direction
    // its blank is bending toward; convert that into this rod's local frame, drop the
    // component along the blank, and bend in whatever is left.
    const bend = source.castBend ?? 0;
    if (Math.abs(bend) > 0.0002) {
      source.rodBendDirection(bendWorld);
      rod.getWorldQuaternion(bendQuat).invert();
      bendLocal.copy(bendWorld).applyQuaternion(bendQuat);
      bendLocal.z = 0;
      if (bendLocal.lengthSq() < 1e-6) bendLocal.set(0, 1, 0);
      bendRod(bend, bendLocal.x, bendLocal.y);
    } else {
      bendRod(0);
    }
  }

  return {
    group,
    update,
    respawn,
    cancelSwing,
    restore,
    setItem,
    rodTipPosition,
    alignHeld,
    position: pos,
    get yaw() {
      return yaw;
    },
    get gait() {
      return stride;
    },
    // Stroke phase, in radians, for the first-person hand to pull along with.
    get stroke() {
      return stroke;
    },
    get moving() {
      return moving;
    },
    get grounded() {
      return grounded;
    },
    get swimming() {
      return heightAt(pos.x, pos.z) < SWIM_DEPTH;
    },
    get sprinting() {
      return sprinting;
    },
    // True only while the sprint multiplier is actually applied: moving forward on
    // land. Holding the sprint button still, backing up, or swimming doesn't count.
    get sprintActive() {
      return sprintActive;
    },
    get swingPose() {
      return swingTime < 0 ? IDLE_POSE : poseFor(Math.min(swingTime / SWING_TIME, 1));
    },
    // True for exactly the frame a new punch begins. Effects that belong to the swing
    // (tree damage, stamina) use this instead of the raw press, so mashing faster than
    // the animation cannot punch or chop faster than two a second.
    get swingStarted() {
      return swingStarted;
    },
    // True on the frame the punch connects, for effects tied to the impact.
    get swingHit() {
      return swingHit;
    },
    get pitch() {
      return pitch;
    },
    get held() {
      return heldItem;
    },
  };
}
