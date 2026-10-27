// Эмулятор терминала с настоящим git (isomorphic-git) поверх MemFS.
// «Удалённые» репозитории — это просто другие папки в той же файловой системе (например /srv/origin.git),
// push/fetch/clone копируют объекты между ними. Работает в браузере и в node.
import git from 'isomorphic-git';
import { MemFS, normPath } from './memfs';

export const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m', reset: '\x1b[0m' };

export interface ShellOutput {
  out: string;
  ok: boolean;
}

export interface GraphCommit {
  oid: string;
  message: string;
  parents: string[];
  time: number;
}
export interface GitGraph {
  commits: GraphCommit[];
  refs: { name: string; oid: string; kind: 'branch' | 'remote' | 'tag' }[];
  head: { branch?: string; oid?: string };
  repo: boolean;
}

class ShellError extends Error {}
const fail = (msg: string): never => {
  throw new ShellError(msg);
};

/** Разбор строки: кавычки, &&, ;, редиректы > и >> */
function tokenize(line: string): string[][] {
  const cmds: string[][] = [[]];
  let cur = '';
  let has = false;
  let q: string | null = null;
  const push = () => {
    if (has) cmds[cmds.length - 1].push(cur);
    cur = '';
    has = false;
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
      else if (ch === '\\' && q === '"' && i + 1 < line.length && '"\\$'.includes(line[i + 1])) cur += line[++i];
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = ch;
      has = true;
    } else if (ch === ' ' || ch === '\t') push();
    else if (ch === '&' && line[i + 1] === '&') {
      push();
      cmds.push([]);
      i++;
    } else if (ch === ';') {
      push();
      cmds.push([]);
    } else if (ch === '>') {
      push();
      if (line[i + 1] === '>') {
        cmds[cmds.length - 1].push('>>');
        i++;
      } else cmds[cmds.length - 1].push('>');
    } else {
      cur += ch;
      has = true;
    }
  }
  if (q) fail('незакрытая кавычка');
  push();
  return cmds.filter((c) => c.length);
}

const short = (oid: string) => oid.slice(0, 7);

export class Shell {
  fs = new MemFS();
  cwd = '/home/student';
  home = '/home/student';
  author = { name: 'Ученик', email: 'student@dojo.dev' };
  history: string[] = [];
  /** журнал терминала: переживает перемонтирование UI (например, переход в полноэкранный режим) */
  transcript: { cwd?: string; cmd?: string; out?: string }[] = [];

  async boot() {
    await this.fs.mkdir(this.home, { recursive: true });
    await this.fs.mkdir('/srv', { recursive: true });
  }

  abs(p: string) {
    if (p === '~') return this.home;
    if (p.startsWith('~/')) return normPath(this.home + p.slice(1));
    return normPath(p.startsWith('/') ? p : `${this.cwd}/${p}`);
  }

  /** Выполняет строку (может содержать && и ;). */
  async run(line: string): Promise<ShellOutput> {
    const trimmed = line.trim();
    if (!trimmed) return { out: '', ok: true };
    this.history.push(trimmed);
    let out = '';
    try {
      for (const tokens of tokenize(trimmed)) {
        let redirect: { file: string; append: boolean } | null = null;
        const ri = tokens.findIndex((t) => t === '>' || t === '>>');
        if (ri >= 0) {
          if (!tokens[ri + 1]) fail('после > нужно имя файла');
          redirect = { file: tokens[ri + 1], append: tokens[ri] === '>>' };
          tokens.splice(ri, 2);
        }
        const res = await this.exec(tokens);
        if (redirect) {
          const p = this.abs(redirect.file);
          const prev = redirect.append && this.fs.exists(p) ? await this.fs.readFile(p, 'utf8') : '';
          await this.fs.writeFile(p, prev + res);
        } else out += res;
      }
      return { out, ok: true };
    } catch (e) {
      const msg = e instanceof ShellError ? e.message : `${(e as Error).message ?? e}`;
      return { out: out + C.red + msg + C.reset + '\n', ok: false };
    }
  }

  private async exec([cmd, ...args]: string[]): Promise<string> {
    switch (cmd) {
      case 'help':
        return HELP;
      case 'pwd':
        return this.cwd + '\n';
      case 'cd': {
        const p = this.abs(args[0] ?? '~');
        if (!this.fs.isDir(p)) fail(`cd: нет такой папки: ${args[0]}`);
        this.cwd = p;
        return '';
      }
      case 'ls': {
        const all = args.includes('-a') || args.includes('-la');
        const target = this.abs(args.find((a) => !a.startsWith('-')) ?? '.');
        if (!this.fs.exists(target)) fail(`ls: нет такого файла или папки: ${target}`);
        if (!this.fs.isDir(target)) return target.split('/').pop() + '\n';
        const items = (await this.fs.readdir(target)).filter((n) => all || !n.startsWith('.'));
        return items.map((n) => (this.fs.isDir(`${target}/${n}`) ? `${C.cyan}${n}/${C.reset}` : n)).join('  ') + (items.length ? '\n' : '');
      }
      case 'cat': {
        let s = '';
        for (const f of args) {
          const p = this.abs(f);
          if (!this.fs.exists(p)) fail(`cat: ${f}: нет такого файла`);
          if (this.fs.isDir(p)) fail(`cat: ${f}: это папка`);
          s += await this.fs.readFile(p, 'utf8');
        }
        return s;
      }
      case 'echo':
        return args.filter((a) => a !== '-e').join(' ').replace(/\\n/g, args.includes('-e') ? '\n' : '\\n') + '\n';
      case 'touch':
        for (const f of args) {
          const p = this.abs(f);
          if (!this.fs.exists(p)) await this.fs.writeFile(p, '');
        }
        return '';
      case 'mkdir': {
        const rec = args.includes('-p');
        for (const d of args.filter((a) => a !== '-p')) await this.fs.mkdir(this.abs(d), { recursive: rec });
        return '';
      }
      case 'rm': {
        const rec = args.some((a) => /^-\w*r/.test(a));
        for (const f of args.filter((a) => !a.startsWith('-'))) {
          const p = this.abs(f);
          if (!this.fs.exists(p)) fail(`rm: ${f}: нет такого файла`);
          if (this.fs.isDir(p) && !rec) fail(`rm: ${f}: это папка (используй rm -r)`);
          await this.fs.rm(p, { recursive: true });
        }
        return '';
      }
      case 'mv': {
        const [a, b] = args;
        if (!a || !b) fail('mv: нужно два аргумента');
        let dst = this.abs(b);
        if (this.fs.isDir(dst)) dst += '/' + a.split('/').pop();
        await this.fs.copy(this.abs(a), dst);
        await this.fs.rm(this.abs(a), { recursive: true });
        return '';
      }
      case 'clear':
        return '\x1bclear';
      case 'tree':
        return this.tree(this.abs(args[0] ?? '.'), '');
      case 'git':
        return this.git(args);
      default:
        return fail(`${cmd}: команда не найдена. Набери help, чтобы увидеть список.`);
    }
  }

  private async tree(dir: string, pad: string): Promise<string> {
    let s = pad ? '' : '.\n';
    const items = (await this.fs.readdir(dir)).filter((n) => n !== '.git');
    for (const [i, n] of items.entries()) {
      const last = i === items.length - 1;
      const p = `${dir}/${n}`;
      s += `${pad}${last ? '└── ' : '├── '}${this.fs.isDir(p) ? C.cyan + n + C.reset : n}\n`;
      if (this.fs.isDir(p)) s += await this.tree(p, pad + (last ? '    ' : '│   '));
    }
    return s;
  }

  // ---------------- git ----------------

  async repoRoot(from = this.cwd): Promise<string | null> {
    try {
      return await git.findRoot({ fs: this.fs, filepath: from });
    } catch {
      return null;
    }
  }
  private async needRepo(): Promise<string> {
    const r = await this.repoRoot();
    if (!r) fail('fatal: not a git repository (or any of the parent directories): .git\nПодсказка: сначала git init');
    return r!;
  }
  private rel(dir: string, p: string) {
    const a = this.abs(p);
    if (a === dir) return '.';
    if (!a.startsWith(dir + '/')) fail(`fatal: ${p}: outside repository`);
    return a.slice(dir.length + 1);
  }
  private async authorFor(dir: string) {
    const name = (await git.getConfig({ fs: this.fs, dir, path: 'user.name' })) ?? this.author.name;
    const email = (await git.getConfig({ fs: this.fs, dir, path: 'user.email' })) ?? this.author.email;
    return { name, email };
  }
  private async headOid(dir: string): Promise<string | null> {
    try {
      return await git.resolveRef({ fs: this.fs, dir, ref: 'HEAD' });
    } catch {
      return null;
    }
  }
  /** HEAD, HEAD~2, main, origin/main, sha */
  async resolve(dir: string, spec: string): Promise<string> {
    const m = spec.match(/^(.*?)((?:[~^]\d*)*)$/)!;
    let base = m[1] || 'HEAD';
    let oid: string | null = null;
    for (const ref of [base, `refs/remotes/${base}`, `refs/tags/${base}`]) {
      try {
        oid = await git.resolveRef({ fs: this.fs, dir, ref });
        break;
      } catch {
        /* next */
      }
    }
    if (!oid && /^[0-9a-f]{4,40}$/.test(base)) {
      try {
        oid = await git.expandOid({ fs: this.fs, dir, oid: base });
      } catch {
        /* nope */
      }
    }
    if (!oid) fail(`fatal: ambiguous argument '${spec}': unknown revision`);
    for (const op of m[2].match(/[~^]\d*/g) ?? []) {
      const n = op.length > 1 ? Number(op.slice(1)) : 1;
      for (let k = 0; k < (op[0] === '~' ? n : 1); k++) {
        const c = await git.readCommit({ fs: this.fs, dir, oid: oid! });
        const parent = op[0] === '^' ? c.commit.parent[n - 1] : c.commit.parent[0];
        if (!parent) fail(`fatal: ambiguous argument '${spec}': unknown revision`);
        oid = parent;
      }
    }
    return oid!;
  }

  private async git(args: string[]): Promise<string> {
    const [sub, ...a] = args;
    const fs = this.fs;
    switch (sub) {
      case undefined:
      case 'help':
      case '--help':
        return GIT_HELP;
      case 'version':
      case '--version':
        return 'git version 2.46.0 (dojo)\n';
      case 'init': {
        const bare = a.includes('--bare');
        const bi = a.indexOf('-b');
        const branch = bi >= 0 ? a[bi + 1] : 'main';
        const target = a.filter((x, i) => !x.startsWith('-') && !(bi >= 0 && i === bi + 1))[0];
        const dir = this.abs(target ?? '.');
        await fs.mkdir(dir, { recursive: true });
        const existed = fs.exists(`${dir}/.git`);
        await git.init({ fs, dir, defaultBranch: branch });
        if (bare) await git.setConfig({ fs, dir, path: 'core.bare', value: 'true' });
        return `${existed ? 'Reinitialized existing' : 'Initialized empty'} Git repository in ${dir}/.git/\n`;
      }
      case 'config': {
        const dir = (await this.repoRoot()) ?? this.home;
        const keys = a.filter((x) => !x.startsWith('--'));
        if (keys.length >= 2) {
          if (!(await this.repoRoot())) {
            if (keys[0] === 'user.name') this.author.name = keys[1];
            if (keys[0] === 'user.email') this.author.email = keys[1];
            return '';
          }
          await git.setConfig({ fs, dir, path: keys[0], value: keys.slice(1).join(' ') });
          return '';
        }
        if (keys.length === 1) {
          const v = (await this.repoRoot()) ? await git.getConfig({ fs, dir, path: keys[0] }) : undefined;
          return v !== undefined ? `${v}\n` : keys[0] === 'user.name' ? this.author.name + '\n' : keys[0] === 'user.email' ? this.author.email + '\n' : '';
        }
        return fail('usage: git config <name> [<value>]');
      }
      case 'status':
        return this.status(await this.needRepo());
      case 'add': {
        const dir = await this.needRepo();
        if (!a.length) fail('Nothing specified, nothing added.\nПодсказка: git add <файл> или git add .');
        const all = a.includes('.') || a.includes('-A') || a.includes('--all');
        const matrix = await git.statusMatrix({ fs, dir });
        const targets = a.filter((x) => !x.startsWith('-')).map((p) => this.rel(dir, p));
        const match = (f: string) => all || targets.some((t) => t === '.' || f === t || f.startsWith(t + '/'));
        let any = false;
        for (const [f, , wd, st] of matrix) {
          if (!match(f)) continue;
          any = true;
          if (wd === 0) {
            if (st !== 0) await git.remove({ fs, dir, filepath: f });
          } else await git.add({ fs, dir, filepath: f });
        }
        if (!any && !all) fail(`fatal: pathspec '${targets[0]}' did not match any files`);
        return '';
      }
      case 'rm': {
        const dir = await this.needRepo();
        const cached = a.includes('--cached');
        for (const p of a.filter((x) => !x.startsWith('-'))) {
          const f = this.rel(dir, p);
          await git.remove({ fs, dir, filepath: f });
          if (!cached && fs.exists(`${dir}/${f}`)) await fs.rm(`${dir}/${f}`, { recursive: true });
        }
        return '';
      }
      case 'commit':
        return this.commit(await this.needRepo(), a);
      case 'log':
        return this.log(await this.needRepo(), a);
      case 'branch':
        return this.branch(await this.needRepo(), a);
      case 'checkout':
      case 'switch':
        return this.checkout(await this.needRepo(), sub, a);
      case 'restore': {
        const dir = await this.needRepo();
        const staged = a.includes('--staged');
        for (const p of a.filter((x) => !x.startsWith('-'))) {
          const f = this.rel(dir, p);
          if (staged) await git.resetIndex({ fs, dir, filepath: f });
          else await git.checkout({ fs, dir, filepaths: [f], force: true });
        }
        return '';
      }
      case 'merge':
        return this.merge(await this.needRepo(), a);
      case 'reset':
        return this.reset(await this.needRepo(), a);
      case 'diff':
        return this.diff(await this.needRepo(), a);
      case 'tag': {
        const dir = await this.needRepo();
        if (!a.length) return (await git.listTags({ fs, dir })).map((t) => t + '\n').join('');
        if (a[0] === '-d') {
          await git.deleteTag({ fs, dir, ref: a[1] });
          return `Deleted tag '${a[1]}'\n`;
        }
        await git.tag({ fs, dir, ref: a[0], object: a[1] ? await this.resolve(dir, a[1]) : undefined });
        return '';
      }
      case 'show': {
        const dir = await this.needRepo();
        const oid = await this.resolve(dir, a[0] ?? 'HEAD');
        const out = await this.log(dir, ['-n', '1', oid]);
        return out + (await this.diffCommits(dir, oid));
      }
      case 'remote':
        return this.remote(await this.needRepo(), a);
      case 'clone':
        return this.clone(a);
      case 'push':
        return this.push(await this.needRepo(), a);
      case 'fetch':
        return this.fetch(await this.needRepo(), a[0] ?? 'origin');
      case 'pull': {
        const dir = await this.needRepo();
        const remote = a.find((x) => !x.startsWith('-')) ?? 'origin';
        const cur = await git.currentBranch({ fs, dir });
        const branch = a.filter((x) => !x.startsWith('-'))[1] ?? cur;
        let out = await this.fetch(dir, remote);
        out += await this.merge(dir, [`${remote}/${branch}`], true);
        return out;
      }
      default:
        return fail(`git: '${sub}' is not a git command (или пока не поддерживается в Dojo). См. git help`);
    }
  }

  private async status(dir: string): Promise<string> {
    const fs = this.fs;
    const branch = await git.currentBranch({ fs, dir });
    const head = await this.headOid(dir);
    let s = branch ? `On branch ${branch}\n` : `${C.red}HEAD detached at ${short(head ?? '')}${C.reset}\n`;
    if (branch) {
      const up = await this.upstream(dir, branch);
      if (up && head) {
        const { ahead, behind } = await this.aheadBehind(dir, head, up.oid);
        if (ahead && behind) s += `Your branch and '${up.name}' have diverged.\n`;
        else if (ahead) s += `Your branch is ahead of '${up.name}' by ${ahead} commit${ahead > 1 ? 's' : ''}.\n`;
        else if (behind) s += `Your branch is behind '${up.name}' by ${behind} commit${behind > 1 ? 's' : ''}.\n`;
        else s += `Your branch is up to date with '${up.name}'.\n`;
      }
    }
    if (fs.exists(`${dir}/.git/MERGE_HEAD`)) s += `${C.yellow}You have unmerged paths.\n  (fix conflicts and run "git commit")${C.reset}\n`;
    if (!head) s += '\nNo commits yet\n';
    const m = await git.statusMatrix({ fs, dir });
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    const conflicted = new Set<string>();
    if (fs.exists(`${dir}/.git/MERGE_HEAD`))
      for (const [f, , w] of m)
        if (w !== 0 && /^<<<<<<< /m.test(await fs.readFile(`${dir}/${f}`, 'utf8'))) conflicted.add(f);
    if (conflicted.size) s += `\nUnmerged paths:\n  (use "git add <file>..." to mark resolution)\n${[...conflicted].map((f) => `\t${C.red}both modified:   ${f}${C.reset}\n`).join('')}`;
    for (const [f, h, w, st] of m) {
      if (conflicted.has(f)) continue;
      if (h === 0 && st !== 0) staged.push(`new file:   ${f}`);
      else if (h === 1 && st === 0) staged.push(`deleted:    ${f}`);
      else if (h === 1 && (st === 2 || st === 3)) staged.push(`modified:   ${f}`);
      if (st !== 0 && w === 0) unstaged.push(`deleted:    ${f}`);
      else if (st === 3 || (st === 1 && w === 2)) unstaged.push(`modified:   ${f}`);
      if (st === 0 && w !== 0) untracked.push(f);
    }
    if (staged.length) s += `\nChanges to be committed:\n${staged.map((x) => `\t${C.green}${x}${C.reset}\n`).join('')}`;
    if (unstaged.length) s += `\nChanges not staged for commit:\n${unstaged.map((x) => `\t${C.red}${x}${C.reset}\n`).join('')}`;
    if (untracked.length) s += `\nUntracked files:\n${untracked.map((x) => `\t${C.red}${x}${C.reset}\n`).join('')}`;
    if (!staged.length && !unstaged.length && !untracked.length && !conflicted.size) s += head ? '\nnothing to commit, working tree clean\n' : '\nnothing to commit (create/copy files and use "git add" to track)\n';
    return s;
  }

  private async upstream(dir: string, branch: string) {
    const remote = await git.getConfig({ fs: this.fs, dir, path: `branch.${branch}.remote` });
    const merge: string | undefined = await git.getConfig({ fs: this.fs, dir, path: `branch.${branch}.merge` });
    if (!remote || !merge) return null;
    const rb = merge.replace('refs/heads/', '');
    try {
      return { name: `${remote}/${rb}`, oid: await git.resolveRef({ fs: this.fs, dir, ref: `refs/remotes/${remote}/${rb}` }) };
    } catch {
      return null;
    }
  }

  private async ancestors(dir: string, oid: string): Promise<Set<string>> {
    const seen = new Set<string>();
    const stack = [oid];
    while (stack.length) {
      const o = stack.pop()!;
      if (seen.has(o)) continue;
      seen.add(o);
      const c = await git.readCommit({ fs: this.fs, dir, oid: o });
      stack.push(...c.commit.parent);
    }
    return seen;
  }
  private async aheadBehind(dir: string, a: string, b: string) {
    const A = await this.ancestors(dir, a);
    const B = await this.ancestors(dir, b);
    return { ahead: [...A].filter((x) => !B.has(x)).length, behind: [...B].filter((x) => !A.has(x)).length };
  }

  private async commit(dir: string, a: string[]): Promise<string> {
    const fs = this.fs;
    const mi = a.findIndex((x) => x === '-m' || x === '-am' || x === '--message');
    if (a.includes('-a') || a.includes('-am')) {
      for (const [f, h, w, st] of await git.statusMatrix({ fs, dir })) {
        if (h === 0 && st === 0) continue;
        if (w === 0) await git.remove({ fs, dir, filepath: f });
        else if (st !== 0) await git.add({ fs, dir, filepath: f });
      }
    }
    if (mi < 0 || !a[mi + 1]) fail('error: в Dojo нет редактора — укажи сообщение: git commit -m "что сделал"');
    const message = a[mi + 1];
    const mergeHeadPath = `${dir}/.git/MERGE_HEAD`;
    const merging = fs.exists(mergeHeadPath);
    const matrix = await git.statusMatrix({ fs, dir });
    const changed = matrix.some(([, h, , st]) => (h === 0 && st !== 0) || (h === 1 && st !== 1));
    const amend = a.includes('--amend');
    if (!changed && !merging && !amend) {
      const untracked = matrix.some(([, , w, st]) => st === 0 && w !== 0);
      return fail(untracked ? 'nothing added to commit but untracked files present (use "git add" to track)' : 'nothing to commit, working tree clean');
    }
    if (merging) {
      for (const [f] of matrix) {
        if (!fs.exists(`${dir}/${f}`)) continue;
        const txt: string = await fs.readFile(`${dir}/${f}`, 'utf8');
        if (/^<<<<<<< /m.test(txt) && /^>>>>>>> /m.test(txt)) fail(`error: в файле ${f} остались маркеры конфликта (<<<<<<<). Исправь файл, сделай git add и повтори.`);
      }
    }
    const author = await this.authorFor(dir);
    const head = await this.headOid(dir);
    let parent: string[] | undefined;
    if (merging) parent = [head!, (await fs.readFile(mergeHeadPath, 'utf8')).trim()];
    if (amend) {
      if (!head) fail('fatal: You have nothing to amend.');
      parent = (await git.readCommit({ fs, dir, oid: head! })).commit.parent;
    }
    const oid = await git.commit({ fs, dir, message, author, parent });
    if (merging) await fs.unlink(mergeHeadPath);
    const branch = (await git.currentBranch({ fs, dir })) ?? 'detached HEAD';
    const files = matrix.filter(([, h, , st]) => (h === 0 && st !== 0) || (h === 1 && st !== 1)).length;
    return `[${branch}${head ? '' : ' (root-commit)'} ${short(oid)}] ${message}\n ${files} file${files === 1 ? '' : 's'} changed\n`;
  }

  private async decorations(dir: string): Promise<Map<string, string[]>> {
    const fs = this.fs;
    const map = new Map<string, string[]>();
    const add = (oid: string, n: string) => map.set(oid, [...(map.get(oid) ?? []), n]);
    const cur = await git.currentBranch({ fs, dir });
    const head = await this.headOid(dir);
    for (const b of await git.listBranches({ fs, dir })) {
      const oid = await git.resolveRef({ fs, dir, ref: b });
      add(oid, b === cur ? `${C.cyan}HEAD -> ${C.green}${b}` : `${C.green}${b}`);
    }
    if (!cur && head) add(head, `${C.cyan}HEAD`);
    for (const r of await git.listRemotes({ fs, dir })) {
      for (const b of await git.listBranches({ fs, dir, remote: r.remote })) {
        if (b === 'HEAD') continue;
        try {
          add(await git.resolveRef({ fs, dir, ref: `refs/remotes/${r.remote}/${b}` }), `${C.red}${r.remote}/${b}`);
        } catch {
          /* skip */
        }
      }
    }
    for (const t of await git.listTags({ fs, dir })) {
      try {
        add(await git.resolveRef({ fs, dir, ref: t }), `${C.yellow}tag: ${t}`);
      } catch {
        /* skip */
      }
    }
    return map;
  }

  private async log(dir: string, a: string[]): Promise<string> {
    const fs = this.fs;
    const oneline = a.includes('--oneline');
    const ni = a.findIndex((x) => x === '-n');
    let depth = ni >= 0 ? Number(a[ni + 1]) : undefined;
    const nShort = a.find((x) => /^-\d+$/.test(x));
    if (nShort) depth = Number(nShort.slice(1));
    const refArg = a.filter((x, i) => !x.startsWith('-') && !(ni >= 0 && i === ni + 1))[0];
    if (!(await this.headOid(dir)) && !refArg) fail(`fatal: your current branch '${await git.currentBranch({ fs, dir })}' does not have any commits yet`);
    const deco = await this.decorations(dir);
    let commits;
    if (a.includes('--all')) {
      const seen = new Map<string, Awaited<ReturnType<typeof git.log>>[number]>();
      const refs = [...(await git.listBranches({ fs, dir })).map((b) => `refs/heads/${b}`)];
      for (const r of await git.listRemotes({ fs, dir })) for (const b of await git.listBranches({ fs, dir, remote: r.remote })) refs.push(`refs/remotes/${r.remote}/${b}`);
      for (const ref of refs) {
        try {
          for (const c of await git.log({ fs, dir, ref })) seen.set(c.oid, c);
        } catch {
          /* skip */
        }
      }
      commits = [...seen.values()].sort((x, y) => y.commit.committer.timestamp - x.commit.committer.timestamp).slice(0, depth);
    } else commits = await git.log({ fs, dir, ref: refArg ? await this.resolve(dir, refArg) : 'HEAD', depth });
    return commits
      .map((c) => {
        const d = deco.get(c.oid);
        const dec = d ? ` ${C.yellow}(${d.join(`${C.yellow}, `)}${C.yellow})${C.reset}` : '';
        const msg = c.commit.message.trim();
        if (oneline) return `${C.yellow}${short(c.oid)}${C.reset}${dec} ${msg.split('\n')[0]}\n`;
        const date = new Date(c.commit.author.timestamp * 1000).toString().slice(0, 24);
        const merge = c.commit.parent.length > 1 ? `Merge: ${c.commit.parent.map(short).join(' ')}\n` : '';
        return `${C.yellow}commit ${c.oid}${C.reset}${dec}\n${merge}Author: ${c.commit.author.name} <${c.commit.author.email}>\nDate:   ${date}\n\n${msg
          .split('\n')
          .map((l) => '    ' + l)
          .join('\n')}\n\n`;
      })
      .join('');
  }

  private async branch(dir: string, a: string[]): Promise<string> {
    const fs = this.fs;
    const cur = await git.currentBranch({ fs, dir });
    if (!a.length || a.includes('-a') || a.includes('--all') || a.includes('-v')) {
      let s = (await git.listBranches({ fs, dir })).map((b) => (b === cur ? `* ${C.green}${b}${C.reset}\n` : `  ${b}\n`)).join('');
      if (a.includes('-a') || a.includes('--all'))
        for (const r of await git.listRemotes({ fs, dir }))
          for (const b of await git.listBranches({ fs, dir, remote: r.remote })) s += `  ${C.red}remotes/${r.remote}/${b}${C.reset}\n`;
      if (!cur) s = `* ${C.red}(HEAD detached)${C.reset}\n` + s;
      return s;
    }
    if (a[0] === '-d' || a[0] === '-D') {
      if (a[1] === cur) fail(`error: Cannot delete branch '${a[1]}' checked out`);
      const oid = await this.resolve(dir, a[1]);
      if (a[0] === '-d') {
        const head = await this.headOid(dir);
        if (head && !(await this.ancestors(dir, head)).has(oid)) fail(`error: The branch '${a[1]}' is not fully merged.\nIf you are sure you want to delete it, run 'git branch -D ${a[1]}'.`);
      }
      await git.deleteBranch({ fs, dir, ref: a[1] });
      return `Deleted branch ${a[1]} (was ${short(oid)}).\n`;
    }
    if (a[0] === '-m') {
      const [from, to] = a.length > 2 ? [a[1], a[2]] : [cur!, a[1]];
      await git.renameBranch({ fs, dir, oldref: from, ref: to, checkout: from === cur });
      return '';
    }
    if (!(await this.headOid(dir))) fail(`fatal: Not a valid object name: '${cur}'. (сначала сделай хотя бы один коммит)`);
    if ((await git.listBranches({ fs, dir })).includes(a[0])) fail(`fatal: a branch named '${a[0]}' already exists`);
    await git.branch({ fs, dir, ref: a[0], object: a[1] ? await this.resolve(dir, a[1]) : undefined });
    return '';
  }

  private async checkout(dir: string, sub: string, a: string[]): Promise<string> {
    const fs = this.fs;
    const createFlag = sub === 'switch' ? ['-c', '-C'] : ['-b', '-B'];
    if (a.includes('--')) {
      const files = a.slice(a.indexOf('--') + 1).map((p) => this.rel(dir, p));
      await git.checkout({ fs, dir, filepaths: files, force: true });
      return '';
    }
    if (createFlag.includes(a[0])) {
      const name = a[1];
      if (!name) fail(`fatal: нужно имя ветки`);
      if (!(await this.headOid(dir))) {
        // в пустом репозитории просто переключаем HEAD
        await fs.writeFile(`${dir}/.git/HEAD`, `ref: refs/heads/${name}\n`);
        return `Switched to a new branch '${name}'\n`;
      }
      if ((await git.listBranches({ fs, dir })).includes(name)) fail(`fatal: a branch named '${name}' already exists`);
      await git.branch({ fs, dir, ref: name, object: a[2] ? await this.resolve(dir, a[2]) : undefined });
      await git.checkout({ fs, dir, ref: name });
      return `Switched to a new branch '${name}'\n`;
    }
    const target = a.find((x) => !x.startsWith('-'));
    if (!target) fail('fatal: укажи ветку или коммит');
    const branches = await git.listBranches({ fs, dir });
    if (target === '-') fail('git checkout - пока не поддерживается');
    if (!branches.includes(target!)) {
      // ветка с таким именем есть на remote — создаём отслеживающую
      for (const r of await git.listRemotes({ fs, dir })) {
        if ((await git.listBranches({ fs, dir, remote: r.remote })).includes(target!)) {
          const oid = await git.resolveRef({ fs, dir, ref: `refs/remotes/${r.remote}/${target}` });
          await git.branch({ fs, dir, ref: target!, object: oid });
          await git.setConfig({ fs, dir, path: `branch.${target}.remote`, value: r.remote });
          await git.setConfig({ fs, dir, path: `branch.${target}.merge`, value: `refs/heads/${target}` });
          await this.safeCheckout(dir, target!);
          return `branch '${target}' set up to track '${r.remote}/${target}'.\nSwitched to a new branch '${target}'\n`;
        }
      }
      if (sub === 'switch') fail(`fatal: invalid reference: ${target}`);
      // отдельный файл?
      if (fs.exists(this.abs(target!)) && !/^[0-9a-f]{4,40}$/.test(target!)) {
        await git.checkout({ fs, dir, filepaths: [this.rel(dir, target!)], force: true });
        return `Updated 1 path from the index\n`;
      }
      const oid = await this.resolve(dir, target!);
      await this.ensureNoLocalChanges(dir);
      await git.checkout({ fs, dir, ref: oid });
      await fs.writeFile(`${dir}/.git/HEAD`, oid + '\n');
      return `Note: switching to '${target}'.\n\nYou are in 'detached HEAD' state.\nHEAD is now at ${short(oid)}\n`;
    }
    await this.safeCheckout(dir, target!);
    return `Switched to branch '${target}'\n`;
  }

  private async ensureNoLocalChanges(dir: string) {
    const m = await git.statusMatrix({ fs: this.fs, dir });
    const dirty = m.filter(([, h, w, st]) => !(h === 0 && st === 0) && !(h === 1 && w === 1 && st === 1));
    if (dirty.length)
      fail(
        `error: Your local changes to the following files would be overwritten by checkout:\n${dirty.map(([f]) => '\t' + f).join('\n')}\nPlease commit your changes or stash them before you switch branches.\nAborting`,
      );
  }

  private async safeCheckout(dir: string, ref: string) {
    await this.ensureNoLocalChanges(dir);
    await git.checkout({ fs: this.fs, dir, ref });
  }

  private async merge(dir: string, a: string[], fromPull = false): Promise<string> {
    const fs = this.fs;
    if (a.includes('--abort')) {
      if (!fs.exists(`${dir}/.git/MERGE_HEAD`)) fail('fatal: There is no merge to abort (MERGE_HEAD missing).');
      await fs.unlink(`${dir}/.git/MERGE_HEAD`);
      await git.checkout({ fs, dir, ref: (await git.currentBranch({ fs, dir }))!, force: true });
      return '';
    }
    const theirsName = a.find((x) => !x.startsWith('-'));
    if (!theirsName) fail('fatal: укажи ветку для слияния');
    const ours = await git.currentBranch({ fs, dir });
    if (!ours) fail('fatal: в detached HEAD слияние не поддерживается в Dojo');
    if (fs.exists(`${dir}/.git/MERGE_HEAD`)) fail('error: Merging is not possible because you have unmerged files.\nfix conflicts and then commit the result.');
    const theirs = await this.resolve(dir, theirsName!);
    const localBranches = await git.listBranches({ fs, dir });
    const theirsRef = localBranches.includes(theirsName!)
      ? theirsName!
      : /^[\w.-]+\/[\w./-]+$/.test(theirsName!) && !/^[0-9a-f]{7,40}$/.test(theirsName!)
        ? `refs/remotes/${theirsName}`
        : theirs;
    const head = await this.headOid(dir);
    if (head === theirs || (head && (await this.ancestors(dir, head)).has(theirs))) return 'Already up to date.\n';
    await this.ensureNoLocalChanges(dir);
    const noFF = a.includes('--no-ff');
    const author = await this.authorFor(dir);
    try {
      const res = await git.merge({
        fs,
        dir,
        ours: ours!,
        theirs: theirsRef,
        author,
        fastForward: !noFF,
        abortOnConflict: false,
        message: `Merge ${fromPull ? 'remote-tracking ' : ''}branch '${theirsName}'${ours !== 'main' ? ` into ${ours}` : ''}`,
      });
      await git.checkout({ fs, dir, ref: ours!, force: true });
      if (res.fastForward) return `Updating ${short(head ?? '')}..${short(theirs)}\nFast-forward\n`;
      return `Merge made by the 'ort' strategy.\n`;
    } catch (e: any) {
      if (e?.code === 'MergeConflictError' || e?.name === 'MergeConflictError') {
        await fs.writeFile(`${dir}/.git/MERGE_HEAD`, theirs + '\n');
        const files: string[] = e.data?.filepaths ?? [];
        return (
          files.map((f) => `Auto-merging ${f}\n${C.red}CONFLICT (content): Merge conflict in ${f}${C.reset}\n`).join('') +
          `${C.red}Automatic merge failed; fix conflicts and then commit the result.${C.reset}\n`
        );
      }
      throw e;
    }
  }

  private async reset(dir: string, a: string[]): Promise<string> {
    const fs = this.fs;
    const mode = a.includes('--hard') ? 'hard' : a.includes('--soft') ? 'soft' : 'mixed';
    const targets = a.filter((x) => !x.startsWith('--'));
    // git reset <file> — убрать из индекса
    if (targets.length && fs.exists(this.abs(targets[0])) && !targets[0].startsWith('HEAD')) {
      for (const p of targets) await git.resetIndex({ fs, dir, filepath: this.rel(dir, p) });
      return '';
    }
    const oid = await this.resolve(dir, targets[0] ?? 'HEAD');
    const branch = await git.currentBranch({ fs, dir });
    if (branch) await git.writeRef({ fs, dir, ref: `refs/heads/${branch}`, value: oid, force: true });
    else await fs.writeFile(`${dir}/.git/HEAD`, oid + '\n');
    if (mode === 'soft') return '';
    // mixed: индекс = дерево коммита
    const files = new Set<string>([...(await git.listFiles({ fs, dir })), ...(await git.listFiles({ fs, dir, ref: oid }))]);
    for (const f of files) await git.resetIndex({ fs, dir, filepath: f, ref: oid });
    if (mode === 'hard') {
      await git.checkout({ fs, dir, ref: branch ?? oid, force: true });
      if (fs.exists(`${dir}/.git/MERGE_HEAD`)) await fs.unlink(`${dir}/.git/MERGE_HEAD`);
      const c = await git.readCommit({ fs, dir, oid });
      return `HEAD is now at ${short(oid)} ${c.commit.message.split('\n')[0]}\n`;
    }
    return `Unstaged changes after reset\n`;
  }

  private async readTreeFiles(dir: string, oid: string | null): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!oid) return map;
    for (const f of await git.listFiles({ fs: this.fs, dir, ref: oid })) {
      const { blob } = await git.readBlob({ fs: this.fs, dir, oid, filepath: f });
      map.set(f, new TextDecoder().decode(blob));
    }
    return map;
  }

  private async indexFiles(dir: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    await git.walk({
      fs: this.fs,
      dir,
      trees: [git.STAGE()],
      map: async (filepath, [e]) => {
        if (!e || filepath === '.') return;
        if ((await e.type()) === 'blob') {
          const oid = await e.oid();
          const { blob } = await git.readBlob({ fs: this.fs, dir, oid });
          map.set(filepath, new TextDecoder().decode(blob));
        }
        return true;
      },
    });
    return map;
  }

  private async diff(dir: string, a: string[]): Promise<string> {
    const staged = a.includes('--staged') || a.includes('--cached');
    const index = await this.indexFiles(dir);
    let left: Map<string, string>;
    let right: Map<string, string>;
    if (staged) {
      left = await this.readTreeFiles(dir, await this.headOid(dir));
      right = index;
    } else {
      left = index;
      right = new Map();
      for (const f of index.keys()) if (this.fs.exists(`${dir}/${f}`)) right.set(f, await this.fs.readFile(`${dir}/${f}`, 'utf8'));
    }
    return renderDiff(left, right);
  }

  private async diffCommits(dir: string, oid: string): Promise<string> {
    const c = await git.readCommit({ fs: this.fs, dir, oid });
    return renderDiff(await this.readTreeFiles(dir, c.commit.parent[0] ?? null), await this.readTreeFiles(dir, oid));
  }

  private async remote(dir: string, a: string[]): Promise<string> {
    const fs = this.fs;
    if (!a.length || a[0] === '-v') {
      const rs = await git.listRemotes({ fs, dir });
      return rs.map((r) => (a[0] === '-v' ? `${r.remote}\t${r.url} (fetch)\n${r.remote}\t${r.url} (push)\n` : `${r.remote}\n`)).join('');
    }
    if (a[0] === 'add') {
      await git.addRemote({ fs, dir, remote: a[1], url: a[2] });
      return '';
    }
    if (a[0] === 'remove' || a[0] === 'rm') {
      await git.deleteRemote({ fs, dir, remote: a[1] });
      return '';
    }
    return fail('usage: git remote [-v | add <name> <url> | remove <name>]');
  }

  private remotePath(url: string): string {
    const p = normPath(url.replace(/^file:\/\//, ''));
    if (!this.fs.exists(`${p}/.git`)) fail(`fatal: '${url}' does not appear to be a git repository\nfatal: Could not read from remote repository.`);
    return p;
  }

  private async clone(a: string[]): Promise<string> {
    const fs = this.fs;
    const [url, target] = a.filter((x) => !x.startsWith('-'));
    if (!url) fail('usage: git clone <repo> [<dir>]');
    const src = this.remotePath(url);
    const name = target ?? src.split('/').pop()!.replace(/\.git$/, '');
    const dir = this.abs(name);
    if (fs.exists(dir) && (await fs.readdir(dir)).length) fail(`fatal: destination path '${name}' already exists and is not an empty directory.`);
    await fs.mkdir(dir, { recursive: true });
    await fs.copy(`${src}/.git`, `${dir}/.git`);
    // приводим к виду клона
    await git.setConfig({ fs, dir, path: 'core.bare', value: undefined });
    await git.addRemote({ fs, dir, remote: 'origin', url: src, force: true });
    const branches = await git.listBranches({ fs, dir });
    const remoteHead = await git.currentBranch({ fs, dir: src });
    for (const b of branches) {
      const oid = await git.resolveRef({ fs, dir, ref: `refs/heads/${b}` });
      await git.writeRef({ fs, dir, ref: `refs/remotes/origin/${b}`, value: oid, force: true });
      if (b !== remoteHead) await git.deleteBranch({ fs, dir, ref: b });
    }
    if (remoteHead && branches.includes(remoteHead)) {
      await git.setConfig({ fs, dir, path: `branch.${remoteHead}.remote`, value: 'origin' });
      await git.setConfig({ fs, dir, path: `branch.${remoteHead}.merge`, value: `refs/heads/${remoteHead}` });
      await git.checkout({ fs, dir, ref: remoteHead, force: true });
    }
    if (fs.exists(`${dir}/.git/MERGE_HEAD`)) await fs.unlink(`${dir}/.git/MERGE_HEAD`);
    return `Cloning into '${name}'...\ndone.\n${branches.length ? '' : 'warning: You appear to have cloned an empty repository.\n'}`;
  }

  private async copyObjects(from: string, to: string) {
    await this.fs.copy(`${from}/.git/objects`, `${to}/.git/objects`, { skipExisting: true });
  }

  private async push(dir: string, a: string[]): Promise<string> {
    const fs = this.fs;
    const setUp = a.includes('-u') || a.includes('--set-upstream');
    const force = a.includes('-f') || a.includes('--force');
    const pos = a.filter((x) => !x.startsWith('-'));
    const cur = await git.currentBranch({ fs, dir });
    let remote = pos[0];
    let branch = pos[1];
    if (!remote) {
      if (!cur) fail('fatal: You are not currently on a branch.');
      remote = (await git.getConfig({ fs, dir, path: `branch.${cur}.remote` })) ?? '';
      branch = cur!;
      if (!remote) {
        const rs = await git.listRemotes({ fs, dir });
        if (!rs.length) fail('fatal: No configured push destination.\nПодсказка: git remote add origin <адрес>');
        fail(`fatal: The current branch ${cur} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream origin ${cur}\n`);
      }
    }
    branch ??= cur!;
    const url = (await git.listRemotes({ fs, dir })).find((r) => r.remote === remote)?.url;
    if (!url) fail(`fatal: '${remote}' does not appear to be a git repository`);
    const rdir = this.remotePath(url!);
    const local = await this.resolve(dir, branch);
    let remoteOid: string | null = null;
    try {
      remoteOid = await git.resolveRef({ fs, dir: rdir, ref: `refs/heads/${branch}` });
    } catch {
      /* новая ветка */
    }
    if (remoteOid === local) return 'Everything up-to-date\n';
    if (remoteOid && !force) {
      const known = fs.exists(`${dir}/.git/objects/${remoteOid.slice(0, 2)}/${remoteOid.slice(2)}`);
      const ff = known && (await this.ancestors(dir, local)).has(remoteOid);
      if (!ff)
        fail(
          ` ! [rejected]        ${branch} -> ${branch} (fetch first)\nerror: failed to push some refs to '${url}'\nhint: Updates were rejected because the remote contains work that you do not\nhint: have locally. Integrate the remote changes (e.g. 'git pull ...') before pushing again.`,
        );
    }
    await this.copyObjects(dir, rdir);
    await git.writeRef({ fs, dir: rdir, ref: `refs/heads/${branch}`, value: local, force: true });
    await git.writeRef({ fs, dir, ref: `refs/remotes/${remote}/${branch}`, value: local, force: true });
    if (setUp) {
      await git.setConfig({ fs, dir, path: `branch.${branch}.remote`, value: remote });
      await git.setConfig({ fs, dir, path: `branch.${branch}.merge`, value: `refs/heads/${branch}` });
    }
    const range = remoteOid ? `   ${short(remoteOid)}..${short(local)}  ${branch} -> ${branch}` : ` * [new branch]      ${branch} -> ${branch}`;
    return `To ${url}\n${range}\n${setUp ? `branch '${branch}' set up to track '${remote}/${branch}'.\n` : ''}`;
  }

  private async fetch(dir: string, remote: string): Promise<string> {
    const fs = this.fs;
    const url = (await git.listRemotes({ fs, dir })).find((r) => r.remote === remote)?.url;
    if (!url) fail(`fatal: '${remote}' does not appear to be a git repository`);
    const rdir = this.remotePath(url!);
    await this.fs.copy(`${rdir}/.git/objects`, `${dir}/.git/objects`, { skipExisting: true });
    let out = '';
    for (const b of await git.listBranches({ fs, dir: rdir })) {
      const oid = await git.resolveRef({ fs, dir: rdir, ref: `refs/heads/${b}` });
      let prev: string | null = null;
      try {
        prev = await git.resolveRef({ fs, dir, ref: `refs/remotes/${remote}/${b}` });
      } catch {
        /* new */
      }
      if (prev !== oid) {
        await git.writeRef({ fs, dir, ref: `refs/remotes/${remote}/${b}`, value: oid, force: true });
        out += prev ? `   ${short(prev)}..${short(oid)}  ${b} -> ${remote}/${b}\n` : ` * [new branch]      ${b} -> ${remote}/${b}\n`;
      }
    }
    return out ? `From ${url}\n${out}` : '';
  }

  // ---------------- данные для UI ----------------

  async graph(dirArg?: string): Promise<GitGraph> {
    const fs = this.fs;
    const dir = dirArg ?? (await this.repoRoot());
    if (!dir) return { commits: [], refs: [], head: {}, repo: false };
    const refs: GitGraph['refs'] = [];
    for (const b of await git.listBranches({ fs, dir })) {
      try {
        refs.push({ name: b, oid: await git.resolveRef({ fs, dir, ref: `refs/heads/${b}` }), kind: 'branch' });
      } catch {
        /* пустая ветка */
      }
    }
    for (const r of await git.listRemotes({ fs, dir }))
      for (const b of await git.listBranches({ fs, dir, remote: r.remote }))
        if (b !== 'HEAD') refs.push({ name: `${r.remote}/${b}`, oid: await git.resolveRef({ fs, dir, ref: `refs/remotes/${r.remote}/${b}` }), kind: 'remote' });
    for (const t of await git.listTags({ fs, dir })) refs.push({ name: t, oid: await git.resolveRef({ fs, dir, ref: `refs/tags/${t}` }), kind: 'tag' });
    const head = { branch: (await git.currentBranch({ fs, dir })) ?? undefined, oid: (await this.headOid(dir)) ?? undefined };
    const seen = new Map<string, GraphCommit>();
    const starts = [...refs.map((r) => r.oid), ...(head.oid ? [head.oid] : [])];
    for (const s of starts) {
      try {
        for (const c of await git.log({ fs, dir, ref: s, depth: 200 }))
          seen.set(c.oid, { oid: c.oid, message: c.commit.message.trim().split('\n')[0], parents: c.commit.parent, time: c.commit.committer.timestamp });
      } catch {
        /* skip */
      }
    }
    // Топологический порядок (родители раньше детей); при равенстве — по времени.
    // Коммиты из setup часто сделаны в одну секунду, поэтому одного времени мало.
    const all = [...seen.values()].sort((x, y) => x.time - y.time);
    const placed = new Set<string>();
    const commits: GraphCommit[] = [];
    while (commits.length < all.length) {
      const next = all.find((c) => !placed.has(c.oid) && c.parents.every((p) => placed.has(p) || !seen.has(p)));
      if (!next) break;
      placed.add(next.oid);
      commits.push(next);
    }
    return { commits, refs, head, repo: true };
  }

  /** Список файлов рабочей папки репозитория (или cwd) для файлового дерева в UI. */
  async listFiles(dir: string): Promise<string[]> {
    const out: string[] = [];
    const walk = async (d: string, prefix: string) => {
      for (const n of await this.fs.readdir(d)) {
        if (n === '.git') continue;
        const p = `${d}/${n}`;
        if (this.fs.isDir(p)) {
          out.push(prefix + n + '/');
          await walk(p, prefix + n + '/');
        } else out.push(prefix + n);
      }
    };
    if (this.fs.isDir(dir)) await walk(dir, '');
    return out;
  }
}

function renderDiff(left: Map<string, string>, right: Map<string, string>): string {
  let s = '';
  const files = [...new Set([...left.keys(), ...right.keys()])].sort();
  for (const f of files) {
    const a = left.get(f);
    const b = right.get(f);
    if (a === b) continue;
    s += `${C.bold}diff --git a/${f} b/${f}${C.reset}\n`;
    if (a === undefined) s += `${C.bold}new file${C.reset}\n`;
    if (b === undefined) s += `${C.bold}deleted file${C.reset}\n`;
    s += `${C.bold}--- ${a === undefined ? '/dev/null' : 'a/' + f}\n+++ ${b === undefined ? '/dev/null' : 'b/' + f}${C.reset}\n`;
    for (const [op, line] of lineDiff(a ?? '', b ?? '')) {
      if (op === '-') s += `${C.red}-${line}${C.reset}\n`;
      else if (op === '+') s += `${C.green}+${line}${C.reset}\n`;
      else s += ` ${line}\n`;
    }
  }
  return s;
}

/** Простой LCS-дифф по строкам. */
export function lineDiff(a: string, b: string): [' ' | '-' | '+', string][] {
  const A = a ? a.replace(/\n$/, '').split('\n') : [];
  const B = b ? b.replace(/\n$/, '').split('\n') : [];
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: [' ' | '-' | '+', string][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push([' ', A[i]]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', A[i++]]);
    else out.push(['+', B[j++]]);
  }
  while (i < n) out.push(['-', A[i++]]);
  while (j < m) out.push(['+', B[j++]]);
  return out;
}

const HELP = `Доступные команды:
  ls [-a] [папка]     список файлов          cd <папка>      перейти в папку
  pwd                 где я                  cat <файл>      показать файл
  echo текст > файл   записать в файл        echo текст >> файл  дописать
  touch <файл>        создать пустой файл    mkdir [-p] <папка>
  rm [-r] <путь>      удалить                mv <откуда> <куда>
  tree                дерево файлов          clear           очистить экран
  git ...             см. git help
Можно объединять команды через && и ;
`;

const GIT_HELP = `Поддерживаемые команды git:
  init [--bare] [-b ветка]   config user.name "Имя"     status
  add <файлы|.>              rm [--cached] <файл>       commit -m "..." [-a] [--amend]
  log [--oneline] [--all] [-n N]                        show [коммит]
  diff [--staged]            restore [--staged] <файл>  reset [--soft|--hard] [коммит]
  branch [-a] [имя] [-d имя] [-m старое новое]
  checkout <ветка|коммит> | -b <ветка>                  switch <ветка> | -c <ветка>
  merge <ветка> [--no-ff] [--abort]                     tag [имя] [-d имя]
  remote [-v] | add <имя> <путь> | remove <имя>
  clone <путь> [папка]       push [-u] [remote] [ветка] [-f]
  fetch [remote]             pull [remote] [ветка]
«Удалённые» репозитории здесь — папки, например /srv/origin.git
`;
