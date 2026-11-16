import { useEffect, useRef, useState, type ReactNode, type MouseEventHandler } from 'react';
import { Bell, BellDot, Plane, Search, Wifi, WifiOff, Volume2, VolumeX, BatteryFull } from 'lucide-react';
import { useQuickSettings } from '@/store/quickSettings';
import { useAudio } from '@/store/audio';
import { useOS, selectActiveId, taskbarPins, TASKBAR_H, type Win, type WinApp } from '@/store/os';
import type { AppId } from '@/types';
import { fmtShortDate, fmtTime, useNow } from '@/lib/format';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { AppIcon, OsLogo } from './icons';
import AppBadge from './AppBadge';

interface Item {
  key: string;
  app: WinApp;
  label: string;
  win?: Win;
  pinned: boolean;
}

export default function Taskbar({ onAppContextMenu }: { onAppContextMenu: (app: WinApp, winId: string | undefined, x: number, y: number) => void }) {
  const network = useQuickSettings(s => s.tiles);
  const unread = useOS(s => s.unreadNotifications);
  const silent = useAudio(s => s.muted || s.volume === 0);
  const payload = useOS(s => s.payload)!;
  const pins = useOS(s => s.settings.taskbarPins);
  const windows = useOS(s => s.windows);
  const activeId = useOS(selectActiveId);
  const start = useOS(s => s.start);
  const flyout = useOS(s => s.flyout);
  const { setStart, setFlyout, openApp, focus, restore, minimize } = useOS.getState();
  const now = useNow(5000);

  const settled = useRef(false);
  useEffect(() => {
    settled.current = true;
  }, []);

  const labelOf = (app: AppId) => payload.computer.apps.find(a => a.id === app)?.label ?? app;
  const items: Item[] = taskbarPins(payload, pins).map(app => ({ key: app, app, label: labelOf(app), win: windows.find(w => w.id === app), pinned: true }));
  for (const w of windows) {
    if (!items.some(i => i.key === w.id)) items.push({ key: w.id, app: w.app, label: w.title, win: w, pinned: false });
  }

  const click = (it: Item) => {
    setStart(false);
    if (!it.win) {
      openApp(it.app as AppId);
      return;
    }
    if (it.win.min) restore(it.win.id);
    else if (activeId === it.win.id) minimize(it.win.id);
    else focus(it.win.id);
  };

  const showDesktop = () => {
    for (const w of useOS.getState().windows) if (!w.min && !w.exit) minimize(w.id);
  };

  return (
    <div
      className="task-rise absolute left-0 right-0 bottom-0 acrylic-bar border-t border-stroke flex items-center"
      style={{ height: TASKBAR_H, zIndex: 9000 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <TaskButton active={start} label={t('ui.taskbar.start')} onClick={() => setStart(!start)}>
          <OsLogo size={24} />
        </TaskButton>
        <TaskButton label={t('ui.taskbar.search')} onClick={() => setStart(true)}>
          <Search size={20} className="text-t1" />
        </TaskButton>
        {items.map(it => {
          const running = !!it.win;
          const isActive = running && activeId === it.win!.id;
          return (
            <TaskButton key={it.key} label={it.label} onClick={() => click(it)} active={isActive} fresh={settled.current}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                onAppContextMenu(it.app, it.win?.id, e.clientX, window.innerHeight - TASKBAR_H - 8);
              }}
            >
              <AppIcon app={it.app} size={24} />
              <AppBadge app={it.app} />
              <span
                className="absolute bottom-[3px] left-1/2 -translate-x-1/2 h-[3px] rounded-full transition-all duration-200"
                style={{ width: running ? (isActive ? 16 : 6) : 0, opacity: running ? 1 : 0, background: isActive ? 'var(--accent-fill)' : 'var(--text-3)' }}
              />
            </TaskButton>
          );
        })}
      </div>
      <div className="flex-1 flex items-center justify-end h-full pr-0">
        <button
          type="button"
          aria-label={t('ui.quick.controls')}
          onClick={() => setFlyout(flyout === 'quick' ? null : 'quick')}
          className={`h-10 px-2.5 flex items-center gap-2.5 rounded-ctl hover:bg-subtle text-t1 ${flyout === 'quick' ? 'bg-subtle' : ''}`}
        >
          {network.air ? <Plane size={16} /> : network.wifi ? <Wifi size={16} /> : <WifiOff size={16} />}
          {silent ? <VolumeX size={16} /> : <Volume2 size={16} />}
          <BatteryFull size={16} className={network.saver ? 'text-yellow-400' : ''} />
        </button>
        <button
          type="button"
          aria-label={t('ui.toast.center')}
          aria-expanded={flyout === 'calendar'}
          onClick={() => setFlyout(flyout === 'calendar' ? null : 'calendar')}
          className={`h-10 px-2.5 ml-0.5 flex flex-col items-end justify-center rounded-ctl hover:bg-subtle text-t1 text-caption leading-[16px] ${flyout === 'calendar' ? 'bg-subtle' : ''}`}
        >
          <span>{fmtTime(now, payload.desktop.clock24)}</span>
          <span>{fmtShortDate(now)}</span>
        </button>
        <button
          type="button"
          aria-label={`${t('ui.toast.center')}${unread ? ` (${unread})` : ''}`}
          aria-expanded={flyout === 'calendar'}
          title={t('ui.toast.center')}
          onClick={() => setFlyout(flyout === 'notifications' ? null : 'notifications')}
          className={`w-8 h-10 ml-0.5 flex items-center justify-center rounded-ctl text-t1 hover:bg-subtle ${flyout === 'notifications' ? 'bg-subtle' : ''}`}
        >
          {unread > 0 ? <BellDot size={16} className="text-accent-text" /> : <Bell size={16} />}
        </button>
        <button type="button" title={t('ui.taskbar.show_desktop')} onClick={showDesktop} className="w-3 h-full ml-1.5 border-l border-stroke hover:bg-subtle" />
      </div>
    </div>
  );
}

function TaskButton({ children, label, onClick, onContextMenu, active, fresh }: { children: ReactNode; label: string; onClick: () => void; onContextMenu?: MouseEventHandler<HTMLButtonElement>; active?: boolean; fresh?: boolean }) {
  const [enter] = useState(fresh);
  const ref = useExitFx<HTMLButtonElement>('task-out');
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative w-10 h-10 flex items-center justify-center rounded-ctl hover:bg-subtle active:scale-90 ${active ? 'bg-subtle' : ''} ${enter ? 'task-in' : ''}`}
    >
      {children}
    </button>
  );
}
