import yaml from 'js-yaml';
import { z } from 'zod';

export const ArticleMeta = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().optional(),
}).strict();
export type ArticleMeta = z.infer<typeof ArticleMeta>;

export interface ArticleInfo {
  id: string;
  meta: ArticleMeta;
  file: string;
}

export interface InteractiveSpec {
  id: string;
  module: string;
  props?: Record<string, unknown>;
}

export type ArticleSegment =
  | { kind: 'markdown'; text: string }
  | { kind: 'interactive'; spec: InteractiveSpec; error?: string };

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
      spec = { id: raw.id, module: raw.module, props: (raw.props as Record<string, unknown> | undefined) ?? {} };
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
