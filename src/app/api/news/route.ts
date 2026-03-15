import { NextResponse } from 'next/server';
import { getNews, NEWS_CATEGORIES } from '@/lib/news-scraper';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    if (category) {
      const articles = await getNews(category, forceRefresh);
      
      return NextResponse.json({
        success: true,
        data: articles,
        cached: false,
        category,
      });
    } else {
      // Get all categories
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
  } catch (error) {
    console.error('[NEWS API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}
