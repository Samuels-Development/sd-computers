import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ClipboardEvent, type MutableRefObject, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Signature,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { t } from '@/i18n';
import { IconButton, Select, TextInput } from '@/ui/controls';
import {
  FONTS,
  FONT_KEYS,
  INKS,
  INK_KEYS,
  INK_USUAL,
  MAX_SIGNS,
  SIZES,
  SIZE_KEYS,
  SIZE_USUAL,
  docLength,
  docToHtml,
  domToDoc,
  emptyDoc,
  figureHtml,
  fontOf,
  parseDoc,
  signHtml,
  signRowHtml,
  type FontKey,
  type InkKey,
  type SizeKey,
} from '@/lib/richdoc';
import { PhotoPicker } from '../photos/Picker';
import { cx } from './model';

// The page a document is written on: a sheet of paper on a desk, set in the document's own
// typeface, with a toolbar over it. What is typed is the browser's own editing (a contentEditable
// page, and execCommand for the marks) - but what is KEPT is never that markup: every change is read
// back off the page into the document's blocks (src/lib/richdoc.tsx > domToDoc), and it is the
// blocks, as JSON, that reach the store and the server. Pasted text comes in as plain text. A
// picture comes out of the gallery (the Photos picker), which is the only place one can come from.
//
// A part of the text can have a typeface, a size and an ink of its own: with text selected, the
// boxes for those change that text. With nothing selected the typeface box sets the whole
// document, and the other two set what is typed next. A line to sign on is a block like a picture
// is: it is put in, named for whoever is to sign it, and signed later, on the printed page.

/** What a block can be, as the style box offers it (the tag formatBlock is asked for). */
const STYLES: { key: string; tag: string }[] = [
  { key: 'p', tag: 'P' },
  { key: 'h1', tag: 'H1' },
  { key: 'h2', tag: 'H2' },
  { key: 'h3', tag: 'H3' },
  { key: 'quote', tag: 'BLOCKQUOTE' },
];

const exec = (command: string, value?: string): void => {
  document.execCommand(command, false, value);
};

/** The block the caret is in: the child of the page that holds it. */
function blockAt(page: HTMLElement, node: Node | null): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur.parentNode !== page) cur = cur.parentNode;
  return cur instanceof HTMLElement ? cur : null;
}

const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'FIGURE', 'HR', 'SECTION']);

/** The typeface, size and ink of its own the text at a place in the page has ('' = none: the usual). */
function fontAt(page: HTMLElement, node: Node | null): { face: FontKey | ''; size: SizeKey | ''; ink: InkKey | '' } {
  let face: FontKey | '' | undefined;
  let size: SizeKey | '' | undefined;
  let ink: InkKey | '' | undefined;
  // (the nearest element that says anything about one of them is the one that counts)
  for (let cur: Node | null = node; cur && cur !== page; cur = cur.parentNode) {
    if (!(cur instanceof HTMLElement)) continue;
    const said = fontOf(cur);
    if (face === undefined && said.f) face = said.f;
    if (size === undefined && said.z !== undefined) size = said.z ?? '';
    if (ink === undefined && said.c !== undefined) ink = said.c ?? '';
  }
  return { face: face ?? '', size: size ?? '', ink: ink ?? '' };
}

/** Where the text of a selection starts (a range's own start can be the end of the text before it). */
function firstText(r: Range): Node {
  const root = r.commonAncestorContainer;
  if (r.collapsed || root.nodeType === Node.TEXT_NODE) return r.startContainer;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!r.intersectsNode(n)) continue;
    if (n === r.startContainer && r.startOffset >= (n.textContent ?? '').length) continue;
    if (n === r.endContainer && r.endOffset === 0) continue;
    return n;
  }
  return r.startContainer;
}

/** A number of its own for each block that gets selected, so the boxes for it start from its own values. */
let picked = 0;

/**
 * Keep the page flat: one block after another. Asked for a list in the middle of a paragraph, the
 * browser puts the list INSIDE the paragraph, and the next paragraph inside that; here each comes
 * back out to stand on its own, in the order it reads. The caret stays where it was.
 */
function tidy(page: HTMLElement): void {
  // Rows of lines to sign on that follow one another are one row (two lines sit side by side).
  page.querySelectorAll(':scope > section.sig-row').forEach(row => {
    if (!row.isConnected) return;
    for (let next = row.nextElementSibling; next && next.matches('section.sig-row'); next = row.nextElementSibling) {
      while (next.firstChild) row.appendChild(next.firstChild);
      next.remove();
    }
    if (!row.querySelector('.sig')) row.remove();
  });
  // Joining two lines, the browser pins the size the text had on it in pixels: a part's size is
  // only ever one of the sizes a document has, so that is taken off again.
  page.querySelectorAll<HTMLElement>('span[style]').forEach(span => {
    if (span.style.fontSize) span.style.fontSize = '';
    if (span.style.lineHeight) span.style.lineHeight = '';
  });

  const wrapped = Array.from(page.children).filter(c => (c.tagName === 'P' || c.tagName === 'DIV') && Array.from(c.children).some(k => BLOCKS.has(k.tagName)));
  if (!wrapped.length) return;
  const sel = document.getSelection();
  const kept = sel && sel.rangeCount > 0 ? { an: sel.anchorNode, ao: sel.anchorOffset, fn: sel.focusNode, fo: sel.focusOffset } : null;
  for (const outer of wrapped) {
    let loose: HTMLElement | null = null;
    for (const child of Array.from(outer.childNodes)) {
      if (child instanceof HTMLElement && BLOCKS.has(child.tagName)) {
        loose = null;
        outer.before(child);
      } else if (child.nodeType === Node.TEXT_NODE && !(child.textContent ?? '').trim() && !loose) {
        child.remove();
      } else {
        if (!loose) {
          loose = document.createElement('p');
          outer.before(loose);
        }
        loose.appendChild(child);
      }
    }
    outer.remove();
  }
  if (kept && kept.an && kept.fn && page.contains(kept.an) && page.contains(kept.fn)) {
    try {
      sel?.setBaseAndExtent(kept.an, kept.ao, kept.fn, kept.fo);
    } catch {
      // the caret is wherever the browser left it
    }
  }
}

interface Marks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  style: string;
  align: string;
  list: '' | 'ul' | 'ol';
  /** the typeface, size and ink of its own the text there has ('' = the usual) */
  face: FontKey | '';
  size: SizeKey | '';
  ink: InkKey | '';
  /** text is selected (not just a caret): the typeface box is about that text */
  ranged: boolean;
}
const NO_MARKS: Marks = { bold: false, italic: false, underline: false, strike: false, style: 'p', align: 'left', list: '', face: '', size: '', ink: '', ranged: false };

export function RichEditor({
  value,
  onChange,
  onRebase,
  limit,
  pageRef,
  canInsertPictures,
}: {
  /** the document, as JSON */
  value: string;
  onChange: (json: string) => void;
  /** the same document written the way this page writes one: not an edit, so the store takes it as what is saved too */
  onRebase: (json: string) => void;
  /** most characters of text it may hold */
  limit: number;
  pageRef: MutableRefObject<HTMLDivElement | null>;
  canInsertPictures: boolean;
}) {
  const page = useRef<HTMLDivElement | null>(null);
  /** The JSON this page last handed up: anything else arriving as `value` came from outside (opened, discarded). */
  const emitted = useRef<string | null>(null);
  const [font, setFont] = useState<FontKey>('serif');
  const fontRef = useRef(font);
  fontRef.current = font;
  const [marks, setMarks] = useState<Marks>(NO_MARKS);
  const [figure, setFigure] = useState<HTMLElement | null>(null);
  /** The line to sign on that is selected. */
  const [line, setLine] = useState<HTMLElement | null>(null);
  const lineRef = useRef(line);
  lineRef.current = line;
  const [picking, setPicking] = useState(false);
  const [inking, setInking] = useState(false);
  /** Where the caret was when the picture picker opened (the picker takes the focus away). */
  const caret = useRef<Range | null>(null);
  /** The last selection inside the page: a box on the toolbar takes the focus, and it is put back for the command. */
  const range = useRef<Range | null>(null);

  const emit = useCallback(() => {
    const el = page.current;
    if (!el) return;
    tidy(el);
    // (a line that was deleted with the text round it is not selected any more)
    if (lineRef.current && !el.contains(lineRef.current)) setLine(null);
    const json = JSON.stringify(domToDoc(el, fontRef.current));
    if (json === emitted.current) return;
    emitted.current = json;
    onChange(json);
  }, [onChange]);

  // A document from outside (opened, or what was typed thrown away): put it on the page.
  useLayoutEffect(() => {
    const el = page.current;
    if (!el || value === emitted.current) return;
    const doc = parseDoc(value) ?? emptyDoc();
    el.innerHTML = docToHtml(doc);
    setFont(doc.font);
    setFigure(null);
    setLine(null);
    range.current = null;
    // The page writes a document its own way (runs merged, keys in its order): what is on it now is
    // the same document, and is handed up as that - or the first keystroke would look like two.
    const json = JSON.stringify(domToDoc(el, doc.font));
    emitted.current = json;
    if (json !== value) onRebase(json);
  }, [value, onRebase]);

  useEffect(() => {
    exec('defaultParagraphSeparator', 'p');
    exec('styleWithCSS', 'false');
  }, []);

  // What the toolbar lights up: the marks and the style of wherever the caret is. It is read when
  // the selection moves, and after a command: one that changes the text under a selection without
  // moving it (a size, an ink) is not a move.
  const read = useCallback(() => {
    const el = page.current;
    const sel = document.getSelection();
    if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
    const block = blockAt(el, sel.anchorNode);
    const tag = block?.tagName ?? 'P';
    const style = STYLES.find(s => s.tag === tag)?.key ?? 'p';
    const align = block?.style.textAlign || 'left';
    const live = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    range.current = live ? live.cloneRange() : null;
    setMarks({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      style,
      align: align === 'start' ? 'left' : align,
      list: tag === 'UL' ? 'ul' : tag === 'OL' ? 'ol' : '',
      ...fontAt(el, live ? firstText(live) : sel.anchorNode),
      ranged: !!live && !live.collapsed,
    });
  }, []);
  useEffect(() => {
    document.addEventListener('selectionchange', read);
    return () => document.removeEventListener('selectionchange', read);
  }, [read]);

  const focus = () => page.current?.focus();
  const run = (command: string, arg?: string) => {
    const el = page.current;
    // A box on the toolbar takes the focus: coming back, the selection is put where it was.
    const away = !!el && document.activeElement !== el;
    focus();
    const sel = document.getSelection();
    if (away && el && sel && range.current && el.contains(range.current.startContainer)) {
      sel.removeAllRanges();
      sel.addRange(range.current);
    }
    exec(command, arg);
    emit();
    read();
  };

  /** Mark one block of the page as the selected one (a picture or a line to sign on), or none. */
  const select = (el: HTMLElement | null) => {
    page.current?.querySelectorAll('.is-selected').forEach(n => n.classList.remove('is-selected'));
    el?.classList.add('is-selected');
    if (el && !el.getAttribute('data-k')) el.setAttribute('data-k', String(++picked));
    setFigure(el && el.tagName === 'FIGURE' ? el : null);
    setLine(el && el.classList.contains('sig') ? el : null);
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) exec('insertText', text);
  };

  /** Put a block on the page after the one the caret is in, with a line under it to type on. Answers the block. */
  const insertBlock = (html: string): Element | null => {
    const el = page.current;
    if (!el) return null;
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const node = holder.firstElementChild;
    if (!node) return null;
    const at = caret.current && el.contains(caret.current.startContainer) ? blockAt(el, caret.current.startContainer) : null;
    if (at) at.after(node);
    else el.appendChild(node);
    if (!node.nextElementSibling) {
      const p = document.createElement('p');
      p.appendChild(document.createElement('br'));
      node.after(p);
    }
    const next = node.nextElementSibling;
    if (next) {
      const range = document.createRange();
      range.selectNodeContents(next);
      range.collapse(true);
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    emit();
    return node;
  };

  const remember = () => {
    const sel = document.getSelection();
    caret.current = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  };

  const setFigureAttr = (name: 'data-w' | 'data-a', v: string) => {
    if (!figure) return;
    figure.setAttribute(name, v);
    emit();
    // (the same element, changed: the toolbar is told to look at it again)
    setFigure(null);
    window.requestAnimationFrame(() => setFigure(figure));
  };

  const setCaption = (text: string) => {
    if (!figure) return;
    let cap = figure.querySelector('figcaption');
    if (!text.trim()) cap?.remove();
    else {
      if (!cap) {
        cap = document.createElement('figcaption');
        figure.appendChild(cap);
      }
      cap.textContent = text.slice(0, 120);
    }
    emit();
  };

  /** Put a line to sign on in: beside the one that is selected, else under where the caret is. */
  const addLine = () => {
    const el = page.current;
    if (!el) return;
    if (line && el.contains(line)) {
      line.insertAdjacentHTML('afterend', signHtml());
      emit();
      select(line.nextElementSibling as HTMLElement | null);
      return;
    }
    remember();
    // (it is left selected: its name can be typed straight away, and the next one goes in beside it)
    const row = insertBlock(signRowHtml(['']));
    select(row?.querySelector<HTMLElement>('.sig') ?? null);
  };

  const setLabel = (text: string) => {
    if (!line) return;
    const label = text.slice(0, 60);
    line.setAttribute('data-label', label);
    const under = line.querySelector('.sig-label');
    if (under) under.textContent = label;
    emit();
  };

  const used = (() => {
    const doc = parseDoc(value);
    return doc ? docLength(doc) : 0;
  })();
  const blank = used === 0 && !/"t":"(img|hr|ul|ol|sign)"/.test(value);
  const lines = value.split('"t":"sign"').length - 1;

  // The inks close on a press anywhere else.
  useEffect(() => {
    if (!inking) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('.doc-inks')) setInking(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [inking]);

  // At the limit nothing more goes in (taking text out still works). The browser's own event says
  // what an edit is about to do; React's stand-in for it does not.
  const room = useRef(true);
  room.current = used < limit;
  useEffect(() => {
    const el = page.current;
    if (!el) return;
    const guard = (e: InputEvent) => {
      if (!room.current && e.inputType.startsWith('insert')) e.preventDefault();
    };
    el.addEventListener('beforeinput', guard);
    return () => el.removeEventListener('beforeinput', guard);
  }, []);

  const btn = (title: string, on: boolean, onClick: () => void, icon: ReactNode) => (
    <IconButton title={title} onMouseDown={e => e.preventDefault()} onClick={onClick} className={cx('shrink-0', on && 'bg-subtle text-accent-text')} aria-pressed={on}>
      {icon}
    </IconButton>
  );

  return (
    <>
      <div className="doc-toolbar shrink-0 flex flex-wrap items-center gap-x-0.5 gap-y-1 px-2 py-1 border-b border-stroke">
        {/* With text selected this is that text's typeface; with none, the whole document's. */}
        <Select
          value={marks.ranged && marks.face ? marks.face : font}
          title={t('ui.files.font')}
          aria-label={t('ui.files.font')}
          onChange={value => {
            const next = value as FontKey;
            const el = page.current;
            const r = range.current;
            if (el && r && !r.collapsed && el.contains(r.startContainer)) {
              run('fontName', next);
              return;
            }
            setFont(next);
            fontRef.current = next;
            emit();
          }}
          className="!w-[112px] shrink-0"
          style={{ fontFamily: FONTS[marks.ranged && marks.face ? marks.face : font] }}
        >
          {FONT_KEYS.map(k => (
            <option key={k} value={k} style={{ fontFamily: FONTS[k] }}>
              {t(`ui.files.font_${k}`)}
            </option>
          ))}
        </Select>
        <Select
          value={marks.size || 'n'}
          title={t('ui.files.size')}
          aria-label={t('ui.files.size')}
          onChange={value => run('fontSize', value === 'n' ? SIZE_USUAL : SIZES[value as SizeKey])}
          className="!w-[90px] shrink-0 ml-1"
        >
          <option value="s">{t('ui.files.size_s')}</option>
          <option value="n">{t('ui.files.size_n')}</option>
          {SIZE_KEYS.filter(k => k !== 's').map(k => (
            <option key={k} value={k}>
              {t(`ui.files.size_${k}`)}
            </option>
          ))}
        </Select>
        <Select
          value={marks.list ? 'p' : marks.style}
          title={t('ui.files.style')}
          aria-label={t('ui.files.style')}
          onChange={value => run('formatBlock', STYLES.find(s => s.key === value)?.tag ?? 'P')}
          className="!w-[98px] shrink-0 ml-1"
        >
          {STYLES.map(s => (
            <option key={s.key} value={s.key}>
              {t(`ui.files.style_${s.key}`)}
            </option>
          ))}
        </Select>
        <span className="doc-sep" />
        {btn(t('ui.files.bold'), marks.bold, () => run('bold'), <Bold size={16} />)}
        {btn(t('ui.files.italic'), marks.italic, () => run('italic'), <Italic size={16} />)}
        {btn(t('ui.files.underline'), marks.underline, () => run('underline'), <Underline size={16} />)}
        {btn(t('ui.files.strike'), marks.strike, () => run('strikeThrough'), <Strikethrough size={16} />)}
        <span className="doc-inks relative shrink-0">
          {btn(t('ui.files.ink'), inking, () => setInking(v => !v), <Baseline size={16} style={{ color: marks.ink ? INKS[marks.ink] : undefined }} />)}
          {inking && (
            <span className="doc-inks-list absolute left-0 top-full mt-1 z-10 flex gap-1 p-1.5 rounded-win bg-flyout shadow-flyout">
              {(['', ...INK_KEYS] as (InkKey | '')[]).map(k => (
                <button
                  key={k || 'usual'}
                  type="button"
                  title={t(`ui.files.ink_${k || 'usual'}`)}
                  aria-label={t(`ui.files.ink_${k || 'usual'}`)}
                  aria-pressed={marks.ink === k}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setInking(false);
                    run('foreColor', k ? INKS[k] : INK_USUAL);
                  }}
                  style={{ backgroundColor: k ? INKS[k] : INK_USUAL }}
                />
              ))}
            </span>
          )}
        </span>
        <span className="doc-sep" />
        {btn(t('ui.files.align_left'), marks.align === 'left', () => run('justifyLeft'), <AlignLeft size={16} />)}
        {btn(t('ui.files.align_center'), marks.align === 'center', () => run('justifyCenter'), <AlignCenter size={16} />)}
        {btn(t('ui.files.align_right'), marks.align === 'right', () => run('justifyRight'), <AlignRight size={16} />)}
        {btn(t('ui.files.align_justify'), marks.align === 'justify', () => run('justifyFull'), <AlignJustify size={16} />)}
        <span className="doc-sep" />
        {btn(t('ui.files.list_bullets'), marks.list === 'ul', () => run('insertUnorderedList'), <List size={16} />)}
        {btn(t('ui.files.list_numbers'), marks.list === 'ol', () => run('insertOrderedList'), <ListOrdered size={16} />)}
        <span className="doc-sep" />
        {canInsertPictures &&
          btn(
            t('ui.files.picture'),
            false,
            () => {
              remember();
              setPicking(true);
            },
            <ImagePlus size={16} />,
          )}
        {btn(
          t('ui.files.rule'),
          false,
          () => {
            remember();
            insertBlock('<hr>');
          },
          <Minus size={16} />,
        )}
        <IconButton title={t('ui.files.sign_add')} onMouseDown={e => e.preventDefault()} onClick={addLine} disabled={lines >= MAX_SIGNS} className="shrink-0">
          <Signature size={16} />
        </IconButton>
        <span className="doc-sep" />
        {btn(t('ui.files.undo'), false, () => run('undo'), <Undo2 size={16} />)}
        {btn(t('ui.files.redo'), false, () => run('redo'), <Redo2 size={16} />)}
      </div>

      {/* A picture that is selected has its own row: how wide it is, where it sits, what is under it. */}
      {figure && (
        <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-b border-stroke bg-subtle text-caption text-t2">
          <span className="px-1 shrink-0">{t('ui.files.picture_width')}</span>
          {[25, 50, 75, 100].map(w => (
            <button
              key={w}
              type="button"
              onClick={() => setFigureAttr('data-w', String(w))}
              className={cx('h-6 px-2 rounded-ctl shrink-0', figure.getAttribute('data-w') === String(w) ? 'bg-accent text-accent-on' : 'hover:bg-control-press text-t1')}
            >
              {w}%
            </button>
          ))}
          <span className="doc-sep" />
          {btn(t('ui.files.align_left'), figure.getAttribute('data-a') === 'left', () => setFigureAttr('data-a', 'left'), <AlignLeft size={15} />)}
          {btn(t('ui.files.align_center'), (figure.getAttribute('data-a') ?? 'center') === 'center', () => setFigureAttr('data-a', 'center'), <AlignCenter size={15} />)}
          {btn(t('ui.files.align_right'), figure.getAttribute('data-a') === 'right', () => setFigureAttr('data-a', 'right'), <AlignRight size={15} />)}
          <span className="doc-sep" />
          <TextInput
            key={figure.querySelector('img')?.getAttribute('src') ?? ''}
            defaultValue={figure.querySelector('figcaption')?.textContent ?? ''}
            onChange={e => setCaption(e.target.value)}
            maxLength={120}
            placeholder={t('ui.files.caption')}
            aria-label={t('ui.files.caption')}
            className="flex-1 min-w-[120px] !h-7"
          />
          {btn(
            t('ui.files.picture_remove'),
            false,
            () => {
              figure.remove();
              setFigure(null);
              emit();
            },
            <Trash2 size={15} />,
          )}
        </div>
      )}

      {/* So has a line to sign on: whose it is, and a way to take it out. */}
      {line && (
        <div className="shrink-0 flex items-center gap-1 px-2 py-1 border-b border-stroke bg-subtle text-caption text-t2">
          <span className="px-1 shrink-0">{t('ui.files.sign_whose')}</span>
          <TextInput
            key={line.getAttribute('data-k') ?? ''}
            defaultValue={line.getAttribute('data-label') ?? ''}
            onChange={e => setLabel(e.target.value)}
            maxLength={60}
            placeholder={t('ui.files.sign_whose_placeholder')}
            aria-label={t('ui.files.sign_whose')}
            className="flex-1 min-w-[120px] max-w-[320px] !h-7"
          />
          <span className="px-1 truncate text-t3">{t('ui.files.sign_note')}</span>
          <span className="flex-1" />
          {btn(
            t('ui.files.sign_remove'),
            false,
            () => {
              line.remove();
              select(null);
              emit();
            },
            <Trash2 size={15} />,
          )}
        </div>
      )}

      <div
        className="doc-desk flex-1 min-h-0 overflow-y-auto os-scroll"
        onMouseDown={e => {
          // A press on the desk beside the sheet puts the caret at the end of the document.
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          const el = page.current;
          if (!el) return;
          el.focus();
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = document.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }}
      >
        <div
          ref={el => {
            page.current = el;
            pageRef.current = el;
          }}
          className={cx('doc-page rd', blank && 'is-blank')}
          style={{ fontFamily: FONTS[font], '--sig-hint': JSON.stringify(t('ui.files.sign_hint')) } as CSSProperties}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          role="textbox"
          aria-multiline
          aria-label={t('ui.files.body_label')}
          data-placeholder={t('ui.files.body_placeholder')}
          onInput={emit}
          onPaste={onPaste}
          onDrop={e => e.preventDefault()}
          onClick={e => {
            const hit = (e.target as HTMLElement).closest?.('figure, .sig');
            select(hit instanceof HTMLElement && page.current?.contains(hit) ? hit : null);
          }}
        />
      </div>

      {picking && (
        <PhotoPicker
          onClose={() => setPicking(false)}
          onPick={photo => {
            setPicking(false);
            insertBlock(figureHtml(photo.url));
          }}
        />
      )}
    </>
  );
}
