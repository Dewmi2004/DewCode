/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#00D4B8',
        'primary-dark': '#00A896',
        dark: '#0A0A0F',
        'dark-800': '#12121A',
        'dark-700': '#1A1A26',
        'dark-600': '#22222F',
        'dark-500': '#2A2A3A',
        'dark-400': '#3A3A50',
        'text-muted': '#6B7280',
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
    },
  },
  plugins: [],
}