// Лёгкое описание всех курсов, которое генерируется при сборке (см. tools/vite-plugin-dojo.ts)
// и импортируется как `virtual:dojo-manifest`. Тексты уроков сюда не попадают.
import { buildCourses, parseLesson, StepKind } from './parse';
import type { CourseMeta, LessonMeta, ModuleMeta, Roadmap } from './schema';

export interface LessonInfo {
  id: string;
  key: string;
  file: string;
  meta: LessonMeta;
  steps: { title: string; kind: StepKind }[];
  required: string[];
}
export interface ModuleInfo {
  id: string;
  meta: ModuleMeta;
  lessons: LessonInfo[];
}
export interface CourseInfo {
  id: string;
  meta: CourseMeta;
  modules: ModuleInfo[];
  roadmap?: Roadmap;
}
export interface Manifest {
  courses: CourseInfo[];
  errors: string[];
}

export function buildManifest(files: Record<string, string>): Manifest {
  const errors: string[] = [];
  const courses = buildCourses(files).map((c) => {
    errors.push(...c.errors);
    return {
      id: c.id,
      meta: c.meta,
      roadmap: c.roadmap,
      modules: c.modules.map((m) => ({
        id: m.id,
        meta: m.meta,
        lessons: m.lessons.map((l) => {
          const parsed = parseLesson(files[l.file], l.file);
          errors.push(...parsed.errors);
          return {
            id: l.id,
            key: l.key,
            file: l.file,
            meta: l.meta,
            steps: parsed.steps.map((s) => ({ title: s.title, kind: s.kind })),
            required: parsed.steps.flatMap((s) => s.required),
          };
        }),
      })),
    };
  });
  // Ссылки роадмапа должны вести на существующие модули/уроки.
  for (const c of courses) {
    if (!c.roadmap) continue;
    const ids = new Set(c.roadmap.nodes.map((n) => n.id));
    for (const n of c.roadmap.nodes) {
      for (const link of n.links) {
        const [mid, lid] = link.split('/');
        const mod = c.modules.find((m) => m.id === mid);
        if (!mod || (lid && !mod.lessons.some((l) => l.id === lid)))
          errors.push(`courses/${c.id}/roadmap.yaml: узел "${n.id}" ссылается на несуществующее "${link}"`);
      }
      if (n.section && !c.roadmap.sections.some((s) => s.id === n.section))
        errors.push(`courses/${c.id}/roadmap.yaml: узел "${n.id}" — нет секции "${n.section}"`);
    }
    for (const [a, b] of c.roadmap.edges)
      if (!ids.has(a) || !ids.has(b)) errors.push(`courses/${c.id}/roadmap.yaml: ребро ${a} → ${b} ссылается на несуществующий узел`);
  }
  return { courses, errors };
}
