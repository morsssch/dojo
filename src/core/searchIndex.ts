// Поисковый индекс: по одной записи на шаг урока. Строится при сборке (Vite-плагин) из тех же файлов курса.
import { buildCourses, parseLesson, Segment } from './parse';

export interface SearchEntry {
  course: string;
  courseTitle: string;
  module: string;
  lessonKey: string;
  lessonTitle: string;
  step: number;
  stepTitle: string;
  text: string;
  draft?: boolean;
}

const stripMd = (s: string) =>
  s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s*\[!\w+\][^\n]*/gm, ' ')
    .replace(/[*_#>|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function blockText(seg: Segment): string {
  if (seg.kind === 'md') return stripMd(seg.text);
  if (seg.kind !== 'block' || !seg.data) return '';
  const d = seg.data as Record<string, unknown>;
  const parts: string[] = [];
  const add = (v: unknown) => typeof v === 'string' && parts.push(stripMd(v));
  for (const k of ['title', 'question', 'prompt', 'intro', 'explain']) add(d[k]);
  for (const o of (d.options as unknown[]) ?? []) add(typeof o === 'string' ? o : (o as { text?: string }).text);
  for (const it of (d.items as { q?: string; a?: string }[]) ?? []) {
    add(it.q);
    add(it.a);
  }
  for (const q of (d.questions as { q?: string }[]) ?? []) add(q.q);
  for (const st of (d.steps as { text?: string }[]) ?? []) add(st.text);
  for (const g of (d.goals as { text?: string }[]) ?? []) add(g.text);
  return parts.join(' ');
}

export function buildSearchIndex(files: Record<string, string>): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const c of buildCourses(files))
    for (const m of c.modules)
      for (const l of m.lessons) {
        const lesson = parseLesson(files[l.file], l.file);
        lesson.steps.forEach((st, i) =>
          out.push({
            course: c.id,
            courseTitle: c.meta.title,
            module: m.meta.title,
            lessonKey: l.key,
            lessonTitle: l.meta.title,
            step: i,
            stepTitle: st.title,
            text: st.segments.map(blockText).join(' ').slice(0, 4000),
            draft: l.meta.draft || undefined,
          }),
        );
      }
  return out;
}
