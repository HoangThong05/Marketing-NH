// Chặn dò mật khẩu ở trang đăng nhập.
//
// Trang /login nằm công khai trên Internet, mà sau nó là dữ liệu cá nhân của
// hàng trăm khách hàng thật. Không có gì chặn thì một script dò vài nghìn
// mật khẩu phổ biến chạy được cả đêm mà không để lại dấu vết nào.
//
// Chặn theo ĐỊA CHỈ IP chứ không theo tên đăng nhập. Chặn theo tên đăng nhập
// nghe có vẻ chặt hơn, nhưng nó mở ra một kiểu phá hoại còn khó chịu hơn:
// bất kỳ ai cũng khoá được tài khoản của nhân viên thật chỉ bằng cách nhập
// sai mật khẩu vài lần, mà cả hệ thống chỉ có ba người dùng.
import { supabase } from '../supabase.js';
import { bamIPTuRequest } from './ip.js';

/** Số lần sai tối đa từ một IP trước khi bị chặn */
export const SO_LAN_SAI_TOI_DA = 5;

/** Khoảng thời gian tính số lần sai, và cũng là thời gian bị chặn */
export const CUA_SO_PHUT = 15;

const CUA_SO_MS = CUA_SO_PHUT * 60 * 1000;

/**
 * IP này có đang bị chặn không.
 *
 * Cố tình "fail-open": truy vấn hỏng thì cho qua thay vì chặn. Nếu database
 * chết thì bản thân việc đăng nhập cũng chết ở bước đọc bảng users, nên
 * khoảng hở này rất hẹp — trong khi khoá nhầm cả ba nhân viên ra khỏi công
 * cụ làm việc của họ vì một lỗi mạng thì thiệt hại thấy ngay.
 *
 * @returns {Promise<{ chan: boolean, soLanSai: number, ipHash: string }>}
 */
export async function kiemTraChan(req) {
  const ipHash = bamIPTuRequest(req);

  try {
    const moc = new Date(Date.now() - CUA_SO_MS).toISOString();
    const { count, error } = await supabase
      .from('login_fail')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', moc);

    if (error) throw error;

    // Supabase trả 204 với count = null (KHÔNG kèm error) khi bảng chưa tồn
    // tại. Coi null là 0 thì tính năng âm thầm vô hiệu mà không ai biết.
    if (typeof count !== 'number') {
      throw new Error(
        'Không đếm được login_fail — bảng có thể chưa được tạo. ' +
          'Chạy backend/schema.sql trong Supabase SQL Editor.'
      );
    }

    return { chan: count >= SO_LAN_SAI_TOI_DA, soLanSai: count, ipHash };
  } catch (err) {
    console.warn('[chan-dang-nhap] KHÔNG kiểm tra được, tạm cho qua:', err.message);
    return { chan: false, soLanSai: 0, ipHash };
  }
}

/**
 * Ghi lại một lần đăng nhập sai.
 *
 * Không await ở nơi gọi và tự nuốt lỗi — cùng lý do với nhật ký thao tác:
 * ghi log hỏng thì cũng không được làm hỏng luồng chính.
 */
export function ghiLanSai(ipHash, username) {
  supabase
    .from('login_fail')
    .insert([{ ip_hash: ipHash, username: username || null }])
    .then(({ error }) => {
      if (error) console.error('[chan-dang-nhap] Không ghi được:', error.message);
    });
}

/**
 * Xoá lịch sử sai của một IP sau khi đăng nhập đúng.
 *
 * Nhân viên gõ nhầm bốn lần rồi vào được thì lần sau vẫn còn nguyên năm lượt,
 * không phải ngồi đợi hết mười lăm phút mới dám gõ sai thêm lần nữa.
 */
export function xoaLanSai(ipHash) {
  supabase
    .from('login_fail')
    .delete()
    .eq('ip_hash', ipHash)
    .then(({ error }) => {
      if (error) console.error('[chan-dang-nhap] Không xoá được:', error.message);
    });
}
