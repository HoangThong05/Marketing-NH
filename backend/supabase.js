// Kết nối tới Supabase (PostgreSQL).
// Client này được dùng chung cho toàn bộ backend.
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const { SUPABASE_URL, SUPABASE_KEY } = process.env;

// Dừng ngay từ đầu nếu thiếu cấu hình, tránh lỗi khó hiểu lúc chạy
if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong file backend/.env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Backend không cần lưu session, mỗi request tự xác thực bằng JWT riêng
    persistSession: false,
    autoRefreshToken: false,
  },
});

export default supabase;
