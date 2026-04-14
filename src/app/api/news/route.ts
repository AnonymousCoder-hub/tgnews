import { NextResponse } from 'next/server';
import { getNews, NEWS_CATEGORIES } from '@/lib/news-scraper';

// Get articles grouped by source with pagination
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const forceRefresh = searchParams.get('refresh') === 'true';
  const source = searchParams.get('source'); // Specific source to load more from
  const offset = parseInt(searchParams.get('offset') || '0'); // Offset for pagination
  const limit = parseInt(searchParams.get('limit') || '10'); // Articles per source

  try {
    if (!category) {
      // Get all categories (legacy support)
      const allNews: Record<string, Awaited<ReturnType<typeof getNews>>> = {};

      for (const cat of NEWS_CATEGORIES) {
        allNews[cat] = await getNews(cat, forceRefresh);
      }

      return NextResponse.json({
        success: true,
        data: allNews,
        cached: false,
      });
    }

    // Fetch all articles for the category (from cache or scrape)
    const allArticles = await getNews(category, forceRefresh);

    // Group by source
    const sourceGroups: Map<string, typeof allArticles> = new Map();
    for (const article of allArticles) {
      const existing = sourceGroups.get(article.source) || [];
      existing.push(article);
      sourceGroups.set(article.source, existing);
    }

    // If requesting a specific source (Load More)
    if (source) {
      const sourceArticles = sourceGroups.get(source) || [];
      const paginatedArticles = sourceArticles.slice(offset, offset + limit);
      const hasMore = offset + limit < sourceArticles.length;
      const total = sourceArticles.length;

      return NextResponse.json({
        success: true,
        articles: paginatedArticles,
        hasMore,
        total,
        source,
        offset,
        limit,
      });
    }

    // Initial load - return first N articles per source with metadata
    const groupedData = Array.from(sourceGroups.entries())
      .map(([src, articles]) => ({
        source: src,
        articles: articles.slice(0, limit),
        total: articles.length,
        hasMore: articles.length > limit,
      }))
      .sort((a, b) => b.total - a.total);

    // Get list of all sources with counts
    const sources = Array.from(sourceGroups.entries())
      .map(([src, articles]) => ({
        source: src,
        count: articles.length,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      data: groupedData,
      sources,
      totalArticles: allArticles.length,
      category,
      limit,
    });
  } catch (error) {
    console.error('[NEWS API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
