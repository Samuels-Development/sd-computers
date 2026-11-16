import { t } from '@/i18n';
import type { OsStyle } from '@/types';
import { PARENT, type PageId } from './nav';

export interface SettingResult {
  page: PageId;
  key: string;
  target?: string;
  expand?: string;
  aliases?: string;
}

const entries: SettingResult[] = [
  ...['display', 'sound', 'notifications', 'power', 'about'].map(key => ({ page: 'system' as const, key })),
  { page: 'system', key: 'display_brightness', target: 'display', aliases: 'screen dim' },
  { page: 'system', key: 'sound_volume', target: 'sound', aliases: 'audio speaker mute' },
  ...['device_specs', 'os_specs'].map(key => ({ page: 'about' as const, key })),
  ...['spec_device_name', 'spec_processor', 'spec_ram', 'spec_device_id', 'spec_product_id', 'spec_system_type', 'spec_ip'].map(key => ({ page: 'about' as const, key, target: 'device_specs', expand: 'device_specs' })),
  ...['spec_edition', 'spec_version', 'spec_os_build', 'spec_experience'].map(key => ({ page: 'about' as const, key, target: 'os_specs', expand: 'os_specs' })),
  { page: 'personalization', key: 'bg', aliases: 'wallpaper photo picture image' },
  ...['colors', 'themes', 'lockscreen', 'start', 'taskbar'].map(key => ({ page: 'personalization' as const, key })),
  { page: 'personalization', key: 'bg_url', target: 'bg_url', expand: 'bg', aliases: 'wallpaper background custom image photo' },
  { page: 'personalization', key: 'mode_choose', expand: 'colors', aliases: 'dark light theme mode colour color' },
  { page: 'personalization', key: 'accent', expand: 'colors', aliases: 'colour color' },
  ...['themes_current', 'themes_icons', 'themes_contrast'].map(key => ({ page: 'themes' as const, key })),
  ...['lock_status', 'lock_signin', 'lock_timeout'].map(key => ({ page: 'lockscreen' as const, key })),
  ...['start_recent', 'start_recommended', 'start_account'].map(key => ({ page: 'start' as const, key })),
  ...['taskbar_taskview', 'taskbar_widgets', 'taskbar_autohide'].map(key => ({ page: 'taskbar' as const, key })),
  ...['signin', 'email_accounts', 'access_work'].map(key => ({ page: 'accounts' as const, key })),
  ...['pin', 'password'].map(key => ({ page: 'accounts' as const, key, expand: 'signin' })),
  ...['time_auto', 'time_zone', 'clock24', 'display_language'].map(key => ({ page: 'time' as const, key })),
  ...['win_security', 'find_device', 'encryption', 'location', 'camera', 'microphone'].map(key => ({ page: 'privacy' as const, key })),
  { page: 'apps', key: 'apps_hidden', target: 'apps_filter', aliases: 'hidden apps desktop shortcuts show hide' },
  { page: 'apps', key: 'apps_sort', aliases: 'sort name order hidden first' },
];

export function pageLabel(page: PageId): string {
  return t(`ui.settings.${page === PARENT[page] ? `nav_${page}` : page}`);
}

export function findSettings(query: string, style: OsStyle): SettingResult[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return entries.filter(entry => {
    if (entry.page === 'apps' && style !== 'modern') return false;
    if (entry.key === 'mode_choose' && style === 'retro') return false;
    const descKey = `ui.settings.${entry.key}_desc`;
    const description = t(descKey);
    const text = `${t(`ui.settings.${entry.key}`)} ${description === descKey ? '' : description} ${pageLabel(entry.page)} ${entry.aliases ?? ''}`.toLocaleLowerCase();
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    const rank = (entry: SettingResult) => {
      const label = t(`ui.settings.${entry.key}`).toLocaleLowerCase();
      return label === q ? 0 : label.startsWith(q) ? 1 : label.includes(q) ? 2 : 3 + words.filter(word => !label.includes(word)).length;
    };
    return rank(a) - rank(b);
  });
}
