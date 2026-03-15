// Global refresh manager - timer persists across page navigation within session
// Custom interval settings are TEMPORARY - reset to default 60s on page reload
// This prevents API abuse from users setting very short intervals

const DEFAULT_REFRESH_INTERVAL = 60; // seconds
const STORAGE_KEY = 'newstel-last-refresh';

// Module-level state (persists during session only)
let lastRefreshTime: number = 0;
let customInterval: number = DEFAULT_REFRESH_INTERVAL;
let isCustomEnabled: boolean = false;
let listeners: Set<(timeRemaining: number) => void> = new Set();
let intervalId: ReturnType<typeof setInterval> | null = null;
let settingsListeners: Set<(enabled: boolean, interval: number) => void> = new Set();

// Initialize from localStorage - ONLY for lastRefreshTime, NOT settings
function initFromStorage() {
  if (typeof window !== 'undefined') {
    // Clear any old settings from localStorage (cleanup)
    localStorage.removeItem('newstel-refresh-settings');
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lastRefreshTime = parsed;
      }
    }
    
    // If no stored time or time is in the future (clock issues), set to now
    if (!lastRefreshTime || lastRefreshTime <= 0 || lastRefreshTime > Date.now()) {
      lastRefreshTime = Date.now();
      localStorage.setItem(STORAGE_KEY, lastRefreshTime.toString());
    }
    
    // Settings are NOT loaded from storage - always start with defaults
    // This prevents API abuse from persistent short intervals
  }
}

function getCurrentInterval(): number {
  return isCustomEnabled ? customInterval : DEFAULT_REFRESH_INTERVAL;
}

function getTimeRemaining(): number {
  const elapsed = Math.floor((Date.now() - lastRefreshTime) / 1000);
  const remaining = getCurrentInterval() - elapsed;
  return Math.max(0, remaining);
}

function setLastRefresh() {
  lastRefreshTime = Date.now();
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, lastRefreshTime.toString());
  }
}

function notifyListeners() {
  const remaining = getTimeRemaining();
  listeners.forEach(listener => listener(remaining));
}

function notifySettingsListeners() {
  settingsListeners.forEach(listener => listener(isCustomEnabled, customInterval));
}

// Global tick function
function tick() {
  const remaining = getTimeRemaining();
  notifyListeners();
  
  // Note: We don't auto-trigger refresh here - 
  // The component watching the timer will trigger it when remaining === 0
}

export function subscribeToTimer(
  listener: (timeRemaining: number) => void
): () => void {
  // Initialize on first use
  if (lastRefreshTime === 0) {
    initFromStorage();
  }
  
  // Add listener
  listeners.add(listener);
  
  // Start interval if not running
  if (!intervalId) {
    intervalId = setInterval(tick, 1000);
  }
  
  // Immediately notify with current time
  listener(getTimeRemaining());
  
  // Return cleanup function
  return () => {
    listeners.delete(listener);
    
    // Stop interval if no listeners
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

export function subscribeToSettings(
  listener: (enabled: boolean, interval: number) => void
): () => void {
  // Initialize on first use
  if (lastRefreshTime === 0) {
    initFromStorage();
  }
  
  settingsListeners.add(listener);
  listener(isCustomEnabled, customInterval);
  
  return () => {
    settingsListeners.delete(listener);
  };
}

export function updateRefreshSettings(enabled: boolean, interval: number) {
  isCustomEnabled = enabled;
  customInterval = Math.max(5, Math.min(3600, interval)); // Clamp between 5s and 1h
  
  // NOT saved to localStorage - settings are temporary for this session only
  // This prevents API abuse from users leaving short intervals permanently
  
  notifySettingsListeners();
  notifyListeners(); // Update timer display with new interval
}

export function triggerRefresh() {
  setLastRefresh();
  notifyListeners();
}

export function getTimeRemainingGlobal(): number {
  if (lastRefreshTime === 0) {
    initFromStorage();
  }
  return getTimeRemaining();
}

export function getSettings(): { enabled: boolean; interval: number } {
  if (lastRefreshTime === 0) {
    initFromStorage();
  }
  return { enabled: isCustomEnabled, interval: customInterval };
}
