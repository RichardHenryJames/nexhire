/**
 * Encryption utility for sensitive data that needs to be recoverable
 * Uses AES-256-GCM (authenticated encryption)
 * 
 * Key is stored in Azure Key Vault and fetched at runtime
 */

import crypto from 'crypto';

// Algorithm: AES-256-GCM provides both encryption and authentication
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for AES

// Cache the encryption key in memory after first fetch
let cachedEncryptionKey: string | null = null;

/**
 * Generate a secure encryption key (run once, store in Key Vault)
 * @returns Base64 encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * Get encryption key from environment (fetched from Key Vault in production)
 */
export function getEncryptionKey(): string {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }
  
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY not configured. Please set it in environment variables or Azure Key Vault.');
  }
  
  cachedEncryptionKey = key;
  return key;
}

/**
 * Check if a string is already encrypted (has the iv:authTag:data format)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  // Encrypted format has exactly 3 parts, each being valid base64
  if (parts.length !== 3) return false;
  try {
    // Check if all parts are valid base64
    parts.forEach(part => Buffer.from(part, 'base64'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypt sensitive data
 * @param plainText - The data to encrypt
 * @param encryptionKey - Optional key, uses env var if not provided
 * @returns Encrypted string in format: iv:authTag:encryptedData (all base64)
 */
export function encrypt(plainText: string | null | undefined, encryptionKey?: string): string | null {
  if (!plainText) return null;
  
  // Skip if already encrypted
  if (isEncrypted(plainText)) {
    return plainText;
  }
  
  const key = Buffer.from(encryptionKey || getEncryptionKey(), 'base64');
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encryptedData
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * @param encryptedText - The encrypted string (iv:authTag:encryptedData)
 * @param encryptionKey - Optional key, uses env var if not provided
 * @returns Original plain text
 */
export function decrypt(encryptedText: string | null | undefined, encryptionKey?: string): string | null {
  if (!encryptedText) return null;
  
  // If not encrypted (plain text), return as-is (for migration period)
  if (!isEncrypted(encryptedText)) {
    return encryptedText;
  }
  
  try {
    const key = Buffer.from(encryptionKey || getEncryptionKey(), 'base64');
    const [ivBase64, authTagBase64, encrypted] = encryptedText.split(':');
    
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // If decryption fails, return original (might be plain text from before encryption)
    console.error('Decryption failed, returning original value:', error);
    return encryptedText;
  }
}

/**
 * Mask sensitive data for display (e.g., p***@microsoft.com)
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  
  const atIndex = email.indexOf('@');
  if (atIndex <= 1) return email;
  
  const firstChar = email[0];
  const domain = email.substring(atIndex);
  const maskedPart = '*'.repeat(Math.min(atIndex - 1, 5));
  
  return `${firstChar}${maskedPart}${domain}`;
}
