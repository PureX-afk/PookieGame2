// First-person hand: a low-poly fist parented to the camera, anchored to the lower
// right of that camera's viewport whatever the split gives it.
import * as THREE from 'three';
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

const BOX = new THREE.BoxGeometry(1, 1, 1);

// Eating turns the palm toward the player: the grip's fingers point up and its forearm
// hangs down, while the palm — and the food sitting in it — faces the camera. Built as
// Rx(-90°)·Ry(180°), which is exactly local x → -x, y → -z, z → -y.
const EAT_PALM = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, Math.PI, 0)
);

// Where the food sits for each pose. Carried, it points off down the view as before.
// Eaten, it lies across the open palm — belly down against the hand, head to one side
// — so the palm is what the player is looking at, food in it.
const FOOD_CARRY_POS = new THREE.Vector3(0.01, -0.1, 0);
const FOOD_CARRY_ROT = new THREE.Euler(-0.15, 0.5, 0.12);
const FOOD_PALM_POS = new THREE.Vector3(0, -0.05, -0.05);
const FOOD_PALM_ROT = new THREE.Euler(0, Math.PI / 2, 0);
const FOOD_PALM_QUAT = new THREE.Quaternion().setFromEuler(FOOD_PALM_ROT);
const FOOD_CARRY_QUAT = new THREE.Quaternion().setFromEuler(FOOD_CARRY_ROT);

function material(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

// A model is built around its own idea of an origin, which is rarely the point the
// hand grips. Measuring the bounding box and shifting every part by it puts the pivot
// on the handle: centred in x/y and sitting at the grip end (the +z end, where the
// butt cap is) so rotation swings the blank, not the hand.
function anchorPivotToHandle(model) {
  const bounds = new THREE.Box3().setFromObject(model);
  const handlePivot = new THREE.Vector3(
    (bounds.min.x + bounds.max.x) / 2,
    (bounds.min.y + bounds.max.y) / 2,
    bounds.max.z
  );
  for (const part of model.children) {
    part.position.sub(handlePivot);
  }
  return handlePivot;
}

export function createViewModel({ camera, scene, shirt, cuff, skin, layer }) {
  const group = new THREE.Group();
  group.name = 'viewmodel';

  const matSkin = material(skin);

  function piece(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(BOX, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  }

  // The whole arm is one big block, running from the grip back out of the view.
  const arm = piece(group, matSkin, 0.17, 0.17, 0.64, 0.02, -0.06, 0.19, 0.3);


  group.scale.setScalar(0.85);

  // Held item sitting in the fist. The pivot is moved onto the handle first, then the
  // rod is scaled and tucked in with small offsets — the geometry itself is untouched.
  const rod = createFishingRod();
  anchorPivotToHandle(rod);
  rod.scale.setScalar(0.72);

  // Small translation into the lower-right of the view, just in front of the camera.
  const fishingRodLocalPosition = new THREE.Vector3(0.4, 0.18, -0.03);
  // Subtle angles only: a slight roll blend, a touch of inward lean, and a roll that
  // cancels the hand group's quarter turn so the reel hangs under the blank. Because
  // the rod is rolled ~90°, its Y term is what pitches the tip toward the sky, while
  // the X term only swings it sideways.
  const fishingRodLocalRotation = new THREE.Euler(0.18, 0.72, Math.PI / 2 - 0.08);

  // Cast animation. The pose above is the holding rest; charging winds the tip up and
  // back, releasing whips it forward past the rest angle and lets it settle. Because
  // of the ~90° roll, the rod's Y term is the pitch axis, so the offsets ride on Y.
  const CAST_WIND_MIN = 0.35; // wind-up even for a tap cast
  const CAST_WIND_GAIN = 0.65; // extra wind-up at full power
  const CAST_SNAP = 0.3; // fraction of the release spent snapping forward
  const CAST_FORWARD = -0.55; // overshoot past the rest angle
  const CAST_WHIP_TIME = 0.5; // seconds from release back to rest
  const CAST_BEND_MAX = 0.09; // tip deflection as a fraction of the rod's reach
  let castCharging = false;
  let castPower = 0;
  let castBlend = 0; // + = wound up, negative = snapped forward
  let castRelease = 0; // wind-up held when the trigger was let go
  let castWhip = -1; // -1 idle, otherwise seconds into the release
  let castPrevBlend = 0;
  let castBend = 0;

  // Catching minigame: the rod loads up while the fight runs and tugs with the trigger.
  let catchActive = false;
  let catchHeld = false;
  let catchBlend = 0;
  let catchPull = 0;
  let catchTugTime = 0;

  rod.position.copy(fishingRodLocalPosition);
  rod.rotation.copy(fishingRodLocalRotation);
  rod.visible = false;
  group.add(rod);
  const rodTip = rod.getObjectByName('rodTip');

  // Bend rig. Captured after the handle pivot shift, so the curve runs from the grip
  // and the tip marker bends with the blank — casts and the line start at the real tip.
  const bendRod = createRodBend(rod);

  // The fish sits in the same fist, held across the palm with its head away.
  const fish = createFish();
  fish.scale.setScalar(1.0);
  fish.position.set(0.01, 0.05, -0.03);
  fish.rotation.set(-0.15, 0.5, 0.12);
  fish.visible = false;
  group.add(fish);

  // The grilled one is the same grip, browned. Both sit in the fist, one at a time.
  const cookedFish = createCookedFish();
  cookedFish.scale.setScalar(1.0);
  cookedFish.position.copy(fish.position);
  cookedFish.rotation.copy(fish.rotation);
  cookedFish.visible = false;
  group.add(cookedFish);

  // And the charred one, held the same way: what too many burnt turns leaves behind.
  const burnedFish = createBurnedFish();
  burnedFish.scale.setScalar(1.0);
  burnedFish.position.copy(fish.position);
  burnedFish.rotation.copy(fish.rotation);
  burnedFish.visible = false;
  group.add(burnedFish);

  // A stick gripped near its middle, running off past the knuckles both ways.
  const stick = createStick();
  stick.scale.setScalar(1.5);
  stick.position.set(-0.02, -0.1, 0.02);
  stick.rotation.set(0.28, 0.9, 0.5);
  stick.visible = false;
  group.add(stick);

  // A log cradled across the palm, its cut end toward the camera.
  const log = createLog();
  log.scale.setScalar(1.1);
  log.position.set(0.01, -0.1, -0.01);
  log.rotation.set(0.12, 0.5, 0.1);
  log.visible = false;
  group.add(log);

  // A rock cupped in the fist, tipped the way a thrown stone sits in the hand.
  const rock = createRock();
  rock.scale.setScalar(1.0);
  rock.position.set(-0.01, -0.1, 0.03);
  rock.rotation.set(0.3, 0.5, 0.2);
  rock.visible = false;
  group.add(rock);

  // Kindling held like a small torch, and a campfire carried by its rim — scaled down
  // hard, since it is a ring of stones rather than something you grip.
  const kindling = createKindling();
  kindling.scale.setScalar(1.4);
  kindling.position.set(0.01, -0.1, 0.01);
  kindling.rotation.set(0.35, 0.5, 0.15);
  kindling.visible = false;
  group.add(kindling);

  // The simple tool gripped upright by its handle: the stone end stands up out of
  // the fist and tips out past the knuckles, the way a held blade does.
  const simpleTool = createSimpleTool();
  simpleTool.scale.setScalar(1.4);
  simpleTool.position.set(-0.02, -0.13, 0.01);
  simpleTool.rotation.set(-0.2, -1.27, 0.1);
  simpleTool.visible = false;
  group.add(simpleTool);

  // Fiber resting down in the palm cup, lying along the curled fingers like a small
  // torch — low enough that the bundle sits in the hand instead of floating above it.
  const fiber = createFiber();
  fiber.scale.setScalar(1.4);
  fiber.position.set(0.01, -0.09, 0.02);
  fiber.rotation.set(0.15, 0.25, 0.08);
  fiber.visible = false;
  group.add(fiber);

  // The rugged axe gripped upright by its haft, stone head standing up out of the
  // fist and tipped out past the knuckles. The punch drives the whole hand at the
  // target, so the upright head is what leads — a chop, not a poke.
  const ruggedAxe = createRuggedAxe();
  ruggedAxe.scale.setScalar(1.35);
  ruggedAxe.position.set(-0.02, -0.15, 0.01);
  ruggedAxe.rotation.set(-0.2, -1.27, 0.1);
  ruggedAxe.visible = false;
  group.add(ruggedAxe);

  const campfire = createCampfire();
  campfire.scale.setScalar(0.5);
  campfire.position.set(-0.01, -0.1, -0.06);
  campfire.rotation.set(1.1, 0.3, 0);
  campfire.visible = false;
  group.add(campfire);

  // Crumbs: a flying fistful of voxels that falls away from the mouth with each bite.
  // They are spawned in world space rather than camera space so gravity applies
  // honestly — a crumb drops toward the ground no matter where the player looks — and
  // anyone standing near sees the bits of fish rain down too.
  const CRUMB_GEO = new THREE.BoxGeometry(1, 1, 1);
  const CRUMB_MATS = {
    fish: material(0xf3ddb4),
    cooked_fish: material(0xd9a565),
    burned_fish: material(0x50423a),
  };
  const crumbPool = [];
  let crumbColour = CRUMB_MATS.fish;

  group.traverse((object) => {
    if (object.isMesh) {
      object.layers.set(layer);
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = false;
    }
  });

  camera.add(group);

  const GRAVITY_CRUMB = 5.5;
  const CRUMB_LIFE = 1.1;
  // Crumbs are released at the start of each of the three bites across the hold, so
  // the eating reads as three separate mouthfuls rather than a shower.
  const BITE_SPOTS = [0.06, 0.38, 0.7];

  // Where the food currently in the fist sits in the world, or null between holds.
  function itemWorld(target) {
    const held = fish.visible ? fish : cookedFish.visible ? cookedFish : burnedFish.visible ? burnedFish : null;
    if (!held) return null;
    held.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(held.matrixWorld);
  }

  const crumbAt = new THREE.Vector3();

  function spawnCrumb() {
    if (!itemWorld(crumbAt)) return;
    const mesh = new THREE.Mesh(CRUMB_GEO, crumbColour);
    const size = 0.016 + Math.random() * 0.016;
    mesh.scale.setScalar(size);
    mesh.position.set(
      crumbAt.x + (Math.random() - 0.5) * 0.06,
      crumbAt.y - 0.04 + (Math.random() - 0.5) * 0.03,
      crumbAt.z + (Math.random() - 0.5) * 0.06
    );
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(mesh);
    crumbPool.push({
      mesh,
      ttl: CRUMB_LIFE,
      vel: new THREE.Vector3(
        0.08 + Math.random() * 0.16,
        0.05 + Math.random() * 0.14,
        0.06 + Math.random() * 0.18
      ),
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9,
        (Math.random() - 0.5) * 9
      ),
    });
  }

  function setCrumbStage(id) {
    crumbColour = CRUMB_MATS[id] ?? CRUMB_MATS.fish;
  }

  function updateCrumbs(dt) {
    for (let i = crumbPool.length - 1; i >= 0; i--) {
      const crumb = crumbPool[i];
      crumb.ttl -= dt;
      if (crumb.ttl <= 0) {
        scene.remove(crumb.mesh);
        crumbPool.splice(i, 1);
        continue;
      }
      crumb.vel.y -= GRAVITY_CRUMB * dt;
      crumb.mesh.position.addScaledVector(crumb.vel, dt);
      crumb.mesh.rotation.x += crumb.spin.x * dt;
      crumb.mesh.rotation.y += crumb.spin.y * dt;
      // Shrinking to nothing over the tail of the life, so crumbs vanish into the
      // ground instead of winking out mid-air.
      const fade = Math.min(1, crumb.ttl / (CRUMB_LIFE * 0.45));
      crumb.mesh.scale.setScalar(0.016 * fade + 0.01 * Math.min(1, crumb.ttl));
    }
  }

  let time = 0;
  let moveBlend = 0;
  let strokeBlend = 0;
  // Eating: how far into the one-second hold the player is (0..1) and how much of the
  // fist-to-mouth motion is showing. The blend eases so a trigger let go early stops
  // mid-bite and sinks back instead of snapping.
  let eatProgress = 0;
  let eatBlend = 0;
  let holdingItem = false;
  // Which of the three bite marks across the hold have dropped crumbs already.
  let eatSpawn = 0;
  // Scratch quaternion for blending the carry grip into the palm-to-face turn.
  const carryQuat = new THREE.Quaternion();

  function setEating(progress) {
    eatProgress = Math.max(0, Math.min(1, progress));
  }

  // Fishing rod cast. Charging feeds the power bar in; releasing starts the whip and
  // cancelling (switching items, dying) drops whatever pose is showing.
  function chargeCast(power) {
    castCharging = true;
    castPower = Math.max(0, Math.min(1, power));
  }

  function releaseCast() {
    if (!castCharging) return;
    castCharging = false;
    castRelease = castBlend;
    castWhip = 0;
  }

  function cancelCast() {
    castCharging = false;
    castPower = 0;
    castWhip = -1;
  }

  // Fishing's catching minigame runs the rod's tug: active while the fight is on,
  // held while the trigger is down (the pull that lifts the bar).
  function setCatch(active, held) {
    if (active && !catchActive) catchTugTime = 0;
    catchActive = active;
    catchHeld = active && held;
  }

  function update(dt, player) {
    time += dt;
    moveBlend += ((player.moving ? 1 : 0) - moveBlend) * (1 - Math.exp(-9 * dt));

    // Hold the hand a fixed fraction of the way into the corner for any aspect.
    // Narrow split-screen halves would otherwise blow it up, so shrink with width.
    const depth = 0.9;
    const halfHeight = Math.tan((camera.fov * Math.PI) / 360) * depth;
    const halfWidth = halfHeight * camera.aspect;
    const sizeScale = Math.min(1, Math.max(0.5, camera.aspect / 0.85));

    const swingY = Math.sin(player.gait) * 0.02 * moveBlend;
    const swingX = Math.cos(player.gait * 0.5) * 0.015 * moveBlend;
    const breathe = Math.sin(time * 1.5) * 0.006 * (1 - moveBlend);

    group.scale.setScalar(0.85 * sizeScale);
    group.position.set(
      halfWidth * 0.66 + swingX,
      -halfHeight * 0.64 + swingY + breathe,
      -depth
    );
    group.rotation.set(0.05, 0.28, 0.04 - Math.PI / 2);

    // Swimming: the fist hauls water, reaching forward on the catch and pulling back
    // as the body rolls. It runs off the same stroke phase as the avatar's arms, so a
    // crewmate watching sees the arm and the fist work together.
    strokeBlend += ((player.swimming ? 1 : 0) - strokeBlend) * (1 - Math.exp(-6 * dt));
    if (strokeBlend > 0.002) {
      const s = Math.sin(player.stroke ?? 0);
      const c = Math.cos(player.stroke ?? 0);
      group.position.z -= (0.2 + 0.12 * s) * strokeBlend;
      group.position.x -= 0.07 * halfWidth * c * strokeBlend;
      group.position.y += (0.05 + 0.11 * s) * halfHeight * strokeBlend;
      group.rotation.x += (0.3 + 0.45 * s) * strokeBlend;
      group.rotation.z += 0.3 * c * strokeBlend;
    }

    // Punch: cock back a little, then drive the fist at the aim point and let it
    // settle. The forward travel does the work — the hand grows as it comes at the
    // target, which reads as a punch instead of a slide. Sideways drift is kept
    // small on purpose, so it never looks like the arm is jerking across the view.
    const pose = player.swingPose ?? { out: 0, cock: 0 };
    if (pose.out > 0 || pose.cock > 0) {
      const { out, cock } = pose;

      group.position.z -= 0.33 * out;
      group.position.z += 0.07 * cock;
      group.position.x -= 0.26 * halfWidth * out;
      group.position.x += 0.10 * halfWidth * cock;
      group.position.y += 0.20 * halfHeight * out;
      group.position.y -= 0.05 * halfHeight * cock;

      // Knuckles turn to face the target and the wrist straightens out.
      group.rotation.x += -0.26 * out + 0.42 * cock;
      group.rotation.y += -0.26 * out + 0.26 * cock;
      group.rotation.z += -0.05 * out + 0.10 * cock;
    }

    // Casting: draw the rod up and back with the power bar, then whip it forward on
    // release. The snap overshoots the rest angle and pushes the grip out, so the
    // throw reads from the rod alone even though the hand itself barely moves.
    if (castWhip >= 0) {
      castWhip += dt;
      const u = Math.min(castWhip / CAST_WHIP_TIME, 1);
      if (u < CAST_SNAP) {
        const k = u / CAST_SNAP;
        const ease = 1 - (1 - k) * (1 - k);
        castBlend = THREE.MathUtils.lerp(castRelease, CAST_FORWARD, ease);
      } else {
        const k = (u - CAST_SNAP) / (1 - CAST_SNAP);
        castBlend = THREE.MathUtils.lerp(CAST_FORWARD, 0, k * k * (3 - 2 * k));
      }
      if (u >= 1) {
        castWhip = -1;
        castBlend = 0;
      }
    } else if (castCharging) {
      const target = CAST_WIND_MIN + CAST_WIND_GAIN * castPower;
      castBlend += (target - castBlend) * (1 - Math.exp(-14 * dt));
    } else {
      castBlend += (0 - castBlend) * (1 - Math.exp(-10 * dt));
    }

    // Catching: the line stays loaded while the minigame runs, and each pull on the
    // trigger yanks the rod. The press eases in and out so the rod swells into the
    // pull rather than snapping, and each tug is a smooth bell rather than a step.
    catchBlend += ((catchActive ? 1 : 0) - catchBlend) * (1 - Math.exp(-8 * dt));
    catchPull += ((catchHeld ? 1 : 0) - catchPull) * (1 - Math.exp(-6 * dt));
    let catchTug = 0;
    if (catchBlend > 0.002) {
      catchTugTime += dt;
      const tugPhase = (catchTugTime * 2.4) % 1;
      const pulse = Math.sin(Math.PI * tugPhase) ** 2;
      const tremble = catchPull * Math.sin(catchTugTime * 42) * 0.03;
      catchTug = catchBlend * (0.12 + catchPull * (0.35 + 0.65 * pulse) + tremble);
    }

    const castSnap = Math.min(1, Math.max(0, castBlend / CAST_FORWARD));
    rod.rotation.set(
      fishingRodLocalRotation.x + 0.08 * castBlend + 0.04 * catchTug,
      fishingRodLocalRotation.y + 0.55 * castBlend - 0.3 * catchTug,
      fishingRodLocalRotation.z
    );
    rod.position.copy(fishingRodLocalPosition);
    rod.position.x += 0.05 * castBlend;
    rod.position.z -= 0.16 * castSnap;
    rod.position.z += 0.05 * catchTug;
    rod.position.y -= 0.02 * catchTug;

    // The tip lags the pose: it droops while the rod winds up, whips back as the cast
    // snaps forward, and settles straight. Driven by the pose's angular speed plus a
    // little preload while the power bar is held.
    const castVel = dt > 0 ? (castBlend - castPrevBlend) / dt : 0;
    castPrevBlend = castBlend;
    const preload = castCharging ? -0.037 * castPower : 0;
    const bendTarget = Math.max(
      -CAST_BEND_MAX,
      Math.min(CAST_BEND_MAX, preload - castVel * 0.01)
    );
    castBend += (bendTarget - castBend) * (1 - Math.exp(-18 * dt));
    bendRod(castBend - 0.04 * catchTug);

    // Eating: the fist and its food ride all the way up into the face, filling around
    // two-thirds of the view for the whole hold. It eases toward a mouth anchor in
    // camera space rather than nudging the carry pose, so the item stays in the hand
    // and stays on screen until the bite clock runs out — the food is only put away in
    // main.js once the full second is up. A small chew tightens the grip.
    arm.visible = !holdingItem || eatProgress > 0;
    const wasEating = eatBlend > 0.002 && eatProgress > 0;
    eatBlend += ((eatProgress > 0 ? 1 : 0) - eatBlend) * (1 - Math.exp(-10 * dt));

    // The food moves with the pose: carried loosely in the fist while idle, lying
    // across the open palm while eating. All three stages share the transform, so the
    // one that is visible is the one that moves.
    for (const food of [fish, cookedFish, burnedFish]) {
      food.position.lerpVectors(FOOD_CARRY_POS, FOOD_PALM_POS, eatBlend);
      food.quaternion.slerpQuaternions(FOOD_CARRY_QUAT, FOOD_PALM_QUAT, eatBlend);
    }

    if (eatBlend > 0.002) {
      const squeeze = Math.sin(eatProgress * Math.PI * 3);
      // Mouth: just under the eye line, centred, and held off the lens far enough that
      // the palm and its fish take up a little under half the screen.
      group.position.x = THREE.MathUtils.lerp(group.position.x, 0.02 * halfWidth, eatBlend);
      group.position.y = THREE.MathUtils.lerp(group.position.y, -0.05 * halfHeight, eatBlend);
      group.position.z = THREE.MathUtils.lerp(group.position.z, -0.42, eatBlend);
      // The palm is what faces the player, not the back of the wrist: the grip turns
      // until the fingers point up and the forearm hangs down out of the bottom of the
      // view, leaving the open palm and the fish toward the eye.
      carryQuat.copy(group.quaternion);
      group.quaternion.slerpQuaternions(carryQuat, EAT_PALM, eatBlend);
      // The small chew rides on top, working the wrist rather than the whole arm.
      group.rotateX(0.05 * squeeze * squeeze * eatBlend);
      group.rotateZ(0.03 * squeeze * eatBlend);
      // Swelling as it comes in: the same palm reads much larger at arm's length from
      // the lens. ~45% of the view, not the whole face.
      group.scale.setScalar(0.85 * sizeScale * (1 + 0.35 * eatBlend));

      // A crumb pinch at the start of each bite, so the three mouthfuls are each
      // marked by something falling away from the mouth.
      let spot = 0;
      while (spot < BITE_SPOTS.length && eatProgress >= BITE_SPOTS[spot]) spot++;
      if (!wasEating) spot = 0;
      while (eatSpawn < spot) {
        spawnCrumb();
        spawnCrumb();
        eatSpawn++;
      }
    } else {
      eatSpawn = 0;
    }
    updateCrumbs(dt);
  }

  function setItem(id) {
    // The bare arm only shows with nothing in hand, or while eating brings food to the
    // mouth; anything held otherwise replaces it.
    holdingItem = !!id;
    rod.visible = id === 'fishing_rod';
    fish.visible = id === 'fish';
    cookedFish.visible = id === 'cooked_fish';
    burnedFish.visible = id === 'burned_fish';
    stick.visible = id === 'stick';
    log.visible = id === 'log';
    rock.visible = id === 'rock';
    fiber.visible = id === 'fiber';
    ruggedAxe.visible = id === 'rugged_axe';
    simpleTool.visible = id === 'simple_tool';
    kindling.visible = id === 'kindling';
    campfire.visible = id === 'campfire';
    // Crumb colour follows the food stage, so a burned fish sheds dark crumbs.
    setCrumbStage(id);
  }

  // World position of the rod the player can actually see, so a cast leaves from the
  // rod in their hand instead of from the body's rod off to one side.
  function rodTipPosition(target) {
    rodTip.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(rodTip.matrixWorld);
  }

  // World direction the blank bends toward (the rod's local +Y), so the carried body
  // rod can bend in the same plane while the owner casts.
  function rodBendDirection(target) {
    rod.updateWorldMatrix(true, false);
    return target.set(0, 1, 0).transformDirection(rod.matrixWorld);
  }

  update(0, { moving: false, gait: 0, swingPose: { out: 0, cock: 0 } });

  return {
    group,
    update,
    setItem,
    setEating,
    rodTipPosition,
    rodBendDirection,
    chargeCast,
    releaseCast,
    cancelCast,
    setCatch,
    get castBend() {
      return castBend;
    },
  };
}
