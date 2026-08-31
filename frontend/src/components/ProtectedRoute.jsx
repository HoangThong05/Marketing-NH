// Bọc các trang chỉ dành cho người đã đăng nhập.
// Chưa có token hợp lệ trong localStorage thì đá về /login.
import { Navigate, useLocation } from 'react-router-dom';
import { isTokenValid, clearAuth } from '../services/api';

export default function ProtectedRoute({ children }) {
  const location = useLocation();

  if (!isTokenValid()) {
    // Dọn sạch token cũ đã hết hạn để lần sau không phải kiểm tra lại
    clearAuth();
    // state.from giúp sau khi đăng nhập quay lại đúng trang đang muốn vào
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}
