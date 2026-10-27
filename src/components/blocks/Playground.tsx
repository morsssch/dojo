import { useEffect, useState } from 'react';
import type { PlaygroundBlock } from '../../core/schema';
import { prepare, TIMEOUT_MSG } from '../../core/runners/check';
import { browserExecutors, preloadGo } from '../../runtime/executors';
import { CodeEditor } from '../CodeEditor';
import { I } from '../ui/icons';
import { LANG_LABEL, RunOutput, RuntimeNote } from './Task';

/** Запускаемый пример внутри теории: можно менять и запускать, ничего не проверяется. */
export function Playground({ data }: { data: PlaygroundBlock }) {
  const [code, setCode] = useState(data.code);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Parameters<typeof RunOutput>[0]['out'] | null>(null);

  useEffect(() => {
    if (data.lang === 'go') preloadGo();
  }, [data.lang]);

  const run = async () => {
    setBusy(true);
    try {
      if (data.lang === 'sql') {
        const r = await browserExecutors.sql(data.setup ?? '', [code]);
        setOut({ stdout: '', stderr: '', error: r.error, table: r.results.at(-1), ms: r.ms });
      } else {
        const { files, fixError } = prepare(data.lang, code);
        const r = await browserExecutors.code(data.lang, files, data.stdin ?? '');
        setOut({ stdout: r.stdout, stderr: r.stderr, error: r.timeout ? TIMEOUT_MSG : r.error && fixError(r.error), ms: r.ms });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="playground">
      <div className="bar-top">
        <span>{LANG_LABEL[data.lang]} · можно менять и запускать</span>
        <RuntimeNote lang={data.lang} />
        <span className="right">
          {code !== data.code && (
            <button className="btn ghost small" onClick={() => setCode(data.code)} title="Вернуть исходный код">
              <I.reset />
            </button>
          )}
          <button className="btn small primary" onClick={run} disabled={busy} title="Ctrl/⌘ + Enter">
            {busy ? <span className="spinner" /> : <I.play width={14} height={14} />} Запустить
          </button>
        </span>
      </div>
      <CodeEditor value={code} lang={data.lang} onChange={setCode} onRun={run} minLines={2} />
      {out && <RunOutput out={out} />}
    </div>
  );
}
