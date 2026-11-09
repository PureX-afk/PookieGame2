// Background music. Tracks are streamed through an <audio> element rather than
// decoded into AudioBuffers: each rolls into the next from the playlist and memory
// stays flat, while the footstep one-shots stay on the Web Audio bus.
//
// The speakers are shared by both players, so the playlist is too: either settings
// panel picks the song or turns shuffle on for both of them.
const TRACKS = [
  { title: 'Beginning', file: 'Beginning.mp3' },
  { title: 'Haggstrom', file: 'Haggstrom.mp3' },
];

const trackUrl = (index) =>
  new URL(`../assets/audio/music/${TRACKS[index].file}`, import.meta.url).href;

// The tracks are mastered hot (peaks near full scale), so 100% on the slider is still
// only half of the element's own volume. That leaves headroom for the footsteps.
const MAX_VOLUME = 0.5;
const DEFAULT_VOLUME = 0.7;

export function createMusic() {
  const audio = new Audio();
  audio.preload = 'auto';

  let volume = DEFAULT_VOLUME;
  let track = 0;
  let shuffle = false;
  // True between unlock() and stop(): the session is live, so a track that ends rolls
  // into the next one instead of leaving the game silent.
  let running = false;
  // The settings panels redraw their Song and Shuffle rows from these.
  const listeners = new Set();

  function applyVolume() {
    audio.volume = MAX_VOLUME * volume;
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function load(index) {
    track = ((index % TRACKS.length) + TRACKS.length) % TRACKS.length;
    audio.src = trackUrl(track);
    notify();
  }

  // Shuffle never repeats the track that just played, so a two-song playlist still
  // varies instead of landing on the same song twice.
  function nextTrack() {
    if (!shuffle || TRACKS.length < 2) return (track + 1) % TRACKS.length;
    const pick = Math.floor(Math.random() * (TRACKS.length - 1));
    return pick >= track ? pick + 1 : pick;
  }

  function start() {
    applyVolume();
    const started = audio.play();
    if (started && started.catch) {
      started.catch((error) => console.warn('Background music could not start:', error));
    }
  }

  audio.addEventListener('ended', () => {
    if (!running) return;
    load(nextTrack());
    start();
  });

  // Called from the click or key press that starts the session, so the browser has
  // the gesture it needs to allow playback.
  function unlock() {
    running = true;
    // A shuffled session opens somewhere random, the way an album shuffle would;
    // otherwise it picks up the song the settings left selected.
    if (shuffle) load(Math.floor(Math.random() * TRACKS.length));
    else if (!audio.src) load(track);
    start();
  }

  // Back to the title screen: the next session starts the selected song from the top.
  function stop() {
    running = false;
    audio.pause();
    if (audio.readyState > 0) audio.currentTime = 0;
  }

  function setVolume(value) {
    const next = Number(value);
    volume = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
    applyVolume();
  }

  // Manual selection from the Song row. It always walks the playlist in order, even
  // while shuffle is on; shuffle only decides what follows once a track finishes.
  function cycleTrack(direction = 1) {
    load(track + (direction < 0 ? -1 : 1));
    if (running) start();
  }

  function selectTrack(title) {
    const index = TRACKS.findIndex((entry) => entry.title === title);
    if (index < 0 || index === track) return false;
    load(index);
    if (running) start();
    return true;
  }

  function setShuffle(value) {
    shuffle = Boolean(value);
    notify();
  }

  return {
    unlock,
    stop,
    setVolume,
    cycleTrack,
    selectTrack,
    setShuffle,
    toggleShuffle() {
      setShuffle(!shuffle);
    },
    // Called by the panels so a finished or shuffled track refreshes the Song row.
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get tracks() {
      return TRACKS.map((entry) => entry.title);
    },
    get trackTitle() {
      return TRACKS[track].title;
    },
    get trackIndex() {
      return track;
    },
    get shuffle() {
      return shuffle;
    },
    get volume() {
      return volume;
    },
    get playing() {
      return !audio.paused;
    },
    // Diagnostics for the settings tests: the element's own 0-1 volume and playhead.
    get level() {
      return audio.volume;
    },
    get currentTime() {
      return audio.currentTime;
    },
  };
}
