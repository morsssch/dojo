// Проверка решений. Не знает, где исполняется код: исполнители передаются снаружи
// (браузер — воркеры и wasm, `npm run check` — node).
import type { CodeRule, TaskBlock } from '../schema';
import { stripComments } from './explain';
import { fixGoErrorLines, GO_HARNESS_PRELUDE, GO_PRELUDE_IMPORTS, mergeGo } from './gosrc';

export type Lang = 'go' | 'js' | 'python' | 'sql';

export interface ExecResult {
  stdout: string;
  stderr: string;
  error?: string;
  timeout?: boolean;
  ms: number;
}

export interface SqlResult {
  columns: string[];
  rows: unknown[][];
  affected?: number;
}
export interface SqlExecResult {
  results: SqlResult[]; // по одному на каждый оператор
  error?: string;
  ms: number;
}

export interface Executors {
  /** go: код уже склеен в один файл. js/python: [код ученика, харнесс?] */
  code(lang: Exclude<Lang, 'sql'>, files: string[], stdin: string): Promise<ExecResult>;
  /** Выполняет setup, затем scripts по очереди в чистой БД; возвращает результаты последнего скрипта. */
  sql(setup: string, scripts: string[]): Promise<SqlExecResult>;
}

export interface CaseResult {
  name: string;
  ok: boolean;
  hidden?: boolean;
  stdin?: string;
  expected?: string;
  got?: string;
  message?: string;
}
export interface CheckResult {
  ok: boolean;
  cases: CaseResult[];
  error?: string; // ошибка компиляции/рантайма
  stdout?: string;
  stderr?: string;
  timeout?: boolean;
  ms: number;
  table?: SqlResult; // для SQL — что вернул запрос ученика
  expectedTable?: SqlResult;
}

const norm = (s: string) =>
  s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');

/** Подготовка исходников под исполнителя (склейка Go, прологи харнессов). */
export function prepare(lang: Exclude<Lang, 'sql'>, user: string, harness?: string) {
  if (lang === 'go') {
    const extras = harness ? [GO_PRELUDE_IMPORTS + GO_HARNESS_PRELUDE, harness] : [];
    const m = mergeGo(user, extras);
    return { files: [m.code], fixError: (e: string) => fixGoErrorLines(e, m.userOffset, m.userLines) };
  }
  return { files: harness ? [user, harness] : [user], fixError: (e: string) => e };
}

function parseHarness(stdout: string): { cases: CaseResult[]; rest: string } {
  const cases: CaseResult[] = [];
  const rest: string[] = [];
  for (const line of stdout.split('\n')) {
    const p = line.match(/^@@PASS (.*)$/);
    const f = line.match(/^@@FAIL (.*)$/);
    if (p) cases.push({ name: p[1], ok: true });
    else if (f) {
      const [name, ...msg] = f[1].split('\x1f');
      cases.push({ name, ok: false, message: msg.join('\n') });
    } else rest.push(line);
  }
  return { cases, rest: rest.join('\n').replace(/^\n+|\n+$/g, '') };
}

/** Правила require/forbid по тексту кода. Возвращает проваленные проверки. */
export function checkRules(task: TaskBlock, code: string): CaseResult[] {
  const bare = stripComments(task.lang, code);
  const norm = (r: CodeRule) => (Array.isArray(r) ? { pattern: r[0], message: r[1], flags: undefined } : r);
  const out: CaseResult[] = [];
  for (const r of (task.require ?? []).map(norm)) if (!new RegExp(r.pattern, r.flags).test(bare)) out.push({ name: r.message, ok: false });
  for (const r of (task.forbid ?? []).map(norm)) if (new RegExp(r.pattern, r.flags).test(bare)) out.push({ name: r.message, ok: false });
  return out;
}

export async function checkCode(task: TaskBlock, code: string, ex: Executors): Promise<CheckResult> {
  const r = await checkCodeInner(task, code, ex);
  const rules = checkRules(task, code);
  if (!rules.length) return r;
  return { ...r, ok: false, cases: [...r.cases, ...rules.map((x) => ({ ...x, message: 'требование к коду' }))] };
}

async function checkCodeInner(task: TaskBlock, code: string, ex: Executors): Promise<CheckResult> {
  if (task.lang === 'sql') return checkSql(task, code, ex);
  const lang = task.lang;
  const t0 = Date.now();
  const cases: CaseResult[] = [];
  let stdout = '';
  let stderr = '';
  if (task.harness) {
    const { files, fixError } = prepare(lang, code, task.harness);
    const r = await ex.code(lang, files, '');
    const h = parseHarness(r.stdout);
    if (r.error || r.timeout)
      return { ok: false, cases: h.cases, error: r.timeout ? TIMEOUT_MSG : fixError(r.error!), stdout: h.rest, stderr: r.stderr, timeout: r.timeout, ms: Date.now() - t0 };
    cases.push(...h.cases);
    stdout = h.rest;
    stderr = r.stderr;
    if (!h.cases.length) cases.push({ name: 'проверка', ok: false, message: 'Проверочный код ничего не сообщил — возможно, программа завершилась раньше.' });
  }
  for (const [i, t] of (task.tests ?? []).entries()) {
    const { files, fixError } = prepare(lang, code);
    const r = await ex.code(lang, files, t.stdin);
    const name = t.name ?? `тест ${i + 1}`;
    if (r.error || r.timeout)
      return {
        ok: false,
        cases: [...cases, { name, ok: false, hidden: t.hidden, stdin: t.stdin, message: 'ошибка выполнения' }],
        error: r.timeout ? TIMEOUT_MSG : fixError(r.error!),
        stdout: r.stdout,
        stderr: r.stderr,
        timeout: r.timeout,
        ms: Date.now() - t0,
      };
    const ok = norm(r.stdout) === norm(t.stdout);
    cases.push({ name, ok, hidden: t.hidden, stdin: t.stdin, expected: t.stdout, got: r.stdout });
    if (!stdout) stdout = r.stdout;
    stderr ||= r.stderr;
  }
  if (!task.harness && !task.tests?.length) {
    // Нет проверок — просто запускаем: задача засчитывается, если код выполнился без ошибок.
    const { files, fixError } = prepare(lang, code);
    const r = await ex.code(lang, files, '');
    const ok = !r.error && !r.timeout;
    return { ok, cases: [{ name: 'запуск без ошибок', ok }], error: r.timeout ? TIMEOUT_MSG : r.error && fixError(r.error), stdout: r.stdout, stderr: r.stderr, ms: Date.now() - t0 };
  }
  return { ok: cases.every((c) => c.ok), cases, stdout, stderr, ms: Date.now() - t0 };
}

export const TIMEOUT_MSG =
  'Программа работала слишком долго и была остановлена. Частые причины: бесконечный цикл, дедлок (все горутины ждут друг друга), чтение из канала, в который никто не пишет.';

const cell = (v: unknown) => (v === null || v === undefined ? 'NULL' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v));
const rowKey = (r: unknown[]) => r.map(cell).join('\u0001');

function sameTable(a: SqlResult, b: SqlResult, ordered: boolean): string | null {
  if (a.columns.length !== b.columns.length) return `Ожидалось колонок: ${b.columns.length}, получено: ${a.columns.length}`;
  if (a.rows.length !== b.rows.length) return `Ожидалось строк: ${b.rows.length}, получено: ${a.rows.length}`;
  const ka = a.rows.map(rowKey);
  const kb = b.rows.map(rowKey);
  if (!ordered) {
    ka.sort();
    kb.sort();
  }
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ordered ? `Строка ${i + 1} отличается (или порядок строк неверный)` : 'Набор строк отличается от ожидаемого';
  return null;
}

async function checkSql(task: TaskBlock, code: string, ex: Executors): Promise<CheckResult> {
  const t0 = Date.now();
  const setup = task.setup ?? '';
  const scriptsUser = task.check ? [code, task.check] : [code];
  const scriptsRef = task.check ? [task.solution, task.check] : [task.solution];
  const [u, r] = await Promise.all([ex.sql(setup, scriptsUser), ex.sql(setup, scriptsRef)]);
  if (r.error) return { ok: false, cases: [], error: `Ошибка в эталонном решении задачи (это баг курса): ${r.error}`, ms: Date.now() - t0 };
  if (u.error) return { ok: false, cases: [], error: u.error, ms: Date.now() - t0 };
  const got = u.results.at(-1);
  const want = r.results.at(-1)!;
  if (!got) return { ok: false, cases: [], error: 'Запрос ничего не вернул', ms: Date.now() - t0 };
  const diff = sameTable(got, want, task.ordered ?? false);
  return {
    ok: !diff,
    cases: [{ name: task.check ? 'состояние базы после твоего запроса' : 'результат запроса', ok: !diff, message: diff ?? undefined }],
    table: got,
    expectedTable: want,
    ms: Date.now() - t0,
  };
}

export const cellText = cell;
