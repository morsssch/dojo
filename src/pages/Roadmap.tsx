// Роадмап курса в духе roadmap.sh: узлы расставлены автором вручную, линии ортогональные,
// узел короткий, а по клику открывается панель с подробностями, уроками и ресурсами.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Background,
  BaseEdge,
  Controls,
  Edge,
  EdgeProps,
  getSmoothStepPath,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlow,
  useNodesState,
} from '@xyflow/react';
import { findCourse, lessonHref } from '../content';
import { edgeEnds, nodeBox, type CourseInfo, type LessonInfo } from '../core/manifest';
import type { RoadmapEdge, RoadmapNode } from '../core/schema';
import { courseStatus, lessonStatus, progress, ProgressState, RoadmapMark, useProgress } from '../state/progress';
import { Markdown } from '../components/Markdown';
import { I } from '../components/ui/icons';
import { LessonDot } from './Course';

type Side = 'top' | 'right' | 'bottom' | 'left';
const POS: Record<Side, Position> = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left };
const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

type RmData = {
  node: RoadmapNode;
  section?: { title: string; color?: string };
  pct: number;
  done: boolean;
  mark?: RoadmapMark;
  selected: boolean;
  w: number;
  h: number;
};

export function linkedLessons(c: CourseInfo, links: string[]): LessonInfo[] {
  const out: LessonInfo[] = [];
  for (const link of links) {
    const [m, l] = link.split('/');
    const mod = c.modules.find((x) => x.id === m);
    if (!mod) continue;
    for (const x of mod.lessons) if ((!l || x.id === l) && !out.includes(x)) out.push(x);
  }
  return out;
}

function nodeProgress(p: ProgressState, c: CourseInfo, n: RoadmapNode) {
  const ls = linkedLessons(c, n.links).filter((l) => !l.meta.draft);
  const mark = p.marks?.[c.id]?.[n.id];
  if (!ls.length) return { pct: mark === 'done' ? 1 : 0, done: mark === 'done', empty: true };
  const st = ls.map((l) => lessonStatus(p, c.id, l));
  const done = mark === 'done' || st.every((s) => s.done);
  return { pct: done ? 1 : st.reduce((a, s) => a + s.pct, 0) / st.length, done, empty: false };
}

// ---------- узел ----------

function RmNode({ data }: NodeProps<Node<RmData>>) {
  const { node: n, w, h, mark, done } = data;
  const status = done ? 'done' : mark === 'skip' ? 'skip' : mark === 'learning' || data.pct > 0 ? 'learning' : '';
  const handles = SIDES.map((s) => (
    <span key={s}>
      <Handle id={`s-${s}`} type="source" position={POS[s]} className="rm-handle" />
      <Handle id={`t-${s}`} type="target" position={POS[s]} className="rm-handle" />
    </span>
  ));
  if (n.kind === 'label')
    return (
      <div className="rm-label" style={{ width: w, minHeight: h }}>
        {handles}
        {n.title}
      </div>
    );
  if (n.kind === 'title')
    return (
      <div className="rm-title" style={{ width: w, minHeight: h }}>
        {handles}
        {n.title}
      </div>
    );
  if (n.kind === 'note')
    return (
      <div className="rm-note" style={{ width: w, minHeight: h }}>
        {handles}
        <Markdown text={n.description ?? n.title} />
      </div>
    );
  return (
    <div
      className={`rm-node k-${n.kind}${status ? ` st-${status}` : ''}${data.selected ? ' selected' : ''}${n.optional ? ' optional' : ''}`}
      style={{ width: w, minHeight: h, ['--sec' as string]: data.section?.color }}
      title={n.title}
    >
      {handles}
      <span className="rm-t">{n.title}</span>
      {status === 'done' && <I.check className="rm-st" width={15} height={15} strokeWidth={3} />}
      {status === 'learning' && <span className="rm-st dot" aria-label="в процессе" />}
      {n.kind !== 'checkpoint' && data.pct > 0 && data.pct < 1 && (
        <span className="rm-bar">
          <i style={{ width: `${data.pct * 100}%` }} />
        </span>
      )}
    </div>
  );
}

// ---------- связь ----------

type EdgeData = { via?: [number, number][]; style: 'solid' | 'dashed' | 'dotted'; done: boolean };

function RouteEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<Edge<EdgeData>>) {
  let path: string;
  if (data?.via?.length) {
    const pts: [number, number][] = [[sourceX, sourceY], ...data.via, [targetX, targetY]];
    path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  } else [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12, offset: 24 });
  const dash = data?.style === 'dotted' ? '2 6' : data?.style === 'dashed' ? '8 6' : undefined;
  return (
    <BaseEdge
      id={id}
      path={path}
      style={{ stroke: data?.done ? 'var(--ok)' : data?.style === 'solid' ? 'var(--text-2)' : 'var(--muted)', strokeWidth: data?.style === 'solid' ? 2.2 : 2, strokeDasharray: dash, strokeLinecap: 'round' }}
    />
  );
}

const nodeTypes = { rm: RmNode };
const edgeTypes = { route: RouteEdge };

/** Стороны подключения: явно из YAML или по взаимному положению узлов. */
function autoSides(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): [Side, Side] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  const vOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
  if (!vOverlap && Math.abs(dy) >= Math.abs(dx) * 0.35) return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
  return dx > 0 ? ['right', 'left'] : ['left', 'right'];
}

// ---------- страница ----------

const RES_KIND: Record<string, string> = { article: 'Статья', video: 'Видео', docs: 'Документация', course: 'Курс', tool: 'Инструмент', book: 'Книга' };

export function RoadmapPage() {
  const { course: cid } = useParams();
  const c = findCourse(cid);
  const p = useProgress();
  const [sel, setSel] = useState<string | null>(null);
  const rm = c?.roadmap;

  const build = useCallback((): Node<RmData>[] => {
    if (!c || !rm) return [];
    const saved = p.roadmap[c.id] ?? {};
    return rm.nodes.map((n) => {
      const sec = rm.sections.find((s) => s.id === n.section);
      const np = nodeProgress(p, c, n);
      const box = nodeBox(n);
      return {
        id: n.id,
        type: 'rm',
        position: saved[n.id] ?? { x: n.x, y: n.y },
        draggable: n.kind !== 'label' && n.kind !== 'title' && n.kind !== 'note',
        selectable: false,
        data: { node: n, section: sec, pct: np.pct, done: np.done, mark: p.marks?.[c.id]?.[n.id], selected: sel === n.id, w: box.w, h: box.h },
      };
    });
  }, [c, rm, p, sel]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RmData>>(build());
  useEffect(() => {
    setNodes(build());
  }, [build, setNodes]);

  const edges: Edge<EdgeData>[] = useMemo(() => {
    if (!c || !rm) return [];
    const byId = new Map(rm.nodes.map((n) => [n.id, n]));
    return rm.edges.flatMap((e: RoadmapEdge, i) => {
      const [a, b] = edgeEnds(e);
      const A = byId.get(a);
      const B = byId.get(b);
      if (!A || !B) return [];
      const obj: Exclude<RoadmapEdge, [string, string]> | Partial<Exclude<RoadmapEdge, [string, string]>> = Array.isArray(e) ? {} : e;
      const [fs, ts] = autoSides(nodeBox(A), nodeBox(B));
      const sub = A.kind === 'sub' || B.kind === 'sub' || A.kind === 'checkpoint' || B.kind === 'checkpoint';
      return [
        {
          id: `e${i}`,
          source: a,
          target: b,
          sourceHandle: `s-${obj.fromSide ?? fs}`,
          targetHandle: `t-${obj.toSide ?? ts}`,
          type: 'route',
          data: { via: obj.via, style: obj.style ?? (sub ? 'dotted' : 'solid'), done: nodeProgress(p, c, A).done && nodeProgress(p, c, B).done },
        },
      ];
    });
  }, [c, rm, p]);

  if (!c) return <div className="page empty">Курс не найден.</div>;
  if (!rm) return <div className="page empty">У этого курса пока нет роадмапа.</div>;

  const node = rm.nodes.find((n) => n.id === sel);
  const st = courseStatus(p, c);
  const custom = Object.keys(p.roadmap[c.id] ?? {}).length > 0;

  return (
    <div className="roadmap-page">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, n) => progress.setRoadmapPos(c.id, n.id, n.position)}
        onNodeClick={(_, n) => {
          const k = (n.data as RmData).node.kind;
          if (k !== 'label' && k !== 'title' && k !== 'note') setSel(n.id);
        }}
        onPaneClick={() => setSel(null)}
        onInit={(inst) => {
          // как на roadmap.sh: карта читается сверху вниз в натуральную величину, а не ужимается целиком в экран
          const boxes = rm.nodes.map(nodeBox);
          const minX = Math.min(...boxes.map((b) => b.x));
          const maxX = Math.max(...boxes.map((b) => b.x + b.w));
          const minY = Math.min(...boxes.map((b) => b.y));
          const el = document.querySelector('.roadmap-page');
          const W = el?.clientWidth ?? window.innerWidth;
          const zoom = Math.min(1, (W - 48) / (maxX - minX));
          inst.setViewport({ x: (W - (maxX - minX) * zoom) / 2 - minX * zoom, y: 24 - minY * zoom, zoom });
        }}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode={['Meta', 'Control']}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1.2} color="var(--line)" />
        <Controls showInteractive={false} position="top-left" />
        <MiniMap pannable zoomable bgColor="var(--surface)" maskColor="rgba(128, 128, 128, 0.16)" nodeColor={(n) => ((n.data as RmData).done ? 'var(--ok)' : (n.data as RmData).node.kind === 'checkpoint' ? 'var(--text)' : 'var(--line-2)')} />
      </ReactFlow>

      <details className="panel rm-legend" open={window.innerWidth > 900}>
        <summary>
          <span>Пройдено {Math.round(st.pct * 100)}%</span>
          <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
            легенда
          </span>
        </summary>
        <div className="row">
          <span>
            <i className="lg topic" /> тема
          </span>
          <span>
            <i className="lg sub" /> подтема
          </span>
          <span>
            <i className="lg checkpoint" /> проект
          </span>
          <span>
            <i className="lg done" /> пройдено
          </span>
        </div>
        <div className="muted" style={{ fontSize: 12.5 }}>
          Колесо — прокрутка, Ctrl + колесо — масштаб, клик по теме — подробности.
        </div>
        {custom && (
          <button className="btn small" onClick={() => progress.resetRoadmap(c.id)}>
            <I.reset /> Вернуть раскладку
          </button>
        )}
      </details>

      {node && <NodePanel c={c} p={p} node={node} section={rm.sections.find((s) => s.id === node.section)} onClose={() => setSel(null)} />}
    </div>
  );
}

function NodePanel({ c, p, node, section, onClose }: { c: CourseInfo; p: ProgressState; node: RoadmapNode; section?: { title: string; color?: string }; onClose: () => void }) {
  const lessons = linkedLessons(c, node.links);
  const ready = lessons.filter((l) => !l.meta.draft);
  const mark = p.marks?.[c.id]?.[node.id];
  const np = nodeProgress(p, c, node);
  const nextL = ready.find((l) => !lessonStatus(p, c.id, l).done);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const setMark = (m: RoadmapMark) => {
    const next = mark === m ? null : m;
    progress.setMark(c.id, node.id, next);
    // «Готово» засчитывает связанные уроки как изученные, снятие — возвращает как было
    if (m === 'done') progress.setKnown(c.id, ready.map((l) => l.key), next === 'done');
  };

  return (
    <>
      <div className="rm-scrim" onClick={onClose} />
      <aside className="rm-drawer" role="dialog" aria-label={node.title}>
        <div className="rm-drawer-top">
          <div className="seg small" role="group" aria-label="Статус темы">
            <button className={mark === 'learning' ? 'on' : ''} onClick={() => setMark('learning')}>
              <I.book width={15} height={15} /> Изучаю
            </button>
            <button className={mark === 'done' || np.done ? 'on' : ''} onClick={() => setMark('done')}>
              <I.check width={15} height={15} /> Готово
            </button>
            <button className={mark === 'skip' ? 'on' : ''} onClick={() => setMark('skip')}>
              <I.x width={15} height={15} /> Пропустить
            </button>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <I.x />
          </button>
        </div>
        <div className="rm-drawer-body">
          <div className="rm-kicker">
            {section && (
              <span className="rm-sec" style={{ ['--sec' as string]: section.color }}>
                {section.title}
              </span>
            )}
            {node.kind === 'checkpoint' && <span className="tag">проект</span>}
            {node.optional && <span className="tag">по желанию</span>}
          </div>
          <h2>{node.title}</h2>
          {node.description ? <Markdown text={node.description} /> : <p className="muted">Описание темы пока не написано.</p>}

          <h3>Уроки курса</h3>
          {lessons.length ? (
            <>
              <ul className="lesson-list" style={{ padding: 0 }}>
                {lessons.map((l) => {
                  const ls = lessonStatus(p, c.id, l);
                  return (
                    <li key={l.key}>
                      <Link className={`lesson-link${l.meta.draft ? ' draft' : ''}`} to={lessonHref(c.id, l.key)}>
                        <LessonDot pct={ls.pct} done={ls.done} />
                        <span>{l.meta.title}</span>
                        <span className="meta">{l.meta.draft ? 'скоро' : ls.known ? 'уже знаю' : l.meta.minutes ? `${l.meta.minutes} мин` : ''}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {nextL && (
                <Link className="btn primary" style={{ marginTop: 12 }} to={lessonHref(c.id, nextL.key)}>
                  <I.play width={15} height={15} /> {lessonStatus(p, c.id, nextL).started ? 'Продолжить' : 'Начать'}: {nextL.meta.title}
                </Link>
              )}
            </>
          ) : (
            <p className="muted">Уроки по этой теме ещё не написаны.</p>
          )}

          {node.resources.length > 0 && (
            <>
              <h3>Материалы</h3>
              <ul className="rm-res">
                {node.resources.map((r, i) => (
                  <li key={i}>
                    <span className={`tag res-${r.kind}`}>{RES_KIND[r.kind]}</span>
                    <a href={r.url} target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
