// Пошаговая анимированная схема: узлы на сетке, «пакеты» летят по стрелкам, подпись к каждому шагу.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimBlock } from '../../core/schema';
import { Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';

const CELL_W = 170;
const CELL_H = 110;
const NODE_W = 132;
const NODE_H = 54;
const PAD = 24;

function NodeShape({ kind, w, h }: { kind: string; w: number; h: number }) {
  if (kind === 'db')
    return (
      <>
        <path className="shape" d={`M${-w / 2},${-h / 2 + 8} v${h - 16} a${w / 2},8 0 0 0 ${w},0 v${-(h - 16)}`} />
        <ellipse cx={0} cy={-h / 2 + 8} rx={w / 2} ry={8} />
      </>
    );
  if (kind === 'actor') return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} />;
  if (kind === 'cloud') return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={22} style={{ strokeDasharray: '5 4' }} />;
  if (kind === 'queue')
    return (
      <>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} />
        {[1, 2, 3].map((i) => (
          <line key={i} x1={-w / 2 + (w / 4) * i} x2={-w / 2 + (w / 4) * i} y1={-h / 2 + 6} y2={h / 2 - 6} stroke="var(--line-2)" />
        ))}
      </>
    );
  if (kind === 'cell') return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} />;
  if (kind === 'note') return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} style={{ fill: 'var(--accent-soft)', stroke: 'transparent' }} />;
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={10} />;
}

export function Anim({ data }: { data: AnimBlock }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(1); // прогресс полёта пакета 0..1
  const raf = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const maxX = Math.max(...data.nodes.map((n) => n.x + (n.w ?? 1) - 1));
  const maxY = Math.max(...data.nodes.map((n) => n.y));
  const W = PAD * 2 + (maxX + 1) * CELL_W;
  const H = PAD * 2 + (maxY + 1) * CELL_H;
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number; w: number }>();
    for (const n of data.nodes) {
      const span = n.w ?? 1;
      m.set(n.id, { x: PAD + n.x * CELL_W + (CELL_W * span) / 2, y: PAD + n.y * CELL_H + CELL_H / 2, w: NODE_W + (span - 1) * CELL_W });
    }
    return m;
  }, [data.nodes]);

  // накопленное состояние к шагу: подписи и видимость узлов
  const state = useMemo(() => {
    const sub: Record<string, string> = {};
    const hidden = new Set<string>();
    for (const n of data.nodes) if (n.sub) sub[n.id] = n.sub;
    // узлы, которые где-то «show», скрыты до этого шага
    for (const s of data.steps) for (const id of s.show ?? []) hidden.add(id);
    for (let i = 0; i <= step; i++) {
      const s = data.steps[i];
      if (!s) break;
      Object.assign(sub, s.set ?? {});
      for (const id of s.show ?? []) hidden.delete(id);
      for (const id of s.hide ?? []) hidden.add(id);
    }
    return { sub, hidden };
  }, [data, step]);

  const cur = data.steps[step];
  const sends = cur?.send ? (Array.isArray(cur.send) ? cur.send : [cur.send]) : [];

  useEffect(() => {
    cancelAnimationFrame(raf.current);
    if (!sends.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(1);
      return;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setT(k);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    setT(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, data]);

  useEffect(() => {
    if (!playing) return;
    if (step >= data.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => s + 1), 2600);
    return () => clearTimeout(id);
  }, [playing, step, data.steps.length]);

  const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const edgePath = (a: string, b: string, bend = 0) => {
    const p = pos.get(a);
    const q = pos.get(b);
    if (!p || !q) return '';
    const mx = (p.x + q.x) / 2 - (q.y - p.y) * bend;
    const my = (p.y + q.y) / 2 + (q.x - p.x) * bend;
    return `M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`;
  };
  const pointOn = (a: string, b: string, k: number, bend: number) => {
    const p = pos.get(a)!;
    const q = pos.get(b)!;
    const mx = (p.x + q.x) / 2 - (q.y - p.y) * bend;
    const my = (p.y + q.y) / 2 + (q.x - p.x) * bend;
    const u = 1 - k;
    return { x: u * u * p.x + 2 * u * k * mx + k * k * q.x, y: u * u * p.y + 2 * u * k * my + k * k * q.y };
  };

  const hl = new Set(cur?.highlight ?? []);
  for (const s of sends) if (t >= 1) hl.add(s.to);

  return (
    <div className="block anim">
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="anim" /> {data.title ?? 'Схема'}
        </span>
        <span className="right muted" style={{ fontSize: 13 }}>
          шаг {step + 1} из {data.steps.length}
        </span>
      </div>
      <div className="anim-stage" ref={stageRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} role="img" aria-label={data.title ?? 'Анимированная схема'}>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="var(--line-2)" />
            </marker>
          </defs>
          {data.edges.map(([a, b, label], i) => {
            if (state.hidden.has(a) || state.hidden.has(b)) return null;
            const p = pos.get(a);
            const q = pos.get(b);
            if (!p || !q) return null;
            return (
              <g key={i}>
                <path className="anim-edge" d={edgePath(a, b)} />
                {label && (
                  <text className="anim-edge-label" x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 6} textAnchor="middle">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          {sends.map((s, i) => (
            <path key={'s' + i} d={edgePath(s.from, s.to, s.from === s.to ? 0 : 0.12)} stroke="var(--accent-strong)" strokeDasharray="4 5" strokeWidth={1.6} fill="none" opacity={0.7} />
          ))}
          {data.nodes.map((n) => {
            const p = pos.get(n.id)!;
            const sub = state.sub[n.id];
            const h = sub ? NODE_H + 8 : NODE_H;
            return (
              <g key={n.id} className={`anim-node${hl.has(n.id) ? ' hl' : ''}${state.hidden.has(n.id) ? ' hidden' : ''}`} transform={`translate(${p.x},${p.y})`}>
                <NodeShape kind={n.kind} w={p.w} h={h} />
                <text textAnchor="middle" y={sub ? -4 : 5}>
                  {n.label}
                </text>
                {sub && (
                  <text className="sub" textAnchor="middle" y={15}>
                    {sub.length > 26 ? sub.slice(0, 25) + '…' : sub}
                  </text>
                )}
              </g>
            );
          })}
          {t < 1 &&
            sends.map((s, i) => {
              if (!pos.get(s.from) || !pos.get(s.to)) return null;
              const pt = pointOn(s.from, s.to, ease(t), 0.12);
              const label = s.label ?? '';
              const w = Math.max(18, label.length * 7 + 14);
              return (
                <g key={'p' + i} className="anim-packet" transform={`translate(${pt.x},${pt.y})`}>
                  <rect x={-w / 2} y={-11} width={w} height={22} rx={11} style={s.color ? { fill: s.color } : undefined} />
                  <text textAnchor="middle" y={4}>
                    {label}
                  </text>
                </g>
              );
            })}
          {t >= 1 &&
            sends.map((s, i) => {
              const q = pos.get(s.to);
              if (!q || !s.label) return null;
              return (
                <text key={'l' + i} className="anim-edge-label" x={q.x} y={q.y - NODE_H / 2 - 10} textAnchor="middle" style={{ fill: 'var(--accent-strong)', fontWeight: 600 }}>
                  ← {s.label}
                </text>
              );
            })}
        </svg>
      </div>
      <div className="anim-caption" aria-live="polite">
        {cur && <Markdown text={cur.text} />}
      </div>
      <div className="anim-controls">
        <button className="icon-btn" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} aria-label="Предыдущий шаг">
          <I.prev />
        </button>
        <button className="icon-btn" onClick={() => (step >= data.steps.length - 1 ? (setStep(0), setPlaying(true)) : setPlaying((p) => !p))} aria-label={playing ? 'Пауза' : 'Проиграть'}>
          {playing ? <I.pause /> : <I.play />}
        </button>
        <div className="anim-dots">
          {data.steps.map((_, i) => (
            <button key={i} className={i === step ? 'on' : ''} onClick={() => setStep(i)} aria-label={`Шаг ${i + 1}`} />
          ))}
        </div>
        <button className="btn small primary" onClick={() => setStep((s) => Math.min(data.steps.length - 1, s + 1))} disabled={step >= data.steps.length - 1}>
          Дальше <I.next width={14} height={14} />
        </button>
      </div>
    </div>
  );
}
