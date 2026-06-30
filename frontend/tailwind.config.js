/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2CE4C6',
        primaryDark: '#00BFA5',
        background: '#FFFFFF',
        backgroundSoft: '#F7F9FA',
        textDark: '#333333',
        textLight: '#666666',
        borderLight: 'rgba(255,255,255,0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontSize: {
        h1: '2.5rem',
        h2: '2rem',
        body: '1rem',
        small: '0.875rem',
      },
      boxShadow: {
        glass: '0 4px 10px rgba(0,0,0,0.05)',
        glassSoft: '0 2px 6px rgba(0,0,0,0.03)',
      },
      backgroundColor: {
        glass: 'rgba(255,255,255,0.6)',
        glassSoft: 'rgba(255,255,255,0.4)',
      },
      borderColor: {
        glass: 'rgba(255,255,255,0.3)',
        glassSoft: 'rgba(255,255,255,0.2)',
      },
      borderRadius: {
        glass: '1rem',
        glassSoft: '0.75rem',
      },
      backdropBlur: {
        glass: '12px',
        glassSoft: '8px',
      },
    },
  },
  plugins: [],
};