import { useEffect, useId, useState } from 'react';

let mermaidP: Promise<typeof import('mermaid').default> | null = null;

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function Mermaid({ code }: { code: string }) {
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    mermaidP ??= import('mermaid').then((m) => m.default);
    mermaidP
      .then(async (m) => {
        m.initialize({ startOnLoad: false, theme: isDark() ? 'dark' : 'neutral', fontFamily: 'IBM Plex Sans, sans-serif', securityLevel: 'strict' });
        const r = await m.render(`m${id}`, code);
        if (alive) setSvg(r.svg);
      })
      .catch((e) => alive && setErr(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [code, id]);
  if (err) return <div className="block-error">Ошибка в mermaid-диаграмме: {err}</div>;
  return <div className="mermaid-box" dangerouslySetInnerHTML={{ __html: svg || '<span class="spinner"></span>' }} />;
}
