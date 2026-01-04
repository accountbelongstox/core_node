/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        'ink-muted': '#475569',
        frost: '#e2e8f0',
        glass: 'rgba(255,255,255,0.8)',
        primary: '#2563eb',
        accent: '#9333ea',
      },
    },
  },
  plugins: [],
};
