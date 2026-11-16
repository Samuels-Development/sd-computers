import { useState } from 'react';
import { Check, Image as ImageIcon, LayoutGrid, Lock, Palette, PanelBottom, Shapes } from 'lucide-react';
import { useOS } from '@/store/os';
import type { Theme } from '@/types';
import { t } from '@/i18n';
import { Wallpaper } from '@/os/Wallpaper';
import { Button, Select, TextInput } from '@/ui/controls';
import { Expander, Group, MonitorPreview, PageHeader, Row, SubRow } from '../ui';
import type { Go } from '../nav';

const URL_MAX = 500;

/** A custom wallpaper must be an absolute https:// URL (the server accepts nothing else). */
const isHttpsUrl = (raw: string): boolean => {
  const s = raw.trim();
  if (!/^https:\/\//i.test(s) || /\s/.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
};

/** Black or white, whichever reads better on a swatch. */
const checkColor = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
};

/**
 * Personalization - the one Settings page that changes things: wallpaper (built-ins or an https
 * image), light/dark mode and the accent colour. Every change goes through updateSettings, which
 * restyles the OS instantly and persists to the character's profile.
 */
export default function PersonalizationPage({ go }: { go: Go }) {
  const desktop = useOS(s => s.payload!.desktop);
  const settings = useOS(s => s.settings);
  const update = useOS.getState().updateSettings;
  // Retro is always the classic grey (no light/dark), and its accent paints the active title bar.
  const retro = desktop.style === 'retro';

  const builtIn = desktop.wallpapers.some(w => w.id === settings.wallpaper);
  const wallpaperLabel = builtIn ? desktop.wallpapers.find(w => w.id === settings.wallpaper)!.label : t('ui.settings.bg_custom');

  return (
    <>
      <PageHeader title={t('ui.settings.nav_personalization')} />

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mb-6">
        <MonitorPreview width={240} />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body min-w-0">
          <dt className="text-t2">{t('ui.settings.bg')}</dt>
          <dd className="text-t1 truncate">{wallpaperLabel}</dd>
          {!retro && (
            <>
              <dt className="text-t2">{t('ui.settings.mode')}</dt>
              <dd className="text-t1">{settings.theme === 'dark' ? t('ui.settings.mode_dark') : t('ui.settings.mode_light')}</dd>
            </>
          )}
          <dt className="text-t2">{retro ? t('ui.settings.accent_titlebar') : t('ui.settings.accent')}</dt>
          <dd className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-[3px] border border-stroke-strong" style={{ background: settings.accent }} />
            <span className="text-t1 font-mono text-caption uppercase">{settings.accent}</span>
          </dd>
        </dl>
      </div>

      <Group>
        <Expander
          defaultOpen
          icon={<ImageIcon size={20} strokeWidth={1.5} />}
          title={t('ui.settings.bg')}
          description={t('ui.settings.bg_desc')}
          trailing={<span className="max-w-[160px] truncate">{wallpaperLabel}</span>}
        >
          <BackgroundPicker />
        </Expander>

        <Expander icon={<Palette size={20} strokeWidth={1.5} />} title={t('ui.settings.colors')} description={t('ui.settings.colors_desc')}>
          {!retro && (
            <SubRow label={t('ui.settings.mode_choose')} description={t('ui.settings.mode_choose_desc')}>
              <Select aria-label={t('ui.settings.mode_choose')} className="w-[140px]" value={settings.theme} onChange={value => update({ theme: value as Theme })}>
                <option value="light">{t('ui.settings.mode_light')}</option>
                <option value="dark">{t('ui.settings.mode_dark')}</option>
              </Select>
            </SubRow>
          )}
          <div className="settings-inset pl-[60px] pr-4 py-4" data-setting={t('ui.settings.accent')} tabIndex={-1}>
            <div className="text-body text-t1 mb-3">{retro ? t('ui.settings.accent_titlebar_choose') : t('ui.settings.accent_choose')}</div>
            <div className="flex flex-wrap gap-2">
              {desktop.accents.map(hex => {
                const on = settings.accent.toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    aria-label={hex}
                    aria-pressed={on}
                    onClick={() => update({ accent: hex })}
                    className={`relative w-9 h-9 rounded-ctl flex items-center justify-center transition-transform duration-100 hover:scale-105 ${on ? 'outline outline-2 outline-offset-2 outline-[var(--text-1)]' : ''}`}
                    style={{ background: hex }}
                  >
                    {on && <Check size={18} strokeWidth={2.5} style={{ color: checkColor(hex) }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </Expander>

        <Row icon={<Shapes size={20} strokeWidth={1.5} />} title={t('ui.settings.themes')} description={t('ui.settings.themes_desc')} onClick={() => go('themes')} />
        <Row icon={<Lock size={20} strokeWidth={1.5} />} title={t('ui.settings.lockscreen')} description={t('ui.settings.lockscreen_desc')} onClick={() => go('lockscreen')} />
        <Row icon={<LayoutGrid size={20} strokeWidth={1.5} />} title={t('ui.settings.start')} description={t('ui.settings.start_desc')} onClick={() => go('start')} />
        <Row icon={<PanelBottom size={20} strokeWidth={1.5} />} title={t('ui.settings.taskbar')} description={t('ui.settings.taskbar_desc')} onClick={() => go('taskbar')} />
      </Group>
    </>
  );
}

/** Built-in wallpaper thumbnails (plus the current custom image, if any) and the URL box. */
function BackgroundPicker() {
  const desktop = useOS(s => s.payload!.desktop);
  const settings = useOS(s => s.settings);
  const update = useOS.getState().updateSettings;
  const builtIn = desktop.wallpapers.some(w => w.id === settings.wallpaper);
  const [url, setUrl] = useState(builtIn ? '' : settings.wallpaper);
  const [invalid, setInvalid] = useState(false);

  const thumbs = builtIn ? desktop.wallpapers : [...desktop.wallpapers, { id: settings.wallpaper, label: t('ui.settings.bg_custom') }];

  const apply = () => {
    const v = url.trim();
    if (!isHttpsUrl(v)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    update({ wallpaper: v });
  };

  return (
    <div className="settings-inset pl-[60px] pr-4 py-4">
      <div className="text-body text-t1 mb-3">{t('ui.settings.bg_choose')}</div>
      <div className="flex flex-wrap gap-3 mb-6">
        {thumbs.map(w => {
          const on = w.id === settings.wallpaper;
          return (
            <button
              key={w.id}
              type="button"
              title={w.label}
              aria-label={w.label}
              aria-pressed={on}
              onClick={() => update({ wallpaper: w.id })}
              className={`group relative w-[140px] h-[80px] rounded-win overflow-hidden transition-[outline-color] ${
                on ? 'outline outline-[3px] outline-offset-2 outline-accent' : 'outline outline-1 outline-[var(--stroke-strong)] hover:outline-2 hover:outline-[var(--text-3)]'
              }`}
            >
              <Wallpaper id={w.id} accent={settings.accent} />
              <span className="absolute left-0 right-0 bottom-0 px-2 py-0.5 text-[11px] leading-4 text-white text-left truncate bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                {w.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-body text-t1 mb-1" data-setting={t('ui.settings.bg_url')} tabIndex={-1}>{t('ui.settings.bg_url')}</div>
      <div className="text-caption text-t2 mb-2">{t('ui.settings.bg_url_desc')}</div>
      <div className="flex items-start gap-2 max-w-[560px]">
        <div className="flex-1 min-w-0">
          <TextInput
            value={url}
            maxLength={URL_MAX}
            placeholder="https://"
            aria-invalid={invalid}
            onChange={e => {
              setUrl(e.target.value);
              if (invalid) setInvalid(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') apply();
            }}
          />
          {invalid && <div className="mt-1 text-caption text-critical">{t('ui.settings.bg_url_invalid')}</div>}
        </div>
        <Button variant="accent" disabled={url.trim() === ''} onClick={apply}>
          {t('ui.settings.apply')}
        </Button>
      </div>
    </div>
  );
}
