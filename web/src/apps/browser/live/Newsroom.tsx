import { useState } from 'react';
import { ArrowLeft, Clock, Plus, Send, Trash2, X } from 'lucide-react';
import { fmtTime } from '@/lib/format';
import { useOS } from '@/store/os';
import { t } from '@/i18n';
import { part, under } from '../model';
import type { Article, News } from './data';
import { act, forget } from './useLive';
import { A, Area, Btn, CheckBox, Field, Input, Modal, Note, Nothing, PhotoField, Pick, Picture, Tag, type LiveProps } from './parts';

// The Weazel newsroom, at a desk: the paper's stories to write, change and take down, the ones
// waiting to go out, and the breaking line. Who may is the phone's to say (its staff rule, and for
// a few things "it is your own story"); every button here ends in the phone's own action, and a
// refusal comes back as its sentence. A story's picture is out of the writer's phone gallery, so
// the picker is only there while their phone is linked to this computer.

/** When a story goes out: now, or this many minutes from now (the phone wants five at least). */
const DELAYS = [10, 30, 60, 180, 360, 720, 1440];

const delayLabel = (m: number): string => (m < 60 ? t('ui.browser.news_in_minutes', m) : t('ui.browser.news_in_hours', m / 60));

/** "today 18:05" / "14 Oct 18:05" for a waiting story's time. */
function when(ts: number, clock24: boolean): string {
  const d = new Date(ts * 1000);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? t('ui.browser.news_today') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${fmtTime(d, clock24)}`;
}

function Row({ a, clock24, busy, onEdit, onDelete, onPublish }: { a: Article; clock24: boolean; busy: boolean; onEdit: () => void; onDelete: () => void; onPublish?: () => void }) {
  return (
    <div className="s-rule flex items-center gap-3 py-3 border-b">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="wz-headline text-[16px] truncate">{a.headline}</span>
          {a.featured && <Tag tone="warn">{t('ui.browser.news_lead')}</Tag>}
        </div>
        <div className="s-faint text-[12px] truncate">{[a.category, a.author, a.publishAt ? t('ui.browser.news_goes_out', when(a.publishAt, clock24)) : a.time].filter(Boolean).join('  ·  ')}</div>
      </div>
      {onPublish && (
        <Btn small icon={<Send size={13} />} disabled={busy} onClick={onPublish}>
          {t('ui.browser.news_publish_now')}
        </Btn>
      )}
      <Btn small disabled={busy} onClick={onEdit}>
        {t('ui.browser.live_edit')}
      </Btn>
      <Btn small kind="ghost" title={t('ui.common.delete')} aria-label={t('ui.common.delete')} disabled={busy} onClick={onDelete}>
        <Trash2 size={14} />
      </Btn>
    </div>
  );
}

/** The form a story is written in: a new one, or one being changed. */
function StoryForm({ news, editing, props, onDone }: { news: News; editing?: Article; props: LiveProps; onDone: () => void }) {
  const { site, onOpen } = props;
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const [category, setCategory] = useState(editing?.category ?? news.categories[0] ?? '');
  const [headline, setHeadline] = useState(editing?.headline ?? '');
  const [dek, setDek] = useState(editing?.dek ?? '');
  const [body, setBody] = useState(editing ? editing.body.join('\n\n') : '');
  const [image, setImage] = useState(editing?.image);
  const [featured, setFeatured] = useState(editing?.featured ?? false);
  // 'now', a delay in minutes, or 'keep' (a waiting story stays on the time it has).
  const waiting = editing?.publishAt !== undefined;
  const live = editing !== undefined && !waiting;
  const [go, setGo] = useState<string>(waiting ? 'keep' : 'now');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const publishAt = go === 'keep' ? editing?.publishAt : go === 'now' ? undefined : Math.floor(Date.now() / 1000) + Number(go) * 60;
    const res = await act('web:news:save', { id: editing?.id, category, headline: headline.trim(), dek: dek.trim(), body, image: image ?? '', featured, publishAt });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    forget('web:news');
    onDone();
    onOpen(under(site, 'newsroom'));
  };

  return (
    <div className="max-w-[720px]">
      <A to={under(site, 'newsroom')} onOpen={onOpen} className="s-link inline-flex items-center gap-1.5 text-[12px]">
        <ArrowLeft size={13} />
        {t('ui.browser.news_newsroom')}
      </A>
      <h1 className="wz-headline mt-3 mb-5 text-[28px]">{t(editing ? 'ui.browser.news_edit_story' : 'ui.browser.news_new_story')}</h1>

      {error && (
        <div className="mb-4">
          <Note tone="error" onClose={() => setError(null)}>
            {error}
          </Note>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="w-56">
          <Field label={t('ui.browser.news_f_section')}>
            <Pick value={category} onChange={value => setCategory(value)}>
              {news.categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Pick>
          </Field>
        </div>
        <Field label={t('ui.browser.news_f_headline')} aside={`${headline.length} / ${news.limits.headline}`}>
          <Input value={headline} maxLength={news.limits.headline} onChange={e => setHeadline(e.target.value)} autoFocus />
        </Field>
        <Field label={t('ui.browser.news_f_dek')}>
          <Input value={dek} maxLength={news.limits.dek} onChange={e => setDek(e.target.value)} />
        </Field>
        <Field label={t('ui.browser.news_f_body')} aside={`${body.length} / ${news.limits.body}`}>
          <Area value={body} maxLength={news.limits.body} onChange={e => setBody(e.target.value)} className="h-64" placeholder={t('ui.browser.news_f_body_hint')} />
        </Field>

        <div>
          <span className="s-label">{t('ui.browser.news_f_picture')}</span>
          {image ? (
            <div className="flex items-center gap-3">
              <Picture src={image} className="w-40 h-24" />
              <Btn small icon={<X size={13} />} onClick={() => setImage(undefined)}>
                {t('ui.browser.live_remove')}
              </Btn>
            </div>
          ) : (
            <PhotoField images={[]} max={1} onChange={urls => setImage(urls[0])} />
          )}
        </div>

        <CheckBox checked={featured} onChange={setFeatured} label={t('ui.browser.news_f_lead')} />

        {!live && (
          <div className="w-56">
            <Field label={t('ui.browser.news_f_when')}>
              <Pick value={go} onChange={value => setGo(value)}>
                {waiting && editing?.publishAt !== undefined && <option value="keep">{t('ui.browser.news_keep_time', when(editing.publishAt, clock24))}</option>}
                <option value="now">{t('ui.browser.news_now')}</option>
                {DELAYS.map(m => (
                  <option key={m} value={String(m)}>
                    {delayLabel(m)}
                  </option>
                ))}
              </Pick>
            </Field>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Btn kind="primary" icon={go === 'now' || live ? <Send size={14} /> : <Clock size={14} />} disabled={busy || !headline.trim() || !category} onClick={() => void save()}>
            {t(live ? 'ui.common.save' : go === 'now' ? 'ui.browser.news_publish' : 'ui.browser.news_schedule')}
          </Btn>
          <Btn disabled={busy} onClick={() => onOpen(under(site, 'newsroom'))}>
            {t('ui.common.cancel')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** The breaking line: its headlines, one a line. */
function TickerEditor({ news, onChanged }: { news: News; onChanged: () => void }) {
  const [textValue, setTextValue] = useState(news.ticker.join('\n'));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const lines = textValue
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  const dirty = lines.join('\n') !== news.ticker.join('\n');

  const save = async () => {
    setBusy(true);
    const res = await act('web:news:ticker', { lines: lines.slice(0, news.limits.tickerLines) });
    setBusy(false);
    setNote(res.ok ? { ok: true, text: t('ui.browser.news_ticker_saved') } : { ok: false, text: res.error });
    if (res.ok) {
      forget('web:news');
      onChanged();
    }
  };

  return (
    <section>
      <div className="wz-section">{t('ui.browser.news_ticker')}</div>
      <p className="s-muted mb-2 text-[13px]">{t('ui.browser.news_ticker_hint', news.limits.tickerLines)}</p>
      <Area value={textValue} onChange={e => setTextValue(e.target.value)} className="h-24" />
      <div className="mt-2 flex items-center gap-3">
        <Btn disabled={busy || !dirty} onClick={() => void save()}>
          {t('ui.browser.news_ticker_save')}
        </Btn>
        {note && <span className="text-[12px]" style={{ color: note.ok ? '#15803d' : '#b91c1c' }}>{note.text}</span>}
      </div>
    </section>
  );
}

export default function Newsroom({ news, onChanged, ...props }: LiveProps & { news: News; onChanged: () => void }) {
  const { site, path, onOpen } = props;
  const clock24 = useOS(s => s.payload?.desktop.clock24 ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Article | null>(null);

  if (!news.canManage) return <Nothing title={t('ui.browser.news_staff_only')}>{t('ui.browser.news_staff_only_hint')}</Nothing>;

  if (path[1] === 'new') return <StoryForm news={news} props={props} onDone={onChanged} />;
  if (path[1] === 'edit') {
    const id = part(path, 2);
    const editing = news.articles.find(a => a.id === id) ?? news.scheduled.find(a => a.id === id);
    if (!editing) return <Nothing title={t('ui.browser.news_gone')}>{t('ui.browser.news_gone_hint')}</Nothing>;
    return <StoryForm key={editing.id} news={news} editing={editing} props={props} onDone={onChanged} />;
  }

  const run = async (endpoint: string, id: string) => {
    setBusy(true);
    setError(null);
    const res = await act(endpoint, { id });
    setBusy(false);
    if (!res.ok) setError(res.error);
    forget('web:news');
    onChanged();
  };

  return (
    <div className="max-w-[820px] flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="wz-headline text-[30px]">{t('ui.browser.news_newsroom')}</h1>
          <p className="s-muted text-[13px]">{t('ui.browser.news_newsroom_hint')}</p>
        </div>
        <Btn kind="primary" icon={<Plus size={14} />} onClick={() => onOpen(under(site, 'newsroom', 'new'))}>
          {t('ui.browser.news_new_story')}
        </Btn>
      </div>

      {error && (
        <Note tone="error" onClose={() => setError(null)}>
          {error}
        </Note>
      )}

      <TickerEditor key={news.ticker.join('|')} news={news} onChanged={onChanged} />

      {news.scheduled.length > 0 && (
        <section>
          <div className="wz-section">{t('ui.browser.news_waiting')}</div>
          {news.scheduled.map(a => (
            <Row key={a.id} a={a} clock24={clock24} busy={busy} onEdit={() => onOpen(under(site, 'newsroom', 'edit', a.id))} onDelete={() => setDeleting(a)} onPublish={() => void run('web:news:publish', a.id)} />
          ))}
        </section>
      )}

      <section>
        <div className="wz-section">{t('ui.browser.news_published')}</div>
        {news.articles.length === 0 ? (
          <Nothing title={t('ui.browser.news_empty')}>{t('ui.browser.news_empty_staff')}</Nothing>
        ) : (
          news.articles.map(a => <Row key={a.id} a={a} clock24={clock24} busy={busy} onEdit={() => onOpen(under(site, 'newsroom', 'edit', a.id))} onDelete={() => setDeleting(a)} />)
        )}
      </section>

      {deleting && (
        <Modal
          title={t('ui.browser.news_delete_title')}
          onClose={() => setDeleting(null)}
          actions={
            <>
              <Btn onClick={() => setDeleting(null)}>{t('ui.common.cancel')}</Btn>
              <Btn
                kind="danger"
                onClick={() => {
                  const id = deleting.id;
                  setDeleting(null);
                  void run('web:news:delete', id);
                }}
              >
                {t('ui.common.delete')}
              </Btn>
            </>
          }
        >
          {t('ui.browser.news_delete_body', deleting.headline)}
        </Modal>
      )}
    </div>
  );
}
