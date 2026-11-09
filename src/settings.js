// Player-facing options, kept per player so the two can prefer different schemes.
export const SPRINT_MODES = ['hold', 'toggle'];
export const SPRINT_LABELS = { hold: 'Hold', toggle: 'Toggle' };

// HUD scale steps, applied to that player's hearts, breath and hotbar.
export const UI_SIZES = ['normal', 'large', 'huge'];
export const UI_SIZE_LABELS = { normal: 'Normal', large: 'Large', huge: 'Huge' };
export const UI_SCALE = { normal: 1, large: 1.3, huge: 1.6 };

const OPTIONS = { sprintMode: SPRINT_MODES, uiSize: UI_SIZES };

export function createSettings() {
  return {
    sprintMode: 'hold',
    uiSize: 'normal',
    cycle(key, direction = 1) {
      const list = OPTIONS[key];
      if (!list) return;
      const index = list.indexOf(this[key]);
      this[key] = list[(index + direction + list.length) % list.length];
    },
  };
}
