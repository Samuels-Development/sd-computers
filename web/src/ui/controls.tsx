import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useExitFx } from '@/hooks/useExitFx';

// The control kit every app builds from. Colours come only from the theme tokens
// (tailwind.config.js), so dark/light/accent all "just work". Keep app code on these instead of
// hand-rolled buttons/inputs, so every window looks like the same OS.
//
// Motion comes from the Motion section of styles.css: every control eases its hover/press/focus
// through the baseline rule there (a control only needs its own transition-* utility when it wants
// something else, like the toggle's knob), and dialogs, info bars, badges and empty states animate
// in through their markers.
//
// Every control also carries a stable `ctl-*` marker class (ctl-btn, ctl-field, ctl-card, ...). The
// retro and mac styles re-skin ALL apps through those markers in their stylesheets
// (src/styles/<style>.css, scoped to .os-root[data-style=...]) - so never remove them.

const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

type ButtonVariant = 'standard' | 'accent' | 'subtle' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  compact?: boolean;
}

/** Fluent button: standard (neutral), accent (primary action), subtle (toolbar), danger. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'standard', icon, compact, className, children, ...rest },
  ref,
) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-ctl text-body select-none disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
  const size = compact ? 'h-7 px-2.5' : 'h-8 px-3';
  const look: Record<ButtonVariant, string> = {
    standard: 'bg-control hover:bg-control-hover active:bg-control-press border border-stroke-strong text-t1 shadow-card',
    accent: 'bg-accent hover:bg-accent-hover text-accent-on border border-transparent font-semibold',
    subtle: 'bg-transparent hover:bg-subtle active:bg-control-press text-t1 border border-transparent',
    danger: 'bg-[#c42b1c] hover:bg-[#b22a1b] text-white border border-transparent font-semibold',
  };
  return (
    <button ref={ref} type="button" className={cx('ctl-btn', `ctl-btn-${variant}`, base, size, look[variant], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

/** Square icon-only subtle button (toolbars, title areas). */
export function IconButton({ className, children, title, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cx('ctl-iconbtn inline-flex items-center justify-center w-8 h-8 rounded-ctl text-t1 hover:bg-subtle active:bg-control-press disabled:opacity-40 disabled:pointer-events-none', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

const fieldBase =
  'w-full rounded-ctl bg-[var(--input)] border border-stroke-strong text-t1 text-body placeholder:text-t3 outline-none ' +
  'border-b-[var(--text-3)] focus:bg-[var(--input-focus)] focus:border-b-2 focus:border-b-[var(--accent-fill)] disabled:opacity-50';

/** Fluent text box: underline turns accent on focus. */
export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx('ctl-field', fieldBase, 'h-8 px-2.5', className)} spellCheck={false} {...rest} />;
});

/** Multi-line text area with the same styling. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx('ctl-field ctl-textarea', fieldBase, 'px-2.5 py-1.5 resize-none os-scroll', className)} spellCheck={false} {...rest} />;
});

export { Select } from './Select';

/** Fluent toggle switch: the knob glides across, and stretches towards the other side while held. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('group inline-flex items-center gap-3 cursor-pointer select-none', disabled && 'opacity-50 pointer-events-none')}>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'ctl-toggle relative w-10 h-5 rounded-full border transition-colors duration-200',
          checked && 'is-on',
          checked ? 'bg-accent border-transparent' : 'bg-transparent border-[var(--text-2)]',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full transition-all duration-200 ease-[var(--ease-out)] group-active:w-[17px]',
            checked ? 'left-[22px] bg-[var(--accent-on)] group-active:left-[17px]' : 'left-[4px] bg-[var(--text-2)]',
          )}
        />
      </span>
      {label && <span className="text-body text-t1">{label}</span>}
    </label>
  );
}

/** Indeterminate progress ring. */
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg className={cx('ctl-spinner spin text-accent', className)} width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="44 60" />
    </svg>
  );
}

type Severity = 'info' | 'success' | 'warning' | 'error';

/** Fluent InfoBar: an inline status message with a severity icon. */
export function InfoBar({ severity = 'info', title, children, onClose }: { severity?: Severity; title?: ReactNode; children?: ReactNode; onClose?: () => void }) {
  const look: Record<Severity, { icon: ReactNode; bg: string }> = {
    info: { icon: <Info size={16} className="text-accent-text" />, bg: 'bg-card' },
    success: { icon: <CheckCircle2 size={16} className="text-success" />, bg: 'bg-[rgba(108,203,95,0.12)]' },
    warning: { icon: <AlertTriangle size={16} className="text-caution" />, bg: 'bg-[rgba(252,225,0,0.10)]' },
    error: { icon: <XCircle size={16} className="text-critical" />, bg: 'bg-[rgba(255,153,164,0.12)]' },
  };
  return (
    <div className={cx('ctl-infobar', `ctl-infobar-${severity}`, 'flex items-start gap-3 rounded-win border border-stroke px-4 py-3 text-body', look[severity].bg)}>
      <span className="mt-0.5 shrink-0">{look[severity].icon}</span>
      <div className="flex-1 min-w-0">
        {title && <span className="font-semibold mr-2">{title}</span>}
        <span className="text-t2">{children}</span>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 text-t2 hover:text-t1" aria-label="Close">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** A rounded settings-style card row: icon, title/description, trailing content. */
export function Card({ icon, title, description, children, className, onClick }: { icon?: ReactNode; title?: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx('ctl-card flex items-center gap-4 rounded-win bg-card border border-stroke px-4 py-3 min-h-[64px]', onClick && 'cursor-pointer hover:bg-card-hover', className)}
    >
      {icon && <span className="shrink-0 text-t1">{icon}</span>}
      {(title || description) && (
        <div className="flex-1 min-w-0">
          {title && <div className="text-body text-t1 truncate">{title}</div>}
          {description && <div className="text-caption text-t2 truncate">{description}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Left navigation item (NavigationView): accent pill on the selected item. */
export function NavItem({ icon, label, selected, onClick, badge }: { icon?: ReactNode; label: ReactNode; selected?: boolean; onClick?: () => void; badge?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'ctl-nav relative w-full flex items-center gap-3 h-9 px-3 rounded-ctl text-body text-left',
        selected && 'is-selected',
        selected ? 'bg-subtle text-t1' : 'text-t1 hover:bg-subtle',
      )}
    >
      {/* Placed with top, not a translate: pill-in animates its transform. */}
      {selected && <span className="absolute left-0 top-[10px] w-[3px] h-4 rounded-full bg-accent pill-in" />}
      {icon && <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge}
    </button>
  );
}

/** Small accent count badge. */
export function Badge({ children }: { children: ReactNode }) {
  return <span className="ctl-badge min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent text-accent-on text-[11px] font-semibold flex items-center justify-center">{children}</span>;
}

/**
 * Modal content dialog rendered INSIDE the app window (Fluent ContentDialog): dims the window body,
 * centres a card with a title, body and a button row. Fades and settles in, and back out when the
 * app stops rendering it.
 */
export function Dialog({ title, children, actions, onClose }: { title: ReactNode; children?: ReactNode; actions: ReactNode; onClose?: () => void }) {
  const ref = useExitFx('fade-out');
  return (
    <div ref={ref} className="ctl-dialog-shade absolute inset-0 z-40 flex items-center justify-center bg-black/40 fade-in" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="ctl-dialog w-[min(460px,92%)] rounded-win bg-layer shadow-flyout overflow-hidden">
        <div className="p-6">
          <div className="ctl-dialog-title text-subtitle font-semibold text-t1 mb-3">{title}</div>
          <div className="text-body text-t2">{children}</div>
        </div>
        <div className="ctl-dialog-actions flex justify-end gap-2 px-6 py-4 bg-win border-t border-stroke">{actions}</div>
      </div>
    </div>
  );
}

/** Centered empty/placeholder state. */
export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="ctl-empty h-full w-full flex flex-col items-center justify-center text-center gap-2 p-8 text-t2">
      {icon && <div className="mb-2 text-t3">{icon}</div>}
      <div className="text-body font-semibold text-t1">{title}</div>
      {children && <div className="text-caption max-w-[320px]">{children}</div>}
    </div>
  );
}
