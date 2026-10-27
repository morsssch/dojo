import { Link, useParams } from 'react-router-dom';
import { findCourse, lessonHref } from '../content';
import { notesList } from '../state/notes';
import { progress, useProgress } from '../state/progress';
import { Markdown } from '../components/Markdown';
import { I } from '../components/ui/icons';

export function NotesPage() {
  const { course: cid } = useParams();
  const c = findCourse(cid);
  const p = useProgress();
  if (!c) return <div className="page empty">Курс не найден.</div>;
  const notes = notesList(p, c.id);
  const lessons = c.modules.flatMap((m) => m.lessons.map((l) => ({ m, l })));
  const order = (key: string) => lessons.findIndex((x) => x.l.key === key);
  notes.sort((a, b) => order(a.lesson) - order(b.lesson) || a.step - b.step);

  const exportMd = () => {
    let md = `# Заметки: ${c.meta.title}\n`;
    let lastLesson = '';
    for (const n of notes) {
      const x = lessons.find((y) => y.l.key === n.lesson);
      if (n.lesson !== lastLesson) md += `\n## ${x?.l.meta.title ?? n.lesson}\n`;
      lastLesson = n.lesson;
      md += `\n### Шаг ${n.step + 1}\n\n${n.text.trim()}\n`;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = `notes-${c.id}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  let lastLesson = '';
  return (
    <main className="page narrow">
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h1 className="display" style={{ margin: 0, fontSize: 32 }}>
          Заметки
        </h1>
        {notes.length > 0 && (
          <button className="btn small" onClick={exportMd}>
            <I.download /> Скачать .md
          </button>
        )}
      </div>
      <p className="muted" style={{ margin: '0 0 24px' }}>
        {c.meta.title}. {notes.length ? `Заметок: ${notes.length}.` : 'Пока пусто: открой урок и нажми «Заметка» или выдели текст в уроке.'}
      </p>
      {notes.map((n) => {
        const x = lessons.find((y) => y.l.key === n.lesson);
        const head = n.lesson !== lastLesson;
        lastLesson = n.lesson;
        return (
          <section key={`${n.lesson}#${n.step}`}>
            {head && (
              <h2 className="sec-title">
                {x?.l.meta.title ?? n.lesson} <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>{x?.m.meta.title}</span>
              </h2>
            )}
            <div className="panel note-card">
              <div className="row-between">
                <Link to={lessonHref(c.id, n.lesson, n.step)} className="muted" style={{ fontSize: 13 }}>
                  Шаг {n.step + 1}: {x?.l.steps[n.step]?.title ?? ''}
                </Link>
                <button className="btn ghost small" onClick={() => confirm('Удалить заметку?') && progress.setNote(c.id, n.lesson, n.step, '')}>
                  <I.x width={14} height={14} /> Удалить
                </button>
              </div>
              <Markdown text={n.text} />
            </div>
          </section>
        );
      })}
    </main>
  );
}
