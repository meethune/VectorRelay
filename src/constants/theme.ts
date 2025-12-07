/**
 * Theme Constants for VectorRelay Frontend
 *
 * This file contains all theme-related constants including:
 * - Severity color mappings
 * - Category color schemes (terminal and business themes)
 *
 * IMPORTANT: This is the single source of truth for UI color schemes.
 */

/**
 * Severity color mappings
 *
 * Maps threat severity levels to Tailwind CSS background classes.
 * These classes are defined in tailwind.config.js.
 *
 * Usage:
 * ```tsx
 * <div className={SEVERITY_COLORS[threat.severity]}>
 *   {threat.severity}
 * </div>
 * ```
 */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-critical',
  high: 'bg-high',
  medium: 'bg-medium',
  low: 'bg-low',
  info: 'bg-info',
} as const;

/**
 * Category color schemes for different UI themes
 *
 * Contains two color palettes:
 * - terminal: Green-based monochrome palette for terminal theme
 * - business: Multi-color vibrant palette for business theme
 *
 * Usage:
 * ```tsx
 * const { theme } = useTheme();
 * const colors = CATEGORY_COLORS[theme];
 * <div style={{ color: colors[category] }}>...</div>
 * ```
 */
export const CATEGORY_COLORS = {
  terminal: {
    ransomware: '#00ff00',
    apt: '#00dd00',
    vulnerability: '#00cc00',
    phishing: '#00bb00',
    malware: '#00aa00',
    data_breach: '#009900',
    ddos: '#008800',
    supply_chain: '#007700',
    insider_threat: '#006600',
    other: '#005500',
  },
  business: {
    ransomware: '#ef4444',
    apt: '#f97316',
    vulnerability: '#eab308',
    phishing: '#84cc16',
    malware: '#22c55e',
    data_breach: '#14b8a6',
    ddos: '#06b6d4',
    supply_chain: '#3b82f6',
    insider_threat: '#8b5cf6',
    other: '#64748b',
  },
} as const;
