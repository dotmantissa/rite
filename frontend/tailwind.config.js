/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'rite-orange': '#f97316',
        'rite-green': '#19d184',
        'rite-bg': '#050505',
        'rite-card': '#0f0f0f',
        'rite-border': '#1c1c1c',
        'rite-muted': '#2a2a2a',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
