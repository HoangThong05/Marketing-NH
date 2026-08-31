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
