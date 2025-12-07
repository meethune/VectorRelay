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
  const { theme, formatText } = useTheme();
  const isTerminal = theme === 'terminal';

  return (
    <div
      className={`text-center py-12 border-2 p-8 ${
        isTerminal
          ? 'text-terminal-green border-terminal-green font-mono'
          : 'text-business-text-primary border-business-border-primary font-sans'
      } ${className}`}
    >
      {icon && (
        <div
          className={`flex justify-center mb-4 ${
            isTerminal ? 'icon-glow' : ''
          }`}
        >
          {icon}
        </div>
      )}
      <p className={`text-lg font-semibold mb-2 ${isTerminal ? 'font-mono' : 'font-sans'}`}>
        {isTerminal ? message.toUpperCase().replace(/ /g, '_') : message}
      </p>
      {description && (
        <p
          className={`text-sm ${
            isTerminal
              ? 'text-terminal-green-dim font-mono'
              : 'text-business-text-muted font-sans'
          }`}
        >
          {description}
        </p>
      )}
    </div>
  );
}
