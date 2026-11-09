// Sky dome, sun and moon, drifting clouds, stars and the lights that make the island
// read as bright and chunky. All of it runs on one clock: twenty minutes of day,
// twenty minutes of night, then round again.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const DOME_RADIUS = 2200;
const DAY_SECONDS = 20 * 60;
const NIGHT_SECONDS = 20 * 60;
const CYCLE_SECONDS = DAY_SECONDS + NIGHT_SECONDS;

// Day and night are one crossfade apart: everything below lerps between these.
const DAY = {
  top: new THREE.Color(PALETTE.skyTop),
  horizon: new THREE.Color(PALETTE.skyHorizon),
  fog: new THREE.Color(PALETTE.fog),
  sun: new THREE.Color(PALETTE.sunLight),
  hemiSky: new THREE.Color(0xbfe9ff),
  hemiGround: new THREE.Color(0xd9c49a),
  cloud: new THREE.Color(PALETTE.cloud),
  cloudShade: new THREE.Color(PALETTE.cloudShade),
  disc: new THREE.Color(PALETTE.sunDisc),
};

const NIGHT = {
  top: new THREE.Color(0x050a1c),
  horizon: new THREE.Color(0x122039),
  fog: new THREE.Color(0x0e1a2b),
  sun: new THREE.Color(PALETTE.moonLight),
  hemiSky: new THREE.Color(0x24304f),
  hemiGround: new THREE.Color(0x18202f),
  cloud: new THREE.Color(PALETTE.nightCloud),
  cloudShade: new THREE.Color(0x222c42),
  disc: new THREE.Color(PALETTE.moonDisc),
};

const DUSK = new THREE.Color(PALETTE.dusk);

function createDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      bottomColor: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vDir;
      void main() {
        float t = pow(clamp(vDir.y, 0.0, 1.0), 0.6);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 24, 16), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, material };
}

// One disc and one soft halo, reused for the sun and for the moon.
function createDisc(size, haloSize, distance) {
  const group = new THREE.Group();

  const discMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.sunDisc,
    fog: false,
  });
  const disc = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 10), discMaterial);
  disc.position.z = distance;

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.sunDisc,
    transparent: true,
    opacity: 0.16,
    fog: false,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(haloSize, 14, 10), haloMaterial);
  halo.position.copy(disc.position);

  group.add(disc, halo);
  return { group, discMaterial, haloMaterial };
}

function createStars() {
  const count = 700;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Upper hemisphere only, so none of them spend the night underwater.
    const y = 0.04 + Math.random() * 0.96;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * ring * DOME_RADIUS * 0.9;
    positions[i * 3 + 1] = y * DOME_RADIUS * 0.9;
    positions[i * 3 + 2] = Math.sin(angle) * ring * DOME_RADIUS * 0.9;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = -9;
  points.frustumCulled = false;
  return { points, material };
}

function createClouds() {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  // Unlit so the warm ground bounce can't tint them like floating rocks.
  const material = new THREE.MeshBasicMaterial({ color: PALETTE.cloud, fog: false });
  const shadeMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.cloudShade,
    fog: false,
  });

  const clusters = [];

  // Few and far apart: the sky reads better with room between them.
  for (let i = 0; i < 9; i++) {
    const cluster = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    const width = 26 + Math.random() * 26;

    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(geometry, p % 2 === 0 ? material : shadeMaterial);
      const s = width * (0.55 + Math.random() * 0.5);
      puff.scale.set(s, s * (0.34 + Math.random() * 0.2), s * (0.7 + Math.random() * 0.3));
      puff.position.set(
        (p - (puffs - 1) / 2) * width * 0.55 + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 14
      );
      cluster.add(puff);
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = 200 + Math.random() * 520;
    cluster.position.set(
      Math.cos(angle) * radius,
      95 + Math.random() * 70,
      Math.sin(angle) * radius
    );

    clusters.push({ cluster, speed: 1.4 + Math.random() * 2.2 });
    group.add(cluster);
  }

  const LIMIT = 780;

  function update(dt) {
    for (const { cluster, speed } of clusters) {
      cluster.position.x += speed * dt;
      if (cluster.position.x > LIMIT) cluster.position.x = -LIMIT;
    }
  }

  return { group, update, material, shadeMaterial };
}

export function createSky({ scene } = {}) {
  const group = new THREE.Group();

  const hemisphere = new THREE.HemisphereLight(0xbfe9ff, 0xd9c49a, 0.85);
  group.add(hemisphere);

  const sun = new THREE.DirectionalLight(PALETTE.sunLight, 2.1);
  sun.position.set(90, 130, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  group.add(sun);
  group.add(sun.target);

  // The moon lights the island while the sun is down. No shadows: one shadow map at
  // night is plenty to spend on nothing visible.
  const moon = new THREE.DirectionalLight(PALETTE.moonLight, 0);
  group.add(moon);
  group.add(moon.target);

  const clouds = createClouds();
  group.add(clouds.group);

  const dome = createDome();
  group.add(dome.mesh);

  const sunDisc = createDisc(38, 72, 1500);
  group.add(sunDisc.group);

  const moonDisc = createDisc(26, 52, 1400);
  group.add(moonDisc.group);

  const stars = createStars();
  group.add(stars.points);

  // Seconds into the current cycle. Sunrise is t = 0, sunset is t = DAY_SECONDS.
  let time = DAY_SECONDS * 0.28;
  let sunHeight = 1;
  let daylight = 1;

  const topColor = new THREE.Color();
  const horizonColor = new THREE.Color();
  const fogColor = new THREE.Color();
  const lightColor = new THREE.Color();
  const hemiSky = new THREE.Color();
  const hemiGround = new THREE.Color();
    const sunDirection = new THREE.Vector3();
  const moonDirection = new THREE.Vector3();
  // The discs are built facing +Z at their own distance, so a rotation aims them.
  const FORWARD = new THREE.Vector3(0, 0, 1);

  function apply() {
    // One angle drives both arcs: 0 at sunrise, PI at sunset, 2 PI back at dawn. The
    // sine of it is the sun's height, so day and moon are simply the two halves.
    const angle = (time / CYCLE_SECONDS) * Math.PI * 2;
    sunHeight = Math.sin(angle);
    // Eased so the light has a real dusk rather than snapping at the horizon.
    daylight = THREE.MathUtils.smoothstep(sunHeight, -0.12, 0.22);

    sunDirection.set(Math.cos(angle), sunHeight, 0.35).normalize();
    moonDirection.set(-Math.cos(angle), -sunHeight, 0.3).normalize();

    const night = 1 - daylight;
    // Warm band across the horizon either side of the changeover.
    const dusk = Math.max(0, 1 - Math.abs(sunHeight) / 0.34);

    topColor.lerpColors(DAY.top, NIGHT.top, night);
    horizonColor.lerpColors(DAY.horizon, NIGHT.horizon, night).lerp(DUSK, dusk * 0.55);
    fogColor.lerpColors(DAY.fog, NIGHT.fog, night).lerp(DUSK, dusk * 0.32);

    dome.material.uniforms.topColor.value.copy(topColor);
    dome.material.uniforms.bottomColor.value.copy(horizonColor);
    if (scene && scene.fog) scene.fog.color.copy(fogColor);
    if (scene && scene.background && scene.background.copy) scene.background.copy(fogColor);

    // Sun: strong and warm by day, gone at night. Near the horizon it reddens.
    lightColor.lerpColors(DAY.sun, DUSK, dusk * 0.7);
    sun.color.copy(lightColor);
    sun.intensity = 2.1 * daylight;
    sun.position.copy(sunDirection).multiplyScalar(180);

    // Moonlight is dim, cool and constant through the night.
    moon.color.copy(NIGHT.sun);
    moon.intensity = 0.5 * night;
    moon.position.copy(moonDirection).multiplyScalar(180);

    hemisphere.intensity = 0.85 * daylight + 0.2 * night;
    hemiSky.lerpColors(DAY.hemiSky, NIGHT.hemiSky, night);
    hemiGround.lerpColors(DAY.hemiGround, NIGHT.hemiGround, night);
    hemisphere.color.copy(hemiSky);
    hemisphere.groundColor.copy(hemiGround);

    // The discs ride their arcs and sink out of sight below the horizon.
    sunDisc.group.quaternion.setFromUnitVectors(FORWARD, sunDirection);
    sunDisc.discMaterial.color.lerpColors(DAY.disc, DUSK, dusk * 0.8);
    sunDisc.haloMaterial.color.copy(sunDisc.discMaterial.color);
    sunDisc.group.visible = sunHeight > -0.06;

    moonDisc.group.quaternion.setFromUnitVectors(FORWARD, moonDirection);
    moonDisc.discMaterial.color.copy(NIGHT.disc);
    moonDisc.haloMaterial.color.copy(NIGHT.disc);
    moonDisc.group.visible = -sunHeight > -0.06;

    stars.material.opacity = Math.min(1, night * 1.15) * (1 - dusk * 0.6);

    clouds.material.color.lerpColors(DAY.cloud, NIGHT.cloud, night);
    clouds.shadeMaterial.color.lerpColors(DAY.cloudShade, NIGHT.cloudShade, night);
  }

  apply();

  return {
    group,
    update(dt) {
      clouds.update(dt);
      time = (time + dt) % CYCLE_SECONDS;
      apply();
    },
    // Jump the clock, in seconds into the cycle (0 = sunrise, DAY_SECONDS = sunset).
    setTime(seconds) {
      time = ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
      apply();
    },
    get isNight() {
      return sunHeight < 0;
    },
    // 0 at sunrise, 1 at sunset, carrying on past that through the night.
    get timeOfDay() {
      return time / CYCLE_SECONDS;
    },
    get seconds() {
      return time;
    },
  };
}
