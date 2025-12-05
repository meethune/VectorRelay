/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Terminal green palette
        terminal: {
          green: '#00ff00',
          'green-dim': '#00cc00',
          'green-dark': '#008800',
          black: '#000000',
          'gray-dark': '#0a0a0a',
        },
        // Severity colors (green variations)
        critical: '#ff0000',      // Red for critical
        high: '#ff6600',          // Orange for high
        medium: '#ffff00',        // Yellow for medium
        low: '#00ff00',           // Green for low
        info: '#00cc00',          // Dim green for info
      },
      fontFamily: {
        mono: ['Share Tech Mono', 'VT323', 'monospace'],
      },
    },
  },
  plugins: [],
}
