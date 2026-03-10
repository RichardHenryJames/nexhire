# 🔒 RefOpen — Full Security Audit Report

**Audit Date:** March 9, 2026  
**Branch:** `security/full-audit`  
**Auditor:** Automated Security Scan  
**Scope:** Full stack — Azure Functions backend (src/), React Native/Expo frontend (frontend/), database schema, deployment scripts, environment configs

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 **CRITICAL** | 11 | Immediate action required |
| 🟠 **HIGH** | 5 | Fix within 1 week |
| 🟡 **MEDIUM** | 10 | Fix within 1 month |
| 🟢 **GOOD** | 12 | Already secure — no action needed |

**The most urgent issues are:**
1. Production credentials (DB passwords, payment keys, JWT secrets) hardcoded in 60+ files
2. Resumes with sensitive PII stored with public blob access
3. Rate limiting not implemented (TODO stub only)
4. Google OAuth token not verified server-side
5. Unauthenticated file upload endpoints

---

## 1. 🔴 HARDCODED SECRETS & CREDENTIALS (CRITICAL)

### Finding 1.1: Production Database Password in 27+ Files

**Severity:** 🔴 CRITICAL  
**Impact:** Full database compromise if any file is exposed  
**Password:** `***REMOVED***` for `sqladmin@refopen-sqlserver-ci.database.windows.net`

**Affected files include:**
- `env-config.prod.json`
- `env-config.dev-infrastructure.json`
- `_tmp_*.js` files (30+ temporary scripts)
- `scripts/_create_test_user3.js`
- `scripts/seed-career-jobs.js`
- Multiple other script files

**Dev password `***REMOVED***`** appears in 15+ files including `local.settings.json`, `env-config.dev.json`, and `_tmp_*.js` scripts.

**Remediation:**
1. ⚡ **IMMEDIATELY rotate** the production DB password
2. Move all credentials to Azure Key Vault references
3. Delete all `_tmp_*.js` files from the repository
4. Add `_tmp_*.js` and `env-config.*.json` to `.gitignore`
5. Use `dotenv` with `.env` files (gitignored) for local development
6. Scrub git history using `git filter-repo` or BFG Repo Cleaner

---

### Finding 1.2: Production Payment Credentials Hardcoded

**Severity:** 🔴 CRITICAL  
**Impact:** Financial fraud — attackers can process payments or intercept webhooks

| Secret | Value | File |
|--------|-------|------|
| Razorpay LIVE Key ID | `***REMOVED***` | `env-config.prod.json` |
| Razorpay LIVE Secret | `***REMOVED***` | `env-config.prod.json` |
| Razorpay Webhook Secret | `***REMOVED***` | `env-config.prod.json` |
| Cashfree App ID | `***REMOVED***` | `env-config.prod.json` |
| Cashfree Secret Key | `cfsk_ma_test_392c23...` | `env-config.prod.json` |

**Remediation:**
1. ⚡ **IMMEDIATELY rotate** all payment credentials via Razorpay & Cashfree dashboards
2. Store all payment credentials exclusively in Azure Key Vault
3. Verify webhook signature validation is implemented correctly

---

### Finding 1.3: JWT Secret Hardcoded & Weak

**Severity:** 🔴 CRITICAL  
**Impact:** Token forgery — attackers can impersonate any user

| Environment | Secret | File |
|-------------|--------|------|
| Production | `***REMOVED***` | `env-config.prod.json` |
| Development | `***REMOVED***` | `env-config.dev.json` |

Additionally, the infrastructure script generates predictable secrets: `"$Environment-jwt-secret-refopen-$(Get-Date -Format 'yyyy')-secure"`

**Remediation:**
1. Generate a cryptographically random JWT secret (256+ bits): `openssl rand -base64 64`
2. Store in Azure Key Vault only
3. Rotate immediately since current secret is exposed

---

### Finding 1.4: Azure Storage Keys Hardcoded

**Severity:** 🔴 CRITICAL  
**Impact:** Full access to all blob storage (resumes, profile images, uploaded files)

| Environment | Key Location |
|-------------|-------------|
| Dev | `env-config.dev.json`, `local.settings.json` |
| Production | `env-config.prod.json` |

**Remediation:**
1. ⚡ Rotate storage keys via Azure Portal
2. Use Managed Identity for backend → storage access (no keys needed)
3. Remove all storage keys from source code

---

### Finding 1.5: AI Service API Keys Hardcoded

**Severity:** 🔴 CRITICAL  
**Impact:** Unauthorized API usage, billing fraud

| Service | File |
|---------|------|
| Google Gemini API Keys (2 keys) | `env-config.prod.json` |
| Groq API Key | `env-config.prod.json` |
| Jina API Key | `env-config.prod.json` |

**Remediation:** Rotate all keys and store in Key Vault.

---

### Finding 1.6: Azure Communication & SignalR Keys Hardcoded

**Severity:** 🔴 CRITICAL  
**Impact:** Unauthorized messaging and real-time communication access

Both ACS connection strings and SignalR access keys are in `env-config.prod.json`.

**Remediation:** Rotate keys and use Managed Identity.

---

### Finding 1.7: Adzuna API Credentials Hardcoded

**Severity:** 🟠 HIGH  
**Files:** `env-config.prod.json`, `env-config.dev.json`, multiple `_tmp_*.js` scripts

**Remediation:** Rotate and move to Key Vault.

---

### Finding 1.8: Android Keystore Credentials in `credentials.json`

**Severity:** 🟠 HIGH  
**File:** `frontend/credentials.json`

Contains keystore password and key password in plaintext. This file should NOT be in version control.

**Remediation:** Move to CI/CD secrets (GitHub Actions secrets or EAS secrets).

---

## 2. 🔴 AUTHENTICATION & AUTHORIZATION

### Finding 2.1: Google OAuth Token Not Verified Server-Side

**Severity:** 🔴 CRITICAL  
**File:** Auth service (verifyGoogleToken method)  
**Impact:** Complete authentication bypass — any attacker can impersonate any Google user

```typescript
// Current code - VULNERABLE
private static async verifyGoogleToken(idToken: string): Promise<any> {
    // In production, you would verify the Google ID token here
    // For now, we trust the frontend verification
    return { verified: true };
}
```

**Remediation:**
1. Install `google-auth-library`
2. Verify the ID token server-side using Google's token verification endpoint
3. Validate the audience claim matches your client ID

---

### Finding 2.2: Rate Limiting Not Implemented

**Severity:** 🔴 CRITICAL  
**File:** Middleware (rateLimit function)  
**Impact:** Brute force attacks, credential stuffing, OTP brute forcing, account enumeration

```typescript
// Current code - PLACEHOLDER ONLY
export const rateLimit = (requestsPerMinute: number = 60) => {
    return (req, context, next) => {
        // TODO: Implement rate limiting logic
        return next();
    };
};
```

**Remediation:**
1. Implement rate limiting using Azure API Management, or a Redis-based limiter
2. Critical limits:
   - Login: 5 attempts per 15 minutes per IP
   - Registration: 3 per hour per IP
   - Password reset: 3 per hour per email
   - OTP verification: 5 per 10 minutes
   - API general: 100 per minute per user

---

### Finding 2.3: JWT Token Expiry Too Long, No Revocation

**Severity:** 🔴 CRITICAL  
**Impact:** Stolen tokens remain valid for 7 days with no way to revoke

**Current defaults:**
- Access token: 7 days (should be 15-30 minutes)
- Refresh token: 7 days (should be 7-30 days)
- No refresh token rotation
- No server-side token blacklist/revocation
- Logout endpoint returns success but **does NOT invalidate the token**

**Remediation:**
1. Set access token expiry to 15-30 minutes
2. Set refresh token expiry to 7-30 days
3. Implement refresh token rotation (new refresh token on each use, old one invalidated)
4. Add a token blacklist table in the database for revocation
5. Implement proper logout that adds the token to the blacklist

---

## 3. 🔴 FILE UPLOAD SECURITY

### Finding 3.1: Resume Blob Storage is Public

**Severity:** 🔴 CRITICAL  
**Files:** Resume upload service, profile image upload service  
**Impact:** Anyone with the URL can download any user's resume (contains full PII)

```typescript
// Current code - VULNERABLE
await containerClient.createIfNotExists({
    access: 'blob' // Public read access for resumes
});
```

Resume URLs follow a predictable pattern: `resumes/{userId}/resume-{userId}-{timestamp}.pdf`

**Remediation:**
1. Change container access to `private`
2. Serve files through an authenticated API endpoint that generates SAS tokens with short TTLs (5-10 minutes)
3. Validate that the requesting user is authorized to view the resume

---

### Finding 3.2: Upload Endpoints Not Authenticated

**Severity:** 🔴 CRITICAL  
**Files:** Resume upload handler, profile image upload handler  
**Impact:** Any unauthenticated user can upload files under any userId

The upload handlers don't call `authenticateUser` middleware. They trust the `userId` field from the request body.

**Remediation:**
1. Add authentication middleware to all upload endpoints
2. Verify the `userId` in the request matches the authenticated user's ID
3. Reject requests where userId doesn't match the token

---

### Finding 3.3: File Extension Derived from User Input

**Severity:** 🟠 HIGH  
**Impact:** File type bypass — user can upload a .pdf MIME type with .exe extension

```typescript
const fileExtension = data.fileName.split('.').pop() || 'pdf';
```

**Remediation:**
```typescript
// Derive extension from validated MIME type
const mimeToExt = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};
const fileExtension = mimeToExt[data.mimeType] || 'pdf';
```

---

### Finding 3.4: No Malware Scanning

**Severity:** 🟡 MEDIUM  
**Impact:** Malicious files could be stored and served to other users

**Remediation:** Integrate Azure Defender for Storage or ClamAV scanning before persisting uploads.

---

## 4. 🟡 API SECURITY

### Finding 4.1: Wildcard CORS on Upload & WebSocket Endpoints

**Severity:** 🟠 HIGH  
**Files:** Resume upload service, profile image upload service, WebSocket service  
**Impact:** Any domain can make cross-origin requests to these endpoints

The main middleware uses a proper allowlist-based CORS, but upload and WebSocket handlers bypass it with `Access-Control-Allow-Origin: *`.

The WebSocket service has the especially dangerous combination of `origin: '*'` with `credentials: true`.

**Remediation:** Use the same allowlist-based CORS pattern from the main middleware in all services.

---

### Finding 4.2: All Azure Functions Use `authLevel: "anonymous"`

**Severity:** 🟡 MEDIUM  
**Impact:** Azure platform-level auth is disabled — security relies entirely on custom middleware

This is acceptable IF every handler correctly calls `authenticateUser`. Verify no endpoints are missing auth middleware.

**Remediation:** Audit every route handler to ensure auth middleware is called where needed.

---

### Finding 4.3: Request Logger Dumps All Headers (Including Auth)

**Severity:** 🟡 MEDIUM  
**File:** Request logger middleware  
**Impact:** JWT bearer tokens logged to Azure App Insights/logs — token leakage if logs are compromised

```typescript
context.log('Request received:', {
    headers: Object.fromEntries(req.headers.entries()),
});
```

**Remediation:** Filter out `Authorization`, `Cookie`, and `x-functions-key` headers from logs.

---

## 5. 🟡 PII DATA HANDLING

### Finding 5.1: PII Logged in Production

**Severity:** 🟡 MEDIUM  
**Impact:** User email addresses, push tokens, and request details stored in application logs

Multiple backend services log user email addresses:
- Auth service: logs emails during login/registration/password reset
- Referral service: logs user emails
- Notification service: logs push tokens

**Remediation:**
1. Use the existing `maskEmail` utility from the encryption service
2. Create a structured logger that auto-masks PII fields
3. Remove all `console.log` calls that include user data in production

---

### Finding 5.2: No Self-Service Account Deletion

**Severity:** 🟡 MEDIUM  
**Impact:** GDPR/DPDPA non-compliance — users can only deactivate, not delete

The `deleteAccount` function exists and cascades across 40+ tables (good), but it's only accessible via admin/support.

**Remediation:** Add a self-service account deletion endpoint with:
1. Password/OTP confirmation
2. 30-day grace period before permanent deletion
3. Email confirmation of deletion request

---

### Finding 5.3: ClientIP and UserAgent Stored

**Severity:** 🟡 MEDIUM  
**Impact:** IP addresses are PII under GDPR

The `ApplicantProfileViews` table stores `ClientIP` and `UserAgent`.

**Remediation:** Implement data retention policy — auto-delete or anonymize IP addresses after 90 days.

---

## 6. 🟡 FRONTEND SECURITY

### Finding 6.1: Auth Tokens in localStorage on Web

**Severity:** 🟡 MEDIUM  
**Impact:** XSS attacks can steal authentication tokens on the web platform

Mobile uses `expo-secure-store` (encrypted keychain) ✅, but web falls back to `AsyncStorage` which wraps `localStorage`.

**Remediation:**
1. For web: Use `httpOnly` cookies set by the backend, OR
2. Store tokens in memory only with silent refresh via iframe, OR
3. Accept the risk and ensure strong XSS protections (CSP without `unsafe-inline`)

---

### Finding 6.2: CSP Allows `unsafe-inline` and `unsafe-eval`

**Severity:** 🟡 MEDIUM  
**File:** `frontend/staticwebapp.config.json`  
**Impact:** Significantly weakens XSS protection

**Remediation:**
1. Replace `unsafe-inline` with nonce-based CSP
2. Remove `unsafe-eval` if the bundler supports it (modern Webpack/Vite can)

---

### Finding 6.3: No SSL Certificate Pinning

**Severity:** 🟡 MEDIUM (Low risk for most apps)  
**Impact:** MITM attacks possible with compromised root CA

**Remediation:** Consider implementing certificate pinning for mobile using `expo-certificate-transparency` or similar.

---

## 7. 🟢 THINGS DONE WELL

| # | Area | Detail |
|---|------|--------|
| 1 | Password Hashing | bcrypt with 12 salt rounds ✅ |
| 2 | Encryption | AES-256-GCM with random IVs, key from Key Vault ✅ |
| 3 | SQL Injection | All queries use parameterized inputs via `mssql` library ✅ |
| 4 | Resume Anonymization | PII stripped before sending to AI APIs ✅ |
| 5 | RBAC | Granular role-based permissions enforced ✅ |
| 6 | DPDPA Consent | Proper consent logging with IP, timestamps, versions ✅ |
| 7 | Security Headers | HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy ✅ |
| 8 | Input Validation | Joi schemas for structured input validation ✅ |
| 9 | File Size Limits | 10MB for resumes, 5MB for images ✅ |
| 10 | MIME Type Validation | Whitelist-based MIME validation on uploads ✅ |
| 11 | Filename Sanitization | Generated filenames prevent path traversal ✅ |
| 12 | Deploy Safeguards | Branch protection for production deployments ✅ |

---

## 📋 Remediation Plan (Priority Order)

### Phase 1 — IMMEDIATE (This Week) 🚨

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 1 | **Rotate ALL production credentials** (DB password, payment keys, JWT secret, storage keys, AI keys, SignalR keys) | 2h | Prevents exploitation of exposed secrets |
| 2 | **Delete all `_tmp_*.js` files** and add to `.gitignore` | 30m | Removes 30+ files with hardcoded prod credentials |
| 3 | **Move `env-config.*.json` to `.gitignore`** and use Key Vault references | 2h | Prevents future secret exposure |
| 4 | **Scrub git history** with `git filter-repo` / BFG Repo Cleaner | 1h | Removes secrets from git history |
| 5 | **Make blob containers private** (resumes, profile images) | 1h | Prevents unauthorized resume downloads |
| 6 | **Add authentication to upload endpoints** | 1h | Prevents unauthenticated file uploads |
| 7 | **Verify Google OAuth tokens server-side** | 2h | Prevents authentication bypass |

### Phase 2 — This Sprint (1-2 Weeks) ⚠️

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 8 | **Implement rate limiting** on login, registration, password reset, OTP endpoints | 4h | Prevents brute force and credential stuffing |
| 9 | **Fix JWT expiry** — access: 15-30min, refresh: 7-30 days, implement rotation | 4h | Limits token theft window |
| 10 | **Implement token revocation** (blacklist table + logout invalidation) | 4h | Enables proper session termination |
| 11 | **Fix wildcard CORS** on upload and WebSocket endpoints | 1h | Prevents cross-origin attacks |
| 12 | **Derive file extensions from MIME type** instead of user-supplied filename | 30m | Prevents file type bypass |

### Phase 3 — This Month 🟡

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 13 | **Mask PII in logs** — use `maskEmail` utility, filter auth headers | 2h | Prevents PII leakage in logs |
| 14 | **Add self-service account deletion** | 4h | GDPR/DPDPA compliance |
| 15 | **Implement IP data retention policy** (auto-delete after 90 days) | 2h | GDPR compliance |
| 16 | **Move web auth tokens** from localStorage to httpOnly cookies | 8h | Protects against XSS token theft |
| 17 | **Tighten CSP** — remove `unsafe-inline` and `unsafe-eval` | 4h | Strengthens XSS protection |
| 18 | **Add malware scanning** for file uploads (Azure Defender for Storage) | 4h | Prevents malicious file uploads |
| 19 | **Move Android keystore credentials** to CI/CD secrets | 1h | Removes keystore passwords from repo |
| 20 | **Audit all endpoints** for missing auth middleware | 2h | Ensures no unprotected routes |

---

## 🛡️ Ongoing Security Practices (Recommendations)

1. **Secret Scanning:** Enable GitHub secret scanning and push protection
2. **Dependency Scanning:** Add `npm audit` and Dependabot to CI/CD
3. **SAST:** Add CodeQL or SonarQube to the CI pipeline
4. **Penetration Testing:** Schedule quarterly pen tests
5. **Security Headers Monitoring:** Use securityheaders.com to verify headers
6. **Logging & Monitoring:** Set up Azure Sentinel alerts for:
   - Multiple failed login attempts
   - Unusual API access patterns
   - Large data exports
   - Admin actions
7. **Incident Response Plan:** Document procedures for credential compromise
8. **Security Training:** Ensure all developers understand OWASP Top 10

---

*This report should be treated as CONFIDENTIAL and not shared outside the development team.*
