// Письменные ответы: ученик пишет текстом, ответы сохраняются как черновик,
// «Скопировать на проверку» собирает всё в один промпт для ИИ-ментора. Блок засчитывается после копирования.
import { useState } from 'react';
import type { WrittenBlock } from '../../core/schema';
import { useLessonCtx } from '../../content';
import { drafts, progress, useProgress } from '../../state/progress';
import { Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';

const plain = (s: string) => s.replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').trim();

export function Written({ data, id }: { data: WrittenBlock; id: string }) {
  const { courseId, lessonKey } = useLessonCtx();
  const p = useProgress();
  const solved = !!p.courses[courseId]?.solved[lessonKey]?.[id];
  const key = (i: number) => `${courseId}:${lessonKey}#${id}:q${i}`;
  const [answers, setAnswers] = useState<string[]>(() => data.questions.map((_, i) => drafts.get(key(i)) ?? ''));
  const [msg, setMsg] = useState('');
  const [fallback, setFallback] = useState('');
  const filled = answers.filter((a) => a.trim()).length;

  const text = () =>
    [
      data.reviewer ?? 'Проверь мои ответы как строгий, но доброжелательный ментор. По каждому ответу: что верно, что неточно или упущено, и задай один уточняющий вопрос.',
      '',
      `# ${data.title}`,
      ...data.questions.flatMap((q, i) => ['', `## ${i + 1}. ${plain(q.q)}`, answers[i].trim() || '(нет ответа)']),
    ].join('\n');

  const copy = async () => {
    const t = text();
    try {
      await navigator.clipboard.writeText(t);
      setMsg('Скопировано. Вставь в чат с Claude — он проверит и задаст уточняющие вопросы.');
      setFallback('');
    } catch {
      setFallback(t);
      setMsg('Автокопирование недоступно: выдели текст ниже и скопируй вручную.');
    }
    progress.solve(courseId, lessonKey, id);
  };

  return (
    <div className={`block written${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="written" /> {data.title}
        </span>
        <span className="right">
          <span className="tag">ответы текстом</span>
          {solved && <span className="tag ok">отправлено</span>}
        </span>
      </div>
      <div className="block-body">
        {data.intro && <Markdown text={data.intro} />}
        <div className="written-list">
          {data.questions.map((q, i) => (
            <label key={i} className="written-q">
              <span className="written-title">
                <span className="qa-n">{i + 1}</span>
                <Markdown text={q.q} />
              </span>
              <textarea
                rows={q.rows ?? 4}
                value={answers[i]}
                placeholder="Своими словами…"
                onChange={(e) => {
                  const v = e.target.value;
                  setAnswers((a) => a.map((x, k) => (k === i ? v : x)));
                  drafts.set(key(i), v);
                }}
              />
            </label>
          ))}
        </div>
        {fallback && <textarea className="written-fallback" readOnly value={fallback} rows={8} onFocus={(e) => e.currentTarget.select()} />}
      </div>
      <div className="block-foot">
        <button className="btn primary" onClick={copy} disabled={!filled}>
          <I.copy /> Скопировать на проверку
        </button>
        <span className="muted" style={{ fontSize: 13.5 }} role="status">
          {msg || `Отвечено ${filled} из ${data.questions.length}. Черновик сохраняется сам.`}
        </span>
      </div>
    </div>
  );
}
