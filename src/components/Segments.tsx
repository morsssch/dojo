// Рендер шага урока: markdown вперемешку с интерактивными блоками.
import type { Segment } from '../core/parse';
import { Markdown } from './Markdown';
import { Anim } from './blocks/Anim';
import { BlockError } from './blocks/common';
import { GitTask } from './blocks/Git';
import { Mermaid } from './blocks/Mermaid';
import { Playground } from './blocks/Playground';
import { Project } from './blocks/Project';
import { Quiz } from './blocks/Quiz';
import { Task } from './blocks/Task';
import { Cards } from './blocks/Cards';
import { Written } from './blocks/Written';

export function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.kind === 'md') return <Markdown key={i} text={s.text} />;
        if (s.kind === 'mermaid') return <Mermaid key={i} code={s.code} />;
        if (s.kind === 'playground') return <Playground key={i} data={s.data} />;
        if (s.error || !s.data) return <BlockError key={i} error={s.error ?? 'Блок не распознан'} raw={s.raw} />;
        switch (s.type) {
          case 'quiz':
            return <Quiz key={s.id} id={s.id} data={s.data} />;
          case 'task':
            return <Task key={s.id} id={s.id} data={s.data} />;
          case 'git':
            return <GitTask key={s.id} id={s.id} data={s.data} />;
          case 'anim':
            return <Anim key={s.id} data={s.data} />;
          case 'project':
            return <Project key={s.id} id={s.id} data={s.data} />;
          case 'cards':
            return <Cards key={s.id} id={s.id} data={s.data} />;
          case 'written':
            return <Written key={s.id} id={s.id} data={s.data} />;
        }
      })}
    </>
  );
}
