// Cấu hình axios dùng chung cho toàn bộ ứng dụng.
import axios from 'axios';

const TOKEN_KEY = 'ocb_token';
const USER_KEY = 'ocb_user';
// Lý do bị đăng xuất, để trang login còn hiện thông báo cho người dùng biết
const LOGOUT_REASON_KEY = 'ocb_logout_reason';

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
    // Các endpoint /auth/* tự trả 401 cho những lý do KHÔNG phải hết hạn token
    // (sai mật khẩu khi đăng nhập chẳng hạn). Đá người dùng ra trang login
    // trong những trường hợp đó sẽ nuốt mất thông báo lỗi, nên bỏ qua chúng.
    const laAuthRequest = (error.config?.url || '').includes('/auth/');

    if (error.response?.status === 401 && !laAuthRequest) {
      clearAuth();
      // Chỉ chuyển hướng khi đang ở trang cần đăng nhập,
      // tránh làm gián đoạn form công khai ở trang chủ.
      if (window.location.pathname.startsWith('/admin')) {
        // Chuyển trang bằng window.location sẽ xoá sạch toast đang hiện,
        // nên gửi lý do sang trang login qua sessionStorage để hiện lại ở đó.
        const message = error.response?.data?.message;
        if (message) {
          try {
            sessionStorage.setItem(LOGOUT_REASON_KEY, message);
          } catch {
            // Trình duyệt chặn sessionStorage thì bỏ qua, không đáng để vỡ luồng
          }
        }
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
  // Hồ sơ của chính người đang đăng nhập
  getProfile: () => api.get('/auth/toi'),
  updateProfile: (payload) => api.put('/auth/toi', payload),
};

export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getStats: () => api.get('/customers/stats'),
  // Báo cáo theo nhân viên (chỉ admin). Gửi kèm mốc đầu ngày tính theo
  // giờ MÁY NGƯỜI DÙNG, vì máy chủ Vercel chạy giờ UTC.
  baoCaoNhanVien: () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return api.get('/customers/bao-cao-nhan-vien', {
      params: { hom_nay_tu: d.toISOString() },
    });
  },
  // Lấy toàn bộ dữ liệu khớp bộ lọc (không phân trang) để xuất Excel
  exportAll: (params) => api.get('/customers/export', { params }),
  importRows: (payload) => api.post('/customers/import', payload),
  setPhuTrach: (id, phu_trach_id) =>
    api.put(`/customers/${id}/phu-trach`, { phu_trach_id }),
  // Lịch sử liên hệ của một khách hàng
  getContacts: (id) => api.get(`/customers/${id}/contacts`),
  addContact: (id, payload) => api.post(`/customers/${id}/contacts`, payload),
  create: (payload) => api.post('/customers', payload),
  update: (id, payload) => api.put(`/customers/${id}`, payload),
  // Xoá mềm: chuyển vào thùng rác, khôi phục lại được
  remove: (id) => api.delete(`/customers/${id}`),
  khoiPhuc: (id) => api.put(`/customers/${id}/khoi-phuc`),
  xoaVinhVien: (id) => api.delete(`/customers/${id}/vinh-vien`),
};

export const userAPI = {
  getAll: () => api.get('/users'),
  // Danh bạ rút gọn, nhân viên thường cũng gọi được
  danhBa: () => api.get('/users/danh-ba'),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.put(`/users/${id}`, payload),
  resetPassword: (id, password) => api.put(`/users/${id}/password`, { password }),
};

export const activityAPI = {
  getAll: (params) => api.get('/activity', { params }),
  // Danh sách tên người từng thao tác, để đổ vào ô lọc
  nguoiThucHien: () => api.get('/activity/nguoi-thuc-hien'),
};

/**
 * Lấy và xoá lý do bị đăng xuất lần trước (nếu có).
 * Đọc một lần rồi xoá, để tải lại trang login không hiện lại thông báo cũ.
 */
export const takeLogoutReason = () => {
  try {
    const reason = sessionStorage.getItem(LOGOUT_REASON_KEY);
    if (reason) sessionStorage.removeItem(LOGOUT_REASON_KEY);
    return reason;
  } catch {
    return null;
  }
};

/** Tài khoản đang đăng nhập có phải quản trị viên không */
export const isAdmin = () => getUser()?.role === 'admin';

export default api;
