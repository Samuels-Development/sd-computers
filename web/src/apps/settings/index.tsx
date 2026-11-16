import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { AppProps } from '../registry';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Avatar } from '@/os/icons';
import { NavItem, TextInput } from '@/ui/controls';
import { IconTile } from './ui';
import { NAV, PARENT, type PageId } from './nav';
import { useSize } from './useSize';
import SystemPage from './pages/SystemPage';
import AboutPage from './pages/AboutPage';
import PersonalizationPage from './pages/PersonalizationPage';
import ManagedPage from './pages/ManagedPage';
import AccountsPage from './pages/AccountsPage';
import TimePage from './pages/TimePage';
import PrivacyPage from './pages/PrivacyPage';
import AppsPage from './pages/AppsPage';

const requested = (p: unknown): PageId | null => (p === 'system' || p === 'personalization' || p === 'apps' ? p : null);

export default function Settings({ win }: AppProps) {
  const style = useOS(s => s.payload!.computer.style);
  const user = useOS(s => s.payload!.user);
  const [page, setPage] = useState<PageId>(() => requested(win.props?.page) ?? 'system');
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const { w } = useSize(rootRef);
  const narrow = w > 0 && w < 780;

  const lastProps = useRef(win.props);
  useEffect(() => {
    if (win.props === lastProps.current) return;
    lastProps.current = win.props;
    const p = requested(win.props?.page);
    if (p) setPage(p);
  }, [win.props]);

  const q = query.trim().toLowerCase();
  const items = NAV.filter(n => (n.id !== 'apps' || style === 'modern') && (!q || t(`ui.settings.nav_${n.id}`).toLowerCase().includes(q) || t(`ui.settings.kw_${n.id}`).toLowerCase().includes(q)));

  const go = (p: PageId) => setPage(p);

  let content;
  switch (page) {
    case 'system':
      content = <SystemPage go={go} />;
      break;
    case 'about':
      content = <AboutPage go={go} />;
      break;
    case 'personalization':
      content = <PersonalizationPage go={go} />;
      break;
    case 'themes':
    case 'lockscreen':
    case 'start':
    case 'taskbar':
      content = <ManagedPage page={page} go={go} />;
      break;
    case 'accounts':
      content = <AccountsPage />;
      break;
    case 'time':
      content = <TimePage />;
      break;
    case 'apps':
      content = <AppsPage request={win.props} />;
      break;
    case 'privacy':
      content = <PrivacyPage />;
      break;
  }

  return (
    <div ref={rootRef} className="relative h-full w-full flex bg-win overflow-hidden">
      <aside className="shrink-0 flex flex-col min-h-0 pl-3 pr-2 pt-2 pb-2" style={{ width: narrow ? 232 : 280 }}>
        <button
          type="button"
          onClick={() => go('accounts')}
          className="flex items-center gap-3 px-2 py-2 rounded-win text-left hover:bg-subtle transition-colors duration-150 min-w-0"
        >
          <Avatar initials={user.initials} size={narrow ? 52 : 64} />
          <div className="min-w-0">
            <div className="text-body font-semibold text-t1 truncate">{user.name}</div>
            {user.job && <div className="text-caption text-t2 truncate">{user.job}</div>}
            <div className="text-caption text-t2 truncate">{t('ui.settings.local_account')}</div>
          </div>
        </button>

        <div className="relative mt-3 mb-3 px-1">
          <TextInput
            value={query}
            placeholder={t('ui.settings.search')}
            aria-label={t('ui.settings.search')}
            className="pr-9"
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && items[0]) go(items[0].id);
              if (e.key === 'Escape' && query) {
                e.stopPropagation();
                setQuery('');
              }
            }}
          />
          <Search size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-t2 pointer-events-none" />
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto os-scroll flex flex-col gap-0.5 px-1">
          {items.map(n => (
            <NavItem
              key={n.id}
              icon={<IconTile color={n.color}>{n.icon}</IconTile>}
              label={t(`ui.settings.nav_${n.id}`)}
              selected={PARENT[page] === n.id}
              onClick={() => go(n.id)}
            />
          ))}
          {items.length === 0 && <div className="px-3 py-2 text-caption text-t2">{t('ui.settings.search_none', query.trim())}</div>}
        </nav>
      </aside>

      <main key={page} className="flex-1 min-w-0 overflow-y-auto os-scroll fade-in page-in">
        <div className={`max-w-[1000px] pt-3 pb-10 ${narrow ? 'px-5' : 'px-8'}`}>{content}</div>
      </main>
    </div>
  );
}
