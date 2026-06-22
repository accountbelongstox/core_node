/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-void': '#030305',
        'bg-panel': 'rgba(10, 12, 16, 0.85)',
        'cyan': '#00f2ff',
        'cyan-dim': 'rgba(0, 242, 255, 0.15)',
        'purple': '#bd00ff',
        'purple-dim': 'rgba(189, 0, 255, 0.15)',
        'alert': '#ff2a6d',
        'success': '#05ffa1',
        'text-main': '#ffffff',
        'text-muted': 'rgba(255, 255, 255, 0.55)',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
        'sans': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
      backdropBlur: {
        'glass': '20px',
      },
    },
  },
  plugins: [],
}

