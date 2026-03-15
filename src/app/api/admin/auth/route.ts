import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// SECURITY: Admin credentials MUST be set via environment variables
// No hardcoded defaults - if env vars are missing, auth will fail
const getAdminCredentials = () => {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const salt = process.env.ADMIN_SALT;
  
  if (!username || !passwordHash || !salt) {
    console.error('[ADMIN] Missing required environment variables: ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SALT');
    return null;
  }
  
  return { username, passwordHash, salt };
};

// JWT secret - REQUIRED, no fallback
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[ADMIN] Missing required environment variable: JWT_SECRET');
    return null;
  }
  return new TextEncoder().encode(secret);
};

const COOKIE_NAME = 'admin_session';
const SESSION_DURATION = 4 * 60 * 60; // 4 hours in seconds

// Hash password with salt using SHA-256
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify credentials
async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const credentials = getAdminCredentials();
  if (!credentials) {
    return false;
  }
  
  const hashedInput = await hashPassword(password, credentials.salt);
  return username === credentials.username && hashedInput === credentials.passwordHash;
}

// Create JWT token
async function createToken(username: string): Promise<string | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  
  return new SignJWT({ username, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION} seconds`)
    .sign(secret);
}

// Verify JWT token
async function verifyToken(token: string): Promise<{ username: string; role: string } | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { username: string; role: string };
  } catch {
    return null;
  }
}

// POST - Login
export async function POST(request: NextRequest) {
  try {
    // Check if credentials are configured
    const credentials = getAdminCredentials();
    if (!credentials) {
      return NextResponse.json(
        { success: false, error: 'Admin authentication not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password required' },
        { status: 400 }
      );
    }

    const isValid = await verifyCredentials(username, password);
    
    if (!isValid) {
      // Add delay to prevent brute force
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create token
    const token = await createToken(username);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication configuration error' },
        { status: 500 }
      );
    }
    
    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION,
      path: '/'
    });

    console.log(`[ADMIN] User "${username}" logged in successfully`);

    return NextResponse.json({
      success: true,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('[ADMIN] Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}

// GET - Verify session
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        authenticated: false
      });
    }

    const payload = await verifyToken(token);
    
    if (!payload) {
      // Clear invalid cookie
      cookieStore.delete(COOKIE_NAME);
      return NextResponse.json({
        success: false,
        authenticated: false
      });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: { username: payload.username }
    });
  } catch (error) {
    console.error('[ADMIN] Verify error:', error);
    return NextResponse.json({
      success: false,
      authenticated: false
    });
  }
}

// DELETE - Logout
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('[ADMIN] Logout error:', error);
    return NextResponse.json({
      success: false,
      error: 'Logout failed'
    });
  }
}
