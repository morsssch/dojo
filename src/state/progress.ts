// Прогресс ученика. Живёт в localStorage, экспортируется/импортируется JSON-файлом.
import { useSyncExternalStore } from 'react';
import type { CourseInfo, LessonInfo, ModuleInfo } from '../core/manifest';

export interface CourseProgress {
  visited: Record<string, number[]>; // lessonKey -> индексы просмотренных шагов
  solved: Record<string, Record<string, number>>; // lessonKey -> blockId -> время
  attempts: Record<string, number>; // `${lessonKey}#${blockId}` -> попыток
  known: Record<string, number>; // lessonKey -> «уже знаю» (через чекпоинт или роадмап)
  last?: { lesson: string; step: number; at: number };
  variant?: string; // выбранный вариант курса (course.yaml → variants)
  resets?: Record<string, number>; // lessonKey → когда сброшен прогресс урока (чтобы синк не вернул старое)
  resetAt?: number; // когда сброшен весь курс
}

export interface ProgressState {
  v: 1;
  courses: Record<string, CourseProgress>;
  activity: Record<string, number>; // YYYY-MM-DD -> сколько действий
  roadmap: Record<string, Record<string, { x: number; y: number }>>; // позиции узлов, которые подвинул ученик
  marks?: Record<string, Record<string, RoadmapMark>>; // курс → узел роадмапа → отметка ученика
  notes?: Record<string, Record<string, { text: string; at: number }>>; // курс → "lesson#step" → заметка
  katas?: Record<string, number>; // slug задачи Codewars → когда отмечена решённой
  achievements: Record<string, number>; // id -> когда получено
  resetAt?: number; // когда стёрт весь прогресс: при синке всё, что было до этого, не возвращается
  /** устарело: перенесено в prefs.theme */
  theme?: 'light' | 'dark' | 'system';
  prefs?: Prefs;
}

export type RoadmapMark = 'learning' | 'done' | 'skip';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  eyeCare: boolean; // тёплый фильтр поверх любой темы
  font: 'plex' | 'golos' | 'serif' | 'system';
  size: 's' | 'm' | 'l' | 'xl';
  accent: Accent;
}
export const ACCENTS = ['mono', 'blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'teal', 'cyan'] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_PREFS: Prefs = { theme: 'system', eyeCare: false, font: 'plex', size: 'm', accent: 'mono' };
export const prefsOf = (p: ProgressState): Prefs => {
  const r = { ...DEFAULT_PREFS, ...(p.theme ? { theme: p.theme } : {}), ...(p.prefs ?? {}) } as Prefs;
  // старая тема «sepia» → светлая + защита зрения
  if ((r.theme as string) === 'sepia') return { ...r, theme: 'light', eyeCare: true };
  if (!(ACCENTS as readonly string[]).includes(r.accent)) r.accent = 'mono';
  return r;
};

const KEY = 'dojo:progress:v1';
const DRAFT_PREFIX = 'dojo:draft:';

const empty = (): ProgressState => ({ v: 1, courses: {}, activity: {}, roadmap: {}, achievements: {} });

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty(), ...JSON.parse(raw) };
  } catch {
    /* приватный режим или битые данные */
  }
  return empty();
}

let state: ProgressState = load();
const listeners = new Set<() => void>();

function commit(next: ProgressState, activity = false) {
  if (activity) next = { ...next, activity: { ...next.activity, [today()]: (next.activity[today()] ?? 0) + 1 } };
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage недоступен — работаем в памяти */
  }
  listeners.forEach((l) => l());
}

export const getProgress = () => state;
/** Подписка на любые изменения прогресса (автосинхронизация). */
export const onProgress = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useProgress(): ProgressState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function course(s: ProgressState, id: string): CourseProgress {
  return s.courses[id] ?? { visited: {}, solved: {}, attempts: {}, known: {} };
}

function update(courseId: string, fn: (c: CourseProgress) => CourseProgress, activity = false) {
  const c = fn(structuredClone(course(state, courseId)));
  const next = { ...state, courses: { ...state.courses, [courseId]: c } };
  if (activity) next.activity = { ...state.activity, [today()]: (state.activity[today()] ?? 0) + 1 };
  commit(next);
}

export const progress = {
  visit(courseId: string, lesson: string, step: number) {
    const c = course(state, courseId);
    const v = c.visited[lesson] ?? [];
    if (v.includes(step) && c.last?.lesson === lesson && c.last.step === step) return;
    update(courseId, (c) => {
      const vis = c.visited[lesson] ?? [];
      if (!vis.includes(step)) c.visited[lesson] = [...vis, step];
      c.last = { lesson, step, at: Date.now() };
      return c;
    });
  },
  solve(courseId: string, lesson: string, block: string) {
    if (course(state, courseId).solved[lesson]?.[block]) return;
    update(
      courseId,
      (c) => {
        c.solved[lesson] = { ...(c.solved[lesson] ?? {}), [block]: Date.now() };
        return c;
      },
      true,
    );
  },
  attempt(courseId: string, lesson: string, block: string): number {
    let n = 0;
    update(
      courseId,
      (c) => {
        n = (c.attempts[`${lesson}#${block}`] ?? 0) + 1;
        c.attempts[`${lesson}#${block}`] = n;
        return c;
      },
      true,
    );
    return n;
  },
  setVariant(courseId: string, variant: string) {
    update(courseId, (c) => ({ ...c, variant }));
  },
  setKnown(courseId: string, lessons: string[], known: boolean) {
    update(courseId, (c) => {
      for (const l of lessons) {
        if (known) c.known[l] = Date.now();
        else delete c.known[l];
      }
      return c;
    });
  },
  resetLesson(courseId: string, lesson: string) {
    update(courseId, (c) => {
      delete c.visited[lesson];
      delete c.solved[lesson];
      delete c.known[lesson];
      for (const k of Object.keys(c.attempts)) if (k.startsWith(lesson + '#')) delete c.attempts[k];
      c.resets = { ...(c.resets ?? {}), [lesson]: Date.now() };
      return c;
    });
  },
  setRoadmapPos(courseId: string, node: string, pos: { x: number; y: number }) {
    commit({ ...state, roadmap: { ...state.roadmap, [courseId]: { ...(state.roadmap[courseId] ?? {}), [node]: pos } } });
  },
  setKata(slug: string, solved: boolean) {
    const k = { ...(state.katas ?? {}) };
    if (solved) k[slug] = Date.now();
    else delete k[slug];
    commit({ ...state, katas: k }, true);
  },
  setNote(courseId: string, lesson: string, step: number, text: string) {
    const cur = { ...(state.notes?.[courseId] ?? {}) };
    const k = `${lesson}#${step}`;
    // пустая заметка остаётся записью с отметкой времени — так удаление побеждает при синхронизации
    if (text.trim() || cur[k]) cur[k] = { text: text.trim() ? text : '', at: Date.now() };
    commit({ ...state, notes: { ...(state.notes ?? {}), [courseId]: cur } });
  },
  setMark(courseId: string, node: string, mark: RoadmapMark | null) {
    const cur = { ...(state.marks?.[courseId] ?? {}) };
    if (mark) cur[node] = mark;
    else delete cur[node];
    commit({ ...state, marks: { ...(state.marks ?? {}), [courseId]: cur } });
  },
  resetRoadmap(courseId: string) {
    const r = { ...state.roadmap };
    delete r[courseId];
    commit({ ...state, roadmap: r });
  },
  grant(ids: string[]) {
    const fresh = ids.filter((id) => !state.achievements[id]);
    if (!fresh.length) return [];
    const a = { ...state.achievements };
    for (const id of fresh) a[id] = Date.now();
    commit({ ...state, achievements: a });
    return fresh;
  },
  setTheme(theme: Prefs['theme']) {
    this.setPrefs({ theme });
  },
  setPrefs(patch: Partial<Prefs>) {
    commit({ ...state, theme: undefined, prefs: { ...prefsOf(state), ...patch } });
  },
  /** Сброс курса: прогресс, отметки роадмапа и черновики кода курса. Заметки остаются. */
  resetCourse(courseId: string) {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(`${DRAFT_PREFIX}${courseId}:`)) localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
    const marks = { ...(state.marks ?? {}) };
    delete marks[courseId];
    commit({
      ...state,
      marks,
      courses: { ...state.courses, [courseId]: { visited: {}, solved: {}, attempts: {}, known: {}, resetAt: Date.now(), variant: state.courses[courseId]?.variant } },
    });
  },
  resetAll() {
    for (const k of Object.keys(localStorage)) if (k.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
    commit({ ...empty(), resetAt: Date.now() });
  },
  export(): string {
    return JSON.stringify(this.exportData(), null, 2);
  },
  exportData() {
    const drafts: Record<string, string> = {};
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(DRAFT_PREFIX)) drafts[k] = localStorage.getItem(k) ?? '';
    } catch {
      /* ignore */
    }
    return { app: 'dojo' as const, exportedAt: new Date().toISOString(), state, drafts };
  },
  import(text: string) {
    this.importData(JSON.parse(text));
  },
  /** replaceDrafts — убрать локальные черновики, которых нет в data (весь прогресс стёрли на другом устройстве). */
  importData(data: { app?: string; state?: ProgressState; drafts?: Record<string, string> }, replaceDrafts = false) {
    if (data?.app !== 'dojo' || !data.state) throw new Error('Это не файл прогресса Dojo');
    if (replaceDrafts)
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith(DRAFT_PREFIX) && !(k in (data.drafts ?? {}))) localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    for (const [k, v] of Object.entries(data.drafts ?? {})) {
      try {
        localStorage.setItem(k, String(v));
      } catch {
        /* ignore */
      }
    }
    commit({ ...empty(), ...data.state });
  },
};

// ---------- черновики кода ----------
export const drafts = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(DRAFT_PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, v: string) {
    try {
      localStorage.setItem(DRAFT_PREFIX + key, v);
    } catch {
      /* ignore */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(DRAFT_PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

// ---------- вычисления ----------

export interface LessonStatus {
  visited: number;
  steps: number;
  solved: number;
  required: number;
  known: boolean;
  done: boolean;
  started: boolean;
  pct: number; // 0..1
}

/** Обязательные блоки урока для выбранного варианта курса (блоки чужих вариантов не считаются). */
export function requiredFor(p: ProgressState, courseId: string, l: LessonInfo) {
  if (!l.variants) return l.required;
  const v = course(p, courseId).variant ?? l.variants.fallback;
  return l.required.filter((id) => !l.variants!.of[id] || l.variants!.of[id].includes(v));
}

export function lessonStatus(p: ProgressState, courseId: string, l0: LessonInfo): LessonStatus {
  const c = course(p, courseId);
  const l = { ...l0, required: requiredFor(p, courseId, l0) };
  const visited = (c.visited[l.key] ?? []).filter((i) => i < l.steps.length).length;
  const solvedMap = c.solved[l.key] ?? {};
  const solved = l.required.filter((id) => solvedMap[id]).length;
  const known = !!c.known[l.key];
  const units = l.steps.length + l.required.length;
  const pct = known ? 1 : units ? (visited + solved) / units : 0;
  const done = known || (visited >= l.steps.length && solved >= l.required.length && l.steps.length > 0);
  return { visited, steps: l.steps.length, solved, required: l.required.length, known, done, started: visited > 0 || solved > 0, pct: done ? 1 : pct };
}

// Черновики (ещё не написанные уроки) входят в общий объём как непройденные:
// иначе один готовый урок из ста давал бы «100%, курс пройден».
export function moduleStatus(p: ProgressState, courseId: string, m: ModuleInfo) {
  const all = m.lessons;
  const ready = all.filter((l) => !l.meta.draft).map((l) => lessonStatus(p, courseId, l));
  const done = ready.filter((s) => s.done).length;
  const pct = all.length ? ready.reduce((a, s) => a + s.pct, 0) / all.length : 0;
  return {
    done,
    total: all.length,
    ready: ready.length,
    pct,
    complete: all.length > 0 && done === all.length,
    started: ready.some((s) => s.started),
  };
}

export function courseStatus(p: ProgressState, c: CourseInfo) {
  const all = c.modules.flatMap((m) => m.lessons);
  const st = all.filter((l) => !l.meta.draft).map((l) => lessonStatus(p, c.id, l));
  const done = st.filter((s) => s.done).length;
  const pct = all.length ? st.reduce((a, s) => a + s.pct, 0) / all.length : 0;
  const solved = st.reduce((a, s) => a + s.solved, 0);
  const required = st.reduce((a, s) => a + s.required, 0);
  return { done, total: all.length, ready: st.length, drafts: all.length - st.length, pct, solved, required };
}

/** Следующий урок: последний открытый, если не закончен, иначе первый незаконченный. */
export function nextLesson(p: ProgressState, c: CourseInfo): { lesson: LessonInfo; step: number } | null {
  const all = c.modules.flatMap((m) => m.lessons).filter((l) => !l.meta.draft);
  const last = course(p, c.id).last;
  if (last) {
    const l = all.find((x) => x.key === last.lesson);
    if (l && !lessonStatus(p, c.id, l).done) return { lesson: l, step: last.step };
  }
  const l = all.find((x) => !lessonStatus(p, c.id, x).done);
  return l ? { lesson: l, step: 0 } : null;
}

export function streak(p: ProgressState): { current: number; best: number; days: number } {
  const days = Object.keys(p.activity).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const cur = new Date(d + 'T00:00:00');
    run = prev && (cur.getTime() - prev.getTime()) / 864e5 === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  let current = 0;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // если сегодня ещё не занимались — серия не прерывается до конца дня
  if (!p.activity[key(t)]) t.setDate(t.getDate() - 1);
  while (p.activity[key(t)]) {
    current++;
    t.setDate(t.getDate() - 1);
  }
  return { current, best, days: days.length };
}

export const DEFAULT_BELTS = [
  { at: 0, name: 'Белый пояс', color: '#eef0f4' },
  { at: 0.08, name: 'Жёлтый пояс', color: '#f2c94c' },
  { at: 0.2, name: 'Оранжевый пояс', color: '#f2994a' },
  { at: 0.35, name: 'Зелёный пояс', color: '#4fb477' },
  { at: 0.5, name: 'Синий пояс', color: '#3d7be0' },
  { at: 0.65, name: 'Фиолетовый пояс', color: '#9b6ce0' },
  { at: 0.8, name: 'Коричневый пояс', color: '#9a6a46' },
  { at: 1, name: 'Чёрный пояс', color: '#16181d' },
];

export function beltFor(c: CourseInfo, pct: number) {
  const belts = c.meta.belts ?? DEFAULT_BELTS;
  let cur = belts[0];
  for (const b of belts) if (pct + 1e-9 >= b.at) cur = b;
  const next = belts.find((b) => b.at > pct + 1e-9);
  return { current: cur, next };
}
