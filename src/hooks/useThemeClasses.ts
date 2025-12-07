/**
 * useThemeClasses Hook
 *
 * Provides theme-aware CSS class strings for common UI patterns.
 * Eliminates the need for repeated theme-based className logic.
 *
 * Features:
 * - Centralized theme styling patterns
 * - Consistent UI across components
 * - Easy to update theme styles globally
 * - Reduces code duplication
 *
 * @example
 * ```tsx
 * const classes = useThemeClasses();
 * <input className={`w-full px-4 py-2 ${classes.input}`} />
 * <button className={`px-4 py-2 ${classes.button}`}>Click</button>
 * ```
 */

import { useTheme } from '../contexts/ThemeContext';

/**
 * Theme-aware CSS class collections for common UI patterns
 */
export interface ThemeClasses {
  /** Input field styling (text inputs, selects, textareas) */
  input: string;

  /** Primary button styling */
  button: string;

  /** Secondary/outline button styling */
  buttonSecondary: string;

  /** Card/panel container styling */
  card: string;

  /** Primary text styling */
  text: string;

  /** Muted/secondary text styling */
  textMuted: string;

  /** Label text styling */
  label: string;

  /** Container/wrapper styling */
  container: string;

  /** Border styling */
  border: string;

  /** Background styling */
  background: string;

  /** Link styling */
  link: string;

  /** Badge/tag styling */
  badge: string;
}

/**
 * Returns theme-aware CSS classes for common UI patterns
 *
 * @returns Object containing pre-composed className strings for various UI elements
 */
export function useThemeClasses(): ThemeClasses {
  const { theme } = useTheme();
  const isTerminal = theme === 'terminal';

  return {
    // Input fields (text, select, textarea)
    input: isTerminal
      ? 'bg-black text-terminal-green border-terminal-green-dark focus:border-terminal-green font-mono placeholder-terminal-green-dark'
      : 'bg-business-bg-tertiary text-business-text-primary border-business-border-primary focus:border-business-accent-primary font-sans placeholder:text-business-text-muted',

    // Primary button
    button: isTerminal
      ? 'bg-terminal-green text-black hover:bg-terminal-green-dim font-mono transition-colors'
      : 'bg-business-accent-primary text-white hover:bg-business-accent-hover font-sans transition-colors',

    // Secondary/outline button
    buttonSecondary: isTerminal
      ? 'bg-transparent text-terminal-green border-2 border-terminal-green hover:bg-terminal-green hover:text-black font-mono transition-colors'
      : 'bg-transparent text-business-accent-primary border-2 border-business-accent-primary hover:bg-business-accent-primary hover:text-white font-sans transition-colors',

    // Card/panel container
    card: isTerminal
      ? 'bg-black border-2 border-terminal-green text-terminal-green font-mono'
      : 'bg-business-bg-secondary border-2 border-business-border-primary text-business-text-primary font-sans',

    // Primary text
    text: isTerminal
      ? 'text-terminal-green font-mono'
      : 'text-business-text-primary font-sans',

    // Muted/secondary text
    textMuted: isTerminal
      ? 'text-terminal-green-dim font-mono'
      : 'text-business-text-muted font-sans',

    // Label text
    label: isTerminal
      ? 'text-terminal-green-dim font-mono text-sm'
      : 'text-business-text-muted font-sans text-sm',

    // Container/wrapper
    container: isTerminal
      ? 'bg-black border-terminal-green'
      : 'bg-business-bg-secondary border-business-border-primary',

    // Border
    border: isTerminal ? 'border-terminal-green' : 'border-business-border-primary',

    // Background
    background: isTerminal ? 'bg-black' : 'bg-business-bg-secondary',

    // Link
    link: isTerminal
      ? 'text-terminal-green hover:text-terminal-green-dim underline font-mono'
      : 'text-business-accent-primary hover:text-business-accent-hover underline font-sans',

    // Badge/tag
    badge: isTerminal
      ? 'bg-terminal-green-dark text-terminal-green border border-terminal-green font-mono px-2 py-1 text-xs'
      : 'bg-business-accent-primary/10 text-business-accent-primary border border-business-accent-primary/20 font-sans px-2 py-1 text-xs rounded',
  };
}
