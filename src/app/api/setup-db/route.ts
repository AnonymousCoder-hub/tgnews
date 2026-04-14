import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Try to check if tables exist by querying them
    const { error: messagesError } = await supabase
      .from('messages')
      .select('id')
      .limit(1);

    const { error: lastScrapeError } = await supabase
      .from('last_scrape')
      .select('id')
      .limit(1);

    if (messagesError?.code === '42P01' || lastScrapeError?.code === '42P01') {
      // Tables don't exist
      return NextResponse.json({
        success: false,
        needsSetup: true,
        message: 'Tables need to be created in Supabase',
        instructions: 'Open Supabase Dashboard → SQL Editor and run the SQL below:',
        sql: `
-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  postId TEXT NOT NULL,
  channelUsername TEXT NOT NULL,
  channelName TEXT NOT NULL,
  channelAvatar TEXT,
  text TEXT,
  views INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  photos TEXT[] DEFAULT '{}',
  videos JSONB,
  hasLargeMedia BOOLEAN DEFAULT FALSE,
  largeMediaInfo JSONB,
  reactions JSONB,
  storedAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Create last_scrape table
CREATE TABLE IF NOT EXISTS last_scrape (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channelUsername);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_scrape ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (service role bypasses anyway)
CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on last_scrape" ON last_scrape FOR ALL USING (true) WITH CHECK (true);
        `.trim()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database tables exist!',
      messagesTable: messagesError ? `Error: ${messagesError.message}` : 'OK',
      lastScrapeTable: lastScrapeError ? `Error: ${lastScrapeError.message}` : 'OK'
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup failed' },
      { status: 500 }
    );
  }
}
