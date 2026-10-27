// Пояс — главный визуальный маркер прогресса. Цвет = уровень, полоски на конце = модули.
import type { CourseInfo } from '../core/manifest';
import { beltFor, courseStatus, moduleStatus, ProgressState } from '../state/progress';

export function Belt({ course, p, compact }: { course: CourseInfo; p: ProgressState; compact?: boolean }) {
  const st = courseStatus(p, course);
  const { current, next } = beltFor(course, st.pct);
  const mods = course.modules.filter((m) => !m.meta.draft && m.lessons.some((l) => !l.meta.draft));
  // Не больше 12 полосок, иначе пояс превращается в штрихкод.
  const stripes = mods.length <= 12 ? mods.map((m) => moduleStatus(p, course.id, m).pct) : chunk(mods.map((m) => moduleStatus(p, course.id, m).pct), 12);
  return (
    <div className="belt-wrap">
      <div className="belt" style={{ ['--belt' as string]: current.color }} role="img" aria-label={`${current.name}, пройдено ${Math.round(st.pct * 100)}%`}>
        {stripes.length > 0 && (
          <div className="belt-tip">
            {stripes.map((s, i) => (
              <i key={i} className={s >= 1 ? 'on' : s > 0 ? 'part' : ''} style={{ ['--p' as string]: `${Math.round(s * 100)}%` }} />
            ))}
          </div>
        )}
      </div>
      {!compact && (
        <div className="belt-meta">
          <span className="belt-name">{current.name}</span>
          <span className="muted">
            {Math.round(st.pct * 100)}% курса
            {next ? ` · до «${next.name.toLowerCase()}» ещё ${Math.max(1, Math.round((next.at - st.pct) * 100))}%` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function chunk(xs: number[], n: number): number[] {
  const size = Math.ceil(xs.length / n);
  const out: number[] = [];
  for (let i = 0; i < xs.length; i += size) {
    const part = xs.slice(i, i + size);
    out.push(part.reduce((a, b) => a + b, 0) / part.length);
  }
  return out;
}
