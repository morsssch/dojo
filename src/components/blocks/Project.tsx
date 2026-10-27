import { useState } from 'react';
import type { ProjectBlock } from '../../core/schema';
import { useLessonCtx } from '../../content';
import { drafts, progress, useProgress } from '../../state/progress';
import { Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';
import { Hints } from './common';

/** Задание «у себя на компьютере»: инструкция, команды и чек-лист, который ученик отмечает сам. */
export function Project({ data, id }: { data: ProjectBlock; id: string }) {
  const { courseId, lessonKey } = useLessonCtx();
  const p = useProgress();
  const solved = !!p.courses[courseId]?.solved[lessonKey]?.[id];
  const key = `${courseId}:${lessonKey}#${id}:checks`;
  const [checks, setChecks] = useState<boolean[]>(() => {
    try {
      return JSON.parse(drafts.get(key) ?? '[]');
    } catch {
      return [];
    }
  });
  const toggle = (i: number) => {
    const next = data.checklist.map((_, k) => (k === i ? !checks[k] : !!checks[k]));
    setChecks(next);
    drafts.set(key, JSON.stringify(next));
    if (next.every(Boolean)) progress.solve(courseId, lessonKey, id);
  };
  const [copied, setCopied] = useState(false);

  return (
    <div className={`block project${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="project" /> {data.title}
        </span>
        <span className="right">
          <span className="tag accent">на своём компьютере</span>
          {solved && <span className="tag ok">готово</span>}
        </span>
      </div>
      <div className="block-body">
        {data.prompt && <Markdown text={data.prompt} />}
        {data.commands?.length ? (
          <div style={{ position: 'relative' }}>
            <div className="cmds">
              {data.commands.map((c, i) => (
                <div key={i}>{c}</div>
              ))}
            </div>
            <button
              className="btn ghost small"
              style={{ position: 'absolute', top: 6, right: 6, color: '#dce3f2' }}
              onClick={() => {
                navigator.clipboard?.writeText(data.commands!.join('\n'));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <I.copy /> {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        ) : null}
        <ul className="checklist">
          {data.checklist.map((c, i) => (
            <li key={i}>
              <label>
                <input type="checkbox" checked={!!checks[i] || solved} onChange={() => toggle(i)} />
                <Markdown text={c} />
              </label>
            </li>
          ))}
        </ul>
        {!solved && <Hints hints={data.hints} attempts={0} />}
      </div>
    </div>
  );
}
