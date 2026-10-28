// Скрипты статей: модуль из папки статьи экспортирует mount(root, ctx) и работает прямо на странице (без iframe).
// Модули собирает Vite (TS компилируется, работают import), стили статьи подключаются только на её странице.
import { preloadMath, tex, typeset } from './math';

export interface ArticleCtx {
  /** Корень статьи: ищи свои места крепления через root.querySelector, а не через document. */
  root: HTMLElement;
  /** Отрисовать формулы \( \) \[ \] $$ $$ внутри элемента — после того как вставил в него HTML. */
  typeset: (el: Element | null | undefined) => Promise<void>;
  /** Одна формула в элемент (inline или display). */
  tex: (el: HTMLElement, src: string, display?: boolean) => void;
  /** Ученик просил меньше анимации (системная настройка). */
  reducedMotion: boolean;
  /** Своё хранилище статьи (localStorage с префиксом). */
  store: { get<T>(key: string, fallback: T): T; set(key: string, value: unknown): void };
  /** Подписаться на событие так, чтобы подписка снялась при уходе со страницы. */
  on: (target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => void;
  /** Выполнить при уходе со страницы. */
  onCleanup: (fn: () => void) => void;
}

export type ArticleMount = (root: HTMLElement, ctx: ArticleCtx) => void | (() => void) | Promise<void | (() => void)>;
/** Для блока ```interactive: el — место блока, props — из YAML. */
export type BlockMount = (el: HTMLElement, props: Record<string, unknown>, ctx: ArticleCtx) => void | (() => void);

export function createCtx(articleId: string, root: HTMLElement): { ctx: ArticleCtx; dispose: () => void } {
  const cleanups: (() => void)[] = [];
  const prefix = `dojo:article:${articleId}:`;
  preloadMath();
  const ctx: ArticleCtx = {
    root,
    typeset,
    tex,
    reducedMotion: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    store: {
      get(key, fallback) {
        try {
          const v = localStorage.getItem(prefix + key);
          return v === null ? fallback : JSON.parse(v);
        } catch {
          return fallback;
        }
      },
      set(key, value) {
        try {
          localStorage.setItem(prefix + key, JSON.stringify(value));
        } catch {
          /* ignore */
        }
      },
    },
    on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    },
    onCleanup: (fn) => void cleanups.push(fn),
  };
  return { ctx, dispose: () => cleanups.splice(0).reverse().forEach((f) => f()) };
}

/**
 * CSS статьи действует только внутри её страницы: правила оборачиваются в [data-article="id"] (вложенный CSS),
 * а @keyframes / @font-face / @property остаются на верхнем уровне.
 */
export function scopeCss(css: string, articleId: string): string {
  const top: string[] = [];
  const body = css.replace(/@(keyframes|font-face|property)\b[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, (m) => {
    top.push(m);
    return '';
  });
  // :root / html / body из артефакта → сама статья
  const scoped = body.replace(/(^|[},;\s])(:root|html|body)(?=[\s{,.:#\[])/g, '$1&');
  return `${top.join('\n')}\n[data-article="${articleId}"] {\n${scoped}\n}`;
}
