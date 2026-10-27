import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findCourse, lessonHref } from '../content';
import type { CourseInfo } from '../core/manifest';
import { ACHIEVEMENTS } from '../state/achievements';
import { courseStatus, lessonStatus, moduleStatus, nextLesson, ProgressState, streak, useProgress } from '../state/progress';
import { Belt } from '../components/Belt';
import { Markdown } from '../components/Markdown';
import { I } from '../components/ui/icons';

export function LessonDot({ pct, done }: { pct: number; done: boolean }) {
  return (
    <span className={`ldot${done ? ' done' : pct > 0 ? ' started' : ''}`} style={{ ['--p' as string]: Math.round(pct * 100) }}>
      {done && <I.check width={11} height={11} strokeWidth={3.5} />}
    </span>
  );
}

function Heatmap({ p }: { p: ProgressState }) {
  const days: { key: string; n: number }[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (18 * 7 - 1) - ((d.getDay() + 6) % 7) + 6);
  for (let i = 0; i < 18 * 7; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ key, n: p.activity[key] ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  return (
    <div className="heat" aria-label="Активность за последние 18 недель">
      {days.map((x) => (
        <i key={x.key} className={x.n >= 12 ? 'l3' : x.n >= 5 ? 'l2' : x.n > 0 ? 'l1' : ''} title={`${x.key}: ${x.n}`} />
      ))}
    </div>
  );
}

function RoadmapTeaser({ c, p }: { c: CourseInfo; p: ProgressState }) {
  const rm = c.roadmap!;
  const xs = rm.nodes.map((n) => n.x);
  const ys = rm.nodes.map((n) => n.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs) + 200, Math.min(...ys), Math.max(...ys) + 60];
  const lessonsDone = (links: string[]) => {
    const ls = links.flatMap((l) => {
      const [m, lid] = l.split('/');
      const mod = c.modules.find((x) => x.id === m);
      return mod ? mod.lessons.filter((x) => !x.meta.draft && (!lid || x.id === lid)) : [];
    });
    return ls.length ? ls.filter((l) => lessonStatus(p, c.id, l).done).length / ls.length : 0;
  };
  const pos = new Map(rm.nodes.map((n) => [n.id, n]));
  return (
    <Link to={`/c/${c.id}/roadmap`} className="panel roadmap-teaser">
      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <I.map /> Роадмап курса
      </h3>
      <svg className="teaser-map" viewBox={`${minX - 20} ${minY - 20} ${maxX - minX + 40} ${maxY - minY + 40}`} aria-hidden>
        {rm.edges.map(([a, b], i) => {
          const A = pos.get(a);
          const B = pos.get(b);
          return A && B ? <line key={i} x1={A.x + 100} y1={A.y + 30} x2={B.x + 100} y2={B.y + 30} stroke="var(--line-2)" strokeWidth={6} /> : null;
        })}
        {rm.nodes.map((n) => {
          const k = lessonsDone(n.links);
          return <rect key={n.id} x={n.x} y={n.y} width={200} height={60} rx={14} fill={k >= 1 ? 'var(--ok)' : k > 0 ? 'var(--accent)' : 'var(--surface-2)'} stroke="var(--line-2)" strokeWidth={4} />;
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

  const isOpen = (id: string, i: number) => open[id] ?? (next ? c.modules.some((m) => m.id === id && m.lessons.includes(next.lesson)) : i === 0);

  return (
    <main className="page">
      <section className="course-hero">
        <div>
          <h1>{c.meta.title}</h1>
          {c.meta.subtitle && <p className="lead">{c.meta.subtitle}</p>}
          <div style={{ marginTop: 22 }}>
            <Belt course={c} p={p} />
          </div>
        </div>
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
              <span className="title">Курс пройден целиком 🥋</span>
              <span className="label">Можно перепроходить уроки или заглянуть в песочницу.</span>
            </>
          )}
        </div>
      </section>

      <div className="dash">
        <section>
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
                              <span className="meta">{l.meta.draft ? 'скоро' : ls.known ? 'уже знаю' : `${l.steps.length} шаг. ${l.meta.minutes ? `· ~${l.meta.minutes} мин` : ''}`}</span>
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
          {c.roadmap && <RoadmapTeaser c={c} p={p} />}
          <div className="panel">
            <h3>Статистика</h3>
            <div className="stats">
              <div className="stat">
                <b>{Math.round(st.pct * 100)}%</b>
                <span>курса пройдено</span>
              </div>
              <div className="stat">
                <b>
                  {st.solved}/{st.required}
                </b>
                <span>заданий решено</span>
              </div>
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
            <h3>
              Достижения {Object.keys(p.achievements).length}/{ACHIEVEMENTS.length}
            </h3>
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => (
                <span key={a.id} className={`ach${p.achievements[a.id] ? ' got' : ''}`} title={`${a.title}: ${a.text}`}>
                  {a.icon}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
