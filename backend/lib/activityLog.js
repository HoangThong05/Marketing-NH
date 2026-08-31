// Ghi nhật ký thao tác.
import { supabase } from '../supabase.js';

/**
 * Ghi một dòng nhật ký.
 *
 * Cố ý KHÔNG await ở nơi gọi và tự nuốt lỗi: nhật ký hỏng thì cũng không
 * được làm hỏng thao tác chính của người dùng. Xoá khách thành công mà
 * báo lỗi chỉ vì không ghi được log là hành vi tệ hơn nhiều.
 *
 * @param {object} user - req.user đã giải mã từ JWT
 * @param {object} thongTin
 * @param {string} thongTin.hanh_dong  - tao | sua | xoa | lien_he | ...
 * @param {string} thongTin.doi_tuong  - khach_hang | tai_khoan
 * @param {number} [thongTin.doi_tuong_id]
 * @param {string} [thongTin.mo_ta]
 */
export function ghiNhatKy(user, { hanh_dong, doi_tuong, doi_tuong_id, mo_ta }) {
  supabase
    .from('activity_log')
    .insert([
      {
        user_id: user?.id ?? null,
        username: user?.username ?? null,
        hanh_dong,
        doi_tuong,
        doi_tuong_id: doi_tuong_id ?? null,
        mo_ta: mo_ta ?? null,
      },
    ])
    .then(({ error }) => {
      if (error) console.error('[activity-log] Không ghi được:', error.message);
    });
}

export default ghiNhatKy;
