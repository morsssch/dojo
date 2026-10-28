import { useEffect, useMemo, useRef, useState } from 'react';
import type { InteractiveSpec } from '../core/articles';

const moduleUrls = import.meta.glob('/articles/**/interactive/*.ts', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

function moduleUrl(articleId: string, module: string) {
  const path = `/articles/${articleId}/${module.replace(/^\.\//, '')}`;
  return moduleUrls[path];
}

function frameHtml(url: string) {
  const safeUrl = JSON.stringify(url);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;color:#20242b;font:14px/1.5 system-ui,sans-serif}#app{padding:16px}@media(prefers-color-scheme:dark){html,body{background:#161a21;color:#e5e7eb}}</style></head><body><main id="app" aria-live="polite"></main><script>window.__dojoInteractive=true;</script><script type="module" src=${safeUrl}></script></body></html>`;
}

export function InteractiveFrame({ articleId, spec }: { articleId: string; spec: InteractiveSpec }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(260);
  const url = useMemo(() => moduleUrl(articleId, spec.module), [articleId, spec.module]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || event.data?.type !== 'dojo:resize') return;
      const next = Number(event.data.height);
      if (Number.isFinite(next)) setHeight(Math.max(120, Math.min(next + 32, 1200)));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const frame = ref.current;
    if (!frame || !url) return;
    const send = () => frame.contentWindow?.postMessage({ type: 'dojo:init', id: spec.id, props: spec.props ?? {} }, '*');
    frame.addEventListener('load', send);
    return () => frame.removeEventListener('load', send);
  }, [spec.id, spec.props, url]);

  if (!url) return <div className="interactive-error">Интерактивный модуль не найден: <code>{spec.module}</code></div>;
  return (
    <div className="interactive-frame" data-interactive={spec.id}>
      <iframe ref={ref} title={spec.id} sandbox="allow-scripts" srcDoc={frameHtml(url)} style={{ height }} />
    </div>
  );
}
