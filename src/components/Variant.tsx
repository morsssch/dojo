// Выбор варианта курса (course.yaml → variants): от него зависит, какие блоки ```variant видит ученик.
import type { CourseInfo } from '../core/manifest';
import { progress, useProgress } from '../state/progress';

export function VariantSelect({ course: c }: { course: CourseInfo }) {
  const p = useProgress();
  const v = c.meta.variants;
  if (!v) return null;
  const cur = p.courses[c.id]?.variant;
  return (
    <label className="variant-select">
      <span>{v.label ?? 'Вариант'}</span>
      <select value={cur ?? ''} onChange={(e) => progress.setVariant(c.id, e.target.value)}>
        {!cur && <option value="">не выбран</option>}
        {v.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Плашка в уроке, пока вариант не выбран: показывает варианты кнопками. */
export function VariantPicker({ course: c }: { course: CourseInfo }) {
  const v = c.meta.variants;
  if (!v) return null;
  return (
    <div className="variant-picker">
      <b>Выбери {(v.label ?? 'вариант').toLowerCase()}</b>
      <span className="muted">Часть заданий зависит от него. Пока показан «{v.options[0].title}». Поменять можно на странице курса.</span>
      <div className="row-btns">
        {v.options.map((o) => (
          <button key={o.id} className="btn small" onClick={() => progress.setVariant(c.id, o.id)} title={o.description}>
            {o.title}
          </button>
        ))}
      </div>
    </div>
  );
}
