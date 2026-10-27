// Граф коммитов (вертикальный, как git log --graph): новые сверху, ветки — дорожки.
import type { GitGraph as G } from '../core/git/shell';

// main — цветом текста, остальные ветки — приглушённые различимые цвета
const LANE_COLORS = ['var(--text)', '#4f7fd9', '#2f9e63', '#b9549a', '#7d62cf', '#c9772f', '#2c9aa6'];
const ROW = 34;
const LANE = 22;

export function GitGraph({ g }: { g: G }) {
  if (!g.repo) return <div className="muted" style={{ fontSize: 14 }}>Здесь появится граф коммитов, когда ты сделаешь git init.</div>;
  if (!g.commits.length) return <div className="muted" style={{ fontSize: 14 }}>Репозиторий пуст: коммитов пока нет.</div>;

  // дорожки: main/master первой, затем остальные локальные ветки, затем remote
  const byOid = new Map(g.commits.map((c) => [c.oid, c]));
  const rank = (r: G['refs'][number]) => (r.name === 'main' || r.name === 'master' ? 0 : r.kind === 'branch' ? 1 : r.kind === 'remote' ? 2 : 3);
  const refs = [...g.refs].sort((a, b) => rank(a) - rank(b));
  const lane = new Map<string, number>();
  let lanes = 0;
  for (const r of refs) {
    let oid: string | undefined = r.oid;
    if (lane.has(oid)) continue;
    const l = lanes++;
    while (oid && byOid.has(oid) && !lane.has(oid)) {
      lane.set(oid, l);
      oid = byOid.get(oid)!.parents[0];
    }
  }
  for (const c of g.commits) if (!lane.has(c.oid)) lane.set(c.oid, lanes++);

  const order = [...g.commits].reverse(); // новые сверху
  const y = new Map(order.map((c, i) => [c.oid, 18 + i * ROW]));
  const x = (oid: string) => 14 + lane.get(oid)! * LANE;
  const textX = 14 + Math.max(lanes, 1) * LANE + 4;
  const labels = new Map<string, G['refs']>();
  for (const r of g.refs) labels.set(r.oid, [...(labels.get(r.oid) ?? []), r]);
  const height = 18 + order.length * ROW;
  // ширина по самой длинной строке: подписи веток + сообщение (≈6.6 px на символ моноширинного шрифта)
  const width = Math.max(
    260,
    ...order.map((c) => {
      const pills = (labels.get(c.oid) ?? []).reduce((a, r) => a + r.name.length * 6.6 + 30, 0);
      return textX + 58 + pills + Math.min(c.message.length, 34) * 6.8 + 16;
    }),
  );

  return (
    <svg className="git-graph" width={width} height={height} role="img" aria-label="Граф коммитов">
      {order.map((c) =>
        c.parents.map((p) => {
          if (!y.has(p)) return null;
          const x1 = x(c.oid);
          const y1 = y.get(c.oid)!;
          const x2 = x(p);
          const y2 = y.get(p)!;
          const col = LANE_COLORS[lane.get(c.parents[0] === p ? c.oid : p)! % LANE_COLORS.length];
          const d = x1 === x2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1},${y1 + ROW * 0.8} ${x2},${y2 - ROW * 0.8} ${x2},${y2}`;
          return <path key={c.oid + p} d={d} stroke={col} strokeWidth={2.2} fill="none" />;
        }),
      )}
      {order.map((c) => {
        const cx = x(c.oid);
        const cy = y.get(c.oid)!;
        const isHead = g.head.oid === c.oid;
        const refsHere = labels.get(c.oid) ?? [];
        let lx = textX;
        return (
          <g key={c.oid}>
            <circle cx={cx} cy={cy} r={isHead ? 7 : 5.5} fill={LANE_COLORS[lane.get(c.oid)! % LANE_COLORS.length]} stroke={isHead ? 'var(--text)' : 'var(--surface)'} strokeWidth={isHead ? 2.5 : 2} />
            <text x={textX} y={cy + 4}>
              {c.oid.slice(0, 7)}
            </text>
            {refsHere.map((r) => {
              const label = (g.head.branch === r.name ? 'HEAD → ' : '') + (r.kind === 'tag' ? `🏷 ${r.name}` : r.name);
              const w = label.length * 6.6 + 12;
              const px = lx + 58;
              lx += w + 4;
              const fill = r.kind === 'remote' ? 'var(--bad-soft)' : r.kind === 'tag' ? 'var(--deep-soft)' : g.head.branch === r.name ? 'var(--accent)' : 'var(--ok-soft)';
              const color = r.kind === 'remote' ? 'var(--bad)' : r.kind === 'tag' ? 'var(--deep)' : g.head.branch === r.name ? 'var(--accent-ink)' : 'var(--ok)';
              return (
                <g key={r.kind + r.name}>
                  <rect x={px} y={cy - 9} width={w} height={18} rx={4} fill={fill} />
                  <text x={px + 6} y={cy + 4} style={{ fill: color, fontWeight: 600 }}>
                    {label}
                  </text>
                </g>
              );
            })}
            {!g.head.branch && isHead && (
              <g>
                <rect x={lx + 58} y={cy - 9} width={48} height={18} rx={4} fill="var(--accent)" />
                <text x={lx + 64} y={cy + 4} style={{ fill: 'var(--accent-ink)', fontWeight: 600 }}>
                  HEAD
                </text>
              </g>
            )}
            <text className="msg" x={lx + 58 + (!g.head.branch && isHead ? 54 : 0)} y={cy + 4}>
              {c.message.length > 34 ? c.message.slice(0, 33) + '…' : c.message}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
