/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Code"', 'Consolas', 'monospace']
      },
      colors: {
        // Discord benzeri katmanlar; değerler globals.css'teki değişkenlerden.
        rail: 'hsl(var(--rail))',
        sidebar: 'hsl(var(--sidebar))',
        chat: 'hsl(var(--chat))',
        floating: 'hsl(var(--floating))',
        hover: 'hsl(var(--hover))',
        selected: 'hsl(var(--selected))',
        input: 'hsl(var(--input))',
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          hover: 'hsl(var(--brand-hover))'
        },
        online: 'hsl(var(--online))',
        idle: 'hsl(var(--idle))',
        dnd: 'hsl(var(--dnd))',
        offline: 'hsl(var(--offline))',
        border: 'hsl(var(--border))',
        ring: 'hsl(var(--brand))',
        background: 'hsl(var(--chat))',
        foreground: 'hsl(var(--text))',
        header: 'hsl(var(--header))',
        muted: {
          DEFAULT: 'hsl(var(--hover))',
          foreground: 'hsl(var(--text-muted))'
        },
        primary: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(0 0% 100%)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--selected))',
          foreground: 'hsl(var(--text))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--dnd))',
          foreground: 'hsl(0 0% 100%)'
        },
        accent: {
          DEFAULT: 'hsl(var(--hover))',
          foreground: 'hsl(var(--header))'
        },
        popover: {
          DEFAULT: 'hsl(var(--floating))',
          foreground: 'hsl(var(--text))'
        }
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px'
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } }
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
