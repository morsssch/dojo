// Лаба по этапам: шаблон программы с вставками {{part}} собирается из кода этапов.
// Не зависит от браузера: используется и сайтом, и tools/check.ts.
import type { Lesson } from './parse';
import type { LabBlock, TaskBlock } from './schema';

export interface LabStage {
  id: string; // id блока task
  part: string;
  task: TaskBlock;
  step: number; // номер шага урока
}

/** Имена вставок в шаблоне по порядку появления. */
export const labParts = (lab: LabBlock) => [...new Set([...lab.template.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)].map((m) => m[1]))];

/** Блок lab по id в уроке. */
export function findLab(lesson: Lesson | undefined, id: string): LabBlock | undefined {
  for (const s of lesson?.steps ?? []) for (const g of s.segments) if (g.kind === 'block' && g.type === 'lab' && g.data?.id === id) return g.data as LabBlock;
  return undefined;
}

/** Задачи-этапы лабы в порядке урока. */
export function labStages(lesson: Lesson | undefined, labId: string): LabStage[] {
  const out: LabStage[] = [];
  for (const s of lesson?.steps ?? [])
    for (const g of s.segments)
      if (g.kind === 'block' && g.type === 'task' && g.data?.lab === labId && g.data.part)
        out.push({ id: g.id, part: g.data.part, task: g.data, step: s.index });
  return out;
}

/**
 * Подставляет код этапов в шаблон. Вставка, стоящая одна на строке, получает отступ этой строки.
 * Нет кода для вставки — берётся заглушка из stubs, нет и её — пусто.
 */
export function assembleLab(lab: LabBlock, parts: Record<string, string | undefined>): string {
  const pick = (name: string) => (parts[name] ?? lab.stubs[name] ?? '').replace(/\s+$/, '');
  return lab.template
    .replace(/^([ \t]*)\{\{\s*([\w-]+)\s*\}\}[ \t]*$/gm, (_, ind: string, name: string) =>
      pick(name)
        .split('\n')
        .map((l) => (l ? ind + l : l))
        .join('\n'),
    )
    .replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, name: string) => pick(name));
}

/**
 * Код для проверки этапа: этот этап — текущий код, предыдущие — `earlier(stage)` (черновик ученика или эталон),
 * последующие — заглушки.
 */
export function assembleStage(lab: LabBlock, stages: LabStage[], stageId: string, code: string, earlier: (s: LabStage) => string | undefined) {
  const idx = stages.findIndex((s) => s.id === stageId);
  const parts: Record<string, string | undefined> = {};
  stages.forEach((s, i) => {
    if (i < idx) parts[s.part] = earlier(s);
  });
  parts[stages[idx]?.part ?? ''] = code;
  return assembleLab(lab, parts);
}

/** Задача «проверить всю программу» для общего проверяльщика. */
export const labAsTask = (lab: LabBlock): TaskBlock => ({
  lang: lab.lang,
  starter: '',
  solution: '',
  harness: lab.harness,
  tests: lab.tests,
});
