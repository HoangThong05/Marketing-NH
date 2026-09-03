// Các giá trị dùng chung giữa nhiều route.

// Phân loại khách hàng
// Bỏ hạng VIP: hạng khách hàng ưu tiên của ngân hàng căn cứ số dư và
// tài sản thực tế, không thuộc phạm vi một công cụ thu thập lead.
// Ở đây phân loại chỉ nói lên mức tiềm năng của một lead marketing.
export const PHAN_LOAI_HOP_LE = ['Thường', 'Tiềm năng'];

// Trạng thái chăm sóc, xếp theo tiến trình tự nhiên của một khách hàng.
//
// "Không liên lạc được" tách riêng khỏi "Đã gọi": gọi mà khách không bắt máy
// thì vẫn PHẢI gọi lại, còn "Đã gọi" là đã tư vấn xong. Gộp hai cái vào một
// thì không lọc ra được nhóm cần gọi lần hai — mà lúc mới nhận danh sách thì
// đó lại là nhóm đông nhất.
//
// Nó cũng khác "Từ chối": "Từ chối" là khách đã nghe tư vấn rồi mới không
// quan tâm, tức là đóng hồ sơ. Xếp nhầm một khách chỉ vì đang bận không nghe
// máy vào "Từ chối" là mất hẳn khách đó, không ai gọi lại nữa.
export const TRANG_THAI_HOP_LE = [
  'Mới',
  'Không liên lạc được',
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

// Các bậc thu nhập đủ để gợi ý nâng khách lên "Tiềm năng".
//
// Đây là ngưỡng của riêng phòng marketing để chấm mức tiềm năng của một
// lead, KHÔNG phải tiêu chí phân hạng khách hàng ưu tiên của ngân hàng.
// Sửa danh sách này là đổi được ngưỡng gợi ý.
//
// Cố ý không gợi ý lên VIP: hạng VIP phải căn cứ số dư và tài sản thực tế
// tại ngân hàng, mà thu nhập ở đây do khách tự khai, không có gì đối chiếu.
export const MUC_LUONG_GOI_Y_TIEM_NANG = ['20 - 50 triệu', 'Trên 50 triệu'];
