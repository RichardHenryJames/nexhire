const sql = require('mssql');

(async () => {
  const p = await sql.connect({
    server: 'refopen-sqlserver-ci.database.windows.net',
    database: 'refopen-sql-db',
    user: 'sqladmin',
    password: 'SecureRef2026#Prod!Kv',
    options: { encrypt: true, trustServerCertificate: false }
  });

  // Step 1: Check what exists
  console.log('=== Checking existing constraints/indexes on ReferralRequests ===');
  const existing = await p.request().query(`
    SELECT i.name, i.type_desc, i.is_unique, i.filter_definition
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('ReferralRequests')
      AND i.name LIKE '%UQ%'
  `);
  console.log('Existing UQ indexes:', JSON.stringify(existing.recordset, null, 2));

  // Also check constraints
  const constraints = await p.request().query(`
    SELECT name, type_desc
    FROM sys.key_constraints
    WHERE parent_object_id = OBJECT_ID('ReferralRequests')
      AND name LIKE '%UQ%'
  `);
  console.log('Existing UQ constraints:', JSON.stringify(constraints.recordset, null, 2));

  // Step 2: Drop old constraint if it exists
  if (constraints.recordset.length > 0) {
    for (const c of constraints.recordset) {
      console.log(`\nDropping constraint: ${c.name} (${c.type_desc})...`);
      await p.request().query(`ALTER TABLE ReferralRequests DROP CONSTRAINT [${c.name}]`);
      console.log(`  Dropped.`);
    }
  } else if (existing.recordset.length > 0) {
    for (const idx of existing.recordset) {
      console.log(`\nDropping index: ${idx.name} (${idx.type_desc})...`);
      await p.request().query(`DROP INDEX [${idx.name}] ON ReferralRequests`);
      console.log(`  Dropped.`);
    }
  } else {
    console.log('\nNo existing UQ constraint/index found — may have been dropped already.');
  }

  // Step 3: Create new filtered unique index — only enforces uniqueness for active requests
  console.log('\nCreating filtered unique index UQ_Referral_Active...');
  await p.request().query(`
    CREATE UNIQUE NONCLUSTERED INDEX UQ_Referral_Active 
    ON ReferralRequests(JobID, ExtJobID, ApplicantID) 
    WHERE Status <> 'Cancelled' AND Status <> 'Expired'
  `);
  console.log('  Created.');

  // Step 4: Verify
  console.log('\n=== Verification ===');
  const verify = await p.request().query(`
    SELECT i.name, i.type_desc, i.is_unique, i.filter_definition
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('ReferralRequests')
      AND i.name LIKE '%UQ%'
  `);
  verify.recordset.forEach(r => {
    console.log(`  ${r.name} | ${r.type_desc} | unique=${r.is_unique} | filter=${r.filter_definition}`);
  });

  console.log('\n✅ Done!');
  p.close();
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
