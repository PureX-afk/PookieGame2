// Fishing: holding RT with the rod charges a cast — the bar sweeps left to right and
// back — and releasing throws the bobber out to that distance. It floats and bobs on
// the sea; land it on anything but open water and it comes straight back with nothing.
import * as THREE from 'three';
import { heightAt as terrainHeight } from './island.js';
import { createFishingGame } from './fishingGame.js';
import { createFish } from './items.js';

const MIN_CAST = 3;
const MAX_CAST = 18;
const CHARGE_PERIOD = 1.5; // one full left-to-right-to-left sweep
const FLIGHT_TIME = 0.75;
const RETURN_TIME = 0.45;
const LAND_LINGER = 0.3;
const GRAVITY = 18;
// How long a float sits on the water before something takes an interest.
const BITE_MIN = 2;
const BITE_MAX = 10;

const BOX = new THREE.BoxGeometry(1, 1, 1);
const FLOAT = new THREE.IcosahedronGeometry(0.13, 0);
const CAP = new THREE.CylinderGeometry(0.075, 0.075, 0.07, 8);

// Casts leave from the tip of the first-person rod, which is the rod the owner is
// actually looking at. The body's rod is scaled and angled to reach the same spot, so
// the other player sees the line leave the rod in the caster's hand.
export function createFishing({ side, player, hand, scene, ocean, rumble, onCatch, onUse }) {
  // Power bar, docked on that player's half.
  const bar = document.createElement('div');
  bar.className = `cast ${side} hidden`;
  bar.innerHTML =
    '<div class="cast-track"><span class="cast-fill"></span></div>' +
    '<p class="cast-label">Cast distance</p>';
  document.getElementById('stage').appendChild(bar);
  const fill = bar.querySelector('.cast-fill');
  // The catching minigame that takes over once something bites.
  const game = createFishingGame(side);

  // Bobber: a chunky red float with a pale cap so it reads against the sea.
  const group = new THREE.Group();
  group.visible = false;
  const float = new THREE.Mesh(
    FLOAT,
    new THREE.MeshLambertMaterial({ color: 0xd94b3d, flatShading: true })
  );
  float.castShadow = true;
  group.add(float);
  const cap = new THREE.Mesh(
    CAP,
    new THREE.MeshLambertMaterial({ color: 0xf5f1e6, flatShading: true })
  );
  cap.position.y = 0.09;
  group.add(cap);
  scene.add(group);

  // Line from the rod tip to the bobber. A chain of hair-thin segments follows a
  // sagging curve and re-aims each frame, so it hangs and bends like real line instead
  // of staying a rigid beam.
  const LINE_SEGMENTS = 12;
  const LINE_THICKNESS = 0.004;
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xf4f1e2, flatShading: true });
  const lineGroup = new THREE.Group();
  lineGroup.visible = false;
  const lineSegments = [];
  for (let i = 0; i < LINE_SEGMENTS; i++) {
    const segment = new THREE.Mesh(BOX, lineMat);
    lineGroup.add(segment);
    lineSegments.push(segment);
  }
  scene.add(lineGroup);

  // A caught fish leaps out of the water by the float before it is stowed away.
  const FISH_SCALE = 1.6;
  const caughtFish = createFish();
  caughtFish.scale.setScalar(FISH_SCALE);
  caughtFish.visible = false;
  scene.add(caughtFish);

  let state = 'idle'; // idle | charging | flying | bobbing | catching | missed | returning
  let chargeTime = 0;
  let power = 0;
  let flight = 0;
  let linger = 0;
  let returnTime = 0;
  let bobTime = 0;
  let biteTimer = 0;
  let bitten = false;
  let floatX = 0;
  let floatZ = 0;

  const tip = new THREE.Vector3();
  const start = new THREE.Vector3();
  const target = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const from = new THREE.Vector3();
  const lineCurve = new THREE.QuadraticBezierCurve3();
  const linePoints = Array.from({ length: LINE_SEGMENTS + 1 }, () => new THREE.Vector3());
  let lineTime = 0;
  let lineSlack = 0.2;

  // Caught-fish leap: a short arc that breaks the surface at the float and flies at
  // the angler, shrinking out of existence as it arrives.
  const LEAP_TIME = 0.85;
  const LEAP_HEIGHT = 1.9;
  const leapFrom = new THREE.Vector3();
  const leapTo = new THREE.Vector3();
  const leapPos = new THREE.Vector3();
  const leapAhead = new THREE.Vector3();
  let leapTime = -1;

  function setBar(visible) {
    bar.classList.toggle('hidden', !visible);
  }

  // Position along the caught-fish arc at 0..1. It starts just under the surface so
  // the body breaks out of the water, then lobs toward the angler's chest.
  function leapPoint(k, target) {
    target.lerpVectors(leapFrom, leapTo, k);
    // The negative term fades out from the start, so the body begins just under the
    // surface and finishes exactly at the angler.
    target.y += Math.sin(Math.PI * k) * LEAP_HEIGHT - 0.25 * (1 - k);
    return target;
  }

  function startLeap() {
    leapFrom.copy(group.position);
    // Aim the whole throw at the angler, not just a small hop: the fish is cancelled
    // with a quick shrink as it reaches them.
    leapTo.set(
      player.position.x,
      player.position.y + 1.1,
      player.position.z
    );
    leapTime = 0;
    caughtFish.visible = true;
    caughtFish.scale.setScalar(FISH_SCALE);
  }

  function updateLeap(dt) {
    if (leapTime < 0) return;
    leapTime += dt;
    const k = Math.min(leapTime / LEAP_TIME, 1);
    leapPoint(k, leapPos);
    caughtFish.position.copy(leapPos);
    // Point the head along the arc, then let it flop around its own axis.
    leapPoint(Math.min(1, k + 0.04), leapAhead);
    if (leapAhead.distanceToSquared(leapPos) > 1e-6) caughtFish.lookAt(leapAhead);
    caughtFish.rotateZ(Math.sin(leapTime * 18) * 0.35);
    // Shrink out over the last quarter of the flight so the catch ends cleanly
    // instead of the fish popping away at full size.
    const shrink = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
    caughtFish.scale.setScalar(FISH_SCALE * shrink);
    if (k >= 1) {
      leapTime = -1;
      caughtFish.visible = false;
    }
  }

  function release() {
    setBar(false);
    hand.releaseCast();
    hand.rodTipPosition(tip);
    const distance = MIN_CAST + (MAX_CAST - MIN_CAST) * power;
    const x = tip.x + Math.sin(player.yaw) * distance;
    const z = tip.z + Math.cos(player.yaw) * distance;
    const ground = terrainHeight(x, z);
    // Below sea level is open water; anything else is a surface to bounce off.
    const onWater = ground < 0;
    target.set(x, onWater ? 0 : ground + 0.06, z);

    start.copy(tip);
    // A ballistic throw timed to arrive exactly at FLIGHT_TIME.
    velocity.set(
      (target.x - start.x) / FLIGHT_TIME,
      (target.y - start.y) / FLIGHT_TIME + 0.5 * GRAVITY * FLIGHT_TIME,
      (target.z - start.z) / FLIGHT_TIME
    );

    flight = 0;
    state = 'flying';
    group.visible = true;
    lineGroup.visible = true;
    lineSlack = 0.2;
    group.position.copy(tip);
    group.rotation.set(0, 0, 0);
  }

  function goHome() {
    from.copy(group.position);
    returnTime = 0;
    state = 'returning';
  }

  function reset() {
    setBar(false);
    game.stop();
    hand.cancelCast();
    hand.setCatch(false, false);
    bitten = false;
    biteTimer = 0;
    state = 'idle';
    group.visible = false;
    lineGroup.visible = false;
  }

  function update(dt, controls) {
    const held = player.held === 'fishing_rod';

    // Switching away from the rod, or dying, abandons whatever is in progress.
    if (
      !held &&
      (state === 'charging' || state === 'flying' || state === 'bobbing' || state === 'catching')
    ) {
      setBar(false);
      game.stop();
      hand.cancelCast();
      hand.setCatch(false, false);
      if (state === 'charging') state = 'idle';
      else goHome();
    }

    if (state === 'idle') {
      if (held && controls.usePressed) {
        setBar(true);
        state = 'charging';
        chargeTime = 0;
        power = 0;
        hand.chargeCast(0);
      }
    } else if (state === 'charging') {
      chargeTime += dt;
      // Sweep out to the far end and back, over and over, until the trigger is let go.
      const t = (chargeTime / CHARGE_PERIOD) % 1;
      power = t < 0.5 ? t * 2 : 2 - t * 2;
      fill.style.width = `${(power * 100).toFixed(1)}%`;
      hand.chargeCast(power);
      if (!controls.useHeld) release();
    } else if (state === 'flying') {
      flight += dt;
      const k = Math.min(flight / FLIGHT_TIME, 1);
      group.position.set(
        start.x + velocity.x * flight,
        start.y + velocity.y * flight - 0.5 * GRAVITY * flight * flight,
        start.z + velocity.z * flight
      );
      if (k >= 1) {
        group.position.copy(target);
        if (target.y > 0.01) {
          // Hit sand or rock: a moment to read the miss, then it comes home empty.
          linger = 0;
          state = 'missed';
        } else {
          floatX = target.x;
          floatZ = target.z;
          bobTime = 0;
          bitten = false;
          // Anywhere from two to ten seconds of waiting.
          biteTimer = BITE_MIN + Math.random() * (BITE_MAX - BITE_MIN);
          // The float is fishing now, so the rod has done a use's worth of work.
          if (onUse) onUse();
          state = 'bobbing';
        }
      }
    } else if (state === 'missed') {
      linger += dt;
      if (linger >= LAND_LINGER) goHome();
    } else if (state === 'bobbing') {
      bobTime += dt;

      if (!bitten) {
        biteTimer -= dt;
        if (biteTimer <= 0) {
          bitten = true;
          // Everything that can say "now" says it: the float shakes and the pad kicks.
          if (rumble) rumble(0.9, 0.55, 600);
        }
      }

      const wave = ocean.heightAt(floatX, floatZ);

      if (bitten) {
        // A bite: fast shallow shaking and a dip, readable across the water.
        group.position.set(
          floatX + Math.sin(bobTime * 34) * 0.035,
          wave + 0.01 + Math.sin(bobTime * 26) * 0.05,
          floatZ + Math.cos(bobTime * 31) * 0.03
        );
        group.rotation.z = Math.sin(bobTime * 30) * 0.35;
        group.rotation.x = Math.cos(bobTime * 27) * 0.3;
      } else {
        // Waiting: the float rides the swell and adds a clear bob of its own, so it
        // reads as "nothing yet" instead of looking stuck to the sea.
        group.position.set(
          floatX,
          wave + 0.03 + Math.sin(bobTime * 3.2) * 0.07,
          floatZ
        );
        group.rotation.z = Math.sin(bobTime * 1.6) * 0.18;
        group.rotation.x = Math.cos(bobTime * 3.2) * 0.1;
      }

      if (controls.usePressed) {
        if (bitten) {
          // Something is on the line: hand over to the catching minigame.
          state = 'catching';
          game.start('normal');
        } else {
          goHome();
        }
      }
    } else if (state === 'catching') {
      // Hold RT to lift the bar, let go to drop it. Caught or lost ends the fight.
      hand.setCatch(true, controls.useHeld);
      const result = game.update(dt, controls.useHeld);
      if (result === 'caught') {
        hand.setCatch(false, false);
        startLeap();
        if (onCatch) onCatch();
        goHome();
      } else if (result === 'escaped') {
        hand.setCatch(false, false);
        goHome();
      }
    } else if (state === 'returning') {
      returnTime += dt;
      const k = Math.min(returnTime / RETURN_TIME, 1);
      hand.rodTipPosition(tip);
      group.position.lerpVectors(from, tip, k * k);
      if (k >= 1) reset();
    }

    if (lineGroup.visible) {
      hand.rodTipPosition(tip);
      const end = group.position;
      const distance = tip.distanceTo(end);
      // A taut line is nearly straight; once the float lands, the line eases into its
      // slack instead of snapping there, and tightens a little faster when reeled in.
      lineTime += dt;
      const targetSlack = state === 'flying' ? 0.2 : state === 'returning' ? 0.45 : 1;
      const slackRate = targetSlack > lineSlack ? 2.5 : 6;
      lineSlack += (targetSlack - lineSlack) * (1 - Math.exp(-slackRate * dt));
      const sag = Math.min(0.7, distance * 0.06) * lineSlack;
      mid.copy(tip).add(end).multiplyScalar(0.5);
      mid.y -= sag;
      mid.x += Math.sin(lineTime * 1.9 + distance) * sag * 0.16;
      mid.z += Math.cos(lineTime * 1.5) * sag * 0.16;

      lineCurve.v0.copy(tip);
      lineCurve.v1.copy(mid);
      lineCurve.v2.copy(end);
      for (let i = 0; i <= LINE_SEGMENTS; i++) {
        lineCurve.getPoint(i / LINE_SEGMENTS, linePoints[i]);
      }
      for (let i = 0; i < LINE_SEGMENTS; i++) {
        const a = linePoints[i];
        const b = linePoints[i + 1];
        const segment = lineSegments[i];
        const segmentLength = a.distanceTo(b);
        segment.visible = segmentLength > 0.0002;
        if (!segment.visible) continue;
        segment.position.copy(a).add(b).multiplyScalar(0.5);
        segment.lookAt(b);
        segment.scale.set(LINE_THICKNESS, LINE_THICKNESS, segmentLength);
      }
    }

    updateLeap(dt);
  }

  return {
    update,
    reset,
    get state() {
      return state;
    },
    get power() {
      return power;
    },
  };
}
