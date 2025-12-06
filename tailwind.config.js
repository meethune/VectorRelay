/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode with class strategy
  theme: {
    extend: {
      colors: {
        // Terminal green palette (for terminal theme)
        terminal: {
          green: '#00ff00',
          'green-dim': '#00cc00',
          'green-dark': '#008800',
          black: '#000000',
          'gray-dark': '#0a0a0a',
        },
        // Business theme colors (soft professional)
        business: {
          bg: {
            primary: '#2C2C2C',    // slate gray
            secondary: '#363636',  // slightly lighter gray
            tertiary: '#404040',   // medium gray
          },
          text: {
            primary: '#E4E4E4',    // light gray
            secondary: '#D0D0D0',  // slightly dimmer
            muted: '#A0A0A0',      // muted gray
          },
          border: {
            primary: '#404040',    // medium gray
            secondary: '#4A4A4A',  // lighter border
          },
          accent: {
            primary: '#A8DADC',    // light cyan
            hover: '#8FC7C9',      // darker cyan
            secondary: '#FFC1CC',  // soft pink
            button: '#B39CD0',     // lavender
            'button-hover': '#9B84B8', // darker lavender
          },
        },
        // Severity colors (work for both themes)
        critical: '#ef4444',       // red-500
        high: '#f97316',           // orange-500
        medium: '#eab308',         // yellow-500
        low: '#22c55e',            // green-500
        info: '#3b82f6',           // blue-500
      },
      fontFamily: {
        mono: ['Share Tech Mono', 'VT323', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
