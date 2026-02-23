// Script: Sync .env.dev to Azure Function App
const fs = require('fs');
const { execSync } = require('child_process');

const envFile = fs.readFileSync('c:\\Users\\parimalkumar\\Desktop\\Projects\\refopen\\.env.dev', 'utf8');
const lines = envFile.split('\n');
const settings = [];

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex < 1) continue;
  const key = trimmed.substring(0, eqIndex).trim();
  const value = trimmed.substring(eqIndex + 1).trim();
  if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    settings.push(`${key}=${value}`);
  }
}

console.log(`Found ${settings.length} env vars to sync`);
console.log('Syncing to refopen-api-func-dev...');

// Azure CLI needs settings as separate arguments
const cmd = `az functionapp config appsettings set --name refopen-api-func-dev --resource-group refopen-dev-rg --settings ${settings.map(s => `"${s.replace(/"/g, '\\"')}"`).join(' ')} --output none`;

try {
  execSync(cmd, { stdio: 'inherit', timeout: 120000 });
  console.log('Env vars synced successfully!');
} catch (e) {
  console.error('Failed:', e.message?.slice(0, 200));
}

(async () => {
  try {
    console.log('Connecting to dev DB...');
    const pool = await sql.connect({
      server: 'refopen-sqlserver-dev.database.windows.net',
      database: 'refopen-sql-db-dev',
      user: 'sqladmin',
      password: 'RefOpenDev@2024!Tle@yTK$',
      options: { encrypt: true },
      requestTimeout: 120000,
    });

    // Apply seed data — combine SET IDENTITY_INSERT ON with INSERT statements
    const seed = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema', 'seed-data.sql'), 'utf8');
    const lines = seed.split('\n');
    
    let currentIdentityTable = null;
    let insertBuffer = [];
    let successCount = 0;
    
    const flushBuffer = async () => {
      if (insertBuffer.length === 0) return;
      const sql_str = currentIdentityTable 
        ? `SET IDENTITY_INSERT [${currentIdentityTable}] ON;\n${insertBuffer.join('\n')}\nSET IDENTITY_INSERT [${currentIdentityTable}] OFF;`
        : insertBuffer.join('\n');
      try {
        await pool.request().query(sql_str);
        successCount += insertBuffer.length;
      } catch (e) {
        // If batch fails, try individual inserts
        for (const stmt of insertBuffer) {
          const sql2 = currentIdentityTable 
            ? `SET IDENTITY_INSERT [${currentIdentityTable}] ON; ${stmt} SET IDENTITY_INSERT [${currentIdentityTable}] OFF;`
            : stmt;
          try { await pool.request().query(sql2); successCount++; } catch {}
        }
      }
      insertBuffer = [];
    };
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--') || /^GO$/i.test(trimmed)) continue;
      
      // Detect SET IDENTITY_INSERT ON
      const identityOnMatch = trimmed.match(/SET\s+IDENTITY_INSERT\s+\[?(\w+)\]?\s+ON/i);
      if (identityOnMatch) {
        await flushBuffer();
        currentIdentityTable = identityOnMatch[1];
        continue;
      }
      
      // Detect SET IDENTITY_INSERT OFF
      if (/SET\s+IDENTITY_INSERT/i.test(trimmed) && /OFF/i.test(trimmed)) {
        await flushBuffer();
        currentIdentityTable = null;
        continue;
      }
      
      // Collect INSERT statements
      if (/^INSERT\s+INTO/i.test(trimmed)) {
        insertBuffer.push(trimmed);
        // Flush every 50 inserts to keep batch size manageable
        if (insertBuffer.length >= 50) {
          await flushBuffer();
        }
      }
    }
    await flushBuffer();
    
    console.log('Seed data applied!');

    // Verify seed data
    const tables = ['ReferenceMetadata', 'ReferralPlans', 'PricingSettings', 'PaymentSettings', 'Currencies', 'JobTypes', 'WorkplaceTypes', 'SalaryComponents', 'ApplicationStatuses', 'WalletBonusPacks'];
    for (const table of tables) {
      try {
        const r = await pool.request().query(`SELECT COUNT(*) as cnt FROM [${table}]`);
        console.log(`  ${table}: ${r.recordset[0].cnt} rows`);
      } catch {}
    }

    await pool.close();
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit();
})();
