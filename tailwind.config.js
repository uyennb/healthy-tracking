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
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        protein: '#3b82f6', // Bright Blue
        carbs: '#f59e0b',   // Amber / Orange
        fats: '#ec4899',    // Pink / Red
        fiber: '#10b981',   // Emerald Green
        caloIn: '#6366f1',  // Indigo
        caloOut: '#f43f5e', // Rose
        workout: '#8b5cf6', // Violet
      }
    },
  },
  plugins: [],
}
