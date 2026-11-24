import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        desk: '#FCECEF',
        paper: '#FFFFFF',
        lace: '#FFFBFD',
        gutter: '#F3E3E7',
        strawberry: {
          50: '#FFF5F7',
          100: '#FDE8EE',
          200: '#F9D2DF',
          300: '#F4B2C7',
          400: '#EC8DAA',
          500: '#DF688D',
          600: '#C84E74',
          700: '#A83B5E',
        },
        butter: {
          50: '#FFFDF4',
          100: '#FFF6D8',
          200: '#FDEAB4',
          300: '#F9D884',
          400: '#EBB94E',
          500: '#C9922C',
        },
        cocoa: {
          DEFAULT: '#462E35',
          soft: '#6E4F58',
          light: '#9A7882',
        },
        cloth: {
          light: '#F8D5E0',
          DEFAULT: '#F1B8CA',
          dark: '#DF97AE',
          deep: '#6E3548',
        },
        mint: {
          100: '#E8F7EE',
          200: '#C7EBD5',
          300: '#9AD8B3',
          500: '#3D845B',
        },
      },
      fontFamily: {
        sans: ['"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
        serif: ['"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
        display: ['"Quicksand"', '"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
        hand: ['"Quicksand"', '"Nunito"', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        book: '0 1px 2px rgba(80, 34, 50, 0.26), 0 10px 18px -6px rgba(96, 44, 62, 0.28), 0 42px 72px -22px rgba(96, 44, 62, 0.44)',
        card: '0 4px 14px -4px rgba(110, 52, 72, 0.10)',
        ribbon: '2px 4px 10px -2px rgba(110, 52, 72, 0.18)',
        pasted: '0 4px 12px -2px rgba(110, 52, 72, 0.14)',
      },
    },
  },
  plugins: [],
} satisfies Config;
