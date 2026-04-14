// Theme definitions with CSS variables, fonts, effects, and techy elements

export type ThemeName = 'dark' | 'cyberpunk' | 'terminal' | 'midnight' | 'military' | 'synthwave';

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  accent: string;
  muted: string;
  mutedForeground: string;
  border: string;
  card: string;
  destructive: string;
}

export interface ThemeEffects {
  scanlines: boolean;
  gridOverlay: boolean;
  glowEffect: boolean;
  gradientBg: boolean;
  particles: boolean;
  noise: boolean;
  cutCorners: boolean;
  techyBorders: boolean;
  animatedBorders: boolean;
}

export interface ThemeGradient {
  from: string;
  to: string;
  angle?: string;
}

export interface ThemeTypography {
  heading: string;
  body: string;
  mono: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  icon: string;
  colors: ThemeColors;
  effects: ThemeEffects;
  gradient?: ThemeGradient;
  typography: ThemeTypography;
  googleFonts: string[];
}

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    label: 'Dark',
    description: 'Classic dark mode',
    icon: '🌙',
    colors: {
      background: '#0a0a0a',
      foreground: '#fafafa',
      primary: '#dc2626',
      primaryForeground: '#ffffff',
      secondary: '#171717',
      accent: '#dc2626',
      muted: '#262626',
      mutedForeground: '#a3a3a3',
      border: '#262626',
      card: '#171717',
      destructive: '#dc2626',
    },
    effects: {
      scanlines: false,
      gridOverlay: false,
      glowEffect: false,
      gradientBg: false,
      particles: false,
      noise: false,
      cutCorners: false,
      techyBorders: false,
      animatedBorders: false,
    },
    typography: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    googleFonts: ['Inter:wght@400;500;600;700', 'JetBrains+Mono:wght@400;500'],
  },
  cyberpunk: {
    name: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon lights & futuristic vibes',
    icon: '🤖',
    colors: {
      background: '#0a0a0f',
      foreground: '#00ff88',
      primary: '#ff00ff',
      primaryForeground: '#ffffff',
      secondary: '#1a1a2e',
      accent: '#00ff88',
      muted: '#0f0f1a',
      mutedForeground: '#00ff88',
      border: '#00ff8830',
      card: '#0d0d14',
      destructive: '#ff0055',
    },
    effects: {
      scanlines: true,
      gridOverlay: true,
      glowEffect: true,
      gradientBg: true,
      particles: false,
      noise: false,
      cutCorners: true,
      techyBorders: true,
      animatedBorders: true,
    },
    gradient: {
      from: '#0a0a0f',
      to: '#0f0a1a',
      angle: '180deg',
    },
    typography: {
      heading: 'Orbitron, sans-serif',
      body: 'Rajdhani, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    googleFonts: ['Orbitron:wght@400;500;600;700;800;900', 'Rajdhani:wght@400;500;600;700', 'JetBrains+Mono:wght@400;500'],
  },
  terminal: {
    name: 'terminal',
    label: 'Terminal',
    description: 'Classic hacker aesthetic',
    icon: '💻',
    colors: {
      background: '#000000',
      foreground: '#00ff00',
      primary: '#00ff00',
      primaryForeground: '#000000',
      secondary: '#0a0a0a',
      accent: '#00cc00',
      muted: '#0a1a0a',
      mutedForeground: '#00ff00',
      border: '#00ff0040',
      card: '#030303',
      destructive: '#ff3333',
    },
    effects: {
      scanlines: true,
      gridOverlay: false,
      glowEffect: true,
      gradientBg: false,
      particles: false,
      noise: true,
      cutCorners: false,
      techyBorders: true,
      animatedBorders: false,
    },
    typography: {
      heading: 'JetBrains Mono, monospace',
      body: 'JetBrains Mono, monospace',
      mono: 'JetBrains Mono, monospace',
    },
    googleFonts: ['JetBrains+Mono:wght@400;500;600;700'],
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    description: 'Deep blue ocean vibes',
    icon: '🌊',
    colors: {
      background: '#050a14',
      foreground: '#e0e7ff',
      primary: '#3b82f6',
      primaryForeground: '#ffffff',
      secondary: '#0f172a',
      accent: '#60a5fa',
      muted: '#1e293b',
      mutedForeground: '#94a3b8',
      border: '#1e3a5f',
      card: '#0a1220',
      destructive: '#ef4444',
    },
    effects: {
      scanlines: false,
      gridOverlay: false,
      glowEffect: true,
      gradientBg: true,
      particles: false,
      noise: false,
      cutCorners: true,
      techyBorders: true,
      animatedBorders: true,
    },
    gradient: {
      from: '#050a14',
      to: '#0a1025',
      angle: '180deg',
    },
    typography: {
      heading: 'Space Grotesk, sans-serif',
      body: 'Space Grotesk, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    googleFonts: ['Space+Grotesk:wght@400;500;600;700', 'JetBrains+Mono:wght@400;500'],
  },
  military: {
    name: 'military',
    label: 'Military',
    description: 'Tactical operations center',
    icon: '🎯',
    colors: {
      background: '#0d0d0a',
      foreground: '#d4d4aa',
      primary: '#ff9500',
      primaryForeground: '#000000',
      secondary: '#1a1a14',
      accent: '#ff9500',
      muted: '#1a1a14',
      mutedForeground: '#a0a080',
      border: '#3a3a28',
      card: '#12120e',
      destructive: '#ff4444',
    },
    effects: {
      scanlines: true,
      gridOverlay: true,
      glowEffect: false,
      gradientBg: false,
      particles: false,
      noise: true,
      cutCorners: true,
      techyBorders: true,
      animatedBorders: false,
    },
    gradient: {
      from: '#0d0d0a',
      to: '#10100c',
      angle: '180deg',
    },
    typography: {
      heading: 'Rajdhani, sans-serif',
      body: 'Rajdhani, sans-serif',
      mono: 'Share Tech Mono, monospace',
    },
    googleFonts: ['Rajdhani:wght@400;500;600;700', 'Share+Tech+Mono'],
  },
  synthwave: {
    name: 'synthwave',
    label: 'Synthwave',
    description: '80s retro sunset dreams',
    icon: '🌅',
    colors: {
      background: '#0f0515',
      foreground: '#f0f0f0',
      primary: '#ff6b35',
      primaryForeground: '#ffffff',
      secondary: '#1a0f20',
      accent: '#ff00ff',
      muted: '#1a0f20',
      mutedForeground: '#c0a0c0',
      border: '#ff6b3530',
      card: '#140a18',
      destructive: '#ff3366',
    },
    effects: {
      scanlines: false,
      gridOverlay: true,
      glowEffect: true,
      gradientBg: true,
      particles: false,
      noise: false,
      cutCorners: true,
      techyBorders: true,
      animatedBorders: true,
    },
    gradient: {
      from: '#0f0515',
      to: '#1a0a25',
      angle: '180deg',
    },
    typography: {
      heading: 'Orbitron, sans-serif',
      body: 'Exo 2, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    googleFonts: ['Orbitron:wght@400;500;600;700;800;900', 'Exo+2:wght@400;500;600;700', 'JetBrains+Mono:wght@400;500'],
  },
};

// Load Google Fonts
export function loadGoogleFonts(fonts: string[]) {
  if (typeof window === 'undefined') return;
  
  const existingLink = document.getElementById('google-fonts-theme');
  if (existingLink) {
    existingLink.remove();
  }
  
  const link = document.createElement('link');
  link.id = 'google-fonts-theme';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${fonts.map(f => `family=${f}`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

// Apply theme to document
export function applyTheme(themeName: ThemeName) {
  const theme = THEMES[themeName];
  if (!theme) return;

  const root = document.documentElement;

  // Set CSS variables
  root.style.setProperty('--background', theme.colors.background);
  root.style.setProperty('--foreground', theme.colors.foreground);
  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--primary-foreground', theme.colors.primaryForeground);
  root.style.setProperty('--secondary', theme.colors.secondary);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--muted', theme.colors.muted);
  root.style.setProperty('--muted-foreground', theme.colors.mutedForeground);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--card', theme.colors.card);
  root.style.setProperty('--destructive', theme.colors.destructive);

  // Set typography
  root.style.setProperty('--font-heading', theme.typography.heading);
  root.style.setProperty('--font-body', theme.typography.body);
  root.style.setProperty('--font-mono', theme.typography.mono);

  // Set theme name for effects
  root.setAttribute('data-theme', themeName);

  // Load Google Fonts
  loadGoogleFonts(theme.googleFonts);

  // Save to localStorage
  localStorage.setItem('newstel-theme', themeName);
}

// Get saved theme
export function getSavedTheme(): ThemeName {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('newstel-theme') as ThemeName;
  return THEMES[saved] ? saved : 'dark';
}
