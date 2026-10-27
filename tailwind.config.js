/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nuvio: {
          50: '#f5f7fa',
          100: '#eaeef5',
          200: '#d0daea',
          300: '#a7bcda',
          400: '#7698c4',
          500: '#5379af',
          600: '#3e5f92',
          700: '#334d77',
          800: '#2c4263',
          900: '#283953',
          950: '#0d131d',
          accent: '#3b82f6',
          dark: '#0f172a',
          surface: '#1e293b',
          border: '#334155'
        }
      }
    },
  },
  plugins: [],
}
