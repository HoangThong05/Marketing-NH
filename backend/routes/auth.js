// Route xác thực: đăng nhập và tạo tài khoản admin đầu tiên.
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { ghiNhatKy } from '../lib/activityLog.js';

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
      .select('id, username, password_hash, role, ho_ten, active')
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

    // Tài khoản bị khoá (nhân viên nghỉ việc) thì không cho vào nữa.
    // Kiểm tra SAU khi đã đối chiếu mật khẩu, để người ngoài không dò được
    // tài khoản nào tồn tại chỉ bằng cách xem thông báo khác nhau.
    if (user.active === false) {
      return res.status(403).json({
        success: false,
        message: 'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên.',
      });
    }

    return res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      token: createToken(user),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        ho_ten: user.ho_ten || null,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống. Vui lòng thử lại.',
    });
  }
});

/**
 * PUT /api/auth/password  (cần đăng nhập)
 * Đổi mật khẩu của chính tài khoản đang đăng nhập.
 *
 * Bắt nhập lại mật khẩu hiện tại để nếu ai đó mượn được máy đang mở sẵn
 * phiên đăng nhập thì vẫn không tự đổi mật khẩu chiếm tài khoản được.
 */
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const current = String(req.body?.current_password || '');
    const next = String(req.body?.new_password || '');

    if (!current || !next) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.',
      });
    }
    if (next.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
      });
    }
    if (next === current) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    const matched = await bcrypt.compare(current, user.password_hash);
    if (!matched) {
      // Dùng 403 chứ KHÔNG dùng 401: người dùng vẫn đang đăng nhập hợp lệ,
      // chỉ là nhập sai mật khẩu cũ. Trả 401 sẽ bị frontend hiểu nhầm là
      // token hết hạn và đá thẳng ra trang đăng nhập.
      return res
        .status(403)
        .json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }

    const password_hash = await bcrypt.hash(next, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.json({
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
    });
  } catch (err) {
    console.error('[auth/password]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể đổi mật khẩu. Vui lòng thử lại.',
    });
  }
});

/**
 * GET /api/auth/toi  (cần đăng nhập)
 * Hồ sơ của chính người đang đăng nhập.
 *
 * Lấy từ database chứ không đọc từ token: token được ký lúc đăng nhập nên
 * không phản ánh thay đổi sau đó. Mở hồ sơ ra phải thấy dữ liệu hiện tại.
 */
router.get('/toi', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, ho_ten, role, created_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[auth/toi]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải hồ sơ.' });
  }
});

/**
 * PUT /api/auth/toi  (cần đăng nhập)
 * Tự sửa hồ sơ của mình. Hiện chỉ đổi được họ tên hiển thị.
 *
 * Cố ý KHÔNG cho đổi:
 *   - username : là định danh đăng nhập, đổi sẽ làm rối nhật ký cũ vì
 *                nhật ký lưu tên tại thời điểm ghi
 *   - role     : nâng quyền cho chính mình thì phân quyền thành vô nghĩa
 *   - active   : tự mở khoá cho mình thì việc khoá tài khoản thành vô dụng
 *
 * Ba trường đó chỉ admin đổi được, qua /api/users.
 */
router.put('/toi', authMiddleware, async (req, res) => {
  try {
    if (req.body?.username !== undefined) {
      return res.status(400).json({
        success: false,
        message: 'Không đổi được tên đăng nhập. Liên hệ quản trị viên nếu cần.',
      });
    }
    if (req.body?.role !== undefined || req.body?.active !== undefined) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền tự đổi vai trò hoặc trạng thái tài khoản.',
      });
    }

    if (req.body?.ho_ten === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'Không có dữ liệu nào để cập nhật.' });
    }

    const hoTen = String(req.body.ho_ten || '').trim();
    if (hoTen.length > 100) {
      return res
        .status(400)
        .json({ success: false, message: 'Họ tên không được quá 100 ký tự.' });
    }
    if (hoTen && hoTen.length < 2) {
      return res
        .status(400)
        .json({ success: false, message: 'Họ tên phải có ít nhất 2 ký tự.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ ho_ten: hoTen || null })
      .eq('id', req.user.id)
      .select('id, username, ho_ten, role, created_at')
      .single();

    if (error) throw error;

    ghiNhatKy(req.user, {
      hanh_dong: 'sua',
      doi_tuong: 'tai_khoan',
      doi_tuong_id: req.user.id,
      mo_ta: `Tự đổi họ tên hiển thị thành "${hoTen || '(để trống)'}"`,
    });

    return res.json({
      success: true,
      message: 'Đã cập nhật hồ sơ.',
      data,
    });
  } catch (err) {
    console.error('[auth/toi PUT]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể cập nhật hồ sơ.' });
  }
});

export default router;
