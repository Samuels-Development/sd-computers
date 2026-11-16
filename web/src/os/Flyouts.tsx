import { useState, type ReactNode } from 'react';
import { Accessibility, Airplay, BatteryFull, BatteryCharging, Bluetooth, ChevronDown, ChevronUp, Moon, Plane, Settings as Gear, Sun, Volume2, VolumeX, Wifi, X } from 'lucide-react';
import { useQuickSettings } from '@/store/quickSettings';
import { useAudio } from '@/store/audio';
import { useOS, type Toast } from '@/store/os';
import { fmtLongDate, fmtTime, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { AppIcon } from './icons';

export function CalendarFlyout({ embedded = false }: { embedded?: boolean }) {
  const now = useNow(30000);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(() => window.innerHeight >= 700);

  const [paged, setPaged] = useState<'next' | 'prev' | null>(null);
  const page = (by: 1 | -1) => {
    setOffset(o => o + by);
    setPaged(by > 0 ? 'next' : 'prev');
  };
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const startDay = view.getDay();
  const daysIn = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const prevDays = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
  const cells: { d: number; cur: boolean; today: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const n = i - startDay + 1;
    if (n < 1) cells.push({ d: prevDays + n, cur: false, today: false });
    else if (n > daysIn) cells.push({ d: n - daysIn, cur: false, today: false });
    else cells.push({ d: n, cur: true, today: offset === 0 && n === now.getDate() });
  }
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return (
    <Panel embedded={embedded}>
      <button type="button" aria-label={t('ui.toast.calendar')} aria-expanded={expanded} onClick={() => setExpanded(v => !v)} className="w-full px-4 py-3 border-b border-stroke text-body font-semibold text-t1 flex items-center justify-between hover:bg-subtle">
        {fmtLongDate(now)}{expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {expanded && <div className="p-4 fade-in">
        <div className="flex items-center justify-between mb-3">
          <div key={offset} className={`text-body font-semibold text-t1 ${paged ? 'fade-in' : ''}`}>{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          <div className="flex gap-1">
            <button type="button" aria-label={t('ui.toast.previous_month')} onClick={() => page(-1)} className="w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle active:scale-90 text-t1"><ChevronUp size={16} /></button>
            <button type="button" aria-label={t('ui.toast.next_month')} onClick={() => page(1)} className="w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle active:scale-90 text-t1"><ChevronDown size={16} /></button>
          </div>
        </div>
        <div key={offset} className={`grid grid-cols-7 gap-y-1 text-center ${paged ? `cal-${paged}` : ''}`}>
          {weekdays.map(w => <div key={w} className="text-caption text-t1 h-8 flex items-center justify-center">{w}</div>)}
          {cells.map((c, i) => (
            <div key={i} className="h-10 flex items-center justify-center">
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-full text-body ${c.today ? 'bg-accent text-accent-on font-semibold' : c.cur ? 'text-t1 hover:bg-subtle' : 'text-t3'}`}
              >
                {c.d}
              </span>
            </div>
          ))}
        </div>
      </div>}
    </Panel>
  );
}

export function QuickSettings() {
  const payload = useOS(s => s.payload)!;
  const { openApp, setFlyout } = useOS.getState();
  const { tiles: on, toggleTile, brightness: bright, setBrightness: setBright } = useQuickSettings();
  const { volume, muted, setVolume, toggleMute } = useAudio();
  const silent = muted || volume === 0;
  const tiles: { key: keyof typeof on; icon: ReactNode; label: string }[] = [
    { key: 'wifi', icon: <Wifi size={16} />, label: t('ui.quick.wifi') },
    { key: 'bt', icon: <Bluetooth size={16} />, label: t('ui.quick.bluetooth') },
    { key: 'air', icon: <Plane size={16} />, label: t('ui.quick.airplane') },
    { key: 'saver', icon: <BatteryCharging size={16} />, label: t('ui.quick.saver') },
    { key: 'focus', icon: <Moon size={16} />, label: t('ui.quick.focus') },
    { key: 'a11y', icon: <Accessibility size={16} />, label: t('ui.quick.accessibility') },
  ];
  const hasSettings = payload.computer.apps.some(a => a.id === 'settings');
  return (
    <Panel>
      <div className="p-5 grid grid-cols-3 gap-x-3 gap-y-4">
        {tiles.map(tl => (
          <div key={tl.key} className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              aria-label={tl.label}
              aria-pressed={on[tl.key]}
              onClick={() => {
                if (tl.key === 'focus' && !on.focus) useOS.setState({ toasts: [] });
                toggleTile(tl.key);
              }}
              className={`quick-tile w-full h-12 rounded-ctl flex items-center justify-center border active:scale-95 ${
                on[tl.key] ? 'bg-accent text-accent-on border-transparent hover:bg-accent-hover' : 'bg-control border-stroke-strong text-t1 hover:bg-control-hover'
              }`}
            >
              {tl.icon}
            </button>
            <span className="text-caption text-t1 truncate max-w-full">{tl.label}</span>
              </div>
        ))}
      </div>
      <div className="px-5 pb-5 flex flex-col gap-4">
        <Slider label={t('ui.settings.display_brightness')} icon={<Sun size={16} />} value={bright} onChange={setBright} />
        <Slider label={t('ui.settings.sound_volume')} icon={
          <button type="button" onClick={toggleMute} aria-pressed={silent} aria-label={t(silent ? 'ui.quick.unmute' : 'ui.quick.mute')} title={t(silent ? 'ui.quick.unmute' : 'ui.quick.mute')} className="quick-mute">
            <span className="quick-mute-icons" aria-hidden="true">
              <Volume2 size={16} className={silent ? 'is-hidden' : ''} />
              <VolumeX size={16} className={silent ? '' : 'is-hidden'} />
            </span>
          </button>
        } value={silent ? 0 : volume} onChange={setVolume} />
      </div>
      <div className="h-12 px-4 flex items-center justify-between border-t border-stroke bg-[var(--card)]">
        <span className="flex items-center gap-2 text-caption text-t1"><BatteryFull size={16} className={on.saver ? 'text-yellow-400' : ''} />100%</span>
        <div className="flex items-center gap-1">
          <span className="w-8 h-8 flex items-center justify-center text-t1"><Airplay size={16} /></span>
          {hasSettings && (
            <button type="button" title={t('ui.quick.settings')} onClick={() => { openApp('settings'); setFlyout(null); }} className="w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle text-t1">
              <Gear size={16} />
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Slider({ icon, label, value, onChange }: { icon: ReactNode; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-t1">
      <span className="w-8 h-8 shrink-0 flex items-center justify-center">{icon}</span>
      <input type="range" aria-label={label} min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1" style={{ accentColor: 'var(--accent-fill)' }} />
    </div>
  );
}

function Panel({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  const ref = useExitFx('fly-out');
  return (
    <div ref={ref} className={`${embedded ? 'relative shrink-0 w-full' : 'absolute right-3 bottom-[60px] w-[360px] max-w-[calc(100vw-24px)] fly-up'} acrylic rounded-win shadow-flyout overflow-hidden`} style={{ zIndex: 9100 }} onMouseDown={e => e.stopPropagation()}>
      {children}
    </div>
  );
}

export function Toasts() {
  const toasts = useOS(s => s.toasts);
  const flyout = useOS(s => s.flyout);
  const focus = useQuickSettings(s => s.tiles.focus);
  const payload = useOS(s => s.payload);
  const labelOf = (app: string) => payload?.computer.apps.find(a => a.id === app)?.label ?? t('ui.toast.system');
  return (
    <div aria-live="polite" aria-relevant="additions" className="absolute right-3 bottom-[60px] flex flex-col gap-2 items-end max-h-[calc(100%-72px)] overflow-hidden" style={{ zIndex: 9200 }} onMouseDown={e => e.stopPropagation()}>
      {flyout !== 'calendar' && !focus && toasts.map(tst => (
        <ToastCard key={tst.id} toast={tst} label={labelOf(tst.app)} />
      ))}
    </div>
  );
}

export function ToastCard({ toast, label, center = false }: { toast: Toast; label: string; center?: boolean }) {
  const { dismissToast, dismissNotification, setFlyout } = useOS.getState();
  const ref = useExitFx('toast-out', 340);
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const content = <>
    <div className="text-body font-semibold text-t1 break-words">{toast.title}</div>
    {toast.body && <div className="text-body text-t2 line-clamp-3 mt-1">{toast.body}</div>}
  </>;
  return (
    <article ref={ref} aria-label={toast.title} className={`notification-card ${center ? 'w-full bg-card border border-stroke rounded-win' : 'w-[364px] max-w-[calc(100vw-24px)] acrylic rounded-win shadow-flyout'} p-3 toast-in`}>
      <div className="flex items-center gap-2 mb-2">
        <AppIcon app={toast.app} size={16} />
        <span className="flex-1 text-caption text-t2 truncate">{label}</span>
        {toast.createdAt && <time className="text-[11px] text-t3" dateTime={new Date(toast.createdAt).toISOString()}>{fmtTime(new Date(toast.createdAt), clock24)}</time>}
        <button type="button" aria-label={t('ui.toast.dismiss')} title={t('ui.toast.dismiss')} onClick={() => { if (center) dismissNotification(toast.id); else dismissToast(toast.id); }} className="w-7 h-7 shrink-0 flex items-center justify-center rounded-ctl hover:bg-subtle text-t2">
          <X size={14} />
        </button>
      </div>
      {toast.onClick ? <button type="button" className="w-full text-left rounded-ctl hover:bg-subtle p-1 -m-1" aria-label={`${t('ui.toast.open')}: ${toast.title}`} onClick={() => {
        toast.onClick?.();
        dismissNotification(toast.id);
        if (center) setFlyout(null);
      }}>{content}</button> : <div className="p-1 -m-1">{content}</div>}
    </article>
  );
}
