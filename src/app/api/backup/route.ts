import { NextRequest, NextResponse } from 'next/server';
import { getAllMessages } from '@/lib/supabase';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Secret for admin operations
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'newstel-admin-secret-2024';

export async function POST(request: NextRequest) {
  try {
    // Verify admin secret
    const providedSecret = request.headers.get('x-admin-secret');
    if (providedSecret !== ADMIN_SECRET) {
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
    
    console.log(`[BACKUP] Created backup: ${backupFile} (${messages.length} messages)`);
    
    return NextResponse.json({
      success: true,
      backupFile: `download/messages-backup-${timestamp}.json`,
      messageCount: messages.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[BACKUP] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Backup failed' },
      { status: 500 }
    );
  }
}
