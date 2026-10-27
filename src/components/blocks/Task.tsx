import { useEffect, useState } from 'react';
import type { TaskBlock } from '../../core/schema';
import { CheckResult, checkCode, prepare, SqlResult, TIMEOUT_MSG, cellText } from '../../core/runners/check';
import { useLessonCtx } from '../../content';
import { browserExecutors, onRuntimeStatus, preloadGo, preloadSql, runtimeStatus } from '../../runtime/executors';
import { drafts, progress, useProgress } from '../../state/progress';
import { CodeEditor } from '../CodeEditor';
import { Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';
import { Hints } from './common';

export const LANG_LABEL: Record<string, string> = { go: 'Go', js: 'JavaScript', python: 'Python', sql: 'SQL · Postgres' };
const SOLUTION_AFTER = 3;

export function useRuntimeStatus(lang: string) {
  const [s, setS] = useState(runtimeStatus(lang));
  useEffect(() => {
    const off = onRuntimeStatus((l, st) => l === lang && setS(st));
    return () => {
      off();
    };
  }, [lang]);
  return s;
}

export function RuntimeNote({ lang }: { lang: string }) {
  const s = useRuntimeStatus(lang);
  if (s !== 'loading') return null;
  const what = lang === 'go' ? 'Загружаю Go (около 5 МБ, только в первый раз)' : lang === 'python' ? 'Загружаю Python (около 10 МБ, только в первый раз)' : lang === 'sql' ? 'Запускаю Postgres в браузере' : 'Загрузка';
  return (
    <span className="rt-note">
      <span className="spinner" /> {what}…
    </span>
  );
}

export function SqlTable({ t }: { t: SqlResult }) {
  if (!t.columns.length) return <div className="muted">{t.affected !== undefined ? `Затронуто строк: ${t.affected}` : 'OK'}</div>;
  return (
    <div className="sql-table">
      <table>
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.slice(0, 200).map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} className={v === null ? 'null' : ''}>
                  {cellText(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {t.rows.length > 200 && <div className="muted">…и ещё {t.rows.length - 200} строк</div>}
      {t.rows.length === 0 && <div className="muted">0 строк</div>}
    </div>
  );
}

type RunOut = { stdout: string; stderr: string; error?: string; table?: SqlResult; ms: number };

export function Task({ data: task, id }: { data: TaskBlock; id: string }) {
  const { courseId, lessonKey } = useLessonCtx();
  const p = useProgress();
  const draftKey = `${courseId}:${lessonKey}#${id}`;
  const solved = !!p.courses[courseId]?.solved[lessonKey]?.[id];
  const attempts = p.courses[courseId]?.attempts[`${lessonKey}#${id}`] ?? 0;
  const [code, setCode] = useState(() => drafts.get(draftKey) ?? task.starter);
  const [busy, setBusy] = useState<null | 'run' | 'check'>(null);
  const [res, setRes] = useState<CheckResult | null>(null);
  const [out, setOut] = useState<RunOut | null>(null);
  const [showSol, setShowSol] = useState(false);

  useEffect(() => {
    if (task.lang === 'go') preloadGo();
    if (task.lang === 'sql') preloadSql();
  }, [task.lang]);

  const change = (v: string) => {
    setCode(v);
    drafts.set(draftKey, v);
  };

  const run = async () => {
    setBusy('run');
    setRes(null);
    try {
      if (task.lang === 'sql') {
        const r = await browserExecutors.sql(task.setup ?? '', [code]);
        setOut({ stdout: '', stderr: '', error: r.error, table: r.results.at(-1), ms: r.ms });
      } else {
        const { files, fixError } = prepare(task.lang, code);
        const stdin = task.tests?.find((t) => !t.hidden)?.stdin ?? '';
        const r = await browserExecutors.code(task.lang, files, stdin);
        setOut({ stdout: r.stdout, stderr: r.stderr, error: r.timeout ? TIMEOUT_MSG : r.error && fixError(r.error), ms: r.ms });
      }
    } finally {
      setBusy(null);
    }
  };

  const check = async () => {
    setBusy('check');
    setOut(null);
    try {
      const r = await checkCode(task, code, browserExecutors);
      setRes(r);
      progress.attempt(courseId, lessonKey, id);
      if (r.ok) progress.solve(courseId, lessonKey, id);
    } finally {
      setBusy(null);
    }
  };

  const canSeeSolution = solved || attempts >= SOLUTION_AFTER;

  return (
    <div className={`block task${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="task" /> {task.title ?? 'Задача'}
        </span>
        <span className="right">
          <span className="tag">{LANG_LABEL[task.lang]}</span>
          {solved && <span className="tag ok">решено</span>}
        </span>
      </div>
      {task.prompt && (
        <div className="task-prompt">
          <Markdown text={task.prompt} />
        </div>
      )}
      {task.lang === 'sql' && task.setup && <SqlSchema setup={task.setup} />}
      <CodeEditor value={code} lang={task.lang} onChange={change} onRun={check} minLines={6} />
      <div className="block-foot">
        <button className="btn primary" onClick={check} disabled={!!busy} title="Ctrl/⌘ + Enter">
          {busy === 'check' ? <span className="spinner" /> : <I.check />} Проверить
        </button>
        <button className="btn" onClick={run} disabled={!!busy}>
          {busy === 'run' ? <span className="spinner" /> : <I.play />} Запустить
        </button>
        <RuntimeNote lang={task.lang} />
        <span className="grow" />
        <button
          className="btn ghost small"
          onClick={() => {
            change(task.starter);
            setRes(null);
            setOut(null);
          }}
          title="Вернуть стартовый код"
        >
          <I.reset /> Сброс
        </button>
        <button
          className="btn ghost small"
          disabled={!canSeeSolution}
          onClick={() => setShowSol((s) => !s)}
          title={canSeeSolution ? '' : `Решение откроется после ${SOLUTION_AFTER} попыток`}
        >
          <I.eye /> {showSol ? 'Скрыть решение' : canSeeSolution ? 'Решение' : `Решение (${Math.min(attempts, SOLUTION_AFTER)}/${SOLUTION_AFTER})`}
        </button>
      </div>
      {out && <RunOutput out={out} />}
      {res && <CheckOutput res={res} lang={task.lang} />}
      {showSol && canSeeSolution && (
        <div className="output">
          <span className="label">Эталонное решение</span>
          <CodeEditor value={task.solution} lang={task.lang} readOnly minLines={2} />
        </div>
      )}
      {(!solved && <div style={{ padding: '0 18px' }}>
        <Hints hints={task.hints} attempts={attempts} />
      </div>) || null}
      {solved && task.explain && (
        <div style={{ padding: '0 18px 18px' }}>
          <div className="explain">
            <Markdown text={task.explain} />
          </div>
        </div>
      )}
      {!solved && task.hints?.length ? <div style={{ height: 14 }} /> : null}
    </div>
  );
}

function SqlSchema({ setup }: { setup: string }) {
  const tables = [...setup.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?("?[\w.]+"?)\s*\(([\s\S]*?)\);/gi)].map((m) => ({
    name: m[1].replace(/"/g, ''),
    cols: m[2]
      .split(/,(?![^(]*\))/)
      .map((c) => c.trim().split(/\s+/).slice(0, 2).join(' '))
      .filter((c) => c && !/^(primary|foreign|unique|constraint|check)\b/i.test(c)),
  }));
  if (!tables.length) return null;
  return (
    <details className="output" style={{ borderTop: '1px solid var(--line)' }}>
      <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14 }}>
        <I.db style={{ verticalAlign: '-3px' }} /> Схема базы: {tables.map((t) => t.name).join(', ')}
      </summary>
      {tables.map((t) => (
        <div key={t.name} style={{ marginTop: 8 }}>
          <b>{t.name}</b>({t.cols.join(', ')})
        </div>
      ))}
    </details>
  );
}

export function RunOutput({ out }: { out: RunOut }) {
  const empty = !out.stdout && !out.stderr && !out.error && !out.table;
  return (
    <div className="output" aria-live="polite">
      <span className="label">Вывод · {Math.round(out.ms)} мс</span>
      {out.table && <SqlTable t={out.table} />}
      {out.stdout}
      {out.stderr && <span className="err">{out.stderr}</span>}
      {out.error && <span className="err">{out.error}</span>}
      {empty && <span className="muted">(программа ничего не вывела)</span>}
    </div>
  );
}

function CheckOutput({ res, lang }: { res: CheckResult; lang: string }) {
  const passed = res.cases.filter((c) => c.ok).length;
  return (
    <div aria-live="polite">
      <div className="cases">
        <div className={`verdict ${res.ok ? 'ok' : 'bad'}`}>
          {res.ok ? <I.check /> : <I.x />}
          {res.ok ? 'Все проверки пройдены' : res.error && !res.cases.length ? 'Код не запустился' : `Пройдено ${passed} из ${res.cases.length}`}
        </div>
        {res.cases.map((c, i) => (
          <div key={i} className={`case ${c.ok ? 'ok' : 'bad'}`}>
            <span className="ic">{c.ok ? '✓' : '✗'}</span>
            <div>
              {c.name}
              {c.hidden && <span className="muted"> (скрытый тест)</span>}
              {!c.ok && c.message && <pre>{c.message}</pre>}
              {!c.ok && !c.hidden && c.expected !== undefined && (
                <div className="cmp">
                  {c.stdin ? (
                    <div>
                      <span className="muted">ввод</span>
                      <pre>{c.stdin}</pre>
                    </div>
                  ) : null}
                  <div>
                    <span className="muted">ожидалось</span>
                    <pre>{c.expected || '(пусто)'}</pre>
                  </div>
                  <div>
                    <span className="muted">получено</span>
                    <pre>{c.got || '(пусто)'}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {res.error && (
        <div className="output">
          <span className="label">{lang === 'sql' ? 'Ошибка Postgres' : 'Ошибка'}</span>
          <span className="err">{res.error}</span>
        </div>
      )}
      {lang === 'sql' && res.table && !res.ok && (
        <div className="output">
          <span className="label">Твой результат</span>
          <SqlTable t={res.table} />
          {res.expectedTable && (
            <>
              <span className="label">Ожидаемый результат</span>
              <SqlTable t={res.expectedTable} />
            </>
          )}
        </div>
      )}
      {res.stdout && lang !== 'sql' && (
        <div className="output">
          <span className="label">Вывод программы</span>
          {res.stdout}
        </div>
      )}
    </div>
  );
}
