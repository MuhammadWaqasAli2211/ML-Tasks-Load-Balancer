/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#030712', // tailwind gray-950
        cardBg: '#111827', // tailwind gray-900
        borderBg: '#1f2937', // tailwind gray-800
      }
    },
  },
  plugins: [],
}
