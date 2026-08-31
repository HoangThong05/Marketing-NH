// Route quản lý khách hàng.
// POST là public (form khách tự điền), các thao tác còn lại yêu cầu đăng nhập.
import express from 'express';
import { supabase } from '../supabase.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Regex số điện thoại Việt Nam (đầu số các nhà mạng hiện hành)
const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])[0-9]{7}$/;

// Các giá trị hợp lệ của cột phan_loai
const PHAN_LOAI_HOP_LE = ['Thường', 'Tiềm năng', 'VIP'];

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

    // Gán mặc định nếu form không gửi phân loại
    if (!value.phan_loai) value.phan_loai = 'Thường';

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

export default router;
