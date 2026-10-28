import { memo, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Markdown } from '../components/Markdown';
import { articleModules, articleStyles, findArticle, loadArticle } from '../content';
import { articlePath, type ArticleInfo, type ArticleSegment } from '../core/articles';
import { createCtx, scopeCss, type ArticleMount, type BlockMount } from '../articles/runtime';
import { typeset } from '../articles/math';

type Loaded = { id: string; segments: ArticleSegment[]; errors: string[] };

/** Тело статьи рисуется один раз: дальше его DOM принадлежит скрипту статьи, React его не трогает. */
const ArticleBody = memo(function ArticleBody({ segments }: { segments: ArticleSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.kind === 'markdown' ? (
          <Markdown key={i} text={s.text} rich />
        ) : s.kind === 'html' ? (
          <div key={i} className="md article-html" dangerouslySetInnerHTML={{ __html: s.html }} />
        ) : s.error ? (
          <div className="interactive-error" key={i}>
            {s.error}
          </div>
        ) : (
          <div key={i} className="ix-block" data-ix={i} />
        ),
      )}
    </>
  );
});

function useArticleRuntime(info: ArticleInfo | undefined, state: Loaded | undefined, root: React.RefObject<HTMLDivElement | null>) {
  const [error, setError] = useState<string>();
  useEffect(() => {
    const el = root.current;
    if (!info || !state || !el) return;
    let alive = true;
    const { ctx, dispose } = createCtx(info.id, el);
    const fail = (where: string, e: unknown) => {
      console.error(e);
      if (alive) setError(`${where}: ${(e as Error)?.message ?? e}`);
    };
    const load = async (rel: string) => {
      const loader = articleModules[articlePath(info.id, rel)];
      if (!loader) throw new Error(`нет файла ${rel}`);
      return loader();
    };
    // якоря #раздел внутри статьи: у сайта hash-роутинг, поэтому прокручиваем сами, а не меняем адрес
    ctx.on(el, 'click', (e) => {
      const a = (e.target as Element).closest?.('a[href^="#"]');
      if (!a || !el.contains(a)) return;
      const target = el.querySelector(`#${CSS.escape(a.getAttribute('href')!.slice(1))}`);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: ctx.reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
    (async () => {
      await typeset(el);
      // блоки ```interactive
      const blocks = state.segments.flatMap((s, i) => (s.kind === 'interactive' && !s.error ? [{ s, i }] : []));
      for (const { s, i } of blocks) {
        const spec = (s as Extract<ArticleSegment, { kind: 'interactive' }>).spec;
        const host = el.querySelector<HTMLElement>(`.ix-block[data-ix="${i}"]`);
        try {
          const mod = await load(spec.module);
          if (!alive || !host) return;
          const fn = mod[spec.export ?? 'mount'] as BlockMount | undefined;
          if (typeof fn !== 'function') throw new Error(`в ${spec.module} нет функции ${spec.export ?? 'mount'}`);
          host.dataset.interactive = spec.id;
          const off = fn(host, spec.props ?? {}, ctx);
          if (typeof off === 'function') ctx.onCleanup(off);
        } catch (e) {
          fail(`Интерактив ${spec.id}`, e);
        }
      }
      // скрипт всей статьи
      if (info.meta.script) {
        try {
          const mod = await load(info.meta.script);
          if (!alive) return;
          const mount = mod.mount as ArticleMount | undefined;
          if (typeof mount !== 'function') throw new Error(`в ${info.meta.script} нет export function mount(root, ctx)`);
          const off = await mount(el, ctx);
          if (typeof off === 'function') ctx.onCleanup(off);
        } catch (e) {
          fail('Скрипт статьи', e);
        }
      }
      await typeset(el);
    })();
    return () => {
      alive = false;
      dispose();
    };
  }, [info, state, root]);
  return error;
}

/** Стили статьи: подключаются на время показа страницы и действуют только внутри неё. */
function useArticleStyle(info: ArticleInfo | undefined) {
  const [ready, setReady] = useState(!info?.meta.style);
  useEffect(() => {
    if (!info?.meta.style) return setReady(true);
    setReady(false);
    const loader = articleStyles[articlePath(info.id, info.meta.style)];
    let tag: HTMLStyleElement | null = null;
    let alive = true;
    (loader ? loader() : Promise.resolve('')).then((css) => {
      if (!alive) return;
      tag = document.createElement('style');
      tag.dataset.article = info.id;
      tag.textContent = scopeCss(css, info.id);
      document.head.appendChild(tag);
      setReady(true);
    });
    return () => {
      alive = false;
      tag?.remove();
    };
  }, [info]);
  return ready;
}

export function ArticlePage() {
  const { article } = useParams();
  const info = findArticle(article);
  const [state, setState] = useState<Loaded>();
  const root = useRef<HTMLDivElement>(null);
  const styled = useArticleStyle(info);
  useEffect(() => {
    if (!info) return;
    setState(undefined);
    loadArticle(info).then((r) => setState({ id: info.id, ...r }));
  }, [info]);
  // содержимое прошлой статьи не должно попасть в рантайм новой, пока грузится её текст
  const current = state?.id === info?.id ? state : undefined;
  const runtimeError = useArticleRuntime(info, styled ? current : undefined, root);

  if (!info)
    return (
      <main className="page empty">
        <h1 className="display">Статья не найдена</h1>
        <Link className="btn primary" to="/">
          На главную
        </Link>
      </main>
    );
  return (
    <main className={`page article-page${info.meta.width === 'wide' ? ' wide' : ''}`}>
      <Link className="back-link" to="/">
        ← Все материалы
      </Link>
      <header className="article-head">
        <h1 className="display">{info.meta.title}</h1>
        {info.meta.subtitle && <p className="article-lede">{info.meta.subtitle}</p>}
        {info.meta.tags.length > 0 && (
          <div className="tag-list">
            {info.meta.tags.map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>
      {!current || !styled ? (
        <p className="muted">Загружаю материал…</p>
      ) : (
        <div className="article-body" data-article={info.id} ref={root}>
          {current.errors.length > 0 && import.meta.env.DEV && <div className="errors">{current.errors.join('\n')}</div>}
          {runtimeError && <div className="interactive-error">{runtimeError}</div>}
          <ArticleBody segments={current.segments} />
        </div>
      )}
    </main>
  );
}
