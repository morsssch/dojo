// Проверка целей git-задачи по состоянию эмулятора.
import git from 'isomorphic-git';
import type { GitBlock, GitCheck } from '../schema';
import { Shell } from './shell';

export async function evalCheck(sh: Shell, c: GitCheck): Promise<boolean> {
  const fs = sh.fs;
  const dir = await sh.repoRoot();
  const tryRef = async (ref: string) => {
    if (!dir) return null;
    try {
      return await git.resolveRef({ fs, dir, ref });
    } catch {
      return null;
    }
  };
  if ('repo' in c) return !!dir;
  if (!dir) return false;
  if ('file' in c) {
    const p = `${dir}/${c.file}`;
    if (c.absent) return !fs.exists(p);
    if (!fs.exists(p) || fs.isDir(p)) return false;
    return c.contains === undefined || ((await fs.readFile(p, 'utf8')) as string).includes(c.contains);
  }
  if ('branch' in c && !('commits' in c) && !('message' in c) && !('remote' in c)) {
    const exists = (await git.listBranches({ fs, dir })).includes(c.branch);
    return c.exists === false ? !exists : exists;
  }
  if ('head' in c) return (await git.currentBranch({ fs, dir })) === c.head;
  if ('commits' in c) {
    const oid = await tryRef(c.branch ? `refs/heads/${c.branch}` : 'HEAD');
    if (!oid) return c.commits === 0;
    return (await git.log({ fs, dir, ref: oid })).length >= c.commits;
  }
  if ('message' in c) {
    const oid = await tryRef(c.branch ? `refs/heads/${c.branch}` : 'HEAD');
    if (!oid) return false;
    const [last] = await git.log({ fs, dir, ref: oid, depth: 1 });
    return new RegExp(c.message, 'i').test(last.commit.message);
  }
  if ('clean' in c) {
    const m = await git.statusMatrix({ fs, dir });
    return m.every(([, h, w, s]) => h === 1 && w === 1 && s === 1) && !fs.exists(`${dir}/.git/MERGE_HEAD`);
  }
  if ('staged' in c) {
    const row = (await git.statusMatrix({ fs, dir })).find(([f]) => f === c.staged);
    if (!row) return false;
    const [, h, , s] = row;
    return (h === 0 && s !== 0) || (h === 1 && s !== 1);
  }
  if ('tracked' in c) return (await git.listFiles({ fs, dir })).includes(c.tracked);
  if ('merged' in c) {
    const a = await tryRef(`refs/heads/${c.merged}`);
    const b = await tryRef(`refs/heads/${c.into}`);
    if (!a || !b) return false;
    if (a === b) return true;
    return git.isDescendent({ fs, dir, oid: b, ancestor: a, depth: -1 });
  }
  if ('tag' in c) return (await git.listTags({ fs, dir })).includes(c.tag);
  if ('remote' in c) {
    const remotes = await git.listRemotes({ fs, dir });
    const r = remotes.find((x) => x.remote === c.remote);
    if (!r) return false;
    if (!c.branch) return true;
    // ветка должна быть запушена: на remote она совпадает с локальной
    const local = await tryRef(`refs/heads/${c.branch}`);
    try {
      const remoteOid = await git.resolveRef({ fs, dir: r.url, ref: `refs/heads/${c.branch}` });
      return !!local && remoteOid === local;
    } catch {
      return false;
    }
  }
  return false;
}

export async function evalGoals(sh: Shell, block: GitBlock): Promise<boolean[]> {
  const res: boolean[] = [];
  for (const g of block.goals) {
    try {
      res.push(await evalCheck(sh, g.check));
    } catch {
      res.push(false);
    }
  }
  return res;
}

/** Создаёт оболочку и прогоняет setup. Ошибки setup — баг курса, поэтому возвращаем их. */
export async function bootShell(block: Pick<GitBlock, 'setup'>): Promise<{ sh: Shell; errors: string[] }> {
  const sh = new Shell();
  await sh.boot();
  const errors: string[] = [];
  for (const cmd of block.setup) {
    const r = await sh.run(cmd);
    if (!r.ok) errors.push(`setup «${cmd}»: ${r.out.replace(/\x1b\[\d+m/g, '').trim()}`);
  }
  sh.history = [];
  // Ученик всегда начинает в домашней папке, куда бы ни зашёл setup.
  sh.cwd = sh.home;
  return { sh, errors };
}
