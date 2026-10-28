import yaml from 'js-yaml';
import { z } from 'zod';

export const ArticleMeta = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().optional(),
  // скрипт статьи: модуль с export function mount(root, ctx) — оживляет места крепления в теле статьи
  script: z.string().optional(),
  // стили статьи (только токены Dojo: var(--text), var(--accent), …); действуют только на её странице
  style: z.string().optional(),
  // ширина колонки: обычная (как у текста) или широкая — для таблиц и схем рядом с графиками
  width: z.enum(['text', 'wide']).default('text'),
}).strict();
export type ArticleMeta = z.infer<typeof ArticleMeta>;

export interface ArticleInfo {
  id: string;
  meta: ArticleMeta;
  /** index.md (Markdown, можно с HTML и $формулами$) или index.html (готовая разметка, например из артефакта) */
  file: string;
  format: 'md' | 'html';
}

export interface InteractiveSpec {
  id: string;
  module: string;
  /** какую функцию модуля вызвать: (el, props, ctx) => …; по умолчанию mount */
  export?: string;
  props?: Record<string, unknown>;
}

export type ArticleSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'html'; html: string }
  | { kind: 'interactive'; spec: InteractiveSpec; error?: string };

/** Путь к файлу статьи из относительного ("./interactive/x.ts") */
export const articlePath = (articleId: string, rel: string) => `/articles/${articleId}/${rel.replace(/^\.\//, '')}`;

export function parseArticleMeta(text: string, where: string): { meta?: ArticleMeta; error?: string } {
  try {
    const raw = yaml.load(text) ?? {};
    const result = ArticleMeta.safeParse(raw);
    return result.success ? { meta: result.data } : { error: `${where}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
  } catch (error) {
    return { error: `${where}: YAML не парсится — ${(error as Error).message}` };
  }
}

export function parseArticleSegments(text: string, where: string): { segments: ArticleSegment[]; errors: string[] } {
  const segments: ArticleSegment[] = [];
  const errors: string[] = [];
  const re = /^```interactive\s*\n([\s\S]*?)^```\s*$/gm;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) segments.push({ kind: 'markdown', text: text.slice(last, match.index) });
    let spec: InteractiveSpec | undefined;
    try {
      const raw = yaml.load(match[1]) as Record<string, unknown>;
      if (typeof raw?.id !== 'string' || typeof raw?.module !== 'string') throw new Error('нужны поля id и module');
      spec = { id: raw.id, module: raw.module, export: typeof raw.export === 'string' ? raw.export : undefined, props: (raw.props as Record<string, unknown> | undefined) ?? {} };
    } catch (error) {
      const message = `${where}: интерактивный блок не разобран — ${(error as Error).message}`;
      errors.push(message);
      segments.push({ kind: 'interactive', spec: { id: `invalid-${match.index}`, module: '' }, error: message });
    }
    if (spec) segments.push({ kind: 'interactive', spec });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'markdown', text: text.slice(last) });
  if (!segments.length) segments.push({ kind: 'markdown', text });
  return { segments, errors };
}
