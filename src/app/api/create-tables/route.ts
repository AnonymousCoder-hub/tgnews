import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check if messages table exists and get count
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id', { count: 'exact' });

    // Check if last_scrape table exists
    const { data: scrape, error: scrapeError } = await supabase
      .from('last_scrape')
      .select('id, timestamp');

    // Check if market_data table exists
    const { data: marketData, error: marketError } = await supabase
      .from('market_data')
      .select('symbol', { count: 'exact' });

    const messagesExist = !msgError;
    const scrapeExists = !scrapeError;
    const marketExists = !marketError;

    if (messagesExist && scrapeExists && marketExists) {
      return NextResponse.json({
        success: true,
        message: '✅ Database is ready! All tables exist.',
        tables: {
          messages: {
            status: '✅ exists',
            count: (messages as any)?.length || 0
          },
          last_scrape: {
            status: '✅ exists',
            data: scrape?.[0] || 'empty'
          },
          market_data: {
            status: '✅ exists',
            count: (marketData as any)?.length || 0
          }
        },
        nextStep: 'Now visit /api/migrate to transfer data from Redis to Supabase'
      });
    }

    // Tables don't exist
    return NextResponse.json({
      success: false,
      needsSetup: true,
      tables: {
        messages: msgError ? `❌ ${msgError.message}` : '✅ exists',
        last_scrape: scrapeError ? `❌ ${scrapeError.message}` : '✅ exists',
        market_data: marketError ? `❌ ${marketError.message}` : '✅ exists'
      },
      sql: `
-- Run this SQL in Supabase SQL Editor:
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

CREATE TABLE IF NOT EXISTS last_scrape (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_data (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL DEFAULT 0,
  change DOUBLE PRECISION DEFAULT 0,
  changepercent DOUBLE PRECISION DEFAULT 0,
  open DOUBLE PRECISION DEFAULT 0,
  high DOUBLE PRECISION DEFAULT 0,
  low DOUBLE PRECISION DEFAULT 0,
  volume BIGINT DEFAULT 0,
  previousclose DOUBLE PRECISION DEFAULT 0,
  lastupdated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channelUsername);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_category ON market_data(category);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_scrape ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- Skip policy creation if they exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on messages') THEN
    CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on last_scrape') THEN
    CREATE POLICY "Allow all on last_scrape" ON last_scrape FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on market_data') THEN
    CREATE POLICY "Allow all on market_data" ON market_data FOR ALL USING (true);
  END IF;
END $$;`
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
