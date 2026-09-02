// Màn hình "Việc hôm nay" — nơi bắt đầu ngày làm việc.
//
// Gom sẵn ba nhóm việc thay vì bắt người dùng tự lọc bảng mỗi sáng:
// quá hạn gọi lại, hẹn gọi trong hôm nay, và lead mới chưa ai nhận.
//
// Mỗi nhóm phân trang RIÊNG: chuyển trang ở nhóm này không tải lại hai nhóm
// kia. Mỗi trang chỉ 10 dòng — đây là danh sách để làm việc, không phải để
// tra cứu, nên nhìn được hết trong một màn hình quan trọng hơn là thấy nhiều.
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { customerAPI, getUser, isAdmin, getErrorMessage } from '../services/api';
import { MUC_LUONG_BADGE, TRANG_THAI_BADGE } from '../constants';
import Spinner from '../components/Spinner';
import ContactModal from '../components/ContactModal';

const SO_DONG_MOI_TRANG = 10;

/** Định dạng giờ hẹn: hôm nay thì chỉ hiện giờ, khác ngày thì kèm ngày */
function formatHen(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const homNay = new Date();
  const cungNgay =
    d.getDate() === homNay.getDate() &&
    d.getMonth() === homNay.getMonth() &&
    d.getFullYear() === homNay.getFullYear();

  const gio = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (cungNgay) return gio;
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${gio}`;
}

/** Khoảng cách thời gian so với bây giờ, dạng chữ: "quá 2 giờ", "còn 45 phút" */
function khoangCach(value) {
  if (!value) return '';
  const lech = new Date(value).getTime() - Date.now();
  const phut = Math.round(Math.abs(lech) / 60000);
  const qua = lech < 0;

  let mo;
  if (phut < 60) mo = `${phut} phút`;
  else if (phut < 60 * 24) mo = `${Math.round(phut / 60)} giờ`;
  else mo = `${Math.round(phut / (60 * 24))} ngày`;

  return qua ? `quá ${mo}` : `còn ${mo}`;
}

/* ------------------------------------------------------------------ */
/* Hook: một nhóm việc, tự quản trang của mình                          */
/* ------------------------------------------------------------------ */

/**
 * @param {() => object} layThamSo - HÀM trả về bộ lọc gửi lên API.
 *
 * Nhận hàm chứ không nhận đối tượng, để những mốc phụ thuộc thời gian
 * ("cuối ngày hôm nay") được tính lại mỗi lần gọi. Truyền đối tượng đã
 * memo hoá thì mốc đó đóng băng từ lúc mở trang, để máy chạy qua nửa đêm
 * là danh sách "hẹn hôm nay" sai hẳn ngày.
 *
 * Hàm PHẢI ổn định (bọc useCallback ở nơi gọi), nếu không sẽ gọi API vô hạn.
 */
function useNhomViec(layThamSo) {
  const [danhSach, setDanhSach] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const tai = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await customerAPI.getAll({
          ...layThamSo(),
          page,
          limit: SO_DONG_MOI_TRANG,
        });
        setDanhSach(data.data || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (error) {
        if (error?.response?.status !== 401) {
          toast.error(getErrorMessage(error, 'Không tải được danh sách việc.'));
        }
      } finally {
        setLoading(false);
      }
    },
    [layThamSo, page]
  );

  useEffect(() => {
    tai();
  }, [tai]);

  return { danhSach, total, totalPages, page, setPage, loading, tai };
}

/* ------------------------------------------------------------------ */
/* Thanh chuyển trang gọn cho từng nhóm                                */
/* ------------------------------------------------------------------ */

function ChuyenTrang({ page, totalPages, total, onPage }) {
  // Vừa một trang thì không cần thanh điều hướng
  if (total <= SO_DONG_MOI_TRANG) return null;

  const tu = (page - 1) * SO_DONG_MOI_TRANG + 1;
  const den = Math.min(page * SO_DONG_MOI_TRANG, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5">
      <span className="text-xs tabular-nums text-slate-500">
        {tu}&ndash;{den} trên {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trước
        </button>
        <span className="px-1 text-xs tabular-nums text-slate-500">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sau
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Một nhóm việc                                                       */
/* ------------------------------------------------------------------ */

function NhomViec({ tieuDe, moTa, mau, nhom, onChamSoc, onNhan, dangNhanId }) {
  const { danhSach, total, totalPages, page, setPage, loading } = nhom;

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div
        className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"
        style={{ borderLeft: `4px solid ${mau}` }}
      >
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-800">
            {tieuDe}
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: mau }}
            >
              {loading ? '…' : total}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{moTa}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
          <Spinner size="sm" className="text-ocb-green" />
          Đang tải...
        </div>
      ) : danhSach.length === 0 ? (
        <p className="px-5 py-8 text-sm text-slate-400">Không có việc nào. </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {danhSach.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 px-5 py-3.5 transition hover:bg-slate-50 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-slate-800">
                      {c.ten_khach_hang}
                    </span>
                    <span className="tabular-nums text-sm text-slate-500">
                      {c.so_dien_thoai}
                    </span>
                    {c.muc_luong && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          MUC_LUONG_BADGE[c.muc_luong] ||
                          'bg-slate-100 text-slate-600 ring-slate-300'
                        }`}
                      >
                        {c.muc_luong}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {c.hen_goi_lai ? (
                      <>
                        <span>Hẹn {formatHen(c.hen_goi_lai)}</span>
                        <span
                          className={
                            new Date(c.hen_goi_lai).getTime() <= Date.now()
                              ? 'font-semibold text-amber-700'
                              : ''
                          }
                        >
                          · {khoangCach(c.hen_goi_lai)}
                        </span>
                      </>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${
                          TRANG_THAI_BADGE[c.trang_thai] ||
                          'bg-slate-100 text-slate-600 ring-slate-300'
                        }`}
                      >
                        {c.trang_thai}
                      </span>
                    )}
                    {c.nghe_nghiep && <span>· {c.nghe_nghiep}</span>}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {onNhan && (
                    <button
                      type="button"
                      onClick={() => onNhan(c)}
                      disabled={dangNhanId === c.id}
                      className="whitespace-nowrap rounded-lg bg-ocb-orange-light px-3 py-1.5 text-xs font-semibold text-ocb-orange-dark transition hover:bg-ocb-orange hover:text-white disabled:opacity-50"
                    >
                      {dangNhanId === c.id ? 'Đang nhận...' : 'Nhận khách'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onChamSoc(c)}
                    className="whitespace-nowrap rounded-lg bg-ocb-green px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ocb-green-dark"
                  >
                    Chăm sóc
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <ChuyenTrang
            page={page}
            totalPages={totalPages}
            total={total}
            onPage={setPage}
          />
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Màn hình chính                                                      */
/* ------------------------------------------------------------------ */

export default function ViecHomNay() {
  const user = getUser();
  const quanTri = isAdmin();

  const [contacting, setContacting] = useState(null);
  const [dangNhanId, setDangNhanId] = useState(null);

  // Admin nhìn việc của cả nhóm, nhân viên chỉ nhìn phần mình phụ trách
  const cuaAi = quanTri ? undefined : 'me';

  // Cuối ngày hôm nay tính theo múi giờ TRÌNH DUYỆT rồi mới gửi lên,
  // không để server tự đoán "hôm nay" theo giờ máy chủ.
  const tsQuaHan = useCallback(
    () => ({ den_han: 1, phu_trach: cuaAi, sort: 'hen_goi_lai', order: 'asc' }),
    [cuaAi]
  );
  // Mốc thời gian tính lại mỗi lần gọi, không đóng băng từ lúc mở trang
  const tsHomNay = useCallback(() => {
    const cuoiNgay = new Date();
    cuoiNgay.setHours(23, 59, 59, 999);
    return {
      hen_tu: new Date().toISOString(),
      hen_den: cuoiNgay.toISOString(),
      phu_trach: cuaAi,
      sort: 'hen_goi_lai',
      order: 'asc',
    };
  }, [cuaAi]);
  // Khách của mình chưa gọi lần nào. Đây là phần việc LỚN NHẤT của nhân
  // viên lúc mới nhận danh sách, mà bản đầu tôi lại bỏ sót — màn hình báo
  // "không có việc nào" trong khi mỗi người có hơn trăm khách phải gọi.
  const tsChuaGoi = useCallback(
    () => ({
      phu_trach: cuaAi,
      trang_thai: 'Mới',
      sort: 'created_at',
      order: 'desc',
    }),
    [cuaAi]
  );
  const tsChuaGiao = useCallback(
    () => ({
      phu_trach: 'none',
      trang_thai: 'Mới',
      sort: 'created_at',
      order: 'desc',
    }),
    []
  );

  const nhomQuaHan = useNhomViec(tsQuaHan);
  const nhomHomNay = useNhomViec(tsHomNay);
  const nhomChuaGoi = useNhomViec(tsChuaGoi);
  const nhomChuaGiao = useNhomViec(tsChuaGiao);

  /** Nạp lại cả ba nhóm */
  const taiTatCa = useCallback(
    (silent = false) => {
      nhomQuaHan.tai(silent);
      nhomHomNay.tai(silent);
      nhomChuaGoi.tai(silent);
      nhomChuaGiao.tai(silent);
    },
    [nhomQuaHan, nhomHomNay, nhomChuaGoi, nhomChuaGiao]
  );

  /** Nhận phụ trách một khách ngay từ màn hình này */
  const nhanKhach = async (customer) => {
    setDangNhanId(customer.id);
    try {
      await customerAPI.setPhuTrach(customer.id, user?.id);
      toast.success(`Đã nhận "${customer.ten_khach_hang}".`);
      // Khách chuyển từ nhóm "chưa giao" sang phần việc của mình,
      // nên phải nạp lại cả ba nhóm chứ không riêng nhóm đang đứng.
      taiTatCa(true);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không nhận được khách.'));
    } finally {
      setDangNhanId(null);
    }
  };

  const dangTai = nhomQuaHan.loading || nhomHomNay.loading || nhomChuaGoi.loading;
  // Tính cả nhóm chưa gọi: đó mới là phần việc thật sự phải làm trong ngày
  const tongViec = nhomQuaHan.total + nhomHomNay.total + nhomChuaGoi.total;

  const loiChao = useMemo(() => {
    const gio = new Date().getHours();
    if (gio < 11) return 'Chào buổi sáng';
    if (gio < 14) return 'Chào buổi trưa';
    if (gio < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  return (
    <main className="space-y-5 p-4 sm:p-6">
      {/* Lời chào + tóm tắt */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            {loiChao}, {user?.ho_ten || user?.username}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {dangTai
              ? 'Đang xem hôm nay có việc gì...'
              : tongViec === 0
                ? 'Không có cuộc hẹn nào cần xử lý. '
                : `Bạn có ${tongViec} cuộc gọi cần thực hiện.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => taiTatCa()}
          disabled={dangTai}
          className="btn-ghost !py-2"
        >
          {dangTai ? (
            <Spinner size="sm" className="text-ocb-green" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          Tải lại
        </button>
      </div>

      <NhomViec
        tieuDe="Quá hạn gọi lại"
        moTa={
          quanTri
            ? 'Toàn hệ thống — đã qua giờ hẹn mà chưa liên hệ'
            : 'Khách của bạn đã qua giờ hẹn mà chưa liên hệ'
        }
        mau="#DC2626"
        nhom={nhomQuaHan}
        onChamSoc={setContacting}
      />

      <NhomViec
        tieuDe="Hẹn gọi lại hôm nay"
        moTa={
          quanTri
            ? 'Toàn hệ thống — còn trong ngày hôm nay'
            : 'Khách của bạn, còn trong ngày hôm nay'
        }
        mau="#D97706"
        nhom={nhomHomNay}
        onChamSoc={setContacting}
      />

      <NhomViec
        tieuDe="Khách chưa gọi lần nào"
        moTa={
          quanTri
            ? 'Toàn hệ thống — đã có người phụ trách nhưng chưa ai liên hệ'
            : 'Khách bạn phụ trách nhưng chưa liên hệ lần nào'
        }
        mau="#0284C7"
        nhom={nhomChuaGoi}
        onChamSoc={setContacting}
      />

      <NhomViec
        tieuDe="Khách mới chưa ai nhận"
        moTa="Vừa đăng ký qua form, chưa có người phụ trách"
        mau="#7C3AED"
        nhom={nhomChuaGiao}
        onChamSoc={setContacting}
        onNhan={nhanKhach}
        dangNhanId={dangNhanId}
      />

      <p className="text-xs text-slate-400">
        Danh sách tính tại thời điểm mở trang. Bấm <strong>Tải lại</strong> để cập
        nhật. Mỗi nhóm hiển thị {SO_DONG_MOI_TRANG} khách một trang.
      </p>

      <ContactModal
        customer={contacting}
        onClose={() => setContacting(null)}
        onSaved={() => taiTatCa(true)}
      />
    </main>
  );
}
