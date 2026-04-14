import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { getAllMessages } from '@/lib/supabase';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'newstel-jwt-secret-key-super-long-random-string-2024-secure'
);

const COOKIE_NAME = 'admin_session';

// Verify admin session
async function verifyAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!token) return false;
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// POST - Create backup
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all messages from Supabase
    const messages = await getAllMessages();
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'download');
    if (!existsSync(backupDir)) {
      await mkdir(backupDir, { recursive: true });
    }
    
    // Create backup file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `messages-backup-${timestamp}.json`);
    
    // Write backup
    await writeFile(backupFile, JSON.stringify(messages, null, 2), 'utf-8');
    
    console.log(`[ADMIN BACKUP] Created backup: ${backupFile} (${messages.length} messages)`);
    
    return NextResponse.json({
      success: true,
      backupFile: `download/messages-backup-${timestamp}.json`,
      messageCount: messages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[ADMIN BACKUP] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Backup failed' },
      { status: 500 }
    );
  }
}
