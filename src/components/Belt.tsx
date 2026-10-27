// Прогресс курса: обычный прогресс-бар + отдельно значок пояса, которому он соответствует.
import type { CourseInfo } from '../core/manifest';
import { beltFor, courseStatus, ProgressState } from '../state/progress';

/** Значок завязанного пояса цвета уровня. */
export function BeltBadge({ color, size = 44 }: { color: string; size?: number }) {
  return (
    <svg className="belt-badge" width={size} height={size * 0.62} viewBox="0 0 64 40" aria-hidden>
      <g fill={color} stroke="var(--belt-edge)" strokeWidth="1.5" strokeLinejoin="round">
        <rect x="2" y="9" width="60" height="9" rx="1.5" />
        <path d="M27 17 L19 37 L26 38 L31 21 Z" />
        <path d="M37 17 L45 37 L38 38 L33 21 Z" />
        <rect x="26" y="7" width="12" height="13" rx="2" />
      </g>
    </svg>
  );
}

export function CourseProgress({ course, p, compact }: { course: CourseInfo; p: ProgressState; compact?: boolean }) {
  const st = courseStatus(p, course);
  const pct = Math.round(st.pct * 100);
  const { current, next } = beltFor(course, st.pct);
  const toNext = next ? Math.max(1, Math.round((next.at - st.pct) * 100)) : 0;

  if (compact)
    return (
      <div className="cprog compact">
        <div className="cprog-row">
          <span className="cprog-pct">{pct}%</span>
          <span className="belt-chip">
            <BeltBadge color={current.color} size={26} /> {current.name}
          </span>
        </div>
        <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    );

  return (
    <div className="cprog">
      <div className="cprog-main">
        <div className="cprog-row">
          <span className="cprog-pct">{pct}%</span>
          <span className="muted">
            {st.done} из {st.total} уроков, {st.solved} из {st.required} заданий
          </span>
        </div>
        <div className="bar big" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Прогресс курса">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="cprog-belt">
        <BeltBadge color={current.color} />
        <div>
          <div className="belt-name">{current.name}</div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {next ? `до пояса «${next.name.replace(/ пояс$/, '').toLowerCase()}» ещё ${toNext}%` : 'высший уровень'}
          </div>
        </div>
      </div>
    </div>
  );
}
