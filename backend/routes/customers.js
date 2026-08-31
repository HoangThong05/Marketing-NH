// Route quản lý khách hàng.
// POST là public (form khách tự điền), các thao tác còn lại yêu cầu đăng nhập.
import express from 'express';
import crypto from 'crypto';
import { supabase } from '../supabase.js';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';
import { ghiNhatKy } from '../lib/activityLog.js';
import { taoRegexBoDau } from '../lib/tiengViet.js';
import { chuanHoaSoDienThoai } from '../lib/dienThoai.js';
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
    const phone = chuanHoaSoDienThoai(body.so_dien_thoai);
    if (!phone) {
      errors.push('Vui lòng nhập số điện thoại.');
    } else if (!PHONE_REGEX.test(phone)) {
      // Kèm giá trị đọc được, nếu không người dùng nhìn file thấy đúng
      // mà hệ thống báo sai thì không hiểu vì sao
      errors.push(`Số điện thoại không hợp lệ (đọc được: "${phone}").`);
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

/* ------------------------------------------------------------------ */
/* Danh sách: phân trang, sắp xếp, lọc                                  */
/* ------------------------------------------------------------------ */

// Chỉ cho phép sắp xếp theo các cột này. Nhận thẳng tên cột từ query
// mà không kiểm tra là mở đường cho người dùng dò cấu trúc bảng.
const COT_SAP_XEP_HOP_LE = [
  'created_at',
  'ten_khach_hang',
  'so_dien_thoai',
  'phan_loai',
  'trang_thai',
  'hen_goi_lai',
];

const SO_DONG_MAC_DINH = 25;
const SO_DONG_TOI_DA = 200;

/**
 * Dựng câu truy vấn kèm toàn bộ bộ lọc từ query string.
 * Tách riêng để phần lấy danh sách và phần xuất Excel dùng chung một bộ lọc,
 * tránh cảnh hai nơi lệch nhau rồi xuất ra dữ liệu khác với đang xem.
 */
function apDungBoLoc(query, q) {
  const search = String(q.search || '').trim();
  if (search) {
    // Chuỗi chỉ gồm chữ số (bỏ qua khoảng trắng, dấu chấm, gạch ngang)
    // thì chắc chắn người dùng đang tìm số điện thoại.
    const chiSo = search.replace(/[\s.-]/g, '');

    if (/^\d+$/.test(chiSo)) {
      query = query.ilike('so_dien_thoai', `%${chiSo}%`);
    } else {
      // Tìm theo tên, bỏ qua dấu: gõ "hoang" vẫn ra "Hoàng".
      // imatch là toán tử ~* của Postgres (khớp biểu thức chính quy,
      // không phân biệt hoa thường).
      const bieuThuc = taoRegexBoDau(search);
      // supabase-js không có phương thức riêng cho toán tử regex,
      // phải gọi filter() với toán tử PostgREST thô.
      if (bieuThuc) query = query.filter('ten_khach_hang', 'imatch', bieuThuc);
    }
  }

  const phanLoai = String(q.phan_loai || '').trim();
  if (phanLoai && PHAN_LOAI_HOP_LE.includes(phanLoai)) {
    query = query.eq('phan_loai', phanLoai);
  }

  const trangThai = String(q.trang_thai || '').trim();
  if (trangThai && TRANG_THAI_HOP_LE.includes(trangThai)) {
    query = query.eq('trang_thai', trangThai);
  }

  // Lọc theo khoảng ngày tạo. Ô "đến ngày" tính hết cả ngày hôm đó,
  // nên cộng thêm một ngày rồi so sánh nhỏ hơn.
  const tuNgay = String(q.tu_ngay || '').trim();
  if (tuNgay) {
    const d = new Date(tuNgay);
    if (!Number.isNaN(d.getTime())) {
      query = query.gte('created_at', d.toISOString());
    }
  }

  const denNgay = String(q.den_ngay || '').trim();
  if (denNgay) {
    const d = new Date(denNgay);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      query = query.lt('created_at', d.toISOString());
    }
  }

  // Chỉ lấy khách đã tới hạn hẹn gọi lại
  if (String(q.den_han || '') === '1') {
    query = query
      .not('hen_goi_lai', 'is', null)
      .lte('hen_goi_lai', new Date().toISOString());
  }

  return query;
}

/**
 * GET /api/customers  (cần đăng nhập)
 * Danh sách khách hàng có phân trang.
 *
 * Query: page, limit, sort, order, search, phan_loai, trang_thai,
 *        tu_ngay, den_ngay, den_han
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(
      Math.max(Number(req.query.limit) || SO_DONG_MAC_DINH, 1),
      SO_DONG_TOI_DA
    );

    const sort = COT_SAP_XEP_HOP_LE.includes(String(req.query.sort))
      ? String(req.query.sort)
      : 'created_at';
    const ascending = String(req.query.order || 'desc') === 'asc';

    const tu = (page - 1) * limit;
    const den = tu + limit - 1;

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order(sort, { ascending, nullsFirst: false })
      // Chốt thêm thứ tự phụ theo id: hai bản ghi cùng giá trị sắp xếp mà
      // không có tiêu chí phụ thì Postgres có thể trả thứ tự khác nhau giữa
      // các trang, làm một bản ghi hiện hai lần hoặc biến mất khỏi danh sách.
      .order('id', { ascending: false })
      .range(tu, den);

    query = apDungBoLoc(query, req.query);

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
    console.error('[customers/GET]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách khách hàng.',
    });
  }
});

/**
 * GET /api/customers/stats  (cần đăng nhập)
 * Số liệu thống kê trên TOÀN BỘ dữ liệu, không phụ thuộc bộ lọc hay trang
 * đang xem — thẻ thống kê và biểu đồ luôn nói về cả hệ thống.
 */
router.get('/stats', authMiddleware, async (_req, res) => {
  try {
    /** Đếm số dòng khớp một điều kiện. head:true nên không kéo dữ liệu về */
    const dem = async (apDung) => {
      let q = supabase.from('customers').select('id', { count: 'exact', head: true });
      if (apDung) q = apDung(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    };

    const bayGio = new Date().toISOString();

    // Chạy song song nên tổng độ trễ chỉ bằng một vòng gọi
    const [total, denHan, ...soLieu] = await Promise.all([
      dem(),
      dem((q) => q.not('hen_goi_lai', 'is', null).lte('hen_goi_lai', bayGio)),
      ...PHAN_LOAI_HOP_LE.map((v) => dem((q) => q.eq('phan_loai', v))),
      ...TRANG_THAI_HOP_LE.map((v) => dem((q) => q.eq('trang_thai', v))),
    ]);

    const phan_loai = {};
    PHAN_LOAI_HOP_LE.forEach((v, i) => {
      phan_loai[v] = soLieu[i];
    });

    const trang_thai = {};
    TRANG_THAI_HOP_LE.forEach((v, i) => {
      trang_thai[v] = soLieu[PHAN_LOAI_HOP_LE.length + i];
    });

    return res.json({
      success: true,
      data: { total, den_han: denHan, phan_loai, trang_thai },
    });
  } catch (err) {
    console.error('[customers/stats]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải số liệu thống kê.' });
  }
});

/**
 * GET /api/customers/export  (cần đăng nhập)
 * Lấy toàn bộ dữ liệu khớp bộ lọc, KHÔNG phân trang, để xuất Excel.
 * Có phân trang rồi thì không thể xuất từ dữ liệu đang hiển thị nữa,
 * vì trình duyệt chỉ giữ đúng một trang.
 */
router.get('/export', authMiddleware, async (req, res) => {
  try {
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);

    query = apDungBoLoc(query, req.query);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('[customers/export]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể lấy dữ liệu để xuất.' });
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

    ghiNhatKy(req.user, {
      hanh_dong: 'sua',
      doi_tuong: 'khach_hang',
      doi_tuong_id: id,
      mo_ta: `Sửa khách "${data.ten_khach_hang}" (${data.so_dien_thoai}): ${Object.keys(value).join(', ')}`,
    });

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
router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
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

    ghiNhatKy(req.user, {
      hanh_dong: 'xoa',
      doi_tuong: 'khach_hang',
      doi_tuong_id: id,
      mo_ta: `Xoá khách "${data.ten_khach_hang}" (${data.so_dien_thoai})`,
    });

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
/* Nhập danh sách từ file                                               */
/* ------------------------------------------------------------------ */

// Số dòng tối đa xử lý trong một lần gọi. File lớn được phía giao diện
// cắt thành nhiều lô, vừa tránh serverless hết thời gian chạy, vừa cho
// người dùng thấy tiến độ thay vì ngồi đợi một cục.
const SO_DONG_MOI_LO = 500;

/**
 * POST /api/customers/import  (chỉ admin)
 *
 * Body: { rows: [...], che_do: 'bo_qua' | 'cap_nhat' }
 *   bo_qua   - số điện thoại đã tồn tại thì bỏ qua, giữ nguyên dữ liệu cũ
 *   cap_nhat - ghi đè thông tin cũ bằng dữ liệu trong file
 *
 * Trả về kết quả từng dòng để người dùng biết dòng nào lỗi ở đâu.
 */
router.post('/import', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    const cheDo = req.body?.che_do === 'cap_nhat' ? 'cap_nhat' : 'bo_qua';

    if (!rows || rows.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Không có dòng dữ liệu nào.' });
    }
    if (rows.length > SO_DONG_MOI_LO) {
      return res.status(400).json({
        success: false,
        message: `Mỗi lần chỉ nhập tối đa ${SO_DONG_MOI_LO} dòng.`,
      });
    }

    const loi = [];
    const hopLe = [];
    // Số điện thoại đã gặp trong CHÍNH lô này, để bắt trùng nội bộ file.
    // Không có bước này thì hai dòng trùng nhau trong cùng file sẽ làm
    // cả lệnh insert đổ vì vi phạm ràng buộc UNIQUE.
    const daGap = new Set();

    rows.forEach((row, i) => {
      // dong: số dòng trong file Excel để người dùng còn biết chỗ mà sửa
      const dong = Number(row?.__dong) || i + 1;

      const { errors, value } = validateCustomer(row, false);
      if (errors.length) {
        loi.push({ dong, so_dien_thoai: row?.so_dien_thoai || '', ly_do: errors[0] });
        return;
      }

      if (daGap.has(value.so_dien_thoai)) {
        loi.push({
          dong,
          so_dien_thoai: value.so_dien_thoai,
          ly_do: 'Trùng số điện thoại với dòng khác trong cùng file.',
        });
        return;
      }
      daGap.add(value.so_dien_thoai);

      if (!value.phan_loai) value.phan_loai = 'Thường';
      // Khách nhập từ file cũng bắt đầu ở trạng thái "Mới" như khách tự đăng ký
      if (!value.trang_thai) value.trang_thai = 'Mới';

      hopLe.push({ dong, value });
    });

    if (hopLe.length === 0) {
      return res.json({
        success: true,
        message: 'Không có dòng nào hợp lệ để nhập.',
        ket_qua: { them_moi: 0, cap_nhat: 0, bo_qua: 0, loi },
      });
    }

    // Tra một lượt xem số nào đã có trong hệ thống
    const dsSo = hopLe.map((h) => h.value.so_dien_thoai);
    const { data: daCo, error: traError } = await supabase
      .from('customers')
      .select('id, so_dien_thoai')
      .in('so_dien_thoai', dsSo);

    if (traError) throw traError;

    const banDoCu = new Map((daCo || []).map((c) => [c.so_dien_thoai, c.id]));

    const themMoi = [];
    const capNhat = [];
    let boQua = 0;

    hopLe.forEach(({ value }) => {
      const idCu = banDoCu.get(value.so_dien_thoai);
      if (!idCu) {
        themMoi.push(value);
      } else if (cheDo === 'cap_nhat') {
        capNhat.push({ id: idCu, value });
      } else {
        boQua += 1;
      }
    });

    if (themMoi.length) {
      const { error } = await supabase.from('customers').insert(themMoi);
      if (error) throw error;
    }

    // Cập nhật từng dòng một. Supabase không có lệnh cập nhật hàng loạt theo
    // id khác nhau, và số dòng trùng thường ít nên chấp nhận được.
    for (const { id, value } of capNhat) {
      // Không đụng tới trạng thái chăm sóc của khách đã có: nhập lại file
      // mà xoá mất tiến trình chăm sóc thì tai hại hơn nhiều so với lợi ích.
      const { trang_thai, ...phanConLai } = value;
      const { error } = await supabase
        .from('customers')
        .update(phanConLai)
        .eq('id', id);
      if (error) throw error;
    }

    ghiNhatKy(req.user, {
      hanh_dong: 'tao',
      doi_tuong: 'khach_hang',
      mo_ta: `Nhập từ file: thêm ${themMoi.length}, cập nhật ${capNhat.length}, bỏ qua ${boQua}, lỗi ${loi.length}`,
    });

    return res.json({
      success: true,
      message: 'Đã nhập xong.',
      ket_qua: {
        them_moi: themMoi.length,
        cap_nhat: capNhat.length,
        bo_qua: boQua,
        loi,
      },
    });
  } catch (err) {
    console.error('[customers/import]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể nhập dữ liệu.' });
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

    ghiNhatKy(req.user, {
      hanh_dong: 'lien_he',
      doi_tuong: 'khach_hang',
      doi_tuong_id: id,
      mo_ta: `Liên hệ khách "${khachMoi.ten_khach_hang}" (${khachMoi.so_dien_thoai}) → ${trang_thai}`,
    });

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
