import { create } from 'zustand';
import type { AppId, OpenPayload, Theme, DesktopPosition } from '@/types';
import { t } from '@/i18n';
import { useQuickSettings } from './quickSettings';
import { rpc } from '@/nui/rpc';

export type Phase = 'off' | 'boot' | 'lock' | 'welcome' | 'desktop' | 'shutdown';

export type WinApp = AppId | 'hack' | 'mines' | 'solitaire' | 'snake';

export interface Win {
  id: string;
  app: WinApp;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  min: boolean;
  max: boolean;
  z: number;

  exit?: 'close' | 'min';

  props?: Record<string, unknown>;
  resizable: boolean;
}

export interface Toast {
  id: number;
  app: WinApp | 'system';
  title: string;
  body?: string;
  createdAt?: number;
  onClick?: () => void;
}

export interface Settings {
  desktopHidden: Record<string, boolean>;
  desktopPositions: Record<string, DesktopPosition>;
  taskbarPins: Record<string, boolean>;
  theme: Theme;
  wallpaper: string;
  accent: string;
}

export interface WindowSpec {
  id: string;
  app: WinApp;
  title: string;
  w: number;
  h: number;
  props?: Record<string, unknown>;
  resizable?: boolean;
}

interface OSState {
  payload: OpenPayload | null;
  phase: Phase;
  settings: Settings;
  windows: Win[];
  start: boolean;
  flyout: 'calendar' | 'notifications' | 'quick' | null;
  toasts: Toast[];
  notifications: Toast[];
  unreadNotifications: number;
  recent: { app: AppId; at: number }[];

  badges: Record<string, number>;

  bootWith: (p: OpenPayload) => void;
  setPhase: (p: Phase) => void;
  reset: () => void;
  setApps: (lists: Pick<OpenPayload['computer'], 'apps' | 'pinned' | 'desktopIcons' | 'badges'>) => void;
  setBadge: (app: string, count: number) => void;
  desktopSaving: boolean;
  saveDesktop: (patch: Partial<Pick<Settings, 'desktopHidden' | 'desktopPositions'>>) => Promise<boolean>;
  taskbarSaving: boolean;
  setTaskbarPinned: (app: AppId, pinned: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Settings>, persist?: boolean) => void;

  openApp: (app: AppId, props?: Record<string, unknown>) => void;
  openWindow: (spec: WindowSpec) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  finalize: (id: string) => void;
  restore: (id: string) => void;
  toggleMax: (id: string) => void;
  move: (id: string, x: number, y: number) => void;
  resize: (id: string, x: number, y: number, w: number, h: number) => void;
  closeAll: () => void;
  setProps: (id: string, props: Record<string, unknown>) => void;
  retitle: (id: string, title: string) => void;

  setStart: (open: boolean) => void;
  setFlyout: (f: 'calendar' | 'notifications' | 'quick' | null) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  dismissNotification: (id: number) => void;
  clearNotifications: () => void;
}

export const TASKBAR_H = 48;

let boundsProvider: (() => { w: number; h: number }) | null = null;

export const setBoundsProvider = (fn: (() => { w: number; h: number }) | null): void => {
  boundsProvider = fn;
};

export const desktopBounds = (): { w: number; h: number } =>
  boundsProvider ? boundsProvider() : { w: window.innerWidth, h: window.innerHeight - TASKBAR_H };

let zCounter = 10;
let spawnCount = 0;
let toastSeq = 0;
let sessionGeneration = 0;

const closeGuards = new Map<string, () => boolean>();

export const setCloseGuard = (id: string, guard: (() => boolean) | null): void => {
  if (guard) closeGuards.set(id, guard);
  else closeGuards.delete(id);
};

export const taskbarPins = (p: OpenPayload, overrides: Record<string, boolean>): AppId[] =>
  [...new Set([...p.computer.pinned, ...p.computer.apps.filter(a => overrides[a.id] === true).map(a => a.id)])]
    .filter(id => overrides[id] !== false && p.computer.apps.some(a => a.id === id));

const defaults = (p: OpenPayload | null): Settings => ({
  desktopHidden: p?.settings.desktopHidden ?? {},
  desktopPositions: p?.settings.desktopPositions ?? {},
  taskbarPins: p?.settings.taskbarPins ?? {},
  theme: p?.settings.theme ?? p?.desktop.defaultTheme ?? 'dark',
  wallpaper: p?.settings.wallpaper ?? p?.desktop.defaultWallpaper ?? 'petals-dark',
  accent: p?.settings.accent ?? p?.desktop.accents[0] ?? '#4cc2ff',
});

const place = (w: number, h: number): { x: number; y: number; w: number; h: number } => {
  const b = desktopBounds();
  const n = spawnCount++ % 7;
  const ww = Math.min(w, b.w - 24);
  const hh = Math.min(h, b.h - 24);
  const baseX = Math.round((b.w - ww) / 2) - 120 + n * 30;
  const baseY = Math.round((b.h - hh) / 2) - 60 + n * 30;
  return {
    x: Math.max(8, Math.min(baseX, b.w - ww - 8)),
    y: Math.max(8, Math.min(baseY, b.h - hh - 8)),
    w: ww,
    h: hh,
  };
};

export const useOS = create<OSState>((set, get) => ({
  payload: null,
  phase: 'off',
  taskbarSaving: false,
  desktopSaving: false,
  settings: defaults(null),
  windows: [],
  start: false,
  flyout: null,
  toasts: [],
  notifications: [],
  unreadNotifications: 0,
  recent: [],
  badges: {},

  bootWith: p => {
    sessionGeneration++;
    spawnCount = 0;
    closeGuards.clear();
    set({
      payload: p,
      taskbarSaving: false,
      desktopSaving: false,
      notifications: [],
      unreadNotifications: 0,
      phase: p.desktop.boot ? 'boot' : 'lock',
      settings: defaults(p),
      windows: [],
      start: false,
      flyout: null,
      toasts: [],
      badges: p.computer.badges ?? {},
    });
  },

  setPhase: phase => set({ phase, start: false, flyout: null }),

  reset: () => {
    sessionGeneration++;
    closeGuards.clear();
    boundsProvider = null;
    set({ payload: null, phase: 'off', taskbarSaving: false, desktopSaving: false, notifications: [], unreadNotifications: 0, windows: [], start: false, flyout: null, toasts: [], badges: {} });
  },

  setApps: lists =>
    set(s => {
      if (!s.payload) return s;
      const has = new Set<string>(lists.apps.map(a => a.id));

      const owner = (app: WinApp): string => (app === 'mines' || app === 'solitaire' || app === 'snake' ? 'games' : app);
      const gone = s.windows.filter(w => w.app !== 'hack' && !has.has(owner(w.app)));
      for (const w of gone) closeGuards.delete(w.id);
      return {
        payload: { ...s.payload, computer: { ...s.payload.computer, apps: lists.apps, pinned: lists.pinned, desktopIcons: lists.desktopIcons } },
        windows: gone.length > 0 ? s.windows.filter(w => !gone.includes(w)) : s.windows,
        recent: s.recent.filter(r => has.has(r.app)),
        badges: lists.badges ?? s.badges,
      };
    }),

  setBadge: (app, count) =>
    set(s => {
      const badges = { ...s.badges };
      if (count > 0) badges[app] = count;
      else delete badges[app];
      return { badges };
    }),

  saveDesktop: async patch => {
    if (get().desktopSaving || get().payload?.computer.style !== 'modern') return false;
    const generation = sessionGeneration;
    const previous = Object.fromEntries(Object.keys(patch).map(key => [key, get().settings[key as keyof Settings]]));
    set(s => ({ desktopSaving: true, settings: { ...s.settings, ...patch } }));
    try {
      const res = await rpc('profile:save', { settings: patch });
      if (generation !== sessionGeneration) return false;
      if (!res.ok) {
        set(s => ({ settings: { ...s.settings, ...previous } }));
        get().toast({ app: 'system', title: res.error ?? t('ui.desktop.save_failed') });
        return false;
      }
      return true;
    } catch {
      if (generation === sessionGeneration) {
        set(s => ({ settings: { ...s.settings, ...previous } }));
        get().toast({ app: 'system', title: t('ui.desktop.save_failed') });
      }
      return false;
    } finally {
      if (generation === sessionGeneration) set({ desktopSaving: false });
    }
  },

  setTaskbarPinned: async (app, pinned) => {
    const s = get();
    if (s.taskbarSaving || !s.payload?.computer.apps.some(a => a.id === app)) return;
    const pins = { ...s.settings.taskbarPins, [app]: pinned };
    const generation = sessionGeneration;
    set({ taskbarSaving: true });
    try {
      const res = await rpc('profile:save', { settings: { taskbarPins: pins } });
      if (sessionGeneration !== generation) return;
      if (res.ok) set(state => ({ settings: { ...state.settings, taskbarPins: pins } }));
      else get().toast({ app: 'system', title: res.error ?? t('ui.taskbar.save_failed') });
    } catch {
      if (sessionGeneration === generation) get().toast({ app: 'system', title: t('ui.taskbar.save_failed') });
    } finally {
      if (sessionGeneration === generation) set({ taskbarSaving: false });
    }
  },

  updateSettings: (patch, persist = true) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    if (persist) void rpc('profile:save', { settings: patch });
  },

  openApp: (app, props) => {
    const p = get().payload;
    const def = p?.computer.apps.find(a => a.id === app);
    if (!def) return;
    const existing = get().windows.find(w => w.id === app);
    set(s => ({ start: false, recent: [{ app, at: Date.now() }, ...s.recent.filter(r => r.app !== app)].slice(0, 6) }));
    if (existing) {
      set(s => ({
        windows: s.windows.map(w => (w.id === app ? { ...w, min: false, exit: undefined, z: ++zCounter, props: props ?? w.props } : w)),
      }));
      return;
    }
    const rect = place(def.w, def.h);
    set(s => ({
      windows: [...s.windows, { id: app, app, title: def.label, ...rect, min: false, max: false, z: ++zCounter, props, resizable: def.resizable !== false }],
    }));
    void rpc('shell:launch', { app });
  },

  openWindow: spec => {
    const existing = get().windows.find(w => w.id === spec.id);
    if (existing) {
      get().restore(spec.id);
      return;
    }
    const rect = place(spec.w, spec.h);
    set(s => ({
      start: false,
      windows: [
        ...s.windows,
        { id: spec.id, app: spec.app, title: spec.title, ...rect, min: false, max: false, z: ++zCounter, props: spec.props, resizable: spec.resizable ?? true },
      ],
    }));
  },

  focus: id => {
    const top = get().windows.reduce((m, w) => Math.max(m, w.z), 0);
    const win = get().windows.find(w => w.id === id);
    if (!win || (win.z === top && !win.min)) return;
    set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, z: ++zCounter } : w)) }));
  },

  close: id => {
    const guard = closeGuards.get(id);
    if (guard && !guard()) return;
    set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, exit: 'close' } : w)) }));
  },

  minimize: id => set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, exit: 'min' } : w)) })),

  finalize: id =>
    set(s => {
      const w = s.windows.find(x => x.id === id);
      if (!w || !w.exit) return s;
      if (w.exit === 'close') {
        closeGuards.delete(id);
        return { windows: s.windows.filter(x => x.id !== id) };
      }
      return { windows: s.windows.map(x => (x.id === id ? { ...x, min: true, exit: undefined } : x)) };
    }),

  restore: id =>
    set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, min: false, exit: undefined, z: ++zCounter } : w)) })),

  toggleMax: id =>
    set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, max: !w.max, min: false, z: ++zCounter } : w)) })),

  move: (id, x, y) => set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, x, y } : w)) })),

  resize: (id, x, y, w, h) => set(s => ({ windows: s.windows.map(win => (win.id === id ? { ...win, x, y, w, h } : win)) })),

  closeAll: () => {
    closeGuards.clear();
    set({ windows: [] });
  },

  setProps: (id, props) => set(s => ({ windows: s.windows.map(w => (w.id === id ? { ...w, props: { ...w.props, ...props } } : w)) })),

  retitle: (id, title) => set(s => ({ windows: s.windows.map(w => (w.id === id && w.title !== title ? { ...w, title } : w)) })),

  setStart: open => set({ start: open, flyout: null }),

  setFlyout: f => set({ flyout: f, start: false, ...(f === 'notifications' || f === 'calendar' ? { unreadNotifications: 0, toasts: [] } : {}) }),

  toast: t => {
    const id = ++toastSeq;
    const notification = { ...t, id, createdAt: Date.now() };
    set(s => ({
      toasts: s.flyout === 'calendar' || s.flyout === 'notifications' || useQuickSettings.getState().tiles.focus ? s.toasts : [...s.toasts, notification].slice(-3),
      notifications: [notification, ...s.notifications].slice(0, 50),
      unreadNotifications: s.flyout === 'calendar' || s.flyout === 'notifications' ? 0 : Math.min(50, s.unreadNotifications + 1),
    }));
    window.setTimeout(() => get().dismissToast(id), 6500);
  },

  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  dismissNotification: id => set(s => ({
    notifications: s.notifications.filter(t => t.id !== id),
    toasts: s.toasts.filter(t => t.id !== id),
    unreadNotifications: s.unreadNotifications - Number(s.notifications.slice(0, s.unreadNotifications).some(t => t.id === id)),
  })),
  clearNotifications: () => set({ notifications: [], toasts: [], unreadNotifications: 0 }),
}));

export const leaveBlockedBy = (): string | null => {
  const os = useOS.getState();
  for (const w of os.windows) {
    const guard = closeGuards.get(w.id);
    if (guard && !guard()) {
      os.restore(w.id);
      return w.id;
    }
  }
  return null;
};

export const selectActiveId = (s: { windows: Win[] }): string | null => {
  let best: Win | null = null;
  for (const w of s.windows) {
    if (w.min || w.exit) continue;
    if (!best || w.z > best.z) best = w;
  }
  return best ? best.id : null;
};
