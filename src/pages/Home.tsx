import { Link } from 'react-router-dom';
import { findCourse, lessonHref, manifest } from '../content';
import { allAchievements } from '../state/achievements';
import { beltFor, courseStatus, nextLesson, streak, useProgress } from '../state/progress';
import { AchBadge, Heatmap, plural, WeekRow } from '../components/Activity';
import { BeltBadge } from '../components/Belt';
import { I } from '../components/ui/icons';
import { RoadmapMini } from './Course';

export function Home() {
  const p = useProgress();
  const courses = manifest.courses.filter((c) => !c.meta.draft || import.meta.env.DEV);
  const s = streak(p);
  // последний курс, где ученик что-то делал
  const lastCourse = Object.entries(p.courses)
    .filter(([id, c]) => c.last && findCourse(id))
    .sort((a, b) => (b[1].last?.at ?? 0) - (a[1].last?.at ?? 0))[0];
  const cont = lastCourse ? findCourse(lastCourse[0]) : undefined;
  const contNext = cont ? nextLesson(p, cont) : null;
  const achs = allAchievements(manifest);
  const got = achs.filter((a) => p.achievements[a.id]).sort((a, b) => p.achievements[b.id] - p.achievements[a.id]);
  // ближайшие к получению
  const close = achs
    .filter((a) => !p.achievements[a.id])
    .map((a) => ({ a, k: a.progress(p)[0] / a.progress(p)[1] }))
    .sort((x, y) => y.k - x.k)
    .slice(0, 3);

  return (
    <main className="page home">
      <section className="home-top">
        <div className="home-hero">
          <h1>{lastCourse ? 'С возвращением' : 'Додзё для кода'}</h1>
          <p>
            {lastCourse
              ? s.current
                ? `Серия — ${s.current} ${plural(s.current, 'день', 'дня', 'дней')}. Одно задание сегодня — и она продлится.`
                : 'Начни серию заново: одно решённое задание в день — и она растёт.'
              : 'Теория маленькими порциями, вопрос после каждого куска и задачи прямо в браузере: Go, SQL на настоящем Postgres и git с терминалом.'}
          </p>
        </div>
        {cont && contNext && (
          <Link to={lessonHref(cont.id, contNext.lesson.key, contNext.step)} className="panel home-continue">
            <span className="muted">Продолжить: {cont.meta.title}</span>
            <b>{contNext.lesson.meta.title}</b>
            <span className="btn primary small" style={{ justifySelf: 'start' }}>
              <I.play width={14} height={14} /> Продолжить
            </span>
          </Link>
        )}
      </section>

      {manifest.errors.length > 0 && import.meta.env.DEV && (
        <details className="errors" open>
          <summary>Ошибки в контенте ({manifest.errors.length}) — видно только в режиме разработки</summary>
          {manifest.errors.join('\n')}
        </details>
      )}

      <h2 className="sec-title">Курсы</h2>
      <div className="course-grid">
        {courses.map((c) => {
          const st = courseStatus(p, c);
          const pct = Math.round(st.pct * 100);
          const { current } = beltFor(c, st.pct);
          return (
            <Link key={c.id} to={`/c/${c.id}`} className="panel course-card">
              <div className="cc-art">{c.roadmap ? <RoadmapMini c={c} p={p} crop /> : null}</div>
              <div className="cc-body">
                <div className="cc-meta">
                  <span className="tag">{pct ? 'в процессе' : 'не начат'}</span>
                  <span className="muted">
                    {c.modules.length} {plural(c.modules.length, 'модуль', 'модуля', 'модулей')}, {st.total} {plural(st.total, 'урок', 'урока', 'уроков')}
                  </span>
                </div>
                <h3>{c.meta.title}</h3>
                {c.meta.subtitle && <p>{c.meta.subtitle}</p>}
                <div className="cc-prog">
                  <span className="bar">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <span className="cc-pct">{pct}%</span>
                  <span className="belt-chip" title={current.name}>
                    <BeltBadge color={current.color} size={26} />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
        {!courses.length && <div className="empty panel">Курсов пока нет. Добавь папку в courses/ — см. docs/AUTHORING.md.</div>}
      </div>

      <div className="home-cols">
        <section className="panel home-activity">
          <div className="row-between">
            <h2 className="sec-title" style={{ margin: 0 }}>
              Активность
            </h2>
            <span className="muted" style={{ fontSize: 13.5 }}>
              рекорд — {s.best}, всего дней — {s.days}
            </span>
          </div>
          <div className="act-top">
            <div className="act-streak">
              <I.flame width={26} height={26} />
              <b>{s.current}</b>
              <span className="muted">{plural(s.current, 'день', 'дня', 'дней')} подряд</span>
            </div>
            <WeekRow p={p} />
          </div>
          <Heatmap p={p} weeks={26} />
        </section>

        <section className="panel home-ach">
          <div className="row-between">
            <h2 className="sec-title" style={{ margin: 0 }}>
              Достижения
            </h2>
            <Link to="/achievements" className="btn ghost small">
              {got.length} из {achs.length}
            </Link>
          </div>
          {got.length > 0 && (
            <div className="ach-recent">
              {got.slice(0, 6).map((a) => (
                <span key={a.id} title={`${a.title}: ${a.text}`}>
                  <AchBadge a={a} got />
                </span>
              ))}
            </div>
          )}
          <div className="ws-section-title" style={{ marginTop: 14 }}>
            Ближе всего
          </div>
          {close.map(({ a }) => {
            const [cur, max] = a.progress(p);
            return (
              <div key={a.id} className="ach-close">
                <AchBadge a={a} got={false} size={18} />
                <div>
                  <b>{a.title}</b>
                  <span className="muted">{a.text}</span>
                  <span className="ach-prog">
                    <span className="bar">
                      <i style={{ width: `${(cur / max) * 100}%` }} />
                    </span>
                    <span className="muted">
                      {cur} / {max}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
