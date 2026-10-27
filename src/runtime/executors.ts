// Исполнители кода в браузере. Всё тяжёлое грузится лениво — при первом запуске.
import type { ExecResult, Executors, SqlExecResult, SqlResult } from '../core/runners/check';
import { DbSchema, introspect } from './sqlSchema';

const BASE = import.meta.env.BASE_URL;
const TIMEOUT = { go: 8000, js: 5000, python: 10000 };

export type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';
type Listener = (lang: string, s: RuntimeStatus) => void;
const listeners = new Set<Listener>();
export const onRuntimeStatus = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const status: Record<string, RuntimeStatus> = {};
const setStatus = (lang: string, s: RuntimeStatus) => {
  status[lang] = s;
  listeners.forEach((l) => l(lang, s));
};
export const runtimeStatus = (lang: string) => status[lang] ?? 'idle';

// ---------------- Go ----------------

let goModule: Promise<WebAssembly.Module> | null = null;
let goWorker: Promise<Worker> | null = null;

function loadGoModule() {
  goModule ??= (async () => {
    setStatus('go', 'loading');
    const res = await fetch(`${BASE}runtimes/go/yaegi.wasm`);
    if (!res.ok) throw new Error(`Не удалось загрузить Go-рантайм (${res.status}). Если это локальная сборка — запусти npm run build:go-runtime.`);
    try {
      return await WebAssembly.compileStreaming(res.clone());
    } catch {
      return WebAssembly.compile(await res.arrayBuffer());
    }
  })().catch((e) => {
    goModule = null;
    setStatus('go', 'error');
    throw e;
  });
  return goModule;
}

function spawnGo(): Promise<Worker> {
  return (async () => {
    const module = await loadGoModule();
    const w = new Worker(`${BASE}runtimes/go/go-worker.js`);
    await new Promise<void>((resolve, reject) => {
      w.onmessage = (e) => e.data.type === 'ready' && resolve();
      w.onerror = (e) => reject(new Error(e.message));
      w.postMessage({ type: 'init', module });
    });
    setStatus('go', 'ready');
    return w;
  })();
}

let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const p = queue.then(fn, fn);
  queue = p.catch(() => undefined);
  return p;
};

let runId = 0;
async function runGo(files: string[], stdin: string): Promise<ExecResult> {
  return serial(async () => {
    const t0 = performance.now();
    goWorker ??= spawnGo().catch((e) => {
      goWorker = null;
      throw e;
    });
    let w: Worker;
    try {
      w = await goWorker;
    } catch (e) {
      return { stdout: '', stderr: '', error: (e as Error).message, ms: 0 };
    }
    const id = ++runId;
    return new Promise<ExecResult>((resolve) => {
      const timer = setTimeout(() => {
        w.terminate();
        goWorker = null; // поднимем новый при следующем запуске
        resolve({ stdout: '', stderr: '', timeout: true, ms: performance.now() - t0 });
      }, TIMEOUT.go);
      w.onmessage = (e) => {
        if (e.data.type !== 'result' || e.data.id !== id) return;
        clearTimeout(timer);
        resolve({ stdout: e.data.stdout, stderr: e.data.stderr, error: e.data.error || undefined, ms: performance.now() - t0 });
      };
      w.postMessage({ type: 'run', id, files, stdin });
    });
  });
}

/** Начать грузить Go-рантайм заранее (например, когда открыт урок с Go-задачей). */
export const preloadGo = () => {
  goWorker ??= spawnGo().catch((e) => {
    goWorker = null;
    throw e;
  });
  goWorker.catch(() => undefined);
};

// ---------------- JS ----------------

const JS_WORKER = `
const fmt = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
self.onmessage = async (e) => {
  const { files, stdin } = e.data;
  let out = '', err = '';
  const lines = stdin.split('\\n'); let li = 0;
  const console = {
    log: (...a) => { out += a.map(fmt).join(' ') + '\\n'; },
    error: (...a) => { err += a.map(fmt).join(' ') + '\\n'; },
  };
  console.info = console.log; console.warn = console.error;
  const input = () => (li < lines.length ? lines[li++] : '');
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const dojoCheck = (name, got, want) => { out += eq(got, want) ? '\\n@@PASS ' + name + '\\n' : '\\n@@FAIL ' + name + '\\x1fполучено: ' + fmt(got) + '\\x1fожидалось: ' + fmt(want) + '\\n'; };
  const dojoAssert = (name, ok, msg) => { out += ok ? '\\n@@PASS ' + name + '\\n' : '\\n@@FAIL ' + name + '\\x1f' + msg + '\\n'; };
  try {
    const src = files.join('\\n;\\n');
    const fn = new (Object.getPrototypeOf(async function(){}).constructor)('console', 'input', 'dojoCheck', 'dojoAssert', src);
    await fn(console, input, dojoCheck, dojoAssert);
    self.postMessage({ stdout: out, stderr: err });
  } catch (ex) {
    self.postMessage({ stdout: out, stderr: err, error: (ex && ex.stack) ? String(ex.stack).split('\\n').slice(0, 3).join('\\n') : String(ex) });
  }
};`;
let jsUrl: string | null = null;

function runInWorker(url: string, payload: unknown, timeout: number, keep?: { w: Worker | null }): Promise<ExecResult> {
  const t0 = performance.now();
  return new Promise((resolve) => {
    const w = keep?.w ?? new Worker(url);
    if (keep) keep.w = w;
    const done = (r: Omit<ExecResult, 'ms'>) => {
      clearTimeout(timer);
      if (!keep) w.terminate();
      resolve({ ...r, ms: performance.now() - t0 });
    };
    const timer = setTimeout(() => {
      w.terminate();
      if (keep) keep.w = null;
      resolve({ stdout: '', stderr: '', timeout: true, ms: performance.now() - t0 });
    }, timeout);
    w.onmessage = (e) => {
      if (e.data.type === 'status') return setStatus('python', e.data.status);
      done({ stdout: e.data.stdout ?? '', stderr: e.data.stderr ?? '', error: e.data.error || undefined });
    };
    w.onerror = (e) => done({ stdout: '', stderr: '', error: e.message });
    w.postMessage(payload);
  });
}

function runJs(files: string[], stdin: string) {
  jsUrl ??= URL.createObjectURL(new Blob([JS_WORKER], { type: 'text/javascript' }));
  return runInWorker(jsUrl, { files, stdin }, TIMEOUT.js);
}

// ---------------- Python (pyodide) ----------------

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const PY_WORKER = `
importScripts('${PYODIDE}pyodide.js');
let py = null;
const PRELUDE = \`
def dojo_check(name, got, want):
    if got == want:
        print("\\\\n@@PASS " + str(name))
    else:
        print("\\\\n@@FAIL " + str(name) + "\\\\x1fполучено: " + repr(got) + "\\\\x1fожидалось: " + repr(want))
dojoCheck = dojo_check
\`;
self.onmessage = async (e) => {
  const { files, stdin } = e.data;
  if (!py) { self.postMessage({ type: 'status', status: 'loading' }); py = await loadPyodide({ indexURL: '${PYODIDE}' }); self.postMessage({ type: 'status', status: 'ready' }); }
  let out = '', err = '';
  py.setStdout({ batched: (s) => { out += s + '\\n'; } });
  py.setStderr({ batched: (s) => { err += s + '\\n'; } });
  const lines = stdin.split('\\n'); let li = 0;
  py.setStdin({ stdin: () => (li < lines.length ? lines[li++] : undefined) });
  try {
    const g = py.globals.get('dict')();
    py.runPython(PRELUDE, { globals: g });
    for (const f of files) py.runPython(f, { globals: g });
    self.postMessage({ stdout: out, stderr: err });
  } catch (ex) {
    const msg = String(ex.message || ex).split('\\n').filter((l) => !l.includes('/lib/python') && !l.includes('_pyodide')).join('\\n');
    self.postMessage({ stdout: out, stderr: err, error: msg.trim() });
  }
};`;
let pyUrl: string | null = null;
const pyKeep: { w: Worker | null } = { w: null };
function runPython(files: string[], stdin: string) {
  pyUrl ??= URL.createObjectURL(new Blob([PY_WORKER], { type: 'text/javascript' }));
  // первый запуск включает загрузку pyodide — даём больше времени
  return serial(() => runInWorker(pyUrl!, { files, stdin }, pyKeep.w ? TIMEOUT.python : 60000, pyKeep));
}

// ---------------- SQL (PGlite) ----------------

type PG = import('@electric-sql/pglite').PGlite;
let pg: Promise<PG> | null = null;
function getPg(): Promise<PG> {
  pg ??= (async () => {
    setStatus('sql', 'loading');
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite();
    await db.waitReady;
    await db.exec(`SET statement_timeout = 5000;`);
    setStatus('sql', 'ready');
    return db;
  })().catch((e) => {
    pg = null;
    setStatus('sql', 'error');
    throw e;
  });
  return pg;
}
export const preloadSql = () => void getPg().catch(() => undefined);

const toResults = (rs: { fields: { name: string }[]; rows: unknown[]; affectedRows?: number }[]): SqlResult[] =>
  rs.map((r) => ({ columns: r.fields.map((f) => f.name), rows: r.rows as unknown[][], affected: r.affectedRows }));

let sqlQueue: Promise<unknown> = Promise.resolve();
async function runSql(setup: string, scripts: string[]): Promise<SqlExecResult> {
  const job = async (): Promise<SqlExecResult> => {
    const t0 = performance.now();
    const db = await getPg();
    let results: SqlResult[] = [];
    try {
      await db.exec('BEGIN;');
      if (setup.trim()) await db.exec(setup);
      for (const s of scripts) {
        if (!s.trim()) continue;
        results = toResults(await db.exec(s, { rowMode: 'array' }) as any);
      }
      return { results, ms: performance.now() - t0 };
    } catch (e) {
      return { results, error: pgError(e), ms: performance.now() - t0 };
    } finally {
      await db.exec('ROLLBACK;').catch(() => undefined);
    }
  };
  const p = sqlQueue.then(job, job);
  sqlQueue = p.catch(() => undefined);
  return p;
}

/** Схема и данные БД после setup (в транзакции, которая откатывается). */
export async function introspectSetup(setup: string): Promise<DbSchema> {
  const job = async (): Promise<DbSchema> => {
    const db = await getPg();
    try {
      await db.exec('BEGIN;');
      if (setup.trim()) await db.exec(setup);
      return await introspect(async (sql) => ({ rows: (await db.query(sql, [], { rowMode: 'array' })).rows as unknown[][] }));
    } finally {
      await db.exec('ROLLBACK;').catch(() => undefined);
    }
  };
  const p = sqlQueue.then(job, job);
  sqlQueue = p.catch(() => undefined);
  return p;
}

export function pgError(e: unknown): string {
  const err = e as { message?: string; hint?: string; position?: string };
  return [err.message ?? String(e), err.hint ? `Подсказка Postgres: ${err.hint}` : ''].filter(Boolean).join('\n');
}

/** Отдельная «живая» БД для песочницы: состояние сохраняется между запросами. */
export async function createSqlSession() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.waitReady;
  await db.exec(`SET statement_timeout = 5000;`);
  return {
    async run(sql: string): Promise<SqlExecResult> {
      const t0 = performance.now();
      try {
        return { results: toResults((await db.exec(sql, { rowMode: 'array' })) as any), ms: performance.now() - t0 };
      } catch (e) {
        return { results: [], error: pgError(e), ms: performance.now() - t0 };
      }
    },
    introspect: () => introspect(async (sql) => ({ rows: (await db.query(sql, [], { rowMode: 'array' })).rows as unknown[][] })),
    close: () => db.close(),
  };
}

export const browserExecutors: Executors = {
  code(lang, files, stdin) {
    if (lang === 'go') return runGo(files, stdin);
    if (lang === 'js') return runJs(files, stdin);
    return runPython(files, stdin);
  },
  sql: runSql,
};
