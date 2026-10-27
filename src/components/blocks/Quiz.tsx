import { useMemo, useState } from 'react';
import type { QuizBlock } from '../../core/schema';
import { useLessonCtx } from '../../content';
import { progress, useProgress } from '../../state/progress';
import { highlight, Markdown } from '../Markdown';
import { I, KindIcon } from '../ui/icons';
import { Hints } from './common';
import { OrderList } from './OrderList';

type Opt = { text: string; correct: boolean; why?: string };

const normOpts = (q: QuizBlock): Opt[] => (q.options ?? []).map((o) => (typeof o === 'string' ? { text: o, correct: false } : { text: o.text, correct: !!o.correct, why: o.why }));

/** Детерминированное перемешивание — чтобы порядок не прыгал при перерисовке. */
function shuffle<T>(xs: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  // не показываем правильный порядок сразу
  if (a.every((x, i) => x === xs[i]) && a.length > 1) [a[0], a[1]] = [a[1], a[0]];
  return a;
}

/** markdown → простой текст для <option> */
const plain = (s: string) => s.replace(/`([^`]*)`/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1');

function checkText(q: QuizBlock, input: string): boolean {
  const val = input.trim();
  const answers = Array.isArray(q.answer) ? q.answer : q.answer !== undefined ? [q.answer] : [];
  return answers.some((a) => {
    const s = String(a);
    const re = s.match(/^\/(.+)\/([a-z]*)$/);
    if (re) return new RegExp(re[1], re[2]).test(val);
    return s.trim().toLowerCase().replace(/\s+/g, ' ') === val.toLowerCase().replace(/\s+/g, ' ');
  });
}

export function Quiz({ data: q, id }: { data: QuizBlock; id: string }) {
  const { courseId, lessonKey } = useLessonCtx();
  const p = useProgress();
  const solved = !!p.courses[courseId]?.solved[lessonKey]?.[id];
  const opts = useMemo(() => normOpts(q), [q]);
  const multi = q.kind === 'multiple' || (q.kind === 'single' && opts.filter((o) => o.correct).length > 1);
  const [sel, setSel] = useState<number[]>(() => (solved ? opts.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0) : []));
  const [text, setText] = useState('');
  const [order, setOrder] = useState<number[]>(() => (solved ? opts.map((_, i) => i) : shuffle(opts.map((_, i) => i), id)));
  const [result, setResult] = useState<null | boolean>(solved ? true : null);
  const pairs = q.pairs ?? [];
  const rightOrder = useMemo(() => shuffle(pairs.map((_, i) => i), id + ':r'), [pairs, id]);
  const [match, setMatch] = useState<(number | null)[]>(() => pairs.map((_, i) => (solved ? i : null)));
  const attempts = p.courses[courseId]?.attempts[`${lessonKey}#${id}`] ?? 0;
  const locked = result === true;

  const submit = () => {
    let ok = false;
    if (q.kind === 'text') ok = checkText(q, text);
    else if (q.kind === 'number') {
      const n = Number(text.replace(',', '.'));
      ok = !Number.isNaN(n) && Math.abs(n - Number(q.answer)) <= (q.tolerance ?? 1e-9);
    } else if (q.kind === 'order') ok = order.every((v, i) => v === i);
    else if (q.kind === 'match') ok = match.every((v, i) => v === i);
    else {
      const want = opts.map((o, i) => (o.correct ? i : -1)).filter((i) => i >= 0);
      ok = want.length === sel.length && want.every((i) => sel.includes(i));
    }
    progress.attempt(courseId, lessonKey, id);
    setResult(ok);
    if (ok) progress.solve(courseId, lessonKey, id);
  };

  const toggle = (i: number) => {
    if (locked) return;
    setResult(null);
    setSel((s) => (multi ? (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]) : [i]));
  };

  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= order.length) return;
    setResult(null);
    setOrder((o) => {
      const a = o.slice();
      const [x] = a.splice(from, 1);
      a.splice(to, 0, x);
      return a;
    });
  };

  const canSubmit =
    q.kind === 'text' || q.kind === 'number' ? text.trim() !== '' : q.kind === 'order' ? true : q.kind === 'match' ? match.every((v) => v !== null) : sel.length > 0;

  return (
    <div className={`block quiz${solved ? ' solved' : ''}`}>
      <div className="block-head">
        <span className="kind">
          <KindIcon kind="quiz" /> {q.kind === 'multiple' || multi ? 'Несколько ответов' : q.kind === 'order' ? 'Расставь по порядку' : q.kind === 'match' ? 'Сопоставь' : q.kind === 'text' || q.kind === 'number' ? 'Впиши ответ' : 'Один ответ'}
        </span>
        <span className="right">{solved && <span className="tag ok">решено</span>}</span>
      </div>
      <div className="block-body">
        <div className="q-question">
          <Markdown text={q.question} />
          {q.code && (
            <div className="md">
              <pre>
                <code className="hljs" dangerouslySetInnerHTML={{ __html: highlight(q.code, q.lang ?? 'go') }} />
              </pre>
            </div>
          )}
        </div>

        {(q.kind === 'single' || q.kind === 'multiple') && (
          <div className="q-options" role={multi ? 'group' : 'radiogroup'}>
            {opts.map((o, i) => {
              const picked = sel.includes(i);
              const show = result !== null && picked;
              const cls = ['q-opt', multi ? 'multi' : '', picked ? 'sel' : '', show ? (o.correct ? 'right' : 'wrong') : '', locked && o.correct ? 'right' : ''].join(' ');
              return (
                <button key={i} type="button" className={cls} onClick={() => toggle(i)} role={multi ? 'checkbox' : 'radio'} aria-checked={picked}>
                  <span className="mark">{picked && <I.check width={13} height={13} strokeWidth={3} />}</span>
                  <Markdown text={o.text} />
                  {o.why && (show || locked) && (
                    <div className="why">
                      <Markdown text={o.why} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {(q.kind === 'text' || q.kind === 'number') && (
          <input
            className="q-input"
            value={locked && !text ? String(Array.isArray(q.answer) ? q.answer[0] : (q.answer ?? '')).replace(/^\/|\/\w*$/g, '') : text}
            disabled={locked}
            inputMode={q.kind === 'number' ? 'decimal' : 'text'}
            placeholder={q.kind === 'number' ? 'Число' : 'Ответ'}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && !locked && submit()}
            aria-label="Ответ"
          />
        )}

        {q.kind === 'match' && (
          <div className="match">
            {pairs.map((pr, i) => {
              const v = match[i];
              const state = result === null || v === null ? '' : v === i ? ' right' : ' wrong';
              return (
                <div key={i} className={`match-row${state}`}>
                  <div className="match-left">
                    <Markdown text={pr.left} />
                  </div>
                  <span className="match-arrow" aria-hidden>
                    →
                  </span>
                  <div className="match-right">
                    <select
                      value={v ?? ''}
                      disabled={locked}
                      aria-label={`Пара для варианта ${i + 1}`}
                      onChange={(e) => {
                        const n = e.target.value === '' ? null : Number(e.target.value);
                        setResult(null);
                        setMatch((m) => m.map((x, k) => (k === i ? n : x === n && n !== null ? null : x)));
                      }}
                    >
                      <option value="">— выбери —</option>
                      {rightOrder.map((ri) => (
                        <option key={ri} value={ri}>
                          {plain(pairs[ri].right)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {q.kind === 'order' && <OrderList order={order} locked={locked} onMove={move} render={(oi) => <Markdown text={opts[oi].text} />} />}

        {result !== null && (q.explain || result) && (result || attempts >= 2) && q.explain && (
          <div className="explain">
            <Markdown text={q.explain} />
          </div>
        )}
        {!locked && <Hints hints={q.hints} attempts={attempts} />}
      </div>
      <div className="block-foot">
        {!locked && (
          <button className="btn primary" disabled={!canSubmit} onClick={submit}>
            Проверить
          </button>
        )}
        {result === true && (
          <span className="verdict ok">
            <I.check /> Верно
          </span>
        )}
        {result === false && (
          <span className="verdict bad">
            <I.x /> Неверно{attempts >= 2 && q.explain ? ' — посмотри объяснение' : ', попробуй ещё'}
          </span>
        )}
        <span className="grow" />
        {locked && (
          <button
            className="btn ghost small"
            onClick={() => {
              setResult(null);
              setSel([]);
              setText('');
              setOrder(shuffle(opts.map((_, i) => i), id + attempts));
              setMatch(pairs.map(() => null));
            }}
          >
            <I.reset /> Решить снова
          </button>
        )}
      </div>
    </div>
  );
}
