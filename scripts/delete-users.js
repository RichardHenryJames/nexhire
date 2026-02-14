/**
 * Delete Users Script
 * 
 * Reads emails from a text file (one per line) and deletes those users
 * along with all their related data from the database.
 * 
 * Usage: node scripts/delete-users.js [path-to-txt-file]
 *   Default file: scripts/users-to-delete.txt
 * 
 * Options:
 *   --dry-run    Preview what would be deleted without making changes
 *   --force      Skip confirmation prompt
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load DB credentials
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
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
};

const isDryRun = process.argv.includes('--dry-run');
const isForce = process.argv.includes('--force');

// Get txt file path from args or use default
const txtFile = process.argv.find(a => a.endsWith('.txt')) 
    || path.join(__dirname, 'users-to-delete.txt');

async function confirmAction(message) {
    if (isForce) return true;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(message + ' (y/N): ', answer => {
            rl.close();
            resolve(answer.trim().toLowerCase() === 'y');
        });
    });
}

async function run() {
    console.log('==============================================');
    console.log('  Delete Users Script');
    console.log('==============================================');
    if (isDryRun) console.log('  *** DRY RUN — no changes will be made ***\n');

    // Read emails from file
    if (!fs.existsSync(txtFile)) {
        console.error(`File not found: ${txtFile}`);
        process.exit(1);
    }

    const emails = fs.readFileSync(txtFile, 'utf8')
        .split('\n')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0 && e.includes('@'));

    if (emails.length === 0) {
        console.log('No emails found in file.');
        return;
    }

    console.log(`Found ${emails.length} email(s) to delete:\n`);
    emails.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    console.log('');

    let pool;
    try {
        pool = await sql.connect(config);
        console.log('✓ Connected to database\n');

        // Verify users exist
        const placeholders = emails.map((_, i) => `@email${i}`).join(', ');
        const verifyReq = pool.request();
        emails.forEach((e, i) => verifyReq.input(`email${i}`, sql.NVarChar, e));
        const existing = await verifyReq.query(
            `SELECT UserID, Email, FirstName, LastName, UserType, CreatedAt FROM Users WHERE LOWER(Email) IN (${placeholders})`
        );

        if (existing.recordset.length === 0) {
            console.log('None of these emails exist in the database.');
            return;
        }

        console.log('Users found in database:');
        console.log('─'.repeat(80));
        existing.recordset.forEach(u => {
            console.log(`  ${u.FirstName} ${u.LastName} (${u.Email}) — ${u.UserType} — created: ${new Date(u.CreatedAt).toISOString()}`);
        });
        console.log('─'.repeat(80));

        const notFound = emails.filter(e => !existing.recordset.find(u => u.Email.toLowerCase() === e));
        if (notFound.length > 0) {
            console.log(`\n⚠ Not found (skipping): ${notFound.join(', ')}`);
        }
        console.log('');

        if (isDryRun) {
            console.log('Dry run complete. Run without --dry-run to delete.');
            return;
        }

        if (!await confirmAction(`⚠ DELETE ${existing.recordset.length} user(s) permanently?`)) {
            console.log('Cancelled.');
            return;
        }

        // Delete each user and related data
        let successCount = 0;
        let errorCount = 0;

        for (const user of existing.recordset) {
            const tx = new sql.Transaction(pool);
            try {
                await tx.begin();
                const uid = user.UserID;

                // Delete from all related tables (order matters for FK constraints)
                // Column names verified against actual DB schema
                const deleteTables = [
                    // Consent & activity logs
                    `DELETE FROM UserConsentLog WHERE UserID = @uid`,
                    `DELETE FROM UserActivityLogs WHERE UserID = @uid`,
                    // SAFE: Delete views made by this user and views of this user (low-value analytics, ViewedUserID is NOT NULL so can't anonymize)
                    `DELETE FROM UserProfileViews WHERE ViewerUserID = @uid OR ViewedUserID = @uid`,
                    `DELETE FROM UserSessions WHERE UserID = @uid`,
                    // Notifications & support
                    `DELETE FROM InAppNotifications WHERE UserID = @uid`,
                    `DELETE FROM NotificationPreferences WHERE UserID = @uid`,
                    `DELETE FROM PushTokens WHERE UserID = @uid`,
                    `DELETE FROM SupportMessages WHERE SenderID = @uid`,
                    `DELETE FROM SupportTickets WHERE UserID = @uid`,
                    `DELETE FROM InAppNotifications WHERE UserID = @uid`,
                    `DELETE FROM NotificationQueue WHERE UserID = @uid`,
                    // Email
                    `DELETE FROM EmailLogs WHERE UserID = @uid`,
                    `DELETE FROM EmailVerificationOTPs WHERE UserID = @uid`,
                    // DailyJobEmailLogs has no UserID — skip
                    // Wallet & payments
                    `DELETE FROM WalletTransactions WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @uid)`,
                    `DELETE FROM WalletHolds WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @uid)`,
                    `DELETE FROM WalletRechargeOrders WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @uid)`,
                    `DELETE FROM WalletWithdrawals WHERE WalletID IN (SELECT WalletID FROM Wallets WHERE UserID = @uid)`,
                    `DELETE FROM Wallets WHERE UserID = @uid`,
                    `DELETE FROM ManualPaymentSubmissions WHERE UserID = @uid`,
                    `DELETE FROM PaymentOrders WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM PaymentTransactions WHERE UserID = @uid`,
                    // Referrals
                    // SAFE: Delete proofs this user uploaded as referrer
                    `DELETE FROM ReferralProofs WHERE ReferrerID = @uid`,
                    // SAFE: Delete proofs on this user's own requests (they're the applicant being deleted)
                    `DELETE FROM ReferralProofs WHERE RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid))`,
                    // SAFE: Only delete status history for this user's own requests (not requests where they were just the referrer)
                    `DELETE FROM ReferralRequestStatusHistory WHERE RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid))`,
                    // ReferralExpirationLogs is a system log — no user FK
                    `DELETE FROM ReferralRewards WHERE ReferrerID = @uid`,
                    // SAFE: Delete this user's own referral requests (they're the applicant)
                    `DELETE FROM ReferralRequests WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    // SAFE: Unassign this user as referrer on other people's requests (don't delete their requests)
                    `UPDATE ReferralRequests SET AssignedReferrerID = NULL, Status = 'Pending', ReferredAt = NULL WHERE AssignedReferrerID = @uid`,
                    `DELETE FROM ReferrerStats WHERE ReferrerID = @uid`,
                    `DELETE FROM SocialShareClaims WHERE UserID = @uid`,
                    // Applicant profile data
                    `DELETE FROM ApplicantProfileViews WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM ApplicantReferralSubscriptions WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM ApplicantResumes WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM ApplicantSalaries WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM WorkExperiences WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM ResumeMetadata WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    // Jobs & applications
                    `DELETE FROM ApplicationAttachments WHERE ApplicationID IN (SELECT ApplicationID FROM JobApplications WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid))`,
                    `DELETE FROM ApplicationTracking WHERE ApplicationID IN (SELECT ApplicationID FROM JobApplications WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid))`,
                    `DELETE FROM JobApplications WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM SavedJobs WHERE ApplicantID IN (SELECT ApplicantID FROM Applicants WHERE UserID = @uid)`,
                    `DELETE FROM Applicants WHERE UserID = @uid`,
                    // Employer data
                    // JobArchiveLogs is a system table — no user FK
                    // SAFE: Anonymize jobs instead of deleting (other users may have applications/saved jobs referencing them)
                    `UPDATE Jobs SET PostedByUserID = NULL WHERE PostedByUserID = @uid`,
                    `DELETE FROM Employers WHERE UserID = @uid`,
                    // SAFE: Never delete orgs, just remove the user reference
                    `UPDATE Organizations SET CreatedBy = NULL, UpdatedBy = NULL WHERE CreatedBy = @uid`,
                    // Messaging
                    // SAFE: Delete all messages in conversations this user is part of
                    `DELETE FROM Messages WHERE ConversationID IN (SELECT ConversationID FROM Conversations WHERE User1ID = @uid OR User2ID = @uid)`,
                    // SAFE: Delete conversations this user is part of (both sides cleaned up above)
                    `DELETE FROM Conversations WHERE User1ID = @uid OR User2ID = @uid`,
                    // SAFE: Only delete blocks this user created, NOT blocks other users created against them
                    `DELETE FROM BlockedUsers WHERE BlockerUserID = @uid`,
                    // Finally, the user
                    `DELETE FROM Users WHERE UserID = @uid`,
                ];

                for (const stmt of deleteTables) {
                    if (stmt.startsWith('//')) continue; // skip comments
                    try {
                        await new sql.Request(tx).input('uid', sql.NVarChar, uid).query(stmt);
                    } catch (e) {
                        // Skip if table/column doesn't exist
                        if (e.message.includes('Invalid object name') || e.message.includes('Invalid column name')) continue;
                        throw e;
                    }
                }

                await tx.commit();
                successCount++;
                console.log(`  ✓ Deleted: ${user.Email}`);
            } catch (err) {
                try { await tx.rollback(); } catch (_) {}
                errorCount++;
                console.error(`  ✗ Failed: ${user.Email} — ${err.message}`);
            }
        }

        console.log('\n==============================================');
        console.log(`  Results: ${successCount} deleted, ${errorCount} failed`);
        console.log('==============================================');

    } catch (err) {
        console.error('Script failed:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
        console.log('\n✓ Database connection closed.');
    }
}

run();
