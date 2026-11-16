import { Clock, Globe, Languages, RefreshCw } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { fmtTime, useNow } from '@/lib/format';
import { Select, Toggle } from '@/ui/controls';
import { Group, PageHeader, Row } from '../ui';

/** Time & language: the live clock and read-only time settings (the server owns the format). */
export default function TimePage() {
  const clock24 = useOS(s => s.payload!.desktop.clock24);
  const now = useNow(1000);
  const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <PageHeader title={t('ui.settings.nav_time')} />

      <div className="mb-6">
        <div className="font-display text-hero font-semibold text-t1 tabular-nums">{fmtTime(now, clock24)}</div>
        <div className="text-body text-t2">{date}</div>
      </div>

      <Group title={t('ui.settings.date_time')}>
        <Row icon={<RefreshCw size={20} strokeWidth={1.5} />} title={t('ui.settings.time_auto')} description={t('ui.settings.time_auto_desc')}>
          <Toggle checked disabled onChange={() => undefined} label={t('ui.settings.on')} />
        </Row>
        <Row icon={<Globe size={20} strokeWidth={1.5} />} title={t('ui.settings.time_zone')}>
          <Select aria-label={t('ui.settings.time_zone')} className="w-[220px]" value="ls" disabled onChange={() => undefined}>
            <option value="ls">{t('ui.settings.time_zone_value')}</option>
          </Select>
        </Row>
        <Row icon={<Clock size={20} strokeWidth={1.5} />} title={t('ui.settings.clock24')} description={t('ui.settings.clock24_desc')}>
          <Toggle checked={clock24} disabled onChange={() => undefined} label={clock24 ? t('ui.settings.on') : t('ui.settings.off')} />
        </Row>
      </Group>

      <Group title={t('ui.settings.language')}>
        <Row icon={<Languages size={20} strokeWidth={1.5} />} title={t('ui.settings.display_language')} description={t('ui.settings.display_language_desc')}>
          {t('ui.settings.display_language_value')}
        </Row>
      </Group>
    </>
  );
}
