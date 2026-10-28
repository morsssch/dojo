// Синхронизация прогресса через секретный GitHub Gist. Каждый входит своим токеном (scope «gist»);
// токен хранится только в этом браузере и не попадает в экспорт прогресса.
// Слияние без потерь: решённое, просмотренное, достижения и активность объединяются,
// заметки — побеждает более свежая правка, настройки и раскладка роадмапа — локальные.
// Сбросы побеждают: после «стереть всё» берётся только сторона с более поздним сбросом,
// после сброса урока из другой стороны не возвращается то, что было в уроке до сброса.
import { useSyncExternalStore } from 'react';
import { getProgress, onProgress, progress, type CourseProgress, type ProgressState } from './progress';

const CFG = 'dojo:sync';
const FILE = 'dojo-progress.json';
const API = 'https://api.github.com';

interface SyncConfig {
  token: string;
  gistId?: string;
  login?: string;
  last?: number; // время последней успешной синхронизации
}
export interface SyncStatus {
  config: SyncConfig | null;
  busy: boolean;
  error?: string;
}

let status: SyncStatus = { config: readCfg(), busy: false };
const listeners = new Set<() => void>();
const set = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};

function readCfg(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CFG);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCfg(c: SyncConfig | null) {
  try {
    if (c) localStorage.setItem(CFG, JSON.stringify(c));
    else localStorage.removeItem(CFG);
  } catch {
    /* ignore */
  }
  set({ config: c });
}

/** Логин GitHub, под которым вошли синхронизацией. */
export const syncLogin = () => status.config?.login;

export const useSync = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );

async function gh(token: string, path: string, init: RequestInit = {}, allow404 = false) {
  const r = await fetch(path.startsWith('http') ? path : API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (r.status === 404 && allow404) return null;
  if (r.status === 401) throw new Error('Токен не подошёл: проверь, что он не истёк и скопирован целиком.');
  if (r.status === 403 || r.status === 404) {
    if (path.startsWith('/gists'))
      throw new Error('Нет доступа к гистам: у токена должно быть право «gist» (classic) или Gists: Read and write (fine-grained).');
  }
  if (!r.ok) throw new Error(`GitHub ответил ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// ---------- слияние ----------
type Data = ReturnType<typeof progress.exportData>;

const minTime = (a?: number, b?: number) => (a === undefined ? b : b === undefined ? a : Math.min(a, b));
function mergeTimes(a: Record<string, number> = {}, b: Record<string, number> = {}) {
  const out: Record<string, number> = { ...b };
  for (const [k, v] of Object.entries(a)) out[k] = minTime(v, out[k])!;
  return out;
}
/** Убирает из прогресса урока то, что было до сброса урока (сброс мог случиться на другом устройстве). */
function dropBeforeReset(c: CourseProgress, resets: Record<string, number>): CourseProgress {
  c = structuredClone(c);
  for (const [lesson, at] of Object.entries(resets)) {
    if ((c.resets?.[lesson] ?? 0) >= at) continue;
    delete c.visited[lesson]; // у просмотров нет времени — после сброса доверяем только стороне, где был сброс
    for (const k of Object.keys(c.attempts)) if (k.startsWith(lesson + '#')) delete c.attempts[k];
    if ((c.known[lesson] ?? 0) < at) delete c.known[lesson];
    const solved = Object.entries(c.solved[lesson] ?? {}).filter(([, t]) => t > at);
    if (solved.length) c.solved[lesson] = Object.fromEntries(solved);
    else delete c.solved[lesson];
  }
  return c;
}
function mergeCourse(a: CourseProgress | undefined, b: CourseProgress | undefined): CourseProgress {
  if (!a) return b!;
  if (!b) return a;
  // курс сброшен на одном из устройств — берём сторону с более поздним сбросом
  if ((a.resetAt ?? 0) > (b.resetAt ?? 0)) return a;
  if ((b.resetAt ?? 0) > (a.resetAt ?? 0)) return b;
  const resets: Record<string, number> = { ...(b.resets ?? {}) };
  for (const [k, v] of Object.entries(a.resets ?? {})) resets[k] = Math.max(v, resets[k] ?? 0);
  a = dropBeforeReset(a, resets);
  b = dropBeforeReset(b, resets);
  const visited: Record<string, number[]> = { ...b.visited };
  for (const [k, v] of Object.entries(a.visited)) visited[k] = [...new Set([...(visited[k] ?? []), ...v])].sort((x, y) => x - y);
  const solved: Record<string, Record<string, number>> = { ...b.solved };
  for (const [k, v] of Object.entries(a.solved)) solved[k] = mergeTimes(v, solved[k]);
  const attempts: Record<string, number> = { ...b.attempts };
  for (const [k, v] of Object.entries(a.attempts)) attempts[k] = Math.max(v, attempts[k] ?? 0);
  const last = !a.last ? b.last : !b.last ? a.last : a.last.at >= b.last.at ? a.last : b.last;
  return {
    visited,
    solved,
    attempts,
    known: mergeTimes(a.known, b.known),
    last,
    variant: a.variant ?? b.variant,
    groupNumber: a.groupNumber ?? b.groupNumber,
  };
}
export function mergeState(a: ProgressState, b: ProgressState): ProgressState {
  // весь прогресс стёрт на одном из устройств — берём только более свежую сторону, настройки — локальные
  if ((a.resetAt ?? 0) > (b.resetAt ?? 0)) return a;
  if ((b.resetAt ?? 0) > (a.resetAt ?? 0)) return { ...b, prefs: a.prefs, theme: a.theme, roadmap: a.roadmap };
  const courses: Record<string, CourseProgress> = {};
  for (const id of new Set([...Object.keys(a.courses), ...Object.keys(b.courses)])) courses[id] = mergeCourse(a.courses[id], b.courses[id]);
  const activity: Record<string, number> = { ...b.activity };
  for (const [d, n] of Object.entries(a.activity)) activity[d] = Math.max(n, activity[d] ?? 0);
  const notes: NonNullable<ProgressState['notes']> = {};
  for (const c of new Set([...Object.keys(a.notes ?? {}), ...Object.keys(b.notes ?? {})])) {
    const x = { ...(b.notes?.[c] ?? {}) };
    for (const [k, n] of Object.entries(a.notes?.[c] ?? {})) if (!x[k] || n.at >= x[k].at) x[k] = n;
    notes[c] = x;
  }
  const marks: NonNullable<ProgressState['marks']> = { ...(b.marks ?? {}) };
  for (const [c, m] of Object.entries(a.marks ?? {})) marks[c] = { ...(marks[c] ?? {}), ...m };
  // отметки роадмапа сброшенного курса — только со стороны, где был сброс
  for (const c of Object.keys(courses)) {
    const ra = a.courses[c]?.resetAt ?? 0;
    const rb = b.courses[c]?.resetAt ?? 0;
    if (ra === rb) continue;
    const m = (ra > rb ? a : b).marks?.[c];
    if (m) marks[c] = m;
    else delete marks[c];
  }
  return {
    ...b,
    ...a,
    courses,
    activity,
    notes,
    marks,
    roadmap: { ...b.roadmap, ...a.roadmap },
    katas: mergeTimes(a.katas, b.katas),
    achievements: mergeTimes(a.achievements, b.achievements),
  };
}
const mergeData = (local: Data, remote: Data): Data => {
  const lr = local.state.resetAt ?? 0;
  const rr = remote.state.resetAt ?? 0;
  // черновики кода стираются вместе со всем прогрессом или с курсом
  let drafts = lr > rr ? local.drafts : rr > lr ? remote.drafts : { ...remote.drafts, ...local.drafts };
  if (lr === rr)
    for (const c of new Set([...Object.keys(local.state.courses), ...Object.keys(remote.state.courses)])) {
      const cl = local.state.courses[c]?.resetAt ?? 0;
      const cr = remote.state.courses[c]?.resetAt ?? 0;
      if (cl === cr) continue;
      const keep = cl > cr ? local.drafts : remote.drafts;
      const prefix = `dojo:draft:${c}:`;
      drafts = Object.fromEntries(Object.entries(drafts).filter(([k]) => !k.startsWith(prefix) || k in keep));
    }
  return { ...local, state: mergeState(local.state, remote.state), drafts };
};

// ---------- синхронизация ----------
let applying = false;

async function findGist(token: string): Promise<string | undefined> {
  for (let page = 1; page <= 5; page++) {
    const list = (await gh(token, `/gists?per_page=100&page=${page}`)) as {
      id: string;
      files: Record<string, unknown>;
    }[];
    const g = list.find((x) => x.files[FILE]);
    if (g) return g.id;
    if (list.length < 100) return undefined;
  }
  return undefined;
}

export async function syncNow() {
  const cfg = status.config;
  if (!cfg || status.busy) return;
  set({ busy: true, error: undefined });
  try {
    let gistId = cfg.gistId ?? (await findGist(cfg.token));
    const local = progress.exportData();
    let merged = local;
    if (gistId) {
      const g = await gh(cfg.token, `/gists/${gistId}`, {}, true); // гист могли удалить — тогда создадим заново
      const f = g?.files?.[FILE];
      if (f) {
        const text: string = f.truncated ? await (await fetch(f.raw_url)).text() : f.content;
        const remote = JSON.parse(text) as Data;
        if (remote?.app === 'dojo' && remote.state) merged = mergeData(local, remote);
      } else gistId = undefined;
    }
    const body = JSON.stringify({
      files: { [FILE]: { content: JSON.stringify(merged) } },
    });
    if (gistId) await gh(cfg.token, `/gists/${gistId}`, { method: 'PATCH', body });
    else {
      const created = await gh(cfg.token, '/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Dojo: прогресс обучения',
          public: false,
          files: { [FILE]: { content: JSON.stringify(merged) } },
        }),
      });
      gistId = created.id as string;
    }
    if (merged !== local) {
      applying = true;
      try {
        progress.importData(merged, true);
      } finally {
        applying = false;
      }
    }
    writeCfg({ ...cfg, gistId, last: Date.now() });
    set({ busy: false });
  } catch (e) {
    set({ busy: false, error: (e as Error).message });
  }
}

/** Вход: проверяем токен, запоминаем логин и сразу синхронизируемся. */
export async function connect(token: string) {
  token = token.trim();
  set({ busy: true, error: undefined });
  try {
    const me = await gh(token, '/user');
    writeCfg({ token, login: me.login });
    set({ busy: false });
    await syncNow();
  } catch (e) {
    set({ busy: false, error: (e as Error).message });
  }
}

export function disconnect() {
  writeCfg(null);
  set({ error: undefined });
}

// автосинхронизация: через 20 секунд после последнего изменения и при запуске
let timer: ReturnType<typeof setTimeout> | undefined;
export function startAutoSync() {
  if (status.config) void syncNow();
  const resetKey = () => {
    const p = getProgress();
    return JSON.stringify([p.resetAt, Object.values(p.courses).map((c) => [c.resetAt, c.resets])]);
  };
  let lastReset = resetKey();
  onProgress(() => {
    if (applying || !status.config) return;
    clearTimeout(timer);
    // после сброса синхронизируемся сразу, чтобы старый прогресс не успел прийти из гиста
    const r = resetKey();
    const now = r !== lastReset;
    lastReset = r;
    timer = setTimeout(() => void syncNow(), now ? 0 : 20_000);
  });
  window.addEventListener('pagehide', () => {
    if (timer && status.config) {
      clearTimeout(timer);
      void syncNow();
    }
  });
}
