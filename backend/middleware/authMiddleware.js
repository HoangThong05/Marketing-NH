// Middleware xác thực JWT.
// Gắn thông tin user đã giải mã vào req.user để các route phía sau dùng lại.
import jwt from 'jsonwebtoken';

export function authMiddleware(req, res, next) {
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

  try {
    // Ném lỗi nếu token sai chữ ký hoặc đã hết hạn
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, username, role }
    return next();
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : 'Token không hợp lệ.';
    return res.status(401).json({ success: false, message });
  }
}

export default authMiddleware;
