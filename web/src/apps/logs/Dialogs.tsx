import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Copy } from 'lucide-react';
import { Button, IconButton, Select, TextInput } from '@/ui/controls';
import { fmtStamp } from '@/lib/format';
import { t } from '@/i18n';
import { useExitFx } from '@/hooks/useExitFx';
import type { Entry, LevelCheck, NodeId, UserFilter } from './types';
import { EventDetails } from './EventDetails';
import { NodeIcon } from './icons';
import { EMPTY_FILTER, L, LOGGED, LOG_DEFS, cx, fmtNum, fmtSize, logBytes, nodeLabel } from './model';

/**
 * A modal window inside the app (like controls' Dialog) but sized by the caller and with a
 * scrolling body, so tall MMC property sheets still fit a small window.
 */
export function Modal({ title, width = 460, children, actions, onClose, bodyClass, bodyStyle }: {
  title: ReactNode;
  width?: number;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  bodyClass?: string;
  bodyStyle?: CSSProperties;
}) {
  const exitRef = useExitFx('fade-out');
  return (
    <div
      ref={exitRef}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 fade-in p-3"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex flex-col max-h-full rounded-win bg-layer shadow-flyout overflow-hidden text-[12px] dialog-in" style={{ width: `min(${width}px, 100%)` }}>
        <div className="shrink-0 px-5 pt-4 pb-3 text-[14px] font-semibold text-t1 truncate">{title}</div>
        <div className={cx('min-h-0 overflow-auto os-scroll px-5 pb-4 text-t1', bodyClass)} style={bodyStyle}>
          {children}
        </div>
        <div className="shrink-0 flex items-center justify-end gap-2 px-5 py-3 bg-win border-t border-stroke">{actions}</div>
      </div>
    </div>
  );
}

const small = '!h-7 !text-[12px]';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-start gap-3 py-1.5">
      <div className="pt-1.5 text-t2">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange?: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-1.5 cursor-default whitespace-nowrap', disabled && 'opacity-60')}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange?.(e.target.checked)} className="accent-[var(--accent-fill)]" />
      {children}
    </label>
  );
}

const CHECK_ROWS: LevelCheck[][] = [
  ['critical', 'warning', 'verbose'],
  ['error', 'information'],
  ['success', 'failure'],
];

/** Filter Current Log… / Create Custom View… (the same sheet in Windows). */
export function FilterDialog({ title, node, initial, sources, onApply, onClose }: {
  title: string;
  node: NodeId;
  initial: UserFilter;
  sources: string[];
  onApply: (f: UserFilter) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<UserFilter>(initial);
  const set = (patch: Partial<UserFilter>) => setF(prev => ({ ...prev, ...patch }));
  return (
    <Modal
      title={title}
      width={540}
      onClose={onClose}
      actions={
        <>
          <Button compact variant="accent" onClick={() => onApply(f)} className="min-w-[80px]">{t('ui.common.ok')}</Button>
          <Button compact onClick={onClose} className="min-w-[80px]">{t('ui.common.cancel')}</Button>
        </>
      }
    >
      <form
        onSubmit={e => {
          e.preventDefault();
          onApply(f);
        }}
      >
        <Row label={L('f_logged') + ':'}>
          <Select value={f.logged} onChange={value => set({ logged: value as UserFilter['logged'] })} className={small}>
            {LOGGED.map(l => (
              <option key={l} value={l}>{L(`logged_${l}`)}</option>
            ))}
          </Select>
        </Row>
        <Row label={L('f_event_level') + ':'}>
          <div className="flex flex-col gap-1.5 pt-1">
            {CHECK_ROWS.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-x-3">
                {row.map(k => (
                  <Check key={k} checked={!!f.checks[k]} onChange={v => set({ checks: { ...f.checks, [k]: v } })}>
                    {L(`check_${k}`)}
                  </Check>
                ))}
              </div>
            ))}
          </div>
        </Row>
        <Row label={L('f_by_log') + ':'}>
          <TextInput value={nodeLabel(node)} disabled readOnly className={small} />
        </Row>
        <Row label={L('f_sources') + ':'}>
          <Select value={f.source} onChange={value => set({ source: value })} className={small}>
            <option value="">{L('all_sources')}</option>
            {sources.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Row>
        <Row label={L('f_ids_label') + ':'}>
          <TextInput value={f.ids} onChange={e => set({ ids: e.target.value })} placeholder={L('all_ids')} className={small} />
          <div className="pt-1 text-[11px] leading-[14px] text-t3">{L('ids_hint')}</div>
        </Row>
        <Row label={L('f_keywords') + ':'}>
          <TextInput value={f.search} onChange={e => set({ search: e.target.value })} placeholder={L('keywords_ph')} maxLength={64} className={small} />
        </Row>
        <Row label={L('f_user') + ':'}>
          <TextInput value={f.user} onChange={e => set({ user: e.target.value })} placeholder={L('all_users')} className={small} />
        </Row>
        <div className="flex justify-end pt-2">
          <Button compact onClick={() => setF(EMPTY_FILTER)} className="min-w-[80px]">{L('clear')}</Button>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Log Properties (General tab of the real sheet; everything but the facts is read-only). */
export function LogPropertiesDialog({ node, entries, count, clock24, onClose }: { node: NodeId; entries: Entry[]; count: number; clock24: boolean; onClose: () => void }) {
  const def = LOG_DEFS[node];
  const bytes = logBytes(count);
  const first = entries.reduce((m, e) => (m === 0 ? e.ts : Math.min(m, e.ts)), 0);
  const last = entries.reduce((m, e) => Math.max(m, e.ts), 0);
  const na = L('na');
  const fact = (k: string, v: string) => (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-[3px]">
      <div className="text-t2">{k}:</div>
      <div className="select-text break-all">{v}</div>
    </div>
  );
  return (
    <Modal
      title={L('log_props_title', nodeLabel(node), L(def?.kind === 'custom' ? 'type_custom' : def?.kind === 'operational' ? 'type_operational' : 'type_admin'))}
      width={520}
      onClose={onClose}
      actions={<Button compact variant="accent" onClick={onClose} className="min-w-[80px]">{t('ui.common.ok')}</Button>}
    >
      {def?.kind === 'custom' ? (
        <>
          {fact(L('p_name'), nodeLabel(node))}
          {fact(L('p_description'), L('admin_events_desc'))}
        </>
      ) : (
        <>
          {fact(L('p_full_name'), nodeLabel(node))}
          {fact(L('p_path'), `%SystemRoot%\\System32\\Winevt\\Logs\\${def?.file ?? 'Log'}.evtx`)}
          {fact(L('p_size'), `${fmtSize(bytes)} (${fmtNum(bytes)} ${L('bytes')})`)}
          {fact(L('p_created'), first ? fmtStamp(first, clock24) : na)}
          {fact(L('p_modified'), last ? fmtStamp(last, clock24) : na)}
          {fact(L('p_accessed'), fmtStamp(Math.floor(Date.now() / 1000), clock24))}
          <div className="mt-3 flex flex-col gap-2">
            <Check checked disabled>{L('p_enable')}</Check>
            <div className="flex items-center gap-3">
              <span className="text-t2">{L('p_max_size')}</span>
              <TextInput value={String(def?.maxKb ?? 20480)} disabled readOnly className={cx(small, '!w-24')} />
            </div>
            <div className="text-t2">{L('p_when_full')}</div>
            {(['p_overwrite', 'p_archive', 'p_no_overwrite'] as const).map((k, i) => (
              <label key={k} className="inline-flex items-center gap-1.5 pl-3 opacity-80">
                <input type="radio" checked={i === 0} disabled readOnly className="accent-[var(--accent-fill)]" />
                {L(k)}
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/** Event Properties: the General/Details sheet in its own window, with previous/next + Copy. */
export function EventPropertiesDialog({ entry, hostname, clock24, onPrev, onNext, onCopy, onClose }: {
  entry: Entry;
  hostname: string;
  clock24: boolean;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={L('props_title', entry.event_id, entry.source)}
      width={720}
      onClose={onClose}
      bodyClass="!px-0 !pb-0 flex flex-col"
      bodyStyle={{ height: 430 }}
      actions={
        <>
          <Button compact icon={<Copy size={14} />} onClick={onCopy}>{L('copy')}</Button>
          <span className="flex-1" />
          <IconButton title={L('prev_event')} disabled={!onPrev} onClick={() => onPrev?.()} className="!w-7 !h-7">
            <ArrowUp size={14} />
          </IconButton>
          <IconButton title={L('next_event')} disabled={!onNext} onClick={() => onNext?.()} className="!w-7 !h-7">
            <ArrowDown size={14} />
          </IconButton>
          <Button compact variant="accent" onClick={onClose} className="min-w-[80px]">{t('ui.common.close')}</Button>
        </>
      }
    >
      <div className="flex-1 min-h-0 border-t border-stroke">
        <EventDetails entry={entry} hostname={hostname} clock24={clock24} tall />
      </div>
    </Modal>
  );
}

/** Help > About Event Viewer. */
export function AboutDialog({ osName, osBuild, onClose }: { osName: string; osBuild: string; onClose: () => void }) {
  return (
    <Modal
      title={L('about_title')}
      width={420}
      onClose={onClose}
      actions={<Button compact variant="accent" onClick={onClose} className="min-w-[80px]">{t('ui.common.ok')}</Button>}
    >
      <div className="flex items-start gap-4">
        <div className="scale-[2] origin-top-left w-8 h-8">
          <NodeIcon kind="root" />
        </div>
        <div className="flex flex-col gap-1 pl-2">
          <div className="text-[14px] font-semibold">{L('app_name')}</div>
          <div className="text-t2">{L('about_version')}</div>
          <div className="text-t2">{`${osName} [${L('about_os_version', osBuild)}]`}</div>
          <div className="text-t3 pt-2">{L('about_copyright', new Date().getFullYear())}</div>
        </div>
      </div>
    </Modal>
  );
}
