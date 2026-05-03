import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Represent brand palette — gold-on-near-black, institutional.
        ink: {
          DEFAULT: '#040707', // off-black, not pure
          950: '#040707',
          900: '#08090B',
          850: '#0D0F12',
          800: '#15181C',
          700: '#1E2228',
          600: '#2A2F37',
          500: '#3A4049',
        },
        bone: {
          DEFAULT: '#F4F5F6',
          muted: '#C7CACD',
          faint: '#8E9297',
          soft: '#5A5F66',
        },
        gold: {
          DEFAULT: '#EABA58',
          light: '#F4D28C',
          dark: '#C89A3E',
          tint: 'rgba(234, 186, 88, 0.12)',
          tintStrong: 'rgba(234, 186, 88, 0.22)',
        },
        support: '#34C759',
        oppose: '#FF6B6B',
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        eyebrow: '0.16em',
        tightish: '-0.018em',
        crunch: '-0.02em',
      },
      maxWidth: {
        page: '1400px',
      },
      boxShadow: {
        diffuse: '0 24px 60px -28px rgba(234, 186, 88, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
