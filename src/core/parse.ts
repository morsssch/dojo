// Парсер файлов курса. Не зависит от браузера: используется и сайтом, и tools/check.ts.
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  BLOCK_SCHEMAS,
  BlockType,
  CourseMeta,
  LessonMeta,
  ModuleMeta,
  PlaygroundBlock,
  Roadmap,
  RoadmapSchema,
} from './schema';

// ---------- Структура курса ----------

export interface LessonRef {
  id: string; // "basics" (без числового префикса)
  key: string; // "go-basics/basics"
  file: string; // путь к .md
  meta: LessonMeta;
}
export interface ModuleRef {
  id: string;
  dir: string;
  meta: ModuleMeta;
  lessons: LessonRef[];
}
export interface CourseRef {
  id: string;
  dir: string;
  meta: CourseMeta;
  modules: ModuleRef[];
  roadmap?: Roadmap;
  errors: string[];
}

/** "03-http-basics" -> "http-basics" */
export const stripPrefix = (name: string) => name.replace(/^\d+[-_]/, '');

const fmt = (e: z.ZodError) => e.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');

export function parseYaml<T>(text: string, schema: z.ZodType<T>, where: string, errors: string[]): T | undefined {
  let raw: unknown;
  try {
    raw = yaml.load(text) ?? {};
  } catch (e) {
    errors.push(`${where}: YAML не парсится — ${(e as Error).message}`);
    return undefined;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    errors.push(`${where}: ${fmt(r.error)}`);
    return undefined;
  }
  return r.data;
}

/**
 * Собирает список курсов из плоского словаря файлов.
 * `files` — пути вида "/courses/<course>/course.yaml" → содержимое (для .md достаточно пустой строки + frontmatter).
 */
export function buildCourses(files: Record<string, string>): CourseRef[] {
  const courses = new Map<string, CourseRef>();
  const paths = Object.keys(files).sort();
  for (const p of paths) {
    const m = p.match(/courses\/([^/]+)\/course\.yaml$/);
    if (!m) continue;
    const errors: string[] = [];
    const meta = parseYaml(files[p], CourseMeta, p, errors) ?? { title: m[1] };
    courses.set(m[1], { id: m[1], dir: p.replace(/\/course\.yaml$/, ''), meta, modules: [], errors });
  }
  for (const c of courses.values()) {
    const rp = `${c.dir}/roadmap.yaml`;
    if (files[rp] !== undefined) c.roadmap = parseYaml(files[rp], RoadmapSchema, rp, c.errors) as Roadmap | undefined;
    const modDirs = new Set<string>();
    for (const p of paths) {
      const m = p.slice(c.dir.length + 1).match(/^modules\/([^/]+)\//);
      if (p.startsWith(c.dir + '/') && m) modDirs.add(m[1]);
    }
    for (const md of [...modDirs].sort()) {
      const dir = `${c.dir}/modules/${md}`;
      const mp = `${dir}/module.yaml`;
      const id = stripPrefix(md);
      let meta: ModuleMeta = { title: id };
      if (files[mp] === undefined) c.errors.push(`${dir}: нет module.yaml`);
      else meta = parseYaml(files[mp], ModuleMeta, mp, c.errors) ?? meta;
      const lessons: LessonRef[] = [];
      for (const p of paths) {
        if (!p.startsWith(dir + '/') || !p.endsWith('.md')) continue;
        const name = p.slice(dir.length + 1);
        if (name.includes('/')) continue;
        const lid = stripPrefix(name.replace(/\.md$/, ''));
        const { meta: lm } = splitFrontmatter(files[p], p, c.errors);
        lessons.push({ id: lid, key: `${id}/${lid}`, file: p, meta: lm });
      }
      if (c.modules.some((x) => x.id === id)) c.errors.push(`${dir}: повторяется id модуля "${id}"`);
      c.modules.push({ id, dir, meta, lessons });
    }
  }
  return [...courses.values()].sort((a, b) => (a.meta.order ?? 99) - (b.meta.order ?? 99) || a.id.localeCompare(b.id));
}

export function splitFrontmatter(text: string, where: string, errors: string[]): { meta: LessonMeta; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    errors.push(`${where}: нет frontmatter (--- title: ... ---)`);
    return { meta: { title: where.split('/').pop() ?? where }, body: text };
  }
  const meta = parseYaml(m[1], LessonMeta, where, errors) ?? { title: '???' };
  return { meta, body: text.slice(m[0].length) };
}

// ---------- Урок ----------

export type Segment =
  | { kind: 'md'; text: string }
  | { kind: 'block'; type: BlockType; id: string; data: any; required: boolean; error?: string; raw: string }
  | { kind: 'mermaid'; code: string }
  | { kind: 'playground'; data: PlaygroundBlock };

export type StepKind = 'theory' | 'quiz' | 'task' | 'git' | 'project' | 'anim' | 'cards' | 'written';

export interface Step {
  index: number;
  title: string;
  kind: StepKind;
  segments: Segment[];
  required: string[]; // id блоков, которые нужно решить
}

export interface Lesson {
  meta: LessonMeta;
  steps: Step[];
  errors: string[];
}

const BLOCK_TYPES = Object.keys(BLOCK_SCHEMAS) as BlockType[];
const RUN_LANGS: Record<string, PlaygroundBlock['lang']> = {
  go: 'go',
  js: 'js',
  javascript: 'js',
  python: 'python',
  py: 'python',
  sql: 'sql',
};

export function parseLesson(text: string, where = 'lesson'): Lesson {
  const errors: string[] = [];
  const { meta, body } = splitFrontmatter(text, where, errors);
  const lines = body.split(/\r?\n/);

  // 1. Режем на шаги по заголовкам первого уровня вне код-блоков.
  const rawSteps: { title: string; lines: string[] }[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (fence === null) fence = f[1];
      else if (line.trim().startsWith(fence) && line.trim().replace(/[`~]/g, '') === '') fence = null;
    }
    const h = fence === null && !f ? line.match(/^#\s+(.+?)\s*$/) : null;
    if (h) rawSteps.push({ title: h[1], lines: [] });
    else if (rawSteps.length) rawSteps[rawSteps.length - 1].lines.push(line);
    else if (line.trim()) {
      rawSteps.push({ title: meta.title, lines: [line] });
    }
  }
  if (!rawSteps.length) rawSteps.push({ title: meta.title, lines: ['*Урок пока пустой.*'] });

  // 2. Внутри шага выделяем интерактивные блоки.
  const seen = new Set<string>();
  const steps: Step[] = rawSteps.map((rs, si) => {
    const segments: Segment[] = [];
    const required: string[] = [];
    let buf: string[] = [];
    const flush = () => {
      const t = buf.join('\n');
      if (t.trim()) segments.push({ kind: 'md', text: t });
      buf = [];
    };
    for (let i = 0; i < rs.lines.length; i++) {
      const line = rs.lines[i];
      const f = line.match(/^(`{3,}|~{3,})\s*([\w-]+)?\s*(.*)$/);
      if (!f) {
        buf.push(line);
        continue;
      }
      const marker = f[1];
      const info = (f[2] ?? '').toLowerCase();
      const rest = f[3].trim().toLowerCase();
      // ищем закрывающий забор
      let j = i + 1;
      const content: string[] = [];
      while (j < rs.lines.length && !(rs.lines[j].trim().startsWith(marker) && rs.lines[j].trim().replace(/[`~]/g, '') === '')) {
        content.push(rs.lines[j]);
        j++;
      }
      const code = content.join('\n');
      const isBlock = (BLOCK_TYPES as string[]).includes(info);
      const isRun = RUN_LANGS[info] && rest.split(/\s+/).includes('run');
      if (!isBlock && !isRun && info !== 'mermaid') {
        buf.push(...rs.lines.slice(i, j + 1));
        i = j;
        continue;
      }
      flush();
      if (info === 'mermaid') segments.push({ kind: 'mermaid', code });
      else if (isRun) {
        const lang = RUN_LANGS[info];
        let setup: string | undefined;
        let visible = code;
        const cut = code.split(/\n?^--\s*\^\s*setup.*$\n?/m);
        if (lang === 'sql' && cut.length === 2) [setup, visible] = cut;
        segments.push({ kind: 'playground', data: { lang, code: visible, setup } });
      } else {
        const type = info as BlockType;
        const where2 = `${where} › шаг ${si + 1} «${rs.title}» › ${type}`;
        const errs: string[] = [];
        const data = parseYaml(code, BLOCK_SCHEMAS[type] as z.ZodType<any>, where2, errs);
        const n = segments.filter((s) => s.kind === 'block').length;
        const id = (data?.id as string | undefined) ?? `s${si + 1}-${type}${n + 1}`;
        if (seen.has(id)) errs.push(`${where2}: повторяется id "${id}"`);
        seen.add(id);
        const isRequired = type !== 'anim' && type !== 'cards' && !(type === 'git' && data?.sandbox);
        if (isRequired) required.push(id);
        errors.push(...errs);
        segments.push({ kind: 'block', type, id, data, required: isRequired, error: errs.join('\n') || undefined, raw: code });
      }
      i = j;
    }
    flush();
    const firstReq = segments.find((s) => s.kind === 'block' && s.required) as Extract<Segment, { kind: 'block' }> | undefined;
    const firstOpt = segments.find((s) => s.kind === 'block' && (s.type === 'anim' || s.type === 'cards')) as Extract<Segment, { kind: 'block' }> | undefined;
    const kind: StepKind = firstReq ? (firstReq.type as StepKind) : firstOpt ? (firstOpt.type as StepKind) : 'theory';
    return { index: si, title: rs.title, kind, segments, required };
  });
  return { meta, steps, errors };
}

/** Все id обязательных блоков урока. */
export const lessonBlockIds = (l: Lesson) => l.steps.flatMap((s) => s.required);
