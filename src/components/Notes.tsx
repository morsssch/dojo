// Заметки: панель в уроке (заметка к текущему шагу) и цитирование выделенного текста.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { noteOf, notesList } from '../state/notes';
import { progress, useProgress } from '../state/progress';
import { Markdown } from './Markdown';
import { I } from './ui/icons';

export function NotesPanel({ course, lesson, step, stepTitle, onClose }: { course: string; lesson: string; step: number; stepTitle: string; onClose: () => void }) {
  const p = useProgress();
  const text = noteOf(p, course, lesson, step);
  const [preview, setPreview] = useState(false);
  const others = notesList(p, course).filter((n) => n.lesson === lesson && n.step !== step);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <aside className="notes-panel" aria-label="Заметки">
      <div className="notes-head">
        <b>
          <I.note width={16} height={16} /> Заметка к шагу
        </b>
        <button className="icon-btn" onClick={onClose} aria-label="Закрыть заметки">
          <I.x />
        </button>
      </div>
      <div className="notes-step muted">
        {step + 1}. {stepTitle}
      </div>
      <div className="seg small" style={{ marginBottom: 8 }}>
        <button className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>
          Писать
        </button>
        <button className={preview ? 'on' : ''} onClick={() => setPreview(true)}>
          Смотреть
        </button>
      </div>
      {preview ? (
        <div className="notes-preview">{text ? <Markdown text={text} /> : <span className="muted">Пока пусто.</span>}</div>
      ) : (
        <textarea
          className="notes-text"
          value={text}
          onChange={(e) => progress.setNote(course, lesson, step, e.target.value)}
          placeholder={'Своими словами, что понял. Поддерживается markdown.\nВыдели текст в уроке — появится кнопка «В заметку».'}
          aria-label="Текст заметки"
        />
      )}
      <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
        Сохраняется сама. Ищется через Ctrl+K.
      </div>
      {others.length > 0 && (
        <>
          <div className="ws-section-title" style={{ marginTop: 18 }}>
            Другие заметки в этом уроке
          </div>
          {others.map((n) => (
            <div key={n.step} className="notes-other">
              <span className="muted">шаг {n.step + 1}</span>
              <span>{n.text.slice(0, 120)}</span>
            </div>
          ))}
        </>
      )}
      <Link to={`/c/${course}/notes`} className="btn small" style={{ marginTop: 16 }}>
        <I.note width={15} height={15} /> Все заметки курса
      </Link>
    </aside>
  );
}

/** Кнопка «В заметку» у выделенного текста в уроке. */
export function QuoteToNote({ container, onQuote }: { container: HTMLElement | null; onQuote: (text: string) => void }) {
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null);
  useEffect(() => {
    if (!container) return;
    const up = () =>
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? '';
        if (!sel || !text || text.length < 3 || !container.contains(sel.anchorNode)) return setPos(null);
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top, text });
      }, 0);
    const down = (e: MouseEvent) => !(e.target as HTMLElement).closest('.quote-btn') && setPos(null);
    document.addEventListener('mouseup', up);
    document.addEventListener('mousedown', down);
    return () => {
      document.removeEventListener('mouseup', up);
      document.removeEventListener('mousedown', down);
    };
  }, [container]);
  if (!pos) return null;
  return (
    <button
      className="quote-btn btn small primary"
      style={{ left: pos.x, top: pos.y }}
      onClick={() => {
        onQuote(pos.text);
        window.getSelection()?.removeAllRanges();
        setPos(null);
      }}
    >
      <I.quote width={14} height={14} /> В заметку
    </button>
  );
}
