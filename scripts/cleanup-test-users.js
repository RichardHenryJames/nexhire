/*
  Cleanup test users script.
  Deletes users matching parimal, wedding, and their related data.

  Usage (PowerShell):
    node .\scripts\cleanup-test-users.js
*/

const sql = require('mssql');

const config = {
  server: 'refopen-sqlserver-ci.database.windows.net',
  database: 'refopen-sql-db',
  user: 'sqladmin',
  password: 'RefOpen@2024!Secure',
  options: { 
    encrypt: true,
    requestTimeout: 60000
  }
};

async function main() {
  const pool = await sql.connect(config);

  // Find users to delete
  const findRes = await pool.request().query(`
    SELECT UserID, FirstName, LastName, Email
    FROM Users 
    WHERE (FirstName LIKE '%parimal%' 
       OR LastName LIKE '%parimal%' 
       OR Email LIKE '%parimal%'
       OR FirstName LIKE '%wedding%'
       OR LastName LIKE '%wedding%'
       OR Email LIKE '%wedding%')
      AND UserType != 'Admin'
  `);

  const users = findRes.recordset;
  
  if (users.length === 0) {
    console.log('No users found to delete.');
    await pool.close();
    return;
  }

  console.log('Users to delete:');
  users.forEach(u => console.log(`  - ${u.FirstName} ${u.LastName} (${u.Email})`));
  
  const userIds = users.map(r => r.UserID);
  const userIdList = userIds.map(id => `'${id}'`).join(',');

  const tx = new sql.Transaction(pool);
  await tx.begin();

  const deletedCounts = {};

  const safeDelete = async (tableName, whereClause) => {
    try {
      const r = await new sql.Request(tx).query(`
        DELETE FROM ${tableName} WHERE ${whereClause};
        SELECT @@ROWCOUNT AS deleted;
      `);
      deletedCounts[tableName] = r.recordset?.[0]?.deleted ?? 0;
    } catch (e) {
      // Table might not exist, skip
      deletedCounts[tableName] = `SKIP: ${e.message.substring(0, 50)}`;
    }
  };

  try {
    // Delete in correct order (children first, then parents)
    
    // 1. ReferralProofs (child of ReferralRequests)
    await safeDelete('ReferralProofs', 
      `RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (${userIdList}) OR AssignedReferrerID IN (${userIdList}))`);

    // 2. ReferralRequestStatusHistory (child of ReferralRequests)
    await safeDelete('ReferralRequestStatusHistory', 
      `RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (${userIdList}) OR AssignedReferrerID IN (${userIdList}))`);

    // 3. ReferralRewards (child of ReferralRequests)
    await safeDelete('ReferralRewards', 
      `RequestID IN (SELECT RequestID FROM ReferralRequests WHERE ApplicantID IN (${userIdList}) OR AssignedReferrerID IN (${userIdList}))`);

    // 4. ReferralRequests
    await safeDelete('ReferralRequests', 
      `ApplicantID IN (${userIdList}) OR AssignedReferrerID IN (${userIdList})`);

    // 5. WalletTransactions (child of Wallets)
    await safeDelete('WalletTransactions', 
      `WalletID IN (SELECT WalletID FROM Wallets WHERE UserID IN (${userIdList}))`);

    // 6. WalletRechargeOrders
    await safeDelete('WalletRechargeOrders', `UserID IN (${userIdList})`);

    // 7. WalletWithdrawals
    await safeDelete('WalletWithdrawals', `UserID IN (${userIdList}) OR ProcessedBy IN (${userIdList})`);

    // 8. Wallets
    await safeDelete('Wallets', `UserID IN (${userIdList})`);

    // 9. Messages (child of Conversations)
    await safeDelete('Messages', 
      `ConversationID IN (SELECT ConversationID FROM Conversations WHERE User1ID IN (${userIdList}) OR User2ID IN (${userIdList})) OR SenderUserID IN (${userIdList})`);

    // 10. Conversations
    await safeDelete('Conversations', `User1ID IN (${userIdList}) OR User2ID IN (${userIdList})`);

    // 11. JobApplications
    await safeDelete('JobApplications', `ApplicantID IN (${userIdList})`);

    // 12. SavedJobs
    await safeDelete('SavedJobs', `ApplicantID IN (${userIdList})`);

    // 13. UserProfileViews
    await safeDelete('UserProfileViews', `ViewerUserID IN (${userIdList}) OR ViewedUserID IN (${userIdList})`);

    // 14. ApplicantProfileViews
    await safeDelete('ApplicantProfileViews', `ViewedByUserID IN (${userIdList})`);

    // 15. BlockedUsers
    await safeDelete('BlockedUsers', `BlockerUserID IN (${userIdList}) OR BlockedUserID IN (${userIdList})`);

    // 16. PaymentTransactions
    await safeDelete('PaymentTransactions', `UserID IN (${userIdList})`);

    // 17. Clear ReferredBy in Users (self-reference)
    await new sql.Request(tx).query(`
      UPDATE Users SET ReferredBy = NULL WHERE ReferredBy IN (${userIdList});
    `);

    // 18. Applicants
    await safeDelete('Applicants', `ApplicantID IN (${userIdList})`);

    // 19. Employers
    await safeDelete('Employers', `EmployerID IN (${userIdList})`);

    // 20. Finally delete Users
    const r = await new sql.Request(tx).query(`
      DELETE FROM Users WHERE UserID IN (${userIdList});
      SELECT @@ROWCOUNT AS deleted;
    `);
    deletedCounts['Users'] = r.recordset?.[0]?.deleted ?? 0;

    await tx.commit();

    console.log('\n✅ Cleanup successful!');
    console.log('Deleted counts:', JSON.stringify(deletedCounts, null, 2));

    await pool.close();
  } catch (err) {
    try {
      await tx.rollback();
    } catch {}
    
    console.error('❌ Error:', err.message);
    await pool.close();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
