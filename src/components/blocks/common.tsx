import { useState } from 'react';
import { Markdown } from '../Markdown';
import { I } from '../ui/icons';

/** Подсказки открываются по одной, по кнопке. */
export function Hints({ hints, attempts }: { hints?: string[]; attempts: number }) {
  const [shown, setShown] = useState(0);
  if (!hints?.length) return null;
  return (
    <div className="hints">
      {hints.slice(0, shown).map((h, i) => (
        <div key={i} className="hint-item">
          <Markdown text={h} />
        </div>
      ))}
      {shown < hints.length && (
        <div>
          <button className="btn ghost small" onClick={() => setShown((s) => s + 1)}>
            <I.bulb /> {shown ? 'Ещё подсказка' : attempts ? 'Подсказка' : 'Нужна подсказка?'} ({shown + 1}/{hints.length})
          </button>
        </div>
      )}
    </div>
  );
}

export function BlockError({ error, raw }: { error: string; raw?: string }) {
  return (
    <div className="block">
      <div className="block-head">
        <span className="kind" style={{ color: 'var(--bad)' }}>
          <I.x /> Ошибка в блоке (это баг курса)
        </span>
      </div>
      <div className="block-error">
        {error}
        {raw ? `\n\n---\n${raw}` : ''}
      </div>
    </div>
  );
}
