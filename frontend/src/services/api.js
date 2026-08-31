// Cấu hình axios dùng chung cho toàn bộ ứng dụng.
import axios from 'axios';

const TOKEN_KEY = 'ocb_token';
const USER_KEY = 'ocb_user';

/* ------------------------------------------------------------------ */
/* Tiện ích thao tác với localStorage                                   */
/* ------------------------------------------------------------------ */

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);

export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    // Dữ liệu hỏng thì coi như chưa đăng nhập
    return null;
  }
};

export const setUser = (user) =>
  localStorage.setItem(USER_KEY, JSON.stringify(user));

/** Xoá toàn bộ thông tin đăng nhập khỏi trình duyệt */
export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Kiểm tra token còn hạn hay không bằng cách đọc phần payload của JWT.
 * Chỉ dùng để chặn sớm ở phía client; server vẫn luôn tự xác thực lại.
 */
export const isTokenValid = () => {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return true; // Token không có hạn
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/* Axios instance                                                       */
/* ------------------------------------------------------------------ */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Trước mỗi request: tự động gắn JWT vào header Authorization
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Sau mỗi response: token hết hạn thì đăng xuất và đưa về trang login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      // Chỉ chuyển hướng khi đang ở trang cần đăng nhập,
      // tránh làm gián đoạn form công khai ở trang chủ.
      if (window.location.pathname.startsWith('/admin')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Lấy thông báo lỗi thân thiện từ đối tượng lỗi của axios.
 * @param {unknown} error
 * @param {string} fallback - thông báo mặc định khi không đọc được lỗi
 */
export const getErrorMessage = (error, fallback = 'Đã có lỗi xảy ra.') => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.code === 'ECONNABORTED') return 'Yêu cầu quá thời gian chờ.';
  if (error?.message === 'Network Error') {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra backend.';
  }
  return fallback;
};

/* ------------------------------------------------------------------ */
/* Các hàm gọi API                                                      */
/* ------------------------------------------------------------------ */

export const authAPI = {
  login: (payload) => api.post('/auth/login', payload),
  register: (payload) => api.post('/auth/register', payload),
  changePassword: (payload) => api.put('/auth/password', payload),
};

export const customerAPI = {
  getAll: () => api.get('/customers'),
  create: (payload) => api.post('/customers', payload),
  update: (id, payload) => api.put(`/customers/${id}`, payload),
  remove: (id) => api.delete(`/customers/${id}`),
};

export default api;
