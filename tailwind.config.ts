import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Colours map onto the CSS vars in globals.css :root (single source).
      // rgb(var(--x) / <alpha-value>) keeps Tailwind opacity modifiers working.
      colors: {
        // Semantic tokens
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          active: 'rgb(var(--color-primary-active) / <alpha-value>)',
          soft: 'rgb(var(--color-primary-soft) / <alpha-value>)',
        },
        trust: {
          DEFAULT: 'rgb(var(--color-trust) / <alpha-value>)',
          'on-dark': 'rgb(var(--color-trust-on-dark) / <alpha-value>)',
        },
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        rating: 'rgb(var(--color-rating) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        page: 'rgb(var(--color-page) / <alpha-value>)',
        line: 'rgb(var(--color-border) / <alpha-value>)',
        'wash-to': 'rgb(var(--color-wash-to) / <alpha-value>)',

        // Ink scale
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--color-ink-2) / <alpha-value>)',
        'ink-3': 'rgb(var(--color-ink-3) / <alpha-value>)',
        navy: 'rgb(var(--color-ink) / <alpha-value>)',

        // Neutral surfaces (legacy names kept; repointed to page/soft)
        cream: 'rgb(var(--color-page) / <alpha-value>)',
        'cream-2': 'rgb(var(--color-primary-soft) / <alpha-value>)',

        // RETIRED palette — names kept so existing usages need no page edits:
        //   gold (#2F80ED)          -> primary (navy)
        //   gold-2 / teal (#00BFA6) -> trust   (green; verified/success ticks)
        gold: 'rgb(var(--color-primary) / <alpha-value>)',
        'gold-2': 'rgb(var(--color-trust) / <alpha-value>)',
        teal: 'rgb(var(--color-trust) / <alpha-value>)',

        // Brand ramp rebuilt around navy #16296b (was a #2F80ED/#2563eb blue ramp):
        // light steps -> primary-soft, mid -> primary-hover, dark -> primary/active.
        brand: {
          50: 'rgb(var(--color-primary-soft) / <alpha-value>)',
          100: 'rgb(var(--color-primary-soft) / <alpha-value>)',
          200: 'rgb(var(--color-primary-soft) / <alpha-value>)',
          300: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          400: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          500: 'rgb(var(--color-primary-hover) / <alpha-value>)',
          600: 'rgb(var(--color-primary) / <alpha-value>)',
          700: 'rgb(var(--color-primary-active) / <alpha-value>)',
          800: 'rgb(var(--color-primary-active) / <alpha-value>)',
          900: 'rgb(var(--color-primary-active) / <alpha-value>)',
        },
      },
      fontFamily: {
        // Jost via next/font (--font-jost); Inter deleted (was never loaded).
        sans: [
          'var(--font-jost)',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: ['var(--font-newsreader)', 'Georgia', 'Cambria', 'serif'],
        newsreader: ['var(--font-newsreader)', 'serif'],
        jost: ['var(--font-jost)', 'sans-serif'],
        // Cormorant RETIRED -> remapped to Newsreader (font-cormorant usages inherit it).
        cormorant: ['var(--font-newsreader)', 'serif'],
        etna: ['"Etna Sans Serif"', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
