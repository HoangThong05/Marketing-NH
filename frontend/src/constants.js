// Hằng số dùng chung cho toàn bộ giao diện.
// Giữ khớp với backend/constants.js.

// Bỏ hạng VIP — xem giải thích ở backend/constants.js
export const PHAN_LOAI_LIST = ['Thường', 'Tiềm năng'];

// Trạng thái chăm sóc, xếp theo tiến trình tự nhiên của một khách hàng.
// Xem giải thích vì sao tách "Không liên lạc được" ở backend/constants.js.
export const TRANG_THAI_LIST = [
  'Mới',
  'Không liên lạc được',
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
};

// Badge phân loại trong bảng
export const PHAN_LOAI_BADGE = {
  'Thường': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'Tiềm năng': 'bg-ocb-orange-light text-ocb-orange-dark ring-ocb-orange/30',
};

// Badge trạng thái chăm sóc.
// Dùng tông xám/xanh/hổ phách/xanh lá/đỏ để phân biệt được cả khi in đen trắng
// nhờ độ đậm nhạt khác nhau, không chỉ dựa vào màu.
export const TRANG_THAI_BADGE = {
  'Mới': 'bg-slate-100 text-slate-700 ring-slate-300',
  'Không liên lạc được': 'bg-violet-50 text-violet-700 ring-violet-200',
  'Đã gọi': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'Hẹn gọi lại': 'bg-amber-50 text-amber-800 ring-amber-300',
  'Chốt': 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
  'Từ chối': 'bg-red-50 text-red-700 ring-red-200',
};

// Mô tả ngắn cho từng kết quả liên hệ, hiện ngay trong ô chọn ở màn hình
// Chăm sóc. Chỉ mỗi cái tên thì rất dễ hiểu nhầm: "Từ chối" đã có người đọc
// thành "khách từ chối cuộc gọi / không bắt máy", trong khi nó có nghĩa là
// khách nghe tư vấn xong rồi mới không quan tâm. Nhầm hai cái đó là đóng hồ
// sơ một khách chưa hề nói chuyện, vĩnh viễn không ai gọi lại nữa.
export const TRANG_THAI_MO_TA = {
  'Không liên lạc được': 'không bắt máy, máy bận, sai số — cần gọi lại',
  'Đã gọi': 'đã nói chuyện được với khách',
  'Hẹn gọi lại': 'khách hẹn dịp khác, phải đặt giờ',
  'Chốt': 'khách đồng ý dùng sản phẩm',
  'Từ chối': 'đã tư vấn xong, khách không quan tâm',
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
  dang_nhap_sai: 'Chặn đăng nhập',
};

export const HANH_DONG_BADGE = {
  tao: 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30',
  sua: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  xoa: 'bg-red-50 text-red-700 ring-red-200',
  lien_he: 'bg-ocb-orange-light text-ocb-orange-dark ring-ocb-orange/30',
  doi_mat_khau: 'bg-amber-50 text-amber-800 ring-amber-300',
  // Đỏ đậm hơn cả 'xoá': đây là dấu hiệu có người ngoài đang dò mật khẩu,
  // lướt qua nhật ký phải đập vào mắt ngay chứ không được lẫn vào đám còn lại.
  dang_nhap_sai: 'bg-red-100 text-red-800 ring-red-300',
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

// Các bậc thu nhập đủ để gợi ý nâng khách lên "Tiềm năng".
// Giữ khớp với backend/constants.js.
//
// Đây là ngưỡng của riêng phòng marketing để chấm mức tiềm năng của một lead,
// KHÔNG phải tiêu chí phân hạng khách hàng ưu tiên của ngân hàng.
// Cố ý không gợi ý lên VIP: hạng VIP phải căn cứ số dư và tài sản thực tế,
// mà thu nhập ở đây do khách tự khai, không có gì đối chiếu.
export const MUC_LUONG_GOI_Y_TIEM_NANG = ['20 - 50 triệu', 'Trên 50 triệu'];

/**
 * Khách này có nên được gợi ý nâng lên "Tiềm năng" không.
 * @param {object} c - bản ghi khách hàng
 */
export const nenNangHang = (c) =>
  c?.phan_loai === 'Thường' && MUC_LUONG_GOI_Y_TIEM_NANG.includes(c?.muc_luong);

// Màu cột trong biểu đồ phễu chăm sóc.
// Tô theo KẾT QUẢ chứ không theo từng trạng thái: ba trạng thái đầu đều là
// "đang xử lý" nên cùng một màu, tên trạng thái đã nằm sẵn ở trục nên không
// cần màu để phân biệt. Chỉ hai kết cục cuối mới cần màu riêng.
// Bộ ba màu này đã kiểm tra đạt cả ngưỡng phân biệt cho người mù màu.
export const TRANG_THAI_MAU = {
  'Mới': '#0284C7',
  'Không liên lạc được': '#0284C7',
  'Đã gọi': '#0284C7',
  'Hẹn gọi lại': '#0284C7',
  'Chốt': '#00813D',
  'Từ chối': '#DC2626',
};

// Thang màu cho biểu đồ thu nhập. Thu nhập là dữ liệu CÓ THỨ TỰ nên dùng
// một tông màu đậm dần thay vì các màu khác nhau — nhìn là thấy ngay bậc nào
// cao hơn bậc nào, kể cả khi in đen trắng.
export const MUC_LUONG_MAU = {
  'Dưới 10 triệu': '#9FD8BC',
  '10 - 20 triệu': '#5FB894',
  '20 - 50 triệu': '#269A66',
  'Trên 50 triệu': '#00813D',
};
