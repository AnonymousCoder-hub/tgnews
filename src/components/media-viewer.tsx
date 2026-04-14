"use client";

import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: { type: 'image' | 'video'; url: string; thumbnail?: string; duration?: string } | null;
}

export function MediaViewer({ open, onOpenChange, media }: MediaViewerProps) {
  const getProxyUrl = (url: string, type: 'image' | 'video' = 'image'): string => {
    return `/api/media?url=${encodeURIComponent(url)}&type=${type}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="media-viewer max-w-4xl p-0 bg-black/95 border-0 overflow-hidden">
        <DialogClose className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors flex items-center justify-center ring-1 ring-white/20">
          <X className="h-5 w-5" />
        </DialogClose>
        {media && (
          <div className="relative">
            {media.type === 'video' ? (
              <video
                src={getProxyUrl(media.url, 'video')}
                poster={media.thumbnail}
                className="w-full max-h-[80vh] object-contain"
                controls
                autoPlay
                onError={(e) => {
                  const video = e.currentTarget;
                  if (!video.src.includes('telesco.pe')) {
                    video.src = media.url;
                  }
                }}
              />
            ) : (
              <img
                src={media.url}
                alt=""
                className="w-full max-h-[80vh] object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.src.includes('/api/media')) {
                    img.src = getProxyUrl(media.url, 'image');
                  }
                }}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
