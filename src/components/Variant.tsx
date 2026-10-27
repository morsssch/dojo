// Выбор варианта курса (course.yaml → variants): от него зависит, какие блоки ```variant видит ученик.
import type { CourseInfo } from '../core/manifest';
import { progress, useProgress } from '../state/progress';
import { I } from './ui/icons';

function Options({ course: c, compact }: { course: CourseInfo; compact?: boolean }) {
  const p = useProgress();
  const v = c.meta.variants!;
  const cur = p.courses[c.id]?.variant;
  return (
    <div className={`variant-opts${compact ? ' compact' : ''}`} role="radiogroup" aria-label={v.label ?? 'Вариант'}>
      {v.options.map((o) => {
        const on = cur === o.id;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} className={`variant-opt${on ? ' on' : ''}`} onClick={() => progress.setVariant(c.id, o.id)}>
            <span className="variant-radio">{on && <I.check width={12} height={12} />}</span>
            <span className="variant-text">
              <b>{o.title}</b>
              {o.description && <span>{o.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Панель на странице курса. */
export function VariantSelect({ course: c }: { course: CourseInfo }) {
  const p = useProgress();
  const v = c.meta.variants;
  if (!v) return null;
  const chosen = !!p.courses[c.id]?.variant;
  return (
    <div className="panel variant-panel">
      <h3 className="row-between">
        {v.label ?? 'Вариант'}
        {!chosen && <span className="tag">не выбран</span>}
      </h3>
      <p className="muted">От него зависят часть заданий и прогресс. Поменять можно в любой момент.</p>
      <Options course={c} compact />
    </div>
  );
}

/** Плашка в уроке, пока вариант не выбран. */
export function VariantPicker({ course: c }: { course: CourseInfo }) {
  const v = c.meta.variants;
  if (!v) return null;
  return (
    <div className="variant-picker">
      <div className="variant-picker-head">
        <b>Выбери {(v.label ?? 'вариант').toLowerCase()}</b>
        <span className="muted">Дальше в уроке задания под него. Пока показан «{v.options[0].title}».</span>
      </div>
      <Options course={c} />
    </div>
  );
}
