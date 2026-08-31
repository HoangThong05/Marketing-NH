// Route quản lý khách hàng.
// POST là public (form khách tự điền), các thao tác còn lại yêu cầu đăng nhập.
import express from 'express';
import crypto from 'crypto';
import { supabase } from '../supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  PHAN_LOAI_HOP_LE,
  TRANG_THAI_HOP_LE,
  PHONE_REGEX,
} from '../constants.js';

const router = express.Router();


/* ------------------------------------------------------------------ */
/* Giới hạn tần suất gửi form công khai                                 */
/* ------------------------------------------------------------------ */

// Số lần gửi thành công tối đa từ một IP trong một giờ
const GIOI_HAN_MOI_GIO = 5;
const MOT_GIO_MS = 60 * 60 * 1000;

/**
 * Lấy IP thật của người gửi.
 * Trên Vercel, request đi qua CDN nên IP gốc nằm ở header x-forwarded-for.
 */
function layIP(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    // Header có thể là chuỗi nhiều IP, IP đầu tiên là của người dùng
    return xff.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Băm IP bằng HMAC-SHA256 để không lưu địa chỉ IP gốc vào database.
 * Dùng JWT_SECRET làm khoá băm nên không thể dò ngược ra IP.
 */
function bamIP(ip) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'muoi-mac-dinh')
    .update(ip)
    .digest('hex');
}

/**
 * Đếm số lần IP này đã gửi thành công trong một giờ qua.
 *
 * Cố tình "fail-open": nếu truy vấn lỗi (mất mạng, chưa tạo bảng...) thì
 * cho qua thay vì chặn. Đây là form thu thập khách hàng tiềm năng —
 * chặn nhầm một khách thật tốn kém hơn là lọt một bản ghi rác.
 *
 * @returns {Promise<{ vuot: boolean, ipHash: string }>}
 */
async function kiemTraGioiHan(req) {
  const ipHash = bamIP(layIP(req));

  try {
    const motGioTruoc = new Date(Date.now() - MOT_GIO_MS).toISOString();
    const { count, error } = await supabase
      .from('submission_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', motGioTruoc);

    if (error) throw error;

    // Supabase trả về status 204 với count = null (KHÔNG kèm error) khi bảng
    // chưa được tạo. Nếu chỉ coi null là 0 thì giới hạn sẽ âm thầm vô hiệu
    // mà không có dấu hiệu gì. Bắt riêng trường hợp này để còn biết đường sửa.
    if (typeof count !== 'number') {
      throw new Error(
        'Không đếm được submission_log — bảng có thể chưa được tạo. ' +
          'Chạy backend/schema.sql trong Supabase SQL Editor.'
      );
    }

    return { vuot: count >= GIOI_HAN_MOI_GIO, ipHash };
  } catch (err) {
    // Cố tình cho qua khi kiểm tra thất bại, nhưng phải ghi log rõ ràng
    console.warn('[rate-limit] KHÔNG kiểm tra được, tạm cho qua:', err.message);
    return { vuot: false, ipHash };
  }
}

/**
 * Kiểm tra và chuẩn hoá dữ liệu khách hàng gửi lên.
 * @param {object} body - req.body
 * @param {boolean} partial - true khi cập nhật (chỉ kiểm tra field được gửi)
 * @returns {{ errors: string[], value: object }}
 */
function validateCustomer(body = {}, partial = false) {
  const errors = [];
  const value = {};

  // --- Số điện thoại ---
  if (body.so_dien_thoai !== undefined || !partial) {
    // Bỏ khoảng trắng, dấu chấm và gạch ngang người dùng hay gõ thêm
    const phone = String(body.so_dien_thoai || '').replace(/[\s.-]/g, '');
    if (!phone) {
      errors.push('Vui lòng nhập số điện thoại.');
    } else if (!PHONE_REGEX.test(phone)) {
      errors.push('Số điện thoại không hợp lệ.');
    } else {
      value.so_dien_thoai = phone;
    }
  }

  // --- Tên khách hàng ---
  if (body.ten_khach_hang !== undefined || !partial) {
    const ten = String(body.ten_khach_hang || '').trim();
    if (!ten) {
      errors.push('Vui lòng nhập tên khách hàng.');
    } else if (ten.length < 2) {
      errors.push('Tên khách hàng phải có ít nhất 2 ký tự.');
    } else {
      value.ten_khach_hang = ten;
    }
  }

  // --- Địa chỉ (không bắt buộc) ---
  if (body.dia_chi !== undefined) {
    value.dia_chi = String(body.dia_chi || '').trim() || null;
  }

  // --- Phân loại ---
  if (body.phan_loai !== undefined) {
    const loai = String(body.phan_loai || '').trim();
    if (loai && !PHAN_LOAI_HOP_LE.includes(loai)) {
      errors.push(`Phân loại phải là một trong: ${PHAN_LOAI_HOP_LE.join(', ')}.`);
    } else {
      value.phan_loai = loai || 'Thường';
    }
  }

  // --- Ghi chú (không bắt buộc) ---
  if (body.ghi_chu !== undefined) {
    value.ghi_chu = String(body.ghi_chu || '').trim() || null;
  }

  // --- Trạng thái chăm sóc ---
  if (body.trang_thai !== undefined) {
    const tt = String(body.trang_thai || '').trim();
    if (tt && !TRANG_THAI_HOP_LE.includes(tt)) {
      errors.push(`Trạng thái phải là một trong: ${TRANG_THAI_HOP_LE.join(', ')}.`);
    } else {
      value.trang_thai = tt || 'Mới';
    }
  }

  return { errors, value };
}

/**
 * GET /api/customers  (cần đăng nhập)
 * Trả về toàn bộ danh sách khách hàng, mới nhất lên đầu.
 * Hỗ trợ tuỳ chọn ?search= và ?phan_loai= nếu muốn lọc phía server.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    const search = String(req.query.search || '').trim();
    if (search) {
      // Tìm theo tên HOẶC số điện thoại, không phân biệt hoa thường
      query = query.or(
        `ten_khach_hang.ilike.%${search}%,so_dien_thoai.ilike.%${search}%`
      );
    }

    const phanLoai = String(req.query.phan_loai || '').trim();
    if (phanLoai && PHAN_LOAI_HOP_LE.includes(phanLoai)) {
      query = query.eq('phan_loai', phanLoai);
    }

    const trangThai = String(req.query.trang_thai || '').trim();
    if (trangThai && TRANG_THAI_HOP_LE.includes(trangThai)) {
      query = query.eq('trang_thai', trangThai);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[customers/GET]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách khách hàng.',
    });
  }
});

/**
 * POST /api/customers  (public - form khách hàng tự điền)
 * Thêm khách hàng mới.
 */
router.post('/', async (req, res) => {
  try {
    const { errors, value } = validateCustomer(req.body, false);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    // Chặn gửi hàng loạt từ cùng một IP.
    // Kiểm tra sau khi validate để dữ liệu sai không tính vào hạn mức.
    const { vuot, ipHash } = await kiemTraGioiHan(req);
    if (vuot) {
      return res.status(429).json({
        success: false,
        message:
          'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau một giờ hoặc liên hệ trực tiếp nhân viên OCB.',
      });
    }

    // Gán mặc định nếu form không gửi phân loại
    if (!value.phan_loai) value.phan_loai = 'Thường';

    // Form công khai không được tự đặt trạng thái chăm sóc.
    // Khách nào vừa đăng ký cũng là "Mới", nhân viên mới có quyền đổi.
    value.trang_thai = 'Mới';

    const { data, error } = await supabase
      .from('customers')
      .insert([value])
      .select()
      .single();

    if (error) {
      // 23505 = vi phạm ràng buộc UNIQUE của cột so_dien_thoai
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được đăng ký trước đó.',
        });
      }
      throw error;
    }

    // Ghi nhận lần gửi thành công. Không await lỗi làm hỏng phản hồi:
    // khách đã lưu được rồi, sổ nhật ký hỏng cũng không nên báo lỗi cho họ.
    supabase
      .from('submission_log')
      .insert([{ ip_hash: ipHash }])
      .then(({ error: logError }) => {
        if (logError) console.error('[rate-limit] Không ghi được nhật ký:', logError.message);
      });

    return res.status(201).json({
      success: true,
      message: 'Đăng ký thông tin thành công.',
      data,
    });
  } catch (err) {
    console.error('[customers/POST]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể lưu thông tin. Vui lòng thử lại.',
    });
  }
});

/**
 * PUT /api/customers/:id  (cần đăng nhập)
 * Cập nhật thông tin một khách hàng.
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const { errors, value } = validateCustomer(req.body, true);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }
    if (Object.keys(value).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu nào để cập nhật.',
      });
    }

    const { data, error } = await supabase
      .from('customers')
      .update(value)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã thuộc về khách hàng khác.',
        });
      }
      throw error;
    }

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }

    return res.json({ success: true, message: 'Cập nhật thành công.', data });
  } catch (err) {
    console.error('[customers/PUT]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật khách hàng.',
    });
  }
});

/**
 * DELETE /api/customers/:id  (cần đăng nhập)
 * Xoá một khách hàng.
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    // .select() để biết bản ghi có thực sự tồn tại hay không
    const { data, error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }

    return res.json({ success: true, message: 'Đã xoá khách hàng.', data });
  } catch (err) {
    console.error('[customers/DELETE]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể xoá khách hàng.',
    });
  }
});

/* ------------------------------------------------------------------ */
/* Lịch sử liên hệ                                                      */
/* ------------------------------------------------------------------ */

/**
 * GET /api/customers/:id/contacts  (cần đăng nhập)
 * Toàn bộ lịch sử liên hệ của một khách hàng, mới nhất lên đầu.
 */
router.get('/:id/contacts', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const { data, error } = await supabase
      .from('contact_history')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[contacts/GET]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải lịch sử liên hệ.',
    });
  }
});

/**
 * POST /api/customers/:id/contacts  (cần đăng nhập)
 * Ghi nhận một lần liên hệ và cập nhật trạng thái hiện tại của khách hàng.
 */
router.post('/:id/contacts', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const trang_thai = String(req.body?.trang_thai || '').trim();
    if (!TRANG_THAI_HOP_LE.includes(trang_thai)) {
      return res.status(400).json({
        success: false,
        message: `Trạng thái phải là một trong: ${TRANG_THAI_HOP_LE.join(', ')}.`,
      });
    }

    const ket_qua = String(req.body?.ket_qua || '').trim() || null;

    // Lịch hẹn gọi lại: chỉ có ý nghĩa với trạng thái "Hẹn gọi lại"
    let hen_goi_lai = null;
    if (req.body?.hen_goi_lai) {
      const d = new Date(req.body.hen_goi_lai);
      if (Number.isNaN(d.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: 'Thời gian hẹn gọi lại không hợp lệ.' });
      }
      hen_goi_lai = d.toISOString();
    }
    if (trang_thai === 'Hẹn gọi lại' && !hen_goi_lai) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn thời gian hẹn gọi lại.',
      });
    }
    // Chuyển sang trạng thái khác thì xoá lịch hẹn cũ cho khỏi hiện nhầm
    if (trang_thai !== 'Hẹn gọi lại') hen_goi_lai = null;

    // Khách phải tồn tại thì mới ghi được lịch sử
    const { data: khach, error: khachError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (khachError) throw khachError;
    if (!khach) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }

    const { data, error } = await supabase
      .from('contact_history')
      .insert([
        {
          customer_id: id,
          user_id: req.user.id,
          // Lưu kèm tên để sau này xoá tài khoản vẫn biết ai đã liên hệ
          username: req.user.username,
          trang_thai,
          ket_qua,
          hen_goi_lai,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Cập nhật trạng thái hiện tại trên bản ghi khách hàng
    const { data: khachMoi, error: updateError } = await supabase
      .from('customers')
      .update({ trang_thai, hen_goi_lai })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(201).json({
      success: true,
      message: 'Đã ghi nhận lần liên hệ.',
      data,
      customer: khachMoi,
    });
  } catch (err) {
    console.error('[contacts/POST]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể ghi nhận lần liên hệ.',
    });
  }
});

export default router;
