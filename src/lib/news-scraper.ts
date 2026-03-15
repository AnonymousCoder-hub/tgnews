import * as cheerio from 'cheerio';
import { supabase } from './supabase';

// News article interface
export interface NewsArticle {
  id: string;
  title: string;
  summary: string | null;
  source: string;
  sourceUrl: string;
  imageUrl: string | null;
  timestamp: string;
  category: string;
  publishedAt?: string | null;
}

// Scrape rate limit (15 minutes)
const SCRAPE_INTERVAL_MS = 15 * 60 * 1000;

// In-memory cache
let memoryCache: {
  [category: string]: {
    articles: NewsArticle[];
    timestamp: number;
  };
} = {};

// Check if we should scrape (15-minute limit)
async function getLastScrapeTime(category: string): Promise<Date | null> {
  try {
    const { data, error } = await supabase
      .from('news_scrape_log')
      .select('last_scrape')
      .eq('category', category)
      .single();
    
    if (error || !data) return null;
    return new Date(data.last_scrape);
  } catch {
    return null;
  }
}

async function setLastScrapeTime(category: string): Promise<void> {
  try {
    await supabase
      .from('news_scrape_log')
      .upsert(
        { category, last_scrape: new Date().toISOString() },
        { onConflict: 'category' }
      );
  } catch (error) {
    console.error(`[NEWS] Error setting scrape time for ${category}:`, error);
  }
}

function shouldScrape(lastScrape: Date | null): boolean {
  if (!lastScrape) return true;
  return Date.now() - lastScrape.getTime() >= SCRAPE_INTERVAL_MS;
}

// User agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Fetch HTML
async function fetchHTML(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
    });
    if (!response.ok) {
      console.error(`[NEWS] Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`[NEWS] Error fetching ${url}:`, error);
    return null;
  }
}

// RSS Feed parser for more reliable news fetching
async function fetchRSSFeed(feedUrl: string, sourceName: string, category: string): Promise<NewsArticle[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });
    
    if (!response.ok) return [];
    
    const text = await response.text();
    const $ = cheerio.load(text, { xmlMode: true });
    const articles: NewsArticle[] = [];
    
    $('item').each((index, element) => {
      if (index >= 15) return; // Limit to 15 per source
      
      const $item = $(element);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const description = $item.find('description').text().trim();
      const pubDate = $item.find('pubDate').text().trim();
      
      // Get image from various sources in RSS - try multiple methods
      let imageUrl: string | null = null;
      
      // Get the raw XML for this item to parse images more reliably
      const itemXml = $.html(element);
      
      // 1. Try to extract from media:thumbnail using regex (most reliable for BBC, etc)
      const mediaThumbnailMatch = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
      if (mediaThumbnailMatch && mediaThumbnailMatch[1]) {
        imageUrl = mediaThumbnailMatch[1];
      }
      
      // 2. Try media:content with regex
      if (!imageUrl) {
        const mediaContentMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i);
        if (mediaContentMatch && mediaContentMatch[1]) {
          imageUrl = mediaContentMatch[1];
        }
      }
      
      // 3. Try cheerio selectors as fallback (for some feeds)
      if (!imageUrl) {
        const mediaThumbnail = $item.find('media\\:thumbnail, thumbnail, [url]').first();
        if (mediaThumbnail.length && mediaThumbnail.attr('url')) {
          imageUrl = mediaThumbnail.attr('url') || null;
        }
      }
      
      // 4. Try enclosure with image type
      if (!imageUrl) {
        const enclosureMatch = itemXml.match(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/i);
        if (enclosureMatch && enclosureMatch[1]) {
          imageUrl = enclosureMatch[1];
        }
        if (!imageUrl) {
          const enclosureMatch2 = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image[^"']*["']/i);
          if (enclosureMatch2 && enclosureMatch2[1]) {
            imageUrl = enclosureMatch2[1];
          }
        }
      }
      
      // 5. Try to extract image from description/encoded content
      if (!imageUrl && description) {
        const descMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (descMatch && descMatch[1]) {
          imageUrl = descMatch[1];
        }
      }
      
      // 6. Try content:encoded
      if (!imageUrl) {
        const contentEncoded = $item.find('content\\:encoded, encoded').html();
        if (contentEncoded) {
          const contentMatch = contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (contentMatch && contentMatch[1]) {
            imageUrl = contentMatch[1];
          }
        }
      }
      
      // 7. Try to find any image URL in the item XML
      if (!imageUrl) {
        const anyImgMatch = itemXml.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|gif|webp)/i);
        if (anyImgMatch && anyImgMatch[0]) {
          imageUrl = anyImgMatch[0];
        }
      }
      
      // Clean up description (remove HTML)
      const cleanDescription = description.replace(/<[^>]*>/g, '').trim();
      
      // Decode HTML entities in image URL (important for &amp; -> &)
      if (imageUrl) {
        imageUrl = imageUrl
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      }
      
      if (title && link) {
        articles.push({
          id: `${sourceName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
          title,
          summary: cleanDescription ? cleanDescription.substring(0, 200) + (cleanDescription.length > 200 ? '...' : '') : null,
          source: sourceName,
          sourceUrl: link,
          imageUrl,
          timestamp: new Date().toISOString(),
          category,
          publishedAt: pubDate || null,
        });
        
        // Log for debugging
        if (imageUrl) {
          console.log(`[NEWS] Found image for "${title.substring(0, 50)}...": ${imageUrl.substring(0, 60)}...`);
        }
      }
    });
    
    return articles;
  } catch (error) {
    console.error(`[NEWS] RSS error for ${sourceName}:`, error);
    return [];
  }
}

// News sources with RSS feeds (verified working)
const RSS_SOURCES: { [category: string]: { name: string; feed: string }[] } = {
  technology: [
    { name: 'TechCrunch', feed: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', feed: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Wired', feed: 'https://www.wired.com/feed/rss' },
    { name: 'Ars Technica', feed: 'https://feeds.arstechnica.com/arstechnica/index' },
    { name: 'Engadget', feed: 'https://www.engadget.com/rss.xml' },
    { name: 'Hacker News', feed: 'https://hnrss.org/frontpage' },
  ],
  world: [
    { name: 'BBC World', feed: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'Al Jazeera', feed: 'https://www.aljazeera.com/xml/rss/all.xml' },
    { name: 'DW News', feed: 'https://rss.dw.com/rdf/rss-en-all' },
    { name: 'NPR World', feed: 'https://feeds.npr.org/1004/rss.xml' },
    { name: 'France24', feed: 'https://www.france24.com/en/rss' },
    { name: 'The Guardian', feed: 'https://www.theguardian.com/world/rss' },
  ],
  sports: [
    { name: 'Sky Sports', feed: 'https://www.skysports.com/rss/12040' },
    { name: 'BBC Sport', feed: 'https://feeds.bbci.co.uk/sport/rss.xml' },
    { name: 'NY Times Sports', feed: 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/sports/rss.xml' },
    { name: 'Sky Sports Football', feed: 'https://www.skysports.com/rss/12040' },
    { name: 'NPR Sports', feed: 'https://feeds.npr.org/1055/rss.xml' },
  ],
  health: [
    { name: 'WHO News', feed: 'https://www.who.int/rss-feeds/news-english.xml' },
    { name: 'Fox Health', feed: 'https://moxie.foxnews.com/google-publisher/health.xml' },
    { name: 'ET Health', feed: 'https://health.economictimes.indiatimes.com/rss/topstories' },
    { name: 'NPR Health', feed: 'https://feeds.npr.org/1128/rss.xml' },
    { name: 'BBC Health', feed: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  ],
  business: [
    { name: 'Forbes', feed: 'https://www.forbes.com/business/feed/' },
    { name: 'NPR Business', feed: 'https://feeds.npr.org/1007/rss.xml' },
    { name: 'NY Times Business', feed: 'https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/business/rss.xml' },
    { name: 'BBC Business', feed: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'Times of India Business', feed: 'https://timesofindia.indiatimes.com/rssfeedmostrecent.cms' },
  ],
  entertainment: [
    { name: 'Variety', feed: 'https://variety.com/feed/' },
    { name: 'Deadline', feed: 'https://deadline.com/feed/' },
    { name: 'Hollywood Reporter', feed: 'https://www.hollywoodreporter.com/feed/' },
    { name: 'NPR Arts', feed: 'https://feeds.npr.org/1008/rss.xml' },
    { name: 'BBC Entertainment', feed: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  ],
  science: [
    { name: 'Science Daily', feed: 'https://www.sciencedaily.com/rss/all.xml' },
    { name: 'NPR Science', feed: 'https://feeds.npr.org/1007/rss.xml' },
    { name: 'BBC Science', feed: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
    { name: 'MIT Tech Review', feed: 'https://www.technologyreview.com/feed/' },
  ],
};

// HTML scraping sources (fallback/additional)
const HTML_SOURCES: { [category: string]: { name: string; url: string; selectors: { article: string; title: string; link: string; summary?: string; image?: string } }[] } = {
  technology: [
    {
      name: 'Hacker News',
      url: 'https://news.ycombinator.com/',
      selectors: {
        article: '.athing',
        title: '.titleline > a',
        link: '.titleline > a',
        summary: '.sitestr',
      },
    },
  ],
  world: [
    {
      name: 'Google World News',
      url: 'https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
      selectors: {
        article: 'article',
        title: 'h3 a, h4 a',
        link: 'a',
        summary: 'p',
      },
    },
  ],
};

// Scrape HTML source
function parseHTMLSource(html: string, source: { name: string; url: string; selectors: { article: string; title: string; link: string; summary?: string; image?: string } }, category: string): NewsArticle[] {
  const $ = cheerio.load(html);
  const articles: NewsArticle[] = [];
  
  $(source.selectors.article).each((index, element) => {
    if (index >= 15) return;
    
    try {
      const $article = $(element);
      const title = $article.find(source.selectors.title).first().text().trim();
      let link = $article.find(source.selectors.link).first().attr('href') || '';
      
      if (!title || title.length < 10) return;
      
      // Handle relative URLs
      if (link && !link.startsWith('http')) {
        const baseUrl = new URL(source.url);
        link = `${baseUrl.protocol}//${baseUrl.hostname}${link.startsWith('/') ? '' : '/'}${link}`;
      }
      
      let summary: string | null = null;
      if (source.selectors.summary) {
        summary = $article.find(source.selectors.summary).first().text().trim() || null;
        if (summary && summary.length > 200) {
          summary = summary.substring(0, 200) + '...';
        }
      }
      
      let imageUrl: string | null = null;
      if (source.selectors.image) {
        const $img = $article.find(source.selectors.image).first();
        imageUrl = $img.attr('src') || $img.attr('data-src') || null;
        if (imageUrl && !imageUrl.startsWith('http')) {
          const baseUrl = new URL(source.url);
          imageUrl = `${baseUrl.protocol}//${baseUrl.hostname}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
      }
      
      articles.push({
        id: `${source.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${index}`,
        title,
        summary,
        source: source.name,
        sourceUrl: link,
        imageUrl,
        timestamp: new Date().toISOString(),
        category,
      });
    } catch (e) {
      // Skip problematic articles
    }
  });
  
  return articles;
}

// Save articles to database
async function saveArticles(articles: NewsArticle[], category: string): Promise<void> {
  try {
    // First, delete old articles for this category (keep last 100)
    const { data: existingIds } = await supabase
      .from('external_news')
      .select('id')
      .eq('category', category)
      .order('timestamp', { ascending: false })
      .range(100, 999);
    
    if (existingIds && existingIds.length > 0) {
      const idsToDelete = existingIds.map(item => item.id);
      await supabase.from('external_news').delete().in('id', idsToDelete);
    }
    
    // Upsert new articles (deduplicate by title+source)
    const articlesToSave = articles.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      source: article.source,
      sourceurl: article.sourceUrl,
      imageurl: article.imageUrl,
      timestamp: article.timestamp,
      category: article.category,
      publishedat: article.publishedAt || null,
    }));
    
    const { error } = await supabase
      .from('external_news')
      .upsert(articlesToSave, { onConflict: 'id' });
    
    if (error) {
      console.error(`[NEWS] Error saving articles for ${category}:`, error);
    } else {
      console.log(`[NEWS] Saved ${articles.length} articles for ${category}`);
    }
  } catch (error) {
    console.error(`[NEWS] Save error for ${category}:`, error);
  }
}

// Get articles from database
async function getArticlesFromDB(category: string): Promise<NewsArticle[]> {
  try {
    const { data, error } = await supabase
      .from('external_news')
      .select('*')
      .eq('category', category)
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error || !data) return [];
    
    return data.map(item => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.source,
      sourceUrl: item.sourceurl,
      imageUrl: item.imageurl,
      timestamp: item.timestamp,
      category: item.category,
      publishedAt: item.publishedat,
    }));
  } catch (error) {
    console.error(`[NEWS] Error getting articles from DB for ${category}:`, error);
    return [];
  }
}

// Main function to get news for a category
export async function getNews(category: string, forceRefresh = false): Promise<NewsArticle[]> {
  // Check memory cache first
  const cached = memoryCache[category];
  if (!forceRefresh && cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    console.log(`[NEWS] Memory cache hit for ${category}`);
    return cached.articles;
  }
  
  // Check database
  const dbArticles = await getArticlesFromDB(category);
  
  // Check if we need to scrape (15-minute limit)
  const lastScrape = await getLastScrapeTime(category);
  const shouldRefresh = forceRefresh || shouldScrape(lastScrape);
  
  if (!shouldRefresh && dbArticles.length > 0) {
    console.log(`[NEWS] Using cached data for ${category} (${dbArticles.length} articles)`);
    memoryCache[category] = { articles: dbArticles, timestamp: Date.now() };
    return dbArticles;
  }
  
  // Scrape fresh data
  console.log(`[NEWS] Scraping fresh data for ${category}`);
  const allArticles: NewsArticle[] = [];
  
  // Fetch RSS feeds
  const rssSources = RSS_SOURCES[category] || [];
  for (const source of rssSources) {
    const articles = await fetchRSSFeed(source.feed, source.name, category);
    console.log(`[NEWS] RSS ${source.name}: ${articles.length} articles`);
    allArticles.push(...articles);
  }
  
  // Fetch HTML sources (as backup)
  const htmlSources = HTML_SOURCES[category] || [];
  for (const source of htmlSources) {
    const html = await fetchHTML(source.url);
    if (html) {
      const articles = parseHTMLSource(html, source, category);
      console.log(`[NEWS] HTML ${source.name}: ${articles.length} articles`);
      allArticles.push(...articles);
    }
  }
  
  // Deduplicate by title
  const seen = new Set<string>();
  const uniqueArticles = allArticles.filter(article => {
    const normalized = article.title.toLowerCase().trim();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  
  // Save to database
  if (uniqueArticles.length > 0) {
    await saveArticles(uniqueArticles, category);
    await setLastScrapeTime(category);
  }
  
  // Update memory cache
  memoryCache[category] = { articles: uniqueArticles, timestamp: Date.now() };
  
  console.log(`[NEWS] Total ${uniqueArticles.length} unique articles for ${category}`);
  return uniqueArticles;
}

// Live TV channels - Proper YouTube live stream embed URLs
export const LIVE_TV_CHANNELS = [
  { name: 'Sky News', icon: '🌐', channelUrl: 'https://www.youtube.com/embed/YDvsBbKfLPA' },
  { name: 'Al Jazeera', icon: '🌍', channelUrl: 'https://www.youtube.com/embed/gCNeDWCI0vo' },
  { name: 'DW News', icon: '📡', channelUrl: 'https://www.youtube.com/embed/LuKwFajn37U' },
  { name: 'France 24', icon: '🇫🇷', channelUrl: 'https://www.youtube.com/embed/Ap-UM1O9RBU' },
  { name: 'NDTV', icon: '🇮🇳', channelUrl: 'https://www.youtube.com/embed/5heWvXuwTq0' },
  { name: 'ABC News', icon: '🇺🇸', channelUrl: 'https://www.youtube.com/embed/wWMI-6OHda4' },
];

// Export available categories
export const NEWS_CATEGORIES = Object.keys(RSS_SOURCES);
