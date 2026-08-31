// Cấu hình Express, CORS và gắn các route.
//
// File này phục vụ hai môi trường:
//   - Local: tự gọi app.listen() ở cuối file.
//   - Vercel: không listen, mà export app cho serverless function
//     ở backend/api/index.js dùng lại.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Danh sách origin được phép gọi API (đọc từ .env, cách nhau bằng dấu phẩy).
// Mỗi mục có thể chứa dấu * để khớp nhiều tên miền,
// ví dụ: https://*.vercel.app khớp mọi bản preview của Vercel.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Thoát các ký tự đặc biệt để ghép vào biểu thức chính quy */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Kiểm tra một origin có nằm trong danh sách cho phép không */
function isAllowedOrigin(origin) {
  return allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;

    // Mục có dấu * thì đổi thành biểu thức chính quy
    if (allowed.includes('*')) {
      const pattern = `^${allowed.split('*').map(escapeRegex).join('.*')}$`;
      return new RegExp(pattern).test(origin);
    }

    return allowed === origin;
  });
}

app.use(
  cors({
    origin(origin, callback) {
      // Cho phép request không có origin (Postman, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);

      // Origin lạ: không gắn header CORS thay vì ném lỗi.
      // Trình duyệt vẫn chặn y hệt, nhưng server trả về phản hồi sạch
      // thay vì 500 kèm stack trace làm bẩn log.
      return callback(null, false);
    },
  })
);

// Đọc body dạng JSON
app.use(express.json());

// Ghi log ngắn gọn từng request, tiện theo dõi khi phát triển
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Kiểm tra server còn sống
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Server đang chạy', time: new Date() });
});

// Các nhóm route chính
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);

// Không khớp route nào
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`,
  });
});

// Bắt mọi lỗi chưa được xử lý ở tầng trên
app.use((err, _req, res, _next) => {
  console.error('[Lỗi không xử lý]', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Lỗi hệ thống.',
  });
});

// Trên Vercel, mỗi request do serverless function xử lý nên không mở cổng.
// Biến VERCEL được Vercel tự đặt sẵn trong môi trường chạy.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    console.log(`CORS cho phép: ${allowedOrigins.join(', ')}`);
  });
}

export default app;
