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
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateY(-16px)' },
          '50%': { transform: 'translateY(260px)' },
        },
        'spin-reverse': {
          from: { transform: 'rotate(360deg)' },
          to: { transform: 'rotate(0deg)' },
        }
      },
      animation: {
        scan: 'scan 2.5s ease-in-out infinite',
        'spin-reverse': 'spin-reverse 1s linear infinite',
      }
    },
  },
  plugins: [],
}
