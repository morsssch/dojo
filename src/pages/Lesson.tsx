import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findCourse, findLesson, LessonCtx, lessonHref, loadLesson, neighbours } from '../content';
import type { Lesson } from '../core/parse';
import { lessonStatus, progress, useProgress } from '../state/progress';
import { Segments } from '../components/Segments';
import { I, KIND_LABEL, KindIcon } from '../components/ui/icons';
import { LessonDot } from './Course';

export function LessonPage() {
  const { course: cid, module: mid, lesson: lid, step: stepParam } = useParams();
  const nav = useNavigate();
  const p = useProgress();
  const c = findCourse(cid);
  const found = c && findLesson(c, mid, lid);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [err, setErr] = useState('');
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 900);
  const step = Math.max(0, Number(stepParam ?? 1) - 1);

  useEffect(() => {
    if (!found) return;
    setLesson(null);
    setErr('');
    loadLesson(found.lesson.file).then(setLesson, (e) => setErr(String(e.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.lesson.file]);

  useEffect(() => {
    if (c && found && lesson && step < lesson.steps.length) progress.visit(c.id, found.lesson.key, step);
  }, [c, found, lesson, step]);

  useEffect(() => {
    if (window.innerWidth < 900) setCollapsed(true);
    window.scrollTo(0, 0);
  }, [step, lid]);

  if (!c || !found) return <div className="page empty">Урок не найден.</div>;
  const { module, lesson: info } = found;
  const key = info.key;
  const go = (s: number) => nav(lessonHref(c.id, key, s));
  const { prev, next } = neighbours(c, key);
  const status = lessonStatus(p, c.id, info);
  const solvedMap = p.courses[c.id]?.solved[key] ?? {};
  const visited = p.courses[c.id]?.visited[key] ?? [];
  const cur = lesson?.steps[Math.min(step, (lesson?.steps.length ?? 1) - 1)];
  const isLast = lesson ? step >= lesson.steps.length - 1 : false;
  const modIndex = c.modules.indexOf(module);

  // чекпоинт: если решено достаточно — предлагаем отметить модуль как изученный
  const pass = info.meta.pass ?? 0.8;
  const checkpointPassed = info.meta.checkpoint && info.required.length > 0 && info.required.filter((id) => solvedMap[id]).length / info.required.length >= pass;
  const moduleKnown = module.lessons.every((l) => l.meta.draft || lessonStatus(p, c.id, l).done);

  return (
    <LessonCtx.Provider value={{ courseId: c.id, lessonKey: key }}>
      <div className={`lesson-layout${collapsed ? ' collapsed' : ''}`}>
        <nav className="toc" aria-label="Уроки курса">
          {c.modules.map((m, mi) => (
            <div key={m.id} className="toc-module">
              <div className="h">
                {mi + 1}. {m.meta.title}
              </div>
              {m.lessons.map((l) => {
                const ls = lessonStatus(p, c.id, l);
                return (
                  <Link key={l.id} to={lessonHref(c.id, l.key)} className={`${l.key === key ? 'active' : ''}${l.meta.draft ? ' draft' : ''}`}>
                    <LessonDot pct={ls.pct} done={ls.done} />
                    {l.meta.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <main className="lesson-main">
          <div className="lesson-head">
            <div className="kicker" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="icon-btn" onClick={() => setCollapsed((x) => !x)} aria-label={collapsed ? 'Показать список уроков' : 'Скрыть список уроков'} title="Список уроков">
                <I.menu />
              </button>
              Модуль {modIndex + 1}. {module.meta.title}
            </div>
            <h1>{info.meta.title}</h1>
            {lesson && (
              <div className="pips" role="tablist" aria-label="Шаги урока">
                {lesson.steps.map((s, i) => {
                  const done = visited.includes(i) && s.required.every((id) => solvedMap[id]);
                  return (
                    <button
                      key={i}
                      role="tab"
                      aria-selected={i === step}
                      className={`pip${i === step ? ' current' : ''}${done ? ' done' : visited.includes(i) ? ' visited' : ''}`}
                      onClick={() => go(i)}
                      title={`${i + 1}. ${s.title} — ${KIND_LABEL[s.kind]}`}
                      aria-label={`Шаг ${i + 1}: ${s.title}`}
                    >
                      <KindIcon kind={s.kind} />
                    </button>
                  );
                })}
              </div>
            )}
            {info.meta.draft && <div className="errors">Этот урок — черновик и ещё не наполнен.</div>}
          </div>

          {err && <div className="step errors">{err}</div>}
          {!lesson && !err && (
            <div className="step">
              <span className="spinner" />
            </div>
          )}
          {lesson && lesson.errors.length > 0 && import.meta.env.DEV && (
            <details className="step errors" open>
              <summary>Ошибки в уроке ({lesson.errors.length})</summary>
              {lesson.errors.join('\n')}
            </details>
          )}
          {cur && (
            <article className="step" key={`${key}-${step}`}>
              <h2 className="step-title">{cur.title}</h2>
              <Segments segments={cur.segments} />
            </article>
          )}

          {lesson && isLast && status.done && (
            <div className="panel lesson-done">
              <span style={{ fontSize: 30 }}>🥋</span>
              <div style={{ flex: 1 }}>
                <b>Урок пройден</b>
                <span className="muted">{next ? `Дальше: ${next.l.meta.title}` : 'Это был последний урок курса.'}</span>
              </div>
              {next && (
                <Link className="btn primary" to={lessonHref(c.id, next.l.key)}>
                  Дальше <I.chevron />
                </Link>
              )}
            </div>
          )}

          {checkpointPassed && !moduleKnown && (
            <div className="panel lesson-done">
              <span style={{ fontSize: 30 }}>🎯</span>
              <div style={{ flex: 1 }}>
                <b>Похоже, ты это уже знаешь</b>
                <span className="muted">Можно отметить весь модуль «{module.meta.title}» как пройденный и идти дальше.</span>
              </div>
              <button
                className="btn primary"
                onClick={() =>
                  progress.setKnown(
                    c.id,
                    module.lessons.filter((l) => !l.meta.draft).map((l) => l.key),
                    true,
                  )
                }
              >
                Отметить модуль
              </button>
            </div>
          )}

          {lesson && (
            <div className="step-nav">
              {step > 0 ? (
                <button className="btn" onClick={() => go(step - 1)}>
                  <I.chevronLeft /> Назад
                </button>
              ) : prev ? (
                <Link className="btn ghost" to={lessonHref(c.id, prev.l.key)}>
                  <I.chevronLeft /> Прошлый урок
                </Link>
              ) : (
                <span />
              )}
              {!isLast ? (
                <button className="btn primary" onClick={() => go(step + 1)}>
                  {cur && cur.required.some((id) => !solvedMap[id]) ? 'Пропустить пока' : 'Дальше'} <I.chevron />
                </button>
              ) : next ? (
                <Link className="btn primary" to={lessonHref(c.id, next.l.key)}>
                  Следующий урок <I.chevron />
                </Link>
              ) : (
                <Link className="btn primary" to={`/c/${c.id}`}>
                  К курсу <I.chevron />
                </Link>
              )}
            </div>
          )}
          {lesson && (
            <div className="step" style={{ marginTop: 16, textAlign: 'right' }}>
              <button
                className="btn ghost small"
                onClick={() => {
                  if (confirm('Сбросить прогресс этого урока? Черновики кода останутся.')) progress.resetLesson(c.id, key);
                }}
              >
                <I.reset /> Сбросить прогресс урока
              </button>
            </div>
          )}
        </main>
      </div>
    </LessonCtx.Provider>
  );
}
