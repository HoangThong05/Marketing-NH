// Các giá trị dùng chung giữa nhiều route.

// Phân loại khách hàng
export const PHAN_LOAI_HOP_LE = ['Thường', 'Tiềm năng', 'VIP'];

// Trạng thái chăm sóc, xếp theo tiến trình tự nhiên của một khách hàng
export const TRANG_THAI_HOP_LE = [
  'Mới',
  'Đã gọi',
  'Hẹn gọi lại',
  'Chốt',
  'Từ chối',
];

// Regex số điện thoại Việt Nam (đầu số các nhà mạng hiện hành)
export const PHONE_REGEX =
  /^(0|\+84)(3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])[0-9]{7}$/;

// Vai trò tài khoản. 'admin' là cấp cao nhất và CHỈ thuộc về tài khoản gốc
// (tài khoản đầu tiên của hệ thống). Không tạo thêm admin qua giao diện được.
export const VAI_TRO_HOP_LE = ['admin', 'nhan_vien'];

// Nhãn hiển thị của vai trò
export const VAI_TRO_NHAN = {
  admin: 'Admin',
  nhan_vien: 'Nhân viên',
};

// Nghề nghiệp gợi ý. Danh sách này chỉ để gợi ý trên giao diện —
// backend chấp nhận mọi chuỗi, vì "Khác" cho phép khách tự nhập.
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

// Bậc thu nhập hàng tháng. Chia 4 bậc theo cách phân khúc khách hàng
// thông dụng của ngân hàng: dưới 10 triệu thường chưa đủ điều kiện vay
// tín chấp, trên 50 triệu thuộc nhóm khách hàng ưu tiên.
export const MUC_LUONG_HOP_LE = [
  'Dưới 10 triệu',
  '10 - 20 triệu',
  '20 - 50 triệu',
  'Trên 50 triệu',
];
