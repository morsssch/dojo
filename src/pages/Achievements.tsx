import { Link } from 'react-router-dom';
import { manifest } from '../content';
import { Achievement, courseAchievements, GLOBAL } from '../state/achievements';
import { streak, useProgress } from '../state/progress';
import { AchBadge, Heatmap, plural, WeekRow } from '../components/Activity';

function AchList({ list }: { list: Achievement[] }) {
  const p = useProgress();
  return (
    <div className="ach-list">
      {list.map((a) => {
        const got = p.achievements[a.id];
        const [cur, max] = a.progress(p);
        return (
          <div key={a.id} className={`ach-card${got ? ' got' : ''}`}>
            <AchBadge a={a} got={!!got} size={22} />
            <div className="ach-info">
              <b>{a.title}</b>
              <span className="muted">{a.text}</span>
              {got ? (
                <span className="ach-date">получено {new Date(got).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span>
              ) : (
                <span className="ach-prog">
                  <span className="bar">
                    <i style={{ width: `${(cur / max) * 100}%` }} />
                  </span>
                  <span className="muted">
                    {cur} / {max}
                  </span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AchievementsPage() {
  const p = useProgress();
  const s = streak(p);
  const courses = manifest.courses.filter((c) => !c.meta.draft || import.meta.env.DEV);
  const all = [...GLOBAL, ...courses.flatMap(courseAchievements)];
  const got = all.filter((a) => p.achievements[a.id]).length;
  return (
    <main className="page narrow">
      <h1 className="display" style={{ margin: '0 0 6px', fontSize: 32 }}>
        Достижения
      </h1>
      <p className="muted" style={{ margin: '0 0 24px' }}>
        Получено {got} из {all.length}.
      </p>

      <section className="panel ach-streak">
        <div>
          <div className="ws-section-title">Серия</div>
          <b className="big-num">
            {s.current} {plural(s.current, 'день', 'дня', 'дней')}
          </b>
          <span className="muted">рекорд — {s.best}</span>
        </div>
        <WeekRow p={p} />
        <div className="ach-heat">
          <Heatmap p={p} weeks={26} />
        </div>
      </section>

      <h2 className="sec-title">Общие</h2>
      <AchList list={GLOBAL} />
      {courses.map((c) => (
        <section key={c.id}>
          <h2 className="sec-title">
            <Link to={`/c/${c.id}`}>{c.meta.title}</Link>
          </h2>
          <AchList list={courseAchievements(c)} />
        </section>
      ))}
    </main>
  );
}
