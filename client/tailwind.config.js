/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EAE4D6',
        'paper-2': '#F4EFE4',
        'paper-3': '#FBF8F0',
        ink: '#1A1712',
        'ink-soft': '#5C5446',
        'ink-faint': '#8E8576',
        signal: '#DD4814',
        'signal-deep': '#B5380E',
        matched: '#1F6B5C',
        partial: '#C08A1E',
        missing: '#C0392B',
        line: '#1A1712',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        hard: '3px 3px 0 0 #1A1712',
        'hard-sm': '2px 2px 0 0 #1A1712',
        'hard-lg': '5px 5px 0 0 #1A1712',
        'hard-signal': '3px 3px 0 0 #DD4814',
      },
      keyframes: {
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'rise-in': 'rise-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'blink': 'blink 1s steps(2, start) infinite',
      },
    },
  },
  plugins: [],
}
