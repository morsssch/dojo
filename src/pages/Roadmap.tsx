import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Background, Controls, Edge, Handle, MarkerType, MiniMap, Node, NodeProps, Position, ReactFlow, useNodesState } from '@xyflow/react';
import { findCourse, lessonHref } from '../content';
import type { CourseInfo, LessonInfo } from '../core/manifest';
import { courseStatus, lessonStatus, progress, ProgressState, useProgress } from '../state/progress';
import { Markdown } from '../components/Markdown';
import { I } from '../components/ui/icons';
import { LessonDot } from './Course';

type RmData = { title: string; section?: string; color?: string; pct: number; done: boolean; optional?: boolean; empty: boolean; selected: boolean };

function RmNode({ data }: NodeProps<Node<RmData>>) {
  return (
    <div className={`rm-node${data.done ? ' done' : ''}${data.optional ? ' optional' : ''}${data.selected ? ' selected' : ''}${data.empty ? ' empty' : ''}`} style={{ ['--sec' as string]: data.color }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {data.section && <div className="sec">{data.section}</div>}
      <div className="t">{data.title}</div>
      <div className={`bar${data.done ? ' ok' : ''}`}>
        <i style={{ width: `${data.pct * 100}%` }} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
const nodeTypes = { rm: RmNode };

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

function nodeProgress(p: ProgressState, c: CourseInfo, links: string[]) {
  const ls = linkedLessons(c, links).filter((l) => !l.meta.draft);
  if (!ls.length) return { pct: 0, done: false, empty: true };
  const st = ls.map((l) => lessonStatus(p, c.id, l));
  return { pct: st.reduce((a, s) => a + s.pct, 0) / st.length, done: st.every((s) => s.done), empty: false };
}

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
      const np = nodeProgress(p, c, n.links);
      return {
        id: n.id,
        type: 'rm',
        position: saved[n.id] ?? { x: n.x, y: n.y },
        data: { title: n.title, section: sec?.title, color: sec?.color, optional: n.optional, selected: sel === n.id, ...np },
      };
    });
  }, [c, rm, p, sel]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RmData>>(build());
  useEffect(() => {
    setNodes(build());
  }, [build, setNodes]);

  const edges: Edge[] = useMemo(() => {
    if (!c || !rm) return [];
    return rm.edges.map(([a, b]) => {
      const src = rm.nodes.find((n) => n.id === a)!;
      const done = nodeProgress(p, c, src.links).done;
      return {
        id: `${a}-${b}`,
        source: a,
        target: b,
        type: 'smoothstep',
        animated: done && !nodeProgress(p, c, rm.nodes.find((n) => n.id === b)!.links).done,
        style: { stroke: done ? 'var(--ok)' : 'var(--line-2)', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: done ? 'var(--ok)' : 'var(--line-2)' },
      };
    });
  }, [c, rm, p]);

  if (!c) return <div className="page empty">Курс не найден.</div>;
  if (!rm) return <div className="page empty">У этого курса пока нет роадмапа.</div>;

  const node = rm.nodes.find((n) => n.id === sel);
  const lessons = node ? linkedLessons(c, node.links) : [];
  const allKnown = lessons.length > 0 && lessons.filter((l) => !l.meta.draft).every((l) => lessonStatus(p, c.id, l).done);
  const st = courseStatus(p, c);
  const custom = Object.keys(p.roadmap[c.id] ?? {}).length > 0;

  return (
    <div className="roadmap-page">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, n) => progress.setRoadmapPos(c.id, n.id, n.position)}
        onNodeClick={(_, n) => setSel(n.id)}
        onPaneClick={() => setSel(null)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} size={1.2} color="var(--line)" />
        <Controls showInteractive={false} position="top-left" />
        <MiniMap pannable zoomable bgColor="var(--surface)" maskColor="rgba(10, 16, 32, 0.35)" nodeColor={(n) => ((n.data as RmData).done ? 'var(--ok)' : (n.data as RmData).pct > 0 ? 'var(--accent)' : 'var(--line-2)')} />
      </ReactFlow>

      <div className="panel rm-legend">
        <div>
          <b className="display" style={{ fontSize: 16 }}>
            {c.meta.title}
          </b>
          <div className="muted" style={{ fontSize: 13 }}>
            Пройдено {Math.round(st.pct * 100)}%. Узлы можно перетаскивать, клик — подробности.
          </div>
        </div>
        {rm.sections.length > 0 && (
          <div className="row">
            {rm.sections.map((s) => (
              <span key={s.id}>
                <i style={{ background: s.color ?? 'var(--muted)' }} /> {s.title}
              </span>
            ))}
          </div>
        )}
        <div className="row">
          <span>
            <i style={{ background: 'var(--ok)' }} /> пройдено
          </span>
          <span>
            <i style={{ background: 'var(--accent)' }} /> в процессе
          </span>
          <span>
            <i style={{ border: '1.5px dashed var(--muted)' }} /> по желанию
          </span>
        </div>
        {custom && (
          <button className="btn small" onClick={() => progress.resetRoadmap(c.id)}>
            <I.reset /> Вернуть раскладку
          </button>
        )}
      </div>

      {node && (
        <div className="panel rm-panel">
          <button className="icon-btn" style={{ float: 'right', marginTop: -6 }} onClick={() => setSel(null)} aria-label="Закрыть">
            <I.x />
          </button>
          <h2>{node.title}</h2>
          {node.optional && <span className="tag">по желанию</span>}
          {node.description && (
            <div style={{ marginTop: 10 }}>
              <Markdown text={node.description} />
            </div>
          )}
          {lessons.length > 0 ? (
            <>
              <h3 style={{ fontSize: 14, margin: '14px 0 8px' }}>Уроки</h3>
              <ul className="lesson-list" style={{ padding: 0 }}>
                {lessons.map((l) => {
                  const ls = lessonStatus(p, c.id, l);
                  return (
                    <li key={l.key}>
                      <Link className={`lesson-link${l.meta.draft ? ' draft' : ''}`} to={lessonHref(c.id, l.key)}>
                        <LessonDot pct={ls.pct} done={ls.done} />
                        <span>{l.meta.title}</span>
                        <span className="meta">{l.meta.draft ? 'скоро' : ls.known ? 'уже знаю' : ''}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="row-btns" style={{ marginTop: 14 }}>
                <button
                  className="btn small"
                  onClick={() =>
                    progress.setKnown(
                      c.id,
                      lessons.filter((l) => !l.meta.draft).map((l) => l.key),
                      !allKnown,
                    )
                  }
                >
                  {allKnown ? 'Снять отметку «знаю»' : 'Я это уже знаю'}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">Уроки для этой темы ещё не написаны.</p>
          )}
        </div>
      )}
    </div>
  );
}
