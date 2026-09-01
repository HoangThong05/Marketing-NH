// Route đọc nhật ký thao tác. Chỉ admin được xem.
import express from 'express';

import { supabase } from '../supabase.js';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware, requireAdmin);

const SO_DONG_MAC_DINH = 50;
const SO_DONG_TOI_DA = 200;

/**
 * GET /api/activity  (chỉ admin)
 * Nhật ký thao tác, mới nhất lên đầu, có phân trang.
 *
 * Query: page, limit, username, doi_tuong, hanh_dong, tu_ngay, den_ngay
 *
 * Lọc và phân trang đều làm ở đây chứ không phải ở trình duyệt. Bản trước
 * lấy 200 dòng gần nhất rồi lọc phía client — nghĩa là mọi thứ cũ hơn 200
 * dòng đều không có cách nào xem được, kể cả khi lọc đúng điều kiện.
 */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || SO_DONG_MAC_DINH, 1),
      SO_DONG_TOI_DA
    );

    const tu = (page - 1) * limit;
    const den = tu + limit - 1;

    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      // Chốt thêm thứ tự phụ theo id: nhiều thao tác có thể rơi vào cùng
      // một mốc thời gian, không có tiêu chí phụ thì thứ tự giữa các trang
      // có thể đảo, làm một dòng hiện hai lần hoặc biến mất.
      .order('id', { ascending: false })
      .range(tu, den);

    // Lọc theo tên người thực hiện. Dùng username đã chụp lại lúc ghi
    // chứ không phải user_id, để tài khoản đã xoá vẫn tra được.
    const username = String(req.query.username || '').trim();
    if (username) query = query.eq('username', username);

    const doiTuong = String(req.query.doi_tuong || '').trim();
    if (doiTuong) query = query.eq('doi_tuong', doiTuong);

    const hanhDong = String(req.query.hanh_dong || '').trim();
    if (hanhDong) query = query.eq('hanh_dong', hanhDong);

    const tuNgay = String(req.query.tu_ngay || '').trim();
    if (tuNgay) {
      const d = new Date(tuNgay);
      if (!Number.isNaN(d.getTime())) {
        query = query.gte('created_at', d.toISOString());
      }
    }

    const denNgay = String(req.query.den_ngay || '').trim();
    if (denNgay) {
      const d = new Date(denNgay);
      if (!Number.isNaN(d.getTime())) {
        // Tính hết cả ngày đó
        d.setDate(d.getDate() + 1);
        query = query.lt('created_at', d.toISOString());
      }
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const total = count || 0;
    return res.json({
      success: true,
      data: data || [],
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error('[activity/GET]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải nhật ký thao tác.' });
  }
});

/**
 * GET /api/activity/nguoi-thuc-hien  (chỉ admin)
 * Danh sách tên người từng có thao tác trong nhật ký, để đổ vào ô lọc.
 * Lấy riêng thay vì suy ra từ trang đang xem — nếu suy ra thì ô lọc chỉ
 * có tên của những người xuất hiện trong đúng trang đó.
 */
router.get('/nguoi-thuc-hien', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('username')
      .not('username', 'is', null)
      .limit(5000);

    if (error) throw error;

    const ten = [...new Set((data || []).map((r) => r.username))].sort();
    return res.json({ success: true, data: ten });
  } catch (err) {
    console.error('[activity/nguoi-thuc-hien]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải danh sách người dùng.' });
  }
});

export default router;
