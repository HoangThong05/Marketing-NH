// Khai báo router của ứng dụng.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import CustomerForm from './pages/CustomerForm';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { LoadingBlock } from './components/Spinner';
import { isTokenValid } from './services/api';

// Trang Admin kéo theo recharts và xlsx, cộng lại gần 800 KB.
// Tách ra thành gói riêng để khách vào trang đăng ký (trang công khai,
// lượt truy cập nhiều nhất) không phải tải phần mã họ không bao giờ dùng.
const Admin = lazy(() => import('./pages/Admin'));

/**
 * Địa chỉ không khớp route nào.
 *
 * Người đang đăng nhập thì đưa về khu làm việc, không phải trang chủ: trang
 * chủ là form đăng ký dành cho khách, nhân viên gõ sai địa chỉ mà rơi vào đó
 * sẽ tưởng mình vừa bị đăng xuất.
 *
 * Tách thành component riêng để chỉ kiểm tra token khi thật sự khớp vào đây,
 * chứ không chạy lại sau mỗi lần vẽ toàn bộ ứng dụng.
 */
function DuongDanLa() {
  return <Navigate to={isTokenValid() ? '/lam-viec' : '/'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Toast dùng chung cho mọi trang */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1e293b',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '10px',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#00813D', secondary: '#fff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />

      <Routes>
        {/* Trang công khai - khách hàng tự điền thông tin */}
        <Route path="/" element={<CustomerForm />} />

        {/* Trang đăng nhập cho nhân viên */}
        <Route path="/login" element={<Login />} />

        {/* Khu làm việc - bắt buộc đăng nhập, tải theo yêu cầu.
            Mỗi mục trong sidebar là một địa chỉ con, để nút Back của trình
            duyệt quay đúng về mục trước, F5 ở lại đúng chỗ, và gửi được cho
            đồng nghiệp đường dẫn trỏ thẳng vào một màn hình cụ thể. */}
        <Route
          path="/lam-viec/:muc?"
          element={
            <ProtectedRoute>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-slate-50">
                    <LoadingBlock label="Đang mở trang quản trị..." />
                  </div>
                }
              >
                <Admin />
              </Suspense>
            </ProtectedRoute>
          }
        />

        {/* Địa chỉ cũ: giữ lại để dấu trang và link đã gửi đi không hỏng.
            Tên "admin" là di sản từ lúc app mới chỉ có bảng điều khiển cho
            quản trị viên — giờ nhân viên cũng vào đây, gọi là "admin" dễ làm
            họ tưởng mình đang vào nhầm chỗ hoặc đang có quyền quản trị. */}
        <Route path="/admin" element={<Navigate to="/lam-viec" replace />} />
        <Route path="/admin/*" element={<Navigate to="/lam-viec" replace />} />

        {/* Đường dẫn lạ: tuỳ đang đăng nhập hay không mà đưa về đúng chỗ */}
        <Route path="*" element={<DuongDanLa />} />
      </Routes>
    </BrowserRouter>
  );
}
