// npm run roadmap:layout -- <course-id>
// Читает courses/<id>/roadmap.plan.yaml (смысл: темы по порядку, подтемы, группы, проверки)
// и раскладывает его в courses/<id>/roadmap.yaml (координаты, связи). Дальше можно править руками.
//
// Раскладки:
//   snake    — темы идут рядами по perRow (по умолчанию 3): первый ряд слева направо, следующий справа налево
//              и т.д.; на поворотах — прямые углы. Подтемы — компактной рамкой под своей темой. По умолчанию.
//   straight — все темы в одну колонку по центру, подтемы поровну слева и справа.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';

const Item = z.object({
  id: z.string(),
  title: z.string(),
  links: z.array(z.string()).default([]),
  description: z.string().optional(),
  optional: z.boolean().optional(),
}).strict();
const Res = z.object({ title: z.string(), url: z.string(), kind: z.enum(['article', 'video', 'docs', 'course', 'tool', 'book']).default('article') }).strict();
const Topic = Item.extend({
  section: z.string().optional(),
  resources: z.array(Res).default([]),
  subs: z.array(Item).default([]),
  group: z.string().optional(), // подтемы в рамке с этим заголовком
  checkpoint: Item.optional(), // тёмный узел-проверка под подтемами
  label: z.string().optional(), // подпись рядом с темой
  side: z.enum(['left', 'right']).optional(), // принудительно поставить тему в колонку
}).strict();
const Plan = z.object({
  layout: z.enum(['snake', 'straight']).default('snake'),
  perRow: z.number().int().min(2).max(5).default(3),
  title: z.string().optional(),
  sections: z.array(z.object({ id: z.string(), title: z.string(), color: z.string().optional() }).strict()).default([]),
  topics: z.array(Topic).min(1),
}).strict();
type Topic = z.infer<typeof Topic>;

// Геометрия (px). Узел темы 240×48, подтемы 250×40 с шагом 52.
const G = {
  topicW: 260,
  subW: 250,
  step: 52,
  gapY: 40, // между полосами тем
  snake: { colW: 320, rowGap: 64, boxGap: 22, step: 44, pad: 12 },
  straight: { x: 500, leftSubX: 130, rightSubX: 880 },
};

const course = process.argv[2];
if (!course) {
  console.error('Использование: npm run roadmap:layout -- <course-id>');
  process.exit(1);
}
const dir = path.resolve('courses', course);
const planFile = path.join(dir, 'roadmap.plan.yaml');
const parsed = Plan.safeParse(yaml.load(fs.readFileSync(planFile, 'utf8')));
if (!parsed.success) {
  console.error(`${planFile}:\n` + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}
const plan = parsed.data;

type N = Record<string, unknown> & { id: string; x: number; y: number };
const nodes: N[] = [];
const edges: Record<string, unknown>[] = [];
const topicNode = (t: Topic, x: number, y: number): N => ({
  id: t.id,
  kind: 'topic',
  title: t.title,
  ...(t.section ? { section: t.section } : {}),
  x,
  y,
  w: G.topicW,
  h: 52,
  ...(t.optional ? { optional: true } : {}),
  ...(t.description ? { description: t.description } : {}),
  ...(t.links.length ? { links: t.links } : {}),
  ...(t.resources.length ? { resources: t.resources } : {}),
});

/** Ставит подтемы (и проверку) столбиком с одной стороны; возвращает высоту столбика. */
function placeSubs(t: Topic, side: 'left' | 'right', subX: number, top: number) {
  const items = t.subs;
  const hasGroup = !!t.group && items.length > 0;
  let y = top + (hasGroup ? 40 : 0);
  if (hasGroup) {
    nodes.push({ id: `${t.id}-group`, kind: 'group', title: t.group!, x: subX - 14, y: top, w: G.subW + 28, h: items.length * G.step + 52 });
    edges.push({ from: t.id, to: `${t.id}-group`, fromSide: side, toSide: side === 'left' ? 'right' : 'left', style: 'dotted' });
  }
  for (const s of items) {
    nodes.push({ id: s.id, kind: 'sub', title: s.title, ...(t.section ? { section: t.section } : {}), x: subX, y, w: G.subW, ...(s.optional || t.optional ? { optional: true } : {}), ...(s.description ? { description: s.description } : {}), ...(s.links.length ? { links: s.links } : {}) });
    if (!hasGroup) edges.push({ from: t.id, to: s.id, fromSide: side, toSide: side === 'left' ? 'right' : 'left', style: 'dotted' });
    y += G.step;
  }
  if (hasGroup) y += 12;
  if (t.checkpoint) {
    const cp = t.checkpoint;
    y += 8;
    nodes.push({ id: cp.id, kind: 'checkpoint', title: cp.title, x: subX, y, w: G.subW, ...(cp.description ? { description: cp.description } : {}), ...(cp.links.length ? { links: cp.links } : {}) });
    edges.push({ from: t.id, to: cp.id, fromSide: side, toSide: side === 'left' ? 'right' : 'left', style: 'dotted' });
    y += G.step;
  }
  return y - top;
}

/** Высота рамки подтем под темой (snake). */
const boxHeight = (t: Topic) => {
  const n = t.subs.length + (t.checkpoint ? 1 : 0);
  if (!n) return 0;
  return G.snake.boxGap + (t.group ? 30 : 0) + G.snake.pad * 2 + n * G.snake.step - 8;
};
let rowH = 0;
let prevRowH = 0;

/** Рамка с подтемами (и проверкой) под темой; одна пунктирная связь тема → рамка. */
function placeBox(t: Topic, tx: number, top: number) {
  const n = t.subs.length + (t.checkpoint ? 1 : 0);
  if (!n) return;
  const w = G.topicW;
  const h = boxHeight(t) - G.snake.boxGap;
  const gid = `${t.id}-box`;
  nodes.push({ id: gid, kind: 'group', title: t.group ?? '', x: tx, y: top, w, h, ...(t.optional ? {} : {}) });
  edges.push({ from: t.id, to: gid, fromSide: 'bottom', toSide: 'top', style: 'dotted' });
  let y = top + G.snake.pad + (t.group ? 30 : 0);
  const subW = w - G.snake.pad * 2;
  for (const s of t.subs) {
    nodes.push({ id: s.id, kind: 'sub', title: s.title, ...(t.section ? { section: t.section } : {}), x: tx + G.snake.pad, y, w: subW, h: 36, ...(s.optional || t.optional ? { optional: true } : {}), ...(s.description ? { description: s.description } : {}), ...(s.links.length ? { links: s.links } : {}) });
    y += G.snake.step;
  }
  if (t.checkpoint) {
    const cp = t.checkpoint;
    nodes.push({ id: cp.id, kind: 'checkpoint', title: cp.title, x: tx + G.snake.pad, y, w: subW, h: 36, ...(cp.description ? { description: cp.description } : {}), ...(cp.links.length ? { links: cp.links } : {}) });
  }
}

const subsHeight = (t: Topic, n = t.subs.length) => n * G.step + (t.group && n ? 52 : 0) + (t.checkpoint ? G.step + 8 : 0);

let y = 0;
if (plan.title) {
  nodes.push({ id: 'roadmap-title', kind: 'title', title: plan.title, x: plan.layout === 'snake' ? ((plan.perRow - 1) * G.snake.colW + G.topicW) / 2 - 170 : G.straight.x - 40, y, w: 340 });
  y += 80;
}

let prev: { id: string; side: 'left' | 'right' | 'center' } | null = null;
plan.topics.forEach((t, i) => {
  if (plan.layout === 'straight') {
    const half = Math.ceil(t.subs.length / 2);
    const left = { ...t, subs: t.subs.slice(0, half), checkpoint: undefined, group: undefined };
    const right = { ...t, subs: t.subs.slice(half) };
    const band = Math.max(subsHeight(left), subsHeight(right), 110);
    const ty = y + (band - 48) / 2;
    nodes.push(topicNode(t, G.straight.x, ty));
    placeSubs(left as Topic, 'left', G.straight.leftSubX, y + (band - subsHeight(left)) / 2);
    placeSubs(right as Topic, 'right', G.straight.rightSubX, y + (band - subsHeight(right)) / 2);
    if (prev) edges.push({ from: prev.id, to: t.id, fromSide: 'bottom', toSide: 'top', style: 'solid' });
    prev = { id: t.id, side: 'center' };
    y += band + G.gapY;
    return;
  }
  // snake: ряды по perRow тем, направление ряда чередуется; подтемы — рамка под темой
  const per = plan.perRow;
  const row = Math.floor(i / per);
  const posInRow = i % per;
  const col = row % 2 === 0 ? posInRow : per - 1 - posInRow;
  if (posInRow === 0) {
    // высота ряда — по самой высокой рамке подтем в нём
    const rowTopics = plan.topics.slice(i, i + per);
    rowH = 52 + Math.max(0, ...rowTopics.map((x) => boxHeight(x))) + G.snake.rowGap;
    if (i > 0) y += prevRowH;
    prevRowH = rowH;
  }
  const tx = col * G.snake.colW;
  nodes.push(topicNode(t, tx, y));
  placeBox(t, tx, y + 52 + G.snake.boxGap);
  if (prev) {
    const sameRow = Math.floor((i - 1) / per) === row;
    const dir = row % 2 === 0 ? 1 : -1;
    if (sameRow) edges.push({ from: prev.id, to: t.id, fromSide: dir > 0 ? 'right' : 'left', toSide: dir > 0 ? 'left' : 'right', style: 'solid' });
    // поворот: выходим наружу с той же стороны и заходим в тему следующего ряда с той же стороны (С-образно)
    else edges.push({ from: prev.id, to: t.id, fromSide: col === 0 ? 'left' : 'right', toSide: col === 0 ? 'left' : 'right', style: 'solid' });
  }
  prev = { id: t.id, side: 'center' };
});

const header = `# СГЕНЕРИРОВАНО из roadmap.plan.yaml командой: npm run roadmap:layout -- ${course}
# Можно править руками, но повторная генерация перезапишет файл.
`;
const out = header + yaml.dump({ sections: plan.sections, nodes, edges }, { lineWidth: 140, noRefs: true, flowLevel: 3 });
fs.writeFileSync(path.join(dir, 'roadmap.yaml'), out);
console.log(`courses/${course}/roadmap.yaml: ${nodes.length} узлов, ${edges.length} связей (раскладка ${plan.layout})`);
