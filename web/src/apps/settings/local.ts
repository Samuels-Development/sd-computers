import { create } from 'zustand';

export interface Cosmetic {
  notifications: boolean;
  power: 'balanced' | 'performance' | 'efficiency';
  toggles: Record<string, boolean>;
}

interface LocalState extends Cosmetic {
  set: (patch: Partial<Cosmetic>) => void;
  toggle: (key: string, fallback: boolean) => void;
}

export const useLocal = create<LocalState>(set => ({
  notifications: true,
  power: 'balanced',
  toggles: {},
  set: patch => set(patch),
  toggle: (key, fallback) => set(s => ({ toggles: { ...s.toggles, [key]: !(s.toggles[key] ?? fallback) } })),
}));
