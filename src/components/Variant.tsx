// Выбор варианта курса (course.yaml → variants): от него зависит, какие блоки ```variant видит ученик.
import type { CourseInfo } from '../core/manifest';
import { progress, useProgress } from '../state/progress';
import { useState } from 'react';
import { I } from './ui/icons';

function groupVariant(c: CourseInfo, groupNumber?: number) {
  const v = c.meta.variants!;
  if (!groupNumber || !v.byGroup) return undefined;
  const count = v.options.length;
  return v.options[(groupNumber - 1) % count]?.id;
}

function Options({ course: c, compact }: { course: CourseInfo; compact?: boolean }) {
  const p = useProgress();
  const v = c.meta.variants!;
  const cp = p.courses[c.id];
  const cur = groupVariant(c, cp?.groupNumber) ?? cp?.variant;
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
  const [rawGroup, setRawGroup] = useState(() => String(p.courses[c.id]?.groupNumber ?? ''));
  if (!v) return null;
  const cp = p.courses[c.id];
  const chosen = !!cp?.variant || !!cp?.groupNumber;
  const saveGroup = () => {
    const n = Number(rawGroup);
    if (Number.isSafeInteger(n) && n > 0) progress.setGroupNumber(c.id, n);
  };
  return (
    <div className="panel variant-panel">
      <h3 className="row-between">
        {v.label ?? 'Вариант'}
        {!chosen && <span className="tag">не выбран</span>}
      </h3>
      <p className="muted">От варианта зависят задания и прогресс. Можно выбрать его вручную или указать номер в списке группы.</p>
      {v.byGroup && (
        <label className="variant-group">
          <span>Номер в списке группы</span>
          <span className="row">
            <input type="number" min="1" step="1" value={rawGroup} onChange={(e) => setRawGroup(e.target.value)} onBlur={saveGroup} onKeyDown={(e) => e.key === 'Enter' && saveGroup()} placeholder="например, 7" />
            {cp?.groupNumber && <span className="muted">→ {groupVariant(c, cp.groupNumber)}</span>}
          </span>
        </label>
      )}
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
