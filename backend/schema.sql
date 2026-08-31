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

-- ==================================================================
-- 6. Chăm sóc khách hàng: trạng thái + lịch sử liên hệ
-- ==================================================================

-- Trạng thái hiện tại và lịch hẹn gọi lại, lưu thẳng trên customers
-- để lọc và hiển thị danh sách nhanh, không phải join mỗi lần.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS trang_thai TEXT DEFAULT 'Mới';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS hen_goi_lai TIMESTAMPTZ;

-- Khách cũ tạo trước khi có cột này thì gán mặc định
UPDATE public.customers SET trang_thai = 'Mới' WHERE trang_thai IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_trang_thai
  ON public.customers (trang_thai);
CREATE INDEX IF NOT EXISTS idx_customers_hen_goi_lai
  ON public.customers (hen_goi_lai)
  WHERE hen_goi_lai IS NOT NULL;

-- Nhật ký từng lần liên hệ. Chỉ ghi thêm, không sửa, để giữ được
-- toàn bộ diễn biến chăm sóc một khách hàng.
CREATE TABLE IF NOT EXISTS public.contact_history (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL
    REFERENCES public.customers (id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES public.users (id) ON DELETE SET NULL,
  -- Chụp lại tên người thực hiện tại thời điểm ghi, để sau này xoá
  -- tài khoản thì lịch sử vẫn còn biết ai đã liên hệ
  username TEXT,
  trang_thai TEXT NOT NULL,
  ket_qua TEXT,
  hen_goi_lai TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_history_customer
  ON public.contact_history (customer_id, created_at DESC);

ALTER TABLE public.contact_history ENABLE ROW LEVEL SECURITY;
