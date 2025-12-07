/**
 * LoadingState Component
 *
 * A reusable loading state component that adapts to the current theme.
 * Displays a loading message with an animated indicator.
 *
 * Features:
 * - Theme-aware styling (terminal/business)
 * - Customizable message
 * - Animated loading indicator
 * - Consistent loading UX across the app
 *
 * @example
 * ```tsx
 * if (loading) {
 *   return <LoadingState message="Loading threats..." />;
 * }
 * ```
 */

import { useTheme } from '../../contexts/ThemeContext';

interface LoadingStateProps {
  /**
   * Custom loading message to display
   * If not provided, uses a default message based on theme
   */
  message?: string;

  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
}

/**
 * Displays a themed loading state with an animated indicator
 */
export function LoadingState({ message, className = '' }: LoadingStateProps) {
  const { theme, formatText } = useTheme();
  const isTerminal = theme === 'terminal';

  // Default messages based on theme
  const defaultMessage = isTerminal ? '[ LOADING_DATA ]' : 'Loading...';
  const displayMessage = message || defaultMessage;

  return (
    <div className={`flex items-center justify-center h-64 ${className}`}>
      <div
        className={
          isTerminal
            ? 'text-terminal-green font-mono'
            : 'text-business-text-primary font-sans'
        }
      >
        <div className="text-2xl mb-4">{displayMessage}</div>
        <div className="animate-pulse">
          {isTerminal ? '▓▓▓▓▓▓▓▓▓▓' : '...'}
        </div>
      </div>
    </div>
  );
}
