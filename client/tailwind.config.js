/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#ffffff',
        'bg-secondary': '#fafafa',
        'bg-tertiary': '#f5f5f5',
        'border-primary': '#e5e5e5',
        'border-secondary': '#d4d4d4',
        'text-primary': '#171717',
        'text-secondary': '#737373',
        'text-tertiary': '#a3a3a3',
        'accent': '#5e6ad2',
        'accent-hover': '#6b75db',
        'accent-light': '#eef0ff',
        'success': '#22c55e',
        'warning': '#f59e0b',
        'error': '#ef4444',
        'error-bg': '#fef2f2',
        'cat-family': '#ea580c',
        'cat-work': '#2563eb',
        'cat-life': '#16a34a',
        'cat-study': '#9333ea',
        'cat-visual': '#db2777',
        'cat-shopping': '#ec4899',
        'cat-health': '#0891b2',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'flip-in': 'flipIn 500ms ease-out',
        'bubble-in': 'bubbleIn 400ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        flipIn: {
          '0%': { transform: 'rotateY(90deg)', opacity: '0' },
          '100%': { transform: 'rotateY(0)', opacity: '1' },
        },
        bubbleIn: {
          '0%': { opacity: '0', transform: 'translateY(-12px) scale(0.95)' },
          '60%': { opacity: '1', transform: 'translateY(2px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
