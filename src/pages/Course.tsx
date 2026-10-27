import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findCourse, lessonHref } from '../content';
import { edgeEnds, nodeBox, type CourseInfo } from '../core/manifest';
import { linkedLessons } from './Roadmap';
import { courseAchievements, GLOBAL } from '../state/achievements';
import { AchBadge, Heatmap } from '../components/Activity';
import { courseStatus, lessonStatus, moduleStatus, nextLesson, ProgressState, streak, useProgress } from '../state/progress';
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

function RoadmapTeaser({ c, p }: { c: CourseInfo; p: ProgressState }) {
  const rm = c.roadmap!;
  const nodes = rm.nodes.filter((n) => n.kind !== 'label' && n.kind !== 'note' && n.kind !== 'title').map((n) => ({ n, ...nodeBox(n) }));
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
    <Link to={`/c/${c.id}/roadmap`} className="panel roadmap-teaser">
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <I.map /> Роадмап курса
      </h3>
      <svg className="teaser-map" viewBox={`${minX - 20} ${minY - 20} ${maxX - minX + 40} ${maxY - minY + 40}`} aria-hidden>
        {rm.edges.map((e, i) => {
          const [a, b] = edgeEnds(e);
          const A = pos.get(a);
          const B = pos.get(b);
          return A && B ? <line key={i} x1={A.x + A.w / 2} y1={A.y + A.h / 2} x2={B.x + B.w / 2} y2={B.y + B.h / 2} stroke="var(--line-2)" strokeWidth={6} /> : null;
        })}
        {nodes.map(({ n, x, y, w, h }) => {
          const k = p.marks?.[c.id]?.[n.id] === 'done' ? 1 : done(n.links);
          const fill = n.kind === 'checkpoint' ? 'var(--text)' : k >= 1 ? 'var(--ok)' : k > 0 ? 'var(--accent)' : 'var(--surface-2)';
          return <rect key={n.id} x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke="var(--line-2)" strokeWidth={4} />;
        })}
      </svg>
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
                <span className="title">Курс пройден целиком</span>
                <span className="label">Можно перепроходить уроки или заглянуть в песочницу.</span>
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
                      {ms.total ? `${ms.done}/${ms.total}` : `${m.lessons.length} ур.`}
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
          {c.roadmap && <RoadmapTeaser c={c} p={p} />}
          <div className="panel">
            <h3>Регулярность</h3>
            <div className="stats">
              <div className="stat">
                <b>{s.current}</b>
                <span>дней подряд</span>
              </div>
              <div className="stat">
                <b>{s.best}</b>
                <span>рекорд серии</span>
              </div>
            </div>
            <Heatmap p={p} />
          </div>
          <div className="panel">
            <h3 className="row-between">
              Достижения
              <Link to="/achievements" className="btn ghost small">
                Все
              </Link>
            </h3>
            <div className="ach-grid">
              {[...courseAchievements(c), ...GLOBAL].map((a) => (
                <span key={a.id} title={`${a.title}: ${a.text}${p.achievements[a.id] ? '' : ` (${a.progress(p).join(' из ')})`}`}>
                  <AchBadge a={a} got={!!p.achievements[a.id]} />
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
