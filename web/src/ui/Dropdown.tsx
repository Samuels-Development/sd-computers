import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useExitFx } from '@/hooks/useExitFx';
import { useEscape } from '@/admin/components/shared';
import { ScrollArea } from '@/admin/components/ScrollArea';

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
  icon?: ReactNode;
  group?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

interface Props<V extends string | number> {
  value: V;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  leading?: ReactNode;
  placeholder?: string;
  width?: number | string;
  disabled?: boolean;
  ariaLabel?: string;
  appearance?: 'admin' | 'os' | 'site';
  className?: string;
  triggerProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}

const MENU_MAX = 280;
const GAP = 6;

export function Select<V extends string | number>({ value, options, onChange, leading, placeholder, width, disabled, ariaLabel, appearance = 'admin', className = '', triggerProps = {} }: Props<V>) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  const isDisabled = disabled || triggerProps.disabled || !options.some(o => !o.disabled);

  useEffect(() => { if (isDisabled) setOpen(false); }, [isDisabled]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  return (
    <>
      <button {...triggerProps}
        ref={trigger}
        type="button"
        className={`${appearance === 'admin' ? 'sc-select' : appearance === 'site' ? 'flex items-center gap-2 text-left' : 'ctl-field ctl-select flex items-center gap-2 w-full h-8 px-2 rounded-ctl bg-[var(--input)] border border-stroke-strong text-t1 text-body text-left outline-none focus:border-accent disabled:opacity-50'} ${className}`}
        data-open={open}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? triggerProps['aria-label']}
        aria-controls={open ? menuId : undefined}
        style={{ ...triggerProps.style, width: width ?? triggerProps.style?.width }}
        onClick={e => { triggerProps.onClick?.(e); if (!e.defaultPrevented) setOpen(o => !o); }}
        onKeyDown={e => {
          triggerProps.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {leading && <span className="sc-select__lead">{leading}</span>}
        {current?.icon && <span className="sc-select__icon">{current.icon}</span>}
        <span className={appearance !== 'admin' ? 'flex-1 min-w-0 truncate' : 'sc-select__value'} data-placeholder={!current}>
          {current?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown size={14} className={appearance !== 'admin' ? `ctl-select-chevron shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}` : 'sc-select__chevron'} />
      </button>
      {open && !isDisabled && trigger.current && <Menu id={menuId} appearance={appearance} anchor={trigger.current} options={options} value={value} onPick={v => { onChange(v); close(); }} onClose={close} />}
    </>
  );
}

function Menu<V extends string | number>({
  anchor,
  id,
  appearance,
  options,
  value,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  id: string;
  appearance: 'admin' | 'os' | 'site';
  options: SelectOption<V>[];
  value: V;
  onPick: (value: V) => void;
  onClose: (refocus?: boolean) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const exitRef = useExitFx('select-menu-out');
  const setMenu = useCallback((node: HTMLDivElement | null) => {
    menu.current = node;
    exitRef(node);
  }, [exitRef]);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; maxHeight: number } | null>(null);
  const [active, setActive] = useState(() => {
    const selected = options.findIndex(o => o.value === value && !o.disabled);
    return selected >= 0 ? selected : Math.max(0, options.findIndex(o => !o.disabled));
  });
  const typed = useRef({ text: '', at: 0 });
  const siteStyle = useMemo<CSSProperties>(() => {
    if (appearance !== 'site') return {};
    const css = getComputedStyle(anchor);
    return {
      background: css.getPropertyValue('--s-surface'), color: css.getPropertyValue('--s-ink'),
      borderColor: css.getPropertyValue('--s-line-strong'), borderRadius: css.getPropertyValue('--s-radius'),
      fontFamily: css.fontFamily, ['--select-hover' as string]: css.getPropertyValue('--s-hover'),
    };
  }, [appearance, anchor]);

  useEscape(() => onClose());

  const place = useCallback(() => {
    const r = anchor.getBoundingClientRect();
    if (!r.width || !r.height) { onClose(false); return; }
    const below = window.innerHeight - r.bottom;
    const up = below < Math.min(MENU_MAX, (menu.current?.scrollHeight ?? MENU_MAX) + GAP * 2) && r.top > below;
    const width = Math.min(Math.max(r.width, 160), window.innerWidth - 16);
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: up ? r.top - GAP : r.bottom + GAP,
      width, up, maxHeight: Math.max(0, Math.min(MENU_MAX, (up ? r.top : below) - GAP - 8)) });
  }, [anchor, onClose]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node) || anchor.contains(e.target as Node)) return;
      onClose(false);
    };
    const moved = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return;
      place();
    };
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', place);
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    return () => {
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', place);
      observer.disconnect();
    };
  }, [anchor, onClose, place]);

  useEffect(() => {
    const item = menu.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!item) return;
    const view = item.closest('.sc-scrollarea__view') as HTMLElement | null ?? menu.current;
    if (!view) return;
    const itemRect = item.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    if (itemRect.top < viewRect.top) view.scrollTop -= viewRect.top - itemRect.top;
    else if (itemRect.bottom > viewRect.bottom) view.scrollTop += itemRect.bottom - viewRect.bottom;
  }, [active, pos]);

  useEffect(() => {
    anchor.setAttribute('aria-activedescendant', `${id}-${active}`);
    return () => anchor.removeAttribute('aria-activedescendant');
  }, [anchor, id, active]);

  useEffect(() => {
    const step = (from: number, dir: 1 | -1) => {
      for (let i = 1; i <= options.length; i++) {
        const next = (from + dir * i + options.length) % options.length;
        if (!options[next].disabled) return next;
      }
      return from;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') setActive(a => step(a, 1));
      else if (e.key === 'ArrowUp') setActive(a => step(a, -1));
      else if (e.key === 'Home') setActive(step(-1, 1));
      else if (e.key === 'End') setActive(step(options.length, -1));
      else if (e.key === 'Enter' || e.key === ' ') {
        const o = options[active];
        if (o && !o.disabled) onPick(o.value);
      } else if (e.key === 'Tab') {
        onClose(false);
        return;
      } else if (e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        typed.current.text = (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLowerCase();
        typed.current.at = now;
        const hit = options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
        if (hit >= 0) setActive(hit);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [options, active, onPick, onClose]);

  const items = (<>
      {options.map((o, i) => (
        <div key={String(o.value)}>
          {o.group && o.group !== options[i - 1]?.group && <div className={appearance === 'admin' ? 'sc-menu__group' : 'px-2 py-1 text-caption opacity-60'}>{o.group}</div>}
          <div
            id={`${id}-${i}`}
            role="option"
            aria-selected={o.value === value}
            aria-disabled={o.disabled}
            data-index={i}
            data-active={i === active}
            style={o.style}
            className={appearance !== 'admin' ? `ctl-select-option flex items-center gap-2 min-h-[30px] px-2 py-1 rounded-ctl ${o.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${i === active ? 'bg-subtle' : ''}` : 'sc-menu__item'}
            onMouseEnter={() => !o.disabled && setActive(i)}
            onMouseDown={e => e.preventDefault()}
            onClick={() => !o.disabled && onPick(o.value)}
          >
            {o.icon && <span className="sc-select__icon">{o.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block truncate">{o.label}</span>
              {o.hint && <span className="block truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>{o.hint}</span>}
            </span>
            <Check size={13} className="shrink-0" style={{ opacity: o.value === value ? 1 : 0 }} />
          </div>
        </div>
      ))}
  </>);

  return createPortal(
    appearance !== 'admin' ? (
      <div ref={setMenu} id={id} role="listbox" aria-label={anchor.getAttribute('aria-label') ?? undefined} className={`ctl-select-menu fixed z-[10000] p-1 rounded-win border border-stroke-strong bg-layer shadow-flyout text-body text-t1 overflow-y-auto os-scroll ${appearance === 'site' ? 'site-select-menu' : ''}`}
        style={{ ...siteStyle, left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: pos?.width, maxHeight: pos?.maxHeight ?? MENU_MAX,
          ['--select-menu-y' as string]: pos?.up ? '-100%' : '0%', ['--select-menu-slide' as string]: pos?.up ? '6px' : '-6px',
          transformOrigin: pos?.up ? 'bottom center' : 'top center', transform: pos?.up ? 'translateY(-100%)' : undefined }}>
        {items}
      </div>
    ) : (
    <ScrollArea
      rootRef={menu}
      role="listbox"
      className="sc-menu"
      fade={false}
      rootAttrs={{ id, 'data-up': pos?.up }}
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        minWidth: pos?.width,
        maxWidth: Math.max(pos?.width ?? 0, 320),
        transform: pos?.up ? 'translateY(-100%)' : undefined,
        maxHeight: pos?.maxHeight ?? MENU_MAX,
      }}
    >
      {items}
    </ScrollArea>),
    appearance !== 'admin' ? anchor.closest('.os-root') ?? document.body : document.body,
  );
}
