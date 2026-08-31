// Chuẩn hoá số điện thoại trước khi kiểm tra.

/**
 * Đưa số điện thoại về dạng chuẩn bắt đầu bằng số 0.
 *
 * Xử lý mấy kiểu dữ liệu hay gặp khi nhập từ Excel:
 *   "090 123 45 67"   -> "0901234567"   (có khoảng trắng, dấu chấm, gạch)
 *   "+84901234567"    -> "0901234567"   (mã quốc gia)
 *   "84901234567"     -> "0901234567"
 *   901234567         -> "0901234567"   (Excel đọc thành SỐ, mất số 0 đầu)
 *
 * Trường hợp cuối là lỗi phổ biến nhất: ô trong Excel chứa 0901234567 nhưng
 * bị định dạng kiểu Number, số 0 đứng đầu bị nuốt mất. Người dùng nhìn file
 * vẫn thấy đúng nên rất khó tự phát hiện.
 *
 * @param {unknown} v
 * @returns {string}
 */
export function chuanHoaSoDienThoai(v) {
  let s = String(v ?? '').trim();

  // Bỏ mọi ký tự trang trí người dùng hay gõ thêm
  s = s.replace(/[\s.\-()]/g, '');
  if (!s) return '';

  if (s.startsWith('+84')) {
    s = '0' + s.slice(3);
  } else if (s.startsWith('84') && s.length === 11) {
    s = '0' + s.slice(2);
  } else if (/^[35789]\d{8}$/.test(s)) {
    // Đúng 9 chữ số và bắt đầu bằng đầu số di động Việt Nam
    // => gần như chắc chắn bị mất số 0 đứng đầu
    s = '0' + s;
  }

  return s;
}

export default chuanHoaSoDienThoai;
