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

-- ==================================================================
-- 7. Tài khoản nhân viên và nhật ký thao tác
-- ==================================================================

-- Tên hiển thị và trạng thái hoạt động của tài khoản.
-- Nhân viên nghỉ việc thì đặt active = false chứ KHÔNG xoá, để lịch sử
-- liên hệ và nhật ký thao tác của họ vẫn còn nguyên vẹn.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ho_ten TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

UPDATE public.users SET active = TRUE WHERE active IS NULL;

-- Nhật ký thao tác: ai làm gì, lúc nào. Chỉ ghi thêm, không sửa không xoá.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users (id) ON DELETE SET NULL,
  -- Chụp lại tên tại thời điểm ghi, phòng khi tài khoản bị xoá hẳn
  username TEXT,
  hanh_dong TEXT NOT NULL,
  doi_tuong TEXT NOT NULL,
  doi_tuong_id INTEGER,
  mo_ta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_time
  ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user
  ON public.activity_log (user_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- 8. Chỉ tài khoản gốc mới có quyền quản trị
-- ==================================================================
-- Vai trò 'admin' là cấp cao nhất và chỉ thuộc về tài khoản đầu tiên
-- của hệ thống. Mọi tài khoản khác đều là 'nhan_vien'.
-- Câu lệnh này hạ quyền các tài khoản admin phát sinh thêm (nếu có).
UPDATE public.users
SET role = 'nhan_vien'
WHERE role = 'admin'
  AND id <> (SELECT MIN(id) FROM public.users);

-- ==================================================================
-- 9. Nghề nghiệp và mức thu nhập
-- ==================================================================
-- Hai thông tin nghiệp vụ cơ bản để đánh giá khách hàng: nghề nghiệp
-- quyết định tính ổn định của thu nhập, mức lương quyết định hạn mức
-- sản phẩm mà khách đủ điều kiện.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS nghe_nghiep TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS muc_luong TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_muc_luong
  ON public.customers (muc_luong)
  WHERE muc_luong IS NOT NULL;

-- ==================================================================
-- 10. Bỏ hạng VIP khỏi phân loại
-- ==================================================================
-- Phân loại giờ chỉ còn Thường / Tiềm năng. Hạng khách hàng ưu tiên của
-- ngân hàng căn cứ số dư và tài sản thực tế, không suy ra được từ dữ liệu
-- khách tự khai trên form, nên không thuộc phạm vi công cụ này.
UPDATE public.customers SET phan_loai = 'Tiềm năng' WHERE phan_loai = 'VIP';

-- ==================================================================
-- 11. Nhân viên phụ trách khách hàng
-- ==================================================================
-- ON DELETE SET NULL: xoá tài khoản thì khách quay về trạng thái chưa giao
-- chứ không bị xoá theo. Dù vậy nên KHOÁ tài khoản thay vì xoá — xem mục
-- quản lý tài khoản trong giao diện.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phu_trach_id INTEGER
  REFERENCES public.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_phu_trach
  ON public.customers (phu_trach_id);

-- Lọc nhanh nhóm khách chưa ai nhận
CREATE INDEX IF NOT EXISTS idx_customers_chua_giao
  ON public.customers (created_at DESC)
  WHERE phu_trach_id IS NULL;

-- ==================================================================
-- 12. Xoá mềm khách hàng
-- ==================================================================
-- Xoá khách trước đây là xoá thật, mà contact_history có ON DELETE CASCADE
-- nên toàn bộ lịch sử chăm sóc bị xoá theo, không khôi phục được. Một cú
-- bấm nhầm là mất công sức nhiều tháng.
--
-- Từ giờ xoá chỉ đánh dấu deleted_at; dữ liệu và lịch sử vẫn nguyên vẹn,
-- admin khôi phục lại được. Xoá vĩnh viễn là thao tác riêng, chỉ gọi được
-- từ thùng rác.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- Chụp lại tên người xoá, để nhìn thùng rác là biết ai đã xoá
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Index một phần: chỉ đánh index các dòng CHƯA xoá, vì mọi truy vấn thường
-- ngày đều lọc deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_customers_chua_xoa
  ON public.customers (created_at DESC)
  WHERE deleted_at IS NULL;

-- ==================================================================
-- 13. Chặn dò mật khẩu ở trang đăng nhập
-- ==================================================================

-- Mỗi lần đăng nhập SAI ghi một dòng. Đăng nhập đúng thì xoá sạch dòng của
-- IP đó. Chỉ lưu HMAC-SHA256 của IP, không lưu IP gốc — giống submission_log.
CREATE TABLE IF NOT EXISTS public.login_fail (
  id SERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  -- Tên đăng nhập đã thử, chỉ để nhìn nhật ký biết người ta đang dò cái gì
  username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_fail_ip_time
  ON public.login_fail (ip_hash, created_at DESC);

ALTER TABLE public.login_fail ENABLE ROW LEVEL SECURITY;
