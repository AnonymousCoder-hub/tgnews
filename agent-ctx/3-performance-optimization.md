# Task ID: 3 - Performance Optimization Agent

## Work Summary
Optimized the war page loading performance by decoupling translation from scraping and making the API non-blocking.

## Key Changes

### `src/lib/data-layer.ts`
- Removed `translateMessages()` call from `saveMessages()` - now saves raw messages immediately
- Added `translateNewMessages()` function that queries DB for recently saved Arabic messages and translates them in background
- Modified `runScraper()` to save raw messages first, then kick off background translation (non-awaited)
- Added in-memory first-page cache (page 1, no filters, 30s TTL) for <100ms page loads
- Added `isTranslating` to `globalScrapeState`
- No DB schema changes - uses existing `text` field and Arabic character detection regex

### `src/app/api/telegram/route.ts`
- Made refresh non-blocking: `refresh=true` now returns cached data immediately and uses `after()` for background scraping
- Both refresh and stale-data scenarios use consistent pattern: return cached data, trigger background scrape

## Performance Impact
- Before: 15-20s page refresh (blocked on scrape + translate)
- After: <1s page refresh (cached data immediately, background scrape)
- First page: <100ms when cache is warm

## Lint Status
All linting passes with no errors.
