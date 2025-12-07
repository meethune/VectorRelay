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
 * Business Theme Severity Badge Styles
 *
 * Enhanced severity styling for the business theme with:
 * - Dark colored backgrounds
 * - Bright borders for visibility
 * - High-contrast text colors
 *
 * Usage:
 * ```tsx
 * const { theme } = useTheme();
 * if (theme === 'business') {
 *   <span className={BUSINESS_SEVERITY_STYLES[severity]}>
 *     {severity}
 *   </span>
 * }
 * ```
 */
export const BUSINESS_SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-business-threat-critical-bg border-business-threat-critical-border text-business-threat-critical-text',
  high: 'bg-business-threat-high-bg border-business-threat-high-border text-business-threat-high-text',
  medium: 'bg-business-threat-medium-bg border-business-threat-medium-border text-business-threat-medium-text',
  low: 'bg-business-threat-low-bg border-business-threat-low-border text-business-threat-low-text',
  info: 'bg-business-threat-info-bg border-business-threat-info-border text-business-threat-info-text',
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
