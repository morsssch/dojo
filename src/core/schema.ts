// Схемы всего, что автор пишет руками: course.yaml, module.yaml, frontmatter урока,
// roadmap.yaml и YAML внутри интерактивных блоков. Одни и те же схемы используются
// в браузере (ошибка рисуется прямо в уроке) и в `npm run check`.
import { z } from 'zod';

const md = z.string(); // markdown-строка

export const CourseMeta = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: md.optional(),
  icon: z.string().optional(),
  // Пояса: названия уровней по порогу общего прогресса (0..1). По умолчанию — дзюдо.
  belts: z.array(z.object({ at: z.number().min(0).max(1), name: z.string(), color: z.string() })).optional(),
  draft: z.boolean().optional(),
  order: z.number().optional(),
});
export type CourseMeta = z.infer<typeof CourseMeta>;

export const ModuleMeta = z.object({
  title: z.string(),
  description: md.optional(),
  draft: z.boolean().optional(),
});
export type ModuleMeta = z.infer<typeof ModuleMeta>;

export const LessonMeta = z.object({
  title: z.string(),
  minutes: z.number().optional(),
  draft: z.boolean().optional(),
  checkpoint: z.boolean().optional(),
  // Минимальная доля решённых блоков, чтобы чекпоинт засчитался (по умолчанию 0.8).
  pass: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
});
export type LessonMeta = z.infer<typeof LessonMeta>;

export const RoadmapSchema = z.object({
  sections: z.array(z.object({ id: z.string(), title: z.string(), color: z.string().optional() })).default([]),
  nodes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      section: z.string().optional(),
      x: z.number(),
      y: z.number(),
      description: md.optional(),
      // "module" или "module/lesson"
      links: z.array(z.string()).default([]),
      optional: z.boolean().optional(),
    }),
  ),
  edges: z.array(z.tuple([z.string(), z.string()])).default([]),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

// ---------- Блоки ----------

const QuizOption = z.union([
  z.string(),
  z.object({ text: md, correct: z.boolean().optional(), why: md.optional() }),
]);

export const QuizBlock = z.object({
  id: z.string().optional(),
  kind: z.enum(['single', 'multiple', 'text', 'number', 'order']).default('single'),
  question: md,
  code: z.string().optional(),
  lang: z.string().optional(),
  options: z.array(QuizOption).optional(),
  // text: строка, список допустимых строк или /regex/; number: число; order: не нужно (порядок options правильный)
  answer: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
  tolerance: z.number().optional(),
  explain: md.optional(),
  hints: z.array(md).optional(),
});
export type QuizBlock = z.infer<typeof QuizBlock>;

const IoTest = z.object({
  name: z.string().optional(),
  stdin: z.string().default(''),
  stdout: z.string(),
  hidden: z.boolean().optional(),
});

export const TaskBlock = z.object({
  id: z.string().optional(),
  lang: z.enum(['go', 'js', 'python', 'sql']),
  title: z.string().optional(),
  prompt: md.optional(),
  starter: z.string().default(''),
  solution: z.string(),
  hints: z.array(md).optional(),
  // go/js/python
  tests: z.array(IoTest).optional(),
  harness: z.string().optional(),
  // sql
  setup: z.string().optional(),
  ordered: z.boolean().optional(),
  check: z.string().optional(),
  explain: md.optional(),
});
export type TaskBlock = z.infer<typeof TaskBlock>;

export const GitCheck = z.union([
  z.object({ repo: z.literal(true) }),
  z.object({ file: z.string(), contains: z.string().optional(), absent: z.boolean().optional() }),
  z.object({ branch: z.string(), exists: z.boolean().optional() }),
  z.object({ head: z.string() }),
  z.object({ commits: z.number(), branch: z.string().optional() }),
  z.object({ message: z.string(), branch: z.string().optional() }),
  z.object({ clean: z.literal(true) }),
  z.object({ staged: z.string() }),
  z.object({ tracked: z.string() }),
  z.object({ merged: z.string(), into: z.string() }),
  z.object({ tag: z.string() }),
  z.object({ remote: z.string(), branch: z.string().optional() }),
]);
export type GitCheck = z.infer<typeof GitCheck>;

export const GitBlock = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  prompt: md.optional(),
  // Команды, которые выполняются молча перед стартом (готовят состояние).
  setup: z.array(z.string()).default([]),
  goals: z.array(z.object({ text: md, check: GitCheck })).default([]),
  // Эталонное решение: список команд. Используется `npm run check`.
  solution: z.array(z.string()).default([]),
  hints: z.array(md).optional(),
  explain: md.optional(),
  // Свободная песочница без целей — блок не требуется для прохождения.
  sandbox: z.boolean().optional(),
});
export type GitBlock = z.infer<typeof GitBlock>;

export const AnimBlock = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  // Сетка: x,y — в «клетках». Размер клетки считается автоматически.
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      x: z.number(),
      y: z.number(),
      sub: z.string().optional(),
      kind: z.enum(['box', 'db', 'actor', 'cloud', 'queue', 'cell', 'note']).default('box'),
      w: z.number().optional(),
    }),
  ),
  edges: z.array(z.union([z.tuple([z.string(), z.string()]), z.tuple([z.string(), z.string(), z.string()])])).default([]),
  steps: z.array(
    z.object({
      text: md,
      send: z
        .union([
          z.object({ from: z.string(), to: z.string(), label: z.string().optional(), color: z.string().optional() }),
          z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional(), color: z.string().optional() })),
        ])
        .optional(),
      highlight: z.array(z.string()).optional(),
      set: z.record(z.string()).optional(),
      show: z.array(z.string()).optional(),
      hide: z.array(z.string()).optional(),
    }),
  ),
});
export type AnimBlock = z.infer<typeof AnimBlock>;

export const ProjectBlock = z.object({
  id: z.string().optional(),
  title: z.string(),
  prompt: md.optional(),
  commands: z.array(z.string()).optional(),
  checklist: z.array(md).min(1),
  hints: z.array(md).optional(),
});
export type ProjectBlock = z.infer<typeof ProjectBlock>;

export const PlaygroundBlock = z.object({
  lang: z.enum(['go', 'js', 'python', 'sql']),
  code: z.string(),
  setup: z.string().optional(),
  stdin: z.string().optional(),
});
export type PlaygroundBlock = z.infer<typeof PlaygroundBlock>;

export const BLOCK_SCHEMAS = {
  quiz: QuizBlock,
  task: TaskBlock,
  git: GitBlock,
  anim: AnimBlock,
  project: ProjectBlock,
} as const;
export type BlockType = keyof typeof BLOCK_SCHEMAS;
