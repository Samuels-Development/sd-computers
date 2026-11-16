import { createContext, useContext, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useOS } from '@/store/os';
import { Card } from '@/ui/controls';
import { Wallpaper } from '@/os/Wallpaper';
import { useSize } from './useSize';

// Building blocks shared by every Settings page.
export const SettingsExpansion = createContext<string | undefined>(undefined);

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Page title; with `parent` it becomes a Win11 breadcrumb ("System  >  About"). */
export function PageHeader({ title, parent, onParent }: { title: string; parent?: string; onParent?: () => void }) {
  return (
    <h1 className="settings-page-title flex items-center gap-2 min-w-0" tabIndex={-1}>
      {parent && (
        <>
          <button type="button" onClick={onParent} className="text-t2 hover:text-t1 transition-colors duration-150 truncate shrink-0">
            {parent}
          </button>
          <ChevronRight size={22} className="text-t2 shrink-0" />
        </>
      )}
      <span className="min-w-0">{title}</span>
    </h1>
  );
}

/** A run of cards: 4px apart, 24px from the next group, with an optional heading. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      {title && <h2 className="mb-2 text-body font-semibold text-t1">{title}</h2>}
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

/** A settings card row. With `onClick` it navigates (chevron); otherwise it hosts a control. */
export function Row({ icon, title, description, onClick, children }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; onClick?: () => void; children?: ReactNode }) {
  return (
    <div className="settings-row" data-setting={typeof title === 'string' ? title : undefined} tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : undefined} onKeyDown={e => {
        if (e.target === e.currentTarget && onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
      }}>
    <Card icon={icon} title={title} description={description} onClick={onClick}>
      {children && <div className="settings-row-control shrink-0 flex items-center gap-3 text-body text-t2">{children}</div>}
      {onClick && <ChevronRight size={16} className="shrink-0 text-t2" />}
    </Card>
    </div>
  );
}

/** Fluent Expander: a card header that reveals content underneath. */
export function Expander({
  icon,
  title,
  description,
  trailing,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const expand = useContext(SettingsExpansion);
  const [open, setOpen] = useState(defaultOpen || expand === title);
  const bodyId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const { h } = useSize(bodyRef);
  return (
    <div className="settings-expander rounded-win border border-stroke bg-card overflow-hidden" data-setting={typeof title === 'string' ? title : undefined} tabIndex={-1}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
        className="settings-expander-header w-full flex items-center gap-4 px-4 py-3 min-h-[64px] text-left cursor-pointer hover:bg-card-hover transition-colors duration-150 outline-none"
      >
        {icon && <span className="shrink-0 text-t1">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-body text-t1 truncate">{title}</div>
          {description && <div className="text-caption text-t2 truncate">{description}</div>}
        </div>
        {trailing && <div className="shrink-0 flex items-center gap-2 text-body text-t2" onClick={e => e.stopPropagation()}>{trailing}</div>}
        <span className="shrink-0 w-8 h-8 -mr-1 flex items-center justify-center rounded-ctl text-t1">
          <ChevronDown size={16} className={cx('transition-transform duration-150', open && 'rotate-180')} />
        </span>
      </div>
      <div id={bodyId} className="settings-expander-body" data-open={open} aria-hidden={!open} inert={!open} style={{ height: open ? h : 0 }}>
        <div ref={bodyRef} className="border-t border-stroke">{children}</div>
      </div>
    </div>
  );
}

/** One line inside an expander's body (label left, control right). */
export function SubRow({ label, description, children }: { label: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="settings-subrow flex items-center gap-4 pl-[60px] pr-4 py-3 min-h-[52px] border-b border-stroke last:border-b-0" data-setting={typeof label === 'string' ? label : undefined} tabIndex={-1}>
      <div className="flex-1 min-w-0">
        <div className="text-body text-t1">{label}</div>
        {description && <div className="text-caption text-t2">{description}</div>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** A small rounded coloured square holding a white glyph (Settings nav icons). */
export function IconTile({ color, children, size = 22 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <span
      className="shrink-0 inline-flex items-center justify-center rounded-[5px] text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }}
    >
      {children}
    </span>
  );
}

/** Fluent slider: accent fill, round thumb whose inner dot grows on hover. Arrow keys nudge. */
export function Slider({ value, onChange, min = 0, max = 100, label, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;
  const setFrom = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onChange(Math.round(min + f * (max - min)));
  };
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setFrom(e.clientX);
      }}
      onPointerMove={e => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) setFrom(e.clientX);
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, value + 1));
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, value - 1));
        else return;
        e.preventDefault();
      }}
      className={cx('group relative h-8 cursor-pointer select-none outline-none', className)}
    >
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-[var(--text-3)]" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-accent" style={{ width: `${pct}%` }} />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-layer border border-stroke-strong shadow-card flex items-center justify-center"
        style={{ left: `${pct}%` }}
      >
        <div className="w-3 h-3 rounded-full bg-accent transition-transform duration-100 group-hover:scale-[1.2] group-active:scale-90" />
      </div>
    </div>
  );
}

/**
 * A desktop monitor showing the CURRENT wallpaper, with a miniature window and taskbar drawn in
 * the live theme + accent - so Personalization changes show up here the moment they apply.
 */
export function MonitorPreview({ width }: { width: number }) {
  const gid = useId();
  const wallpaper = useOS(s => s.settings.wallpaper);
  const accent = useOS(s => s.settings.accent);
  const bezel = Math.max(4, Math.round(width * 0.035));
  const screenW = width - bezel * 2;
  const screenH = Math.round((screenW * 9) / 16);
  const bodyH = screenH + bezel * 2;
  const neckW = Math.round(width * 0.13);
  const neckH = Math.round(width * 0.11);
  const baseW = Math.round(width * 0.38);
  const baseH = Math.max(4, Math.round(width * 0.03));
  const totalH = bodyH + neckH + baseH;
  const bar = Math.max(5, Math.round(screenH * 0.075));

  return (
    <div className="relative shrink-0" style={{ width, height: totalH }} aria-hidden>
      <svg width={width} height={totalH} className="absolute inset-0">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7d838c" />
            <stop offset="0.5" stopColor="#b9bec6" />
            <stop offset="1" stopColor="#7d838c" />
          </linearGradient>
        </defs>
        <path d={`M${(width - neckW) / 2} ${bodyH - 2} h${neckW} l${neckW * 0.12} ${neckH + 2} h${-neckW * 1.24} z`} fill={`url(#${gid})`} />
        <rect x={(width - baseW) / 2} y={bodyH + neckH} width={baseW} height={baseH} rx={baseH / 2} fill={`url(#${gid})`} />
        <rect x={0.5} y={0.5} width={width - 1} height={bodyH - 1} rx={Math.max(4, bezel)} fill="#151515" stroke="#3c3c3c" />
      </svg>
      <div className="absolute overflow-hidden rounded-[3px]" style={{ left: bezel, top: bezel, width: screenW, height: screenH }}>
        <Wallpaper id={wallpaper} accent={accent} />
        <div
          className="absolute rounded-[3px] bg-win border border-stroke-strong overflow-hidden shadow-card"
          style={{ left: '22%', top: '16%', width: '46%', height: '52%' }}
        >
          <div className="h-[14%] bg-win" />
          <div className="absolute left-0 right-0 bottom-0 top-[14%] bg-layer p-[6%] flex flex-col gap-[7%]">
            <div className="h-[12%] w-[55%] rounded-full bg-[var(--text-3)]" />
            <div className="h-[12%] w-[80%] rounded-full bg-[var(--text-3)] opacity-60" />
            <div className="h-[18%] w-[34%] rounded-[2px] bg-accent mt-auto" />
          </div>
        </div>
        <div className="absolute left-0 right-0 bottom-0 acrylic-bar flex items-center justify-center gap-[3px]" style={{ height: bar }}>
          <span className="rounded-[1px] bg-accent" style={{ width: bar * 0.55, height: bar * 0.55 }} />
          {[0, 1, 2].map(i => (
            <span key={i} className="rounded-[1px] bg-[var(--text-2)] opacity-70" style={{ width: bar * 0.55, height: bar * 0.55 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Copy text: the async clipboard API, else the execCommand fallback (NUI may refuse the first). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}
