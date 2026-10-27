// Лёгкое описание всех курсов, которое генерируется при сборке (см. tools/vite-plugin-dojo.ts)
// и импортируется как `virtual:dojo-manifest`. Тексты уроков сюда не попадают.
import { buildCourses, parseLesson, StepKind } from './parse';
import type { CourseMeta, LessonMeta, ModuleMeta, Roadmap, RoadmapNode } from './schema';

/** Размеры узла роадмапа по умолчанию (зависят от типа). */
export const NODE_SIZE: Record<RoadmapNode['kind'], { w: number; h: number }> = {
  topic: { w: 220, h: 48 },
  sub: { w: 200, h: 40 },
  checkpoint: { w: 260, h: 48 },
  label: { w: 240, h: 40 },
  title: { w: 320, h: 56 },
  note: { w: 280, h: 90 },
  group: { w: 300, h: 160 },
};
export const edgeEnds = (e: Roadmap['edges'][number]): [string, string] => (Array.isArray(e) ? e : [e.from, e.to]);
export const nodeBox = (n: RoadmapNode) => ({ x: n.x, y: n.y, w: n.w ?? NODE_SIZE[n.kind].w, h: n.h ?? NODE_SIZE[n.kind].h });

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
  // needs и ссылки lesson: в тексте уроков должны вести на существующие уроки.
  for (const c of courses) {
    const exists = (link: string) => {
      const [mid, lid] = link.split('#')[0].split('/');
      const mod = c.modules.find((m) => m.id === mid);
      return !!mod && (!lid || mod.lessons.some((l) => l.id === lid));
    };
    for (const m of c.modules)
      for (const l of m.lessons) {
        const raw = files[l.file] ?? '';
        // примеры синтаксиса в `коде` — не ссылки
        const text = raw.replace(/`[^`\n]*`/g, '');
        for (const mm of text.matchAll(/\]\(lesson:([^)\s]+)\)/g)) if (!exists(mm[1])) errors.push(`${l.file}: ссылка lesson:${mm[1]} ведёт на несуществующий урок`);
        for (const mm of text.matchAll(/^\s*needs:\s*\[([^\]]*)\]/gm))
          for (const link of mm[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean))
            if (!exists(link)) errors.push(`${l.file}: needs «${link}» ведёт на несуществующий урок`);
      }
  }
  // Ссылки роадмапа должны вести на существующие модули/уроки.
  for (const c of courses) {
    if (!c.roadmap) continue;
    const ids = new Set(c.roadmap.nodes.map((n) => n.id));
    if (ids.size !== c.roadmap.nodes.length) {
      const seen = new Set<string>();
      for (const n of c.roadmap.nodes) {
        if (seen.has(n.id)) errors.push(`courses/${c.id}/roadmap.yaml: повторяется id узла «${n.id}»`);
        seen.add(n.id);
      }
    }
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
    for (const e of c.roadmap.edges) {
      const [a, b] = Array.isArray(e) ? e : [e.from, e.to];
      if (!ids.has(a) || !ids.has(b)) errors.push(`courses/${c.id}/roadmap.yaml: связь ${a} → ${b} ссылается на несуществующий узел`);
    }
    // узлы не должны налезать друг на друга (нейронки расставляют координаты руками)
    const boxes = c.roadmap.nodes.filter((n) => n.kind !== 'label' && n.kind !== 'group').map((n) => ({ n, ...nodeBox(n) }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i];
        const B = boxes[j];
        if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h)
          errors.push(`courses/${c.id}/roadmap.yaml: узлы «${A.n.id}» и «${B.n.id}» перекрываются — раздвинь координаты`);
      }
  }
  return { courses, errors };
}
