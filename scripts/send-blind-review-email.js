/**
 * One-time script: Send Blind Review launch email to all active users
 * Run: node _tmp_send_blind_review_email.js
 * Delete after use.
 */

const { EmailClient } = require('@azure/communication-email');
const sql = require('mssql');

const ACS_CONN = process.env.ACS_CONNECTION_STRING;
const SENDER = process.env.EMAIL_SENDER_ADDRESS || 'noreply@refopen.com';
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 2000;

const DB_CONFIG = {
  server: process.env.DB_SERVER || 'refopen-sqlserver-ci.database.windows.net',
  database: process.env.DB_NAME || 'refopen-sql-db',
  user: process.env.DB_USER || 'sqladmin',
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 60000 },
};

function buildHtml(firstName) {
  const name = firstName || 'there';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6C3AED,#8B5CF6);padding:36px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Blind Review is here</h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">A new tool from RefOpen</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 18px;color:#1a1a2e;font-size:15px;line-height:24px;">
                Hi ${name},
              </p>
              <p style="margin:0 0 18px;color:#1a1a2e;font-size:15px;line-height:24px;">
                We just launched something we've been working on for a while.
              </p>
              <p style="margin:0 0 18px;color:#1a1a2e;font-size:15px;line-height:24px;">
                <strong>Blind Review</strong> lets you find out if employees at your target company would actually refer you, before you apply.
              </p>

              <p style="margin:0 0 6px;color:#64748B;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">How it works</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="padding:6px 12px 6px 0;vertical-align:top;color:#6C3AED;font-weight:700;font-size:14px;">1.</td>
                  <td style="padding:6px 0;color:#1a1a2e;font-size:14px;line-height:21px;">Pick any company on RefOpen</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px 6px 0;vertical-align:top;color:#6C3AED;font-weight:700;font-size:14px;">2.</td>
                  <td style="padding:6px 0;color:#1a1a2e;font-size:14px;line-height:21px;">Your profile gets reviewed anonymously by AI and by multiple verified employees currently working there</td>
                </tr>
                <tr>
                  <td style="padding:6px 12px 6px 0;vertical-align:top;color:#6C3AED;font-weight:700;font-size:14px;">3.</td>
                  <td style="padding:6px 0;color:#1a1a2e;font-size:14px;line-height:21px;">You get a clear answer: would they refer you? Along with specific feedback on your strengths and gaps</td>
                </tr>
              </table>

              <p style="margin:0 0 18px;color:#1a1a2e;font-size:15px;line-height:24px;">
                Your name, email, and phone number are completely hidden from reviewers. They only see your skills, experience, and background. No bias. Just an honest assessment of your profile.
              </p>

              <p style="margin:0 0 24px;color:#1a1a2e;font-size:15px;line-height:24px;">
                This means you can find out exactly where you stand at Google, Microsoft, Amazon, or any company on RefOpen without anyone knowing you're looking.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="https://www.refopen.com/services/blind-review" style="display:inline-block;background:linear-gradient(135deg,#6C3AED,#8B5CF6);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                      Try Blind Review
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#64748B;font-size:13px;line-height:20px;text-align:center;">
                Free to use for now. Limited time offer.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:24px 40px;border-top:1px solid #E2E8F0;text-align:center;">
              <img src="https://www.refopen.com/refopen-logo.png" alt="RefOpen" width="100" style="margin-bottom:12px;">
              <p style="margin:0 0 8px;color:#64748B;font-size:12px;">
                <a href="https://www.refopen.com" style="color:#6C3AED;text-decoration:none;">RefOpen</a>
                &nbsp;&middot;&nbsp;
                <a href="https://www.refopen.com/support" style="color:#6C3AED;text-decoration:none;">Help</a>
                &nbsp;&middot;&nbsp;
                <a href="https://www.refopen.com/notification-preferences" style="color:#6C3AED;text-decoration:none;">Email Preferences</a>
              </p>
              <p style="margin:0;color:#94A3B8;font-size:11px;">
                You're receiving this because you have an account on RefOpen.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildPlainText(firstName) {
  const name = firstName || 'there';
  return `Hi ${name},

We just launched something we've been working on for a while.

Blind Review lets you find out if employees at your target company would actually refer you, before you apply.

How it works:
1. Pick any company on RefOpen
2. Your profile gets reviewed anonymously by AI and by multiple verified employees currently working there
3. You get a clear answer: would they refer you? Along with specific feedback on your strengths and gaps

Your name, email, and phone number are completely hidden from reviewers. They only see your skills, experience, and background. No bias. Just an honest assessment of your profile.

This means you can find out exactly where you stand at Google, Microsoft, Amazon, or any company on RefOpen without anyone knowing you're looking.

Try Blind Review: https://www.refopen.com/services/blind-review

Free to use for now. Limited time offer.

Team RefOpen`;
}

async function sendOneEmail(emailClient, user, pool) {
  const message = {
    senderAddress: SENDER,
    content: {
      subject: 'Before you apply, find out if insiders would refer you',
      html: buildHtml(user.FirstName),
      plainText: buildPlainText(user.FirstName),
    },
    recipients: { to: [{ address: user.Email }] },
  };

  // Timeout: if beginSend hangs for 15s, skip this user
  const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), ms));
  const poller = await Promise.race([emailClient.beginSend(message), timeout(15000)]);
  const messageId = poller.getOperationState?.()?.id || null;

  await pool.request()
    .input('userId', sql.UniqueIdentifier, user.UserID)
    .input('toEmail', sql.NVarChar, user.Email)
    .input('subject', sql.NVarChar, 'Before you apply, find out if insiders would refer you')
    .input('status', sql.NVarChar, 'sent')
    .input('messageId', sql.NVarChar, messageId)
    .query(`INSERT INTO EmailLogs (UserID, ToEmail, EmailType, Subject, Status, ProviderMessageID)
            VALUES (@userId, @toEmail, 'feature_launch_blind_review', @subject, @status, @messageId)`);
}

async function main() {
  const emailClient = new EmailClient(ACS_CONN);
  const pool = await sql.connect(DB_CONFIG);

  // PRODUCTION: all active users, skip those already emailed
  const result = await pool.request().query(`
    SELECT u.UserID, u.Email, u.FirstName 
    FROM Users u
    WHERE u.IsActive = 1 AND u.Email IS NOT NULL AND u.Email != ''
      AND NOT EXISTS (
        SELECT 1 FROM EmailLogs e 
        WHERE e.UserID = u.UserID 
          AND e.EmailType = 'feature_launch_blind_review' 
          AND e.Status = 'sent'
      )
    ORDER BY u.CreatedAt DESC
  `);

  const users = result.recordset;
  console.log(`\n📧 Sending Blind Review launch email to ${users.length} users (sequential)\n`);

  let sent = 0, failed = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    try {
      await sendOneEmail(emailClient, user, pool);
      sent++;
    } catch (err) {
      failed++;
      console.log(`  ❌ Failed ${user.Email}: ${err.message}`);
    }

    // Progress every 10
    if ((i + 1) % 10 === 0 || i === users.length - 1) {
      console.log(`  ${i + 1}/${users.length} done (${sent} sent, ${failed} failed)`);
    }

    // Small delay between each send to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Done! Sent: ${sent}, Failed: ${failed}`);
  await pool.close();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
