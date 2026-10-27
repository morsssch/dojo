// npm run check — проверка всего контента курсов.
//  1. Схемы YAML, frontmatter, ссылки роадмапа.
//  2. Логика квизов (есть правильные ответы и т.п.).
//  3. Эталонные решения задач проходят свои же тесты (Go — тем же yaegi, что в браузере; SQL — PGlite).
//  4. Стартовый код НЕ проходит тесты (иначе задача решена «из коробки»).
//  5. Git-задачи: setup выполняется без ошибок, solution выполняет все цели.
// Флаги: --fast (без запуска кода), --course <id>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildManifest } from '../src/core/manifest';
import { Lesson, parseLesson } from '../src/core/parse';
import type { QuizBlock, TaskBlock, GitBlock, LabBlock } from '../src/core/schema';
import { assembleLab, assembleStage, findLab, labAsTask, labParts, labStages } from '../src/core/lab';
import { checkCode, ExecResult, Executors, SqlExecResult } from '../src/core/runners/check';
import { bootShell, evalGoals } from '../src/core/git/checks';
import { readCourseFiles } from './vite-plugin-dojo';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const FAST = args.includes('--fast');
const ONLY = args.includes('--course') ? args[args.indexOf('--course') + 1] : null;

const errors: string[] = [];
const warnings: string[] = [];
let checked = 0;

// ---------- исполнители для node ----------

let goRun: ((files: string[], stdin: string) => Promise<ExecResult>) | null | undefined;
async function loadGo() {
  if (goRun !== undefined) return goRun;
  const wasm = path.join(ROOT, 'public/runtimes/go/yaegi.wasm');
  if (!fs.existsSync(wasm)) {
    warnings.push('Go-рантайм не собран (npm run build:go-runtime) — Go-задачи не проверены.');
    return (goRun = null);
  }
  await import(path.join(ROOT, 'public/runtimes/go/wasm_exec.js'));
  const G = (globalThis as any).Go;
  const go = new G();
  const ready = new Promise<void>((r) => ((globalThis as any).dojoGoReady = r));
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(wasm), go.importObject);
  go.run(instance);
  await ready;
  goRun = (files, stdin) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const timer = setTimeout(() => resolve({ stdout: '', stderr: '', timeout: true, ms: Date.now() - t0 }), 10000);
      (globalThis as any).dojoRunGo(files, stdin, (stdout: string, stderr: string, error: string) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, error: error || undefined, ms: Date.now() - t0 });
      });
    });
  return goRun;
}

function runJs(files: string[], stdin: string): Promise<ExecResult> {
  const t0 = Date.now();
  let out = '';
  const lines = stdin.split('\n');
  let li = 0;
  const fmt = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
  const ctx = vm.createContext({
    console: { log: (...a: unknown[]) => (out += a.map(fmt).join(' ') + '\n'), error: () => {} },
    input: () => (li < lines.length ? lines[li++] : ''),
    dojoCheck: (n: string, g: unknown, w: unknown) => (out += JSON.stringify(g) === JSON.stringify(w) ? `\n@@PASS ${n}\n` : `\n@@FAIL ${n}\x1fполучено: ${fmt(g)}\x1fожидалось: ${fmt(w)}\n`),
    dojoAssert: (n: string, ok: boolean, m: string) => (out += ok ? `\n@@PASS ${n}\n` : `\n@@FAIL ${n}\x1f${m}\n`),
  });
  try {
    vm.runInContext(`(async () => {\n${files.join('\n;\n')}\n})()`, ctx, { timeout: 5000 });
    return Promise.resolve({ stdout: out, stderr: '', ms: Date.now() - t0 });
  } catch (e) {
    return Promise.resolve({ stdout: out, stderr: '', error: String(e), ms: Date.now() - t0 });
  }
}

let hasPython: boolean | undefined;
function runPython(files: string[], stdin: string): Promise<ExecResult> {
  const t0 = Date.now();
  const prelude = `def dojo_check(name, got, want):\n    print(("\\n@@PASS " + str(name)) if got == want else ("\\n@@FAIL " + str(name) + "\\x1fполучено: " + repr(got) + "\\x1fожидалось: " + repr(want)))\ndojoCheck = dojo_check\n`;
  try {
    const stdout = execFileSync('python3', ['-c', prelude + files.join('\n')], { input: stdin, timeout: 10000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return Promise.resolve({ stdout, stderr: '', ms: Date.now() - t0 });
  } catch (e: any) {
    return Promise.resolve({ stdout: e.stdout ?? '', stderr: '', error: String(e.stderr || e.message), ms: Date.now() - t0 });
  }
}

let pg: any;
async function runSql(setup: string, scripts: string[]): Promise<SqlExecResult> {
  if (!pg) {
    const { PGlite } = await import('@electric-sql/pglite');
    pg = new PGlite();
    await pg.waitReady;
  }
  const t0 = Date.now();
  let results: SqlExecResult['results'] = [];
  try {
    await pg.exec('BEGIN;');
    if (setup.trim()) await pg.exec(setup);
    for (const s of scripts) {
      if (!s.trim()) continue;
      const rs = await pg.exec(s, { rowMode: 'array' });
      results = rs.map((r: any) => ({ columns: r.fields.map((f: any) => f.name), rows: r.rows, affected: r.affectedRows }));
    }
    return { results, ms: Date.now() - t0 };
  } catch (e: any) {
    return { results, error: e.message, ms: Date.now() - t0 };
  } finally {
    await pg.exec('ROLLBACK;').catch(() => undefined);
  }
}

const sqlQueue: { p: Promise<unknown> } = { p: Promise.resolve() };
const executors: Executors = {
  async code(lang, files, stdin) {
    if (lang === 'go') {
      const g = await loadGo();
      if (!g) return { stdout: '', stderr: '', error: '__skip__', ms: 0 };
      return g(files, stdin);
    }
    if (lang === 'js') return runJs(files, stdin);
    if (hasPython === undefined) {
      try {
        execFileSync('python3', ['--version']);
        hasPython = true;
      } catch {
        hasPython = false;
        warnings.push('python3 не найден — Python-задачи не проверены.');
      }
    }
    if (!hasPython) return { stdout: '', stderr: '', error: '__skip__', ms: 0 };
    return runPython(files, stdin);
  },
  sql(setup, scripts) {
    const p = sqlQueue.p.then(() => runSql(setup, scripts));
    sqlQueue.p = p.catch(() => undefined);
    return p;
  },
};

// ---------- проверки ----------

function checkQuiz(q: QuizBlock, where: string) {
  const opts = (q.options ?? []).map((o) => (typeof o === 'string' ? { text: o, correct: false } : o));
  if (q.kind === 'single' || q.kind === 'multiple') {
    const n = opts.filter((o) => o.correct).length;
    if (opts.length < 2) errors.push(`${where}: нужно хотя бы 2 варианта`);
    if (n === 0) errors.push(`${where}: нет правильного варианта (correct: true)`);
    if (q.kind === 'single' && n > 1) warnings.push(`${where}: kind=single, но правильных ${n} — будет показан как «несколько ответов»`);
  }
  if (q.kind === 'order' && opts.length < 2) errors.push(`${where}: для order нужно ≥2 вариантов (в правильном порядке)`);
  if ((q.kind === 'text' || q.kind === 'number') && q.answer === undefined) errors.push(`${where}: нет answer`);
  if (q.kind === 'number' && Number.isNaN(Number(q.answer))) errors.push(`${where}: answer должен быть числом`);
  if (q.kind === 'match' && (q.pairs?.length ?? 0) < 2) errors.push(`${where}: для match нужно ≥2 пар (pairs: [{left, right}])`);
  if (q.kind === 'match' && new Set(q.pairs?.map((p) => p.right)).size !== q.pairs?.length) errors.push(`${where}: в match правые части должны быть разными`);
}

async function checkTask(t: TaskBlock, where: string, lesson?: Lesson, id?: string) {
  // этап лабы: проверяется вся программа — предыдущие этапы эталонные, следующие — заглушки
  let run = (code: string) => code;
  if (t.lab) {
    const lab = findLab(lesson, t.lab);
    if (!lab) errors.push(`${where}: lab: "${t.lab}" — в этом уроке нет блока lab с таким id`);
    else if (!t.part || !labParts(lab).includes(t.part)) errors.push(`${where}: part: "${t.part ?? ''}" — в шаблоне лабы «${lab.id}» нет вставки {{${t.part ?? '?'}}}`);
    else if (lab.lang !== t.lang) errors.push(`${where}: язык этапа (${t.lang}) не совпадает с языком лабы (${lab.lang})`);
    else {
      const stages = labStages(lesson, lab.id);
      run = (code) => assembleStage(lab, stages, id!, code, (s) => s.task.solution);
    }
  } else if (t.part) errors.push(`${where}: part без lab`);
  if (t.lang !== 'sql' && !t.tests?.length && !t.harness) warnings.push(`${where}: нет tests и harness — задача засчитается за любой код без ошибок`);
  if (t.lang === 'sql' && !t.setup) warnings.push(`${where}: SQL-задача без setup`);
  for (const r of [...(t.require ?? []), ...(t.forbid ?? [])]) {
    const pat = Array.isArray(r) ? r[0] : r.pattern;
    try {
      new RegExp(pat);
    } catch (e) {
      errors.push(`${where}: битая регулярка в require/forbid «${pat}»: ${(e as Error).message}`);
    }
  }
  if (FAST) return;
  const r = await checkCode(t, t.solution, executors, run(t.solution));
  if (r.error === '__skip__') return;
  checked++;
  if (!r.ok) {
    const failed = r.cases.filter((c) => !c.ok).map((c) => `${c.name}${c.message ? ` (${c.message.replace(/\x1f/g, '; ')})` : ''}${c.got !== undefined ? ` получено «${c.got.trim()}», ожидалось «${c.expected?.trim()}»` : ''}`);
    errors.push(`${where}: ЭТАЛОННОЕ РЕШЕНИЕ НЕ ПРОХОДИТ ПРОВЕРКУ\n    ${r.error ?? ''}${failed.join('\n    ')}`);
  }
  const s = await checkCode(t, t.starter, executors, run(t.starter));
  if (s.ok && t.starter.trim()) warnings.push(`${where}: стартовый код уже проходит все проверки`);
}

async function checkLab(lab: LabBlock, where: string, lesson: Lesson) {
  const stages = labStages(lesson, lab.id);
  if (!stages.length) errors.push(`${where}: у лабы нет этапов — добавь задачи task с lab: ${lab.id} и part: <имя вставки>`);
  const seen = new Set<string>();
  for (const s of stages) {
    if (seen.has(s.part)) errors.push(`${where}: вставку {{${s.part}}} заполняют два этапа`);
    seen.add(s.part);
  }
  for (const part of labParts(lab)) if (!seen.has(part) && lab.stubs[part] === undefined) errors.push(`${where}: вставка {{${part}}} без этапа и без заглушки в stubs`);
  for (const k of Object.keys(lab.stubs)) if (!labParts(lab).includes(k)) warnings.push(`${where}: заглушка «${k}» не используется в шаблоне`);
  if (!lab.harness && !lab.tests?.length) warnings.push(`${where}: нет harness и tests — собранная программа засчитается, если просто запустится`);
  if (FAST) return;
  const full = assembleLab(lab, Object.fromEntries(stages.map((s) => [s.part, s.task.solution])));
  const r = await checkCode(labAsTask(lab), full, executors);
  if (r.error === '__skip__') return;
  checked++;
  if (!r.ok) errors.push(`${where}: ПРОГРАММА ИЗ ЭТАЛОННЫХ ЭТАПОВ НЕ ПРОХОДИТ ПРОВЕРКУ\n    ${r.error ?? ''}${r.cases.filter((c) => !c.ok).map((c) => `${c.name}${c.message ? ` (${c.message})` : ''}${c.got !== undefined ? ` получено «${c.got.trim()}», ожидалось «${c.expected?.trim()}»` : ''}`).join('\n    ')}`);
  const stubbed = assembleLab(lab, {});
  const st = await checkCode(labAsTask(lab), stubbed, executors);
  if (st.ok) warnings.push(`${where}: программа из одних заглушек уже проходит проверку`);
}

async function checkGit(g: GitBlock, where: string) {
  if (FAST) return;
  const { sh, errors: setupErr } = await bootShell(g);
  if (setupErr.length) {
    errors.push(`${where}: ошибки в setup:\n    ${setupErr.join('\n    ')}`);
    return;
  }
  if (g.sandbox) return;
  if (!g.goals.length) errors.push(`${where}: нет goals (или поставь sandbox: true)`);
  const before = await evalGoals(sh, g);
  if (before.length && before.every(Boolean)) warnings.push(`${where}: все цели выполнены уже после setup`);
  if (!g.solution.length) {
    warnings.push(`${where}: нет solution — не могу проверить, что задача решаема`);
    return;
  }
  for (const cmd of g.solution) {
    const r = await sh.run(cmd);
    if (!r.ok) errors.push(`${where}: команда решения «${cmd}» упала: ${r.out.replace(/\x1b\[\d+m/g, '').trim()}`);
  }
  const after = await evalGoals(sh, g);
  checked++;
  after.forEach((ok, i) => !ok && errors.push(`${where}: после решения не выполнена цель «${g.goals[i].text}»`));
}

async function main() {
  const files = readCourseFiles(ROOT);
  const m = buildManifest(files);
  errors.push(...m.errors);
  for (const c of m.courses) {
    if (ONLY && c.id !== ONLY) continue;
    for (const mod of c.modules)
      for (const l of mod.lessons) {
        const lesson = parseLesson(files[l.file], l.file);
        for (const step of lesson.steps)
          for (const s of step.segments) {
            if (s.kind !== 'block' || !s.data) continue;
            const where = `${l.file} › «${step.title}» › ${s.type}#${s.id}`;
            if (s.type === 'quiz') checkQuiz(s.data, where);
            if (s.type === 'task') await checkTask(s.data, where, lesson, s.id);
            if (s.type === 'lab') await checkLab(s.data, where, lesson);
            if (s.type === 'git') await checkGit(s.data, where);
          }
      }
  }
  const uniq = [...new Set(errors)];
  for (const w of new Set(warnings)) console.log(`⚠️  ${w}`);
  for (const e of uniq) console.log(`❌ ${e}`);
  const lessons = m.courses.reduce((a, c) => a + c.modules.reduce((b, x) => b + x.lessons.length, 0), 0);
  console.log(`\nКурсов: ${m.courses.length}, уроков: ${lessons}, прогнано решений: ${checked}. Ошибок: ${uniq.length}, предупреждений: ${new Set(warnings).size}.`);
  process.exit(uniq.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
