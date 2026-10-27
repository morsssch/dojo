// Небольшой набор иконок (stroke, 24×24). Без сторонних библиотек.
import type { SVGProps } from 'react';

const P = (d: string | string[]) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
        {(Array.isArray(d) ? d : [d]).map((x, i) => (
          <path key={i} d={x} />
        ))}
      </svg>
    );
  };

export const I = {
  check: P('M5 12.5l4.5 4.5L19 7'),
  x: P(['M6 6l12 12', 'M18 6L6 18']),
  chevron: P('M9 6l6 6-6 6'),
  chevronLeft: P('M15 6l-6 6 6 6'),
  play: P('M7 5l12 7-12 7z'),
  book: P(['M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z', 'M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5']),
  quiz: P(['M9.2 9a3 3 0 115.6 1.5c-.8 1-2.3 1.5-2.6 3', 'M12 17.5v.01', 'M12 2.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z']),
  code: P(['M8 7l-5 5 5 5', 'M16 7l5 5-5 5', 'M14 4l-4 16']),
  branch: P(['M6 3v12', 'M18 9a3 3 0 100-6 3 3 0 000 6z', 'M6 21a3 3 0 100-6 3 3 0 000 6z', 'M18 9a9 9 0 01-9 9']),
  film: P(['M3 5h18v14H3z', 'M3 9h18', 'M8 5l2 4', 'M14 5l2 4']),
  hammer: P(['M14 6l4 4', 'M3 21l9-9', 'M12.5 3.5l8 8-3 3-8-8z']),
  map: P(['M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z', 'M9 4v14', 'M15 6v14']),
  flame: P('M12 22c4 0 7-2.7 7-6.8 0-3.6-2.3-6.1-4-8.2-.4 2-1.3 3.2-2.6 3.8C12.8 7.4 11.6 4.5 9 2.5c.3 3-1.5 5.1-3 7.1C4.9 11.1 5 12.4 5 15.2 5 19.3 8 22 12 22z'),
  settings: P(['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z']),
  sun: P(['M12 17a5 5 0 100-10 5 5 0 000 10z', 'M12 1v2', 'M12 21v2', 'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4', 'M1 12h2', 'M21 12h2', 'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4']),
  moon: P('M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'),
  menu: P(['M4 6h16', 'M4 12h16', 'M4 18h16']),
  reset: P(['M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8', 'M3 3v5h5']),
  bulb: P(['M9 18h6', 'M10 22h4', 'M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z']),
  eye: P(['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 100-6 3 3 0 000 6z']),
  download: P(['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14']),
  upload: P(['M12 21V9', 'M7 14l5-5 5 5', 'M5 3h14']),
  terminal: P(['M4 17l6-6-6-6', 'M12 19h8']),
  db: P(['M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z', 'M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3']),
  pause: P(['M7 5v14', 'M17 5v14']),
  next: P(['M5 5l10 7-10 7z', 'M19 5v14']),
  prev: P(['M19 5L9 12l10 7z', 'M5 5v14']),
  sandbox: P(['M4 4h16v16H4z', 'M4 9h16', 'M9 9v11']),
  trophy: P(['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 01-10 0z', 'M17 5h3v2a3 3 0 01-3 3', 'M7 5H4v2a3 3 0 003 3']),
  copy: P(['M9 9h11v11H9z', 'M5 15H4V4h11v1']),
  expand: P(['M15 3h6v6', 'M9 21H3v-6', 'M21 3l-7 7', 'M3 21l7-7']),
  shrink: P(['M4 14h6v6', 'M20 10h-6V4', 'M14 10l7-7', 'M3 21l7-7']),
  sidebar: P(['M3 4h18v16H3z', 'M9 4v16']),
  table: P(['M3 4h18v16H3z', 'M3 10h18', 'M3 15h18', 'M9 10v10']),
  grip: P(['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01']),
  cards: P(['M4 6h12v14H4z', 'M8 2h12v14', 'M7 11h6', 'M7 15h4']),
  pen: P(['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4']),
  search: P(['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M21 21l-5-5']),
  note: P(['M5 3h10l4 4v14H5z', 'M15 3v4h4', 'M8 12h8', 'M8 16h6']),
  quote: P(['M7 7h4v4c0 3-2 5-4 6', 'M15 7h4v4c0 3-2 5-4 6']),
  // значки ачивок
  flag: P(['M5 21V4', 'M5 4h11l-2 4 2 4H5']),
  checkCircle: P(['M12 2.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z', 'M8 12.5l2.7 2.7L16 9.8']),
  bolt: P('M13 2L4 14h7l-1 8 9-12h-7z'),
  cpu: P(['M6 6h12v12H6z', 'M9 9h6v6H9z', 'M9 2v4', 'M15 2v4', 'M9 18v4', 'M15 18v4', 'M2 9h4', 'M2 15h4', 'M18 9h4', 'M18 15h4']),
  target: P(['M12 2.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z', 'M12 7a5 5 0 100 10 5 5 0 000-10z', 'M12 11a1 1 0 100 2 1 1 0 000-2z']),
  calendar: P(['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4']),
  calendarCheck: P(['M4 5h16v16H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4', 'M9 15l2 2 4-4']),
  mountain: P(['M3 20l6-11 4 6 3-4 5 9z', 'M9 9l1.6 2.8']),
  package: P(['M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z', 'M3 7.5l9 4.5 9-4.5', 'M12 12v9']),
  half: P(['M12 2.5a9.5 9.5 0 100 19 9.5 9.5 0 000-19z', 'M12 2.5v19']),
  layers: P(['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5', 'M3 17.5l9 5 9-5']),
  belt: P(['M2 10h20v4H2z', 'M10 14l-2 7', 'M14 14l2 7', 'M10 9h4v6h-4z']),
};

/** Иконка вида шага/блока */
export function KindIcon({ kind, ...p }: { kind: string } & SVGProps<SVGSVGElement>) {
  const map: Record<string, keyof typeof I> = { theory: 'book', quiz: 'quiz', task: 'code', git: 'branch', anim: 'film', project: 'hammer', cards: 'cards', written: 'pen', lab: 'layers' };
  const C = I[map[kind] ?? 'book'];
  return <C {...p} />;
}

export const KIND_LABEL: Record<string, string> = {
  theory: 'Теория',
  quiz: 'Вопрос',
  task: 'Задача',
  git: 'Git-практика',
  anim: 'Схема',
  project: 'Проект',
  cards: 'Карточки',
  written: 'Письменный ответ',
  lab: 'Лаба',
};
