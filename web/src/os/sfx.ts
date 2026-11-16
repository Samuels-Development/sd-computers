import { useQuickSettings } from '@/store/quickSettings';
import { useAudio } from '@/store/audio';
import { useOS, type Toast } from '@/store/os';

const MASTER = 0.12;

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let hiss: AudioBuffer | null = null;

const outputVolume = (): number => {
  const { volume, muted } = useAudio.getState();
  return muted ? 0 : MASTER * volume / 100;
};

const audio = (): AudioContext | null => {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      out = ctx.createGain();
      out.gain.value = outputVolume();
      out.connect(ctx.destination);

      hiss = ctx.createBuffer(1, Math.floor(ctx.sampleRate / 2), ctx.sampleRate);
      const data = hiss.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
};

interface Tone {
  type?: OscillatorType;

  gain?: number;

  to?: number;
  slide?: number;

  attack?: number;
}

const note = (freq: number, at: number, dur: number, o: Tone = {}): void => {
  const a = audio();
  if (!a || !out) return;
  try {
    const t0 = a.currentTime + at;
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.slide ?? dur));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 1, t0 + (o.attack ?? 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {

  }
};

const air = (freq: number, at: number, dur: number, o: { gain?: number; to?: number; q?: number } = {}): void => {
  const a = audio();
  if (!a || !out || !hiss) return;
  try {
    const t0 = a.currentTime + at;
    const src = a.createBufferSource();
    src.buffer = hiss;
    src.loop = true;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(freq, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(o.gain ?? 1, t0 + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  } catch {

  }
};

type Cue = 'click' | 'open' | 'close' | 'minimize' | 'restore' | 'maximize' | 'notify' | 'boot' | 'logon' | 'logoff' | 'error';
type Voice = Record<Cue, () => void>;

const modern: Voice = {
  click: () => note(1320, 0, 0.05, { gain: 0.3, to: 990, attack: 0.002 }),

  open: () => {
    note(587.33, 0, 0.16, { gain: 0.42, attack: 0.006 });
    note(880, 0.06, 0.24, { gain: 0.42, attack: 0.006 });
  },
  close: () => {
    note(783.99, 0, 0.14, { gain: 0.4, attack: 0.006 });
    note(523.25, 0.06, 0.22, { gain: 0.38, attack: 0.006 });
  },

  minimize: () => note(698.46, 0, 0.28, { gain: 0.42, to: 349.23, slide: 0.11, attack: 0.008 }),
  restore: () => note(349.23, 0, 0.28, { gain: 0.42, to: 698.46, slide: 0.11, attack: 0.008 }),
  maximize: () => {
    note(440, 0, 0.26, { gain: 0.4, to: 880, slide: 0.1, attack: 0.008 });
    note(1318.5, 0.1, 0.22, { gain: 0.16 });
  },
  notify: () => {
    note(880, 0, 0.35, { type: 'triangle', gain: 0.7 });
    note(1318.5, 0.11, 0.5, { type: 'triangle', gain: 0.6 });
  },
  boot: () => [392, 587.33, 783.99, 1174.66].forEach((f, i) => note(f, i * 0.16, 1.6, { gain: 0.34, attack: 0.09 })),
  logon: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, i * 0.09, 0.9, { gain: 0.8 })),
  logoff: () => [1046.5, 783.99, 659.25, 523.25].forEach((f, i) => note(f, i * 0.1, 0.8, { gain: 0.55 })),
  error: () => {
    note(220, 0, 0.25, { type: 'square', gain: 0.25 });
    note(196, 0.08, 0.3, { type: 'square', gain: 0.2 });
  },
};

const HARBOR_CHORD: [number, number][] = [
  [92.5, 0.5],
  [185, 0.5],
  [277.18, 0.4],
  [369.99, 0.4],
  [466.16, 0.3],
  [554.37, 0.22],
  [739.99, 0.12],
];

const mac: Voice = {
  click: () => {
    note(460, 0, 0.06, { type: 'triangle', gain: 0.42, to: 320, attack: 0.002 });
    air(2600, 0, 0.014, { gain: 0.5, q: 2 });
  },

  open: () => note(250, 0, 0.2, { gain: 0.6, to: 640, slide: 0.07, attack: 0.004 }),
  close: () => note(600, 0, 0.2, { gain: 0.52, to: 220, slide: 0.09, attack: 0.004 }),

  minimize: () => {
    air(2600, 0, 0.3, { gain: 0.85, to: 420, q: 1.4 });
    note(520, 0, 0.28, { gain: 0.16, to: 240, slide: 0.2 });
  },
  restore: () => {
    air(420, 0, 0.28, { gain: 0.85, to: 2600, q: 1.4 });
    note(260, 0, 0.26, { gain: 0.16, to: 540, slide: 0.18 });
  },
  maximize: () => {
    air(600, 0, 0.2, { gain: 0.7, to: 3000, q: 1.4 });
    note(330, 0.02, 0.2, { gain: 0.4, to: 700, slide: 0.07, attack: 0.004 });
  },

  notify: () => {
    note(1174.66, 0, 1.1, { gain: 0.5, attack: 0.003 });
    note(1760, 0, 0.8, { gain: 0.28, attack: 0.003 });
    note(2637, 0, 0.4, { gain: 0.1, attack: 0.003 });
  },
  boot: () => HARBOR_CHORD.forEach(([f, gain]) => note(f, 0, 2.6, { type: f < 300 ? 'triangle' : 'sine', gain, attack: 0.03 })),
  logon: () => {
    note(659.25, 0, 0.5, { gain: 0.5, attack: 0.004 });
    note(987.77, 0.1, 0.8, { gain: 0.5, attack: 0.004 });
  },
  logoff: () => {
    note(987.77, 0, 0.4, { gain: 0.4, attack: 0.004 });
    note(659.25, 0.1, 0.7, { gain: 0.4, attack: 0.004 });
  },
  error: () => {
    note(311.13, 0, 0.16, { type: 'triangle', gain: 0.6, attack: 0.004 });
    note(233.08, 0.11, 0.26, { type: 'triangle', gain: 0.6, attack: 0.004 });
  },
};

const last: Partial<Record<Cue, number>> = {};

const play = (cue: Cue): void => {
  const p = useOS.getState().payload;
  if (cue === 'notify' && useQuickSettings.getState().tiles.focus) return;
  if (outputVolume() === 0 || !p || p.desktop.sounds === false || p.computer.style === 'retro') return;

  const now = performance.now();
  if (now - (last[cue] ?? -1000) < 40) return;
  last[cue] = now;
  (p.computer.style === 'mac' ? mac : modern)[cue]();
};

export const sfx = {

  logon: (): void => play('logon'),

  error: (): void => play('error'),

  notify: (): void => play('notify'),

  click: (): void => play('click'),
};

const PRESSABLE =
  'button, a[href], summary, select, input[type="checkbox"], input[type="radio"], [role="button"], [role="menuitem"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"], [data-sfx="press"]';

const QUIET = '.game, [data-sfx="off"]';

const newest = (toasts: Toast[]): number => (toasts.length ? toasts[toasts.length - 1].id : 0);

export function wireSounds(root: HTMLElement): () => void {
  const stopAudio = useAudio.subscribe(() => {
    if (ctx && out) out.gain.setTargetAtTime(outputVolume(), ctx.currentTime, 0.015);
  });

  if (useOS.getState().phase === 'boot') play('boot');

  const stop = useOS.subscribe((s, prev) => {
    if (s.phase !== prev.phase) {
      if (s.phase === 'boot') play('boot');
      else if (prev.phase === 'desktop' && (s.phase === 'lock' || s.phase === 'shutdown')) play('logoff');
    }

    if (newest(s.toasts) > newest(prev.toasts)) play('notify');

    if (s.windows === prev.windows || s.payload !== prev.payload) return;
    const before = new Map(prev.windows.map(w => [w.id, w]));
    for (const w of s.windows) {
      const was = before.get(w.id);
      if (!was) play('open');
      else if (w.exit && w.exit !== was.exit) play(w.exit === 'close' ? 'close' : 'minimize');
      else if (was.min && !w.min) play('restore');
      else if (w.max !== was.max) play(w.max ? 'maximize' : 'restore');
    }
  });

  const press = (e: PointerEvent) => {
    if (e.button !== 0 || !(e.target instanceof Element)) return;
    const el = e.target.closest(PRESSABLE);
    if (!el || el.closest(QUIET) || el.matches(':disabled, [aria-disabled="true"]')) return;
    play('click');
  };
  root.addEventListener('pointerdown', press, true);

  return () => {
    stop();
    stopAudio();
    root.removeEventListener('pointerdown', press, true);
  };
}
