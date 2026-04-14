/**
 * Script to generate secure admin credentials
 * Run with: bun run scripts/generate-admin-credentials.ts
 */

import { randomBytes } from 'crypto';

// Hash password with salt using SHA-256
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random string
function generateRandomString(length: number): string {
  return randomBytes(length).toString('hex');
}

async function main() {
  console.log('\n🔐 Admin Credentials Generator\n');
  console.log('=' .repeat(50));
  
  // Generate values
  const username = 'newstel_admin';
  const password = generateRandomString(16); // 32 char random password
  const salt = generateRandomString(32); // 64 char random salt
  const jwtSecret = generateRandomString(32); // 64 char JWT secret
  const passwordHash = await hashPassword(password, salt);
  
  console.log('\n✅ Generated Credentials:\n');
  console.log('Username:', username);
  console.log('Password:', password);
  console.log('\n📋 Add these to your .env file:\n');
  console.log('─'.repeat(50));
  console.log(`ADMIN_USERNAME="${username}"`);
  console.log(`ADMIN_PASSWORD_HASH="${passwordHash}"`);
  console.log(`ADMIN_SALT="${salt}"`);
  console.log(`JWT_SECRET="${jwtSecret}"`);
  console.log('─'.repeat(50));
  console.log('\n⚠️  IMPORTANT:');
  console.log('1. Save the password securely - you will need it to login');
  console.log('2. The password hash and salt are stored in .env');
  console.log('3. Never commit .env to version control');
  console.log('4. Access admin panel at: your-domain.com/admin\n');
}

main().catch(console.error);
