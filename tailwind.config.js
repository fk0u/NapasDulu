/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'system-bg': '#0a0a0a',
        'system-text': '#e5e5e5',
        'system-accent': '#ef4444',
        'system-border': '#333333',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
