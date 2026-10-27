import { useCallback, useEffect, useState } from 'react';
import type { GitBlock as GB } from '../../core/schema';
import { bootShell, evalGoals } from '../../core/git/checks';
import type { GitGraph as G, Shell } from '../../core/git/shell';
import { useLessonCtx } from '../../content';
import { progress, useProgress } from '../../state/progress';
import { GitGraph } from '../GitGraph';
import { Markdown } from '../Markdown';
import { Terminal } from '../Terminal';
import { I, KindIcon } from '../ui/icons';
import { BlockError, Hints } from './common';

export function GitWorkbench({ shell, onCommand, greeting }: { shell: Shell; onCommand?: (cmd: string, ok: boolean) => void; greeting?: string }) {
  const [tab, setTab] = useState<'graph' | 'files'>('graph');
  const [graph, setGraph] = useState<G>({ commits: [], refs: [], head: {}, repo: false });
  const [files, setFiles] = useState<string[]>([]);
  const [root, setRoot] = useState(shell.cwd);
  const [editing, setEditing] = useState<{ path: string; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setGraph(await shell.graph());
    const r = (await shell.repoRoot()) ?? shell.cwd;
    setRoot(r);
    setFiles(await shell.listFiles(r));
  }, [shell]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="git-ui">
      <Terminal
        shell={shell}
        greeting={greeting}
        onCommand={async (c, ok) => {
          await refresh();
          onCommand?.(c, ok);
        }}
      />
      <div className="git-side">
        <div className="git-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'graph'} className={tab === 'graph' ? 'on' : ''} onClick={() => setTab('graph')}>
            Граф коммитов
          </button>
          <button role="tab" aria-selected={tab === 'files'} className={tab === 'files' ? 'on' : ''} onClick={() => setTab('files')}>
            Файлы
          </button>
        </div>
        <div className="git-pane">
          {tab === 'graph' && <GitGraph g={graph} />}
          {tab === 'files' && !editing && (
            <div className="files">
              <div className="muted" style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, marginBottom: 6 }}>
                {root} — нажми на файл, чтобы отредактировать
              </div>
              {files.length === 0 && <div className="muted">папка пуста</div>}
              {files.map((f) =>
                f.endsWith('/') ? (
                  <div key={f} style={{ padding: '3px 6px', color: 'var(--info)' }}>
                    {f}
                  </div>
                ) : (
                  <button key={f} onClick={async () => setEditing({ path: `${root}/${f}`, text: await shell.fs.readFile(`${root}/${f}`, 'utf8') })}>
                    {f}
                  </button>
                ),
              )}
            </div>
          )}
          {tab === 'files' && editing && (
            <div className="file-edit">
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                {editing.path}
              </div>
              <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} spellCheck={false} aria-label="Содержимое файла" />
              <div className="row-btns" style={{ marginTop: 8 }}>
                <button
                  className="btn small primary"
                  onClick={async () => {
                    await shell.fs.writeFile(editing.path, editing.text);
                    setEditing(null);
                    await refresh();
                    onCommand?.('(редактор)', true);
                  }}
                >
                  Сохранить
                </button>
                <button className="btn small" onClick={() => setEditing(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GitTask({ data, id }: { data: GB; id: string }) {
  const { courseId, lessonKey } = useLessonCtx();
  const p = useProgress();
  const solved = !!p.courses[courseId]?.solved[lessonKey]?.[id];
  const [shell, setShell] = useState<Shell | null>(null);
  const [setupErr, setSetupErr] = useState<string[]>([]);
  const [goals, setGoals] = useState<boolean[]>([]);
  const [epoch, setEpoch] = useState(0);
  const [cmds, setCmds] = useState(0);
  const [showSol, setShowSol] = useState(false);

  useEffect(() => {
    let alive = true;
    bootShell(data).then(async ({ sh, errors }) => {
      if (!alive) return;
      setShell(sh);
      setSetupErr(errors);
      setGoals(await evalGoals(sh, data));
    });
    return () => {
      alive = false;
    };
  }, [data, epoch]);

  const onCommand = async () => {
    if (!shell) return;
    setCmds((n) => n + 1);
    const g = await evalGoals(shell, data);
    setGoals(g);
    if (!data.sandbox && g.length && g.every(Boolean)) progress.solve(courseId, lessonKey, id);
  };

  if (setupErr.length) return <BlockError error={setupErr.join('\n')} />;
  const allOk = goals.length > 0 && goals.every(Boolean);

  return (
    <div className={`block git${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="git" /> {data.title ?? (data.sandbox ? 'Песочница git' : 'Git-практика')}
        </span>
        <span className="right">{solved && <span className="tag ok">решено</span>}</span>
      </div>
      {(data.prompt || data.goals.length > 0) && (
        <div className="block-body">
          {data.prompt && <Markdown text={data.prompt} />}
          {data.goals.length > 0 && (
            <ul className="goals" aria-label="Цели">
              {data.goals.map((g, i) => (
                <li key={i} className={goals[i] ? 'ok' : ''}>
                  <span className="goal-box">{goals[i] && <I.check width={12} height={12} strokeWidth={3.5} />}</span>
                  <Markdown text={g.text} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {shell ? (
        <GitWorkbench key={epoch} shell={shell} onCommand={onCommand} greeting={'Это настоящий git в браузере. Набери help, если забыл команды. Tab дополняет, ↑ — история.\n'} />
      ) : (
        <div className="output">
          <span className="spinner" /> Готовлю репозиторий…
        </div>
      )}
      <div className="block-foot">
        {allOk && !data.sandbox ? (
          <span className="verdict ok">
            <I.check /> Все цели выполнены
          </span>
        ) : (
          data.goals.length > 0 && (
            <span className="muted" style={{ fontSize: 14 }}>
              Цели: {goals.filter(Boolean).length} из {goals.length}
            </span>
          )
        )}
        <span className="grow" />
        <button className="btn ghost small" onClick={() => setEpoch((e) => e + 1)} title="Начать заново">
          <I.reset /> Заново
        </button>
        {data.solution.length > 0 && (
          <button className="btn ghost small" disabled={!solved && cmds < 8} onClick={() => setShowSol((s) => !s)} title={!solved && cmds < 8 ? 'Решение откроется после нескольких попыток' : ''}>
            <I.eye /> Решение
          </button>
        )}
      </div>
      {showSol && (
        <div className="output">
          <span className="label">Один из вариантов решения</span>
          <div className="cmds" style={{ margin: 0 }}>
            {data.solution.map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        </div>
      )}
      {!solved && data.hints?.length ? (
        <div style={{ padding: '0 18px 14px' }}>
          <Hints hints={data.hints} attempts={cmds} />
        </div>
      ) : null}
      {solved && data.explain && (
        <div style={{ padding: '0 18px 18px' }}>
          <div className="explain">
            <Markdown text={data.explain} />
          </div>
        </div>
      )}
    </div>
  );
}
