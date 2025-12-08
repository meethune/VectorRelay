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
import { Loader2 } from 'lucide-react';
import { DotPattern } from '../ui/dot-pattern';
import { TextAnimate } from '../ui/text-animate';

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
  const { theme } = useTheme();
  const isTerminal = theme === 'terminal';

  // Default messages based on theme
  const defaultMessage = isTerminal ? '[ LOADING_DATA ]' : 'Loading...';
  const displayMessage = message || defaultMessage;

  return (
    <div className={`relative flex items-center justify-center min-h-[400px] ${className}`}>
      {!isTerminal && (
        <>
          {/* Animated dot pattern background */}
          <DotPattern
            className="absolute inset-0 -z-10 opacity-10"
            width={20}
            height={20}
            glow={true}
            color="#3b82f6"
          />

          {/* Pulse effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-business-accent-primary opacity-20 animate-ping" />
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-col items-center gap-4">
        {isTerminal ? (
          <>
            <TextAnimate
              animation="blurIn"
              className="font-mono text-terminal-green text-lg"
            >
              {displayMessage}
            </TextAnimate>
            <div className="animate-pulse text-terminal-green font-mono">
              ▓▓▓▓▓▓▓▓▓▓
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-business-accent-primary" />
            <TextAnimate
              animation="fadeIn"
              className="text-business-text-secondary"
            >
              {displayMessage}
            </TextAnimate>
          </>
        )}
      </div>
    </div>
  );
}
