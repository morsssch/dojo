// Выбор варианта курса (course.yaml → variants): от него зависит, какие блоки ```variant видит ученик.
import { useEffect, useId, useState } from 'react';
import type { CourseInfo } from '../core/manifest';
import { progress, useProgress } from '../state/progress';
import { I } from './ui/icons';

function groupOption(c: CourseInfo, groupNumber?: number) {
  const v = c.meta.variants!;
  if (!groupNumber || !v.byGroup) return undefined;
  return v.options[(groupNumber - 1) % v.options.length];
}

function groupVariant(c: CourseInfo, groupNumber?: number) {
  return groupOption(c, groupNumber)?.id;
}

function parseGroupNumber(raw: string): { value?: number; error?: string } {
  const value = raw.trim();
  if (!value) return { error: 'Введи свой номер в списке группы.' };
  if (!/^\d+$/.test(value)) return { error: 'Используй только целое положительное число.' };
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return { error: 'Номер слишком большой. Введи целое число поменьше.' };
  if (number < 1) return { error: 'Номер в списке начинается с 1.' };
  return { value: number };
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
  const cp = p.courses[c.id];
  const [rawGroup, setRawGroup] = useState(() => String(cp?.groupNumber ?? ''));
  const [wasChecked, setWasChecked] = useState(false);
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  useEffect(() => {
    setRawGroup(String(cp?.groupNumber ?? ''));
    setWasChecked(false);
  }, [c.id, cp?.groupNumber]);

  if (!v) return null;
  const chosen = !!cp?.variant || !!cp?.groupNumber;
  const parsedGroup = parseGroupNumber(rawGroup);
  const preview = groupOption(c, parsedGroup.value);
  const hasError = wasChecked && !!parsedGroup.error;
  const storedOption = groupOption(c, cp?.groupNumber);
  const applyGroup = () => {
    setWasChecked(true);
    if (parsedGroup.value) progress.setGroupNumber(c.id, parsedGroup.value);
  };

  return (
    <div className="panel variant-panel">
      <h3 className="row-between">
        {v.label ?? 'Вариант'}
        {!chosen && <span className="tag">не выбран</span>}
      </h3>
      <p className="muted">От варианта зависят задания и прогресс. Выбери его вручную или рассчитай по номеру в списке группы.</p>
      {v.byGroup && (
        <form
          className="variant-group"
          onSubmit={(event) => {
            event.preventDefault();
            applyGroup();
          }}
          noValidate
        >
          <div className="variant-group-head">
            <label htmlFor={inputId}>Номер в списке группы</label>
            <span id={hintId} className="muted">Варианты идут по кругу: после последнего снова первый.</span>
          </div>
          <div className="variant-group-control">
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={rawGroup}
              onChange={(event) => setRawGroup(event.target.value)}
              onBlur={() => setWasChecked(true)}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? `${hintId} ${errorId}` : hintId}
              placeholder="Например, 7"
            />
            <button className="btn small primary" type="submit">Определить</button>
          </div>
          {hasError ? (
            <span id={errorId} className="variant-group-message error" role="alert">{parsedGroup.error}</span>
          ) : storedOption ? (
            <span className="variant-group-message" aria-live="polite">Твой номер — {cp!.groupNumber}. Тебе соответствует <b>{storedOption.title}</b>.</span>
          ) : preview ? (
            <span className="variant-group-message" aria-live="polite">Будет выбран <b>{preview.title}</b>.</span>
          ) : null}
        </form>
      )}
      <div className="variant-manual">
        <span className="variant-manual-label">Или выбери вручную</span>
        <Options course={c} compact />
      </div>
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
