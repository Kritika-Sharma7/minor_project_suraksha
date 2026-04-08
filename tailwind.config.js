/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        safe:       { DEFAULT: '#22c55e', dark: '#16a34a' },
        suspicious: { DEFAULT: '#f59e0b', dark: '#d97706' },
        high:       { DEFAULT: '#f97316', dark: '#ea580c' },
        critical:   { DEFAULT: '#ef4444', dark: '#dc2626' },
        surface:    { 50: '#1a1a2e', 100: '#16213e', 200: '#0f3460', 300: '#533483' },
        base:       '#080810',
      },
      fontFamily: {
        display: ['"Orbitron"', 'monospace'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow-red':    'glowRed 1.5s ease-in-out infinite alternate',
        'scan':        'scan 2s linear infinite',
        'float':       'float 6s ease-in-out infinite',
      },
      keyframes: {
        glowRed: {
          '0%':   { boxShadow: '0 0 5px #ef4444, 0 0 10px #ef4444' },
          '100%': { boxShadow: '0 0 20px #ef4444, 0 0 40px #ef4444, 0 0 60px #ef4444' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
