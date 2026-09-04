// Báo cáo theo nhân viên — dành cho admin theo dõi tiến độ cả nhóm.
//
// Cố ý là BẢNG chứ không phải biểu đồ. Với vài nhân viên và bảy cột số đều
// có ý nghĩa riêng, người quản lý cần đọc đúng con số ("Lynth còn 141 khách
// chưa gọi"), không phải ước lượng chiều dài một cái cột. Chỉ tỉ lệ hoàn
// thành là dựng thanh, vì đó là thứ duy nhất cần so sánh bằng mắt.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { customerAPI, getErrorMessage } from '../services/api';
import { TRANG_THAI_LIST } from '../constants';
import Spinner from '../components/Spinner';

/** Các cột trạng thái, bỏ "Mới" vì đã có cột "Chưa gọi" riêng */
const COT_TRANG_THAI = TRANG_THAI_LIST.filter((t) => t !== 'Mới');

/** Nhãn ngắn cho đầu bảng — tên trạng thái đầy đủ làm cột quá rộng */
const NHAN_NGAN = {
  'Không liên lạc được': 'Không gặp',
  'Đã gọi': 'Đã gọi',
  'Hẹn gọi lại': 'Hẹn lại',
  'Chốt': 'Chốt',
  'Từ chối': 'Từ chối',
};

/** Tên hiển thị của một dòng trong báo cáo */
function tenHienThi(u) {
  if (u.ho_ten) return u.ho_ten;
  if (u.username) return u.username;
  // Tài khoản đã bị xoá hẳn nhưng khách vẫn còn gắn id cũ
  return `Tài khoản đã xoá (#${u.id})`;
}

/* ------------------------------------------------------------------ */
/* Thanh tiến độ                                                       */
/* ------------------------------------------------------------------ */

/**
 * Tỉ lệ khách đã liên hệ ít nhất một lần.
 *
 * Nền dùng sắc độ nhạt của chính màu xanh OCB chứ không phải xám: cùng một
 * dải màu thì mắt đọc được phần đã đi so với phần còn lại, thay vì thấy hai
 * vật thể khác nhau đặt cạnh nhau.
 */
function ThanhTienDo({ xong, tong }) {
  const phanTram = tong > 0 ? Math.round((xong / tong) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-ocb-green-light"
        role="img"
        aria-label={`Đã liên hệ ${xong} trên ${tong} khách, đạt ${phanTram} phần trăm`}
      >
        <div
          className="h-full rounded-full bg-ocb-green transition-all"
          style={{ width: `${phanTram}%` }}
        />
      </div>
      <span className="tabular-nums text-xs text-slate-500">{phanTram}%</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ô số trong bảng                                                     */
/* ------------------------------------------------------------------ */

/** Số 0 để nhạt hẳn đi, để mắt chỉ dừng ở những ô thật sự có gì đó */
function O({ so, manh }) {
  return (
    <td
      className={`whitespace-nowrap px-3 py-3 text-right tabular-nums ${
        so === 0 ? 'text-slate-300' : manh ? 'font-semibold text-slate-800' : 'text-slate-600'
      }`}
    >
      {so}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Màn hình chính                                                      */
/* ------------------------------------------------------------------ */

export default function BaoCaoNhanVien() {
  const [duLieu, setDuLieu] = useState(null);
  const [loading, setLoading] = useState(true);

  const tai = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await customerAPI.baoCaoNhanVien();
      setDuLieu(data.data || null);
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error(getErrorMessage(error, 'Không tải được báo cáo.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    tai();
  }, [tai]);

  if (loading) {
    return (
      <main className="flex items-center gap-2 p-6 text-sm text-slate-500">
        <Spinner size="sm" className="text-ocb-green" />
        Đang tính số liệu...
      </main>
    );
  }

  if (!duLieu) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-500">Chưa có số liệu.</p>
        <button type="button" onClick={() => tai()} className="btn-ghost mt-3 !py-2">
          Thử lại
        </button>
      </main>
    );
  }

  const { nhan_vien = [], chua_giao, tong } = duLieu;

  // Dòng tổng cộng gộp cả phần chưa giao, để con số cuối bảng luôn khớp với
  // tổng khách hàng của hệ thống — người đọc hay lấy dòng này ra đối chiếu.
  const cong = {
    duoc_giao: nhan_vien.reduce((t, u) => t + u.duoc_giao, 0) + (chua_giao?.duoc_giao || 0),
    da_lien_he: nhan_vien.reduce((t, u) => t + u.da_lien_he, 0) + (chua_giao?.da_lien_he || 0),
    trang_thai: {},
  };
  TRANG_THAI_LIST.forEach((t) => {
    cong.trang_thai[t] =
      nhan_vien.reduce((s, u) => s + (u.trang_thai?.[t] || 0), 0) +
      (chua_giao?.trang_thai?.[t] || 0);
  });

  return (
    <main className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Báo cáo theo nhân viên</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Tiến độ chăm sóc trên {cong.duoc_giao} khách hàng của toàn hệ thống
          </p>
        </div>

        <button type="button" onClick={() => tai()} className="btn-ghost !py-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Tải lại
        </button>
      </div>

      {/* ---------- Bảng chính ---------- */}
      <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          {/* 10 cột số: hẹp hơn mức này là đầu bảng bị bóp xuống dòng lung tung.
                Thà cuộn ngang còn hơn bảng chữ dồn cục. */}
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">Nhân viên</th>
                <th className="px-3 py-3 text-right font-semibold">Được giao</th>
                <th className="px-3 py-3 font-semibold">Tiến độ</th>
                <th className="px-3 py-3 text-right font-semibold">Chưa gọi</th>
                {COT_TRANG_THAI.map((t) => (
                  <th key={t} className="px-3 py-3 text-right font-semibold" title={t}>
                    {NHAN_NGAN[t] || t}
                  </th>
                ))}
                {/* Hai cột cuối đếm LƯỢT GỌI, không phải số khách — một khách
                    gọi ba lần là ba lượt. Ghi rõ ở đây để không ai cộng nhầm
                    chúng vào các cột bên trái. */}
                <th className="border-l border-slate-200 px-3 py-3 text-right font-semibold">
                  Lượt gọi<br />hôm nay
                </th>
                <th className="px-3 py-3 text-right font-semibold">
                  Lượt gọi<br />7 ngày
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {nhan_vien.map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-slate-800">{tenHienThi(u)}</span>
                    {!u.active && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-300">
                        Đã khoá
                      </span>
                    )}
                  </td>
                  <O so={u.duoc_giao} manh />
                  <td className="px-3 py-3">
                    <ThanhTienDo xong={u.da_lien_he} tong={u.duoc_giao} />
                  </td>
                  <O so={u.trang_thai?.['Mới'] || 0} />
                  {COT_TRANG_THAI.map((t) => (
                    <O key={t} so={u.trang_thai?.[t] || 0} manh={t === 'Chốt'} />
                  ))}
                  <td className="whitespace-nowrap border-l border-slate-200 px-3 py-3 text-right tabular-nums font-semibold text-slate-800">
                    {u.goi_hom_nay || <span className="font-normal text-slate-300">0</span>}
                  </td>
                  <O so={u.goi_7_ngay} />
                </tr>
              ))}

              {/* Khách chưa giao cho ai. Vẫn phải nằm trong bảng, nếu không
                  cộng các dòng lại sẽ thiếu so với tổng hệ thống. */}
              {chua_giao?.duoc_giao > 0 && (
                <tr className="bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 italic text-slate-500">
                    Chưa giao cho ai
                  </td>
                  <O so={chua_giao.duoc_giao} />
                  <td className="px-3 py-3">
                    <ThanhTienDo xong={chua_giao.da_lien_he} tong={chua_giao.duoc_giao} />
                  </td>
                  <O so={chua_giao.trang_thai?.['Mới'] || 0} />
                  {COT_TRANG_THAI.map((t) => (
                    <O key={t} so={chua_giao.trang_thai?.[t] || 0} />
                  ))}
                  <td className="border-l border-slate-200 px-3 py-3 text-right text-slate-300">
                    —
                  </td>
                  <td className="px-3 py-3 text-right text-slate-300">—</td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="whitespace-nowrap px-4 py-3">Tổng cộng</td>
                <O so={cong.duoc_giao} manh />
                <td className="px-3 py-3">
                  <ThanhTienDo xong={cong.da_lien_he} tong={cong.duoc_giao} />
                </td>
                <O so={cong.trang_thai['Mới'] || 0} manh />
                {COT_TRANG_THAI.map((t) => (
                  <O key={t} so={cong.trang_thai[t] || 0} manh />
                ))}
                <td className="whitespace-nowrap border-l border-slate-200 px-3 py-3 text-right tabular-nums">
                  {tong?.goi_hom_nay ?? 0}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                  {tong?.goi_7_ngay ?? 0}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-slate-500">
        <span className="font-medium text-slate-600">Tiến độ</span> là tỉ lệ khách đã
        được liên hệ ít nhất một lần, tính trên số khách người đó được giao.{' '}
        <span className="font-medium text-slate-600">Lượt gọi</span> đếm số lần ghi
        nhận chăm sóc — gọi lại một khách ba lần là ba lượt, nên hai cột cuối không
        cộng chung với các cột trạng thái được.
      </p>
    </main>
  );
}
