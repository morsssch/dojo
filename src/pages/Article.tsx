import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { InteractiveFrame } from '../components/InteractiveFrame';
import { Markdown } from '../components/Markdown';
import { findArticle, loadArticle } from '../content';
import type { ArticleSegment } from '../core/articles';

export function ArticlePage() {
  const { article } = useParams();
  const info = findArticle(article);
  const [state, setState] = useState<{ segments: ArticleSegment[]; errors: string[] }>();
  useEffect(() => {
    if (!info) return;
    setState(undefined);
    loadArticle(info).then(setState);
  }, [info]);

  if (!info) return <main className="page empty"><h1 className="display">Статья не найдена</h1><Link className="btn primary" to="/">На главную</Link></main>;
  return (
    <main className="page article-page">
      <Link className="back-link" to="/">← Все материалы</Link>
      <header className="article-head">
        <span className="eyebrow">Статья</span>
        <h1 className="display">{info.meta.title}</h1>
        {info.meta.subtitle && <p className="article-lede">{info.meta.subtitle}</p>}
        {info.meta.tags.length > 0 && <div className="tag-list">{info.meta.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
      </header>
      {!state ? <p className="muted">Загружаю материал…</p> : (
        <div className="article-body">
          {state.errors.length > 0 && import.meta.env.DEV && <div className="errors">{state.errors.join('\n')}</div>}
          {state.segments.map((segment, index) => segment.kind === 'markdown'
            ? <Markdown key={index} text={segment.text} />
            : segment.error
              ? <div className="interactive-error" key={index}>{segment.error}</div>
              : <InteractiveFrame key={segment.spec.id} articleId={info.id} spec={segment.spec} />)}
        </div>
      )}
    </main>
  );
}
