import { create } from 'zustand';

type Tile = 'wifi' | 'bt' | 'air' | 'saver' | 'focus' | 'a11y';
interface QuickState {
  tiles: Record<Tile, boolean>;
  beforeAirplane: { wifi: boolean; bt: boolean };
  brightness: number;
  setBrightness: (value: number) => void;
  toggleTile: (key: Tile) => void;
}

export const useQuickSettings = create<QuickState>(set => ({
  tiles: { wifi: true, bt: true, air: false, saver: false, focus: false, a11y: false },
  beforeAirplane: { wifi: true, bt: true },
  brightness: 80,
  setBrightness: brightness => set({ brightness }),
  toggleTile: key => set(s => {
    const next = !s.tiles[key];
    if (key === 'air') return next
      ? { beforeAirplane: { wifi: s.tiles.wifi, bt: s.tiles.bt }, tiles: { ...s.tiles, air: true, wifi: false, bt: false } }
      : { tiles: { ...s.tiles, air: false, ...s.beforeAirplane } };
    return { tiles: { ...s.tiles, [key]: next, ...((key === 'wifi' || key === 'bt') && next ? { air: false } : {}) } };
  }),
}));
