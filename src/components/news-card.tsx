"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { NewsArticle } from "@/lib/news-scraper";

// News source colors for badges
const SOURCE_COLORS: Record<string, string> = {
  // Technology
  'TechCrunch': 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  'The Verge': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'Wired': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  'Ars Technica': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  'Engadget': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  'Hacker News': 'bg-orange-600/10 text-orange-600 dark:text-orange-400 border-orange-600/20',
  // World
  'BBC World': 'bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20',
  'Al Jazeera': 'bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-600/20',
  'DW News': 'bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-600/20',
  'NPR World': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'France24': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'The Guardian': 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  // Sports
  'Sky Sports': 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'BBC Sport': 'bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20',
  'NY Times Sports': 'bg-slate-600/10 text-slate-600 dark:text-slate-400 border-slate-600/20',
  'NPR Sports': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  // Health
  'WHO News': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  'Fox Health': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  'ET Health': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'NPR Health': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'BBC Health': 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  // Business
  'Forbes': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  'NPR Business': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'NY Times Business': 'bg-slate-600/10 text-slate-600 dark:text-slate-400 border-slate-600/20',
  'BBC Business': 'bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20',
  'Times of India Business': 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  // Entertainment
  'Variety': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'Deadline': 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  'Hollywood Reporter': 'bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-600/20',
  'NPR Arts': 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'BBC Entertainment': 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  // Science
  'Science Daily': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  'NPR Science': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  'BBC Science': 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  'MIT Tech Review': 'bg-gray-600/10 text-gray-600 dark:text-gray-400 border-gray-600/20',
};

interface NewsCardProps {
  article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <a
      href={article.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 p-3 sm:p-4 rounded-2xl border border-border/40 hover:border-border hover:shadow-lg transition-all duration-200 bg-card min-h-[100px] sm:min-h-[112px]"
    >
      {/* Article Content - Left side */}
      <div className={cn(
        "flex-1 min-w-0 flex flex-col justify-center",
        !article.imageUrl && "pr-2"
      )}>
        <div className="flex items-center gap-2 mb-1">
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] font-semibold border-0 px-2 py-0.5",
              SOURCE_COLORS[article.source] || 'bg-muted/30 text-muted-foreground'
            )}
          >
            {article.source}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : ''}
          </span>
        </div>
        <h3 className={cn(
          "font-medium text-sm group-hover:text-primary transition-colors",
          article.imageUrl ? "line-clamp-2" : "line-clamp-3"
        )}>
          {article.title}
        </h3>
        {article.summary && (
          <p className={cn(
            "text-xs text-muted-foreground mt-1",
            article.imageUrl ? "line-clamp-1" : "line-clamp-3"
          )}>
            {article.summary}
          </p>
        )}
      </div>
      
      {/* Article Image - Right side (only if exists) */}
      {article.imageUrl && (
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-border/10 bg-muted/30">
          <img 
            src={article.imageUrl.replace(/&amp;/g, '&')} 
            alt="" 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              const container = img.parentElement;
              if (container) {
                container.style.display = 'none';
              }
            }}
          />
        </div>
      )}
      
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-center" />
    </a>
  );
}
