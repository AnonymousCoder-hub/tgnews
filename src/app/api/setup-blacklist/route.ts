import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This route checks if blacklist table exists
// Call it: /api/setup-blacklist

export async function GET() {
  try {
    // Try to query the blacklist table to see if it exists
    const { error: checkError } = await supabase
      .from('blacklist')
      .select('id')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: '✅ Blacklist table already exists!',
        table: 'blacklist'
      });
    }

    // Table doesn't exist - return SQL to run
    return NextResponse.json({
      success: false,
      message: '❌ Blacklist table does not exist. Please run this SQL in your Supabase SQL Editor:',
      sql: `
-- Run this in Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS blacklist (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  reason TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  message_preview TEXT,
  channel_username TEXT
);

CREATE INDEX IF NOT EXISTS idx_blacklist_message_id ON blacklist(message_id);

ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on blacklist" ON blacklist FOR ALL USING (true) WITH CHECK (true);

-- Verify:
SELECT * FROM blacklist LIMIT 1;
`
    });
  } catch (error) {
    console.error('[SETUP] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Setup check failed' },
      { status: 500 }
    );
  }
}
