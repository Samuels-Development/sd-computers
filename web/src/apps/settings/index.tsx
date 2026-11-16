import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Menu, Search, X } from 'lucide-react';
import type { AppProps } from '../registry';
import { useExitFx } from '@/hooks/useExitFx';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { Avatar } from '@/os/icons';
import { IconButton, TextInput } from '@/ui/controls';
import { SettingsExpansion } from './ui';
import { findSettings, pageLabel, type SettingResult } from './search';
import './settings.css';
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
  const narrow = w > 0 && w < 760;
  const [drawer, setDrawer] = useState(false);
  const [target, setTarget] = useState<SettingResult | null>(null);
  const [activeResult, setActiveResult] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const resultsId = useId();
  const navigationId = useId();
  const navigationFocus = useRef(false);
  const drawerExit = useExitFx<HTMLElement>('settings-drawer-out');
  const setNavigation = useCallback((node: HTMLElement | null) => {
    navRef.current = node;
    drawerExit(node);
  }, [drawerExit]);

  const lastProps = useRef(win.props);
  useEffect(() => {
    if (win.props === lastProps.current) return;
    lastProps.current = win.props;
    const p = requested(win.props?.page);
    if (p) { navigationFocus.current = true; setPage(p); setTarget(null); setQuery(''); setDrawer(false); }
  }, [win.props]);

  const q = query.trim();
  const items = NAV.filter(n => n.id !== 'apps' || style === 'modern');
  const results = findSettings(q, style);
  const go = (p: PageId) => {
    navigationFocus.current = true;
    setPage(p);
    setTarget(null);
    setQuery('');
    setDrawer(false);
  };
  const pick = (result: SettingResult) => {
    navigationFocus.current = true;
    setPage(result.page);
    setTarget(result);
    setQuery('');
    setDrawer(false);
  };
  const closeDrawer = () => { setDrawer(false); menuRef.current?.focus(); };

  useEffect(() => {
    if (!narrow) setDrawer(false);
  }, [narrow]);
  useEffect(() => {
    if (drawer && narrow) (navRef.current?.querySelector<HTMLButtonElement>('[aria-current="page"]') ?? navRef.current?.querySelector('button'))?.focus();
  }, [drawer, narrow]);
  useEffect(() => {
    if (q) return;
    const main = mainRef.current;
    if (!main) return;
    const label = target ? t(`ui.settings.${target.target ?? target.key}`) : null;
    const row = Array.from(main.querySelectorAll<HTMLElement>('[data-setting]')).find(el => el.dataset.setting === label);
    if (row) {
      row.dataset.searchHighlighted = 'true';
      row.scrollIntoView({ block: 'center' });
      if (navigationFocus.current) row.focus({ preventScroll: true });
      navigationFocus.current = false;
      return () => { delete row.dataset.searchHighlighted; };
    }
    main.scrollTop = 0;
    if (navigationFocus.current) main.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    navigationFocus.current = false;
  }, [page, target, q]);
  useEffect(() => {
    if (q) mainRef.current?.querySelector<HTMLElement>(`[data-result="${activeResult}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [q, activeResult]);

  const searchField = <div className="settings-search relative">
    <TextInput ref={searchRef} value={query} placeholder={t('ui.settings.search')} aria-label={t('ui.settings.search')}
      role="combobox" aria-autocomplete="list" aria-expanded={!!q} aria-controls={q ? resultsId : undefined}
      aria-activedescendant={q && results[activeResult] ? `${resultsId}-${activeResult}` : undefined}
      className="pr-9" onChange={e => { setQuery(e.target.value); setActiveResult(0); setDrawer(false); }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActiveResult(i => (i + 1) % results.length); }
        if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActiveResult(i => (i - 1 + results.length) % results.length); }
        if (e.key === 'Enter' && results[activeResult]) { e.preventDefault(); pick(results[activeResult]); }
        if (e.key === 'Escape' && query) { e.preventDefault(); e.stopPropagation(); setQuery(''); }
      }} />
    {query ? <button type="button" className="absolute right-1 top-0 h-8 w-8 flex items-center justify-center text-t2 hover:text-t1"
      aria-label={t('ui.settings.search_clear')} onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={14} /></button>
      : <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-t2 pointer-events-none" />}
  </div>;

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
    <div ref={rootRef} className="settings-app relative h-full w-full flex bg-win overflow-hidden" data-compact={narrow} data-small={w > 0 && w < 560}>
      {narrow && <header className="settings-mobile-bar flex items-center gap-3">
        <button ref={menuRef} type="button" className="ctl-iconbtn shrink-0 w-8 h-8 flex items-center justify-center rounded-ctl hover:bg-subtle"
          aria-label={t('ui.settings.navigation_open')} aria-expanded={drawer} aria-controls={navigationId} onClick={() => setDrawer(v => !v)}><Menu size={20} /></button>
        {searchField}
      </header>}
      {narrow && drawer && <button type="button" tabIndex={-1} className="settings-nav-shade" aria-label={t('ui.settings.navigation_close')} onClick={closeDrawer} />}
      {(!narrow || drawer) && <aside ref={narrow ? setNavigation : navRef} id={navigationId} data-drawer={narrow} className="settings-sidebar shrink-0 flex flex-col min-h-0"
        role={narrow ? 'dialog' : undefined} aria-modal={narrow || undefined} aria-label={t('ui.settings.title')}
        onKeyDown={e => {
          if (!narrow) return;
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDrawer(); }
          if (e.key === 'Tab') {
            const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const edge = e.shiftKey ? buttons[0] : buttons[buttons.length - 1];
            if (document.activeElement === edge) { e.preventDefault(); (e.shiftKey ? buttons[buttons.length - 1] : buttons[0])?.focus(); }
          }
        }}>
        {narrow && <div className="flex items-center gap-2 mb-2"><IconButton title={t('ui.settings.navigation_close')} onClick={closeDrawer}><ArrowLeft size={18} /></IconButton><span className="font-semibold">{t('ui.settings.title')}</span></div>}
        <button type="button" onClick={() => go('accounts')} className="settings-profile flex items-center gap-3 rounded-win text-left hover:bg-subtle min-w-0">
          <Avatar initials={user.initials} size={60} />
          <div className="min-w-0">
            <div className="text-body font-semibold text-t1 truncate">{user.name}</div>
            {user.job && <div className="text-caption text-t2 truncate">{user.job}</div>}
            <div className="text-caption text-t2">{t('ui.settings.local_account')}</div>
          </div>
        </button>
        {!narrow && searchField}
        <nav aria-label={t('ui.settings.title')} className="flex-1 min-h-0 overflow-y-auto os-scroll flex flex-col gap-1">
          {items.map(n => <button key={n.id} type="button" aria-current={!q && PARENT[page] === n.id ? 'page' : undefined}
            className={`settings-nav-item relative flex items-center gap-3 text-left rounded-ctl text-body text-t1 ${!q && PARENT[page] === n.id ? 'is-selected bg-subtle' : 'hover:bg-subtle'}`}
            onClick={() => go(n.id)}>
            <span className="settings-nav-icon shrink-0" style={{ color: n.color }}>{n.icon}</span>
            <span>{t(`ui.settings.nav_${n.id}`)}</span>
          </button>)}
        </nav>
      </aside>}
      <main ref={mainRef} key={q ? 'search' : `${page}:${target?.key ?? ''}`} className="settings-main flex-1 min-w-0 overflow-y-auto os-scroll">
        <div className="settings-content settings-page-enter">
          {q ? <>
            <h1 className="settings-page-title" tabIndex={-1}>{t('ui.settings.search_results')}</h1>
            <p className="text-body text-t2 mb-6" aria-live="polite">{results.length ? t('ui.settings.search_count', results.length) : t('ui.settings.search_none', q)}</p>
            <div id={resultsId} role="listbox" aria-label={t('ui.settings.search_results')} className="flex flex-col gap-1">
              {results.map((result, i) => <button key={`${result.page}:${result.key}`} type="button" role="option" aria-selected={activeResult === i}
                id={`${resultsId}-${i}`} data-result={i} className={`settings-search-result flex items-center gap-4 rounded-win border border-stroke bg-card text-left hover:bg-card-hover ${activeResult === i ? 'is-active' : ''}`}
                onClick={() => pick(result)} onPointerMove={() => setActiveResult(i)}>
                <Search size={20} className="text-t2 shrink-0" />
                <span className="flex-1 min-w-0"><span className="block text-body text-t1">{t(`ui.settings.${result.key}`)}</span>
                  <span className="block text-caption text-t2 mt-1">{pageLabel(PARENT[result.page])}{result.page !== PARENT[result.page] && ` › ${pageLabel(result.page)}`}</span></span>
                <ChevronRight size={16} className="text-t2 shrink-0" />
              </button>)}
            </div>
          </> : <SettingsExpansion.Provider value={target?.expand ? t(`ui.settings.${target.expand}`) : undefined}>{content}</SettingsExpansion.Provider>}
        </div>
      </main>
    </div>
  );
}
