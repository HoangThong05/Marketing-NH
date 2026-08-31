// Tiện ích xử lý tiếng Việt có dấu.

/**
 * Bỏ dấu một chuỗi tiếng Việt: "Hoàng" -> "Hoang", "Đức" -> "Duc".
 * Dùng NFD để tách nguyên âm khỏi dấu thanh rồi xoá phần dấu.
 * Riêng đ/Đ không phải nguyên âm + dấu nên phải thay tay.
 */
export function boDau(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Mỗi chữ cái gốc ứng với tất cả biến thể có dấu của nó.
// Chỉ cần chữ thường vì phép so khớp dùng toán tử không phân biệt hoa thường.
const NHOM_KY_TU = {
  a: 'aáàảãạăắằẳẵặâấầẩẫậ',
  e: 'eéèẻẽẹêếềểễệ',
  i: 'iíìỉĩị',
  o: 'oóòỏõọôốồổỗộơớờởỡợ',
  u: 'uúùủũụưứừửữự',
  y: 'yýỳỷỹỵ',
  d: 'dđ',
};

/** Thoát các ký tự có ý nghĩa đặc biệt trong biểu thức chính quy */
const thoatRegex = (ch) => ch.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

/**
 * Dựng biểu thức chính quy tìm kiếm bỏ qua dấu.
 *
 * "hoang" -> "[hH][oóòỏõọ...][aáàả...][nN][gG]" (rút gọn), khớp cả "Hoàng".
 * Nhờ vậy người dùng gõ không dấu vẫn tìm ra, mà gõ có dấu cũng vẫn đúng
 * vì chuỗi nhập được bỏ dấu trước khi dựng biểu thức.
 *
 * Lưu ý: so khớp bằng biểu thức chính quy nên Postgres không dùng được index,
 * phải quét toàn bảng. Ở quy mô vài nghìn khách hàng thì không đáng kể; nếu
 * sau này lên hàng trăm nghìn thì cần thêm cột tên đã bỏ dấu kèm index.
 *
 * @param {string} tuKhoa
 * @returns {string} biểu thức chính quy, chưa neo đầu cuối
 */
export function taoRegexBoDau(tuKhoa) {
  return boDau(tuKhoa)
    .toLowerCase()
    .split('')
    .map((ch) => (NHOM_KY_TU[ch] ? `[${NHOM_KY_TU[ch]}]` : thoatRegex(ch)))
    .join('');
}

export default { boDau, taoRegexBoDau };
