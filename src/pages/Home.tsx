import { Link } from 'react-router-dom';
import { articles, findCourse, lessonHref, manifest } from '../content';
import { allAchievements } from '../state/achievements';
import { beltFor, courseStatus, nextLesson, streak, useProgress } from '../state/progress';
import { AchBadge, Heatmap, plural, WeekRow } from '../components/Activity';
import { BeltBadge } from '../components/Belt';
import { I } from '../components/ui/icons';
import { RoadmapMini } from './Course';
import { Warmup } from '../components/Warmup';

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
      <section className="home-hero">
        <h1>{lastCourse ? 'С возвращением' : 'Додзё'}</h1>
        <p>
          {lastCourse
            ? s.current
              ? `Серия — ${s.current} ${plural(s.current, 'день', 'дня', 'дней')}. Одно задание сегодня — и она продлится.`
              : 'Начни серию заново: одно решённое задание в день — и она растёт.'
            : 'Место, где изучают любую IT-тему: теория маленькими порциями, вопрос после каждого куска и практика прямо в браузере — код, SQL, git, схемы и роадмапы.'}
        </p>
      </section>
      {articles.length > 0 && (
        <section className="home-materials">
          <div className="section-head">
            <h2>Материалы</h2>
            <span className="muted" style={{ fontSize: 14 }}>{articles.length}</span>
          </div>
          <div className="article-list">
            {articles.map((article) => (
              <Link key={article.id} to={`/articles/${article.id}`} className="panel article-card">
                <span className="eyebrow">Статья</span>
                <h3>{article.meta.title}</h3>
                {article.meta.subtitle && <p>{article.meta.subtitle}</p>}
                {article.meta.tags.length > 0 && <div className="tag-list">{article.meta.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="home-grid">
        <div className="home-main">

          {manifest.errors.length > 0 && import.meta.env.DEV && (
            <details className="errors" open>
              <summary>Ошибки в контенте ({manifest.errors.length}) — видно только в режиме разработки</summary>
              {manifest.errors.join('\n')}
            </details>
          )}

          <div className="section-head">
            <h2>Курсы</h2>
            <span className="muted" style={{ fontSize: 14 }}>
              {courses.length} {plural(courses.length, 'курс', 'курса', 'курсов')}
            </span>
          </div>
          <div className="course-list">
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
        </div>

        <aside className="side home-side">
          <div className="section-head">
            <h2>Сегодня</h2>
          </div>
          {cont && contNext ? (
            <Link to={lessonHref(cont.id, contNext.lesson.key, contNext.step)} className="panel continue home-continue">
              <span className="label">Продолжить: {cont.meta.title}</span>
              <span className="title">{contNext.lesson.meta.title}</span>
              <span className="btn primary">
                <I.play width={15} height={15} /> Продолжить
              </span>
            </Link>
          ) : (
            courses[0] && (
              <Link to={`/c/${courses[0].id}`} className="panel continue home-continue">
                <span className="label">С чего начать</span>
                <span className="title">{courses[0].meta.title}</span>
                <span className="btn primary">
                  <I.play width={15} height={15} /> Открыть курс
                </span>
              </Link>
            )
          )}

          <Warmup />

          <section className="panel">
            <h3 className="row-between">
              Активность
              <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
                рекорд {s.best}
              </span>
            </h3>
            <div className="act-streak">
              <I.flame width={22} height={22} />
              <b>{s.current}</b>
              <span className="muted">{plural(s.current, 'день', 'дня', 'дней')} подряд</span>
            </div>
            <WeekRow p={p} />
            <div style={{ marginTop: 14 }}>
              <Heatmap p={p} />
            </div>
          </section>

          <section className="panel">
            <h3 className="row-between">
              Достижения
              <Link to="/achievements" className="btn ghost small">
                {got.length} из {achs.length}
              </Link>
            </h3>
            {got.length > 0 && (
              <div className="ach-recent">
                {got.slice(0, 6).map((a) => (
                  <span key={a.id} title={`${a.title}: ${a.text}`}>
                    <AchBadge a={a} got />
                  </span>
                ))}
              </div>
            )}
            {close.slice(0, got.length ? 2 : 3).map(({ a }) => {
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
        </aside>
      </div>
    </main>
  );
}
