import { useEffect, useState } from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';
import type { AppId } from '@/types';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { AppIcon } from '@/os/icons';
import { Button, Select, TextInput } from '@/ui/controls';
import { PageHeader } from '../ui';

type Filter = 'all' | 'visible' | 'hidden';

export default function AppsPage({ request }: { request?: Record<string, unknown> }) {
  const payload = useOS(s => s.payload)!;
  const hidden = useOS(s => s.settings.desktopHidden);
  const saving = useOS(s => s.desktopSaving);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(request?.filter === 'hidden' ? 'hidden' : 'all');
  const [sort, setSort] = useState('name');
  useEffect(() => {
    setFilter(request?.filter === 'hidden' ? 'hidden' : 'all');
    setQuery('');
  }, [request]);
  const isHidden = (id: AppId) => hidden[id] ?? !payload.computer.desktopIcons.includes(id);
  const apps = payload.computer.apps.filter(a =>
    (!query.trim() || `${a.label} ${a.id}`.toLowerCase().includes(query.trim().toLowerCase())) &&
    (filter === 'all' || isHidden(a.id) === (filter === 'hidden')),
  ).sort((a, b) => sort === 'visibility' ? Number(isHidden(b.id)) - Number(isHidden(a.id)) || a.label.localeCompare(b.label) : a.label.localeCompare(b.label));
  return (
    <>
      <PageHeader title={t('ui.settings.nav_apps')} />
      <p className="text-body text-t2 mb-5">{t('ui.settings.apps_hint')}</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-t2 pointer-events-none" />
          <TextInput aria-label={t('ui.settings.apps_search')} placeholder={t('ui.settings.apps_search')} value={query} onChange={e => setQuery(e.target.value)} className="w-full pl-9" />
        </div>
        <Select className="!w-auto flex-1 min-w-[150px]" aria-label={t('ui.settings.apps_filter')} value={filter} onChange={e => setFilter(e.target.value as Filter)}>
          {(['all', 'visible', 'hidden'] as const).map(f => <option key={f} value={f}>{t(`ui.settings.apps_${f}`)}</option>)}
        </Select>
        <Select className="!w-auto flex-1 min-w-[140px]" aria-label={t('ui.settings.apps_sort')} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="name">{t('ui.settings.apps_sort_name')}</option>
          <option value="visibility">{t('ui.settings.apps_sort_hidden')}</option>
        </Select>
      </div>
      <div className="text-caption text-t2 mb-3" aria-live="polite">{apps.length === 1 ? t('ui.settings.apps_count_one') : t('ui.settings.apps_count', apps.length)}</div>
      <div className="flex flex-col gap-2">
        {apps.map(a => (
          <div key={a.id} className="flex items-center gap-3 p-3 bg-card border border-stroke rounded-win fade-in">
            <AppIcon app={a.id} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-body font-semibold text-t1 truncate">{a.label}</div>
              <div className="text-caption text-t2">{t(isHidden(a.id) ? 'ui.settings.apps_hidden' : 'ui.settings.apps_visible')}</div>
            </div>
            <Button compact variant="subtle" onClick={() => useOS.getState().openApp(a.id)}>{t('ui.taskbar.open')}</Button>
            <Button compact disabled={saving} icon={isHidden(a.id) ? <Eye size={14} /> : <EyeOff size={14} />} aria-label={t(isHidden(a.id) ? 'ui.settings.apps_show_named' : 'ui.settings.apps_hide_named', a.label)} onClick={() => {
              void useOS.getState().saveDesktop({ desktopHidden: { ...hidden, [a.id]: !isHidden(a.id) } });
            }}>{t(isHidden(a.id) ? 'ui.settings.apps_show' : 'ui.settings.apps_hide')}</Button>
          </div>
        ))}
        {apps.length === 0 && <div className="p-8 text-center text-body text-t2 bg-card border border-stroke rounded-win">{t('ui.settings.apps_empty')}</div>}
      </div>
    </>
  );
}
