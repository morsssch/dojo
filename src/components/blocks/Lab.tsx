// Лаба по этапам: список этапов, сборка программы из решений ученика, общая проверка, копирование для сдачи.
// Засчитывается, когда собранная программа проходит проверку блока lab.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LabBlock } from '../../core/schema';
import { assembleLab, labAsTask, labParts, labStages } from '../../core/lab';
import { CheckResult, checkCode } from '../../core/runners/check';
import { lessonHref, useLessonCtx } from '../../content';
import { browserExecutors } from '../../runtime/executors';
import { drafts, progress, useProgress } from '../../state/progress';
import { CodeEditor } from '../CodeEditor';
import { Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';
import { CheckOutput, LANG_LABEL } from './Task';

const EXT: Record<string, string> = { go: 'go', js: 'js', python: 'py', cs: 'cs' };

export function Lab({ data: lab, id }: { data: LabBlock; id: string }) {
  const { courseId, lessonKey, lesson } = useLessonCtx();
  const p = useProgress();
  const solvedMap = p.courses[courseId]?.solved[lessonKey] ?? {};
  const solved = !!solvedMap[id];
  const stages = labStages(lesson, lab.id);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CheckResult | null>(null);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');
  const [checked, setChecked] = useState<boolean[]>(() => (lab.checklist ?? []).map((_, i) => drafts.get(`${courseId}:${lessonKey}#${id}:c${i}`) === '1'));

  const parts: Record<string, string | undefined> = {};
  for (const s of stages) parts[s.part] = drafts.get(`${courseId}:${lessonKey}#${s.id}`) ?? undefined;
  const program = assembleLab(lab, parts);
  const done = stages.filter((s) => solvedMap[s.id]).length;
  const missing = labParts(lab).filter((x) => !stages.some((s) => s.part === x) && !lab.stubs[x]);

  const check = async () => {
    setBusy(true);
    try {
      const r = await checkCode(labAsTask(lab), program, browserExecutors);
      setRes(r);
      if (r.ok) progress.solve(courseId, lessonKey, id);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(program);
      setMsg('Программа скопирована.');
    } catch {
      setShow(true);
      setMsg('Автокопирование недоступно: выдели код ниже вручную.');
    }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([program], { type: 'text/plain' }));
    a.download = `${lab.id}.${EXT[lab.lang]}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={`block lab${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="lab" /> {lab.title}
        </span>
        <span className="right">
          <span className="tag">{LANG_LABEL[lab.lang]}</span>
          <span className="tag">
            этапов {done} из {stages.length}
          </span>
          {solved && <span className="tag ok">собрано</span>}
        </span>
      </div>
      <div className="block-body">
        {lab.intro && <Markdown text={lab.intro} />}
        <ol className="lab-stages">
          {stages.map((s, i) => (
            <li key={s.id} className={solvedMap[s.id] ? 'done' : ''}>
              <span className="lab-n">{solvedMap[s.id] ? <I.check width={14} height={14} /> : i + 1}</span>
              <Link to={lessonHref(courseId, lessonKey, s.step)}>{s.task.title ?? `Этап ${i + 1}`}</Link>
              <span className="muted">{solvedMap[s.id] ? 'решён' : drafts.get(`${courseId}:${lessonKey}#${s.id}`) ? 'черновик' : 'заглушка'}</span>
            </li>
          ))}
        </ol>
        {missing.length > 0 && <div className="block-error">В шаблоне есть вставки без этапа и заглушки: {missing.join(', ')}</div>}
        {lab.checklist?.length ? (
          <div className="lab-check">
            {lab.checklist.map((c, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={checked[i] ?? false}
                  onChange={(e) => {
                    const v = [...checked];
                    v[i] = e.target.checked;
                    setChecked(v);
                    drafts.set(`${courseId}:${lessonKey}#${id}:c${i}`, e.target.checked ? '1' : '');
                  }}
                />
                <Markdown text={c} />
              </label>
            ))}
          </div>
        ) : null}
        <div className="row-btns">
          <button className="btn primary" onClick={check} disabled={busy}>
            {busy ? <span className="spinner" /> : <I.check />} Собрать и проверить
          </button>
          <button className="btn" onClick={() => setShow((x) => !x)}>
            <I.code /> {show ? 'Скрыть программу' : 'Показать программу'}
          </button>
          <button className="btn ghost small" onClick={copy}>
            <I.copy /> Скопировать
          </button>
          <button className="btn ghost small" onClick={download}>
            <I.download /> Скачать .{EXT[lab.lang]}
          </button>
        </div>
        {msg && (
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
            {msg}
          </p>
        )}
        {done < stages.length && !solved && (
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 13.5 }}>
            Не все этапы решены: вместо них в программу встанут заглушки, и проверка, скорее всего, не пройдёт.
          </p>
        )}
        {show && <CodeEditor value={program} lang={lab.lang} readOnly minLines={6} />}
        {res && <CheckOutput res={res} lang={lab.lang} />}
      </div>
    </div>
  );
}
