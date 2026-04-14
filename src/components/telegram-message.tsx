"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Eye, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Image as ImageIcon, 
  Video, 
  ExternalLink,
  Play,
  FileVideo
} from "lucide-react";

// Channel colors for badges
const CHANNEL_COLORS: Record<string, string> = {
  wfwitness: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  warmonitors: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ethanlevins: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Middle_East_Spectator: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  rnintel: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  SabrenNewss: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  AjaNews: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export interface TelegramMessage {
  id: string;
  postId: string;
  channelUsername: string;
  channelName: string;
  channelAvatar: string | null;
  text: string | null;
  views: number;
  timestamp: string;
  photos: string[];
  videos: { type: string; url: string; thumbnailUrl?: string; duration?: string }[];
  hasLargeMedia: boolean;
  largeMediaInfo?: {
    type: 'video' | 'file' | 'photo';
    thumbnailUrl?: string;
    label?: string;
  };
  reactions: { emoji: string; count: number }[];
  twitterLink?: string | null;
}

// Format relative time
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format view count
export function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

// Get Telegram post URL
export function getTelegramUrl(postId: string): string {
  return `https://t.me/${postId}`;
}

// Proxy URL for media
export function getProxyUrl(url: string, type: 'image' | 'video' = 'image'): string {
  return `/api/media?url=${encodeURIComponent(url)}&type=${type}`;
}

// View on Telegram button overlay
function TelegramButton({ postId, className }: { postId: string; className?: string }) {
  return (
    <a
      href={getTelegramUrl(postId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "absolute z-10 flex items-center gap-1 rounded-lg bg-black/70 hover:bg-black/90 text-white transition-all text-xs px-2 py-1.5",
        "opacity-0 group-hover:opacity-100",
        className
      )}
      title="Open on Telegram"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-3.5 w-3.5" />
      <span>Open in Telegram</span>
    </a>
  );
}

// Large Media Component with thumbnail
function LargeMediaCard({ message }: { message: TelegramMessage }) {
  const thumbnailUrl = message.largeMediaInfo?.thumbnailUrl;
  const mediaType = message.largeMediaInfo?.type || 'video';
  const label = message.largeMediaInfo?.label;
  
  const fileSize = label?.match(/(\d+(?:\.\d+)?\s*[MGK]B)/i)?.[0] || '';
  
  return (
    <div className="relative w-full h-full group">
      {thumbnailUrl ? (
        <a
          href={getTelegramUrl(message.postId)}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-full h-full block"
        >
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg shadow-black/30 group-hover:scale-110 transition-transform duration-200">
              {mediaType === 'video' ? (
                <Play className="h-6 w-6 text-gray-700 ml-1" fill="currentColor" />
              ) : (
                <FileVideo className="h-6 w-6 text-gray-700" />
              )}
            </div>
          </div>
          
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span>Large {mediaType}</span>
              {fileSize && <span className="text-white/60">• {fileSize}</span>}
            </div>
          </div>
        </a>
      ) : (
        <a
          href={getTelegramUrl(message.postId)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-muted to-muted/50 gap-3"
        >
          <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
            <FileVideo className="h-6 w-6 text-gray-700" />
          </div>
          <div className="flex items-center gap-1.5 bg-muted/80 text-xs px-3 py-1.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>Large media • Open on Telegram</span>
          </div>
        </a>
      )}
      <TelegramButton postId={message.postId} className="top-2 right-2" />
    </div>
  );
}

// Media item type for gallery
interface MediaItem {
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  duration?: string;
}

// Media Gallery Component with thumbnail strip
function MediaGallery({ 
  message, 
  onOpenViewer 
}: { 
  message: TelegramMessage;
  onOpenViewer: (type: 'image' | 'video', url: string, thumbnail?: string, duration?: string) => void;
}) {
  const allMedia: MediaItem[] = useMemo(() => {
    const items: MediaItem[] = [];
    
    message.videos.forEach(video => {
      if (video.type !== 'large_media') {
        items.push({
          type: 'video',
          url: video.url,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration
        });
      }
    });
    
    message.photos.forEach(photo => {
      items.push({
        type: 'photo',
        url: photo
      });
    });
    
    return items;
  }, [message.photos, message.videos]);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set());
  
  const handleSelectIndex = (index: number) => {
    setSelectedIndex(index);
  };
  
  const handleImageLoad = (index: number) => {
    setLoadedIndexes(prev => new Set(prev).add(index));
  };
  
  if (allMedia.length === 0) return null;
  
  const selectedMedia = allMedia[selectedIndex];
  const hasMultiple = allMedia.length > 1;
  const isLoaded = loadedIndexes.has(selectedIndex);
  
  return (
    <div className="relative w-full h-full group">
      <div 
        className="w-full h-full cursor-pointer"
        onClick={() => {
          if (selectedMedia.type === 'video' && !selectedMedia.url && selectedMedia.thumbnailUrl) {
            window.open(getTelegramUrl(message.postId), '_blank');
            return;
          }
          if (selectedMedia.type === 'video') {
            onOpenViewer('video', selectedMedia.url, selectedMedia.thumbnailUrl, selectedMedia.duration);
          } else {
            onOpenViewer('image', selectedMedia.url);
          }
        }}
      >
        {selectedMedia.type === 'video' ? (
          <div className="relative w-full h-full bg-muted">
            {!isLoaded && selectedMedia.thumbnailUrl && <div className="absolute inset-0 bg-muted animate-pulse" />}
            {selectedMedia.thumbnailUrl ? (
              <img
                src={selectedMedia.thumbnailUrl}
                alt=""
                className={cn("w-full h-full object-cover transition-opacity duration-200", !isLoaded && "opacity-0")}
                loading="lazy"
                onLoad={() => handleImageLoad(selectedIndex)}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
              <div className="h-14 w-14 rounded-full bg-white/90 dark:bg-white/80 border-2 border-black/10 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="h-6 w-6 text-blue-500 ml-1" fill="currentColor" />
              </div>
            </div>
            {selectedMedia.duration && (
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs z-10">
                {selectedMedia.duration}
              </div>
            )}
            {selectedMedia.type === 'video' && !selectedMedia.url && (
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/70 text-white text-xs flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />
                Open in Telegram
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-full">
            {!isLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
            <img
              src={selectedMedia.url}
              alt=""
              className={cn("w-full h-full object-cover transition-opacity duration-200", !isLoaded && "opacity-0")}
              loading="lazy"
              onLoad={() => handleImageLoad(selectedIndex)}
            />
          </div>
        )}
      </div>
      
      {hasMultiple && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent z-20">
          <div 
            className="flex gap-1.5 overflow-x-auto scrollbar-hide px-2"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {allMedia.map((media, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSelectIndex(index);
                }}
                className={cn(
                  "relative w-11 h-11 rounded-lg overflow-hidden transition-all duration-200 flex-shrink-0",
                  index === selectedIndex 
                    ? "border-[1.5px] border-white/90 shadow-[0_0_12px_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.1)]" 
                    : "border-[1.5px] border-white/20 opacity-50 hover:opacity-75 hover:border-white/40"
                )}
              >
                {media.thumbnailUrl || media.type === 'photo' ? (
                  <img
                    src={media.thumbnailUrl || media.url}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                    <Video className="h-4 w-4 text-white/70" />
                  </div>
                )}
                {media.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="h-4 w-4 rounded-full bg-white/95 flex items-center justify-center shadow-sm">
                      <Play className="h-2 w-2 text-gray-700 ml-px" fill="currentColor" />
                    </div>
                  </div>
                )}
              </button>
            ))}
            {allMedia.length > 4 && <div className="w-2 flex-shrink-0" />}
          </div>
          {allMedia.length > 4 && (
            <>
              <div className="absolute left-0 bottom-0 top-0 w-6 bg-gradient-to-r from-black/70 to-transparent pointer-events-none z-10" />
              <div className="absolute right-0 bottom-0 top-0 w-6 bg-gradient-to-l from-black/70 to-transparent pointer-events-none z-10" />
            </>
          )}
        </div>
      )}
      
      <div className={cn(
        "absolute right-2 z-30",
        hasMultiple ? "bottom-16" : "bottom-2"
      )}>
        <TelegramButton postId={message.postId} className="" />
      </div>
      
      {hasMultiple && (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs flex items-center gap-1 z-10">
          {selectedMedia.type === 'video' ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          {selectedIndex + 1} / {allMedia.length}
        </div>
      )}
    </div>
  );
}

// Expandable text component for long messages
function MessageText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsExpansion = text.length > 280 || text.split('\n').length > 4;
  
  return (
    <div className="mb-3">
      <p className={cn(
        "text-sm selectable-text leading-relaxed whitespace-pre-wrap",
        !expanded && needsExpansion && "line-clamp-4"
      )}>
        {text}
      </p>
      {needsExpansion && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 mt-1.5 font-medium"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

interface TelegramMessageCardProps {
  message: TelegramMessage;
  index: number;
  onOpenViewer: (type: 'image' | 'video', url: string, thumbnail?: string, duration?: string) => void;
}

export function TelegramMessageCard({ message, index, onOpenViewer }: TelegramMessageCardProps) {
  return (
    <Card 
      className={cn(
        "overflow-hidden hover:shadow-lg transition-all duration-200 border-border/50 animate-fade-in",
        index < 3 && "ring-2 ring-primary/20"
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
    >
      {/* Media */}
      {(message.photos.length > 0 || message.videos.length > 0 || message.hasLargeMedia) && (
        <div className="relative aspect-video bg-muted overflow-hidden">
          {message.hasLargeMedia && message.videos.filter(v => v.type !== 'large_media').length === 0 && message.photos.length === 0 ? (
            <LargeMediaCard message={message} />
          ) : (
            <MediaGallery message={message} onOpenViewer={onOpenViewer} />
          )}
        </div>
      )}

      <CardContent className="p-4">
        {/* Channel Info */}
        <div className="flex items-center gap-2 mb-3">
          <Badge 
            variant="outline" 
            className={cn("text-xs font-medium", CHANNEL_COLORS[message.channelUsername])}
          >
            {message.channelName}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(message.timestamp)}
          </span>
        </div>

        {/* Text */}
        {message.text && (
          <MessageText text={message.text} />
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {formatViews(message.views)}
          </div>
          <div className="flex items-center gap-2">
            {message.reactions.length > 0 && (
              <div className="flex items-center gap-1">
                {message.reactions.slice(0, 3).map((reaction, i) => (
                  <span key={i} className="text-xs flex items-center gap-0.5">
                    {reaction.emoji}
                    <span className="text-muted-foreground">{reaction.count}</span>
                  </span>
                ))}
              </div>
            )}
            <a
              href={getTelegramUrl(message.postId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
              title="View on Telegram"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
