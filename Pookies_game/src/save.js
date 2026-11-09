// One save slot in localStorage. The whole session goes in as plain JSON, which is
// small enough that nothing clever is needed: no versions to migrate yet, just the
// shape the game writes and reads.
const KEY = 'driftwood.save.v1';

export function saveGame(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    // Private browsing, a full quota or storage switched off: the save just doesn't
    // happen, and the game carries on.
    console.warn('Could not save the game', error);
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && state.version === 1 ? state : null;
  } catch (error) {
    console.warn('Could not read the save', error);
    return null;
  }
}
