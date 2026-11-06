/** @type {import('tailwindcss').Config} */
// Theme tokens live in src/index.css (see docs/ui-theme-spec.md).
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`
const tone = (name) => ({
  DEFAULT: token(name),
  soft: token(`${name}-soft`),
  line: token(`${name}-line`),
})

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
          input: token('line-input'),
        },
        fg: {
          DEFAULT: token('fg'),
          secondary: token('fg-secondary'),
          muted: token('fg-muted'),
        },
        accent: {
          DEFAULT: token('accent'),
          text: token('accent-text'),
          fill: token('accent-fill'),
          'fill-hover': token('accent-fill-hover'),
          soft: token('accent-soft'),
        },
        'on-accent': token('on-accent'),
        success: tone('success'),
        warning: tone('warning'),
        danger: tone('danger'),
        info: tone('info'),
        progress: tone('progress'),
        offer: tone('offer'),
        neutral: tone('neutral'),
        chart: {
          1: token('chart-1'),
          2: token('chart-2'),
          3: token('chart-3'),
          4: token('chart-4'),
          5: token('chart-5'),
          6: token('chart-6'),
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['18px', { lineHeight: '26px' }],
        '2xl': ['22px', { lineHeight: '30px' }],
        '3xl': ['26px', { lineHeight: '34px' }],
      },
      borderRadius: {
        card: '8px',
        control: '6px',
      },
      boxShadow: {
        overlay: 'var(--shadow-overlay)',
      },
      ringColor: {
        DEFAULT: token('accent'),
      },
    },
  },
  plugins: [],
}
