// Chuẩn hoá mức thu nhập nhập tự do về đúng một trong bốn bậc của hệ thống.
// Giữ khớp với backend/lib/mucLuong.js.
//
// File Excel do người dùng tự lập ghi thu nhập theo đủ kiểu: "10-20 triệu",
// "10 - 20tr", "trên 50 triệu/tháng", "15 triệu", thậm chí "15000000".
// Bắt họ gõ khớp từng ký tự với danh sách của hệ thống là không thực tế —
// nhập 100 dòng sẽ có vài chục dòng báo lỗi chỉ vì thiếu một dấu cách.

import { MUC_LUONG_LIST as MUC_LUONG_HOP_LE } from '../constants';

/** Bỏ dấu tiếng Việt: "Dưới" -> "Duoi" */
const boDau = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

/**
 * Xếp một con số (đơn vị triệu đồng) vào đúng bậc.
 * Mốc trùng thì thuộc về bậc có tên chứa nó: 10 -> "10 - 20", 50 -> "20 - 50".
 */
function xepBac(trieu) {
  if (trieu < 10) return 'Dưới 10 triệu';
  if (trieu < 20) return '10 - 20 triệu';
  if (trieu <= 50) return '20 - 50 triệu';
  return 'Trên 50 triệu';
}

/**
 * Đưa chuỗi thu nhập tự do về một trong bốn bậc chuẩn.
 *
 * Hiểu được:
 *   "10 - 20 triệu"        -> 10 - 20 triệu   (đúng chuẩn sẵn)
 *   "10-20tr"              -> 10 - 20 triệu
 *   "10 đến 20 triệu"      -> 10 - 20 triệu
 *   "dưới 10 triệu/tháng"  -> Dưới 10 triệu
 *   "<10tr"                -> Dưới 10 triệu
 *   "trên 50 triệu"        -> Trên 50 triệu
 *   ">50tr"                -> Trên 50 triệu
 *   "15 triệu"             -> 10 - 20 triệu   (một số lẻ thì xếp theo bậc)
 *   "15000000"             -> 10 - 20 triệu   (ghi bằng đồng)
 *
 * @param {unknown} v
 * @returns {string|null} bậc chuẩn, hoặc null nếu không hiểu được
 */
export function chuanHoaMucLuong(v) {
  const goc = String(v ?? '').trim();
  if (!goc) return null;

  // Đúng chuẩn sẵn thì khỏi đoán
  if (MUC_LUONG_HOP_LE.includes(goc)) return goc;

  const chuoi = boDau(goc).toLowerCase();

  // Từ chỉ hướng. Đặt trước bước tách số vì "duoi"/"tren" quyết định
  // con số đơn lẻ nằm ở phía nào của mốc.
  const laDuoi = /(duoi|it hon|toi da|nho hon|<|max)/.test(chuoi);
  const laTren = /(tren|hon|tro len|lon hon|>|min)/.test(chuoi);

  // Tách các con số. Dấu chấm là phân cách hàng nghìn kiểu Việt Nam,
  // dấu phẩy là phân cách thập phân.
  const soThoo = chuoi.replace(/\./g, '').replace(/,/g, '.');
  const cacSo = (soThoo.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (cacSo.length === 0) return null;

  // Ghi bằng đồng thay vì triệu thì quy đổi lại
  const veTrieu = (n) => (n >= 1000 ? n / 1_000_000 : n);
  const so = cacSo.map(veTrieu);

  // Hai con số = một khoảng. Lấy điểm giữa rồi xếp bậc, nhờ vậy cả những
  // khoảng không trùng mốc hệ thống ("15-25 triệu") vẫn xếp được.
  if (so.length >= 2) {
    const [a, b] = so;
    return xepBac((a + b) / 2);
  }

  const n = so[0];

  // Một con số kèm từ chỉ hướng: dịch nhẹ qua mốc để rơi đúng phía.
  // "dưới 10" -> 9.99 -> Dưới 10 triệu.  "trên 50" -> 50.01 -> Trên 50 triệu.
  if (laDuoi) return xepBac(n - 0.01);
  if (laTren) return xepBac(n + 0.01);

  // Một con số trần trụi thì xếp thẳng theo giá trị
  return xepBac(n);
}

export default chuanHoaMucLuong;
