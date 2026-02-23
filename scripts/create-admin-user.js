/**
 * Create Admin User Script
 * 
 * Creates an admin user in the database (reads from local.settings.json).
 * Uses bcrypt to hash the password.
 * 
 * Usage: node scripts/create-admin-user.js
 *   Defaults: admin@refopen.com / reads password from env or prompts
 * 
 * Options:
 *   --email <email>     Admin email (default: admin@refopen.com)
 *   --password <pwd>    Admin password (default: from ADMIN_PASSWORD env var or Key Vault)
 *   --firstName <name>  First name (default: Platform)
 *   --lastName <name>   Last name (default: Admin)
 */

const sql = require('mssql');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Load DB credentials from local.settings.json
const settingsPath = path.join(__dirname, '..', 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const config = {
    server: settings.Values?.DB_SERVER,
    database: settings.Values?.DB_NAME,
    user: settings.Values?.DB_USER,
    password: settings.Values?.DB_PASSWORD,
    options: {
        encrypt: settings.Values?.DB_ENCRYPT === 'true',
        trustServerCertificate: settings.Values?.DB_TRUST_SERVER_CERTIFICATE === 'true',
        connectionTimeout: 30000,
        requestTimeout: 30000,
    }
};

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
    const idx = args.indexOf(`--${name}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const email = getArg('email', 'admin@refopen.com');
const password = getArg('password', process.env.ADMIN_PASSWORD || 'RefOpenAdmin@2024!');
const firstName = getArg('firstName', 'Platform');
const lastName = getArg('lastName', 'Admin');

async function run() {
    let pool;
    try {
        console.log('==============================================');
        console.log('  Create Admin User');
        console.log('==============================================');
        console.log(`DB: ${config.server} / ${config.database}`);
        console.log(`Email: ${email}`);
        console.log(`Name: ${firstName} ${lastName}`);
        console.log('');

        pool = await sql.connect(config);
        console.log('✓ Connected to database\n');

        // Check if admin already exists
        const existing = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT UserID, Email, UserType FROM Users WHERE Email = @email');

        if (existing.recordset.length > 0) {
            const user = existing.recordset[0];
            if (user.UserType === 'Admin') {
                console.log(`⚠ Admin user already exists: ${user.Email} (${user.UserID})`);
                console.log('  No changes made.');
                return;
            } else {
                // Upgrade existing user to Admin
                console.log(`Found existing user: ${user.Email} (${user.UserType})`);
                console.log('Upgrading to Admin...');
                await pool.request()
                    .input('uid', sql.NVarChar, user.UserID)
                    .query("UPDATE Users SET UserType = 'Admin' WHERE UserID = @uid");
                console.log('✓ User upgraded to Admin');
                return;
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create admin user
        const userId = uuidv4().toUpperCase();
        await pool.request()
            .input('uid', sql.UniqueIdentifier, userId)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, hashedPassword)
            .input('firstName', sql.NVarChar, firstName)
            .input('lastName', sql.NVarChar, lastName)
            .query(`
                INSERT INTO Users (UserID, Email, Password, FirstName, LastName, UserType, EmailVerified, IsActive, CreatedAt, UpdatedAt)
                VALUES (@uid, @email, @password, @firstName, @lastName, 'Admin', 1, 1, GETUTCDATE(), GETUTCDATE())
            `);

        console.log('✓ Admin user created successfully!');
        console.log(`  UserID: ${userId}`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${password}`);
        console.log('');

        // Also store admin password in Key Vault if not already there
        console.log('💡 To store in Key Vault:');
        console.log(`  az keyvault secret set --vault-name refopen-kv-dev --name AdminPassword --value "${password}"`);

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
        console.log('\n✓ Database connection closed.');
    }
}

run();
