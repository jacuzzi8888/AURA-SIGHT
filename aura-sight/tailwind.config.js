/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          primary: "#FF4D00", // Vibrant Safety Orange
          secondary: "#00E0FF", // High-visibility Cyan
          accent: "#7000FF", // Impact Purple
          dark: "#0A0A0A", // Premium Deep Black
          light: "#F5F5F5",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
