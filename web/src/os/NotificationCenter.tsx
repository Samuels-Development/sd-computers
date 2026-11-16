import { useEffect, useRef } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { useQuickSettings } from '@/store/quickSettings';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import { CalendarFlyout, ToastCard } from './Flyouts';

export default function NotificationCenter({ showCalendar }: { showCalendar: boolean }) {
  const notifications = useOS(s => s.notifications);
  const payload = useOS(s => s.payload)!;
  const focus = useQuickSettings(s => s.tiles.focus);
  const ref = useExitFx('fly-out');
  const focusRef = useRef<HTMLDivElement>(null);
  useEffect(() => { focusRef.current?.focus(); }, []);
  return (
    <div ref={ref} className="notification-center absolute right-3 bottom-[60px] w-[360px] max-w-[calc(100vw-24px)] max-h-[calc(100%-72px)] flex flex-col gap-3 overflow-y-auto os-scroll fly-up" style={{ zIndex: 9100 }} onMouseDown={e => e.stopPropagation()}>
      <div ref={focusRef} role="region" aria-label={t('ui.toast.title')} tabIndex={-1} className="acrylic rounded-win shadow-flyout shrink-0 outline-none">
        <div className="flex items-center gap-2 p-4 border-b border-stroke">
          {focus ? <BellOff size={18} /> : <Bell size={18} />}
          <h2 className="font-semibold text-body flex-1">{t('ui.toast.title')}</h2>
          {notifications.length > 0 && <button type="button" onClick={() => useOS.getState().clearNotifications()} className="px-2 py-1 rounded-ctl text-caption text-t2 hover:bg-subtle">{t('ui.toast.clear')}</button>}
          <button type="button" aria-label={t('ui.common.close')} onClick={() => useOS.getState().setFlyout(null)} className="w-7 h-7 flex items-center justify-center rounded-ctl hover:bg-subtle text-t2"><X size={16} /></button>
        </div>
        <div className="notification-list p-3 flex flex-col gap-2 overflow-y-auto os-scroll" style={{ maxHeight: 'max(140px, calc(100vh - 520px))' }}>
          {notifications.map(n => <ToastCard key={n.id} toast={n} label={payload.computer.apps.find(a => a.id === n.app)?.label ?? t('ui.toast.system')} center />)}
          {notifications.length === 0 && <div className="py-5 text-center text-t2">
            <Bell size={24} className="mx-auto mb-2 text-t3" />
            <p className="text-body font-semibold">{t('ui.toast.empty')}</p>
            <p className="text-caption mt-1">{t('ui.toast.empty_hint')}</p>
          </div>}
        </div>
      </div>
      {showCalendar && <CalendarFlyout embedded />}
    </div>
  );
}
