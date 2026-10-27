import { Link } from 'react-router-dom';
import { manifest } from '../content';
import { courseStatus, useProgress } from '../state/progress';
import { Belt } from '../components/Belt';

export function Home() {
  const p = useProgress();
  const courses = manifest.courses.filter((c) => !c.meta.draft || import.meta.env.DEV);
  return (
    <main className="page">
      <section className="home-hero">
        <h1>Додзё для кода</h1>
        <p>Теория маленькими порциями, вопросы после каждого куска и задачи прямо в браузере: Go, SQL на настоящем Postgres и git с терминалом. Прогресс копится в поясах.</p>
      </section>
      {manifest.errors.length > 0 && import.meta.env.DEV && (
        <details className="errors" open>
          <summary>Ошибки в контенте ({manifest.errors.length}) — видно только в режиме разработки</summary>
          {manifest.errors.join('\n')}
        </details>
      )}
      <div className="course-list">
        {courses.map((c) => {
          const st = courseStatus(p, c);
          return (
            <Link key={c.id} to={`/c/${c.id}`} className="panel course-row">
              <div>
                <h2>
                  {c.meta.icon ? `${c.meta.icon} ` : ''}
                  {c.meta.title}
                </h2>
                {c.meta.subtitle && <p>{c.meta.subtitle}</p>}
                <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
                  {c.modules.length} модулей, {st.total} уроков{st.done ? `, пройдено ${st.done}` : ''}
                </p>
              </div>
              <Belt course={c} p={p} compact />
            </Link>
          );
        })}
        {!courses.length && <div className="empty panel">Курсов пока нет. Добавь папку в courses/ — см. docs/AUTHORING.md.</div>}
      </div>
    </main>
  );
}
