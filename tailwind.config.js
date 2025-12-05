/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        critical: '#dc2626',
        high: '#f59e0b',
        medium: '#eab308',
        low: '#3b82f6',
        info: '#6b7280',
      },
    },
  },
  plugins: [],
}
