import { useEffect, useMemo, useRef, useState } from 'react';
import type { InteractiveSpec } from '../core/articles';

const moduleUrls = import.meta.glob('/articles/**/interactive/*.ts', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

function moduleUrl(articleId: string, module: string) {
  const path = `/articles/${articleId}/${module.replace(/^\.\//, '')}`;
  return moduleUrls[path];
}

function frameHtml(url: string) {
  const safeUrl = JSON.stringify(url);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;color:#20242b;font:14px/1.5 system-ui,sans-serif}#app{padding:16px}.simplex-demo{display:grid;gap:14px}.demo-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.eyebrow{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#68707d}.simplex-demo h2{font-size:19px;margin:3px 0 0}.demo-actions{display:flex;gap:6px}.demo-actions button,.demo-dots button{font:inherit;border:1px solid #c7ccd4;border-radius:6px;background:transparent;padding:6px 10px;cursor:pointer}.demo-actions button:disabled{opacity:.4;cursor:default}.table-wrap{overflow:auto}.simplex-demo table{border-collapse:collapse;font-family:ui-monospace,monospace;font-size:13px;min-width:520px}.simplex-demo th,.simplex-demo td{border:1px solid #c7ccd4;padding:8px 11px;text-align:center}.simplex-demo th{font-weight:600;background:#f1f3f5}.simplex-demo .rhs{font-weight:600}.simplex-demo .objective th,.simplex-demo .objective td{border-top:2px solid #20242b}.demo-note{margin:0;padding:10px 12px;border-left:3px solid #536dca;background:#edf1ff}.demo-dots{display:flex;gap:6px}.demo-dots button{width:9px;height:9px;padding:0;border-radius:50%;background:#c7ccd4}.demo-dots button.on{background:#20242b}@media(prefers-color-scheme:dark){html,body{background:#161a21;color:#e5e7eb}.simplex-demo th{background:#232a35}.simplex-demo th,.simplex-demo td{border-color:#4a5362}.demo-note{background:#222c43}.demo-dots button{background:#4a5362}.demo-dots button.on{background:#e5e7eb}}</style></head><body><main id="app" aria-live="polite"></main><script>window.__dojoInteractive=true;</script><script type="module" src=${safeUrl}></script></body></html>`;
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
    const timer = window.setTimeout(send, 100);
    return () => {
      frame.removeEventListener('load', send);
      window.clearTimeout(timer);
    };
  }, [spec.id, spec.props, url]);

  if (!url) return <div className="interactive-error">Интерактивный модуль не найден: <code>{spec.module}</code></div>;
  return (
    <div className="interactive-frame" data-interactive={spec.id}>
      <iframe ref={ref} title={spec.id} sandbox="allow-scripts" srcDoc={frameHtml(url)} style={{ height }} />
    </div>
  );
}
