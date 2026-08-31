// Middleware xác thực JWT.
// Gắn thông tin user vào req.user để các route phía sau dùng lại.
import jwt from 'jsonwebtoken';
import { supabase } from '../supabase.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';

  // Header phải có dạng: "Bearer <token>"
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.',
    });
  }

  const token = header.slice(7).trim();

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
  }

  let payload;
  try {
    // Ném lỗi nếu token sai chữ ký hoặc đã hết hạn
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : 'Token không hợp lệ.';
    return res.status(401).json({ success: false, message });
  }

  // Token hợp lệ không có nghĩa là tài khoản còn dùng được.
  // Vai trò và trạng thái khoá nằm trong token từ lúc đăng nhập, mà token
  // sống 8 tiếng — nếu chỉ tin token thì khoá một nhân viên xong họ vẫn
  // dùng tiếp được cả buổi. Nên phải đối chiếu lại với database.
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, active')
      .eq('id', payload.id)
      .maybeSingle();

    if (error) throw error;

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_GONE',
        message: 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.',
      });
    }

    if (user.active === false) {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        message: 'Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.',
      });
    }

    // Dùng dữ liệu tươi từ database chứ không dùng dữ liệu trong token,
    // nhờ vậy nâng hoặc hạ quyền cũng có hiệu lực ngay, không đợi đăng nhập lại.
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    return next();
  } catch (err) {
    // Trường hợp riêng: code đã lên nhưng schema.sql chưa được chạy nên
    // chưa có cột `active`. Nếu cũng từ chối luôn thì cả trang quản trị
    // chết cho tới khi ai đó chạy SQL. Tạm lùi về cách cũ (tin token) —
    // đúng bằng mức an toàn của bản trước đó, kèm cảnh báo rõ trong log.
    const thieuCot = err?.code === '42703' || err?.code === 'PGRST204';
    if (thieuCot) {
      console.warn(
        '[authMiddleware] Thiếu cột users.active — tạm dùng dữ liệu trong token. ' +
          'Chạy backend/schema.sql trong Supabase SQL Editor để bật kiểm tra tức thì.'
      );
      req.user = {
        id: payload.id,
        username: payload.username,
        role: payload.role,
      };
      return next();
    }

    console.error('[authMiddleware] Không đối chiếu được tài khoản:', err.message);
    // Cố tình "fail-closed": không xác minh được thì từ chối.
    // Ngược với rate limit của form công khai — ở đây là cổng bảo mật,
    // cho qua khi nghi ngờ thì nguy hiểm hơn nhiều so với chặn nhầm.
    return res.status(503).json({
      success: false,
      message: 'Không xác thực được lúc này. Vui lòng thử lại.',
    });
  }
}

/**
 * Chỉ cho phép tài khoản có vai trò admin đi tiếp.
 * Luôn đặt SAU authMiddleware, vì nó đọc req.user do middleware kia gắn vào.
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền thực hiện thao tác này.',
    });
  }
  return next();
}

export default authMiddleware;
