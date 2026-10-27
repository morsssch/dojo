// Графическое отображение базы: ER-диаграмма (таблицы, колонки, PK/FK, связи) и данные таблиц.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DbSchema } from '../runtime/sqlSchema';
import { cellText } from '../core/runners/check';
import { I } from './ui/icons';

export function ErDiagram({ schema }: { schema: DbSchema }) {
  const box = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<{ d: string; key: string; x1: number; y1: number; x2: number; y2: number }[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const compute = () => {
      const base = el.getBoundingClientRect();
      const out: typeof paths = [];
      for (const t of schema)
        for (const c of t.columns) {
          if (!c.fk) continue;
          const a = el.querySelector<HTMLElement>(`[data-col="${CSS.escape(`${t.name}.${c.name}`)}"]`);
          const b = el.querySelector<HTMLElement>(`[data-col="${CSS.escape(`${c.fk.table}.${c.fk.column}`)}"]`);
          if (!a || !b) continue;
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          // слева/справа — выходим навстречу; если таблицы друг под другом — обе стороны справа, дугой
          const leftOf = ra.right <= rb.left;
          const rightOf = ra.left >= rb.right;
          const aRight = leftOf || !rightOf;
          const bRight = !leftOf;
          const x1 = (aRight ? ra.right : ra.left) - base.left;
          const y1 = ra.top + ra.height / 2 - base.top;
          const x2 = (bRight ? rb.right : rb.left) - base.left;
          const y2 = rb.top + rb.height / 2 - base.top;
          const same = aRight === bRight;
          const k = same ? 26 + out.length * 12 : Math.max(36, Math.abs(x2 - x1) / 2);
          const c1 = x1 + (aRight ? k : -k);
          const c2 = x2 + (bRight ? k : -k);
          out.push({ d: `M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`, key: `${t.name}.${c.name}`, x1, y1, x2, y2 });
        }
      setPaths(out);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [schema]);

  if (!schema.length) return <div className="muted" style={{ fontSize: 14 }}>В базе пока нет таблиц.</div>;

  return (
    <div className="er" ref={box}>
      <svg className="er-lines" aria-hidden>
        {paths.map((p) => (
          <g key={p.key} className={hover && (p.key === hover || p.key.split('.')[0] === hover) ? 'hot' : ''}>
            <path d={p.d} />
            <circle cx={p.x1} cy={p.y1} r={3.5} />
            <rect x={p.x2 - 3} y={p.y2 - 6} width={6} height={12} rx={1.5} />
          </g>
        ))}
      </svg>
      {schema.map((t) => (
        <div key={t.name} className="er-table" onMouseEnter={() => setHover(t.name)} onMouseLeave={() => setHover(null)}>
          <div className="er-name">
            <I.table width={14} height={14} /> {t.name}
            <span className="er-count">{t.count} стр.</span>
          </div>
          {t.columns.map((c) => (
            <div key={c.name} className={`er-col${c.pk ? ' pk' : ''}`} data-col={`${t.name}.${c.name}`} title={c.fk ? `ссылается на ${c.fk.table}.${c.fk.column}` : undefined}>
              <span className="er-key">{[c.pk && 'PK', c.fk && 'FK'].filter(Boolean).join(' ')}</span>
              <span className="er-cname">{c.name}</span>
              <span className="er-type">
                {c.type}
                {!c.nullable && !c.pk ? <span className="er-nn" title="NOT NULL">!</span> : null}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DbView({ schema, loading, error }: { schema: DbSchema | null; loading?: boolean; error?: string }) {
  const [tab, setTab] = useState<string>('__schema');
  useEffect(() => {
    if (tab !== '__schema' && schema && !schema.some((t) => t.name === tab)) setTab('__schema');
  }, [schema, tab]);
  if (error) return <div className="block-error">{error}</div>;
  if (!schema) return <div className="ws-empty">{loading ? <span className="spinner" /> : null} Читаю схему базы…</div>;
  const t = schema.find((x) => x.name === tab);
  return (
    <div className="db-view">
      <div className="db-tabs" role="tablist">
        <button role="tab" aria-selected={tab === '__schema'} className={tab === '__schema' ? 'on' : ''} onClick={() => setTab('__schema')}>
          Схема
        </button>
        {schema.map((x) => (
          <button key={x.name} role="tab" aria-selected={tab === x.name} className={tab === x.name ? 'on' : ''} onClick={() => setTab(x.name)}>
            {x.name}
          </button>
        ))}
      </div>
      <div className="db-pane">
        {tab === '__schema' && (
          <>
            <ErDiagram schema={schema} />
            <div className="er-legend">
              <span>
                <b>PK</b> первичный ключ
              </span>
              <span>
                <b>FK</b> внешний ключ, линия ведёт к таблице, на которую он ссылается
              </span>
              <span>
                <b>!</b> NOT NULL
              </span>
            </div>
          </>
        )}
        {t && (
          <div className="sql-table">
            <table>
              <thead>
                <tr>
                  {t.columns.map((c) => (
                    <th key={c.name}>
                      {c.name}
                      <span className="th-type">{c.type}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((v, j) => (
                      <td key={j} className={v === null ? 'null' : ''}>
                        {cellText(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              {t.count > t.rows.length ? `Показаны первые ${t.rows.length} из ${t.count} строк` : `${t.count} строк`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
