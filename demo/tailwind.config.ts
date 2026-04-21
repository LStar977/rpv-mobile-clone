import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#040707',
        gold: '#EABA58',
        goldDark: '#C99A3F',
        paper: '#F4F5F6',
        steel: '#007BFF',
        danger: '#DC2626',
        success: '#2BB673',
        border: '#1A1E22',
      },
      fontFamily: {
        display: ['var(--font-onest)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
