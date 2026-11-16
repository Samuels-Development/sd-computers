import { create } from 'zustand';

interface AudioState {
  volume: number;
  muted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

export const useAudio = create<AudioState>(set => ({
  volume: 45,
  muted: false,
  setVolume: volume => {
    if (!Number.isFinite(volume)) return;
    set({ volume: Math.max(0, Math.min(100, volume)), muted: false });
  },
  toggleMute: () => set(s => s.muted || s.volume === 0
    ? { muted: false, volume: s.volume || 45 }
    : { muted: true }),
}));
