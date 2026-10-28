// Markdown для теории: GFM, подсветка кода, выноски > [!NOTE] / [!TIP] / [!WARNING] / [!DANGER] / [!DEEP].
import { Children, isValidElement, memo, ReactNode } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/core';
import go from 'highlight.js/lib/languages/go';
import sql from 'highlight.js/lib/languages/sql';
import js from 'highlight.js/lib/languages/javascript';
import ts from 'highlight.js/lib/languages/typescript';
import py from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import docker from 'highlight.js/lib/languages/dockerfile';
import http from 'highlight.js/lib/languages/http';
import xml from 'highlight.js/lib/languages/xml';
import diff from 'highlight.js/lib/languages/diff';
import kotlin from 'highlight.js/lib/languages/kotlin';
import nginx from 'highlight.js/lib/languages/nginx';
import protobuf from 'highlight.js/lib/languages/protobuf';
import csharp from 'highlight.js/lib/languages/csharp';
import { I } from './ui/icons';
import { Link } from 'react-router-dom';
import { findCourse, lessonHref, useLessonCtx } from '../content';

/** Ссылка на урок курса: lesson:module/lesson или lesson:module/lesson#3 (номер шага). */
function LessonLink({ to, children }: { to: string; children: ReactNode }) {
  const { courseId } = useLessonCtx();
  const [path, step] = to.split('#');
  const c = findCourse(courseId);
  const [m, l] = path.split('/');
  const mod = c?.modules.find((x) => x.id === m);
  const lesson = l ? mod?.lessons.find((x) => x.id === l) : mod?.lessons[0];
  if (!c || !lesson) return <span title={`Нет урока ${to}`}>{children}</span>;
  return (
    <Link to={lessonHref(c.id, lesson.key, step ? Number(step) - 1 : undefined)} className="lesson-ref" title={lesson.meta.title}>
      {children}
    </Link>
  );
}

hljs.registerLanguage('go', go);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('javascript', js);
hljs.registerLanguage('typescript', ts);
hljs.registerLanguage('python', py);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('dockerfile', docker);
hljs.registerLanguage('http', http);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('nginx', nginx);
hljs.registerLanguage('protobuf', protobuf);
hljs.registerLanguage('csharp', csharp);
const ALIAS: Record<string, string> = { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'bash', console: 'bash', golang: 'go', cs: 'csharp', 'c#': 'csharp', yml: 'yaml', html: 'xml', proto: 'protobuf' };

export function highlight(code: string, lang?: string): string {
  const l = lang ? (ALIAS[lang] ?? lang) : undefined;
  if (l && hljs.getLanguage(l)) return hljs.highlight(code, { language: l }).value;
  return code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

const CALLOUTS: Record<string, { cls: string; title: string; icon: ReactNode }> = {
  NOTE: { cls: 'note', title: 'Заметка', icon: <I.book /> },
  TIP: { cls: 'tip', title: 'Совет', icon: <I.bulb /> },
  IMPORTANT: { cls: 'warning', title: 'Важно', icon: <I.flame /> },
  WARNING: { cls: 'warning', title: 'Осторожно', icon: <I.flame /> },
  CAUTION: { cls: 'danger', title: 'Опасно', icon: <I.x /> },
  DANGER: { cls: 'danger', title: 'Опасно', icon: <I.x /> },
  DEEP: { cls: 'deep', title: 'Под капотом', icon: <I.settings /> },
};

function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

const components: Components = {
  pre({ children }) {
    const child = Children.toArray(children)[0];
    if (isValidElement(child)) {
      const props = child.props as { className?: string; children?: ReactNode };
      const lang = props.className?.replace('language-', '');
      const code = textOf(props.children).replace(/\n$/, '');
      return (
        <pre>
          <code className={`hljs${lang ? ` language-${lang}` : ''}`} dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} />
        </pre>
      );
    }
    return <pre>{children}</pre>;
  },
  blockquote({ children }) {
    const arr = Children.toArray(children).filter((c) => !(typeof c === 'string' && !c.trim()));
    const first = arr[0];
    if (isValidElement(first)) {
      const kids = Children.toArray((first.props as { children?: ReactNode }).children);
      const head = typeof kids[0] === 'string' ? (kids[0] as string) : '';
      const m = head.match(/^\[!(\w+)\]([^\n]*)\n?/);
      if (m && CALLOUTS[m[1].toUpperCase()]) {
        const c = CALLOUTS[m[1].toUpperCase()];
        const title = m[2].trim() || c.title;
        const restFirst = [head.slice(m[0].length), ...kids.slice(1)];
        const body = (
          <div className="md">
            {restFirst.some((k) => textOf(k as ReactNode).trim()) && <p>{restFirst}</p>}
            {arr.slice(1)}
          </div>
        );
        if (c.cls === 'deep')
          return (
            <details className="callout deep">
              <summary>
                {c.icon} {title}
                <span className="hint">развернуть</span>
              </summary>
              <div className="body">{body}</div>
            </details>
          );
        return (
          <div className={`callout ${c.cls}`}>
            <div className="ct">
              {c.icon} {title}
            </div>
            {body}
          </div>
        );
      }
    }
    return <blockquote>{children}</blockquote>;
  },
  a({ href, children }) {
    if (href?.startsWith('lesson:')) return <LessonLink to={href.slice(7)}>{children}</LessonLink>;
    const external = href && /^https?:/.test(href);
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
        {children}
      </a>
    );
  },
  table({ children }) {
    return <table>{children}</table>;
  },
};

export const Markdown = memo(function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`md ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

/** Однострочный markdown (вопросы, варианты ответов) */
export function MdInline({ text }: { text: string }) {
  return <Markdown text={text} />;
}
