import { Monitor, Briefcase } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        px-3 py-2 border transition-all flex items-center gap-2
        ${theme === 'terminal'
          ? 'bg-terminal-green text-black border-terminal-green font-mono text-sm'
          : 'bg-business-accent-button text-white border-business-border-primary hover:bg-business-accent-button-hover text-sm font-medium'
        }
      `}
      title={`Switch to ${theme === 'terminal' ? 'Business' : 'Terminal'} theme`}
    >
      {theme === 'terminal' ? (
        <>
          <Briefcase className="w-4 h-4" />
          <span className="hidden sm:inline">[ BUSINESS ]</span>
        </>
      ) : (
        <>
          <Monitor className="w-4 h-4" />
          <span className="hidden sm:inline">Terminal</span>
        </>
      )}
    </button>
  );
}
