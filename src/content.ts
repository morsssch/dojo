// Доступ к контенту курсов в браузере.
import { createContext, useContext } from 'react';
import rawManifest from 'virtual:dojo-manifest';
import type { CourseInfo, LessonInfo, Manifest, ModuleInfo } from './core/manifest';
import { Lesson, parseLesson } from './core/parse';

export const manifest = rawManifest as Manifest;

const lessonFiles = import.meta.glob('/courses/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const cache = new Map<string, Lesson>();

export async function loadLesson(file: string): Promise<Lesson> {
  const hit = cache.get(file);
  if (hit && !import.meta.hot) return hit;
  const loader = lessonFiles[file];
  if (!loader) throw new Error(`Файл урока не найден: ${file}`);
  const lesson = parseLesson(await loader(), file);
  cache.set(file, lesson);
  return lesson;
}

export const findCourse = (id?: string) => manifest.courses.find((c) => c.id === id);

export function findLesson(c: CourseInfo, moduleId?: string, lessonId?: string): { module: ModuleInfo; lesson: LessonInfo } | null {
  const module = c.modules.find((m) => m.id === moduleId);
  const lesson = module?.lessons.find((l) => l.id === lessonId);
  return module && lesson ? { module, lesson } : null;
}

/** Соседние уроки (без черновиков) — для кнопок «дальше/назад». */
export function neighbours(c: CourseInfo, key: string) {
  const all = c.modules.flatMap((m) => m.lessons.filter((l) => !l.meta.draft).map((l) => ({ m, l })));
  const i = all.findIndex((x) => x.l.key === key);
  return { prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null };
}

export const lessonHref = (courseId: string, key: string, step?: number) => `/c/${courseId}/${key}${step ? `/${step + 1}` : ''}`;

export interface LessonCtxValue {
  courseId: string;
  lessonKey: string;
}
export const LessonCtx = createContext<LessonCtxValue>({ courseId: '', lessonKey: '' });
export const useLessonCtx = () => useContext(LessonCtx);
