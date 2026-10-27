// Заметки ученика к шагам уроков. Хранятся в общем прогрессе (уходят в экспорт и синк).
import type { ProgressState } from './progress';

export interface NoteRef {
  course: string;
  lesson: string;
  step: number;
  text: string;
  at: number;
}

export function notesList(p: ProgressState, course?: string): NoteRef[] {
  const out: NoteRef[] = [];
  for (const [c, notes] of Object.entries(p.notes ?? {})) {
    if (course && c !== course) continue;
    for (const [k, n] of Object.entries(notes)) {
      if (!n.text.trim()) continue; // удалённая заметка: пустой текст хранится, чтобы удаление дошло через синк
      const i = k.lastIndexOf('#');
      out.push({ course: c, lesson: k.slice(0, i), step: Number(k.slice(i + 1)), text: n.text, at: n.at });
    }
  }
  return out;
}

export const noteOf = (p: ProgressState, course: string, lesson: string, step: number) => p.notes?.[course]?.[`${lesson}#${step}`]?.text ?? '';
