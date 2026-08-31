// Chuẩn hoá số điện thoại. Giữ khớp với backend/lib/dienThoai.js.

/**
 * Đưa số điện thoại về dạng chuẩn bắt đầu bằng số 0.
 *
 * Xử lý mấy kiểu dữ liệu hay gặp khi nhập từ Excel:
 *   "090 123 45 67"   -> "0901234567"
 *   "+84901234567"    -> "0901234567"
 *   "84901234567"     -> "0901234567"
 *   901234567         -> "0901234567"   (Excel đọc thành SỐ, mất số 0 đầu)
 *
 * Trường hợp cuối là lỗi phổ biến nhất: mở file trong Excel rồi lưu lại,
 * ô số điện thoại bị hiểu thành kiểu Number nên số 0 đứng đầu biến mất.
 * Người dùng nhìn file vẫn thấy đúng nên rất khó tự phát hiện.
 */
export function chuanHoaSoDienThoai(v) {
  let s = String(v ?? '').trim();

  s = s.replace(/[\s.\-()]/g, '');
  if (!s) return '';

  if (s.startsWith('+84')) {
    s = '0' + s.slice(3);
  } else if (s.startsWith('84') && s.length === 11) {
    s = '0' + s.slice(2);
  } else if (/^[35789]\d{8}$/.test(s)) {
    // Đúng 9 chữ số, bắt đầu bằng đầu số di động Việt Nam
    // => gần như chắc chắn bị mất số 0 đứng đầu
    s = '0' + s;
  }

  return s;
}

export default chuanHoaSoDienThoai;
