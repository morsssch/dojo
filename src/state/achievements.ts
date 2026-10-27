// Ачивки не привязаны к конкретному курсу: считаются по общему прогрессу.
import type { Manifest } from '../core/manifest';
import { courseStatus, moduleStatus, ProgressState, streak } from './progress';

export interface Achievement {
  id: string;
  title: string;
  text: string;
  icon: string;
  test: (p: ProgressState, m: Manifest) => boolean;
}

const totalSolved = (p: ProgressState) =>
  Object.values(p.courses).reduce((a, c) => a + Object.values(c.solved).reduce((b, l) => b + Object.keys(l).length, 0), 0);

const firstTry = (p: ProgressState) =>
  Object.values(p.courses).reduce(
    (a, c) => a + Object.entries(c.solved).reduce((b, [lesson, blocks]) => b + Object.keys(blocks).filter((id) => (c.attempts[`${lesson}#${id}`] ?? 1) <= 1).length, 0),
    0,
  );

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-step', title: 'Первый шаг', text: 'Открыть первый урок', icon: '👣', test: (p) => Object.values(p.courses).some((c) => Object.keys(c.visited).length > 0) },
  { id: 'first-solve', title: 'Работает!', text: 'Решить первое задание', icon: '✅', test: (p) => totalSolved(p) >= 1 },
  { id: 'solve-10', title: 'Разогрелся', text: 'Решить 10 заданий', icon: '🔥', test: (p) => totalSolved(p) >= 10 },
  { id: 'solve-50', title: 'В потоке', text: 'Решить 50 заданий', icon: '⚡', test: (p) => totalSolved(p) >= 50 },
  { id: 'solve-200', title: 'Машина', text: 'Решить 200 заданий', icon: '🤖', test: (p) => totalSolved(p) >= 200 },
  { id: 'sniper', title: 'Снайпер', text: '20 заданий с первой попытки', icon: '🎯', test: (p) => firstTry(p) >= 20 },
  { id: 'streak-3', title: 'Три дня подряд', text: 'Заниматься 3 дня подряд', icon: '📅', test: (p) => streak(p).best >= 3 },
  { id: 'streak-7', title: 'Неделя без пропусков', text: 'Заниматься 7 дней подряд', icon: '🗓️', test: (p) => streak(p).best >= 7 },
  { id: 'streak-30', title: 'Дисциплина', text: 'Заниматься 30 дней подряд', icon: '🏯', test: (p) => streak(p).best >= 30 },
  {
    id: 'module-1',
    title: 'Модуль закрыт',
    text: 'Пройти модуль целиком',
    icon: '📦',
    test: (p, m) => m.courses.some((c) => c.modules.some((mod) => moduleStatus(p, c.id, mod).complete)),
  },
  {
    id: 'half',
    title: 'Экватор',
    text: 'Пройти половину курса',
    icon: '🌓',
    test: (p, m) => m.courses.some((c) => courseStatus(p, c).pct >= 0.5),
  },
  {
    id: 'black-belt',
    title: 'Чёрный пояс',
    text: 'Пройти курс полностью',
    icon: '🥋',
    test: (p, m) => m.courses.some((c) => courseStatus(p, c).total > 0 && courseStatus(p, c).pct >= 1),
  },
];

export function evaluateAchievements(p: ProgressState, m: Manifest): string[] {
  return ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && a.test(p, m)).map((a) => a.id);
}
