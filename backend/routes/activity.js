// Route đọc nhật ký thao tác. Chỉ admin được xem.
import express from 'express';

import { supabase } from '../supabase.js';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware, requireAdmin);

// Trần số bản ghi trả về một lần, tránh kéo cả chục nghìn dòng về trình duyệt
const GIOI_HAN_MAC_DINH = 100;
const GIOI_HAN_TOI_DA = 500;

/**
 * GET /api/activity
 * Nhật ký thao tác, mới nhất lên đầu.
 * Tuỳ chọn: ?limit= &user_id= &doi_tuong=
 */
router.get('/', async (req, res) => {
  try {
    let limit = Number(req.query.limit) || GIOI_HAN_MAC_DINH;
    limit = Math.min(Math.max(limit, 1), GIOI_HAN_TOI_DA);

    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    const userId = Number(req.query.user_id);
    if (Number.isInteger(userId) && userId > 0) {
      query = query.eq('user_id', userId);
    }

    const doiTuong = String(req.query.doi_tuong || '').trim();
    if (doiTuong) {
      query = query.eq('doi_tuong', doiTuong);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[activity/GET]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải nhật ký thao tác.' });
  }
});

export default router;
