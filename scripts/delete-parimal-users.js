/*
  One-off data cleanup script.
  Deletes specific Users + related rows (via FK columns to Users/Applicants) inside a transaction.

  Usage (PowerShell):
    node .\scripts\delete-parimal-users.js

  Safety:
  - Reads DB connection string from local.settings.json (ConnectionStrings.SQLDatabase)
  - Does NOT print the connection string
*/

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const targetUserIds = [
  '88AC2BC8-E08E-40A2-A8CC-9C4EDDCEAC14',
  'A0EB7557-8C14-425C-8939-11350C0B1CE2',
  '28E71E67-8E91-464B-BC9D-72D7D9FF2042',
  '98671774-26C1-4EE4-A5B5-314B07BF9E61',
  'ADA78384-6F46-4650-9DEA-D4B662F56A65',
  '59B0D077-F152-4A87-A9E2-36A2B97DAD28',
  'A53DE5D3-BD4D-4E13-840A-499B6AA9FC95',
  '550EA919-FFE5-4485-9C2A-A2F7E34E32EB',
  '9A571A26-776C-4975-8BF9-301B3DBA47FD',
  'E6C8EE05-8317-4853-8D55-852C7D059109',
];

const qi = (s) => `[${String(s).replace(/]/g, ']]')}]`;
const qn = (schema, table) => `${qi(schema)}.${qi(table)}`;

function readConnectionString() {
  const settingsPath = path.join(process.cwd(), 'local.settings.json');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const cs = settings?.ConnectionStrings?.SQLDatabase;
  if (!cs) throw new Error('Missing ConnectionStrings.SQLDatabase in local.settings.json');
  return cs;
}

async function main() {
  const cs = readConnectionString();

  const pool = await sql.connect(cs);

  // Dynamic lookup for users matching 'aprimal' or 'parimal'
  const findReq = new sql.Request(pool);
  const findRes = await findReq.query(`
    SELECT UserID 
    FROM Users 
    WHERE FirstName LIKE '%aprimal%' 
       OR LastName LIKE '%aprimal%' 
       OR Email LIKE '%aprimal%'
       OR FirstName LIKE '%parimal%' 
       OR LastName LIKE '%parimal%' 
       OR Email LIKE '%parimal%'
  `);

  const targetUserIds = findRes.recordset.map(r => r.UserID);

  if (targetUserIds.length === 0) {
    console.log(JSON.stringify({ success: true, message: 'No users found matching "aprimal" or "parimal".' }, null, 2));
    await pool.close();
    return;
  }

  const tempTable = `##TargetUserIds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const tx = new sql.Transaction(pool);

  await tx.begin();
  try {
    // Temp table of target IDs
    const createReq = new sql.Request(tx);
    let insertSql =
      `CREATE TABLE ${qi(tempTable)} (UserID NVARCHAR(50) NOT NULL PRIMARY KEY); ` +
      `INSERT INTO ${qi(tempTable)}(UserID) VALUES `;

    const valuesSql = [];
    targetUserIds.forEach((id, i) => {
      createReq.input(`id${i}`, sql.NVarChar(50), id);
      valuesSql.push(`(@id${i})`);
    });
    insertSql += valuesSql.join(',');
    await createReq.query(insertSql);

    // FK columns referencing Users/Applicants
    const fkMeta = await new sql.Request(tx).query(`
      SELECT
        schChild.name AS childSchema,
        tChild.name AS childTable,
        cChild.name AS childColumn,
        tParent.name AS parentTable
      FROM sys.foreign_key_columns fkc
      JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables tChild ON tChild.object_id = fkc.parent_object_id
      JOIN sys.schemas schChild ON schChild.schema_id = tChild.schema_id
      JOIN sys.columns cChild ON cChild.object_id = tChild.object_id AND cChild.column_id = fkc.parent_column_id
      JOIN sys.tables tParent ON tParent.object_id = fkc.referenced_object_id
      WHERE tParent.name IN ('Users', 'Applicants');
    `);

    const byChild = new Map();
    for (const r of fkMeta.recordset) {
      if (r.childTable === 'Users' || r.childTable === 'Applicants') continue; // never delete other Users rows
      const key = `${r.childSchema}.${r.childTable}`;
      const entry = byChild.get(key) || { schema: r.childSchema, table: r.childTable, cols: new Set() };
      entry.cols.add(r.childColumn);
      byChild.set(key, entry);
    }

    const tables = [...byChild.values()];
    const tableKey = (t) => `${t.schema}.${t.table}`;
    const tableSet = new Set(tables.map(tableKey));

    // Dependency graph among candidate tables for delete ordering
    const depsRes = await new sql.Request(tx).query(`
      SELECT
        schChild.name AS childSchema,
        tChild.name AS childTable,
        schParent.name AS parentSchema,
        tParent.name AS parentTable
      FROM sys.foreign_key_columns fkc
      JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables tChild ON tChild.object_id = fkc.parent_object_id
      JOIN sys.schemas schChild ON schChild.schema_id = tChild.schema_id
      JOIN sys.tables tParent ON tParent.object_id = fkc.referenced_object_id
      JOIN sys.schemas schParent ON schParent.schema_id = tParent.schema_id;
    `);

    const edges = new Map(); // parent -> Set(children)
    const indeg = new Map();
    for (const t of tables) {
      const k = tableKey(t);
      edges.set(k, new Set());
      indeg.set(k, 0);
    }

    for (const d of depsRes.recordset) {
      const child = `${d.childSchema}.${d.childTable}`;
      const parent = `${d.parentSchema}.${d.parentTable}`;
      if (!tableSet.has(child) || !tableSet.has(parent)) continue;
      if (!edges.get(parent).has(child)) {
        edges.get(parent).add(child);
        indeg.set(child, (indeg.get(child) || 0) + 1);
      }
    }

    // Topological sort, then reverse for child-first deletes
    const queue = [];
    for (const [k, v] of indeg.entries()) {
      if (v === 0) queue.push(k);
    }

    const topo = [];
    while (queue.length) {
      const n = queue.shift();
      topo.push(n);
      for (const c of edges.get(n) || []) {
        indeg.set(c, indeg.get(c) - 1);
        if (indeg.get(c) === 0) queue.push(c);
      }
    }

    let deleteOrder;
    if (topo.length === tables.length) {
      deleteOrder = topo.slice().reverse();
    } else {
      // Cycle fallback
      deleteOrder = [...indeg.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    }

    const deletedCounts = {};

    for (const key of deleteOrder) {
      const t = byChild.get(key);
      if (!t) continue;
      const where = [...t.cols]
        .map((c) => `${qi(c)} IN (SELECT UserID FROM ${qi(tempTable)})`)
        .join(' OR ');

      const sqlText = `DELETE FROM ${qn(t.schema, t.table)} WHERE ${where}; SELECT @@ROWCOUNT AS deleted;`;
      const res = await new sql.Request(tx).query(sqlText);
      deletedCounts[key] = res.recordset?.[0]?.deleted ?? 0;
    }

    // Applicants then Users
    {
      const r1 = await new sql.Request(tx).query(
        `DELETE FROM Applicants WHERE ApplicantID IN (SELECT UserID FROM ${qi(tempTable)}); SELECT @@ROWCOUNT AS deleted;`
      );
      deletedCounts['dbo.Applicants'] = r1.recordset?.[0]?.deleted ?? 0;
    }

    {
      const r2 = await new sql.Request(tx).query(
        `DELETE FROM Users WHERE UserID IN (SELECT UserID FROM ${qi(tempTable)}); SELECT @@ROWCOUNT AS deleted;`
      );
      deletedCounts['dbo.Users'] = r2.recordset?.[0]?.deleted ?? 0;
    }

    const verify = await new sql.Request(tx).query(
      'SELECT ' +
        `(SELECT COUNT(*) FROM Users WHERE UserID IN (SELECT UserID FROM ${qi(tempTable)})) AS usersRemaining, ` +
        `(SELECT COUNT(*) FROM Applicants WHERE ApplicantID IN (SELECT UserID FROM ${qi(tempTable)})) AS applicantsRemaining;`
    );

    // Best-effort cleanup (global temp table)
    try {
      await new sql.Request(tx).query(`DROP TABLE ${qi(tempTable)};`);
    } catch {}

    await tx.commit();

    console.log(
      JSON.stringify(
        {
          success: true,
          deletedCounts,
          verify: verify.recordset?.[0] ?? null,
        },
        null,
        2
      )
    );

    await pool.close();
  } catch (err) {
    try {
      // Best-effort cleanup (global temp table)
      try {
        await new sql.Request(tx).query(`DROP TABLE ${qi(tempTable)};`);
      } catch {}
      await tx.rollback();
    } catch {}

    console.error(
      JSON.stringify(
        {
          success: false,
          message: String(err?.message || err),
        },
        null,
        2
      )
    );

    await pool.close();
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ success: false, message: String(e?.message || e) }, null, 2));
  process.exit(1);
});
