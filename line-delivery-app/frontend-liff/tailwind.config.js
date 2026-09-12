/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        line: '#1DB446',
        'line-hover': '#16993a'
      }
    },
  },
  plugins: [],
}
