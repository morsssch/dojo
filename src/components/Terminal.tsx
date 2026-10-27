// Терминал поверх Shell (git-эмулятор). Используется в git-блоках и в песочнице.
import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import type { Shell } from '../core/git/shell';

export function Ansi({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let cls: string[] = [];
  const re = /\x1b\[(\d+)m/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<span key={k++} className={cls.map((c) => 'ansi-' + c).join(' ')}>{text.slice(last, m.index)}</span>);
    cls = m[1] === '0' ? [] : [...cls.filter((c) => !(Number(c) >= 30 && Number(m![1]) >= 30)), m[1]];
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(<span key={k++} className={cls.map((c) => 'ansi-' + c).join(' ')}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

interface Line {
  cwd?: string;
  cmd?: string;
  out?: string;
}

const COMMANDS = ['git', 'ls', 'cd', 'cat', 'echo', 'touch', 'mkdir', 'rm', 'mv', 'pwd', 'tree', 'clear', 'help'];
const GIT_SUBS = ['init', 'status', 'add', 'commit', 'log', 'branch', 'checkout', 'switch', 'merge', 'reset', 'restore', 'diff', 'tag', 'show', 'remote', 'clone', 'push', 'pull', 'fetch', 'config', 'rm'];

export function Terminal({ shell, onCommand, greeting }: { shell: Shell; onCommand?: (cmd: string, ok: boolean) => void; greeting?: string }) {
  if (!shell.transcript.length && greeting) shell.transcript.push({ out: greeting });
  const [lines, setLinesState] = useState<Line[]>(() => shell.transcript.slice());
  const setLines = (fn: Line[] | ((l: Line[]) => Line[])) =>
    setLinesState((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      shell.transcript = next;
      return next;
    });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const hist = useRef<string[]>([]);
  const hi = useRef(-1);
  const box = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines, busy]);

  const short = (p: string) => (p.startsWith(shell.home) ? '~' + p.slice(shell.home.length) : p);

  const submit = async () => {
    const cmd = input;
    setInput('');
    hi.current = -1;
    if (cmd.trim()) hist.current.unshift(cmd);
    const cwd = shell.cwd;
    setBusy(true);
    const r = await shell.run(cmd);
    setBusy(false);
    if (r.out.includes('\x1bclear')) setLines([]);
    else setLines((ls) => [...ls, { cwd, cmd, out: r.out }]);
    onCommand?.(cmd, r.ok);
    requestAnimationFrame(() => inp.current?.focus({ preventScroll: true }));
  };

  const complete = async () => {
    const parts = input.split(' ');
    const last = parts[parts.length - 1];
    let options: string[] = [];
    if (parts.length === 1) options = COMMANDS;
    else if (parts[0] === 'git' && parts.length === 2) options = GIT_SUBS;
    else {
      const dirPart = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '';
      try {
        const names = await shell.fs.readdir(shell.abs(dirPart || '.'));
        options = names.filter((n) => n !== '.git').map((n) => dirPart + n + (shell.fs.isDir(shell.abs(dirPart + n)) ? '/' : ''));
      } catch {
        options = [];
      }
      if (parts[0] === 'git' && ['checkout', 'switch', 'merge', 'branch'].includes(parts[1])) {
        const g = await shell.graph();
        options.push(...g.refs.filter((r) => r.kind !== 'tag').map((r) => r.name));
      }
    }
    const hits = options.filter((o) => o.startsWith(last));
    if (hits.length === 1) setInput([...parts.slice(0, -1), hits[0]].join(' ') + (hits[0].endsWith('/') ? '' : ' '));
    else if (hits.length > 1) {
      let pre = hits[0];
      for (const h of hits) while (!h.startsWith(pre)) pre = pre.slice(0, -1);
      if (pre.length > last.length) setInput([...parts.slice(0, -1), pre].join(' '));
      else setLines((ls) => [...ls, { cwd: shell.cwd, cmd: input, out: hits.join('  ') + '\n' }]);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!busy) submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hi.current < hist.current.length - 1) setInput(hist.current[++hi.current]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hi.current > 0) setInput(hist.current[--hi.current]);
      else {
        hi.current = -1;
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div className="term" ref={box} onClick={() => window.getSelection()?.isCollapsed && inp.current?.focus({ preventScroll: true })}>
      {lines.map((l, i) => (
        <div key={i} className="line">
          {l.cmd !== undefined && (
            <div>
              <span className="prompt">➜</span> <span className="path">{short(l.cwd!)}</span> {l.cmd}
            </div>
          )}
          {l.out && <Ansi text={l.out} />}
        </div>
      ))}
      <div className="row">
        <span>
          <span className="prompt">➜</span> <span className="path">{short(shell.cwd)}</span>
        </span>
        <input
          ref={inp}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-label="Команда терминала"
          disabled={busy}
        />
      </div>
    </div>
  );
}
