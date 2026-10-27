import { useState } from 'react';
import { VariantSelect } from '../components/Variant';
import { Link, useParams } from 'react-router-dom';
import { findCourse, lessonHref } from '../content';
import { edgeEnds, nodeBox, type CourseInfo } from '../core/manifest';
import { autoSides, linkedLessons } from './Roadmap';
import { courseAchievements } from '../state/achievements';
import { notesList } from '../state/notes';
import { AchBadge } from '../components/Activity';
import { courseStatus, lessonStatus, moduleStatus, nextLesson, progress, ProgressState, streak, useProgress } from '../state/progress';
import { CourseProgress } from '../components/Belt';
import { Markdown } from '../components/Markdown';
import { I } from '../components/ui/icons';

export function LessonDot({ pct, done }: { pct: number; done: boolean }) {
  return (
    <span className={`ldot${done ? ' done' : pct > 0 ? ' started' : ''}`} style={{ ['--p' as string]: Math.round(pct * 100) }}>
      {done && <I.check width={11} height={11} strokeWidth={3.5} />}
    </span>
  );
}

export function RoadmapMini({ c, p, crop }: { c: CourseInfo; p: ProgressState; crop?: boolean }) {
  const rm = c.roadmap!;
  const nodes = rm.nodes.filter((n) => n.kind !== 'label' && n.kind !== 'note' && n.kind !== 'title' && n.kind !== 'group').map((n) => ({ n, ...nodeBox(n) }));
  if (!nodes.length) return null;
  const minX = Math.min(...nodes.map((b) => b.x));
  const minY = Math.min(...nodes.map((b) => b.y));
  const maxX = Math.max(...nodes.map((b) => b.x + b.w));
  const maxY = Math.max(...nodes.map((b) => b.y + b.h));
  const pos = new Map(nodes.map((b) => [b.n.id, b]));
  const done = (links: string[]) => {
    const ls = linkedLessons(c, links).filter((x) => !x.meta.draft);
    return ls.length ? ls.filter((l) => lessonStatus(p, c.id, l).done).length / ls.length : 0;
  };
  return (
      <svg className="teaser-map" preserveAspectRatio={crop ? 'xMidYMin slice' : undefined} viewBox={`${minX - 20} ${minY - 20} ${maxX - minX + 40} ${maxY - minY + 40}`} aria-hidden>
        {rm.edges.map((e, i) => {
          const [a, b] = edgeEnds(e);
          const A = pos.get(a);
          const B = pos.get(b);
          if (!A || !B) return null;
          const o: { fromSide?: string; toSide?: string; curve?: boolean } = Array.isArray(e) ? {} : e;
          const [fs, ts] = autoSides(A, B);
          const pt = (r: typeof A, side: string) =>
            side === 'top' ? [r.x + r.w / 2, r.y] : side === 'bottom' ? [r.x + r.w / 2, r.y + r.h] : side === 'left' ? [r.x, r.y + r.h / 2] : [r.x + r.w, r.y + r.h / 2];
          const fside = o.fromSide ?? fs;
          const tside = o.toSide ?? ts;
          const [x1, y1] = pt(A, fside);
          const [x2, y2] = pt(B, tside);
          const vertical = fside === 'top' || fside === 'bottom';
          const d =
            o.curve
              ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`
              : vertical
                ? `M${x1},${y1} V${(y1 + y2) / 2} H${x2} V${y2}`
                : `M${x1},${y1} H${(x1 + x2) / 2} V${y2} H${x2}`;
          return <path key={i} d={d} fill="none" stroke="var(--line-2)" strokeWidth={5} />;
        })}
        {nodes.map(({ n, x, y, w, h }) => {
          const k = p.marks?.[c.id]?.[n.id] === 'done' ? 1 : done(n.links);
          const fill = n.kind === 'checkpoint' ? 'var(--text)' : k >= 1 ? 'var(--ok)' : k > 0 ? 'var(--accent)' : 'var(--surface-2)';
          return <rect key={n.id} x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke="var(--line-2)" strokeWidth={4} />;
        })}
      </svg>
  );
}

function RoadmapTeaser({ c, p }: { c: CourseInfo; p: ProgressState }) {
  return (
    <Link to={`/c/${c.id}/roadmap`} className="panel roadmap-teaser">
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <I.map /> Роадмап курса
      </h3>
      <RoadmapMini c={c} p={p} />
    </Link>
  );
}

export function CoursePage() {
  const { course: cid } = useParams();
  const c = findCourse(cid);
  const p = useProgress();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!c) return <div className="page empty">Курс не найден.</div>;
  const st = courseStatus(p, c);
  const next = nextLesson(p, c);
  const s = streak(p);

  const continuePanel = (
          <div className="panel continue">
            {next ? (
              <>
                <span className="label">{st.done || p.courses[c.id]?.last ? 'Продолжить с места, где остановился' : 'Начать курс'}</span>
                <span className="title">{next.lesson.meta.title}</span>
                <Link className="btn primary" to={lessonHref(c.id, next.lesson.key, next.step)}>
                  <I.play width={15} height={15} /> {st.done || p.courses[c.id]?.last ? 'Продолжить' : 'Начать'}
                </Link>
              </>
            ) : (
              <>
                <span className="title">{st.drafts ? 'Все готовые уроки пройдены' : 'Курс пройден целиком'}</span>
                <span className="label">
                  {st.drafts ? `Ещё ${st.drafts} уроков пишутся — они появятся здесь. Пока можно повторить пройденное.` : 'Можно перепроходить уроки или заглянуть в песочницу.'}
                </span>
              </>
            )}
          </div>
  );

  const isOpen = (id: string, i: number) => open[id] ?? (next ? c.modules.some((m) => m.id === id && m.lessons.includes(next.lesson)) : i === 0);

  return (
    <main className="page">
      <div className="dash">
        <section className="dash-main">
          <header className="course-head">
            <h1>{c.meta.title}</h1>
            {c.meta.subtitle && <p className="lead">{c.meta.subtitle}</p>}
          </header>
          <CourseProgress course={c} p={p} />
          <div className="only-mobile">{continuePanel}</div>
          {c.meta.description && (
            <div style={{ marginBottom: 24 }}>
              <Markdown text={c.meta.description} />
            </div>
          )}
          <div className="section-head">
            <h2>Программа</h2>
            <span className="muted" style={{ fontSize: 14 }}>
              {st.done} из {st.total} уроков
            </span>
          </div>
          <div className="modules">
            {c.modules.map((m, i) => {
              const ms = moduleStatus(p, c.id, m);
              const o = isOpen(m.id, i);
              const draft = m.meta.draft || m.lessons.every((l) => l.meta.draft);
              return (
                <div key={m.id} className={`panel module${o ? ' open' : ''}${ms.complete ? ' complete' : ''}`}>
                  <button className="module-head" onClick={() => setOpen((x) => ({ ...x, [m.id]: !o }))} aria-expanded={o}>
                    <span className="module-num">{ms.complete ? <I.check /> : i + 1}</span>
                    <span>
                      <span className="module-title">
                        {m.meta.title} {draft && <span className="tag">скоро</span>}
                      </span>
                      {m.meta.description && <span className="module-desc" style={{ display: 'block' }}>{m.meta.description}</span>}
                    </span>
                    <span className="module-prog">
                      {ms.ready ? `${ms.done}/${ms.total}` : `${m.lessons.length} ур.`}
                      <span className={`bar${ms.complete ? ' ok' : ''}`}>
                        <i style={{ width: `${ms.pct * 100}%` }} />
                      </span>
                    </span>
                    <I.chevron className="chev" />
                  </button>
                  {o && (
                    <ul className="lesson-list">
                      {m.lessons.map((l) => {
                        const ls = lessonStatus(p, c.id, l);
                        return (
                          <li key={l.id}>
                            <Link className={`lesson-link${l.meta.draft ? ' draft' : ''}`} to={lessonHref(c.id, l.key)} aria-disabled={l.meta.draft}>
                              <LessonDot pct={ls.pct} done={ls.done} />
                              <span>
                                {l.meta.title}
                                {l.meta.checkpoint && <span className="tag accent" style={{ marginLeft: 8 }}>проверь себя</span>}
                              </span>
                              <span className="meta">{l.meta.draft ? 'скоро' : ls.known ? 'уже знаю' : l.meta.minutes ? `${l.meta.minutes} мин` : `${l.steps.length} шаг.`}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="side">
        <div className="only-desktop">{continuePanel}</div>
          {c.meta.variants && <VariantSelect course={c} />}
          {c.roadmap && <RoadmapTeaser c={c} p={p} />}
          <Link to={`/c/${c.id}/notes`} className="panel side-link">
            <I.note /> Мои заметки
            <span className="muted">{notesList(p, c.id).length}</span>
          </Link>
          <div className="panel">
            <h3 className="row-between">
              Достижения курса
              <Link to="/achievements" className="btn ghost small">
                Все
              </Link>
            </h3>
            <div className="ach-grid">
              {courseAchievements(c).map((a) => (
                <span key={a.id} title={`${a.title}: ${a.text}${p.achievements[a.id] ? '' : ` (${a.progress(p).join(' из ')})`}`}>
                  <AchBadge a={a} got={!!p.achievements[a.id]} />
                </span>
              ))}
            </div>
          </div>
          <button
            className="btn ghost small reset-course"
            onClick={() => confirm(`Сбросить прогресс курса «${c.meta.title}»? Пропадут решения, отметки на роадмапе и черновики кода курса. Заметки останутся.`) && progress.resetCourse(c.id)}
          >
            <I.reset /> Сбросить прогресс курса
          </button>
        </aside>
      </div>
    </main>
  );
}
