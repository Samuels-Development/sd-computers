import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, Lock, Search, UserMinus, Users } from 'lucide-react';
import { Button, Dialog, Empty, IconButton, Select, Spinner, TextInput } from '@/ui/controls';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { useBoss } from './context';
import { useNotices, useQuery } from './hooks';
import { ErrorState, Initials, LoadingState, Notices, PageHeader, RefreshButton, StatusPill, YouChip, cx } from './parts';
import type { Employee } from './types';
import { assignableGrades, canManage, demoteTarget, lockReason, normEmployees, promoteTarget } from './util';

type SortKey = 'name' | 'rank' | 'status';
interface Sort {
  key: SortKey;
  dir: 1 | -1;
}

const statusScore = (e: Employee): number => (e.onDuty ? 2 : e.online ? 1 : 0);

const compare = (a: Employee, b: Employee, s: Sort): number => {
  const byName = a.name.localeCompare(b.name);
  if (s.key === 'name') return byName * s.dir;
  const primary = s.key === 'rank' ? a.grade - b.grade : statusScore(a) - statusScore(b);
  return primary !== 0 ? primary * s.dir : byName;
};

const th = 'sticky top-0 z-[1] bg-layer h-10 px-4 text-left text-caption font-semibold text-t2 border-b border-stroke whitespace-nowrap';
const td = 'px-4 h-14 border-b border-stroke align-middle';

/** The roster: sortable/searchable table with rank changes, promote/demote and fire. */
export default function Employees({ active }: { active: boolean }) {
  const { overview: ov, reloadOverview } = useBoss();
  const q = useQuery('boss:employees', normEmployees);
  const notices = useNotices();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>({ key: 'rank', dir: -1 });
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<Employee | null>(null);
  const [firing, setFiring] = useState(false);

  const { reload } = q;
  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);

  const list = q.data ?? [];
  const needle = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const filtered = needle
      ? list.filter(e => e.name.toLowerCase().includes(needle) || e.gradeName.toLowerCase().includes(needle) || e.cid.toLowerCase().includes(needle))
      : list;
    return [...filtered].sort((a, b) => compare(a, b, sort));
  }, [list, needle, sort]);

  const options = useMemo(() => [...assignableGrades(ov)].sort((a, b) => b.level - a.level), [ov]);

  const onSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }));

  const refresh = () => {
    void reload();
    void reloadOverview();
  };

  const markBusy = (cid: string, on: boolean) =>
    setBusy(b => {
      const next = { ...b };
      if (on) next[cid] = true;
      else delete next[cid];
      return next;
    });

  /** Optimistic: the row shows the new rank at once and snaps back if the server refuses. */
  const changeGrade = async (e: Employee, level: number) => {
    const target = ov.grades.find(g => g.level === level);
    if (!target || level === e.grade || !canManage(ov, e) || level >= ov.myGrade) return;
    q.set(l => l && l.map(x => (x.cid === e.cid ? { ...x, grade: level, gradeName: target.name } : x)));
    markBusy(e.cid, true);
    const res = await rpc('boss:setGrade', { cid: e.cid, grade: level });
    markBusy(e.cid, false);
    if (res.ok) {
      notices.push('success', t(level > e.grade ? 'ui.boss.promoted' : 'ui.boss.demoted', e.name, target.name));
    } else {
      q.set(l => l && l.map(x => (x.cid === e.cid ? e : x)));
      notices.push('error', res.error || t('ui.common.error'), t('ui.boss.grade_failed', e.name));
    }
    refresh();
  };

  const fire = async () => {
    if (!confirm) return;
    const e = confirm;
    setFiring(true);
    const res = await rpc('boss:fire', { cid: e.cid });
    setFiring(false);
    setConfirm(null);
    if (res.ok) {
      q.set(l => l && l.filter(x => x.cid !== e.cid));
      notices.push('success', t('ui.boss.fired', e.name, ov.job.label));
    } else {
      notices.push('error', res.error || t('ui.common.error'), t('ui.boss.fire_failed', e.name));
    }
    refresh();
  };

  return (
    <div className="h-full flex flex-col min-h-0 px-6 pt-5 pb-6">
      <PageHeader
        title={t('ui.boss.nav_employees')}
        subtitle={q.data ? t('ui.boss.employees_subtitle', list.length, ov.job.label) : ov.job.label}
        actions={<RefreshButton loading={q.loading} onClick={refresh} />}
      />
      <Notices list={notices.list} onClose={notices.dismiss} />

      {!q.data ? (
        <div className="flex-1 min-h-0">{q.error ? <ErrorState message={q.error} onRetry={refresh} loading={q.loading} /> : <LoadingState />}</div>
      ) : list.length === 0 ? (
        <div className="flex-1 min-h-0">
          <Empty icon={<Users size={40} />} title={t('ui.boss.no_employees_title')}>
            {t('ui.boss.no_employees_body')}
          </Empty>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="relative w-[300px] max-w-full">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-t3 pointer-events-none" />
              <TextInput value={search} onChange={e => setSearch(e.target.value)} placeholder={t('ui.boss.search_employees')} className="pl-8" />
            </div>
            {needle && <div className="text-caption text-t2">{t('ui.boss.showing', rows.length, list.length)}</div>}
          </div>

          <div className="flex-1 min-h-0 overflow-auto os-scroll rounded-win border border-stroke bg-layer">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-body">
              <thead>
                <tr>
                  <SortTh label={t('ui.boss.col_name')} k="name" sort={sort} onSort={onSort} />
                  <SortTh label={t('ui.boss.col_rank')} k="rank" sort={sort} onSort={onSort} className="w-[210px]" />
                  <SortTh label={t('ui.boss.col_status')} k="status" sort={sort} onSort={onSort} className="w-[140px]" />
                  <th className={cx(th, 'w-[200px] text-right')}>{t('ui.boss.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-caption text-t2">
                      {t('ui.boss.no_match', search.trim())}
                    </td>
                  </tr>
                )}
                {rows.map(e => {
                  const self = e.cid === ov.myCid;
                  const manageable = canManage(ov, e);
                  const reason = manageable ? '' : lockReason(ov, e);
                  const isBusy = !!busy[e.cid];
                  const up = manageable ? promoteTarget(ov, e) : undefined;
                  const down = manageable ? demoteTarget(ov, e) : undefined;
                  return (
                    <tr key={e.cid} className="hover:bg-subtle transition-colors duration-150 [&:last-child>td]:border-b-0">
                      <td className={td}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Initials name={e.name} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-t1 truncate">{e.name}</span>
                              {self && <YouChip />}
                            </div>
                            <div className="text-caption text-t3 font-mono truncate">{e.cid}</div>
                          </div>
                        </div>
                      </td>
                      <td className={td}>
                        {manageable ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={e.grade}
                              disabled={isBusy}
                              onChange={value => void changeGrade(e, Number(value))}
                              className="w-[160px]"
                              aria-label={t('ui.boss.col_rank')}
                            >
                              {options.map(g => (
                                <option key={g.level} value={g.level}>
                                  {g.name}
                                </option>
                              ))}
                            </Select>
                            {isBusy && <Spinner size={16} />}
                          </div>
                        ) : (
                          <span title={reason} className="inline-flex items-center gap-2 text-t2 cursor-default">
                            <Lock size={14} className="text-t3 shrink-0" />
                            <span className="truncate">{e.gradeName}</span>
                          </span>
                        )}
                      </td>
                      <td className={td}>
                        <StatusPill online={e.online} onDuty={e.onDuty} />
                      </td>
                      <td className={cx(td, 'text-right')}>
                        <Tip title={reason}>
                          <div className="inline-flex items-center justify-end gap-1">
                            <IconButton
                              title={up ? t('ui.boss.promote_to', up.name) : t('ui.boss.promote_none')}
                              disabled={!up || isBusy}
                              onClick={() => up && void changeGrade(e, up.level)}
                            >
                              <ChevronUp size={16} />
                            </IconButton>
                            <IconButton
                              title={down ? t('ui.boss.demote_to', down.name) : t('ui.boss.demote_none')}
                              disabled={!down || isBusy}
                              onClick={() => down && void changeGrade(e, down.level)}
                            >
                              <ChevronDown size={16} />
                            </IconButton>
                            <Button
                              variant="subtle"
                              compact
                              icon={<UserMinus size={16} />}
                              className="!text-critical ml-1"
                              disabled={!manageable || isBusy}
                              onClick={() => setConfirm(e)}
                            >
                              {t('ui.boss.fire')}
                            </Button>
                          </div>
                        </Tip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirm && (
        <Dialog
          title={t('ui.boss.fire_confirm_title', confirm.name, ov.job.label)}
          onClose={() => !firing && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={firing}>
                {t('ui.common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => void fire()} disabled={firing} icon={firing ? <Spinner size={14} className="!text-white" /> : <UserMinus size={16} />}>
                {t('ui.boss.fire')}
              </Button>
            </>
          }
        >
          {t('ui.boss.fire_confirm_body', confirm.name, confirm.gradeName)}
        </Dialog>
      )}
    </div>
  );
}

/** Native tooltip that still shows over disabled buttons (they have pointer-events: none). */
function Tip({ title, children }: { title: string; children: ReactNode }) {
  return title ? (
    <span title={title} className="inline-flex cursor-default">
      {children}
    </span>
  ) : (
    <>{children}</>
  );
}

function SortTh({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void; className?: string }) {
  const on = sort.key === k;
  return (
    <th className={cx(th, className)} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cx('group inline-flex items-center gap-1.5 h-7 -mx-2 px-2 rounded-ctl hover:bg-subtle hover:text-t1 transition-colors duration-150', on && 'text-t1')}
      >
        {label}
        {on ? (
          sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-60 transition-opacity" />
        )}
      </button>
    </th>
  );
}
