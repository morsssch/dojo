import { useEffect, useRef, useState } from 'react';
import { Shell } from '../core/git/shell';
import type { SqlExecResult } from '../core/runners/check';
import { prepare, TIMEOUT_MSG } from '../core/runners/check';
import { browserExecutors, createSqlSession, preloadGo } from '../runtime/executors';
import { drafts } from '../state/progress';
import { CodeEditor } from '../components/CodeEditor';
import { GitWorkbench } from '../components/blocks/Git';
import { RunOutput, RuntimeNote, SqlTable } from '../components/blocks/Task';
import { I } from '../components/ui/icons';

const SAMPLES: Record<string, string> = {
  go: `package main

import "fmt"

func main() {
	ch := make(chan int)
	go func() {
		for i := 1; i <= 3; i++ {
			ch <- i * i
		}
		close(ch)
	}()
	for v := range ch {
		fmt.Println("квадрат:", v)
	}
}
`,
  sql: `CREATE TABLE users (id serial PRIMARY KEY, name text NOT NULL, team text);
INSERT INTO users (name, team) VALUES ('Аня', 'front'), ('Боря', 'back'), ('Вика', 'back');

SELECT team, count(*) FROM users GROUP BY team ORDER BY team;
`,
  js: `const nums = [3, 1, 2];
console.log(nums.sort((a, b) => a - b));
`,
  python: `name = input() or "мир"
print(f"Привет, {name}!")
`,
};

function CodeSandbox({ lang }: { lang: 'go' | 'js' | 'python' }) {
  const [code, setCode] = useState(() => drafts.get(`sandbox:${lang}`) ?? SAMPLES[lang]);
  const [stdin, setStdin] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Parameters<typeof RunOutput>[0]['out'] | null>(null);
  useEffect(() => {
    if (lang === 'go') preloadGo();
  }, [lang]);
  const run = async () => {
    setBusy(true);
    const { files, fixError } = prepare(lang, code);
    const r = await browserExecutors.code(lang, files, stdin);
    setOut({ stdout: r.stdout, stderr: r.stderr, error: r.timeout ? TIMEOUT_MSG : r.error && fixError(r.error), ms: r.ms });
    setBusy(false);
  };
  return (
    <div className="block">
      <CodeEditor
        value={code}
        lang={lang}
        onChange={(v) => {
          setCode(v);
          drafts.set(`sandbox:${lang}`, v);
        }}
        onRun={run}
        minLines={14}
      />
      <div className="block-foot">
        <button className="btn primary" onClick={run} disabled={busy} title="Ctrl/⌘ + Enter">
          {busy ? <span className="spinner" /> : <I.play />} Запустить
        </button>
        <RuntimeNote lang={lang} />
        <span className="grow" />
        <button className="btn ghost small" onClick={() => setCode(SAMPLES[lang])}>
          <I.reset /> Пример
        </button>
      </div>
      <details className="output">
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 14 }}>Ввод программы (stdin)</summary>
        <textarea className="q-input" style={{ maxWidth: '100%', minHeight: 80, marginTop: 8 }} value={stdin} onChange={(e) => setStdin(e.target.value)} aria-label="Ввод программы" />
      </details>
      {out && <RunOutput out={out} />}
    </div>
  );
}

function SqlSandbox() {
  const [code, setCode] = useState(() => drafts.get('sandbox:sql') ?? SAMPLES.sql);
  const [res, setRes] = useState<SqlExecResult | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useRef<Awaited<ReturnType<typeof createSqlSession>> | null>(null);
  useEffect(
    () => () => {
      session.current?.close();
    },
    [],
  );
  const run = async () => {
    setBusy(true);
    session.current ??= await createSqlSession();
    setRes(await session.current.run(code));
    setBusy(false);
  };
  return (
    <div className="block">
      <div className="task-prompt muted" style={{ fontSize: 14.5 }}>
        Настоящий PostgreSQL в браузере. Таблицы живут, пока открыта страница: можно создать их один раз и дальше писать запросы.
      </div>
      <CodeEditor
        value={code}
        lang="sql"
        onChange={(v) => {
          setCode(v);
          drafts.set('sandbox:sql', v);
        }}
        onRun={run}
        minLines={10}
      />
      <div className="block-foot">
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? <span className="spinner" /> : <I.play />} Выполнить
        </button>
        <span className="grow" />
        <button
          className="btn ghost small"
          onClick={async () => {
            await session.current?.close();
            session.current = null;
            setRes(null);
          }}
        >
          <I.reset /> Пустая база
        </button>
      </div>
      {res && (
        <div className="output">
          {res.error && <span className="err">{res.error}</span>}
          {res.results.map((r, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <SqlTable t={r} />
            </div>
          ))}
          <span className="muted">{Math.round(res.ms)} мс</span>
        </div>
      )}
    </div>
  );
}

function GitSandbox() {
  const [shell, setShell] = useState<Shell | null>(null);
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const sh = new Shell();
    sh.boot().then(() => setShell(sh));
  }, [epoch]);
  return (
    <div className="block">
      <div className="task-prompt muted" style={{ fontSize: 14.5 }}>
        Пустая машина с git. Попробуй: <code>mkdir app && cd app && git init</code>. Удалённый репозиторий можно сделать так: <code>git init --bare /srv/origin.git</code>.
      </div>
      {shell && <GitWorkbench key={epoch} shell={shell} greeting={'Песочница git. help — список команд.\n'} />}
      <div className="block-foot">
        <span className="grow" />
        <button className="btn ghost small" onClick={() => setEpoch((e) => e + 1)}>
          <I.reset /> Начать с нуля
        </button>
      </div>
    </div>
  );
}

const TABS = [
  ['go', 'Go'],
  ['sql', 'SQL'],
  ['git', 'Git'],
  ['js', 'JavaScript'],
  ['python', 'Python'],
] as const;

export function SandboxPage() {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('go');
  return (
    <main className="page">
      <h1 className="display" style={{ margin: '0 0 6px', fontSize: 32 }}>
        Песочница
      </h1>
      <p className="muted" style={{ margin: '0 0 20px' }}>
        Экспериментируй без проверок. Код сохраняется в браузере.
      </p>
      <div className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'sql' ? <SqlSandbox /> : tab === 'git' ? <GitSandbox /> : <CodeSandbox key={tab} lang={tab} />}
    </main>
  );
}
