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
  // Личный курс: на сайте виден только после входа синхронизацией под одним из этих логинов GitHub.
  // Это не защита (файлы курса лежат в публичном репозитории), а просто не показывать его всем подряд.
  owners: z.array(z.string()).optional(),
  // Варианты (например, лабы по вариантам): ученик выбирает свой, блоки ```variant показываются только ему.
  variants: z
    .object({
      label: z.string().optional(), // как называть выбор: «Вариант», «Стек», «Язык»…
      byGroup: z.boolean().optional(), // вариант лабы = номер в списке mod число вариантов
      labCounts: z.record(z.number().int().positive()).optional(), // ключ урока → число вариантов, если отличается от общего
      options: z.array(z.object({ id: z.string(), title: z.string(), description: z.string().optional() }).strict()).min(2),
    })
    .strict()
    .optional(),
  // Разминка: задачи с Codewars, открываются ссылкой. after — модуль, после которого задача «открывается».
  codewars: z
    .object({
      lang: z.string(),
      katas: z.array(z.object({ slug: z.string(), title: z.string(), rank: z.string().optional(), after: z.string().optional() }).strict()),
    })
    .optional(),
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

const Side = z.enum(['top', 'right', 'bottom', 'left']);
export const RoadmapNode = z.object({
  id: z.string(),
  title: z.string(),
  // topic — ключевая тема на основной линии; sub — подтема сбоку; checkpoint — проект/контрольная точка;
  // label — просто текст на холсте; title — крупный заголовок раздела; note — плашка-пояснение
  // group — рамка-кластер с заголовком, внутри которой стоят другие узлы
  kind: z.enum(['topic', 'sub', 'checkpoint', 'label', 'title', 'note', 'group']).default('topic'),
  section: z.string().optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().optional(),
  h: z.number().optional(),
  // подробности — показываются в боковой панели по клику
  description: md.optional(),
  resources: z.array(z.object({ title: z.string(), url: z.string(), kind: z.enum(['article', 'video', 'docs', 'course', 'tool', 'book']).default('article') })).default([]),
  // "module" или "module/lesson"
  links: z.array(z.string()).default([]),
  optional: z.boolean().optional(),
}).strict();
export type RoadmapNode = z.infer<typeof RoadmapNode>;

const RoadmapEdge = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({
    from: z.string(),
    to: z.string(),
    fromSide: Side.optional(),
    toSide: Side.optional(),
    style: z.enum(['solid', 'dashed', 'dotted']).optional(),
    // плавная кривая вместо прямых углов (хорошо для основного пути «змейкой»)
    curve: z.boolean().optional(),
    // точки излома [x, y] — линия идёт через них под прямыми углами
    via: z.array(z.tuple([z.number(), z.number()])).optional(),
  }),
]);
export type RoadmapEdge = z.infer<typeof RoadmapEdge>;

export const RoadmapSchema = z.object({
  sections: z.array(z.object({ id: z.string(), title: z.string(), color: z.string().optional() })).default([]),
  nodes: z.array(RoadmapNode),
  edges: z.array(RoadmapEdge).default([]),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

// ---------- Блоки ----------

const QuizOption = z.union([
  z.string(),
  z.object({ text: md, correct: z.boolean().optional(), why: md.optional() }),
]);

export const QuizBlock = z.object({
  id: z.string().optional(),
  kind: z.enum(['single', 'multiple', 'text', 'number', 'order', 'match']).default('single'),
  question: md,
  code: z.string().optional(),
  lang: z.string().optional(),
  options: z.array(QuizOption).optional(),
  // text: строка, список допустимых строк или /regex/; number: число; order: не нужно (порядок options правильный)
  answer: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))]).optional(),
  tolerance: z.number().optional(),
  // match: пары «левое — правое»; правая колонка показывается перемешанной
  pairs: z.array(z.object({ left: md, right: md })).optional(),
  explain: md.optional(),
  hints: z.array(md).optional(),
}).strict();
export type QuizBlock = z.infer<typeof QuizBlock>;

/** Ссылки на уроки, которые нужно знать: "module/lesson" или "module". */
const Needs = z.array(z.string()).optional();
/** Правило по тексту кода (комментарии вырезаются): [regex, сообщение] или { pattern, message, flags } */
const CodeRule = z.union([
  z.tuple([z.string(), z.string()]),
  z.object({ pattern: z.string(), message: z.string(), flags: z.string().optional() }),
]);
export type CodeRule = z.infer<typeof CodeRule>;

const IoTest = z
  .object({
    name: z.string().optional(),
    stdin: z.string().default(''),
    stdout: z.string().optional(), // ожидаемый вывод целиком
    match: z.string().optional(), // или регулярка, которой должен соответствовать вывод (флаги — matchFlags)
    matchFlags: z.string().optional(),
    throws: z.string().optional(), // или: программа должна упасть с ошибкой, в тексте которой есть эта строка (тип исключения, panic)
    harness: z.string().optional(), // свой код проверки для этого теста: запускается вместе с кодом ученика, вывод сравнивается с stdout
    hidden: z.boolean().optional(),
  })
  .strict()
  .refine((t) => t.stdout !== undefined || t.match !== undefined || t.throws !== undefined, { message: 'у теста нужен stdout, match или throws' });

export const TaskBlock = z.object({
  id: z.string().optional(),
  lang: z.enum(['go', 'js', 'python', 'cs', 'sql']),
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
  // в коде обязательно должно быть / не должно быть (например: «используй for range», «без sort.Ints»)
  require: z.array(CodeRule).optional(),
  forbid: z.array(CodeRule).optional(),
  needs: Needs,
  explain: md.optional(),
  // этап лабы: id блока lab в этом же уроке и имя вставки {{part}} в его шаблоне
  lab: z.string().optional(),
  part: z.string().optional(),
}).strict();
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
  needs: Needs,
}).strict();
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
}).strict();
export type AnimBlock = z.infer<typeof AnimBlock>;

export const ProjectBlock = z.object({
  id: z.string().optional(),
  title: z.string(),
  prompt: md.optional(),
  commands: z.array(z.string()).optional(),
  checklist: z.array(md).min(1),
  hints: z.array(md).optional(),
  needs: Needs,
}).strict();
export type ProjectBlock = z.infer<typeof ProjectBlock>;

/** Лаба по этапам: шаблон программы с вставками {{part}}; этапы — задачи task с lab/part в этом же уроке. */
export const LabBlock = z.object({
  id: z.string(),
  title: z.string(),
  lang: z.enum(['go', 'js', 'python', 'cs']),
  intro: md.optional(),
  template: z.string(),
  // заглушки для ещё не сделанных этапов: код, который компилируется, но ничего не умеет
  stubs: z.record(z.string()).default({}),
  // проверка всей собранной программы
  harness: z.string().optional(),
  tests: z.array(IoTest).optional(),
  checklist: z.array(md).optional(),
}).strict();
export type LabBlock = z.infer<typeof LabBlock>;

/** Карточки «как это могут спросить»: вопрос → показать ответ → «знаю / повторить». Не обязательный блок. */
export const CardsBlock = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  items: z.array(z.object({ q: md, a: md })).min(1),
}).strict();
export type CardsBlock = z.infer<typeof CardsBlock>;

/** Письменные ответы: ученик пишет текстом, потом копирует всё одним промптом на проверку ИИ-ментору. */
export const WrittenBlock = z.object({
  id: z.string().optional(),
  title: z.string(),
  intro: md.optional(),
  questions: z.array(z.object({ q: md, rows: z.number().optional() })).min(1),
  // кем должен быть проверяющий и на что смотреть — попадёт в начало скопированного текста
  reviewer: z.string().optional(),
}).strict();
export type WrittenBlock = z.infer<typeof WrittenBlock>;

export const PlaygroundBlock = z.object({
  lang: z.enum(['go', 'js', 'python', 'cs', 'sql']),
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
  cards: CardsBlock,
  written: WrittenBlock,
  lab: LabBlock,
} as const;
export type BlockType = keyof typeof BLOCK_SCHEMAS;
