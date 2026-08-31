// Modal nhập danh sách khách hàng từ file Excel / CSV.
//
// File được đọc và kiểm tra ngay trên trình duyệt, chỉ những dòng hợp lệ
// mới gửi lên server. Nhờ vậy người dùng thấy trước mình sắp nhập cái gì,
// và server không phải nhận file thô.
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

import { customerAPI, getErrorMessage } from '../services/api';
import { PHAN_LOAI_LIST } from '../constants';
import { chuanHoaSoDienThoai } from '../utils/dienThoai';
import Spinner from './Spinner';

const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])[0-9]{7}$/;

// Server nhận tối đa 500 dòng mỗi lần, file lớn được cắt thành nhiều lô
const SO_DONG_MOI_LO = 500;

/** Bỏ dấu và chuẩn hoá tên cột để nhận diện được nhiều cách viết khác nhau */
const chuanHoaTenCot = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Các tên cột chấp nhận được cho từng trường.
// Nhận cả tên file do chính hệ thống xuất ra lẫn vài cách gọi thông dụng.
const BAN_DO_COT = {
  so_dien_thoai: ['sodienthoai', 'sdt', 'dienthoai', 'phone', 'sodt'],
  ten_khach_hang: ['tenkhachhang', 'hoten', 'ten', 'khachhang', 'name'],
  dia_chi: ['diachi', 'address'],
  phan_loai: ['phanloai', 'loai', 'nhom'],
  ghi_chu: ['ghichu', 'note', 'notes', 'ghichuthem'],
};

/** Tìm tên cột thực tế trong file ứng với từng trường trong hệ thống */
function doiChieuCot(headers) {
  const banDo = {};
  const daChuanHoa = headers.map((h) => ({ goc: h, chuan: chuanHoaTenCot(h) }));

  Object.entries(BAN_DO_COT).forEach(([truong, cacTen]) => {
    const khop = daChuanHoa.find((h) => cacTen.includes(h.chuan));
    if (khop) banDo[truong] = khop.goc;
  });

  return banDo;
}

export default function ImportModal({ open, onClose, onDone }) {
  const inputRef = useRef(null);
  const [tenFile, setTenFile] = useState('');
  const [dangDoc, setDangDoc] = useState(false);
  const [dangNhap, setDangNhap] = useState(false);
  const [tienDo, setTienDo] = useState(0);
  const [rows, setRows] = useState([]); // { dong, du_lieu, loi }
  const [cheDo, setCheDo] = useState('bo_qua');
  const [ketQua, setKetQua] = useState(null);

  useEffect(() => {
    if (open) {
      setTenFile('');
      setRows([]);
      setKetQua(null);
      setTienDo(0);
      setCheDo('bo_qua');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !dangNhap) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, dangNhap]);

  const hopLe = useMemo(() => rows.filter((r) => !r.loi), [rows]);
  const coLoi = useMemo(() => rows.filter((r) => r.loi), [rows]);

  if (!open) return null;

  /** Tải file mẫu để người dùng biết cần những cột gì */
  const taiFileMau = () => {
    const mau = [
      {
        'Số điện thoại': '0901234567',
        'Tên khách hàng': 'Nguyễn Văn A',
        'Địa chỉ': '12 Nguyễn Huệ, Quận 1, TP.HCM',
        'Phân loại': 'Tiềm năng',
        'Ghi chú': 'Quan tâm vay mua nhà',
      },
      {
        'Số điện thoại': '0987654321',
        'Tên khách hàng': 'Trần Thị B',
        'Địa chỉ': '',
        'Phân loại': 'Thường',
        'Ghi chú': '',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(mau);
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 34 }, { wch: 12 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Khách hàng');
    XLSX.writeFile(wb, 'Mau-nhap-khach-hang-OCB.xlsx');
  };

  /** Đọc file và kiểm tra từng dòng ngay trên trình duyệt */
  const docFile = async (file) => {
    setDangDoc(true);
    setKetQua(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('File không có sheet nào.');

      // defval: '' để ô trống vẫn có mặt, tránh lệch cột
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (raw.length === 0) throw new Error('File không có dòng dữ liệu nào.');

      const banDo = doiChieuCot(Object.keys(raw[0]));

      if (!banDo.so_dien_thoai || !banDo.ten_khach_hang) {
        throw new Error(
          'File phải có cột "Số điện thoại" và "Tên khách hàng". Bấm "Tải file mẫu" để xem định dạng đúng.'
        );
      }

      const ketQuaDoc = raw.map((r, i) => {
        // +2 vì dòng 1 là tiêu đề và Excel đếm từ 1
        const dong = i + 2;

        const sdtGoc = r[banDo.so_dien_thoai];
        const sdt = chuanHoaSoDienThoai(sdtGoc);
        const ten = String(r[banDo.ten_khach_hang] ?? '').trim();
        const loai = banDo.phan_loai ? String(r[banDo.phan_loai] ?? '').trim() : '';

        let loi = null;
        if (!sdt) loi = 'Thiếu số điện thoại';
        else if (!PHONE_REGEX.test(sdt))
          loi = `Số điện thoại không hợp lệ (đọc được: "${sdt}")`;
        else if (!ten) loi = 'Thiếu tên khách hàng';
        else if (ten.length < 2) loi = 'Tên quá ngắn';
        else if (loai && !PHAN_LOAI_LIST.includes(loai))
          loi = `Phân loại "${loai}" không hợp lệ`;

        // Chỉ gửi lên những trường file thực sự có dữ liệu.
        // Gửi cả ô trống thì chế độ Cập nhật sẽ xoá mất dữ liệu đang có
        // của những cột không nằm trong file.
        const du_lieu = { __dong: dong, so_dien_thoai: sdt, ten_khach_hang: ten };

        const diaChi = banDo.dia_chi ? String(r[banDo.dia_chi] ?? '').trim() : '';
        if (diaChi) du_lieu.dia_chi = diaChi;

        if (loai) du_lieu.phan_loai = loai;

        const ghiChu = banDo.ghi_chu ? String(r[banDo.ghi_chu] ?? '').trim() : '';
        if (ghiChu) du_lieu.ghi_chu = ghiChu;

        return { dong, loi, du_lieu };
      });

      setRows(ketQuaDoc);
      setTenFile(file.name);
    } catch (error) {
      toast.error(error.message || 'Không đọc được file.');
      setRows([]);
      setTenFile('');
    } finally {
      setDangDoc(false);
      // Đặt lại input để chọn đúng file đó lần nữa vẫn kích hoạt sự kiện
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  /** Gửi các dòng hợp lệ lên server, cắt thành từng lô */
  const nhapDuLieu = async () => {
    if (hopLe.length === 0) return;

    setDangNhap(true);
    setTienDo(0);
    const tong = { them_moi: 0, cap_nhat: 0, bo_qua: 0, loi: [] };

    try {
      for (let i = 0; i < hopLe.length; i += SO_DONG_MOI_LO) {
        const lo = hopLe.slice(i, i + SO_DONG_MOI_LO).map((r) => r.du_lieu);
        const { data } = await customerAPI.importRows({ rows: lo, che_do: cheDo });

        const kq = data.ket_qua || {};
        tong.them_moi += kq.them_moi || 0;
        tong.cap_nhat += kq.cap_nhat || 0;
        tong.bo_qua += kq.bo_qua || 0;
        if (kq.loi?.length) tong.loi.push(...kq.loi);

        setTienDo(Math.min(i + SO_DONG_MOI_LO, hopLe.length));
      }

      setKetQua(tong);
      toast.success(
        `Đã thêm ${tong.them_moi} khách hàng${tong.cap_nhat ? `, cập nhật ${tong.cap_nhat}` : ''}.`
      );
      onDone();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không nhập được dữ liệu.'));
    } finally {
      setDangNhap(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !dangNhap) onClose();
      }}
    >
      <div className="animate-fade-in-up flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="import-title" className="text-lg font-bold text-slate-800">
            Nhập khách hàng từ file
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={dangNhap}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* ---------- Kết quả sau khi nhập ---------- */}
          {ketQua ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-ocb-green-light p-4 ring-1 ring-ocb-green/20">
                <p className="text-sm font-semibold text-ocb-green-dark">
                  Nhập xong
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  <li>Thêm mới: <strong>{ketQua.them_moi}</strong> khách hàng</li>
                  {ketQua.cap_nhat > 0 && (
                    <li>Cập nhật: <strong>{ketQua.cap_nhat}</strong> khách hàng</li>
                  )}
                  {ketQua.bo_qua > 0 && (
                    <li>Bỏ qua vì đã tồn tại: <strong>{ketQua.bo_qua}</strong></li>
                  )}
                  {ketQua.loi.length > 0 && (
                    <li className="text-red-700">
                      Lỗi: <strong>{ketQua.loi.length}</strong> dòng
                    </li>
                  )}
                </ul>
              </div>

              {ketQua.loi.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-slate-200">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {ketQua.loi.map((l, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 tabular-nums text-slate-400">
                            Dòng {l.dong}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{l.so_dien_thoai}</td>
                          <td className="px-3 py-2 text-red-600">{l.ly_do}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ---------- Chọn file ---------- */}
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files?.[0] && docFile(e.target.files[0])}
                    className="hidden"
                    id="import-file"
                  />
                  <label htmlFor="import-file" className="btn-primary cursor-pointer">
                    {dangDoc ? (
                      <>
                        <Spinner size="sm" className="text-white" />
                        Đang đọc...
                      </>
                    ) : (
                      'Chọn file Excel'
                    )}
                  </label>

                  <button type="button" onClick={taiFileMau} className="btn-ghost">
                    Tải file mẫu
                  </button>

                  {tenFile && (
                    <span className="truncate text-sm text-slate-500">{tenFile}</span>
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Chấp nhận .xlsx, .xls, .csv. Bắt buộc có cột{' '}
                  <strong>Số điện thoại</strong> và <strong>Tên khách hàng</strong>.
                  Các cột Địa chỉ, Phân loại, Ghi chú là tuỳ chọn.
                </p>
              </div>

              {/* ---------- Kết quả đọc file ---------- */}
              {rows.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                      <p className="text-xs text-slate-500">Đọc được</p>
                      <p className="text-xl font-bold tabular-nums text-slate-800">
                        {rows.length}
                      </p>
                    </div>
                    <div className="rounded-lg bg-ocb-green-light p-3 ring-1 ring-ocb-green/20">
                      <p className="text-xs text-ocb-green-dark">Hợp lệ</p>
                      <p className="text-xl font-bold tabular-nums text-ocb-green-dark">
                        {hopLe.length}
                      </p>
                    </div>
                    <div className="rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
                      <p className="text-xs text-red-700">Lỗi</p>
                      <p className="text-xl font-bold tabular-nums text-red-700">
                        {coLoi.length}
                      </p>
                    </div>
                  </div>

                  {coLoi.length > 0 && (
                    <div>
                      <p className="mb-2 text-sm font-medium text-slate-700">
                        Các dòng bị bỏ qua vì lỗi
                        {coLoi.length > 20 && ' (20 dòng đầu)'}
                      </p>
                      <div className="max-h-40 overflow-y-auto rounded-lg ring-1 ring-slate-200">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {coLoi.slice(0, 20).map((r) => (
                              <tr key={r.dong}>
                                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-400">
                                  Dòng {r.dong}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {r.du_lieu.ten_khach_hang || '(trống)'}
                                </td>
                                <td className="px-3 py-2 text-red-600">{r.loi}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ---------- Xử lý số điện thoại trùng ---------- */}
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-slate-700">
                      Nếu số điện thoại đã có trong hệ thống
                    </legend>
                    <div className="space-y-2">
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="che_do"
                          value="bo_qua"
                          checked={cheDo === 'bo_qua'}
                          onChange={() => setCheDo('bo_qua')}
                          className="mt-0.5 accent-ocb-green"
                        />
                        <span className="text-sm">
                          <span className="font-medium text-slate-800">Bỏ qua</span>
                          <span className="block text-xs text-slate-500">
                            Giữ nguyên dữ liệu đang có, không ghi đè gì cả.
                          </span>
                        </span>
                      </label>

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="che_do"
                          value="cap_nhat"
                          checked={cheDo === 'cap_nhat'}
                          onChange={() => setCheDo('cap_nhat')}
                          className="mt-0.5 accent-ocb-green"
                        />
                        <span className="text-sm">
                          <span className="font-medium text-slate-800">
                            Cập nhật thông tin
                          </span>
                          <span className="block text-xs text-slate-500">
                            Ghi đè tên, địa chỉ, phân loại, ghi chú bằng dữ liệu
                            trong file. Cột không có trong file hoặc ô để trống
                            thì giữ nguyên, không bị xoá. Trạng thái chăm sóc và
                            lịch sử liên hệ luôn được giữ.
                          </span>
                        </span>
                      </label>
                    </div>
                  </fieldset>
                </>
              )}
            </>
          )}
        </div>

        {/* ---------- Nút hành động ---------- */}
        <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
          {dangNhap && (
            <span className="text-sm tabular-nums text-slate-500">
              {tienDo} / {hopLe.length}
            </span>
          )}

          <div className="ml-auto flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={dangNhap}
              className="btn-ghost"
            >
              {ketQua ? 'Đóng' : 'Huỷ'}
            </button>

            {!ketQua && (
              <button
                type="button"
                onClick={nhapDuLieu}
                disabled={dangNhap || hopLe.length === 0}
                className="btn-primary"
              >
                {dangNhap ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    Đang nhập...
                  </>
                ) : (
                  `Nhập ${hopLe.length} khách hàng`
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
