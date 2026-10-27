// Vite-плагин: читает папку courses/ и отдаёт `virtual:dojo-manifest`.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { buildManifest } from '../src/core/manifest';

export function readCourseFiles(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ya?ml|md)$/.test(e.name)) out['/' + path.relative(root, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8');
    }
  };
  const dir = path.join(root, 'courses');
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

export default function dojo(): Plugin {
  const ID = 'virtual:dojo-manifest';
  const RID = '\0' + ID;
  let root = process.cwd();
  return {
    name: 'dojo-manifest',
    configResolved(c) {
      root = c.root;
    },
    resolveId(id) {
      return id === ID ? RID : undefined;
    },
    load(id) {
      if (id !== RID) return;
      const m = buildManifest(readCourseFiles(root));
      if (m.errors.length) this.warn(`Ошибки в контенте курсов:\n  ${m.errors.join('\n  ')}`);
      return `export default ${JSON.stringify(m)};`;
    },
    configureServer(server) {
      server.watcher.add(path.join(root, 'courses'));
      const reload = (f: string) => {
        if (!f.includes(`${path.sep}courses${path.sep}`)) return;
        const mod = server.moduleGraph.getModuleById(RID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
      server.watcher.on('change', reload);
    },
  };
}
