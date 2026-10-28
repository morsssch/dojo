// Доступ к контенту курсов в браузере.
import { createContext, useContext } from 'react';
import rawManifest from 'virtual:dojo-manifest';
import type { CourseInfo, LessonInfo, Manifest, ModuleInfo } from './core/manifest';
import { Lesson, parseLesson } from './core/parse';
import { ArticleInfo, parseArticleMeta, parseArticleSegments } from './core/articles';
import { syncLogin } from './state/sync';

const articleMetaFiles = import.meta.glob('/articles/**/article.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const articleFiles = import.meta.glob('/articles/**/index.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

export const articles: ArticleInfo[] = Object.entries(articleMetaFiles).flatMap(([file, text]) => {
  const parsed = parseArticleMeta(text, file);
  if (!parsed.meta) return [];
  const id = file.match(/^\/articles\/([^/]+)\//)?.[1];
  return id ? [{ id, meta: parsed.meta, file: `/articles/${id}/index.md` }] : [];
}).sort((a, b) => a.meta.title.localeCompare(b.meta.title));

export const findArticle = (id?: string) => articles.find((a) => a.id === id);

export async function loadArticle(article: ArticleInfo) {
  const loader = articleFiles[article.file];
  if (!loader) return { segments: [], errors: [`Файл статьи не найден: ${article.file}`] };
  return parseArticleSegments(await loader(), article.file);
}

export interface ArticleContextValue { articleId: string }
export const ArticleCtx = createContext<ArticleContextValue>({ articleId: '' });
export const useArticleCtx = () => useContext(ArticleCtx);


const all = rawManifest as Manifest;

/** Курс с owners виден только тому, кто вошёл синхронизацией под одним из этих логинов (в dev видно всё). */
export const courseVisible = (c: CourseInfo) => {
  if (!c.meta.owners?.length || import.meta.env.DEV) return true;
  const login = syncLogin()?.toLowerCase();
  return !!login && c.meta.owners.some((o) => o.toLowerCase() === login);
};

/** Манифест с учётом видимости: courses пересчитывается при каждом обращении (вход и выход меняют список). */
export const manifest: Manifest = {
  get courses() {
    return all.courses.filter(courseVisible);
  },
  errors: all.errors,
};

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
  /** перейти к следующему шагу/уроку (кнопка «Дальше» в полноэкранном режиме) */
  next?: { label: string; go: () => void };
  /** разобранный урок: нужен блокам, которые смотрят на соседей (этапы лабы) */
  lesson?: Lesson;
}
export const LessonCtx = createContext<LessonCtxValue>({ courseId: '', lessonKey: '' });
export const useLessonCtx = () => useContext(LessonCtx);
