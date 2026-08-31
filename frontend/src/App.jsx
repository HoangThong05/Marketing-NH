// Khai báo router của ứng dụng.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import CustomerForm from './pages/CustomerForm';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { LoadingBlock } from './components/Spinner';

// Trang Admin kéo theo recharts và xlsx, cộng lại gần 800 KB.
// Tách ra thành gói riêng để khách vào trang đăng ký (trang công khai,
// lượt truy cập nhiều nhất) không phải tải phần mã họ không bao giờ dùng.
const Admin = lazy(() => import('./pages/Admin'));

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

        {/* Trang quản trị - bắt buộc đăng nhập, tải theo yêu cầu */}
        <Route
          path="/admin"
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

        {/* Đường dẫn lạ thì đưa về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
