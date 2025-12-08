/**
 * EmptyState Component
 *
 * A reusable empty state component for displaying when no data is available.
 * Adapts to the current theme and supports custom messages and icons.
 *
 * Features:
 * - Theme-aware styling (terminal/business)
 * - Optional icon display
 * - Customizable message and description
 * - Consistent empty state UX across the app
 *
 * @example
 * ```tsx
 * if (threats.length === 0) {
 *   return (
 *     <EmptyState
 *       icon={<AlertTriangle className="w-12 h-12" />}
 *       message="No threats found"
 *       description="Try adjusting your filters"
 *     />
 *   );
 * }
 * ```
 */

import { useTheme } from '../../contexts/ThemeContext';
import { ReactNode } from 'react';
import { HyperText } from '../ui/hyper-text';
import { GridPattern } from '../ui/grid-pattern';

interface EmptyStateProps {
  /**
   * Optional icon to display (e.g., Lucide icon component)
   */
  icon?: ReactNode;

  /**
   * Primary message to display
   */
  message: string;

  /**
   * Optional secondary description text
   */
  description?: string;

  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
}

/**
 * Displays a themed empty state with optional icon and description
 */
export function EmptyState({
  icon,
  message,
  description,
  className = '',
}: EmptyStateProps) {
  const { theme } = useTheme();
  const isTerminal = theme === 'terminal';

  return (
    <div className={`relative flex flex-col items-center justify-center min-h-[400px] p-8 border-2 rounded-lg ${
      isTerminal
        ? 'text-terminal-green border-terminal-green font-mono'
        : 'text-business-text-primary border-business-border-primary font-sans'
    } ${className}`}>
      {!isTerminal && (
        <GridPattern
          className="absolute inset-0 -z-10 opacity-5 rounded-lg"
          width={40}
          height={40}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Icon with enhanced styling */}
        {icon && (
          <div className={`
            p-4 rounded-full
            ${isTerminal
              ? 'bg-terminal-gray-dark'
              : 'bg-business-bg-tertiary border-2 border-business-border-accent'
            }
          `}>
            {icon}
          </div>
        )}
        {/* Message */}
        {isTerminal && (message.includes('ERROR') || message.includes('FAILED') || message.includes('not found')) ? (
          <HyperText
            as="h3"
            className="text-xl font-semibold text-terminal-green font-mono"
            duration={600}
            animateOnHover={false}
            startOnView={true}
            characterSet={['!', '@', '#', '$', '%', '^', '&', '*', 'X', 'E', 'R', 'O']}
          >
            {message.toUpperCase().replace(/ /g, '_')}
          </HyperText>
        ) : (
          <h3 className={`text-xl font-semibold ${
            isTerminal ? 'text-terminal-green font-mono' : 'text-business-text-primary'
          }`}>
            {isTerminal ? message.toUpperCase().replace(/ /g, '_') : message}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className={`text-center max-w-md ${
            isTerminal ? 'text-terminal-green-dim font-mono' : 'text-business-text-muted'
          }`}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
