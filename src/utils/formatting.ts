/**
 * Formats text for terminal theme display
 * Converts spaces to underscores and uppercases text
 *
 * @param text - The text to format
 * @returns Formatted text (uppercase with underscores)
 *
 * @example
 * formatTerminalText('Krebs on Security') // 'KREBS_ON_SECURITY'
 * formatTerminalText('US-CERT Current Activity') // 'US-CERT_CURRENT_ACTIVITY'
 * formatTerminalText('Multiple  spaces') // 'MULTIPLE__SPACES'
 */
export function formatTerminalText(text: string): string {
  return text.toUpperCase().replace(/ /g, '_');
}
