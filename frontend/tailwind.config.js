/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        plex: {
          yellow: '#E5A00D',
          orange: '#CC7B19',
          dark: '#1F1F1F',
          darker: '#121212',
        },
      },
    },
  },
  plugins: [],
}
