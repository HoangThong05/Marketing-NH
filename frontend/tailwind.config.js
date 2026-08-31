/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bộ màu thương hiệu OCB
        ocb: {
          green: '#00813D',       // Xanh lá chủ đạo
          'green-dark': '#00622E',
          'green-light': '#E6F2EC',
          orange: '#F47920',      // Cam nhấn
          'orange-dark': '#D4620F',
          'orange-light': '#FEF0E5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        // Hiệu ứng modal / card xuất hiện
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
