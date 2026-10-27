// Достижения: общие (по всей платформе) и по каждому курсу. У каждого есть прогресс «сколько из скольких».
import type { CourseInfo, Manifest } from '../core/manifest';
import type { I } from '../components/ui/icons';
import { courseStatus, lessonStatus, moduleStatus, ProgressState, streak } from './progress';

export interface Achievement {
  id: string;
  title: string;
  text: string;
  icon: keyof typeof I;
  course?: string; // id курса для курсовых
  progress: (p: ProgressState) => [number, number];
}

const totalSolved = (p: ProgressState) =>
  Object.values(p.courses).reduce((a, c) => a + Object.values(c.solved).reduce((b, l) => b + Object.keys(l).length, 0), 0);

const firstTry = (p: ProgressState) =>
  Object.values(p.courses).reduce(
    (a, c) => a + Object.entries(c.solved).reduce((b, [lesson, blocks]) => b + Object.keys(blocks).filter((id) => (c.attempts[`${lesson}#${id}`] ?? 1) <= 1).length, 0),
    0,
  );

const count = (n: number, max: number): [number, number] => [Math.min(n, max), max];

export const GLOBAL: Achievement[] = [
  { id: 'first-solve', title: 'Работает!', text: 'Решить первое задание', icon: 'checkCircle', progress: (p) => count(totalSolved(p), 1) },
  { id: 'solve-10', title: 'Разогрелся', text: 'Решить 10 заданий', icon: 'flame', progress: (p) => count(totalSolved(p), 10) },
  { id: 'solve-50', title: 'В потоке', text: 'Решить 50 заданий', icon: 'bolt', progress: (p) => count(totalSolved(p), 50) },
  { id: 'solve-200', title: 'Машина', text: 'Решить 200 заданий', icon: 'cpu', progress: (p) => count(totalSolved(p), 200) },
  { id: 'sniper', title: 'Снайпер', text: '20 заданий с первой попытки', icon: 'target', progress: (p) => count(firstTry(p), 20) },
  { id: 'streak-3', title: 'Три дня подряд', text: 'Заниматься 3 дня подряд', icon: 'calendar', progress: (p) => count(streak(p).best, 3) },
  { id: 'streak-7', title: 'Неделя без пропусков', text: 'Заниматься 7 дней подряд', icon: 'calendarCheck', progress: (p) => count(streak(p).best, 7) },
  { id: 'streak-30', title: 'Дисциплина', text: 'Заниматься 30 дней подряд', icon: 'mountain', progress: (p) => count(streak(p).best, 30) },
];

export function courseAchievements(c: CourseInfo): Achievement[] {
  const lessons = c.modules.flatMap((m) => m.lessons).filter((l) => !l.meta.draft);
  const modules = c.modules.filter((m) => m.lessons.some((l) => !l.meta.draft));
  const doneLessons = (p: ProgressState) => lessons.filter((l) => lessonStatus(p, c.id, l).done).length;
  const doneModules = (p: ProgressState) => modules.filter((m) => moduleStatus(p, c.id, m).complete).length;
  const pct = (p: ProgressState) => Math.round(courseStatus(p, c).pct * 100);
  return [
    { id: `${c.id}:first-lesson`, course: c.id, title: 'Первый шаг', text: 'Пройти первый урок', icon: 'flag', progress: (p) => count(doneLessons(p), 1) },
    { id: `${c.id}:module`, course: c.id, title: 'Модуль закрыт', text: 'Пройти модуль целиком', icon: 'package', progress: (p) => count(doneModules(p), 1) },
    { id: `${c.id}:quarter`, course: c.id, title: 'Четверть пути', text: 'Пройти 25% курса', icon: 'trophy', progress: (p) => count(pct(p), 25) },
    { id: `${c.id}:half`, course: c.id, title: 'Экватор', text: 'Пройти половину курса', icon: 'half', progress: (p) => count(pct(p), 50) },
    { id: `${c.id}:all-modules`, course: c.id, title: 'Все модули', text: `Закрыть все модули (${modules.length})`, icon: 'cards', progress: (p) => count(doneModules(p), Math.max(1, modules.length)) },
    { id: `${c.id}:black-belt`, course: c.id, title: 'Чёрный пояс', text: 'Пройти курс полностью', icon: 'belt', progress: (p) => count(pct(p), 100) },
  ];
}

export const allAchievements = (m: Manifest): Achievement[] => [...GLOBAL, ...m.courses.flatMap(courseAchievements)];

export function evaluateAchievements(p: ProgressState, m: Manifest): string[] {
  return allAchievements(m)
    .filter((a) => !p.achievements[a.id])
    .filter((a) => {
      const [cur, max] = a.progress(p);
      return max > 0 && cur >= max;
    })
    .map((a) => a.id);
}
