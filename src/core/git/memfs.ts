// Минимальная файловая система в памяти с API, который нужен isomorphic-git (fs.promises-стиль).
// Работает одинаково в браузере и node.

type Node = { type: 'file'; data: Uint8Array; mtime: number; mode: number } | { type: 'dir'; children: Map<string, Node>; mtime: number };

const enc = new TextEncoder();
const dec = new TextDecoder();

function err(code: string, path: string): Error {
  const e = new Error(`${code}: ${path}`) as Error & { code: string };
  e.code = code;
  return e;
}

export const normPath = (p: string): string => {
  const parts: string[] = [];
  for (const s of p.split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') parts.pop();
    else parts.push(s);
  }
  return '/' + parts.join('/');
};

let ino = 1;

export class MemFS {
  root: Node = { type: 'dir', children: new Map(), mtime: Date.now() };
  // isomorphic-git ищет fs.promises или методы на объекте
  promises = this;

  private walk(path: string): { parent: Node | null; name: string; node: Node | null } {
    const parts = normPath(path).split('/').filter(Boolean);
    let cur: Node = this.root;
    let parent: Node | null = null;
    for (let i = 0; i < parts.length; i++) {
      if (cur.type !== 'dir') throw err('ENOTDIR', path);
      parent = cur;
      const next = cur.children.get(parts[i]);
      if (!next) {
        if (i === parts.length - 1) return { parent, name: parts[i], node: null };
        throw err('ENOENT', path);
      }
      cur = next;
    }
    return { parent, name: parts.at(-1) ?? '', node: cur };
  }

  async readFile(path: string, opts?: { encoding?: string } | string): Promise<any> {
    const { node } = this.walk(path);
    if (!node) throw err('ENOENT', path);
    if (node.type !== 'file') throw err('EISDIR', path);
    const encoding = typeof opts === 'string' ? opts : opts?.encoding;
    return encoding === 'utf8' || encoding === 'utf-8' ? dec.decode(node.data) : node.data.slice();
  }
  async writeFile(path: string, data: string | Uint8Array, opts?: { mode?: number } | string): Promise<void> {
    const { parent, name, node } = this.walk(path);
    if (!parent || parent.type !== 'dir') throw err('ENOENT', path);
    if (node && node.type === 'dir') throw err('EISDIR', path);
    const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data);
    const mode = (typeof opts === 'object' && opts?.mode) || 0o100644;
    parent.children.set(name, { type: 'file', data: bytes, mtime: Date.now(), mode });
  }
  async unlink(path: string): Promise<void> {
    const { parent, name, node } = this.walk(path);
    if (!node || !parent || parent.type !== 'dir') throw err('ENOENT', path);
    if (node.type === 'dir') throw err('EISDIR', path);
    parent.children.delete(name);
  }
  async readdir(path: string): Promise<string[]> {
    const { node } = this.walk(path);
    if (!node) throw err('ENOENT', path);
    if (node.type !== 'dir') throw err('ENOTDIR', path);
    return [...node.children.keys()].sort();
  }
  async mkdir(path: string, opts?: { recursive?: boolean } | number): Promise<void> {
    if (typeof opts === 'object' && opts?.recursive) {
      let p = '';
      for (const part of normPath(path).split('/').filter(Boolean)) {
        p += '/' + part;
        const { node } = this.walk(p);
        if (!node) await this.mkdir(p);
        else if (node.type !== 'dir') throw err('ENOTDIR', p);
      }
      return;
    }
    const { parent, name, node } = this.walk(path);
    if (node) throw err('EEXIST', path);
    if (!parent || parent.type !== 'dir') throw err('ENOENT', path);
    parent.children.set(name, { type: 'dir', children: new Map(), mtime: Date.now() });
  }
  async rmdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
    const { parent, name, node } = this.walk(path);
    if (!node || !parent || parent.type !== 'dir') throw err('ENOENT', path);
    if (node.type !== 'dir') throw err('ENOTDIR', path);
    if (node.children.size && !opts?.recursive) throw err('ENOTEMPTY', path);
    parent.children.delete(name);
  }
  async rm(path: string, opts?: { recursive?: boolean }): Promise<void> {
    const { node } = this.walk(path);
    if (!node) throw err('ENOENT', path);
    if (node.type === 'dir') return this.rmdir(path, { recursive: opts?.recursive });
    return this.unlink(path);
  }
  async stat(path: string) {
    const { node } = this.walk(path);
    if (!node) throw err('ENOENT', path);
    const isDir = node.type === 'dir';
    const size = node.type === 'file' ? node.data.length : 0;
    return {
      type: isDir ? 'dir' : 'file',
      mode: isDir ? 0o40000 : (node as { mode: number }).mode,
      size,
      ino: ino++,
      mtimeMs: node.mtime,
      ctimeMs: node.mtime,
      uid: 1,
      gid: 1,
      dev: 1,
      isFile: () => !isDir,
      isDirectory: () => isDir,
      isSymbolicLink: () => false,
    };
  }
  lstat(path: string) {
    return this.stat(path);
  }
  async readlink(path: string): Promise<string> {
    throw err('EINVAL', path);
  }
  async symlink(_t: string, path: string): Promise<void> {
    throw err('EPERM', path);
  }
  async chmod(): Promise<void> {}

  // ---- удобства для оболочки ----
  exists(path: string): boolean {
    try {
      return !!this.walk(path).node;
    } catch {
      return false;
    }
  }
  isDir(path: string): boolean {
    try {
      return this.walk(path).node?.type === 'dir';
    } catch {
      return false;
    }
  }
  /** Копирует дерево (используется для clone/push/fetch между «машинами»). */
  async copy(from: string, to: string, opts: { skipExisting?: boolean } = {}): Promise<void> {
    if (this.isDir(from)) {
      await this.mkdir(to, { recursive: true });
      for (const c of await this.readdir(from)) await this.copy(`${from}/${c}`, `${to}/${c}`, opts);
    } else {
      if (opts.skipExisting && this.exists(to)) return;
      await this.writeFile(to, await this.readFile(from));
    }
  }
}
