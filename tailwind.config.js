/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
      "content/**/*.md",
      "./themes/pehtheme-hugo/**/*.{html,js}"
    ],
  theme: {
    extend: {
      fontFamily: {
            sans: ['Overpass', 'sans-serif'],
          },
    },
  },
  plugins: [
    require('@tailwindcss/typography')
    ],
}