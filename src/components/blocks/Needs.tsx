import { Link } from 'react-router-dom';
import { findCourse, lessonHref, useLessonCtx } from '../../content';
import { lessonStatus, useProgress } from '../../state/progress';

/** «Нужно знать»: ссылки на уроки, на которых держится задача. Непройденные подсвечены. */
export function Needs({ links }: { links?: string[] }) {
  const { courseId } = useLessonCtx();
  const p = useProgress();
  const c = findCourse(courseId);
  if (!links?.length || !c) return null;
  const items = links.flatMap((link) => {
    const [m, l] = link.split('/');
    const mod = c.modules.find((x) => x.id === m);
    if (!mod) return [];
    return l ? mod.lessons.filter((x) => x.id === l) : mod.lessons.slice(0, 1);
  });
  if (!items.length) return null;
  return (
    <div className="needs">
      <span className="needs-label">Опирается на</span>
      {items.map((l) => {
        const done = lessonStatus(p, c.id, l).done;
        return (
          <Link key={l.key} to={lessonHref(c.id, l.key)} className={`needs-chip${done ? ' done' : ''}`} title={done ? 'пройдено' : 'ещё не пройдено'}>
            {l.meta.title}
          </Link>
        );
      })}
    </div>
  );
}
