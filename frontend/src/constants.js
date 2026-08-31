// Hằng số dùng chung cho toàn bộ giao diện.
// Giữ khớp với backend/constants.js.

export const PHAN_LOAI_LIST = ['Thường', 'Tiềm năng', 'VIP'];

// Trạng thái chăm sóc, xếp theo tiến trình tự nhiên của một khách hàng
export const TRANG_THAI_LIST = [
  'Mới',
  'Đã gọi',
  'Hẹn gọi lại',
  'Chốt',
  'Từ chối',
];

// Màu gắn với từng phân loại. Màu đi theo phân loại chứ không theo thứ hạng,
// nên khi lọc danh sách thì các cột biểu đồ còn lại vẫn giữ nguyên màu.
export const PHAN_LOAI_MAU = {
  'Thường': '#0284C7',
  'Tiềm năng': '#F47920',
  VIP: '#00813D',
};

// Badge phân loại trong bảng
export const PHAN_LOAI_BADGE = {
  'Thường': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'Tiềm năng': 'bg-ocb-orange-light text-ocb-orange-dark ring-ocb-orange/30',
  VIP: 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
};

// Badge trạng thái chăm sóc.
// Dùng tông xám/xanh/hổ phách/xanh lá/đỏ để phân biệt được cả khi in đen trắng
// nhờ độ đậm nhạt khác nhau, không chỉ dựa vào màu.
export const TRANG_THAI_BADGE = {
  'Mới': 'bg-slate-100 text-slate-700 ring-slate-300',
  'Đã gọi': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'Hẹn gọi lại': 'bg-amber-50 text-amber-800 ring-amber-300',
  'Chốt': 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
  'Từ chối': 'bg-red-50 text-red-700 ring-red-200',
};

// Vai trò tài khoản. Giữ khớp với backend/constants.js.
// 'admin' là cấp cao nhất và CHỈ thuộc về tài khoản gốc của hệ thống.
export const VAI_TRO_NHAN = {
  admin: 'Admin',
  nhan_vien: 'Nhân viên',
};

export const VAI_TRO_BADGE = {
  admin: 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
  nhan_vien: 'bg-sky-50 text-sky-700 ring-sky-600/20',
};

// Nhãn hiển thị cho từng loại hành động trong nhật ký
export const HANH_DONG_NHAN = {
  tao: 'Tạo mới',
  sua: 'Chỉnh sửa',
  xoa: 'Xoá',
  lien_he: 'Liên hệ',
  doi_mat_khau: 'Đổi mật khẩu',
};

export const HANH_DONG_BADGE = {
  tao: 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
  sua: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  xoa: 'bg-red-50 text-red-700 ring-red-200',
  lien_he: 'bg-ocb-orange-light text-ocb-orange-dark ring-ocb-orange/30',
  doi_mat_khau: 'bg-amber-50 text-amber-800 ring-amber-300',
};

export const DOI_TUONG_NHAN = {
  khach_hang: 'Khách hàng',
  tai_khoan: 'Tài khoản',
};

// Nghề nghiệp gợi ý trên form đăng ký. Khách chọn "Khác" thì tự nhập,
// nên đây chỉ là danh sách gợi ý, không phải ràng buộc.
export const NGHE_NGHIEP_GOI_Y = [
  'Nhân viên văn phòng',
  'Công chức, viên chức nhà nước',
  'Kinh doanh, tự doanh',
  'Công nhân',
  'Giáo viên, giảng viên',
  'Bác sĩ, dược sĩ',
  'Kỹ sư, kỹ thuật viên',
  'Lao động tự do',
  'Hưu trí',
  'Sinh viên',
];

// Giá trị đặc biệt cho lựa chọn "Khác" trong ô nghề nghiệp
export const NGHE_NGHIEP_KHAC = '__khac';

// Bậc thu nhập hàng tháng. Giữ khớp với backend/constants.js.
export const MUC_LUONG_LIST = [
  'Dưới 10 triệu',
  '10 - 20 triệu',
  '20 - 50 triệu',
  'Trên 50 triệu',
];

// Badge mức thu nhập, đậm dần theo bậc để nhìn bảng là thấy ngay
export const MUC_LUONG_BADGE = {
  'Dưới 10 triệu': 'bg-slate-100 text-slate-700 ring-slate-300',
  '10 - 20 triệu': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  '20 - 50 triệu': 'bg-ocb-orange-light text-ocb-orange-dark ring-ocb-orange/30',
  'Trên 50 triệu': 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
};
