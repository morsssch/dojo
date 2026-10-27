// Описание схемы БД, которое мы получаем у самого Postgres (а не парсим CREATE TABLE руками).
export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  pk: boolean;
  fk?: { table: string; column: string };
}
export interface DbTable {
  name: string;
  columns: DbColumn[];
  rows: unknown[][];
  count: number;
}
export type DbSchema = DbTable[];

type Exec = (sql: string) => Promise<{ rows: unknown[][] }>;

const Q_COLUMNS = `
SELECT c.table_name, c.column_name,
       CASE WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
            WHEN c.data_type = 'character varying' THEN 'varchar'
            WHEN c.data_type = 'timestamp with time zone' THEN 'timestamptz'
            WHEN c.data_type = 'timestamp without time zone' THEN 'timestamp'
            ELSE c.data_type END,
       c.is_nullable = 'YES', c.column_default LIKE 'nextval%'
FROM information_schema.columns c
JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position`;

const Q_PK = `
SELECT cl.relname, att.attname
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
WHERE con.contype = 'p'`;

const Q_FK = `
SELECT cl.relname, att.attname, clf.relname, attf.attname
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cl.relnamespace AND ns.nspname = 'public'
JOIN pg_class clf ON clf.oid = con.confrelid
JOIN LATERAL unnest(con.conkey, con.confkey) AS k(a, fa) ON true
JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.a
JOIN pg_attribute attf ON attf.attrelid = con.confrelid AND attf.attnum = k.fa
WHERE con.contype = 'f'`;

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;

export async function introspect(exec: Exec, rowLimit = 50): Promise<DbSchema> {
  const cols = (await exec(Q_COLUMNS)).rows as [string, string, string, boolean, boolean][];
  const pks = (await exec(Q_PK)).rows as [string, string][];
  const fks = (await exec(Q_FK)).rows as [string, string, string, string][];
  const tables = new Map<string, DbTable>();
  for (const [t, c, type, nullable, serial] of cols) {
    if (!tables.has(t)) tables.set(t, { name: t, columns: [], rows: [], count: 0 });
    tables.get(t)!.columns.push({ name: c, type: serial ? (type === 'bigint' ? 'bigserial' : 'serial') : type, nullable, pk: false });
  }
  for (const [t, c] of pks) {
    const col = tables.get(t)?.columns.find((x) => x.name === c);
    if (col) col.pk = true;
  }
  for (const [t, c, ft, fc] of fks) {
    const col = tables.get(t)?.columns.find((x) => x.name === c);
    if (col) col.fk = { table: ft, column: fc };
  }
  for (const t of tables.values()) {
    t.rows = (await exec(`SELECT * FROM ${ident(t.name)} LIMIT ${rowLimit}`)).rows;
    t.count = Number((await exec(`SELECT count(*) FROM ${ident(t.name)}`)).rows[0]?.[0] ?? 0);
  }
  return orderByRefs([...tables.values()]);
}

/** Родительские таблицы (на которые ссылаются) — левее дочерних. */
function orderByRefs(ts: DbTable[]): DbTable[] {
  const depth = new Map<string, number>();
  const get = (t: DbTable, seen = new Set<string>()): number => {
    if (depth.has(t.name)) return depth.get(t.name)!;
    if (seen.has(t.name)) return 0;
    seen.add(t.name);
    const parents = t.columns.filter((c) => c.fk && c.fk.table !== t.name).map((c) => ts.find((x) => x.name === c.fk!.table)!).filter(Boolean);
    const d = parents.length ? 1 + Math.max(...parents.map((p) => get(p, seen))) : 0;
    depth.set(t.name, d);
    return d;
  };
  ts.forEach((t) => get(t));
  return ts.sort((a, b) => depth.get(a.name)! - depth.get(b.name)! || a.name.localeCompare(b.name));
}
