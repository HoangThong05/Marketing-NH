// Route quản lý tài khoản nhân viên. Toàn bộ chỉ dành cho admin.
import express from 'express';
import bcrypt from 'bcryptjs';

import { supabase } from '../supabase.js';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';
import { ghiNhatKy } from '../lib/activityLog.js';

const router = express.Router();

// Mọi route trong file này đều yêu cầu đăng nhập và có quyền admin
router.use(authMiddleware, requireAdmin);

// Các cột được phép trả về. KHÔNG bao giờ trả password_hash ra ngoài.
const COT_AN_TOAN = 'id, username, ho_ten, role, active, created_at';

/** Kiểm tra tên đăng nhập: chữ thường, số, gạch dưới, gạch ngang */
const USERNAME_REGEX = /^[a-z0-9_-]{3,32}$/;

/**
 * GET /api/users
 * Danh sách toàn bộ tài khoản.
 */
router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(COT_AN_TOAN)
      .order('id');

    if (error) throw error;
    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[users/GET]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải danh sách tài khoản.' });
  }
});

/**
 * POST /api/users
 * Tạo tài khoản nhân viên mới.
 */
router.post('/', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const ho_ten = String(req.body?.ho_ten || '').trim() || null;

    // Tài khoản tạo qua giao diện LUÔN là nhân viên.
    // Quyền admin chỉ thuộc về tài khoản gốc, không cấp thêm được.
    const role = 'nhan_vien';

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        success: false,
        message:
          'Tên đăng nhập từ 3 đến 32 ký tự, chỉ gồm chữ thường, số, gạch dưới hoặc gạch ngang.',
      });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    }
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password_hash, ho_ten, role, active: true }])
      .select(COT_AN_TOAN)
      .single();

    if (error) {
      // 23505 = trùng ràng buộc UNIQUE trên cột username
      if (error.code === '23505') {
        return res
          .status(409)
          .json({ success: false, message: 'Tên đăng nhập này đã tồn tại.' });
      }
      throw error;
    }

    ghiNhatKy(req.user, {
      hanh_dong: 'tao',
      doi_tuong: 'tai_khoan',
      doi_tuong_id: data.id,
      mo_ta: `Tạo tài khoản nhân viên "${username}"`,
    });

    return res
      .status(201)
      .json({ success: true, message: 'Đã tạo tài khoản.', data });
  } catch (err) {
    console.error('[users/POST]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tạo tài khoản.' });
  }
});

/**
 * PUT /api/users/:id
 * Sửa họ tên, vai trò hoặc trạng thái hoạt động của một tài khoản.
 */
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const patch = {};
    if (req.body?.ho_ten !== undefined) {
      patch.ho_ten = String(req.body.ho_ten || '').trim() || null;
    }
    // Vai trò cố định, không sửa qua API được. Quyền admin gắn với tài khoản
    // gốc; nâng quyền cho người khác nghĩa là họ khoá được cả chính chủ.
    if (req.body?.role !== undefined) {
      return res.status(400).json({
        success: false,
        message:
          'Không thể thay đổi vai trò. Quyền quản trị chỉ thuộc về tài khoản gốc.',
      });
    }
    if (req.body?.active !== undefined) {
      patch.active = Boolean(req.body.active);
    }

    if (Object.keys(patch).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Không có dữ liệu nào để cập nhật.' });
    }

    // Không cho tự khoá chính mình
    if (id === req.user.id && patch.active === false) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tự khoá tài khoản của chính mình.',
      });
    }

    // Không ai được khoá tài khoản quản trị, kể cả chính nó.
    // Khoá được nghĩa là mất quyền vào hệ thống mà không có đường khôi phục
    // nào ngoài việc sửa tay trong database.
    if (patch.active === false) {
      const { data: muc, error: mucError } = await supabase
        .from('users')
        .select('role')
        .eq('id', id)
        .maybeSingle();

      if (mucError) throw mucError;
      if (muc?.role === 'admin') {
        return res.status(400).json({
          success: false,
          message: 'Không thể khoá tài khoản quản trị.',
        });
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', id)
      .select(COT_AN_TOAN)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    ghiNhatKy(req.user, {
      hanh_dong: 'sua',
      doi_tuong: 'tai_khoan',
      doi_tuong_id: id,
      mo_ta: `Cập nhật tài khoản "${data.username}": ${Object.keys(patch).join(', ')}`,
    });

    return res.json({ success: true, message: 'Đã cập nhật tài khoản.', data });
  } catch (err) {
    console.error('[users/PUT]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể cập nhật tài khoản.' });
  }
});

/**
 * PUT /api/users/:id/password
 * Admin đặt lại mật khẩu cho một tài khoản (dùng khi nhân viên quên mật khẩu).
 * Khác với /api/auth/password: ở đây KHÔNG cần biết mật khẩu cũ.
 */
router.put('/:id/password', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const password = String(req.body?.password || '');
    if (password.length < 8) {
      return res
        .status(400)
        .json({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', id)
      .select(COT_AN_TOAN)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    ghiNhatKy(req.user, {
      hanh_dong: 'doi_mat_khau',
      doi_tuong: 'tai_khoan',
      doi_tuong_id: id,
      mo_ta: `Đặt lại mật khẩu cho "${data.username}"`,
    });

    return res.json({
      success: true,
      message: `Đã đặt lại mật khẩu cho "${data.username}".`,
      data,
    });
  } catch (err) {
    console.error('[users/PUT password]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể đặt lại mật khẩu.' });
  }
});

export default router;
