import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Check, ImageOff, Mail, MessageSquare, Phone, RefreshCw, X } from 'lucide-react';
import { useOS } from '@/store/os';
import { rpc } from '@/nui/rpc';
import { t } from '@/i18n';
import { Select, type SelectProps } from '@/ui/Select';
import type { LiveKind, Network, Site as SiteDef } from '../types';
import { cx } from '../model';
import { openHandlers, type OpenFn } from '../parts';

// What the live sites are built from. A website is not the desktop it is looked at on: every site
// has a brand of its own (src/styles/sites.css) and keeps it in every theme and every look, so
// nothing in here is the OS's control kit - a site has its own few controls, drawn from the
// variables its brand sets. Each site lays its own pages out; these are only the pieces they share:
// the frame that makes a page that brand's, a link, the controls, a picture that fails quietly, how
// to reach whoever posted something, and the states a page that has to ask for its contents is in
// before it has them.

/** What every live page is handed. */
export interface LiveProps {
  site: SiteDef;
  live: LiveKind;
  /** What follows the site's address: ['story', '12']. */
  path: string[];
  net: Network;
  /** This tab is the one being looked at. */
  shown: boolean;
  onOpen: OpenFn;
}

/** Whether this computer has an app for this player right now (the phone's apps come and go with the link). */
export const useHasApp = (id: string): boolean => useOS(s => s.payload?.computer.apps.some(a => a.id === id) ?? false);

/**
 * A site's page: the scrolling frame, in that brand's colours and type. (The scrollbar is the one
 * thing here that is the desktop's, as it is in any browser.)
 */
export function Site({ brand, children }: { brand: string; children: ReactNode }) {
  return <div className={`site site-${brand} h-full overflow-y-auto os-scroll flex flex-col`}>{children}</div>;
}

/** A link inside a page: opens like every other thing that opens a page (Ctrl-click = a new tab). */
export function A({ to, onOpen, className, children, title }: { to: string; onOpen: OpenFn; className?: string; children: ReactNode; title?: string }) {
  return (
    <button type="button" title={title} {...openHandlers(newTab => onOpen(to, newTab))} className={cx('text-left cursor-pointer', className)}>
      {children}
    </button>
  );
}

type BtnKind = 'plain' | 'primary' | 'ghost' | 'danger';

export function Btn({ kind = 'plain', small, icon, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean; icon?: ReactNode }) {
  return (
    <button type="button" className={cx('s-btn', kind !== 'plain' && `s-btn--${kind}`, small && 's-btn--sm', className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx('s-input', className)} spellCheck={false} autoComplete="off" {...rest} />;
export const Area = ({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx('s-area os-scroll', className)} spellCheck={false} {...rest} />;
export const Pick = ({ className, ...rest }: SelectProps) => <Select appearance="site" className={cx('s-select', className)} {...rest} />;

/** A labelled field of a form. */
export function Field({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="s-label">{label}</span>
        {aside && <span className="s-faint text-[12px] tabular-nums">{aside}</span>}
      </span>
      {children}
    </label>
  );
}

export function CheckBox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('s-check', checked && 'is-on')}>
      <span className="s-check-box">{checked && <Check size={13} strokeWidth={3} />}</span>
      <span className="text-[14px]">{label}</span>
    </button>
  );
}

export function Note({ tone = 'info', children, onClose }: { tone?: 'info' | 'error' | 'success'; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`s-note s-note--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <span className="flex-1 min-w-0">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="s-faint shrink-0 cursor-pointer" aria-label={t('ui.common.close')}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** A question over the page (the site's own, not a window of the desktop's). */
export function Modal({ title, children, actions, onClose }: { title: string; children?: ReactNode; actions: ReactNode; onClose: () => void }) {
  return (
    <div
      className="s-shade fade-in"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="s-modal">
        <div className="px-5 pt-5 pb-4">
          <div className="mb-2 text-[17px] font-semibold">{title}</div>
          <div className="s-muted text-[14px]">{children}</div>
        </div>
        <div className="s-modal-foot">{actions}</div>
      </div>
    </div>
  );
}

/** A picture by address, cut to fill its box. One that does not load leaves a quiet placeholder. */
export function Picture({ src, className, alt = '' }: { src?: string; className?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={cx('s-thumb flex items-center justify-center', className)} aria-hidden>
        <ImageOff size={18} />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" draggable={false} onError={() => setFailed(true)} className={cx('object-cover', className)} />;
}

/** A phone number as people write one: (555) 123-4567 where it is the right length, else as it is. */
export function fmtNumber(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return digits;
}

/**
 * How to reach whoever posted something: their number and their address, and - on a computer
 * that has the app for it - a button that opens Messages on that number, or Mail on a new message
 * to that address. Messages is the player's phone, so it is only there while their phone is linked
 * to this computer; without it the number is still there to be read.
 */
export function Contact({ number, email, subject }: { number?: string; email?: string; subject?: string }) {
  const hasMessages = useHasApp('messages');
  const hasMail = useHasApp('mail');
  if (!number && !email) return null;
  const open = useOS.getState().openApp;
  return (
    <div className="flex flex-col gap-2.5">
      {number && (
        <div className="flex items-center gap-3">
          <Phone size={15} className="s-faint shrink-0" />
          <span className="text-[15px] font-semibold select-text tabular-nums">{fmtNumber(number)}</span>
          {hasMessages && (
            <Btn small kind="primary" icon={<MessageSquare size={13} />} onClick={() => open('messages', { number })}>
              {t('ui.browser.live_message')}
            </Btn>
          )}
        </div>
      )}
      {email && (
        <div className="flex items-center gap-3 min-w-0">
          <Mail size={15} className="s-faint shrink-0" />
          <span className="text-[14px] select-text truncate">{email}</span>
          {hasMail && (
            <Btn small icon={<Mail size={13} />} onClick={() => open('mail', { to: email, subject: subject ?? '' })}>
              {t('ui.browser.live_email')}
            </Btn>
          )}
        </div>
      )}
      {number && !hasMessages && <p className="s-faint text-[12px]">{t('ui.browser.live_link_hint')}</p>}
    </div>
  );
}

/** The page has asked and not heard yet. */
export function Waiting() {
  return (
    <div className="py-20 flex justify-center fade-in">
      <div className="s-spin" />
    </div>
  );
}

/** The page asked and was told no. */
export function Failed({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="py-10 flex flex-col items-start gap-3 max-w-[560px]">
      <div className="w-full">
        <Note tone="error">
          <b className="block">{t('ui.browser.live_failed')}</b>
          {error}
        </Note>
      </div>
      <Btn icon={<RefreshCw size={14} />} onClick={onRetry}>
        {t('ui.common.retry')}
      </Btn>
    </div>
  );
}

/** There is nothing here (yet). */
export function Nothing({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-14 text-center">
      <div className="text-[15px] font-semibold">{title}</div>
      {children && <div className="s-muted mt-1 text-[13px]">{children}</div>}
    </div>
  );
}

/** A small label: a state, a kind. */
export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'good' | 'warn' | 'bad' }) {
  return <span className={cx('s-tag', tone !== 'plain' && `s-tag--${tone}`)}>{children}</span>;
}

interface Photo {
  id: string;
  url: string;
  video: boolean;
  place?: string;
}

/** The stills in the player's PHONE gallery, and whether that gallery is on this computer at all. */
interface Gallery {
  phone: boolean;
  photos: Photo[];
}

/**
 * The Photos app's list, down to what a post can carry. That app is on every computer and also
 * holds the pictures a character added at a desk, which the phone would drop from a post: only the
 * ones that are the phone's count here.
 */
async function phoneGallery(): Promise<{ gallery?: Gallery; error?: string }> {
  const res = await rpc<{ photos?: unknown; phone?: unknown }>('photos:list');
  if (!res.ok) return { error: res.error ?? t('ui.common.error') };
  const rows = Array.isArray(res.data?.photos) ? (res.data.photos as Photo[]) : [];
  return { gallery: { phone: res.data?.phone === true, photos: rows.filter(p => p && typeof p.url === 'string' && p.place === 'phone' && !p.video) } };
}

/**
 * Pictures for a post, out of the player's phone gallery (the Photos app's own list). The phone
 * takes nothing else on a post, which is why this is a picker and not a box to paste a link into.
 */
export function PhotoPicker({ max, picked, onDone, onClose }: { max: number; picked: string[]; onDone: (urls: string[]) => void; onClose: () => void }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>(picked);

  useEffect(() => {
    let live = true;
    void phoneGallery().then(r => {
      if (!live) return;
      if (r.gallery) setPhotos(r.gallery.photos);
      else setError(r.error ?? t('ui.common.error'));
    });
    return () => {
      live = false;
    };
  }, []);

  const toggle = (url: string) => setChosen(list => (list.includes(url) ? list.filter(u => u !== url) : list.length < max ? [...list, url] : max === 1 ? [url] : list));

  return (
    <Modal
      title={t(max === 1 ? 'ui.browser.live_pick_one' : 'ui.browser.live_pick_many', max)}
      onClose={onClose}
      actions={
        <>
          <Btn onClick={onClose}>{t('ui.common.cancel')}</Btn>
          <Btn kind="primary" disabled={!photos} onClick={() => onDone(chosen)}>
            {t('ui.browser.live_pick_use')}
          </Btn>
        </>
      }
    >
      {error ? (
        <Note tone="error">{error}</Note>
      ) : !photos ? (
        <div className="py-8 flex justify-center">
          <div className="s-spin" />
        </div>
      ) : photos.length === 0 ? (
        <p>{t('ui.browser.live_pick_none')}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto os-scroll pr-1">
          {photos.map(p => {
            const on = chosen.includes(p.url);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.url)} className="relative aspect-square overflow-hidden cursor-pointer" style={{ borderRadius: 6, outline: on ? '3px solid var(--s-brand)' : 'none', outlineOffset: -3 }}>
                <Picture src={p.url} className="w-full h-full" />
                {on && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--s-brand)', color: 'var(--s-on-brand)' }}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** The pictures on a post being written: what is on it, and (the phone linked here) a way to choose. */
export function PhotoField({ images, max, onChange }: { images: string[]; max: number; onChange: (urls: string[]) => void }) {
  const hasApp = useHasApp('photos');
  // Having Photos says nothing about the phone any more: the list itself says whether its gallery is here.
  const [linked, setLinked] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!hasApp) {
      setLinked(false);
      return;
    }
    let live = true;
    void phoneGallery().then(r => {
      if (live) setLinked(r.gallery?.phone === true);
    });
    return () => {
      live = false;
    };
  }, [hasApp]);
  return (
    <div>
      {images.length > 0 && (
        <div className="mb-2 flex gap-2">
          {images.map(src => (
            <div key={src} className="relative w-20 h-20 overflow-hidden" style={{ borderRadius: 6, border: '1px solid var(--s-line)' }}>
              <Picture src={src} className="w-full h-full" />
              <button type="button" title={t('ui.browser.live_remove')} onClick={() => onChange(images.filter(u => u !== src))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {linked === null ? null : linked ? <Btn onClick={() => setPicking(true)}>{t('ui.browser.live_pick')}</Btn> : <p className="s-faint text-[12px]">{t('ui.browser.live_pick_unlinked')}</p>}
      {picking && (
        <PhotoPicker
          max={max}
          picked={max === 1 ? [] : images}
          onClose={() => setPicking(false)}
          onDone={urls => {
            setPicking(false);
            onChange(urls.slice(0, max));
          }}
        />
      )}
    </div>
  );
}
