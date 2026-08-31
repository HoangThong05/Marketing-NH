-- Chạy toàn bộ file này trong Supabase SQL Editor.
-- An toàn khi chạy lại nhiều lần (dùng IF NOT EXISTS).

-- ==================================================================
-- 1. Bảng khách hàng
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id SERIAL PRIMARY KEY,
  so_dien_thoai TEXT UNIQUE NOT NULL,
  ten_khach_hang TEXT NOT NULL,
  dia_chi TEXT,
  phan_loai TEXT DEFAULT 'Thường',
  ghi_chu TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================================
-- 2. Bảng tài khoản quản trị
-- ==================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================================================================
-- 3. Index hỗ trợ lọc / sắp xếp ở trang admin
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_customers_phan_loai ON public.customers (phan_loai);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON public.customers (created_at DESC);

-- ==================================================================
-- 4. Bật Row Level Security cho cả hai bảng
-- ==================================================================
-- Bật RLS mà KHÔNG tạo policy nào = chặn hoàn toàn anon key và
-- authenticated key. Chỉ service_role key (bỏ qua RLS) truy cập được.
--
-- Đây chính là kiến trúc của app này: trình duyệt không bao giờ gọi
-- thẳng Supabase, mọi thứ đi qua Express API và được bảo vệ bằng JWT
-- của chúng ta. Vì vậy backend/.env phải dùng service_role key.
--
-- QUAN TRỌNG: service_role key chỉ được để ở backend, tuyệt đối
-- không đưa vào frontend hay commit lên GitHub.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- 5. Nhật ký gửi form, dùng để giới hạn tần suất (rate limit)
-- ==================================================================
-- Chỉ lưu HMAC-SHA256 của địa chỉ IP, không lưu IP gốc, để không
-- giữ dữ liệu định danh người dùng lâu hơn mức cần thiết.
CREATE TABLE IF NOT EXISTS public.submission_log (
  id SERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_log_ip_time
  ON public.submission_log (ip_hash, created_at DESC);

ALTER TABLE public.submission_log ENABLE ROW LEVEL SECURITY;
