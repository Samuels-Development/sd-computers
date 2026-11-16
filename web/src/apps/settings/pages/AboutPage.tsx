import { useEffect, useRef, useState } from 'react';
import { Check, Laptop, Monitor } from 'lucide-react';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Button } from '@/ui/controls';
import { Expander, Group, PageHeader, copyText } from '../ui';
import { OsLogo } from '@/os/icons';
import { deviceId, productId } from '../device';
import type { Go } from '../nav';

/** System > About: device and OS specifications, built from the computer's own facts. */
export default function AboutPage({ go }: { go: Go }) {
  const p = useOS(s => s.payload!);
  const c = p.computer;

  const device: [string, string][] = [
    [t('ui.settings.spec_device_name'), c.hostname],
    [t('ui.settings.spec_processor'), t('ui.settings.spec_processor_value')],
    [t('ui.settings.spec_ram'), t('ui.settings.spec_ram_value')],
    [t('ui.settings.spec_device_id'), deviceId(c.id)],
    [t('ui.settings.spec_product_id'), productId(c.id)],
    [t('ui.settings.spec_system_type'), t('ui.settings.spec_system_type_value')],
    [t('ui.settings.spec_ip'), c.ip],
  ];
  const osSpecs: [string, string][] = [
    [t('ui.settings.spec_edition'), p.desktop.osName],
    [t('ui.settings.spec_version'), t('ui.settings.spec_version_value')],
    [t('ui.settings.spec_os_build'), p.desktop.osBuild],
    [t('ui.settings.spec_experience'), t('ui.settings.spec_experience_value')],
  ];

  return (
    <>
      <PageHeader parent={t('ui.settings.nav_system')} onParent={() => go('system')} title={t('ui.settings.about')} />

      <div className="settings-device-card flex items-center gap-4 rounded-win border border-stroke bg-card px-4 py-4 mb-6 min-w-0">
        <Laptop size={40} strokeWidth={1.2} className="shrink-0 text-accent-text" />
        <div className="flex-1 min-w-0">
          <div className="text-subtitle font-semibold text-t1 truncate">{c.hostname}</div>
          <div className="text-body text-t2 truncate">{c.label}</div>
        </div>
        <Button disabled title={t('ui.settings.managed_short')}>
          {t('ui.settings.rename_pc')}
        </Button>
      </div>

      <Group>
        <Expander
          defaultOpen
          icon={<Monitor size={20} strokeWidth={1.5} />}
          title={t('ui.settings.device_specs')}
          trailing={<CopyButton rows={device} />}
        >
          <SpecList rows={device} />
        </Expander>
        <Expander
          defaultOpen
          icon={<OsLogo size={20} />}
          title={t('ui.settings.os_specs')}
          trailing={<CopyButton rows={osSpecs} />}
        >
          <SpecList rows={osSpecs} />
        </Expander>
      </Group>
    </>
  );
}

function SpecList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="settings-specs grid grid-cols-[minmax(120px,180px)_1fr] gap-x-6 gap-y-2.5 pl-[60px] pr-4 py-4 text-body">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-t2">{k}</dt>
          <dd className="text-t1 break-all select-text">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyButton({ rows }: { rows: [string, string][] }) {
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Button
      compact
      icon={done ? <Check size={14} /> : undefined}
      onClick={() => {
        void copyText(rows.map(([k, v]) => `${k}\t${v}`).join('\n')).then(ok => {
          if (!ok) return;
          setDone(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setDone(false), 1600);
        });
      }}
    >
      {done ? t('ui.settings.copied') : t('ui.settings.copy')}
    </Button>
  );
}

