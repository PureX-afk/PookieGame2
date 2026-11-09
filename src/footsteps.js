// Sound effects play real one-shot recordings: one per footstep surface, the rod cast,
// the fish bite and the catch jingle. The files are small and fetched as soon as the
// module loads, but nothing is decoded or played until the player picks a session:
// browsers only allow audio to start from a gesture.
const STEP_ROOT = new URL('../assets/audio/footsteps/', import.meta.url);
const EFFECT_ROOT = new URL('../assets/audio/effects/', import.meta.url);

const SURFACES = {
  sand: { url: new URL('sand-step-01.wav', STEP_ROOT), gain: 1 },
  grass: { url: new URL('grass-step-01.wav', STEP_ROOT), gain: 1 },
};

// One-shot effects share the footsteps' bus, so the Sound effects slider owns them too.
// `start` and `end` trim a recording that carries silence of its own, so a cast is heard
// the moment the rod is thrown instead of a second later. The cast clip is silent until
// 1.46 s; playing only the whip and the first of its tail, then fading the rest out, keeps
// the sound shorter than the wait for the bobber to land.
const EFFECTS = {
  cast: {
    url: new URL('fishing-rod-cast.mp3', EFFECT_ROOT),
    gain: 1,
    start: 1.44,
    end: 2.7,
    fade: 0.45,
  },
  // The bite is a short chirp that is silent for its first 0.15 s and peaks at almost
  // full scale, so it keeps a little headroom under the bus instead of matching the cast.
  bite: {
    url: new URL('fish-bite.mp3', EFFECT_ROOT),
    gain: 0.9,
    start: 0.14,
    end: 0.55,
    fade: 0.04,
  },
  // The catch flourish. It is already normalized and short, so it plays whole.
  jingle: {
    url: new URL('fishing-jingle.wav', EFFECT_ROOT),
    gain: 1,
    fade: 0.04,
  },
};

const ALL_SOUNDS = [...Object.values(SURFACES), ...Object.values(EFFECTS)];

// The sound-effects ceiling is deliberately conservative: 100% on the slider is
// the level that used to be 50%, so the whole bus sits under the music and world.
const MASTER_VOLUME = 0.425;
const STEP_GAIN = 1;

export function createFootsteps() {
  let context = null;
  let master = null;
  let unlocked = false;
  // 0-1, set from the settings panel. Kept here so it applies to every sound effect
  // that goes through the master bus.
  let volume = 1;

  const encoded = new Map();
  const buffers = new Map();

  // Fetching needs no gesture, so the bytes are usually waiting by the time the
  // first step or cast lands. Decoding still waits for the audio context.
  for (const sound of ALL_SOUNDS) {
    fetch(sound.url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.arrayBuffer();
      })
      .then((data) => encoded.set(sound.url.href, data))
      .catch((error) => console.warn(`Sound ${sound.url.pathname} failed to load:`, error));
  }

  function ensureContext() {
    if (context) return context;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    context = new AudioCtor();
    master = context.createGain();
    master.gain.value = MASTER_VOLUME * volume;
    master.connect(context.destination);
    return context;
  }

  // The settings panel owns the 0-1 value; clamp here so a bad save or a rounding
  // slip can never push the bus past full scale.
  function setVolume(value) {
    const next = Number(value);
    volume = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
    if (master) master.gain.value = MASTER_VOLUME * volume;
  }

  async function decode(sound) {
    const key = sound.url.href;
    if (buffers.has(key)) return buffers.get(key);
    if (!context) return null;
    let data = encoded.get(key);
    if (!data) {
      const response = await fetch(sound.url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      data = await response.arrayBuffer();
      encoded.set(key, data);
    }
    const buffer = await context.decodeAudioData(data);
    buffers.set(key, buffer);
    return buffer;
  }

  // Called from the click or key press that starts the session, which is the gesture
  // browsers require before an audio context may run.
  function unlock() {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
    for (const sound of ALL_SOUNDS) {
      decode(sound).catch((error) =>
        console.warn(`Sound ${sound.url.pathname} failed to decode:`, error),
      );
    }
  }

  function step(surface, { sprint = false, pan = 0 } = {}) {
    if (!unlocked || !context || context.state !== 'running') return;
    const spec = SURFACES[surface];
    if (!spec) return;
    const buffer = buffers.get(spec.url.href);
    // The very first steps may arrive while the sample is still decoding.
    if (!buffer) return;

    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = buffer;
    // A little pitch and level scatter keeps repeated steps from sounding like a
    // loop, and sprinting lands a touch harder and quicker.
    const rate = (0.96 + Math.random() * 0.08) * (sprint ? 1.07 : 1);
    source.playbackRate.value = rate;

    const level =
      STEP_GAIN * spec.gain * (0.86 + Math.random() * 0.28) * (sprint ? 1.12 : 1);
    const gain = context.createGain();
    gain.gain.value = level;

    const panner = context.createStereoPanner();
    panner.pan.value = pan;

    source.connect(gain).connect(panner).connect(master);
    source.start(now);

    // Each sample is a single footfall, already trimmed and faded where it was cut;
    // the short tail fade keeps it from ringing into the next step.
    const end = now + buffer.duration / rate;
    gain.gain.setValueAtTime(level, Math.max(now, end - 0.02));
    gain.gain.linearRampToValueAtTime(0, end);
    source.stop(end + 0.01);
  }

  // One-shot effects play the whole recording, faded out in its last few milliseconds
  // so a file cut mid-wave doesn't click. Nothing happens before unlock or while the
  // context is still suspended, so the cast stays silent until the game is running.
  function effect(name, { pan = 0, gain = 1 } = {}) {
    if (!unlocked || !context || context.state !== 'running') return;
    const spec = EFFECTS[name];
    if (!spec) return;
    const buffer = buffers.get(spec.url.href);
    // A sound requested before its decode finishes is simply skipped, never queued.
    if (!buffer) return;

    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = buffer;

    const level = spec.gain * gain;
    const out = context.createGain();
    out.gain.value = level;

    const panner = context.createStereoPanner();
    panner.pan.value = pan;

    // Play the kept part of the recording, skipping any silence at either end.
    const from = Math.max(0, Math.min(spec.start ?? 0, buffer.duration));
    const to = Math.max(from, Math.min(spec.end ?? buffer.duration, buffer.duration));
    const length = Math.max(0.02, to - from);

    source.connect(out).connect(panner).connect(master);
    source.start(now, from, length);

    // Effects carry their own fade length; steps keep the short anti-click one. Clamp it
    // so a long fade can never swallow the whole sound.
    const fade = Math.min(spec.fade ?? 0.03, length / 2);
    const end = now + length;
    out.gain.setValueAtTime(level, Math.max(now, end - fade));
    out.gain.linearRampToValueAtTime(0, end);
  }

  return {
    unlock,
    step,
    effect,
    setVolume,
    get volume() {
      return volume;
    },
    // For tests: true once a gesture has opened the context and a sample decoded.
    get ready() {
      return unlocked && buffers.size > 0;
    },
  };
}
