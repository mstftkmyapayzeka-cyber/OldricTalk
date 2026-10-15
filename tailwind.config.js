/** @type {import('tailwindcss').Config} */

// OldricTalk tasarım sistemi belirteçleri; değerler globals.css'teki değişkenlerden.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`

const TOKENS = [
  'rail', 'sidebar', 'chat', 'floating', 'input', 'hover', 'selected',
  'border', 'border-strong',
  'brand', 'brand-hover', 'brand-soft', 'on-brand', 'focus',
  'header', 'text', 'text-muted', 'link',
  'online', 'on-online', 'idle', 'dnd', 'on-dnd', 'dnd-soft', 'offline',
  'role-admin', 'role-mod',
  'avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6', 'on-avatar'
]

module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      // Tipografi ölçeği: title-lg 26 · title-md 20 · title-sm 16 · body 15 · label 13 · meta 12 · overline 11 · tiny 10
      fontSize: {
        'title-lg': ['26px', { lineHeight: '32px', fontWeight: '800', letterSpacing: '-0.015em' }],
        'title-md': ['20px', { lineHeight: '26px', fontWeight: '700', letterSpacing: '-0.01em' }],
        'title-sm': ['16px', { lineHeight: '22px', fontWeight: '700' }],
        body: ['15px', '21px'],
        label: ['13px', '18px'],
        meta: ['12px', '16px'],
        overline: ['11px', { lineHeight: '14px', fontWeight: '700', letterSpacing: '0.06em' }],
        tiny: ['10px', { lineHeight: '13px', fontWeight: '700' }]
      },
      colors: {
        ...Object.fromEntries(TOKENS.map((t) => [t, token(t)])),
        // Eski (shadcn) adlar belirteçlere bağlanır.
        ring: token('focus'),
        background: token('chat'),
        foreground: token('text'),
        muted: { DEFAULT: token('hover'), foreground: token('text-muted') },
        primary: { DEFAULT: token('brand'), foreground: token('on-brand') },
        destructive: { DEFAULT: token('dnd'), foreground: token('on-dnd') },
        popover: { DEFAULT: token('floating'), foreground: token('text') }
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '14px',
        pill: '999px'
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        brand: 'var(--shadow-brand)'
      },
      width: {
        rail: 'var(--rail-w)',
        sidebar: 'var(--sidebar-w)',
        members: 'var(--members-w)',
        modal: 'var(--modal-w)',
        'modal-lg': 'var(--modal-w-lg)'
      },
      height: {
        titlebar: 'var(--titlebar-h)',
        row: 'var(--row-h)',
        'user-panel': 'var(--user-panel-h)',
        'voice-panel': 'var(--voice-panel-h)'
      },
      minHeight: {
        'voice-panel': 'var(--voice-panel-h)',
        composer: 'var(--composer-h)'
      },
      maxWidth: {
        content: 'var(--content-max)'
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease)',
        ot: 'var(--ease)'
      },
      transitionDuration: {
        DEFAULT: '140ms',
        fast: '90ms',
        base: '140ms',
        slow: '220ms'
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'typing-dot': {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: 0.5 },
          '30%': { transform: 'translateY(-3px)', opacity: 1 }
        }
      },
      animation: {
        'fade-in': 'fade-in 140ms var(--ease)',
        'typing-dot': 'typing-dot 1.1s infinite ease-in-out'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
