// Route xác thực: đăng nhập và tạo tài khoản admin đầu tiên.
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';

const router = express.Router();

// Thời hạn của token đăng nhập
const TOKEN_EXPIRES_IN = '8h';

/**
 * Sinh JWT từ bản ghi user trong database.
 * Chỉ đưa các trường không nhạy cảm vào payload.
 */
function createToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register
 * Tạo tài khoản admin. Chỉ dùng được MỘT LẦN: khi bảng users còn trống.
 * Sau khi đã có tài khoản, endpoint này bị khoá để tránh người lạ tự tạo admin.
 */
router.post('/register', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    // Kiểm tra dữ liệu đầu vào
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
      });
    }
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Tên đăng nhập phải có ít nhất 3 ký tự.',
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự.',
      });
    }

    // Chỉ cho phép đăng ký khi chưa có tài khoản nào
    const { count, error: countError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (countError) throw countError;

    if (count && count > 0) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản quản trị đã tồn tại. Không thể đăng ký thêm.',
      });
    }

    // Băm mật khẩu trước khi lưu, không bao giờ lưu mật khẩu gốc
    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password_hash, role: 'admin' }])
      .select('id, username, role, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản quản trị thành công.',
      token: createToken(data),
      user: data,
    });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tạo tài khoản. Vui lòng thử lại.',
    });
  }
});

/**
 * POST /api/auth/login
 * Đăng nhập bằng username + password, trả về JWT token.
 */
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
      });
    }

    // maybeSingle() trả về null thay vì lỗi khi không tìm thấy user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, role')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;

    // Trả cùng một thông báo cho cả hai trường hợp sai tên và sai mật khẩu,
    // để không tiết lộ tài khoản nào đang tồn tại.
    const invalid = {
      success: false,
      message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
    };

    if (!user) return res.status(401).json(invalid);

    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) return res.status(401).json(invalid);

    return res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      token: createToken(user),
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống. Vui lòng thử lại.',
    });
  }
});

export default router;
