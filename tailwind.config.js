/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36aef8',
          500: '#0c93e7',
          600: '#0275c5',
          700: '#035da2',
          800: '#074f85',
          900: '#0c426e',
          950: '#082a48',
        },
      },
    },
  },
  plugins: [],
}
