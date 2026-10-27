// Карточки «как это могут спросить»: вопрос → «показать ответ» → самооценка «знаю / повторить».
// Не обязательный блок: помогает проговорить материал своими словами перед собеседованием или защитой.
import { useState } from 'react';
import type { CardsBlock } from '../../core/schema';
import { useLessonCtx } from '../../content';
import { drafts } from '../../state/progress';
import { Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';

type Mark = 'know' | 'again';

export function Cards({ data, id }: { data: CardsBlock; id: string }) {
  const { courseId, lessonKey } = useLessonCtx();
  const key = `${courseId}:${lessonKey}#${id}:cards`;
  const [marks, setMarks] = useState<Record<number, Mark>>(() => {
    try {
      return JSON.parse(drafts.get(key) ?? '{}');
    } catch {
      return {};
    }
  });
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const mark = (i: number, m: Mark) => {
    const next = { ...marks, [i]: m };
    setMarks(next);
    drafts.set(key, JSON.stringify(next));
  };
  const known = Object.values(marks).filter((m) => m === 'know').length;

  return (
    <div className="block cards">
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="cards" /> {data.title ?? 'Как это могут спросить'}
        </span>
        <span className="right muted" style={{ fontSize: 13 }}>
          знаю {known} из {data.items.length}
        </span>
      </div>
      <div className="block-body">
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 14 }}>
          Сначала ответь вслух или про себя, потом открой ответ и честно оцени себя.
        </p>
        <div className="card-list">
          {data.items.map((it, i) => (
            <div key={i} className={`qa-card${marks[i] ? ` ${marks[i]}` : ''}`}>
              <div className="qa-q">
                <span className="qa-n">{i + 1}</span>
                <Markdown text={it.q} />
              </div>
              {open[i] ? (
                <>
                  <div className="qa-a">
                    <Markdown text={it.a} />
                  </div>
                  <div className="qa-actions">
                    <button className={`btn small${marks[i] === 'know' ? ' primary' : ''}`} onClick={() => mark(i, 'know')}>
                      <I.check width={14} height={14} /> Знал
                    </button>
                    <button className={`btn small${marks[i] === 'again' ? ' primary' : ''}`} onClick={() => mark(i, 'again')}>
                      <I.reset width={14} height={14} /> Повторить
                    </button>
                    <button className="btn ghost small" onClick={() => setOpen((o) => ({ ...o, [i]: false }))}>
                      Скрыть ответ
                    </button>
                  </div>
                </>
              ) : (
                <div className="qa-actions">
                  <button className="btn small" onClick={() => setOpen((o) => ({ ...o, [i]: true }))}>
                    <I.eye width={14} height={14} /> Показать ответ
                  </button>
                  {marks[i] && <span className="muted" style={{ fontSize: 13 }}>{marks[i] === 'know' ? 'отмечено: знаю' : 'отмечено: повторить'}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
