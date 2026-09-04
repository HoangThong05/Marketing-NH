// Lấy và băm địa chỉ IP của người gửi request.
//
// Tách ra dùng chung cho hai chỗ giới hạn tần suất: form đăng ký công khai
// và trang đăng nhập. Hai nơi phải băm bằng CÙNG một cách, nếu mỗi nơi tự
// viết một kiểu thì cùng một người sẽ ra hai mã băm khác nhau.
import crypto from 'crypto';

/**
 * IP thật của người gửi.
 *
 * Trên Vercel, request đi qua CDN nên IP gốc nằm ở header x-forwarded-for
 * chứ không phải req.ip. Header có thể là chuỗi nhiều IP nối nhau, IP đầu
 * tiên mới là của người dùng.
 */
export function layIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Băm IP bằng HMAC-SHA256 để không lưu địa chỉ IP gốc vào database.
 * Dùng JWT_SECRET làm khoá băm nên không dò ngược ra IP được.
 */
export function bamIP(ip) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'muoi-mac-dinh')
    .update(ip)
    .digest('hex');
}

/** Tiện gọi: lấy IP từ request rồi băm luôn */
export function bamIPTuRequest(req) {
  return bamIP(layIP(req));
}
