import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'business' | 'terminal';

type TextStyle = 'heading' | 'label' | 'text' | 'button' | 'navigation';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  formatText: (text: string, options?: { style?: TextStyle }) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to business theme, check localStorage
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'terminal' || saved === 'business') ? saved : 'business';
  });

  useEffect(() => {
    // Apply theme to document root
    const root = document.documentElement;

    if (theme === 'terminal') {
      root.classList.add('terminal-theme');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('terminal-theme');
    }

    // Save to localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'business' ? 'terminal' : 'business');
  };

  const formatText = (text: string, options?: { style?: TextStyle }): string => {
    // Business theme returns text as-is
    if (theme === 'business') return text;

    // Terminal theme: uppercase and replace spaces with underscores
    const formatted = text.toUpperCase().replace(/ /g, '_');

    // Apply style-specific formatting
    switch (options?.style) {
      case 'heading':
        return `[ ${formatted} ]`;
      case 'label':
        return `> ${formatted}`;
      case 'button':
        return `[ ${formatted} ]`;
      case 'navigation':
        return `[ ${formatted} ]`;
      case 'text':
      default:
        return formatted;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, formatText }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
