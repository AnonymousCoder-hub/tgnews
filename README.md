# newstel - Telegram News Aggregator

Real-time news aggregation from multiple Telegram channels with a beautiful, responsive UI.

## ✨ Features

- **Real-time Updates** - Auto-refreshes with customizable timer (default 60s, minimum 10s)
- **Multi-channel Support** - Aggregates news from 5+ Telegram channels
- **Media Support** - Photos, videos, and large media previews
- **Dark/Light Mode** - Toggle between themes
- **Search & Filter** - Search messages, filter by channel or media type
- **Infinite Scroll** - Load more messages as you scroll
- **Persistent Storage** - Messages stored in Supabase PostgreSQL (unlimited!)
- **Admin Panel** - Hidden admin page at `/admin` for managing messages

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

## 🔧 Environment Variables

Create a `.env` file with:

```env
# Required for database
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-anon-key"  
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# REQUIRED for admin panel authentication
# Run: bun run scripts/generate-admin-credentials.ts to generate these
ADMIN_USERNAME="newstel_admin"
ADMIN_PASSWORD_HASH="generated-sha256-hash"
ADMIN_SALT="random-64-char-string"
JWT_SECRET="random-64-char-string"
```

### Setting Up Admin Credentials

1. Run the credential generator script:
```bash
bun run scripts/generate-admin-credentials.ts
```

2. Copy the output to your `.env` file
3. **Save the password somewhere secure** - you'll need it to login
4. Access the admin panel at `your-domain.com/admin`

## 📦 Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS
- **shadcn/ui** - Beautiful UI components
- **Supabase PostgreSQL** - Unlimited database reads/writes
- **Cheerio** - HTML parsing for Telegram scraping
- **Jose** - JWT authentication for admin panel

## 🗄️ Database Setup

1. Create a Supabase project at https://supabase.com
2. Run this SQL in the SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  postid TEXT NOT NULL,
  channelusername TEXT NOT NULL,
  channelname TEXT NOT NULL,
  channelavatar TEXT,
  text TEXT,
  views INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ NOT NULL,
  photos TEXT[] DEFAULT '{}',
  videos JSONB,
  haslargemedia BOOLEAN DEFAULT FALSE,
  largemediainfo JSONB,
  reactions JSONB,
  storedat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS last_scrape (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Blacklist table for deleted messages
CREATE TABLE IF NOT EXISTS blacklist (
  id SERIAL PRIMARY KEY,
  message_id TEXT UNIQUE NOT NULL,
  reason TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  message_preview TEXT,
  channel_username TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channelusername);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blacklist_message_id ON blacklist(message_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_scrape ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on last_scrape" ON last_scrape FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on blacklist" ON blacklist FOR ALL USING (true) WITH CHECK (true);
```

## 🔐 Admin Panel

Access the admin panel at: `your-domain.com/admin`

### Setup

1. Run the credential generator:
   ```bash
   bun run scripts/generate-admin-credentials.ts
   ```

2. Add the output to your `.env` file

3. Use the displayed credentials to login

### Security Features:
- **No hardcoded credentials** in source code
- SHA-256 hashed password verification with random salt
- HTTP-only cookies with SameSite=Strict
- 4-hour session expiry with JWT
- 1.5 second delay on failed login to prevent brute force

### Admin Features:
- View all messages with search and filter
- Delete unwanted messages (spam, promotional content, etc.)
- Blacklisted messages won't be scraped again
- Create database backups

## 🎯 Channels

- WarFront Witness (@wfwitness)
- War Monitor (@warmonitors)
- Ethan Levins (@ethanlevins)
- Middle East Spectator (@Middle_East_Spectator)
- Rerum Novarum (@rnintel)

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/            # Admin panel page
│   ├── api/
│   │   ├── admin/        # Admin API routes (auth, delete, backup)
│   │   ├── telegram/     # Main API route
│   │   └── migrate/      # Migration utility
│   ├── page.tsx          # Main page
│   └── layout.tsx        # Root layout
├── components/ui/        # shadcn/ui components
└── lib/
    ├── supabase.ts       # Supabase client
    └── telegram-scraper.ts  # Telegram scraping
```

---

Built with ❤️ for real-time news aggregation
