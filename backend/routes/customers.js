// Route quản lý khách hàng.
// POST là public (form khách tự điền), các thao tác còn lại yêu cầu đăng nhập.
import express from 'express';
import { supabase } from '../supabase.js';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware.js';
import { ghiNhatKy } from '../lib/activityLog.js';
import { taoRegexBoDau } from '../lib/tiengViet.js';
import { chuanHoaSoDienThoai } from '../lib/dienThoai.js';
import { chuanHoaMucLuong } from '../lib/mucLuong.js';
import { laLoiVuotTrang, demTong, trangRong } from '../lib/phanTrang.js';
import { bamIPTuRequest } from '../lib/ip.js';
import {
  PHAN_LOAI_HOP_LE,
  TRANG_THAI_HOP_LE,
  MUC_LUONG_HOP_LE,
  MUC_LUONG_GOI_Y_TIEM_NANG,
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
 * Đếm số lần IP này đã gửi thành công trong một giờ qua.
 *
 * Cố tình "fail-open": nếu truy vấn lỗi (mất mạng, chưa tạo bảng...) thì
 * cho qua thay vì chặn. Đây là form thu thập khách hàng tiềm năng —
 * chặn nhầm một khách thật tốn kém hơn là lọt một bản ghi rác.
 *
 * @returns {Promise<{ vuot: boolean, ipHash: string }>}
 */
async function kiemTraGioiHan(req) {
  const ipHash = bamIPTuRequest(req);

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

  // --- Nghề nghiệp ---
  // Nhận mọi chuỗi vì form có lựa chọn "Khác" cho khách tự nhập.
  // Danh sách gợi ý chỉ nằm ở giao diện, không ràng buộc ở đây.
  if (body.nghe_nghiep !== undefined) {
    const nn = String(body.nghe_nghiep || '').trim();
    if (nn.length > 100) {
      errors.push('Nghề nghiệp không được quá 100 ký tự.');
    } else {
      value.nghe_nghiep = nn || null;
    }
  }

  // --- Mức thu nhập ---
  if (body.muc_luong !== undefined) {
    const thoo = String(body.muc_luong ?? '').trim();
    if (!thoo) {
      value.muc_luong = null;
    } else {
      // Chấp nhận cách ghi tự do rồi quy về bậc chuẩn, thay vì bắt khớp
      // từng ký tự. File Excel người dùng tự lập ghi đủ kiểu.
      const ml = chuanHoaMucLuong(thoo);
      if (!ml) {
        errors.push(
          `Không hiểu mức thu nhập "${thoo}". Dùng một trong: ${MUC_LUONG_HOP_LE.join(', ')}.`
        );
      } else {
        value.muc_luong = ml;
      }
    }
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
  'muc_luong',
  'nghe_nghiep',
];

const SO_DONG_MAC_DINH = 25;
const SO_DONG_TOI_DA = 200;

/**
 * Dựng câu truy vấn kèm toàn bộ bộ lọc từ query string.
 * Tách riêng để phần lấy danh sách và phần xuất Excel dùng chung một bộ lọc,
 * tránh cảnh hai nơi lệch nhau rồi xuất ra dữ liệu khác với đang xem.
 */
function apDungBoLoc(query, q) {
  // Mặc định giấu khách đã xoá. Chỉ khi hỏi thẳng thùng rác (da_xoa=1)
  // mới lấy ra. Đặt ngay đầu hàm để không có đường nào lọt.
  if (String(q.da_xoa || '') === '1') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
  }

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

  const mucLuong = String(q.muc_luong || '').trim();
  if (mucLuong && MUC_LUONG_HOP_LE.includes(mucLuong)) {
    query = query.eq('muc_luong', mucLuong);
  }

  // Lọc theo người phụ trách.
  // 'me' = của tôi, 'none' = chưa ai nhận, số = của đúng người đó.
  const phuTrach = String(q.phu_trach || '').trim();
  if (phuTrach === 'none') {
    query = query.is('phu_trach_id', null);
  } else if (phuTrach === 'me') {
    query = query.eq('phu_trach_id', q.__userId);
  } else if (/^\d+$/.test(phuTrach)) {
    query = query.eq('phu_trach_id', Number(phuTrach));
  }

  // Chỉ lấy khách đang xếp "Thường" nhưng thu nhập đủ để cân nhắc nâng hạng
  if (String(q.goi_y || '') === '1') {
    query = query
      .eq('phan_loai', 'Thường')
      .in('muc_luong', MUC_LUONG_GOI_Y_TIEM_NANG);
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

  // Lọc theo khoảng thời gian hẹn gọi lại.
  // Mốc thời gian do trình duyệt gửi lên chứ không tự tính ở server —
  // "hôm nay" phải theo múi giờ của người dùng, không phải của máy chủ.
  const henTu = String(q.hen_tu || '').trim();
  const henDen = String(q.hen_den || '').trim();
  if (henTu || henDen) {
    query = query.not('hen_goi_lai', 'is', null);
    if (henTu) {
      const d = new Date(henTu);
      if (!Number.isNaN(d.getTime())) query = query.gte('hen_goi_lai', d.toISOString());
    }
    if (henDen) {
      const d = new Date(henDen);
      if (!Number.isNaN(d.getTime())) query = query.lte('hen_goi_lai', d.toISOString());
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

    // apDungBoLoc cần biết ai đang đăng nhập để hiểu bộ lọc "của tôi"
    query = apDungBoLoc(query, { ...req.query, __userId: req.user.id });

    const { data, count, error } = await query;

    if (error) {
      // Xin trang vượt quá số bản ghi thì trả trang rỗng kèm tổng số đúng,
      // để giao diện tự biết mà lùi về trang hợp lệ.
      if (laLoiVuotTrang(error)) {
        const total = await demTong(() =>
          apDungBoLoc(
            supabase.from('customers').select('id', { count: 'exact', head: true }),
            { ...req.query, __userId: req.user.id }
          )
        );
        return res.json(trangRong(page, limit, total));
      }
      throw error;
    }

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
 *
 * Chỉ dùng MỘT truy vấn rồi đếm bằng JavaScript.
 * Bản trước chạy 10 câu đếm song song; tuy mỗi câu đều nhanh, gộp lại
 * thành 10 kết nối HTTPS riêng trong cùng một lần gọi hàm serverless thì
 * hay bị treo tới mức hết thời gian chờ. Một truy vấn lấy 3 cột nhỏ luôn
 * rẻ hơn nhiều so với mười lần bắt tay TLS.
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Trần an toàn: ngoài mốc này thì phải chuyển sang đếm bằng hàm SQL
    const TRAN = 50000;

    const { data, error } = await supabase
      .from('customers')
      .select('phan_loai, trang_thai, hen_goi_lai, muc_luong, phu_trach_id')
      .is('deleted_at', null)
      .limit(TRAN);

    if (error) throw error;

    const rows = data || [];
    const bayGio = Date.now();

    const phan_loai = {};
    PHAN_LOAI_HOP_LE.forEach((v) => {
      phan_loai[v] = 0;
    });

    const trang_thai = {};
    TRANG_THAI_HOP_LE.forEach((v) => {
      trang_thai[v] = 0;
    });

    const muc_luong = {};
    MUC_LUONG_HOP_LE.forEach((v) => {
      muc_luong[v] = 0;
    });

    let denHan = 0;
    let chuaGiao = 0;
    let cuaToi = 0;
    let cuaToiDenHan = 0;

    rows.forEach((r) => {
      if (r.phu_trach_id === null || r.phu_trach_id === undefined) chuaGiao += 1;
      if (r.phu_trach_id === req.user.id) {
        cuaToi += 1;
        if (r.hen_goi_lai && new Date(r.hen_goi_lai).getTime() <= bayGio) {
          cuaToiDenHan += 1;
        }
      }
      if (phan_loai[r.phan_loai] !== undefined) phan_loai[r.phan_loai] += 1;
      if (trang_thai[r.trang_thai] !== undefined) trang_thai[r.trang_thai] += 1;
      if (muc_luong[r.muc_luong] !== undefined) muc_luong[r.muc_luong] += 1;
      if (r.hen_goi_lai && new Date(r.hen_goi_lai).getTime() <= bayGio) denHan += 1;
    });

    return res.json({
      success: true,
      data: {
        total: rows.length,
        den_han: denHan,
        chua_giao: chuaGiao,
        cua_toi: cuaToi,
        cua_toi_den_han: cuaToiDenHan,
        phan_loai,
        trang_thai,
        muc_luong,
      },
    });
  } catch (err) {
    console.error('[customers/stats]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể tải số liệu thống kê.' });
  }
});

/**
 * GET /api/customers/bao-cao-nhan-vien  (chỉ admin)
 * Bảng theo dõi tiến độ của từng nhân viên.
 *
 * Trả về hai loại số khác hẳn nhau, đừng lẫn:
 *   - TÌNH TRẠNG DANH SÁCH (từ bảng customers): mỗi khách đếm đúng một lần,
 *     theo trạng thái hiện tại. Trả lời "còn bao nhiêu chưa gọi".
 *   - HOẠT ĐỘNG (từ bảng contact_history): mỗi LẦN liên hệ một dòng, gọi lại
 *     một khách ba lần là ba dòng. Trả lời "hôm nay có ai làm việc không".
 *
 * Ba truy vấn chạy song song. Vẫn còn xa mốc từng gây treo hàm serverless
 * (bản /stats cũ chạy mười câu một lượt), nhưng cố tình không tách thêm nữa.
 */
router.get(
  '/bao-cao-nhan-vien',
  authMiddleware,
  requireAdmin,
  async (req, res) => {
    try {
      const TRAN = 50000;
      const MOT_NGAY = 24 * 60 * 60 * 1000;
      const bayGio = Date.now();

      // Mốc đầu ngày do TRÌNH DUYỆT gửi lên. Máy chủ Vercel chạy giờ UTC,
      // mà nửa đêm ở Việt Nam là 17h UTC hôm trước — tự đoán "hôm nay" ở
      // máy chủ thì mọi cuộc gọi trước 7h sáng đều bị tính sang hôm qua.
      let dauNgay = new Date(String(req.query.hom_nay_tu || ''));
      if (
        Number.isNaN(dauNgay.getTime()) ||
        dauNgay.getTime() > bayGio ||
        bayGio - dauNgay.getTime() > 2 * MOT_NGAY
      ) {
        dauNgay = new Date();
        dauNgay.setHours(0, 0, 0, 0);
      }
      const mocBayNgay = new Date(bayGio - 7 * MOT_NGAY);

      const [rKhach, rLienHe, rNguoi] = await Promise.all([
        supabase
          .from('customers')
          .select('phu_trach_id, trang_thai')
          .is('deleted_at', null)
          .limit(TRAN),
        supabase
          .from('contact_history')
          .select('user_id, created_at')
          .gte('created_at', mocBayNgay.toISOString())
          .limit(TRAN),
        supabase
          .from('users')
          .select('id, username, ho_ten, active')
          .order('id'),
      ]);

      if (rKhach.error) throw rKhach.error;
      if (rLienHe.error) throw rLienHe.error;
      if (rNguoi.error) throw rNguoi.error;

      /** Khung số liệu rỗng cho một người */
      const khungRong = () => {
        const trang_thai = {};
        TRANG_THAI_HOP_LE.forEach((v) => {
          trang_thai[v] = 0;
        });
        return {
          duoc_giao: 0,
          da_lien_he: 0,
          trang_thai,
          goi_hom_nay: 0,
          goi_7_ngay: 0,
        };
      };

      const theoId = new Map();
      const chuaGiao = khungRong();

      const lay = (id) => {
        if (!theoId.has(id)) theoId.set(id, khungRong());
        return theoId.get(id);
      };

      (rKhach.data || []).forEach((r) => {
        const o = r.phu_trach_id ? lay(r.phu_trach_id) : chuaGiao;
        o.duoc_giao += 1;
        if (o.trang_thai[r.trang_thai] !== undefined) {
          o.trang_thai[r.trang_thai] += 1;
        }
        // "Đã liên hệ" = đã đụng tới ít nhất một lần, tức là khác "Mới".
        // Tính bằng phần bù thay vì cộng năm trạng thái kia, để sau này
        // thêm trạng thái mới thì con số này vẫn tự đúng.
        if (r.trang_thai !== 'Mới') o.da_lien_he += 1;
      });

      const mocDauNgay = dauNgay.getTime();
      (rLienHe.data || []).forEach((r) => {
        if (!r.user_id) return;
        const o = lay(r.user_id);
        o.goi_7_ngay += 1;
        if (new Date(r.created_at).getTime() >= mocDauNgay) o.goi_hom_nay += 1;
      });

      // Người bị khoá vẫn hiện NẾU còn khách hoặc còn hoạt động trong tuần —
      // khoá tài khoản không làm biến mất phần việc họ đang giữ.
      const nhan_vien = (rNguoi.data || [])
        .map((u) => {
          const o = theoId.get(u.id) || khungRong();
          theoId.delete(u.id);
          return { id: u.id, username: u.username, ho_ten: u.ho_ten, active: u.active, ...o };
        })
        .filter((u) => u.active || u.duoc_giao > 0 || u.goi_7_ngay > 0);

      // Còn sót id không khớp tài khoản nào (tài khoản đã bị xoá hẳn) thì
      // vẫn phải hiện, nếu không tổng các dòng sẽ không bằng tổng hệ thống.
      theoId.forEach((o, id) => {
        if (o.duoc_giao > 0 || o.goi_7_ngay > 0) {
          nhan_vien.push({ id, username: null, ho_ten: null, active: false, ...o });
        }
      });

      nhan_vien.sort((a, b) => b.duoc_giao - a.duoc_giao || a.id - b.id);

      return res.json({
        success: true,
        data: {
          dau_ngay: dauNgay.toISOString(),
          tu_ngay_7: mocBayNgay.toISOString(),
          nhan_vien,
          chua_giao: chuaGiao,
          tong: {
            khach: (rKhach.data || []).length,
            goi_hom_nay: nhan_vien.reduce((t, u) => t + u.goi_hom_nay, 0),
            goi_7_ngay: nhan_vien.reduce((t, u) => t + u.goi_7_ngay, 0),
          },
        },
      });
    } catch (err) {
      console.error('[customers/bao-cao-nhan-vien]', err);
      return res
        .status(500)
        .json({ success: false, message: 'Không thể tải báo cáo nhân viên.' });
    }
  }
);

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

    query = apDungBoLoc(query, { ...req.query, __userId: req.user.id });

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
        // Có thể số này thuộc một khách đang nằm trong thùng rác.
        // Khách quay lại đăng ký thì khôi phục hồ sơ cũ kèm toàn bộ lịch sử,
        // thay vì báo lỗi trùng cho một bản ghi họ không nhìn thấy.
        const { data: daXoa } = await supabase
          .from('customers')
          .select('id')
          .eq('so_dien_thoai', value.so_dien_thoai)
          .not('deleted_at', 'is', null)
          .maybeSingle();

        if (daXoa) {
          const { data: phucHoi, error: loiPhucHoi } = await supabase
            .from('customers')
            .update({ ...value, deleted_at: null, deleted_by: null })
            .eq('id', daXoa.id)
            .select()
            .single();

          if (loiPhucHoi) throw loiPhucHoi;

          ghiNhatKy(
            { id: null, username: '(khách tự đăng ký)' },
            {
              hanh_dong: 'tao',
              doi_tuong: 'khach_hang',
              doi_tuong_id: daXoa.id,
              mo_ta: `Khách "${phucHoi.ten_khach_hang}" (${phucHoi.so_dien_thoai}) đăng ký lại, hồ sơ trong thùng rác được khôi phục`,
            }
          );

          return res.status(201).json({
            success: true,
            message: 'Đăng ký thông tin thành công.',
            data: phucHoi,
          });
        }

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

    // Trạng thái chăm sóc KHÔNG sửa được qua đây.
    //
    // Nó chỉ được đổi qua POST /:id/contacts, để mỗi lần đổi đều kèm một
    // dòng lịch sử ghi rõ ai đổi, lúc nào, kết quả trao đổi ra sao. Cho sửa
    // thẳng ở đây thì nhìn lại hồ sơ sẽ thấy khách "Chốt" mà không có dấu
    // vết nào của cuộc gọi nào — mất luôn giá trị đối chiếu của lịch sử.
    if (req.body?.trang_thai !== undefined) {
      return res.status(400).json({
        success: false,
        message:
          'Trạng thái chăm sóc chỉ đổi được qua chức năng Chăm sóc, để luôn có lịch sử liên hệ đi kèm.',
      });
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

    // Xoá MỀM: chỉ đánh dấu, dữ liệu và lịch sử liên hệ vẫn nguyên vẹn.
    // Xoá thật là thao tác riêng ở DELETE /:id/vinh-vien.
    const { data, error } = await supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), deleted_by: req.user.username })
      .eq('id', id)
      .is('deleted_at', null)
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
      mo_ta: `Chuyển khách "${data.ten_khach_hang}" (${data.so_dien_thoai}) vào thùng rác`,
    });

    return res.json({
      success: true,
      message: 'Đã chuyển vào thùng rác. Khôi phục lại được.',
      data,
    });
  } catch (err) {
    console.error('[customers/DELETE]', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể xoá khách hàng.',
    });
  }
});

/**
 * PUT /api/customers/:id/khoi-phuc  (chỉ admin)
 * Đưa một khách từ thùng rác trở lại danh sách.
 */
router.put('/:id/khoi-phuc', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const { data, error } = await supabase
      .from('customers')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .select()
      .maybeSingle();

    if (error) {
      // Số điện thoại đó giờ đã thuộc về một khách khác đang hoạt động
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message:
            'Không khôi phục được: số điện thoại này giờ đã thuộc về một khách hàng khác.',
        });
      }
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy khách hàng trong thùng rác.',
      });
    }

    ghiNhatKy(req.user, {
      hanh_dong: 'sua',
      doi_tuong: 'khach_hang',
      doi_tuong_id: id,
      mo_ta: `Khôi phục khách "${data.ten_khach_hang}" (${data.so_dien_thoai}) từ thùng rác`,
    });

    return res.json({ success: true, message: 'Đã khôi phục khách hàng.', data });
  } catch (err) {
    console.error('[customers/khoi-phuc]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể khôi phục khách hàng.' });
  }
});

/**
 * DELETE /api/customers/:id/vinh-vien  (chỉ admin)
 * Xoá hẳn khỏi database, kèm toàn bộ lịch sử liên hệ.
 *
 * Chỉ xoá được khách ĐANG NẰM TRONG THÙNG RÁC. Bắt buộc đi qua hai bước
 * để không thể xoá vĩnh viễn chỉ bằng một cú bấm nhầm.
 */
router.delete('/:id/vinh-vien', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const { data: khach, error: loiTim } = await supabase
      .from('customers')
      .select('id, ten_khach_hang, so_dien_thoai, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (loiTim) throw loiTim;
    if (!khach) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }
    if (!khach.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'Phải chuyển vào thùng rác trước khi xoá vĩnh viễn.',
      });
    }

    // Đếm trước để ghi vào nhật ký mất bao nhiêu lịch sử
    const { count: soLichSu } = await supabase
      .from('contact_history')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id);

    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;

    ghiNhatKy(req.user, {
      hanh_dong: 'xoa',
      doi_tuong: 'khach_hang',
      doi_tuong_id: id,
      mo_ta: `XOÁ VĨNH VIỄN khách "${khach.ten_khach_hang}" (${khach.so_dien_thoai}), mất ${soLichSu || 0} bản ghi lịch sử liên hệ`,
    });

    return res.json({ success: true, message: 'Đã xoá vĩnh viễn.' });
  } catch (err) {
    console.error('[customers/vinh-vien]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể xoá vĩnh viễn.' });
  }
});

/**
 * PUT /api/customers/:id/phu-trach  (cần đăng nhập)
 * Gán hoặc bỏ người phụ trách một khách hàng.
 *
 * Body: { phu_trach_id: number | null }
 *
 * Quyền:
 *   - admin      : gán cho bất kỳ ai, hoặc bỏ trống
 *   - nhân viên  : chỉ tự nhận khách CHƯA ai nhận, và chỉ bỏ khách của mình
 *
 * Giới hạn này để một nhân viên không giành được khách đang thuộc về đồng
 * nghiệp. Cần chuyển giao thì admin làm, và nhật ký ghi lại ai đã chuyển.
 */
router.put('/:id/phu-trach', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    }

    const raw = req.body?.phu_trach_id;
    const moi = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (moi !== null && (!Number.isInteger(moi) || moi <= 0)) {
      return res
        .status(400)
        .json({ success: false, message: 'Người phụ trách không hợp lệ.' });
    }

    const { data: khach, error: khachError } = await supabase
      .from('customers')
      .select('id, ten_khach_hang, so_dien_thoai, phu_trach_id')
      .eq('id', id)
      .maybeSingle();

    if (khachError) throw khachError;
    if (!khach) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }

    const laAdmin = req.user.role === 'admin';
    const cu = khach.phu_trach_id ?? null;

    if (!laAdmin) {
      const tuNhan = moi === req.user.id && cu === null;
      const tuBo = moi === null && cu === req.user.id;
      if (!tuNhan && !tuBo) {
        return res.status(403).json({
          success: false,
          message:
            'Bạn chỉ được nhận khách chưa ai phụ trách, hoặc bỏ khách của chính mình.',
        });
      }
    }

    // Người được gán phải là tài khoản đang hoạt động
    let tenMoi = null;
    if (moi !== null) {
      const { data: nv, error: nvError } = await supabase
        .from('users')
        .select('id, username, ho_ten, active')
        .eq('id', moi)
        .maybeSingle();

      if (nvError) throw nvError;
      if (!nv || nv.active === false) {
        return res.status(400).json({
          success: false,
          message: 'Tài khoản được chọn không tồn tại hoặc đã bị khoá.',
        });
      }
      tenMoi = nv.ho_ten || nv.username;
    }

    const { data, error } = await supabase
      .from('customers')
      .update({ phu_trach_id: moi })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    ghiNhatKy(req.user, {
      hanh_dong: 'sua',
      doi_tuong: 'khach_hang',
      doi_tuong_id: id,
      mo_ta: moi
        ? `Giao khách "${khach.ten_khach_hang}" (${khach.so_dien_thoai}) cho ${tenMoi}`
        : `Bỏ người phụ trách khách "${khach.ten_khach_hang}" (${khach.so_dien_thoai})`,
    });

    return res.json({
      success: true,
      message: moi ? `Đã giao cho ${tenMoi}.` : 'Đã bỏ người phụ trách.',
      data,
    });
  } catch (err) {
    console.error('[customers/phu-trach]', err);
    return res
      .status(500)
      .json({ success: false, message: 'Không thể đổi người phụ trách.' });
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
    // Lấy cả khách đang nằm trong thùng rác: số điện thoại vẫn chiếm chỗ
    // trong ràng buộc UNIQUE, không tra ra thì lệnh thêm mới sẽ đổ.
    const { data: daCo, error: traError } = await supabase
      .from('customers')
      .select('id, so_dien_thoai, deleted_at')
      .in('so_dien_thoai', dsSo);

    if (traError) throw traError;

    const banDoCu = new Map((daCo || []).map((c) => [c.so_dien_thoai, c]));

    const themMoi = [];
    const capNhat = [];
    const khoiPhuc = [];
    let boQua = 0;

    hopLe.forEach(({ value }) => {
      const cu = banDoCu.get(value.so_dien_thoai);
      const idCu = cu?.id;

      // Nằm trong thùng rác mà lại có trong file nhập nghĩa là khách này
      // cần tồn tại. Khôi phục bất kể chế độ nào — nếu chỉ "bỏ qua" thì
      // người dùng nhập xong không thấy khách đâu mà cũng không hiểu vì sao.
      if (cu?.deleted_at) {
        khoiPhuc.push({ id: idCu, value });
        return;
      }

      if (!idCu) {
        // Chỉ khách MỚI mới gán giá trị mặc định. Gán cho cả bản ghi cũ
        // sẽ biến khách VIP thành Thường chỉ vì file không có cột phân loại.
        themMoi.push({
          ...value,
          phan_loai: value.phan_loai || 'Thường',
          trang_thai: 'Mới',
        });
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

    // Khôi phục khách trong thùng rác, kèm cập nhật thông tin từ file
    for (const { id, value } of khoiPhuc) {
      const { trang_thai, ...phanConLai } = value;
      const capNhatThat = { deleted_at: null, deleted_by: null };
      Object.entries(phanConLai).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') capNhatThat[k] = v;
      });

      const { error } = await supabase
        .from('customers')
        .update(capNhatThat)
        .eq('id', id);
      if (error) throw error;
    }

    // Cập nhật từng dòng một. Supabase không có lệnh cập nhật hàng loạt theo
    // id khác nhau, và số dòng trùng thường ít nên chấp nhận được.
    for (const { id, value } of capNhat) {
      // Không đụng tới trạng thái chăm sóc của khách đã có: nhập lại file
      // mà xoá mất tiến trình chăm sóc thì tai hại hơn nhiều so với lợi ích.
      const { trang_thai, ...phanConLai } = value;

      // Chỉ ghi đè những trường thực sự có dữ liệu trong file.
      // Nếu ghi đè cả trường rỗng thì một file thiếu cột Địa chỉ sẽ xoá
      // sạch địa chỉ của mọi khách hàng trong đó — mất dữ liệu âm thầm,
      // không có cách nào lấy lại.
      const capNhatThat = {};
      Object.entries(phanConLai).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== '') capNhatThat[k] = v;
      });

      if (Object.keys(capNhatThat).length === 0) continue;

      const { error } = await supabase
        .from('customers')
        .update(capNhatThat)
        .eq('id', id);
      if (error) throw error;
    }

    ghiNhatKy(req.user, {
      hanh_dong: 'tao',
      doi_tuong: 'khach_hang',
      mo_ta: `Nhập từ file: thêm ${themMoi.length}, cập nhật ${capNhat.length}, khôi phục ${khoiPhuc.length}, bỏ qua ${boQua}, lỗi ${loi.length}`,
    });

    return res.json({
      success: true,
      message: 'Đã nhập xong.',
      ket_qua: {
        them_moi: themMoi.length,
        cap_nhat: capNhat.length,
        khoi_phuc: khoiPhuc.length,
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
