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
        // Business theme colors (dark professional)
        business: {
          bg: {
            primary: '#0f172a',    // slate-900
            secondary: '#1e293b',  // slate-800
            tertiary: '#334155',   // slate-700
          },
          text: {
            primary: '#f1f5f9',    // slate-100
            secondary: '#cbd5e1',  // slate-300
            muted: '#94a3b8',      // slate-400
          },
          border: {
            primary: '#334155',    // slate-700
            secondary: '#475569',  // slate-600
          },
          accent: {
            primary: '#3b82f6',    // blue-500
            hover: '#2563eb',      // blue-600
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
