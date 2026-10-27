// Разминка: случайная задача с Codewars по уже пройденным темам. Открывается ссылкой — решается на самом Codewars.
import { useMemo, useState } from 'react';
import { manifest } from '../content';
import { moduleStatus, progress, useProgress } from '../state/progress';
import { I } from './ui/icons';

interface Kata {
  slug: string;
  title: string;
  rank?: string;
  after?: string;
  lang: string;
  course: string;
}

export function Warmup() {
  const p = useProgress();
  const [any, setAny] = useState(false);
  const [seed, setSeed] = useState(() => Math.random());

  const all = useMemo<Kata[]>(
    () => manifest.courses.flatMap((c) => (c.meta.codewars?.katas ?? []).map((k) => ({ ...k, lang: c.meta.codewars!.lang, course: c.id }))),
    [],
  );
  if (!all.length) return null;

  const unlocked = (k: Kata) => {
    if (!k.after) return true;
    const c = manifest.courses.find((x) => x.id === k.course);
    const m = c?.modules.find((x) => x.id === k.after);
    return !!c && !!m && moduleStatus(p, c.id, m).done > 0;
  };
  const solved = p.katas ?? {};
  const open = all.filter((k) => (any || unlocked(k)) && !solved[k.slug]);
  const pick = open.length ? open[Math.floor(seed * open.length) % open.length] : null;
  const doneCount = all.filter((k) => solved[k.slug]).length;

  return (
    <section className="panel warmup">
      <h3 className="row-between">
        Разминка
        <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
          решено {doneCount} из {all.length}
        </span>
      </h3>
      {pick ? (
        <>
          <div className="wu-kata">
            <span className="tag">{pick.rank ?? 'kata'}</span>
            <b>{pick.title}</b>
          </div>
          <p className="muted" style={{ margin: '4px 0 12px', fontSize: 13.5 }}>
            Задача на Codewars, язык — {pick.lang === 'go' ? 'Go' : pick.lang}. Реши там и отметь здесь.
          </p>
          <div className="row-btns">
            <a className="btn primary small" href={`https://www.codewars.com/kata/${pick.slug}/train/${pick.lang}`} target="_blank" rel="noreferrer">
              Открыть на Codewars
            </a>
            <button className="btn small" onClick={() => progress.setKata(pick.slug, true)}>
              <I.check width={14} height={14} /> Решил
            </button>
            <button className="btn ghost small" onClick={() => setSeed(Math.random())} title="Другая задача">
              <I.reset width={14} height={14} /> Другая
            </button>
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>
          {all.some((k) => !solved[k.slug]) ? 'Задачи откроются, когда пройдёшь первые уроки модулей.' : 'Все задачи разминки решены.'}
        </p>
      )}
      <label className="wu-any">
        <input type="checkbox" checked={any} onChange={(e) => setAny(e.target.checked)} /> любые темы, не только пройденные
      </label>
    </section>
  );
}
