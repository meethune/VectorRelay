import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'business' | 'terminal';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
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

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
