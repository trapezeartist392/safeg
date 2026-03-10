/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'safeg-orange': '#FF4D00',
        'safeg-teal':   '#00C896',
        'safeg-navy':   '#0C1525',
        'safeg-blue':   '#2D8EFF',
      }
    },
  },
  plugins: [],
}
