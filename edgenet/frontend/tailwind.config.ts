import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['var(--font-plex)', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 700: '#243E4D', 800: '#162A36', 900: '#0F1D26', 950: '#0A141B' },
        brand: {
          50: '#ECF8F6', 100: '#D0EEEA', 200: '#A3DDD6', 300: '#6CC6BC', 400: '#35A99E',
          500: '#138F85', 600: '#0B7A72', 700: '#08635C', 800: '#074F4A', 900: '#063F3B',
        },
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      animation: {
        'fade-in': 'fade-in .35s ease-out both',
        'slide-up': 'slide-up .45s cubic-bezier(.21,.9,.35,1) both',
        'grow-x': 'grow-x .8s cubic-bezier(.21,.9,.35,1) both',
      },
    },
  },
  plugins: [],
};
export default config;
