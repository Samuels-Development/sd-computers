import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Paintbrush, RefreshCw, SquareTerminal, Monitor, Pin, PinOff, X, ExternalLink, EyeOff, AppWindow } from 'lucide-react';
import { useOS, selectActiveId, taskbarPins, type WinApp } from '@/store/os';
import type { AppId, DesktopPosition } from '@/types';
import { t } from '@/i18n';
import { appFor } from '@/apps/registry';
import { useExitFx } from '@/hooks/useExitFx';
import { Wallpaper } from './Wallpaper';
import { AppIcon } from './icons';
import WindowFrame from './WindowFrame';
import Taskbar from './Taskbar';
import StartMenu from './StartMenu';
import { QuickSettings, Toasts } from './Flyouts';
import NotificationCenter from './NotificationCenter';
import AppBadge from './AppBadge';
import { desktopLayout, ICON_W, ICON_H } from './desktopLayout';

export default function Desktop() {
  const payload = useOS(s => s.payload)!;
  const settings = useOS(s => s.settings);
  const windows = useOS(s => s.windows);
  const activeId = useOS(selectActiveId);
  const start = useOS(s => s.start);
  const flyout = useOS(s => s.flyout);
  const { openApp, setStart, setFlyout } = useOS.getState();
  const [selected, setSelected] = useState<AppId | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; app?: WinApp; winId?: string; desktop?: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [iconGen, setIconGen] = useState(0);
  const menuRef = useExitFx('pop-out');
  const wallRef = useExitFx('wall-out', 560);
  const desktopSaving = useOS(s => s.desktopSaving);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [dragging, setDragging] = useState<{ app: AppId; x: number; y: number } | null>(null);
  const drag = useRef<{ app: AppId; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const lastDragAt = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cancel = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current) {
        e.preventDefault();
        drag.current = null;
        setDragging(null);
      }
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, []);
  const saving = useOS(s => s.taskbarSaving);
  const pinned = taskbarPins(payload, settings.taskbarPins);
  const showAppMenu = (app: WinApp, winId: string | undefined, x: number, y: number, desktop = false) => {
    setStart(false);
    setFlyout(null);
    const height = 8 + 32 * (1 + Number(!!winId) + Number(payload.computer.apps.some(a => a.id === app)) + Number(desktop));
    setMenu({ app, winId, desktop, x: Math.max(0, Math.min(x, window.innerWidth - 248)), y: Math.max(0, Math.min(y, window.innerHeight - 56 - height)) });
  };

  useEffect(() => {
    if (!menu) return;
    const dismiss = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-desktop-menu]')) setMenu(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setMenu(null); }
    };
    document.addEventListener('mousedown', dismiss, true);
    window.addEventListener('keydown', key);
    const menuElement = document.querySelector<HTMLElement>('[data-desktop-menu]');
    menuElement?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      document.removeEventListener('mousedown', dismiss, true);
      window.removeEventListener('keydown', key);
    };
  }, [menu]);

  useEffect(() => {
    const clamp = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const { windows: ws, resize } = useOS.getState();
      const bw = window.innerWidth;
      const bh = window.innerHeight - 48;
      for (const w of ws) {
        const nw = Math.min(w.w, bw - 16);
        const nh = Math.min(w.h, bh - 16);
        const nx = Math.max(8 - nw + 120, Math.min(w.x, bw - 120));
        const ny = Math.max(0, Math.min(w.y, bh - 32));
        if (nx !== w.x || ny !== w.y || nw !== w.w || nh !== w.h) resize(w.id, nx, ny, nw, nh);
      }
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, []);

  const dismiss = () => {
    setMenu(null);
    if (start) setStart(false);
    if (flyout) setFlyout(null);
  };

  const ids = [...new Set([...payload.computer.desktopIcons, ...payload.computer.apps.filter(a => settings.desktopHidden[a.id] === false).map(a => a.id)])];
  const icons = ids.map(id => payload.computer.apps.find(a => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a && settings.desktopHidden[a.id] !== true);
  const cols = Math.max(1, Math.floor((viewport.w - 8) / ICON_W));
  const rows = Math.max(1, Math.floor((viewport.h - 56) / ICON_H));
  const positions = desktopLayout(icons.map(a => a.id), settings.desktopPositions, cols, rows);
  const has = (id: AppId) => payload.computer.apps.some(a => a.id === id);
  const moveIcon = (app: AppId, target: DesktopPosition) => {
    const current = positions[app];
    if (!current || useOS.getState().desktopSaving) return;
    const next = { ...settings.desktopPositions, ...positions, [app]: target };
    const occupant = icons.find(a => a.id !== app && positions[a.id].col === target.col && positions[a.id].row === target.row);
    if (occupant) next[occupant.id] = current;
    void useOS.getState().saveDesktop({ desktopPositions: next });
  };
  const manageApps = (filter: 'all' | 'hidden') => {
    setMenu(null);
    openApp('settings', { page: 'apps', filter });
  };

  return (
    <div className="absolute inset-0 overflow-hidden" onMouseDown={dismiss}>
      <div className="desk-wall absolute inset-0">

        <div key={`${settings.wallpaper}|${settings.accent}`} ref={wallRef} className="absolute inset-0">
          <Wallpaper id={settings.wallpaper} accent={settings.accent} />
        </div>
      </div>

      <div
        className="absolute inset-0 bottom-12 overflow-auto os-scroll"
        data-desktop-area
        onMouseDown={() => setSelected(null)}
        onContextMenu={e => {
          e.preventDefault();
          setStart(false);
          setFlyout(null);
          setMenu({ x: Math.max(0, Math.min(e.clientX, window.innerWidth - 248)), y: Math.max(0, Math.min(e.clientY, window.innerHeight - 280)) });
        }}
      >

        <div key={iconGen} ref={gridRef} className={`relative min-h-full transition-opacity duration-150 ${refreshing ? 'opacity-0' : 'opacity-100'}`} style={{ width: Math.max(viewport.w - 8, ...Object.values(positions).map(p => (p.col + 1) * ICON_W + 8)) }}>
          {icons.map(a => (
            <button
              key={a.id}
              type="button"
              data-desktop-app={a.id}
              aria-label={a.label}
              title={`${a.label} — ${t('ui.desktop.move_hint')}`}
              style={{ left: dragging?.app === a.id ? dragging.x : positions[a.id].col * ICON_W + 6, top: dragging?.app === a.id ? dragging.y : positions[a.id].row * ICON_H + 6, zIndex: dragging?.app === a.id ? 2 : undefined }}
              onDragStart={e => e.preventDefault()}
              onPointerDown={e => {
                if (e.button !== 0 || desktopSaving) return;
                const rect = e.currentTarget.getBoundingClientRect();
                drag.current = { app: a.id, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, moved: false };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={e => {
                const d = drag.current;
                if (!d || d.app !== a.id) return;
                if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6 && !d.moved) return;
                d.moved = true;
                const rect = gridRef.current!.getBoundingClientRect();
                setDragging({ app: a.id, x: Math.max(6, Math.min(e.clientX - rect.left - d.offsetX, viewport.w - ICON_W)), y: Math.max(6, Math.min(e.clientY - rect.top - d.offsetY, viewport.h - 48 - ICON_H)) });
              }}
              onPointerUp={e => {
                const d = drag.current;
                if (d?.moved) {
                  lastDragAt.current = Date.now();
                  const rect = gridRef.current!.getBoundingClientRect();
                  moveIcon(a.id, { col: Math.max(0, Math.min(cols - 1, Math.round((e.clientX - rect.left - d.offsetX - 6) / ICON_W))), row: Math.max(0, Math.min(rows - 1, Math.round((e.clientY - rect.top - d.offsetY - 6) / ICON_H))) });
                }
                drag.current = null;
                setDragging(null);
              }}
              onPointerCancel={() => { drag.current = null; setDragging(null); }}
              onMouseDown={e => {
                e.stopPropagation();
                dismiss();
                setSelected(a.id);
              }}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                setSelected(a.id);
                showAppMenu(a.id, windows.find(w => w.id === a.id)?.id, e.clientX, e.clientY, true);
              }}
              onDoubleClick={() => { if (Date.now() - lastDragAt.current > 300) openApp(a.id); }}
              onKeyDown={e => {
                if (e.altKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                  e.preventDefault();
                  const p = positions[a.id];
                  moveIcon(a.id, { col: Math.max(0, Math.min(cols - 1, p.col + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0))), row: Math.max(0, Math.min(rows - 1, p.row + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0))) });
                } else if (e.key === 'Enter') openApp(a.id);
              }}
              className={`desktop-icon absolute touch-none w-[78px] h-[92px] ${dragging?.app === a.id ? 'is-dragging' : ''} flex flex-col items-center justify-start gap-1 pt-2 rounded-[4px] border ${
                selected === a.id ? 'bg-white/20 border-white/30' : 'border-transparent hover:bg-white/10'
              }`}
            >
              <span className="relative">
                <AppIcon app={a.id} size={42} />
                <AppBadge app={a.id} className="!-top-1 !-right-1.5" />
              </span>
              <span className="text-[12px] leading-[15px] text-white text-center px-0.5 line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)' }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {windows.map(w => {
        const App = appFor(w.app);
        return (
          <WindowFrame key={w.id} win={w} active={activeId === w.id}>
            <App win={w} />
          </WindowFrame>
        );
      })}

      <Taskbar onAppContextMenu={showAppMenu} />
      {start && <StartMenu />}
      {(flyout === 'calendar' || flyout === 'notifications') && <NotificationCenter showCalendar={flyout === 'calendar'} />}
      {flyout === 'quick' && <QuickSettings />}
      <Toasts />

      {menu && (
        <div
          key={`${menu.x},${menu.y}`}
          ref={menuRef}
          data-desktop-menu
          role="menu"
          aria-label={menu.app ? payload.computer.apps.find(a => a.id === menu.app)?.label : undefined}
          className="absolute w-60 acrylic rounded-win shadow-flyout py-1 pop-in origin-top-left"
          style={{ left: menu.x, top: menu.y, zIndex: 9300 }}
          onMouseDown={e => e.stopPropagation()}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}
          onKeyDown={e => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          {menu.app ? (
            <>
              <MenuItem icon={<ExternalLink size={16} />} label={t('ui.taskbar.open')} onClick={() => {
                if (menu.winId) useOS.getState().restore(menu.winId);
                else openApp(menu.app as AppId);
                setMenu(null);
              }} />
              {payload.computer.apps.some(a => a.id === menu.app) && (
                <MenuItem icon={pinned.includes(menu.app as AppId) ? <PinOff size={16} /> : <Pin size={16} />} label={t(pinned.includes(menu.app as AppId) ? 'ui.taskbar.unpin' : 'ui.taskbar.pin')} disabled={saving} onClick={() => {
                  void useOS.getState().setTaskbarPinned(menu.app as AppId, !pinned.includes(menu.app as AppId));
                  setMenu(null);
                }} />
              )}
              {menu.desktop && has('settings') && <MenuItem icon={<EyeOff size={16} />} label={t('ui.desktop.hide')} disabled={desktopSaving} onClick={() => {
                void useOS.getState().saveDesktop({ desktopHidden: { ...settings.desktopHidden, [menu.app!]: true } });
                setMenu(null);
              }} />}
              {menu.winId && <MenuItem icon={<X size={16} />} label={t('ui.common.close')} onClick={() => { useOS.getState().close(menu.winId!); setMenu(null); }} />}
            </>
          ) : (
            <>
              <MenuItem
                icon={<RefreshCw size={16} />}
                label={t('ui.desktop.refresh')}
                onClick={() => {
                  setMenu(null);
                  setRefreshing(true);
                  window.setTimeout(() => {
                    setRefreshing(false);
                    setIconGen(g => g + 1);
                  }, 180);
                }}
              />
              {has('settings') && (
                <>
                  <div className="h-px bg-stroke my-1 mx-2" />
                  <MenuItem icon={<AppWindow size={16} />} label={t('ui.desktop.manage_apps')} onClick={() => manageApps('all')} />
                  <MenuItem icon={<EyeOff size={16} />} label={t('ui.desktop.hidden_apps')} onClick={() => manageApps('hidden')} />
                  <MenuItem icon={<Monitor size={16} />} label={t('ui.desktop.display')} onClick={() => { setMenu(null); openApp('settings', { page: 'system' }); }} />
                  <MenuItem icon={<Paintbrush size={16} />} label={t('ui.desktop.personalize')} onClick={() => { setMenu(null); openApp('settings', { page: 'personalization' }); }} />
                </>
              )}
              {has('cmd') && (
                <>
                  <div className="h-px bg-stroke my-1 mx-2" />
                  <MenuItem icon={<SquareTerminal size={16} />} label={t('ui.desktop.terminal')} onClick={() => { setMenu(null); openApp('cmd'); }} />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className="disabled:opacity-50 w-[calc(100%-8px)] mx-1 flex items-center gap-3 h-8 px-3 rounded-ctl text-body text-t1 hover:bg-subtle">
      <span className="text-t1">{icon}</span>
      {label}
    </button>
  );
}
