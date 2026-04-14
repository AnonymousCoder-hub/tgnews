// User preferences stored in localStorage

export interface UserPreferences {
  // First-time setup completed
  setupCompleted: boolean;
  
  // Default/home category
  defaultCategory: string;
  
  // Category order (for hamburger menu)
  categoryOrder: string[];
  
  // Enabled categories
  enabledCategories: string[];
  
  // Per-category source preferences
  categorySources: {
    [category: string]: {
      enabled: string[];  // Enabled sources
      order: string[];    // Priority order
    };
  };
  
  // Selected theme
  theme: string;
}

// Default preferences
export const DEFAULT_PREFERENCES: UserPreferences = {
  setupCompleted: false,
  defaultCategory: 'war',
  categoryOrder: ['war', 'world', 'technology', 'sports', 'health', 'business', 'entertainment', 'science'],
  enabledCategories: ['war', 'world', 'technology', 'sports', 'health', 'business', 'entertainment', 'science'],
  categorySources: {},
  theme: 'dark'
};

// All available categories
export const ALL_CATEGORIES = [
  { id: 'war', label: 'War', icon: '⚡' },
  { id: 'world', label: 'World', icon: '🌍' },
  { id: 'technology', label: 'Technology', icon: '💻' },
  { id: 'sports', label: 'Sports', icon: '🏆' },
  { id: 'health', label: 'Health', icon: '❤️' },
  { id: 'business', label: 'Business', icon: '💰' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'science', label: 'Science', icon: '🔬' },
];

// All available sources per category
export const CATEGORY_SOURCES: { [category: string]: { id: string; name: string }[] } = {
  war: [
    { id: 'wfwitness', name: 'WarFront Witness' },
    { id: 'warmonitors', name: 'War Monitors' },
    { id: 'ethanlevins', name: 'Ethan Levins' },
    { id: 'Middle_East_Spectator', name: 'Middle East Spectator' },
    { id: 'rnintel', name: 'Rerum Novarum' },
    { id: 'SabrenNewss', name: 'Sabreen News' },
    { id: 'AjaNews', name: 'Al Jazeera' },
  ],
  technology: [
    { id: 'TechCrunch', name: 'TechCrunch' },
    { id: 'The Verge', name: 'The Verge' },
    { id: 'Wired', name: 'Wired' },
    { id: 'Ars Technica', name: 'Ars Technica' },
    { id: 'Engadget', name: 'Engadget' },
    { id: 'Hacker News', name: 'Hacker News' },
  ],
  world: [
    { id: 'BBC World', name: 'BBC World' },
    { id: 'Al Jazeera', name: 'Al Jazeera' },
    { id: 'DW News', name: 'DW News' },
    { id: 'NPR World', name: 'NPR World' },
    { id: 'France24', name: 'France24' },
    { id: 'The Guardian', name: 'The Guardian' },
  ],
  sports: [
    { id: 'Sky Sports', name: 'Sky Sports' },
    { id: 'BBC Sport', name: 'BBC Sport' },
    { id: 'NY Times Sports', name: 'NY Times Sports' },
    { id: 'NPR Sports', name: 'NPR Sports' },
  ],
  health: [
    { id: 'WHO News', name: 'WHO News' },
    { id: 'Fox Health', name: 'Fox Health' },
    { id: 'ET Health', name: 'ET Health' },
    { id: 'NPR Health', name: 'NPR Health' },
    { id: 'BBC Health', name: 'BBC Health' },
  ],
  business: [
    { id: 'Forbes', name: 'Forbes' },
    { id: 'NPR Business', name: 'NPR Business' },
    { id: 'NY Times Business', name: 'NY Times Business' },
    { id: 'BBC Business', name: 'BBC Business' },
    { id: 'Times of India Business', name: 'Times of India Business' },
  ],
  entertainment: [
    { id: 'Variety', name: 'Variety' },
    { id: 'Deadline', name: 'Deadline' },
    { id: 'Hollywood Reporter', name: 'Hollywood Reporter' },
    { id: 'NPR Arts', name: 'NPR Arts' },
    { id: 'BBC Entertainment', name: 'BBC Entertainment' },
  ],
  science: [
    { id: 'Science Daily', name: 'Science Daily' },
    { id: 'NPR Science', name: 'NPR Science' },
    { id: 'BBC Science', name: 'BBC Science' },
    { id: 'MIT Tech Review', name: 'MIT Tech Review' },
  ],
};

const STORAGE_KEY = 'newstel-preferences';

// Get user preferences
export function getPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new fields
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load preferences:', e);
  }
  
  return DEFAULT_PREFERENCES;
}

// Save user preferences
export function savePreferences(preferences: UserPreferences): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (e) {
    console.error('Failed to save preferences:', e);
  }
}

// Update specific preference
export function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K]
): UserPreferences {
  const current = getPreferences();
  const updated = { ...current, [key]: value };
  savePreferences(updated);
  return updated;
}

// Mark setup as completed
export function completeSetup(preferences: Partial<UserPreferences>): UserPreferences {
  const current = getPreferences();
  const updated = { ...current, ...preferences, setupCompleted: true };
  savePreferences(updated);
  return updated;
}

// Reset preferences
export function resetPreferences(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
