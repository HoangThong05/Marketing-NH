/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bộ màu thương hiệu VietinBank, lấy từ chính file logo.
        //
        // Xanh dương là màu chủ đạo: nút, sidebar, viền khi focus.
        // Đỏ chỉ dùng điểm xuyết (logo, vạch gradient, badge nhỏ) chứ KHÔNG
        // dùng cho nút hành động — trong app này đỏ đã mang nghĩa xoá và từ
        // chối, để nút "Nhận khách" màu đỏ là mời người ta bấm nhầm.
        vtb: {
          blue: '#0B5EA8',
          'blue-dark': '#08477E',
          'blue-light': '#E7F0F9',
          red: '#D8093C',
          'red-dark': '#A80730',
          'red-light': '#FCE8ED',
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
