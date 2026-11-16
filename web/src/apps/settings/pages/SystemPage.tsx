import { Bell, Info, Monitor, Power, Sun, Volume2 } from 'lucide-react';
import { useQuickSettings } from '@/store/quickSettings';
import { useAudio } from '@/store/audio';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Select, Toggle } from '@/ui/controls';
import { Group, MonitorPreview, PageHeader, Row, Slider } from '../ui';
import { useLocal } from '../local';
import type { Go } from '../nav';

export default function SystemPage({ go }: { go: Go }) {
  const computer = useOS(s => s.payload!.computer);
  const local = useLocal();
  const { brightness, setBrightness } = useQuickSettings();
  const { volume, muted, setVolume } = useAudio();

  return (
    <>
      <PageHeader title={t('ui.settings.nav_system')} />

      <div className="settings-device-banner flex items-center gap-6 mb-6 min-w-0">
        <MonitorPreview width={168} />
        <div className="min-w-0">
          <div className="text-subtitle font-semibold text-t1 truncate">{computer.hostname}</div>
          <div className="text-body text-t2 truncate">{computer.label}</div>
          <button type="button" onClick={() => go('about')} className="mt-1 text-body text-accent-text hover:underline">
            {t('ui.settings.system_device_details')}
          </button>
        </div>
      </div>

      <Group>
        <Row icon={<Monitor size={20} strokeWidth={1.5} />} title={t('ui.settings.display')} description={t('ui.settings.display_desc')}>
          <Sun size={16} className="text-t2" />
          <Slider className="w-[160px]" value={brightness} onChange={setBrightness} label={t('ui.settings.display_brightness')} />
        </Row>
        <Row icon={<Volume2 size={20} strokeWidth={1.5} />} title={t('ui.settings.sound')} description={t('ui.settings.sound_desc')}>
          <span className="w-7 text-right tabular-nums">{muted ? 0 : volume}</span>
          <Slider className="w-[160px]" value={muted ? 0 : volume} onChange={setVolume} label={t('ui.settings.sound_volume')} />
        </Row>
        <Row icon={<Bell size={20} strokeWidth={1.5} />} title={t('ui.settings.notifications')} description={t('ui.settings.notifications_desc')}>
          <Toggle
            checked={local.notifications}
            onChange={v => local.set({ notifications: v })}
            label={local.notifications ? t('ui.settings.on') : t('ui.settings.off')}
          />
        </Row>
        <Row icon={<Power size={20} strokeWidth={1.5} />} title={t('ui.settings.power')} description={t('ui.settings.power_desc')}>
          <Select aria-label={t('ui.settings.power')} className="w-[200px]" value={local.power} onChange={value => local.set({ power: value as typeof local.power })}>
            <option value="efficiency">{t('ui.settings.power_efficiency')}</option>
            <option value="balanced">{t('ui.settings.power_balanced')}</option>
            <option value="performance">{t('ui.settings.power_performance')}</option>
          </Select>
        </Row>
        <Row icon={<Info size={20} strokeWidth={1.5} />} title={t('ui.settings.about')} description={t('ui.settings.about_desc')} onClick={() => go('about')} />
      </Group>
    </>
  );
}
