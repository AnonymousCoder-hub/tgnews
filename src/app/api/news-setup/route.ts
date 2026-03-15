import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Check if tables exist
    const testNews = await supabase
      .from('external_news')
      .select('id')
      .limit(1);
    
    const testLog = await supabase
      .from('news_scrape_log')
      .select('category')
      .limit(1);
    
    const externalNewsExists = !testNews.error;
    const scrapeLogExists = !testLog.error;
    
    // SQL to create tables (run manually in Supabase SQL editor)
    const sql = `
-- External news table
CREATE TABLE IF NOT EXISTS external_news (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL,
  sourceurl TEXT NOT NULL,
  imageurl TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  category TEXT NOT NULL,
  publishedat TIMESTAMPTZ
);

-- Scrape log table
CREATE TABLE IF NOT EXISTS news_scrape_log (
  category TEXT PRIMARY KEY,
  last_scrape TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_external_news_category ON external_news(category);
CREATE INDEX IF NOT EXISTS idx_external_news_timestamp ON external_news(timestamp DESC);
`;
    
    return NextResponse.json({
      success: true,
      tablesExist: externalNewsExists && scrapeLogExists,
      external_news: externalNewsExists ? 'ready' : 'missing',
      news_scrape_log: scrapeLogExists ? 'ready' : 'missing',
      sqlToRun: !externalNewsExists || !scrapeLogExists ? sql : null,
      message: externalNewsExists && scrapeLogExists 
        ? 'Database is ready for news!' 
        : 'Run the SQL in Supabase dashboard to create tables.',
    });
  } catch (error) {
    console.error('[SETUP] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Setup check failed' },
      { status: 500 }
    );
  }
}
