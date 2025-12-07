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
        // Business theme colors (cybersecurity professional - deep navy/blue)
        business: {
          // Backgrounds - Deep navy/space theme
          bg: {
            primary: '#0a0e1a',      // Deep navy (main background)
            secondary: '#131720',    // Slightly lighter navy (cards)
            tertiary: '#1a1f2e',     // Elevated surfaces
            elevated: '#1e2433',     // Hover/active states
            accent: '#0f1729',       // Subtle variation
          },
          // Text colors - High contrast
          text: {
            primary: '#e5e7eb',      // Bright white-gray (headings)
            secondary: '#cbd5e1',    // Medium gray (body text)
            muted: '#94a3b8',        // Dimmed gray (labels)
            disabled: '#64748b',     // Disabled state
          },
          // Border colors - Blue-tinted
          border: {
            primary: '#1e3a5f',      // Deep blue border (default)
            secondary: '#2d4a73',    // Lighter blue border (hover)
            accent: '#3b82f6',       // Bright blue (focus)
            subtle: '#1a2942',       // Very subtle borders
          },
          // Accent colors - Technology/Security themed
          accent: {
            primary: '#3b82f6',        // Bright blue (primary actions)
            primaryHover: '#2563eb',   // Darker blue (hover)
            secondary: '#8b5cf6',      // Purple (premium features)
            secondaryHover: '#7c3aed', // Darker purple (hover)
            cyber: '#06b6d4',          // Cyan (cyber aesthetic)
            cyberHover: '#0891b2',     // Darker cyan (hover)
            success: '#10b981',        // Green (safe/secure)
            warning: '#f59e0b',        // Amber (caution)
            danger: '#ef4444',         // Red (critical)
          },
          // Threat severity colors - High visibility
          threat: {
            critical: {
              bg: '#7f1d1d',         // Dark red background
              border: '#dc2626',     // Bright red border
              text: '#fecaca',       // Light red text
            },
            high: {
              bg: '#7c2d12',         // Dark orange background
              border: '#ea580c',     // Bright orange border
              text: '#fed7aa',       // Light orange text
            },
            medium: {
              bg: '#78350f',         // Dark amber background
              border: '#f59e0b',     // Bright amber border
              text: '#fde68a',       // Light amber text
            },
            low: {
              bg: '#14532d',         // Dark green background
              border: '#22c55e',     // Bright green border
              text: '#bbf7d0',       // Light green text
            },
            info: {
              bg: '#1e3a8a',         // Dark blue background
              border: '#3b82f6',     // Bright blue border
              text: '#bfdbfe',       // Light blue text
            },
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
      animation: {
        grid: "grid 15s linear infinite",
        "blink-cursor": "blink-cursor 1s step-end infinite",
      },
      keyframes: {
        grid: {
          "0%": { transform: "translateY(-50%)" },
          "100%": { transform: "translateY(0)" },
        },
        "blink-cursor": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
}
