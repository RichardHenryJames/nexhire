# Security & Authentication Guide

## Overview

NexHire implements a comprehensive security model using Firebase Authentication, JWT tokens, role-based access control (RBAC), and industry-standard security practices.

## Authentication Architecture

### Authentication Flow

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Client     │      │   Firebase   │      │   Backend    │
│  (Mobile)    │──────▶│  Auth        │──────▶│   API        │
└──────────────┘      └──────────────┘      └──────────────┘
     │                      │                      │
     │ 1. Login            │                      │
     │─────────────────────▶                      │
     │                      │                      │
     │ 2. JWT Token        │                      │
     │◀─────────────────────│                      │
     │                      │                      │
     │ 3. API Request      │                      │
     │    + JWT Token      │                      │
     │──────────────────────────────────────────▶ │
     │                      │                      │
     │                      │ 4. Verify Token     │
     │                      │◀─────────────────────│
     │                      │                      │
     │                      │ 5. User Info        │
     │                      │──────────────────────▶
     │                      │                      │
     │ 6. API Response     │                      │
     │◀──────────────────────────────────────────│
```

## Firebase Authentication

### Setup Configuration

```typescript
// frontend/firebase-config.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
```

### Authentication Methods

#### Email/Password Authentication

```typescript
// src/services/auth/emailAuth.ts
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { auth } from '../config/firebase'

export async function registerWithEmail(email: string, password: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      email, 
      password
    )
    
    // Create user profile in database
    await createUserProfile({
      firebaseUid: userCredential.user.uid,
      email: userCredential.user.email,
      displayName: email.split('@')[0]
    })
    
    return userCredential.user
  } catch (error) {
    throw new AuthError(error.code, error.message)
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    )
    return userCredential.user
  } catch (error) {
    throw new AuthError(error.code, error.message)
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}
```

#### Social Authentication (Google, LinkedIn)

```typescript
// src/services/auth/socialAuth.ts
import { 
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider
} from 'firebase/auth'

const googleProvider = new GoogleAuthProvider()
const linkedinProvider = new OAuthProvider('linkedin.com')

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    
    // Get additional user info
    const profile = result.user.providerData[0]
    
    await createOrUpdateUserProfile({
      firebaseUid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      photoURL: result.user.photoURL,
      provider: 'google'
    })
    
    return result.user
  } catch (error) {
    throw new AuthError(error.code, error.message)
  }
}

export async function loginWithLinkedIn() {
  linkedinProvider.addScope('r_emailaddress')
  linkedinProvider.addScope('r_liteprofile')
  
  const result = await signInWithPopup(auth, linkedinProvider)
  // Similar to Google login
}
```

## Backend Token Verification

### Middleware

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
})

export interface AuthRequest extends Request {
  user?: {
    uid: string
    email: string
    role: string
    userId: number
  }
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const token = authHeader.split('Bearer ')[1]
    
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token)
    
    // Get user from database
    const user = await getUserByFirebaseUid(decodedToken.uid)
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }
    
    // Attach user to request
    req.user = {
      uid: decodedToken.uid,
      email: user.email,
      role: user.role,
      userId: user.id
    }
    
    next()
  } catch (error) {
    console.error('Authentication error:', error)
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

### Role-Based Access Control

```typescript
// src/middleware/rbac.middleware.ts
export enum Role {
  USER = 'user',
  REFERRER = 'referrer',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export function authorize(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    if (!allowedRoles.includes(req.user.role as Role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    next()
  }
}

// Usage in routes
router.get('/admin/stats', 
  authenticate, 
  authorize(Role.ADMIN, Role.SUPER_ADMIN),
  getAdminStats
)
```

### Resource Ownership Verification

```typescript
// src/middleware/ownership.middleware.ts
export async function verifyReferralOwnership(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const referralId = parseInt(req.params.referralId)
  const userId = req.user.userId
  
  const referral = await getReferral(referralId)
  
  if (!referral) {
    return res.status(404).json({ error: 'Referral not found' })
  }
  
  // Check if user is seeker or referrer
  if (referral.seekerId !== userId && referral.referrerId !== userId) {
    return res.status(403).json({ error: 'Access denied' })
  }
  
  next()
}

// Usage
router.get('/referrals/:referralId',
  authenticate,
  verifyReferralOwnership,
  getReferralDetails
)
```

## Data Encryption

### Sensitive Data Encryption

```typescript
// src/utils/encryption.ts
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex') // 32 bytes
const IV_LENGTH = 16

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// Usage for sensitive fields
export async function saveUserPaymentMethod(userId: number, cardData: any) {
  const encryptedCard = encrypt(JSON.stringify(cardData))
  
  await db.query(
    'INSERT INTO payment_methods (user_id, encrypted_data) VALUES (?, ?)',
    [userId, encryptedCard]
  )
}
```

### Password Hashing (for admin users)

```typescript
// src/utils/password.ts
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}
```

## API Security

### Rate Limiting

```typescript
// src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

// General API rate limit
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
})

// Strict limit for authentication endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:'
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later'
})

// Usage
app.use('/api/', apiLimiter)
app.use('/api/auth/', authLimiter)
```

### CORS Configuration

```typescript
// src/middleware/cors.ts
import cors from 'cors'

const allowedOrigins = [
  'https://nexhire.com',
  'https://www.nexhire.com',
  'https://app.nexhire.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:19006' : null
].filter(Boolean)

export const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
```

### Request Validation

```typescript
// src/middleware/validation.ts
import { body, param, query, validationResult } from 'express-validator'

export const validateJobSearch = [
  query('q').optional().isString().trim().isLength({ max: 200 }),
  query('location').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  }
]

export const validateCreateReferral = [
  body('jobId').isInt({ min: 1 }),
  body('referrerId').isInt({ min: 1 }),
  body('message').isString().trim().isLength({ min: 10, max: 1000 }),
  
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    next()
  }
]

// Usage
router.get('/jobs/search', validateJobSearch, searchJobs)
router.post('/referrals', authenticate, validateCreateReferral, createReferral)
```

### SQL Injection Prevention

```typescript
// Always use parameterized queries
import { query } from '../config/database'

// ❌ NEVER do this
const userId = req.params.userId
const result = await query(`SELECT * FROM users WHERE id = ${userId}`)

// ✅ Always do this
const userId = req.params.userId
const result = await query('SELECT * FROM users WHERE id = @userId', { userId })

// ✅ Using prepared statements
const stmt = await db.prepare('SELECT * FROM users WHERE id = ?')
const result = await stmt.get(userId)
```

### XSS Prevention

```typescript
// src/utils/sanitize.ts
import xss from 'xss'

export function sanitizeHtml(dirty: string): string {
  return xss(dirty, {
    whiteList: {
      // Allow only safe tags
      p: [],
      br: [],
      strong: [],
      em: [],
      u: []
    }
  })
}

// Usage
export async function createJobPost(data: any) {
  const sanitized = {
    ...data,
    description: sanitizeHtml(data.description),
    requirements: data.requirements.map(sanitizeHtml)
  }
  
  await saveJob(sanitized)
}
```

## Secure File Upload

```typescript
// src/utils/fileUpload.ts
import { BlobServiceClient } from '@azure/storage-blob'
import crypto from 'crypto'
import path from 'path'

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
)

const ALLOWED_MIME_TYPES = {
  resume: ['application/pdf', 'application/msword', 
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  avatar: ['image/jpeg', 'image/png', 'image/gif']
}

const MAX_FILE_SIZE = {
  resume: 10 * 1024 * 1024, // 10 MB
  avatar: 5 * 1024 * 1024    // 5 MB
}

export async function uploadFile(
  file: Express.Multer.File,
  userId: number,
  type: 'resume' | 'avatar'
): Promise<string> {
  // Validate file type
  if (!ALLOWED_MIME_TYPES[type].includes(file.mimetype)) {
    throw new Error('Invalid file type')
  }
  
  // Validate file size
  if (file.size > MAX_FILE_SIZE[type]) {
    throw new Error('File too large')
  }
  
  // Generate secure filename
  const ext = path.extname(file.originalname)
  const hash = crypto.randomBytes(16).toString('hex')
  const filename = `${userId}/${type}/${hash}${ext}`
  
  // Upload to Azure Blob Storage
  const containerClient = blobServiceClient.getContainerClient(type + 's')
  const blockBlobClient = containerClient.getBlockBlobClient(filename)
  
  await blockBlobClient.upload(file.buffer, file.size, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype
    }
  })
  
  // Return public URL
  return blockBlobClient.url
}

// Multer configuration
import multer from 'multer'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      ...ALLOWED_MIME_TYPES.resume,
      ...ALLOWED_MIME_TYPES.avatar
    ]
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// Usage in route
router.post('/users/:userId/resume',
  authenticate,
  upload.single('resume'),
  async (req: AuthRequest, res: Response) => {
    const userId = parseInt(req.params.userId)
    
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    
    const url = await uploadFile(req.file, userId, 'resume')
    
    await updateUserResume(userId, url)
    
    res.json({ resumeUrl: url })
  }
)
```

## Secure Payment Processing (Stripe)

```typescript
// src/services/payment.service.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
})

export async function createPaymentIntent(
  amount: number,
  userId: number,
  referralId: number
): Promise<{ clientSecret: string, paymentIntentId: string }> {
  // Validate amount
  if (amount < 50 || amount > 100000) { // $0.50 to $1000
    throw new Error('Invalid amount')
  }
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount, // in cents
    currency: 'usd',
    metadata: {
      userId: userId.toString(),
      referralId: referralId.toString()
    }
  })
  
  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id
  }
}

export async function handleWebhook(
  rawBody: string,
  signature: string
): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  )
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object
      await handleSuccessfulPayment(paymentIntent)
      break
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object
      await handleFailedPayment(failedPayment)
      break
  }
}
```

## Audit Logging

```typescript
// src/utils/auditLog.ts
interface AuditLogEntry {
  userId: number
  action: string
  resource: string
  resourceId: number
  ipAddress: string
  userAgent: string
  timestamp: Date
  metadata?: any
}

export async function logAudit(entry: AuditLogEntry): Promise<void> {
  await query(`
    INSERT INTO audit_logs 
    (user_id, action, resource, resource_id, ip_address, user_agent, metadata)
    VALUES (@userId, @action, @resource, @resourceId, @ipAddress, @userAgent, @metadata)
  `, entry)
}

// Middleware for automatic audit logging
export function auditMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const originalSend = res.send
  
  res.send = function(data) {
    // Log after successful response
    if (res.statusCode < 400) {
      logAudit({
        userId: req.user?.userId,
        action: req.method,
        resource: req.path,
        resourceId: parseInt(req.params.id) || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      })
    }
    
    return originalSend.call(this, data)
  }
  
  next()
}
```

## Security Headers

```typescript
// src/middleware/securityHeaders.ts
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.nexhire.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// Additional custom headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})
```

## Environment Variables Security

```typescript
// .env.example (never commit actual .env)
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_PRIVATE_KEY=your-private-key

# Database
DATABASE_HOST=your-server.database.windows.net
DATABASE_NAME=nexhire-prod
DATABASE_USER=admin
DATABASE_PASSWORD=strong-password-here

# Encryption
ENCRYPTION_KEY=32-byte-hex-key-here

# Stripe
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
```

### Use Azure Key Vault for Production

```typescript
// src/config/secrets.ts
import { SecretClient } from '@azure/keyvault-secrets'
import { DefaultAzureCredential } from '@azure/identity'

const credential = new DefaultAzureCredential()
const client = new SecretClient(
  process.env.KEY_VAULT_URL,
  credential
)

export async function getSecret(name: string): Promise<string> {
  const secret = await client.getSecret(name)
  return secret.value
}

// Usage
const stripeKey = await getSecret('stripe-secret-key')
```

---

**Last Updated**: December 5, 2025
