// Bootstrap: island, sea, sky, two players in first person, split-screen.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { LAYER } from './layers.js';
import { createIsland } from './island.js';
import { createOcean } from './ocean.js';
import { createBoat } from './boat.js';
import { createSky } from './sky.js';
import { createPlayer } from './player.js';
import { createCameraRig } from './cameraRig.js';
import { createViewModel } from './viewModel.js';
import { createSplitScreen } from './splitScreen.js';
import { createInput } from './input.js';
import { createCraftingMenu } from './craftingMenu.js';
import { createSettingsPanel } from './settingsPanel.js';
import { createSystemMenu } from './systemMenu.js';
import { createUnderwaterOverlay } from './underwater.js';
import { createBreathMeter } from './breath.js';
import { createHealthBar, POINTS_PER_HEART } from './health.js';
import { createInventory } from './inventory.js';
import { createDeathScreen } from './deathScreen.js';
import { createCrosshair } from './crosshair.js';
import { createHungerMeter, EXHAUSTION } from './hunger.js';
import { createFishing } from './fishing.js';
import { createGroundItems } from './groundItems.js';
import { createTrees } from './trees.js';
import { createLightingGame } from './lightingGame.js';
import { createCookingGame, MANUAL_RATE, FLIP_LOSS } from './cookingGame.js';
import { createLaunchScreen } from './launchScreen.js';
import { saveGame, readSave } from './save.js';
import { createSettings, UI_SCALE } from './settings.js';

const canvas = document.getElementById('game');

// Quick refresh: Backspace reloads the page from the server. It is caught here rather
// than in the input layer so it works on the launch screen and during play alike, and
// `preventDefault` keeps the browser from treating it as navigation.
window.addEventListener('keydown', (event) => {
  if (event.code !== 'Backspace' || event.repeat) return;
  event.preventDefault();
  window.location.reload();
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.fog);
scene.fog = new THREE.Fog(PALETTE.fog, 240, 900);

const sky = createSky({ scene });
scene.add(sky.group);
scene.add(createIsland());
// Trees are planted before the ground litter, so sticks and dropped structures can
// keep clear of trunks instead of growing through them.
const trees = createTrees({
  scene,
  drop: (id, x, z) => groundItems.drop(id, x, z),
});
const groundItems = createGroundItems({
  scene,
  blockedAt: (x, z) => trees.blocks(x, z),
});

const ocean = createOcean();
scene.add(ocean.mesh);

// A rowboat drifting offshore: scenery for the title screen's view of the island, and
// something to watch ride the swell in-game.
const boat = createBoat({ ocean });
scene.add(boat.group);

// Player-facing options are per player, so the two can prefer different schemes.
const settingsP1 = createSettings();
const settingsP2 = createSettings();

// Spawn on the beach. "shore" looks along the waterline so the first frame has
// sand, sea, sky and the green slope all in it.
function spawnPoint(degrees, radius, facing = 'inland') {
  const angle = THREE.MathUtils.degToRad(degrees);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const yaw =
    facing === 'shore'
      ? Math.atan2(-Math.sin(angle), Math.cos(angle))
      : Math.atan2(-x, -z);
  return { x, z, yaw };
}

// The sea surface a floating body should sit on, so a swimmer rides the same swell
// everything else on the water does.
const surfaceAt = (x, z) => ocean.heightAt(x, z);

const p1 = createPlayer({
  spawn: spawnPoint(226, 62, 'shore'),
  layer: LAYER.p1Body,
  settings: settingsP1,
  surfaceAt,
  shirt: PALETTE.p1Shirt,
  pants: PALETTE.p1Pants,
  skin: PALETTE.skin,
  hair: PALETTE.p1Hair,
  solidAt: (x, z) => trees.blocks(x, z),
});
scene.add(p1.group);

const p2 = createPlayer({
  spawn: spawnPoint(238, 63, 'shore'),
  layer: LAYER.p2Body,
  settings: settingsP2,
  surfaceAt,
  shirt: PALETTE.p2Shirt,
  pants: PALETTE.p2Pants,
  skin: PALETTE.skin,
  hair: PALETTE.p2Hair,
  solidAt: (x, z) => trees.blocks(x, z),
});
scene.add(p2.group);

const rig1 = createCameraRig(p1);
const rig2 = createCameraRig(p2);

// Each camera sees the world, the other player's body, and its own hand.
rig1.camera.layers.set(0);
rig1.camera.layers.enable(LAYER.p2Body);
rig1.camera.layers.enable(LAYER.p1Hand);

rig2.camera.layers.set(0);
rig2.camera.layers.enable(LAYER.p1Body);
rig2.camera.layers.enable(LAYER.p2Hand);

// Cameras live in the scene so the hands parented to them get drawn.
scene.add(rig1.camera, rig2.camera);

const hand1 = createViewModel({
  camera: rig1.camera,
  scene,
  shirt: PALETTE.p1Shirt,
  cuff: PALETTE.cuff,
  skin: PALETTE.skin,
  layer: LAYER.p1Hand,
});

const hand2 = createViewModel({
  camera: rig2.camera,
  scene,
  shirt: PALETTE.p2Shirt,
  cuff: PALETTE.cuff,
  skin: PALETTE.skin,
  layer: LAYER.p2Hand,
});

const splitScreen = createSplitScreen(renderer, scene, [rig1.camera, rig2.camera]);
const fishing1 = createFishing({
  side: 'left',
  player: p1,
  hand: hand1,
  scene,
  ocean,
  rumble: (strong, weak, ms) => input.rumble(0, strong, weak, ms),
  onCatch: () => landFish(0),
  // A cast that actually reaches water spends one of the rod's fifty uses.
  onUse: () => {
    inventory1.wear('fishing_rod', 1);
    syncHeld();
  },
});
const fishing2 = createFishing({
  side: 'right',
  player: p2,
  hand: hand2,
  scene,
  ocean,
  rumble: (strong, weak, ms) => input.rumble(1, strong, weak, ms),
  onCatch: () => landFish(1),
  onUse: () => {
    inventory2.wear('fishing_rod', 1);
    syncHeld();
  },
});
const input = createInput();
const settingsPanelP1 = createSettingsPanel({
  settings: settingsP1,
  side: 'left',
  onSave: saveAndExit,
});
const settingsPanelP2 = createSettingsPanel({
  settings: settingsP2,
  side: 'right',
  onSave: saveAndExit,
});

const underwater1 = createUnderwaterOverlay('left');
const underwater2 = createUnderwaterOverlay('right');
const crosshair1 = createCrosshair('left');
const crosshair2 = createCrosshair('right');
const health1 = createHealthBar('left');
const health2 = createHealthBar('right');
// Out of breath underwater costs one heart per second: the drain tick already runs
// at one second, so it fires the damage on the same beat.
const breath1 = createBreathMeter('left', { onEmpty: () => health1.damage(POINTS_PER_HEART) });
const breath2 = createBreathMeter('right', { onEmpty: () => health2.damage(POINTS_PER_HEART) });
const hunger1 = createHungerMeter('left', { health: health1 });
const hunger2 = createHungerMeter('right', { health: health2 });

// Distance covered between frames, so sprinting and swimming can cost hunger.
const lastPos = [
  { x: p1.position.x, z: p1.position.z },
  { x: p2.position.x, z: p2.position.z },
];
const inventory1 = createInventory('left');
const inventory2 = createInventory('right');
// The crafting panels read their owner's bag, so they're built after the inventories.
const craftingMenuP1 = createCraftingMenu({ side: 'left', inventory: inventory1, onCraft: syncHeld });
const craftingMenuP2 = createCraftingMenu({ side: 'right', inventory: inventory2, onCraft: syncHeld });
// The Guide button's menu: save and stay, or save and leave. Plain saves write the
// same snapshot exiting does.
const systemMenuP1 = createSystemMenu({
  side: 'left',
  onSave: () => saveGame(captureState()),
  onSaveExit: saveAndExit,
});
const systemMenuP2 = createSystemMenu({
  side: 'right',
  onSave: () => saveGame(captureState()),
  onSaveExit: saveAndExit,
});
const lighting1 = createLightingGame('left');
const lighting2 = createLightingGame('right');
// Which campfire each player is currently trying to light, while they work at it.
const lightingTargets = [null, null];
const cooking1 = createCookingGame('left');
const cooking2 = createCookingGame('right');
// Which campfire each player is currently turning the spit on.
const cookingTargets = [null, null];
const deathScreen1 = createDeathScreen('left');
const deathScreen2 = createDeathScreen('right');

// The held item is pushed to the avatar and the first-person hand only when the
// selection changes, so the render loop isn't setting visibility every frame.
const heldIds = [undefined, undefined];
function syncHeld() {
  const ids = [inventory1.item ? inventory1.item.id : null, inventory2.item ? inventory2.item.id : null];
  const owners = [
    [p1, hand1],
    [p2, hand2],
  ];
  for (let i = 0; i < 2; i++) {
    if (ids[i] === heldIds[i]) continue;
    heldIds[i] = ids[i];
    owners[i][0].setItem(ids[i]);
    owners[i][1].setItem(ids[i]);
  }
}
syncHeld();

// How far in front of a player something is set down.
const PLACE_DISTANCE = 1.7;

// How long RT has to stay down before the food is actually eaten.
const EAT_HOLD = 1.0;

// Each player's bite clock: which item it is chewing and how far through the hold it
// is. A meal is only a meal at the end of the hold — release the trigger, switch
// slots or drop to a different thing in hand and the clock is thrown away, not
// banked for later.
const eaten = [
  { id: null, time: 0 },
  { id: null, time: 0 },
];

// The spot a player would set their held item down on: straight ahead, at the distance
// everything is placed. The ghost stands here and B puts it here.
function placeTarget(player) {
  return {
    x: player.position.x + Math.sin(player.yaw) * PLACE_DISTANCE,
    z: player.position.z + Math.cos(player.yaw) * PLACE_DISTANCE,
  };
}

// B sets one of the selected item down on the spot the ghost is showing. Nothing moves
// when that spot is taken — the item stays in the bag rather than being shoved
// somewhere it would clip through a fire.
function dropHeld(index) {
  const inventory = index === 0 ? inventory1 : inventory2;
  const player = index === 0 ? p1 : p2;
  const item = inventory.item;
  if (!item || item.placeable === false) return;
  const spot = placeTarget(player);
  if (!groundItems.canPlace(item.id, spot.x, spot.z)) return;
  if (!groundItems.place(item.id, spot.x, spot.z, player.yaw)) return;
  inventory.removeSelected();
  syncHeld();
}

// The fire has taken: spend the kindling, show the flames and ease the camera back out.
function finishLighting(index) {
  const record = lightingTargets[index];
  lightingTargets[index] = null;
  (index === 0 ? rig1 : rig2).clearFocus();
  if (!record) return;
  // Kindling lasts four fires rather than one, so it wears instead of being spent.
  (index === 0 ? inventory1 : inventory2).wear('kindling', 1);
  groundItems.light(record);
  syncHeld();
}

// A landed fish goes into the bag. If there is no room it is set down at the angler's
// feet instead of being thrown away, so a full bag never eats a catch.
function landFish(index) {
  const inventory = index === 0 ? inventory1 : inventory2;
  if (inventory.add('fish')) {
    syncHeld();
    return;
  }
  const at = (index === 0 ? p1 : p2).position;
  if (groundItems.drop('fish', at.x, at.z)) return;
  // Fishing from deep water: a few steps out to find the nearest dry beach.
  for (let radius = 2; radius <= 6; radius += 2) {
    for (let step = 0; step < 8; step++) {
      const angle = (step / 8) * Math.PI * 2;
      const x = at.x + Math.cos(angle) * radius;
      const z = at.z + Math.sin(angle) * radius;
      if (groundItems.place('fish', x, z)) return;
    }
  }
}

// The hand-cooking game is over, however it ended: whatever time is left goes back to
// the fire's own slow clock, and the camera eases out to the player's eyes.
function endCooking(index, record) {
  cookingTargets[index] = null;
  (index === 0 ? rig1 : rig2).clearFocus();
  if (record && record.cook) record.cook.manual = false;
}

// A player who dies partway through work at a fire is lifted out of it: the mini-game
// closes, the fish goes back on the fire's own clock, and the camera returns to their
// eyes. Leaving it open would keep that player frozen and zoomed in after respawning.
function interruptFireWork(index) {
  const lighting = index === 0 ? lighting1 : lighting2;
  const cooking = index === 0 ? cooking1 : cooking2;
  if (lighting.isOpen) {
    lighting.stop();
    lightingTargets[index] = null;
  }
  if (cooking.isOpen) {
    const record = cookingTargets[index];
    cooking.stop();
    endCooking(index, record);
  }
  (index === 0 ? rig1 : rig2).clearFocus();
}

// RT with food in hand: a raw fish goes on the spit of the lit fire being aimed at,
// a cooked fish is eaten. True when the press was spent, so it doesn't also land a
// punch.
function useHeld(index) {
  const inventory = index === 0 ? inventory1 : inventory2;
  const held = inventory.item ? inventory.item.id : null;

  // A stick at a burning fire is fuel, not a blunt instrument to be held aloft.
  if (held === 'stick') {
    const target = groundItems.stokeTarget(index, inventory);
    if (target && groundItems.stoke(target, inventory)) {
      syncHeld();
      return true;
    }
  }

  if (held === 'fish') {
    const target = groundItems.cookTarget(index, inventory);
    if (target && groundItems.cook(target, inventory)) {
      syncHeld();
      return true;
    }
  }

  // Eating is deliberately not here: a meal is RT held down for a full second, and a
  // hold can't be spent with a press. The bite clock runs in the frame loop instead,
  // and this only stays true for the one-off interactions above.
  return false;
}

// The button the crosshair badge should name: RT when the held item would go on the
// fire being looked at or be eaten, X for the usual pick.
function pressKey(index, inventory) {
  const item = inventory.item;
  // A fire with a fish partway cooked takes it into hand whatever the player holds, so
  // this is checked before the empty hand settles on X.
  if (groundItems.cookGameTarget(index)) return 'RT';
  // Food is eaten, not swung at bark, so the meal takes priority over a trunk.
  if (item && item.hunger > 0) return 'RT';
  // A standing tree or bush takes a swing from whatever is in hand; the simple tool is
  // what actually cuts a bush.
  if (trees.chopTarget(index)) return 'RT';
  // A log on the ground breaks down into sticks with a wood-cutting tool in hand;
  // without one the badge stays X so the log can simply be picked up.
  if (groundItems.logTarget(index, inventory)) return 'RT';
  if (!item) return 'X';
  if (item.id === 'fish' && groundItems.cookTarget(index, inventory)) return 'RT';
  if (item.id === 'stick' && groundItems.stokeTarget(index, inventory)) return 'RT';
  if (item.id === 'kindling' && groundItems.lightTarget(index, inventory)) return 'RT';
  return 'X';
}

// The HUD reads these per-player scale variables; they change from the settings panel.
const stage = document.getElementById('stage');
const appliedUi = [null, null];

window.addEventListener('resize', () => {
  // The pixel ratio follows the window too: dragging onto a different-density screen
  // or changing zoom otherwise leaves the canvas rendering at the old sharpness.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

const clock = new THREE.Clock();

// Nothing steps until the launch screen has been answered.
let running = false;
let startedOnce = false;
// Seconds of play, carried into the save so the menu can say how long a run has been.
let playTime = 0;

// The whole session, in plain JSON: who is playing, where everyone is standing, what
// they are carrying and how much of it is worn out, the island's litter, and the clock.
function captureState() {
  return {
    version: 1,
    savedAt: Date.now(),
    playTime,
    players: input.players,
    device: input.device,
    time: sky.seconds,
    settings: [settingsP1, settingsP2].map((settings) => ({
      sprintMode: settings.sprintMode,
      uiSize: settings.uiSize,
    })),
    bodies: [p1, p2].map((player) => ({
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
    })),
    vitals: [
      [health1, hunger1, breath1],
      [health2, hunger2, breath2],
    ].map(([health, hunger, breath]) => ({
      hp: health.hp,
      hunger: hunger.hunger,
      saturation: hunger.saturation,
      exhaustion: hunger.exhaustion,
      breath: breath.breath,
    })),
    inventories: [inventory1.toJSON(), inventory2.toJSON()],
    // Which slot each bag was showing, so Continue comes back to the same thing in
    // hand rather than always slot one.
    selection: [inventory1.selected, inventory2.selected],
    ground: groundItems.toJSON(),
    trees: trees.toJSON(),
  };
}

// Read one back. Every part is optional, so a save missing a section still loads.
function applyState(state) {
  if (!state) return;
  playTime = Number.isFinite(state.playTime) ? state.playTime : 0;
  if (Number.isFinite(state.time)) sky.setTime(state.time);

  [settingsP1, settingsP2].forEach((settings, i) => {
    const saved = state.settings && state.settings[i];
    if (!saved) return;
    if (saved.sprintMode) settings.sprintMode = saved.sprintMode;
    if (saved.uiSize) settings.uiSize = saved.uiSize;
  });

  [p1, p2].forEach((player, i) => {
    const body = state.bodies && state.bodies[i];
    if (body) player.restore(body);
  });

  [
    [health1, hunger1, breath1],
    [health2, hunger2, breath2],
  ].forEach(([health, hunger, breath], i) => {
    const vitals = state.vitals && state.vitals[i];
    if (!vitals) return;
    if (Number.isFinite(vitals.hp)) health.setHp(vitals.hp);
    hunger.restore(vitals);
    breath.restore(vitals.breath);
  });

  if (state.inventories) {
    inventory1.fromJSON(state.inventories[0]);
    inventory2.fromJSON(state.inventories[1]);
  }
  if (Array.isArray(state.selection)) {
    inventory1.select(state.selection[0]);
    inventory2.select(state.selection[1]);
  }
  if (state.ground) groundItems.fromJSON(state.ground);
  // Trees are rebuilt from the fixed seed first, then the save's damage and stumps are
  // laid over the top.
  if (state.trees) trees.fromJSON(state.trees);

  syncHeld();
}

// Save, then hand the screen back to the launch menu.
function saveAndExit() {
  saveGame(captureState());
  settingsPanelP1.setOpen(false);
  settingsPanelP2.setOpen(false);
  craftingMenuP1.setOpen(false);
  craftingMenuP2.setOpen(false);
  systemMenuP1.setOpen(false);
  systemMenuP2.setOpen(false);
  running = false;
  // Back to the menu means back out of the game: the stage leaves the page along with
  // the pointer capture.
  stage.classList.add('menu');
  if (document.pointerLockElement) document.exitPointerLock();
  launch.open();
}

// Start the session the launch screen picked: one camera or two, and the device it was
// told about.
function startGame({ players, device, state }) {
  // Picking a fresh session after one has been saved and left needs a genuinely fresh
  // world, so reload rather than reusing the one just walked away from.
  if (startedOnce && !state) {
    window.location.reload();
    return;
  }
  startedOnce = true;

  input.configure({ players, device });
  stage.classList.remove('menu');
  // The launch screen's button may still hold focus, and player two's jump is Enter:
  // without this, the first jump would also click the button that started the game.
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

  if (players === 1) {
    // One survivor takes the whole screen: one camera, one body, half the HUD.
    splitScreen.setCameras([rig1.camera]);
    p2.group.visible = false;
    stage.classList.add('single');
  } else {
    splitScreen.setCameras([rig1.camera, rig2.camera]);
    stage.classList.add('multi');
  }

  // Pointer lock so the mouse turns the view instead of dragging a cursor around.
  if (device === 'keyboard') lockPointer();

  // A session starts with nothing half-done. Continue reuses the world it was just
  // left in, so anything still in progress — a cast out, a fish being turned, the
  // camera leaning in on a fire, a bite part-way through — is put down here.
  interruptFireWork(0);
  interruptFireWork(1);
  fishing1.reset();
  fishing2.reset();
  deathScreen1.hide();
  deathScreen2.hide();
  hand1.setEating(0);
  hand2.setEating(0);
  for (const track of eaten) {
    track.id = null;
    track.time = 0;
  }

  if (state) applyState(state);

  // Travel bookkeeping starts from where the bodies actually are, so loading a save
  // isn't billed on the first frame for the distance from the spawn to the saved spot.
  for (let i = 0; i < 2; i++) {
    const player = i === 0 ? p1 : p2;
    lastPos[i].x = player.position.x;
    lastPos[i].z = player.position.z;
  }

  running = true;
}

const launch = createLaunchScreen({
  onStart: startGame,
  loadSave: readSave,
});

// Capturing the pointer can be refused (a very recent Esc, a browser prompt); a
// refusal is not worth throwing on, the next click tries again.
function lockPointer() {
  const attempt = canvas.requestPointerLock?.();
  if (attempt && attempt.catch) attempt.catch(() => {});
}

// Browsers drop the pointer whenever they feel like it; clicking back in picks it up.
canvas.addEventListener('click', () => {
  if (running && input.device === 'keyboard' && !document.pointerLockElement) lockPointer();
});

// The title screen's camera: a slow orbit of the island, so the menu is a view of the
// world rather than a picture of one.
const menuCamera = new THREE.PerspectiveCamera(64, 0.5, 0.1, 4000);
let menuAngle = 0.6;

function updateMenuCamera(dt) {
  menuAngle += dt * 0.02;
  const radius = 122;
  menuCamera.position.set(
    Math.cos(menuAngle) * radius,
    27 + Math.sin(menuAngle * 1.7) * 3,
    Math.sin(menuAngle) * radius
  );
  menuCamera.lookAt(0, 4, 0);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!running) {
    // Title screen: the world is the backdrop, seen from a slow orbit. Nothing plays —
    // no players, no HUD — but the sea, the sky and the boat keep moving.
    updateMenuCamera(dt);
    ocean.update(dt);
    sky.update(dt);
    groundItems.update(dt);
    trees.update(dt);
    boat.update(dt);
    splitScreen.setCameras([menuCamera]);
    splitScreen.render();
    requestAnimationFrame(frame);
    return;
  }
  playTime += dt;
  const [controls1, controls2] = input.read();

  // Death: zero hearts covers that player's half of the screen and freezes them.
  // Nothing respawns on its own, and the other player is never interrupted.
  if (!deathScreen1.isOpen && health1.dead) {
    settingsPanelP1.setOpen(false);
    craftingMenuP1.setOpen(false);
    // Every panel closes on death: left open, the respawn press would also be read as
    // a confirmation of whatever row it was sitting on.
    systemMenuP1.setOpen(false);
    interruptFireWork(0);
    deathScreen1.show();
  }
  if (!deathScreen2.isOpen && health2.dead) {
    settingsPanelP2.setOpen(false);
    craftingMenuP2.setOpen(false);
    systemMenuP2.setOpen(false);
    interruptFireWork(1);
    deathScreen2.show();
  }

  // Respawn puts them back on the beach they started on, healed, with a full lung.
  if (deathScreen1.isOpen && controls1.respawnPressed) {
    health1.setHp(health1.maxHp);
    breath1.reset();
    hunger1.reset();
    fishing1.reset();
    p1.respawn();
    deathScreen1.hide();
  }
  if (deathScreen2.isOpen && controls2.respawnPressed) {
    health2.setHp(health2.maxHp);
    breath2.reset();
    hunger2.reset();
    fishing2.reset();
    p2.respawn();
    deathScreen2.hide();
  }

  const dead1 = deathScreen1.isOpen;
  const dead2 = deathScreen2.isOpen;

  // Start opens that player's own settings panel. Nothing freezes, so the other
  // player keeps playing and only the opener's settings change.
  if (controls1.pausePressed && !dead1) {
    if (craftingMenuP1.isOpen) craftingMenuP1.setOpen(false);
    if (systemMenuP1.isOpen) systemMenuP1.setOpen(false);
    settingsPanelP1.toggle();
  }
  if (controls2.pausePressed && !dead2) {
    if (craftingMenuP2.isOpen) craftingMenuP2.setOpen(false);
    if (systemMenuP2.isOpen) systemMenuP2.setOpen(false);
    settingsPanelP2.toggle();
  }

  // Y swaps the other panel on that same side, so the two never overlap.
  if (controls1.craftPressed && !dead1) {
    if (settingsPanelP1.isOpen) settingsPanelP1.setOpen(false);
    if (systemMenuP1.isOpen) systemMenuP1.setOpen(false);
    craftingMenuP1.toggle();
  }
  if (controls2.craftPressed && !dead2) {
    if (settingsPanelP2.isOpen) settingsPanelP2.setOpen(false);
    if (systemMenuP2.isOpen) systemMenuP2.setOpen(false);
    craftingMenuP2.toggle();
  }

  // Guide opens that player's own system menu: save, or save and quit to the menu.
  // It is the only panel that side shows, and only one side shows it at a time.
  if (controls1.guidePressed && !dead1) {
    if (settingsPanelP1.isOpen) settingsPanelP1.setOpen(false);
    if (craftingMenuP1.isOpen) craftingMenuP1.setOpen(false);
    if (systemMenuP2.isOpen) systemMenuP2.setOpen(false);
    systemMenuP1.toggle();
  }
  if (controls2.guidePressed && !dead2) {
    if (settingsPanelP2.isOpen) settingsPanelP2.setOpen(false);
    if (craftingMenuP2.isOpen) craftingMenuP2.setOpen(false);
    if (systemMenuP1.isOpen) systemMenuP1.setOpen(false);
    systemMenuP2.toggle();
  }

  // Bumpers step each player's own hotbar; empty slots hold the bare hand.
  if (controls1.slotNext) inventory1.next();
  if (controls1.slotPrev) inventory1.prev();
  if (controls2.slotNext) inventory2.next();
  if (controls2.slotPrev) inventory2.prev();
  syncHeld();

  const menu1 = settingsPanelP1.isOpen;
  const menu2 = settingsPanelP2.isOpen;
  if (menu1 && controls1.navUp) settingsPanelP1.moveFocus(-1);
  if (menu1 && controls1.navDown) settingsPanelP1.moveFocus(1);
  if (menu2 && controls2.navUp) settingsPanelP2.moveFocus(-1);
  if (menu2 && controls2.navDown) settingsPanelP2.moveFocus(1);
  if (menu1 && controls1.jumpPressed) settingsPanelP1.activate();
  if (menu2 && controls2.jumpPressed) settingsPanelP2.activate();

  // The system menu borrows the same two controls: D-pad to pick the row, A to
  // do it. Saving writes the snapshot; leaving also drops back to the menu.
  const sys1 = systemMenuP1.isOpen;
  const sys2 = systemMenuP2.isOpen;
  if (sys1 && controls1.navUp) systemMenuP1.moveFocus(-1);
  if (sys1 && controls1.navDown) systemMenuP1.moveFocus(1);
  if (sys2 && controls2.navUp) systemMenuP2.moveFocus(-1);
  if (sys2 && controls2.navDown) systemMenuP2.moveFocus(1);
  if (sys1 && controls1.jumpPressed) systemMenuP1.activate();
  if (sys2 && controls2.jumpPressed) systemMenuP2.activate();

  // The crafting panel borrows the same two controls: D-pad to pick a recipe, A to
  // make it. It re-reads the bag each frame, but only touches the DOM when a recipe's
  // craftable state or the focus actually changes.
  const craft1 = craftingMenuP1.isOpen;
  const craft2 = craftingMenuP2.isOpen;
  if (craft1 && controls1.navUp) craftingMenuP1.moveFocus(-1);
  if (craft1 && controls1.navDown) craftingMenuP1.moveFocus(1);
  if (craft2 && controls2.navUp) craftingMenuP2.moveFocus(-1);
  if (craft2 && controls2.navDown) craftingMenuP2.moveFocus(1);
  if (craft1 && controls1.jumpPressed) craftingMenuP1.craft();
  if (craft2 && controls2.jumpPressed) craftingMenuP2.craft();
  if (craft1) craftingMenuP1.refresh();
  if (craft2) craftingMenuP2.refresh();

  // Apply UI size only when it changes, so the loop doesn't write styles every frame.
  const scale1 = UI_SCALE[settingsP1.uiSize];
  if (scale1 !== appliedUi[0]) {
    appliedUi[0] = scale1;
    stage.style.setProperty('--ui-left', String(scale1));
  }
  const scale2 = UI_SCALE[settingsP2.uiSize];
  if (scale2 !== appliedUi[1]) {
    appliedUi[1] = scale2;
    stage.style.setProperty('--ui-right', String(scale2));
  }

  // A on an open panel changes the setting rather than also jumping. A dead player
  // is held still, but still receives the respawn press handled above.
  const frozen = (controls) => ({
    ...controls,
    turn: 0,
    move: 0,
    lookY: 0,
    yawDelta: 0,
    pitchDelta: 0,
    jumpPressed: false,
    usePressed: false,
    useHeld: false,
    pickPressed: false,
    dropPressed: false,
    sprintHeld: false,
    sprintToggle: false,
  });
  // Neither panel wants its A press to also jump.
  const busy1 = menu1 || craft1 || sys1;
  const busy2 = menu2 || craft2 || sys2;
  const live1 = busy1 ? { ...controls1, jumpPressed: false } : controls1;
  const live2 = busy2 ? { ...controls2, jumpPressed: false } : controls2;

  // RT at a cold campfire with kindling in the bag starts the lighting game instead of
  // throwing a punch at the logs. The aim it reads is the one from last frame, which is
  // fine for something that doesn't move.
  if (!dead1 && !busy1 && !lighting1.isOpen && live1.usePressed) {
    const target = groundItems.lightTarget(0, inventory1);
    if (target) {
      lightingTargets[0] = target;
      lighting1.start();
      rig1.setFocus(target.mesh.position);
    }
  }
  if (!dead2 && !busy2 && !lighting2.isOpen && live2.usePressed) {
    const target = groundItems.lightTarget(1, inventory2);
    if (target) {
      lightingTargets[1] = target;
      lighting2.start();
      rig2.setFocus(target.mesh.position);
    }
  }

  // RT at a fire with a fish partway through cooking leans in on it and takes the fish
  // in hand: it cooks faster, and it has to be turned on the beat. This can be done as
  // often as the player likes — backing out just hands the fish back to the fire.
  if (!dead1 && !busy1 && !cooking1.isOpen && !lighting1.isOpen && live1.usePressed) {
    const record = groundItems.cookGameTarget(0);
    // A fish can only be in one pair of hands, so the other player's game keeps it.
    if (record && record !== cookingTargets[1]) {
      cookingTargets[0] = record;
      record.cook.manual = true;
      cooking1.start();
      rig1.setFocus(record.mesh.position);
    }
  }
  if (!dead2 && !busy2 && !cooking2.isOpen && !lighting2.isOpen && live2.usePressed) {
    const record = groundItems.cookGameTarget(1);
    if (record && record !== cookingTargets[0]) {
      cookingTargets[1] = record;
      record.cook.manual = true;
      cooking2.start();
      rig2.setFocus(record.mesh.position);
    }
  }

  // Putting a fish on a fire or eating a cooked one spends the press, so it can't
  // also land a punch.
  const used1 =
    !dead1 && !busy1 && !lighting1.isOpen && !cooking1.isOpen && live1.usePressed
      ? useHeld(0)
      : false;
  const used2 =
    !dead2 && !busy2 && !lighting2.isOpen && !cooking2.isOpen && live2.usePressed
      ? useHeld(1)
      : false;
  // Named for the spent press, not the hand: `hand1` is the first-person view model.
  const spent1 = used1 ? { ...live1, usePressed: false, useHeld: false } : live1;
  const spent2 = used2 ? { ...live2, usePressed: false, useHeld: false } : live2;

  // A settings menu, a recipe, the system menu and a fire all take two hands, so
  // that player stands still while they are in one — no walking and no turning,
  // or stepping through a list also steers them around.
  // A food item in hand turns the trigger into eating instead of a punch, so the
  // press never reaches the swing. The hold itself is tracked further down with the
  // trigger's held state left intact.
  const food1 = !!(inventory1.item && inventory1.item.hunger > 0);
  const food2 = !!(inventory2.item && inventory2.item.hunger > 0);
  // Everything that takes a player's hands: being dead, a panel on their side, or a
  // fire they are leaning over.
  const hold1 = dead1 || menu1 || craft1 || sys1 || lighting1.isOpen || cooking1.isOpen;
  const hold2 = dead2 || menu2 || craft2 || sys2 || lighting2.isOpen || cooking2.isOpen;
  // A punch already in flight stops with the hands: otherwise it finishes (and can
  // still land a hit) behind the death screen or the panel.
  if (hold1) p1.cancelSwing();
  if (hold2) p2.cancelSwing();
  const c1 = hold1 ? frozen(spent1) : food1 ? { ...spent1, usePressed: false } : spent1;
  const c2 = hold2 ? frozen(spent2) : food2 ? { ...spent2, usePressed: false } : spent2;

  // Read the jump before the step: update() puts the body in the air on the same
  // frame, so a grounded check afterwards never sees a take-off. Swimming reports
  // itself as grounded but jump does nothing there, so it doesn't cost a jump either.
  const jumped = [
    c1.jumpPressed && p1.grounded && !p1.swimming,
    c2.jumpPressed && p2.grounded && !p2.swimming,
  ];

  // Sprinting dies with the bar: each body runs on what its own belly still holds.
  p1.update(dt, c1, hunger1.hunger > 0);
  p2.update(dt, c2, hunger2.hunger > 0);
  rig1.update(dt);
  rig2.update(dt);
  // Aiming: ground items and trees each raycast for their nearest target, and the
  // closer one owns the crosshair. Ground items win a tie, since a small thing on the
  // ground has usually been deliberately lined up on.
  const itemCameras = [rig1.camera, rig2.camera];
  const itemAim = groundItems.aim(itemCameras);
  const treeAim = trees.aim(itemCameras, [inventory1, inventory2]);
  const labels = [null, null];
  for (let i = 0; i < 2; i++) {
    const itemDist = itemAim.dist[i] ?? Infinity;
    const treeDist = treeAim.dist[i] ?? Infinity;
    if (treeDist < itemDist) {
      labels[i] = treeAim.names[i];
      groundItems.clearAim(i);
    } else {
      labels[i] = itemAim.names[i];
      trees.clearAim(i);
    }
  }
  crosshair1.setLabel(labels[0], pressKey(0, inventory1));
  crosshair2.setLabel(labels[1], pressKey(1, inventory2));

  // A swing that actually started is a swing: the fist connects partway through the
  // third-second animation, and that is the frame the tree or bush takes its hit. Driving
  // this from the swing rather than the raw press keeps damage in step with the arm, and
  // caps chopping at the same three punches a second. A log on the ground breaks down
  // into sticks in the same beat when a wood-cutting tool is held.
  if (p1.swingHit) {
    if (trees.chopTarget(0)) {
      trees.chop(0, p1, inventory1);
    } else {
      const log = groundItems.logTarget(0, inventory1);
      if (log) groundItems.breakLog(log);
    }
  }
  if (p2.swingHit) {
    if (trees.chopTarget(1)) {
      trees.chop(1, p2, inventory2);
    } else {
      const log = groundItems.logTarget(1, inventory2);
      if (log) groundItems.breakLog(log);
    }
  }

  // The ghost of a structure in hand, standing on the spot it would be set down on:
  // green when that spot is clear, warm when something is already there. Loose things
  // like fish, sticks and kindling are set down without one.
  for (const [i, player, inventory, playerDead] of [
    [0, p1, inventory1, dead1],
    [1, p2, inventory2, dead2],
  ]) {
    const item = inventory.item;
    const soloSecondPlayer = i === 1 && input.players === 1;
    if (!item || !item.structure || playerDead || soloSecondPlayer) {
      groundItems.setPreview(i, null);
      continue;
    }
    const spot = placeTarget(player);
    groundItems.setPreview(
      i,
      item.id,
      spot.x,
      spot.z,
      player.yaw,
      groundItems.canPlace(item.id, spot.x, spot.z)
    );
  }
  // Picking something up can change what is in hand, so the models follow the bag.
  if (c1.pickPressed && groundItems.pick(0, inventory1)) syncHeld();
  if (c2.pickPressed && groundItems.pick(1, inventory2)) syncHeld();
  if (c1.dropPressed) dropHeld(0);
  if (c2.dropPressed) dropHeld(1);
  // Lighting: the bar climbs while the two triggers alternate. Backing out with B
  // drops the attempt and the camera eases back out; filling it lights the fire.
  for (const [index, lighting, rig] of [
    [0, lighting1, rig1],
    [1, lighting2, rig2],
  ]) {
    if (!lighting.isOpen) continue;
    const result = lighting.update(dt, index === 0 ? c1 : c2);
    if (result === 'lit') {
      finishLighting(index);
    } else if (result === 'cancelled') {
      lightingTargets[index] = null;
      rig.clearFocus();
    }
  }
  // Cooking by hand: leaning in over the fire runs the cook clock faster, and the fish
  // is turned on the beat. A clean flip rolls it and gives it a burst of heat, a burnt
  // edge takes time back, and a third burnt edge ruins the fish outright. The fish
  // coming off the clock, the fish burning, and backing out with B all end the game;
  // after the last two the fire finishes whatever is left on its own clock.
  for (const [index, cooking] of [
    [0, cooking1],
    [1, cooking2],
  ]) {
    if (!cooking.isOpen) continue;
    const record = cookingTargets[index];
    if (!record || !record.cook) {
      cooking.stop();
      endCooking(index, record);
      continue;
    }
    const done = groundItems.advanceCook(record, dt * MANUAL_RATE);
    const result = cooking.update(dt, index === 0 ? c1 : c2);
    if (result === 'flip') groundItems.flipFish(record);
    else if (result === 'miss') groundItems.advanceCook(record, -FLIP_LOSS);
    else if (result === 'burned') {
      // One turn too many: the fish is ruined, and there is nothing left to tend.
      groundItems.burnCook(record);
      cooking.stop();
      endCooking(index, record);
      continue;
    } else if (result === 'cancelled') {
      endCooking(index, record);
      continue;
    }
    const left = groundItems.cookTime - record.cook.time;
    cooking.setProgress(record.cook.time / groundItems.cookTime, left);
    if (done || record.cook.time >= groundItems.cookTime) {
      cooking.stop();
      endCooking(index, record);
    }
  }

  // The bite clock. Eating is holding RT down for the full second — the fist rises to
  // the mouth and nibbles the while — and only the moment the clock completes is the
  // food spent and the hunger fed. The progress is handed to the first-person hand
  // here, ahead of its own update, so the nibble shows on the same frame it advances.
  // Eating is two hands too: the hold doesn't survive death or a panel.
  const canEat = [!hold1, !hold2];
  for (const [index, track, controls, hunger] of [
    [0, eaten[0], spent1, hunger1],
    [1, eaten[1], spent2, hunger2],
  ]) {
    const inventory = index === 0 ? inventory1 : inventory2;
    const item = inventory.item;
    if (!item || !(item.hunger > 0) || !controls.useHeld || !canEat[index]) {
      track.id = null;
      track.time = 0;
    } else {
      // A different thing in hand (the item was eaten down to nothing, or the player
      // stepped slots) starts the hold over rather than topping the old one up.
      if (track.id !== item.id) {
        track.id = item.id;
        track.time = 0;
      }
      track.time += dt;
      if (track.time >= EAT_HOLD) {
        inventory.removeSelected();
        hunger.feed(item.hunger);
        syncHeld();
        track.id = null;
        track.time = 0;
      }
    }
    (index === 0 ? hand1 : hand2).setEating(track.time / EAT_HOLD);
  }

  underwater1.update(dt, rig1.camera.position.y);
  underwater2.update(dt, rig2.camera.position.y);
  // Breath ticks on the eyes being under the surface, matching the tint.
  breath1.update(dt, !dead1 && rig1.camera.position.y < 0);
  breath2.update(dt, !dead2 && rig2.camera.position.y < 0);

  // Hunger: distance covered while sprinting or swimming, plus jumps and swings, is
  // what spends the saturation buffer and then the bar itself.
  const travelled = [p1, p2].map((p, i) => {
    const d = Math.hypot(p.position.x - lastPos[i].x, p.position.z - lastPos[i].z);
    lastPos[i].x = p.position.x;
    lastPos[i].z = p.position.z;
    return d;
  });
  for (const [i, player, hunger] of [
    [0, p1, hunger1],
    [1, p2, hunger2],
  ]) {
    if (player.sprintActive) hunger.addExhaustion(travelled[i] * EXHAUSTION.sprintPerMetre);
    else if (player.swimming) hunger.addExhaustion(travelled[i] * EXHAUSTION.swimPerMetre);
    if (jumped[i]) hunger.addExhaustion(EXHAUSTION.jump);
    if (player.swingStarted) hunger.addExhaustion(EXHAUSTION.swing);
  }
  // A dead player's hunger is frozen, so healing can't pull them off the death screen.
  hunger1.update(dead1 ? 0 : dt);
  hunger2.update(dead2 ? 0 : dt);
  hand1.update(dt, p1);
  hand2.update(dt, p2);
  // Aim each carried rod at the tip its owner is looking at, so the line leaves the
  // rod in both players' views.
  p1.alignHeld(hand1);
  p2.alignHeld(hand2);
  ocean.update(dt);
  boat.update(dt);
  // Casting reads the rod tip and the sea surface, so it runs after both update.
  fishing1.update(dt, c1);
  fishing2.update(dt, c2);
  sky.update(dt);
  groundItems.update(dt);
  trees.update(dt);

  splitScreen.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Small handle so slice behaviour can be checked from the browser console.
window.__game = {
  renderer,
  scene,
  players: [p1, p2],
  rigs: [rig1, rig2],
  hands: [hand1, hand2],
  craftingMenus: [craftingMenuP1, craftingMenuP2],
  craftingMenu: craftingMenuP1,
  settingsPanels: [settingsPanelP1, settingsPanelP2],
  breath: [breath1, breath2],
  health: [health1, health2],
  hunger: [hunger1, hunger2],
  fishing: [fishing1, fishing2],
  groundItems,
  trees,
  sky,
  launch,
  lighting: [lighting1, lighting2],
  cooking: [cooking1, cooking2],
  inventory: [inventory1, inventory2],
  settings: [settingsP1, settingsP2],
  deathScreens: [deathScreen1, deathScreen2],
  input,
};
