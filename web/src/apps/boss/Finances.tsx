import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Info, Landmark, Receipt } from 'lucide-react';
import { Button, Select, Spinner } from '@/ui/controls';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { fmtMoney, fmtStamp } from '@/lib/format';
import { useBoss } from './context';
import { useNotices } from './hooks';
import { Chip, MoneyInput, Notices, PageHeader, Panel, RefreshButton, TxIcon, cx } from './parts';
import { fmtSigned, sourceLabel, txDelta, withdrawNote } from './util';

type Filter = 'all' | 'in' | 'out';

/** Whole dollars in [1, max], or null. */
const parseAmount = (digits: string, max: number): number | null => {
  if (!digits) return null;
  const n = Number(digits);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
};

/** Society balance, deposit/withdraw forms and the full statement. */
export default function Finances() {
  const { overview: ov, overviewLoading, reloadOverview, setBalance, clock24 } = useBoss();
  const funds = ov.funds;
  const max = funds.max ?? 1000000;
  const sources = funds.depositFrom && funds.depositFrom.length ? funds.depositFrom : ['bank'];
  const withdrawTo = funds.withdrawTo ?? 'bank';
  const balance = typeof funds.balance === 'number' ? funds.balance : null;
  const notices = useNotices();

  const [depAmt, setDepAmt] = useState('');
  const [depFrom, setDepFrom] = useState(sources[0]);
  const [wAmt, setWAmt] = useState('');
  const [busy, setBusy] = useState<'deposit' | 'withdraw' | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  // Keep the picked source valid if the server's list changes under us.
  useEffect(() => {
    if (!sources.includes(depFrom)) setDepFrom(sources[0]);
  }, [sources, depFrom]);

  const rows = useMemo(
    () => (funds.transactions ?? []).map(tx => ({ tx, d: txDelta(tx, ov.job.label) })),
    [funds.transactions, ov.job.label],
  );
  const totalIn = rows.reduce((s, r) => (r.d > 0 ? s + r.d : s), 0);
  const totalOut = rows.reduce((s, r) => (r.d < 0 ? s - r.d : s), 0);
  const nIn = rows.filter(r => r.d >= 0).length;
  const shown = filter === 'all' ? rows : rows.filter(r => (filter === 'in' ? r.d >= 0 : r.d < 0));

  const transfer = async (kind: 'deposit' | 'withdraw', e?: FormEvent) => {
    e?.preventDefault();
    const amount = parseAmount(kind === 'deposit' ? depAmt : wAmt, max);
    if (amount === null || busy) return;
    setBusy(kind);
    const res =
      kind === 'deposit'
        ? await rpc<{ balance?: number }>('boss:deposit', { amount, from: depFrom })
        : await rpc<{ balance?: number }>('boss:withdraw', { amount });
    setBusy(null);
    if (res.ok) {
      if (typeof res.data?.balance === 'number') setBalance(res.data.balance);
      if (kind === 'deposit') {
        setDepAmt('');
        notices.push('success', t('ui.boss.deposited', fmtMoney(amount), sourceLabel(depFrom)));
      } else {
        setWAmt('');
        notices.push('success', t('ui.boss.withdrew', fmtMoney(amount)));
      }
    } else {
      notices.push('error', res.error || t('ui.common.error'), t(kind === 'deposit' ? 'ui.boss.deposit_failed' : 'ui.boss.withdraw_failed'));
    }
    void reloadOverview();
  };

  const depValid = parseAmount(depAmt, max) !== null;
  const wValid = parseAmount(wAmt, max) !== null;

  return (
    <div className="h-full overflow-y-auto os-scroll">
      <div className="px-6 pt-5 pb-8 max-w-[1600px]">
        <PageHeader title={t('ui.boss.nav_finances')} subtitle={ov.job.label} actions={<RefreshButton loading={overviewLoading} onClick={() => void reloadOverview()} />} />
        <Notices list={notices.list} onClose={notices.dismiss} />

        <section className="rounded-win bg-card border border-stroke shadow-card p-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-body text-t2">
              <Landmark size={16} className="text-accent-text" />
              {t('ui.boss.stat_balance')}
            </div>
            <div className={cx('font-display font-semibold tabular-nums mt-1 truncate', balance === null ? 'text-title text-t3' : 'text-hero text-t1')}>
              {balance === null ? t('ui.boss.unavailable') : fmtMoney(balance)}
            </div>
            <div className="text-caption text-t3">{balance === null ? t('ui.boss.balance_unavailable') : t('ui.boss.stat_balance_caption')}</div>
          </div>
          {rows.length > 0 && (
            <div className="flex gap-8">
              <Figure label={t('ui.boss.money_in')} value={fmtSigned(totalIn)} tone="text-success" />
              <Figure label={t('ui.boss.money_out')} value={fmtSigned(-totalOut)} tone="text-critical" />
            </div>
          )}
        </section>

        <div className="grid gap-3 mt-3 grid-cols-[repeat(auto-fit,minmax(270px,1fr))]">
          <Panel
            title={<Heading icon={<ArrowDownLeft size={16} className="text-success" />}>{t('ui.boss.deposit')}</Heading>}
            caption={t('ui.boss.deposit_caption')}
          >
            <form onSubmit={e => void transfer('deposit', e)} className="flex flex-col gap-3">
              <AmountField value={depAmt} onChange={setDepAmt} max={max} disabled={busy === 'deposit'} />
              <Field label={t('ui.boss.deposit_from')}>
                <Select value={depFrom} onChange={value => setDepFrom(value)} disabled={busy === 'deposit'}>
                  {sources.map(s => (
                    <option key={s} value={s}>
                      {sourceLabel(s)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex justify-end pt-1">
                <Button type="submit" variant="accent" disabled={!depValid || busy !== null} icon={busy === 'deposit' ? <Spinner size={14} className="!text-accent-on" /> : undefined}>
                  {t('ui.boss.deposit')}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel
            title={<Heading icon={<ArrowUpRight size={16} className="text-critical" />}>{t('ui.boss.withdraw')}</Heading>}
            caption={t('ui.boss.withdraw_caption')}
          >
            <form onSubmit={e => void transfer('withdraw', e)} className="flex flex-col gap-3">
              <AmountField value={wAmt} onChange={setWAmt} max={max} disabled={busy === 'withdraw'} />
              <Field label={t('ui.boss.withdraw_to')}>
                <div className="h-8 flex items-center gap-2 text-body text-t2">
                  <Info size={14} className="shrink-0 text-accent-text" />
                  <span className="truncate">{withdrawNote(withdrawTo)}</span>
                </div>
              </Field>
              <div className="flex justify-end pt-1">
                <Button type="submit" variant="accent" disabled={!wValid || busy !== null} icon={busy === 'withdraw' ? <Spinner size={14} className="!text-accent-on" /> : undefined}>
                  {t('ui.boss.withdraw')}
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        <Panel
          className="mt-3"
          title={t('ui.boss.tx_title')}
          caption={rows.length ? t('ui.boss.tx_caption', rows.length) : undefined}
          actions={
            rows.length > 0 ? (
              <>
                <Chip selected={filter === 'all'} onClick={() => setFilter('all')} count={rows.length}>
                  {t('ui.boss.filter_all')}
                </Chip>
                <Chip selected={filter === 'in'} onClick={() => setFilter('in')} count={nIn}>
                  {t('ui.boss.filter_in')}
                </Chip>
                <Chip selected={filter === 'out'} onClick={() => setFilter('out')} count={rows.length - nIn}>
                  {t('ui.boss.filter_out')}
                </Chip>
              </>
            ) : undefined
          }
          bodyClass="pt-3 pb-2"
        >
          {rows.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <Receipt size={32} className="text-t3" />
              <div className="text-body font-semibold text-t1">{t('ui.boss.no_tx_title')}</div>
              <div className="text-caption text-t2">{t('ui.boss.no_tx_body')}</div>
            </div>
          ) : (
            <div className="overflow-x-auto os-scroll">
              <table className="w-full min-w-[780px] border-separate border-spacing-0 text-body">
                <thead>
                  <tr className="text-caption font-semibold text-t2 text-left">
                    <th className="h-9 pl-5 pr-3 border-b border-stroke font-semibold w-[170px]">{t('ui.boss.col_date')}</th>
                    <th className="h-9 px-3 border-b border-stroke font-semibold">{t('ui.boss.col_description')}</th>
                    <th className="h-9 px-3 border-b border-stroke font-semibold">{t('ui.boss.col_parties')}</th>
                    <th className="h-9 px-3 border-b border-stroke font-semibold">{t('ui.boss.col_message')}</th>
                    <th className="h-9 pl-3 pr-5 border-b border-stroke font-semibold text-right w-[130px]">{t('ui.boss.col_amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-caption text-t2">
                        {t('ui.boss.tx_none_filter')}
                      </td>
                    </tr>
                  )}
                  {shown.map(({ tx, d }) => (
                    <tr key={tx.id} className="hover:bg-subtle transition-colors duration-150 [&:last-child>td]:border-b-0">
                      <td className="h-12 pl-5 pr-3 border-b border-stroke text-t2 whitespace-nowrap tabular-nums">{fmtStamp(tx.time, clock24)}</td>
                      <td className="h-12 px-3 border-b border-stroke">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <TxIcon delta={d} size={24} />
                          <span className="text-t1 truncate max-w-[220px]">{tx.title}</span>
                        </div>
                      </td>
                      <td className="h-12 px-3 border-b border-stroke text-t2">
                        <div className="flex items-center gap-1.5 min-w-0 max-w-[280px]">
                          <span className="truncate" title={tx.issuer}>{tx.issuer}</span>
                          <ArrowRight size={12} className="shrink-0 text-t3" />
                          <span className="truncate" title={tx.receiver}>{tx.receiver}</span>
                        </div>
                      </td>
                      <td className="h-12 px-3 border-b border-stroke text-t2">
                        <div className="truncate max-w-[260px]" title={tx.message}>
                          {tx.message || '—'}
                        </div>
                      </td>
                      <td className={cx('h-12 pl-3 pr-5 border-b border-stroke text-right font-semibold tabular-nums whitespace-nowrap', d < 0 ? 'text-critical' : 'text-success')}>
                        {fmtSigned(d)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Heading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      {icon}
      {children}
    </span>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-caption text-t2">{label}</span>
      {children}
      {hint}
    </label>
  );
}

/** Amount box with the 1..max rule shown as a hint, turning into an error once it's broken. */
function AmountField({ value, onChange, max, disabled }: { value: string; onChange: (v: string) => void; max: number; disabled?: boolean }) {
  const invalid = value !== '' && parseAmount(value, max) === null;
  return (
    <Field
      label={t('ui.boss.amount')}
      hint={
        <span className={cx('text-caption', invalid ? 'text-critical' : 'text-t3')}>
          {invalid ? t('ui.boss.amount_invalid', fmtMoney(max)) : t('ui.boss.amount_hint', fmtMoney(max))}
        </span>
      }
    >
      <MoneyInput value={value} onChange={onChange} invalid={invalid} disabled={disabled} placeholder="0" />
    </Field>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="text-caption text-t2 whitespace-nowrap">{label}</div>
      <div className={cx('text-subtitle font-semibold tabular-nums whitespace-nowrap', tone)}>{value}</div>
    </div>
  );
}
