"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, 
  Eye, 
  Clock, 
  Image as ImageIcon, 
  Video, 
  ExternalLink,
  Play,
  X,
  FileVideo,
  Moon,
  Sun,
  LogOut,
  Shield,
  Loader2,
  Trash2,
  AlertTriangle,
  Database,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface TelegramMessage {
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
}

// Channel colors for badges
const CHANNEL_COLORS: Record<string, string> = {
  wfwitness: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  warmonitors: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ethanlevins: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  Middle_East_Spectator: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  rnintel: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

// Format relative time
function formatRelativeTime(timestamp: string): string {
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
function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

// Get Telegram post URL
function getTelegramUrl(postId: string): string {
  return `https://t.me/${postId}`;
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

// Delete confirmation dialog
function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  message,
  isDeleting
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  message: TelegramMessage | null;
  isDeleting: boolean;
}) {
  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Delete Message
          </DialogTitle>
          <DialogDescription className="pt-2">
            This will permanently delete this message and add it to the blacklist. 
            It will not be scraped again in the future.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={CHANNEL_COLORS[message.channelUsername] || ""}>
              {message.channelName}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(message.timestamp)}
            </span>
          </div>
          {message.text && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {message.text}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatViews(message.views)}
            </span>
            {(message.photos.length > 0 || message.videos.length > 0) && (
              <span className="flex items-center gap-1">
                {message.photos.length > 0 && (
                  <>
                    <ImageIcon className="h-3 w-3" />
                    {message.photos.length}
                  </>
                )}
                {message.videos.length > 0 && (
                  <>
                    <Video className="h-3 w-3" />
                    {message.videos.length}
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Delete & Blacklist
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Login form component
function LoginForm({ onLogin }: { onLogin: (username: string, password: string) => Promise<boolean> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await onLogin(username, password);
    if (!success) {
      setError("Invalid username or password");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center mb-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">Admin Access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Main admin panel component
function AdminPanel() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "views">("newest");
  
  // Delete functionality
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<TelegramMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedCount, setDeletedCount] = useState(0);
  
  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(20);
  const MESSAGES_PER_BATCH = 10;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/telegram', {
        headers: {
          'x-api-secret': 'newstel-internal-2024'
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setMessages(result.data.messages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, selectedChannel, sortBy]);

  // Filter and sort messages
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (msg) =>
          msg.text?.toLowerCase().includes(query) ||
          msg.channelName.toLowerCase().includes(query)
      );
    }

    if (selectedChannel) {
      result = result.filter((msg) => msg.channelUsername === selectedChannel);
    }

    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else if (sortBy === "oldest") {
      result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else if (sortBy === "views") {
      result.sort((a, b) => b.views - a.views);
    }

    return result;
  }, [messages, searchQuery, selectedChannel, sortBy]);

  // Slice messages for infinite scroll
  const displayMessages = filteredMessages.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMessages.length;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredMessages.length) {
          setVisibleCount(prev => Math.min(prev + MESSAGES_PER_BATCH, filteredMessages.length));
        }
      },
      { rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, filteredMessages.length]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Open delete dialog
  const openDeleteDialog = (message: TelegramMessage) => {
    setMessageToDelete(message);
    setDeleteDialogOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!messageToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messageId: messageToDelete.id,
          reason: 'Deleted by admin'
        })
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state
        setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));
        setDeletedCount(prev => prev + 1);
        setDeleteDialogOpen(false);
        setMessageToDelete(null);
      } else {
        console.error('Delete failed:', result.error);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Create backup
  const createBackup = async () => {
    try {
      const response = await fetch('/api/admin/backup', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        alert(`Backup created: ${result.messageCount} messages saved`);
      }
    } catch (error) {
      console.error('Backup failed:', error);
    }
  };

  // Get unique channels
  const channels = useMemo(() => {
    const channelMap = new Map<string, { username: string; name: string }>();
    messages.forEach(msg => {
      if (!channelMap.has(msg.channelUsername)) {
        channelMap.set(msg.channelUsername, { username: msg.channelUsername, name: msg.channelName });
      }
    });
    return Array.from(channelMap.values());
  }, [messages]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Admin Panel</h1>
                <p className="text-xs text-muted-foreground">
                  {messages.length} messages
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-9 w-9"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              {/* Backup button */}
              <Button
                variant="outline"
                size="sm"
                onClick={createBackup}
                className="gap-2"
              >
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Backup</span>
              </Button>

              {/* Logout */}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                {filteredMessages.length} messages
              </span>
              {deletedCount > 0 && (
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {deletedCount} deleted
                </span>
              )}
            </div>
            
            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  Sort: {sortBy === "newest" ? "Newest" : sortBy === "oldest" ? "Oldest" : "Most Views"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSortBy("newest")}>
                  Newest first
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("oldest")}>
                  Oldest first
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("views")}>
                  Most views
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Channel filters */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={selectedChannel === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedChannel(null)}
              className="flex-shrink-0"
            >
              All Channels
            </Button>
            {channels.map((channel) => (
              <Button
                key={channel.username}
                variant={selectedChannel === channel.username ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedChannel(channel.username)}
                className="flex-shrink-0"
              >
                {channel.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages grid */}
      <main className="flex-1 container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayMessages.map((message) => (
                <Card 
                  key={message.id} 
                  className="group overflow-hidden hover:shadow-lg transition-all duration-200 relative"
                >
                  {/* Delete button - top right corner */}
                  <button
                    onClick={() => openDeleteDialog(message)}
                    className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  {/* Media section */}
                  {(message.photos.length > 0 || message.videos.length > 0 || message.hasLargeMedia) && (
                    <div className="relative aspect-video bg-muted">
                      {message.hasLargeMedia ? (
                        <div className="w-full h-full flex items-center justify-center">
                          {message.largeMediaInfo?.thumbnailUrl ? (
                            <img
                              src={message.largeMediaInfo.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileVideo className="h-12 w-12 text-muted-foreground" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                              <Play className="h-5 w-5 text-gray-700 ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                        </div>
                      ) : message.videos.length > 0 ? (
                        <div className="relative w-full h-full">
                          {message.videos[0].thumbnailUrl && (
                            <img
                              src={message.videos[0].thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center">
                              <Play className="h-5 w-5 text-gray-700 ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                          {message.videos[0].duration && (
                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">
                              {message.videos[0].duration}
                            </div>
                          )}
                        </div>
                      ) : message.photos.length > 0 ? (
                        <img
                          src={message.photos[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                  )}

                  <CardContent className="p-4">
                    {/* Channel and time */}
                    <div className="flex items-center justify-between mb-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", CHANNEL_COLORS[message.channelUsername] || "")}
                      >
                        {message.channelName}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(message.timestamp)}
                      </span>
                    </div>

                    {/* Text */}
                    {message.text && <MessageText text={message.text} />}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {formatViews(message.views)}
                      </span>
                      <a
                        href={getTelegramUrl(message.postId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Load more trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* No results */}
            {filteredMessages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mb-4" />
                <p>No messages found</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        message={messageToDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth');
        const result = await response.json();
        setIsAuthenticated(result.authenticated);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, []);

  // Handle login
  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();
      if (result.success) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Loading state
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated - show login form
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Authenticated - show admin panel
  return <AdminPanel />;
}
