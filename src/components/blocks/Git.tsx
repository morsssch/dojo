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
import { Needs } from './Needs';
import { Workspace } from '../Workspace';

export function GitWorkbench({ shell, onCommand, greeting, layout = 'inline' }: { shell: Shell; onCommand?: (cmd: string, ok: boolean) => void; greeting?: string; layout?: 'inline' | 'full' }) {
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

  const short = (p: string) => (p.startsWith(shell.home) ? '~' + p.slice(shell.home.length) : p);

  return (
    <div className={`git-ui ${layout}`}>
      <Terminal
        shell={shell}
        greeting={greeting}
        onCommand={async (c, ok) => {
          await refresh();
          onCommand?.(c, ok);
        }}
      />
      <div className="git-side">
        <section className="git-pane graph">
          <div className="git-pane-title">
            <I.branch width={14} height={14} /> Граф коммитов
          </div>
          <GitGraph g={graph} />
        </section>
        <section className="git-pane files">
          <div className="git-pane-title">
            <I.book width={14} height={14} /> Файлы <span className="muted">{short(root)}</span>
          </div>
          {!editing && (
            <div className="files">
              {files.length === 0 && <div className="muted">папка пуста</div>}
              {files.map((f) =>
                f.endsWith('/') ? (
                  <div key={f} className="dir">
                    {f}
                  </div>
                ) : (
                  <button key={f} onClick={async () => setEditing({ path: `${root}/${f}`, text: await shell.fs.readFile(`${root}/${f}`, 'utf8') })} title="Открыть в редакторе">
                    {f}
                  </button>
                ),
              )}
              {files.length > 0 && <div className="muted hint">Нажми на файл, чтобы отредактировать</div>}
            </div>
          )}
          {editing && (
            <div className="file-edit">
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                {short(editing.path)}
              </div>
              <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} spellCheck={false} aria-label="Содержимое файла" autoFocus />
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
        </section>
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
  const [full, setFull] = useState(false);

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
  const title = data.title ?? (data.sandbox ? 'Песочница git' : 'Git-практика');
  const greeting = 'Это настоящий git в браузере. help — список команд, Tab дополняет, ↑ — история.\n';

  const goalsEl =
    data.goals.length > 0 ? (
      <ul className="goals" aria-label="Цели">
        {data.goals.map((g, i) => (
          <li key={i} className={goals[i] ? 'ok' : ''}>
            <span className="goal-box">{goals[i] && <I.check width={12} height={12} strokeWidth={3.5} />}</span>
            <Markdown text={g.text} />
          </li>
        ))}
      </ul>
    ) : null;
  const status =
    allOk && !data.sandbox ? (
      <span className="verdict ok">
        <I.check /> Все цели выполнены
      </span>
    ) : data.goals.length > 0 ? (
      <span className="muted" style={{ fontSize: 14 }}>
        Цели: {goals.filter(Boolean).length} из {goals.length}
      </span>
    ) : null;
  const tools = (
    <>
      <button className="btn ghost small" onClick={() => setEpoch((e) => e + 1)} title="Начать заново">
        <I.reset /> <span className="hide-sm">Заново</span>
      </button>
      {data.solution.length > 0 && (
        <button className="btn ghost small" disabled={!solved && cmds < 8} onClick={() => setShowSol((s) => !s)} title={!solved && cmds < 8 ? 'Решение откроется после нескольких попыток' : ''}>
          <I.eye /> Решение
        </button>
      )}
    </>
  );
  const extra = (
    <>
      {showSol && (
        <div>
          <div className="ws-section-title">Один из вариантов решения</div>
          <div className="cmds" style={{ margin: 0 }}>
            {data.solution.map((c, i) => (
              <div key={i}>{c}</div>
            ))}
          </div>
        </div>
      )}
      {!solved && data.hints?.length ? <Hints hints={data.hints} attempts={cmds} /> : null}
      {solved && data.explain && (
        <div className="explain">
          <Markdown text={data.explain} />
        </div>
      )}
    </>
  );

  return (
    <div className={`block git${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="git" /> {title}
        </span>
        <span className="right">
          {solved && <span className="tag ok">решено</span>}
          {shell && !full && (
            <button className="btn ghost small" onClick={() => setFull(true)} title="Открыть на весь экран">
              <I.expand /> <span className="hide-sm">На весь экран</span>
            </button>
          )}
        </span>
      </div>
      <Needs links={data.needs} />
      {(data.prompt || goalsEl) && (
        <div className="block-body">
          {data.prompt && <Markdown text={data.prompt} />}
          {goalsEl}
        </div>
      )}
      {shell && full && <div className="ws-empty">Терминал открыт в полноэкранном режиме.</div>}
      {shell && !full && <GitWorkbench key={epoch} shell={shell} onCommand={onCommand} greeting={greeting} />}
      {!shell && (
        <div className="output">
          <span className="spinner" /> Готовлю репозиторий…
        </div>
      )}
      <div className="block-foot">
        {status}
        <span className="grow" />
        {tools}
      </div>
      {(showSol || (!solved && data.hints?.length) || (solved && data.explain)) && <div className="task-after">{extra}</div>}
      {shell && full && (
        <Workspace
          layoutKey="git"
          title={
            <>
              <KindIcon kind="git" /> {title}
            </>
          }
          tags={solved ? <span className="tag ok">решено</span> : undefined}
          actions={
            <>
              {status}
              {tools}
            </>
          }
          onClose={() => setFull(false)}
          left={
            <>
              {data.prompt && <Markdown text={data.prompt} />}
              {goalsEl}
              {extra}
            </>
          }
          main={<GitWorkbench key={epoch} shell={shell} onCommand={onCommand} greeting={greeting} layout="full" />}
        />
      )}
    </div>
  );
}
