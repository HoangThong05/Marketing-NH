// Trang quản trị: thống kê, tìm kiếm, lọc và quản lý danh sách khách hàng.
// Chỉ truy cập được sau khi đăng nhập (xem components/ProtectedRoute.jsx).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { customerAPI, clearAuth, getUser, getErrorMessage } from '../services/api';
import OcbLogo from '../components/OcbLogo';
import Spinner, { LoadingBlock } from '../components/Spinner';
import EditCustomerModal from '../components/EditCustomerModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ContactModal from '../components/ContactModal';
import {
  PHAN_LOAI_LIST,
  PHAN_LOAI_MAU,
  PHAN_LOAI_BADGE,
  TRANG_THAI_LIST,
  TRANG_THAI_BADGE,
} from '../constants';

/** Định dạng ngày giờ theo kiểu Việt Nam */
const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/** Định dạng ngày theo kiểu Việt Nam */
const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

/* ------------------------------------------------------------------ */
/* Thẻ thống kê                                                        */
/* ------------------------------------------------------------------ */

function StatCard({ label, value, accent, loading }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-800">
        {loading ? <span className="text-slate-300">--</span> : value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tooltip tuỳ chỉnh cho biểu đồ                                       */
/* ------------------------------------------------------------------ */

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: PHAN_LOAI_MAU[item.name] }}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-slate-700">{item.name}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        <span className="font-semibold tabular-nums text-slate-800">{item.value}</span>{' '}
        khách hàng
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trang Admin                                                         */
/* ------------------------------------------------------------------ */

export default function Admin() {
  const navigate = useNavigate();
  const user = getUser();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLoai, setFilterLoai] = useState('');
  const [editing, setEditing] = useState(null); // khách hàng đang sửa
  const [deletingId, setDeletingId] = useState(null); // id đang xoá
  const [sidebarOpen, setSidebarOpen] = useState(false); // menu trên mobile
  const [doiMatKhau, setDoiMatKhau] = useState(false); // modal đổi mật khẩu
  const [contacting, setContacting] = useState(null); // khách đang chăm sóc
  const [filterTrangThai, setFilterTrangThai] = useState(''); // lọc trạng thái
  const [chiHienDenHan, setChiHienDenHan] = useState(false); // chỉ khách đến hạn gọi
  const bangRef = useRef(null); // để cuộn xuống bảng khi lọc từ banner

  /**
   * Đồng hồ nhịp 30 giây.
   * React chỉ vẽ lại khi state đổi, mà thời gian trôi qua thì không phải
   * là state. Không có nhịp này thì khách đến giờ hẹn vẫn nằm im cho tới
   * khi người dùng bấm Tải lại hoặc F5.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  /**
   * Tải danh sách khách hàng từ backend.
   * @param {boolean} silent - true thì không hiện spinner toàn trang,
   *   dùng cho lần tải lại ngầm khi người dùng quay lại tab.
   */
  const fetchCustomers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await customerAPI.getAll();
      setCustomers(data.data || []);
    } catch (error) {
      // Lỗi 401 đã được interceptor xử lý (tự đăng xuất), ở đây chỉ báo lỗi khác
      if (error?.response?.status !== 401) {
        toast.error(getErrorMessage(error, 'Không thể tải danh sách khách hàng.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Quay lại tab thì tải lại ngầm ngay, để thấy thay đổi của người khác.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchCustomers(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchCustomers]);

  // Tự động lấy dữ liệu mới mỗi 60 giây, để khách vừa đăng ký qua form
  // công khai xuất hiện mà không phải bấm Tải lại.
  // Chỉ chạy khi tab đang được nhìn — tab ẩn thì dữ liệu mới cũng vô nghĩa,
  // gọi API lúc đó chỉ tốn hạn mức.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchCustomers(true);
    }, 60000);
    return () => clearInterval(id);
  }, [fetchCustomers]);

  /* --- Thống kê: đếm theo từng phân loại --- */
  const stats = useMemo(() => {
    const result = { total: customers.length };
    PHAN_LOAI_LIST.forEach((loai) => {
      result[loai] = customers.filter((c) => c.phan_loai === loai).length;
    });
    return result;
  }, [customers]);

  /* --- Khách đã đến hoặc quá hạn hẹn gọi lại --- */
  const denHan = useMemo(() => {
    const bayGio = now;
    return customers.filter(
      (c) => c.hen_goi_lai && new Date(c.hen_goi_lai).getTime() <= bayGio
    );
  }, [customers, now]);

  /* --- Dữ liệu cho biểu đồ, luôn đủ 3 cột theo thứ tự cố định --- */
  const chartData = useMemo(
    () => PHAN_LOAI_LIST.map((loai) => ({ name: loai, value: stats[loai] || 0 })),
    [stats]
  );

  /* --- Lọc + tìm kiếm realtime ngay trên dữ liệu đã tải --- */
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const bayGio = now;

    return customers.filter((c) => {
      const khopLoai = !filterLoai || c.phan_loai === filterLoai;
      if (!khopLoai) return false;

      const khopTrangThai = !filterTrangThai || c.trang_thai === filterTrangThai;
      if (!khopTrangThai) return false;

      if (chiHienDenHan) {
        const denHanRoi =
          c.hen_goi_lai && new Date(c.hen_goi_lai).getTime() <= bayGio;
        if (!denHanRoi) return false;
      }

      if (!keyword) return true;

      // Tìm theo tên hoặc số điện thoại
      const ten = (c.ten_khach_hang || '').toLowerCase();
      const sdt = (c.so_dien_thoai || '').toLowerCase();
      return ten.includes(keyword) || sdt.includes(keyword);
    });
  }, [customers, search, filterLoai, filterTrangThai, chiHienDenHan, now]);

  /* --- Xoá khách hàng --- */
  const handleDelete = async (customer) => {
    const xacNhan = window.confirm(
      `Xoá khách hàng "${customer.ten_khach_hang}" (${customer.so_dien_thoai})?\nThao tác này không thể hoàn tác.`
    );
    if (!xacNhan) return;

    setDeletingId(customer.id);
    try {
      await customerAPI.remove(customer.id);
      // Cập nhật ngay trên giao diện, không cần gọi lại API
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      toast.success('Đã xoá khách hàng.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể xoá khách hàng.'));
    } finally {
      setDeletingId(null);
    }
  };

  /* --- Cập nhật danh sách sau khi modal lưu thành công --- */
  const handleSaved = (updated) => {
    if (!updated) return fetchCustomers();
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  /* --- Xuất file Excel theo đúng danh sách đang hiển thị --- */
  const handleExportExcel = () => {
    if (!filtered.length) {
      toast.error('Không có dữ liệu để xuất.');
      return;
    }

    const rows = filtered.map((c, index) => ({
      STT: index + 1,
      'Số điện thoại': c.so_dien_thoai || '',
      'Tên khách hàng': c.ten_khach_hang || '',
      'Địa chỉ': c.dia_chi || '',
      'Phân loại': c.phan_loai || '',
      'Trạng thái': c.trang_thai || 'Mới',
      'Hẹn gọi lại': c.hen_goi_lai ? formatDateTime(c.hen_goi_lai) : '',
      'Ghi chú': c.ghi_chu || '',
      'Ngày tạo': formatDate(c.created_at),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    // Đặt độ rộng cột cho dễ đọc
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 24 },
      { wch: 34 },
      { wch: 12 },
      { wch: 13 },
      { wch: 17 },
      { wch: 30 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Khách hàng');

    const ngay = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Danh-sach-khach-hang-OCB-${ngay}.xlsx`);

    toast.success(`Đã xuất ${rows.length} khách hàng ra Excel.`);
  };

  /* --- Đăng xuất --- */
  const handleLogout = () => {
    clearAuth();
    toast.success('Đã đăng xuất.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ============ Lớp phủ khi mở menu trên mobile ============ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============ Sidebar ============ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ocb-green transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-5 py-5">
          <OcbLogo size="md" />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Đóng menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <span className="flex items-center gap-3 rounded-lg bg-white/15 px-3 py-2.5 text-sm font-semibold text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z"
                fill="currentColor"
              />
            </svg>
            Quản lý khách hàng
          </span>
        </nav>

        {/* Thông tin tài khoản + đăng xuất */}
        <div className="border-t border-white/15 p-3">
          <div className="mb-2 px-3 py-2">
            <p className="text-xs text-white/60">Đăng nhập với</p>
            <p className="truncate text-sm font-semibold text-white">
              {user?.username || 'admin'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDoiMatKhau(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect
                x="4"
                y="10"
                width="16"
                height="10"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8 10V7a4 4 0 0 1 8 0v3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Đổi mật khẩu
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ============ Nội dung chính ============ */}
      <div className="lg:pl-64">
        {/* Thanh trên cùng */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
            aria-label="Mở menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <h1 className="flex-1 text-base font-bold text-slate-800 sm:text-lg">
            Bảng điều khiển
          </h1>

          <button
            type="button"
            onClick={() => fetchCustomers()}
            disabled={loading}
            className="btn-ghost !px-3 !py-2"
            title="Tải lại dữ liệu"
          >
            {loading ? (
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
            <span className="hidden sm:inline">Tải lại</span>
          </button>

          <button type="button" onClick={handleExportExcel} className="btn-orange !px-3 !py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
        </header>

        <main className="space-y-6 p-4 sm:p-6">
          {/* ---------- Nhắc lịch gọi lại ---------- */}
          {denHan.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-amber-600"
                >
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 7v5l3 2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-sm text-amber-900">
                  <span className="font-semibold">{denHan.length} khách</span> đã đến
                  hoặc quá hạn hẹn gọi lại.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const bat = !chiHienDenHan;
                  setChiHienDenHan(bat);
                  setFilterTrangThai('');
                  setSearch('');
                  // Bảng nằm dưới biểu đồ nên phải cuộn xuống,
                  // nếu không người dùng bấm xong tưởng không có gì xảy ra.
                  if (bat) {
                    bangRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }
                }}
                className="shrink-0 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                {chiHienDenHan ? 'Bỏ lọc, xem tất cả' : 'Xem danh sách cần gọi'}
              </button>
            </section>
          )}

          {/* ---------- 4 thẻ thống kê ---------- */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Tổng khách hàng" value={stats.total} accent="#334155" loading={loading} />
            <StatCard label="VIP" value={stats.VIP} accent={PHAN_LOAI_MAU.VIP} loading={loading} />
            <StatCard
              label="Tiềm năng"
              value={stats['Tiềm năng']}
              accent={PHAN_LOAI_MAU['Tiềm năng']}
              loading={loading}
            />
            <StatCard
              label="Thường"
              value={stats['Thường']}
              accent={PHAN_LOAI_MAU['Thường']}
              loading={loading}
            />
          </section>

          {/* ---------- Biểu đồ phân loại ---------- */}
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-800">
              Số lượng khách hàng theo phân loại
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tính trên toàn bộ {stats.total} khách hàng trong hệ thống
            </p>

            <div className="mt-5 h-64 w-full sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                  {/* Lưới ngang mờ, không vẽ lưới dọc để nền không bị rối */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={72}>
                    {/* Mỗi cột lấy màu theo phân loại của chính nó */}
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={PHAN_LOAI_MAU[entry.name]} />
                    ))}
                    {/* Nhãn số ngay trên đầu cột, đọc được không cần dò trục */}
                    <LabelList
                      dataKey="value"
                      position="top"
                      offset={8}
                      style={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ---------- Bộ lọc + bảng danh sách ---------- */}
          <section
            ref={bangRef}
            className="scroll-mt-20 rounded-xl bg-white shadow-sm ring-1 ring-slate-200"
          >
            {/* Hàng công cụ tìm kiếm / lọc */}
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="relative flex-1">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc số điện thoại..."
                  aria-label="Tìm kiếm khách hàng"
                  className="input-field pl-9"
                />
              </div>

              <select
                value={filterLoai}
                onChange={(e) => setFilterLoai(e.target.value)}
                aria-label="Lọc theo phân loại"
                className="input-field sm:w-44"
              >
                <option value="">Tất cả phân loại</option>
                {PHAN_LOAI_LIST.map((loai) => (
                  <option key={loai} value={loai}>
                    {loai}
                  </option>
                ))}
              </select>

              <select
                value={filterTrangThai}
                onChange={(e) => setFilterTrangThai(e.target.value)}
                aria-label="Lọc theo trạng thái chăm sóc"
                className="input-field sm:w-44"
              >
                <option value="">Tất cả trạng thái</option>
                {TRANG_THAI_LIST.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <span className="whitespace-nowrap text-sm text-slate-500">
                {filtered.length} / {customers.length} khách hàng
              </span>
            </div>

            {/* Nội dung bảng */}
            {loading ? (
              <LoadingBlock />
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-slate-600">
                  {customers.length === 0
                    ? 'Chưa có khách hàng nào trong hệ thống.'
                    : 'Không tìm thấy khách hàng phù hợp.'}
                </p>
                {customers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setFilterLoai('');
                      setFilterTrangThai('');
                      setChiHienDenHan(false);
                    }}
                    className="mt-3 text-sm font-medium text-ocb-green hover:underline"
                  >
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <th className="px-4 py-3 font-semibold">Số điện thoại</th>
                      <th className="px-4 py-3 font-semibold">Tên khách hàng</th>
                      <th className="px-4 py-3 font-semibold">Địa chỉ</th>
                      <th className="px-4 py-3 font-semibold">Phân loại</th>
                      <th className="px-4 py-3 font-semibold">Trạng thái</th>
                      <th className="px-4 py-3 font-semibold">Ghi chú</th>
                      <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                      <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((c, index) => (
                      <tr key={c.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 tabular-nums text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3 font-medium tabular-nums text-slate-800">
                          {c.so_dien_thoai}
                        </td>
                        <td className="px-4 py-3 text-slate-800">{c.ten_khach_hang}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-600" title={c.dia_chi || ''}>
                          {c.dia_chi || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              PHAN_LOAI_BADGE[c.phan_loai] || 'bg-slate-100 text-slate-600 ring-slate-300'
                            }`}
                          >
                            {c.phan_loai || 'Thường'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              TRANG_THAI_BADGE[c.trang_thai] ||
                              'bg-slate-100 text-slate-600 ring-slate-300'
                            }`}
                          >
                            {c.trang_thai || 'Mới'}
                          </span>
                          {c.hen_goi_lai && (
                            <span
                              className={`mt-1 block text-xs ${
                                new Date(c.hen_goi_lai).getTime() <= now
                                  ? 'font-semibold text-amber-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {formatDateTime(c.hen_goi_lai)}
                            </span>
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={c.ghi_chu || ''}>
                          {c.ghi_chu || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">
                          {formatDate(c.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setContacting(c)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ocb-orange-dark transition hover:bg-ocb-orange-light"
                          >
                            Chăm sóc
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(c)}
                            className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ocb-green transition hover:bg-ocb-green-light"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            disabled={deletingId === c.id}
                            className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {deletingId === c.id ? 'Đang xoá...' : 'Xoá'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ============ Modal chỉnh sửa ============ */}
      <EditCustomerModal
        customer={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      {/* ============ Modal chăm sóc khách hàng ============ */}
      <ContactModal
        customer={contacting}
        onClose={() => setContacting(null)}
        onSaved={handleSaved}
      />

      {/* ============ Modal đổi mật khẩu ============ */}
      <ChangePasswordModal
        open={doiMatKhau}
        onClose={() => setDoiMatKhau(false)}
        onDone={handleLogout}
      />
    </div>
  );
}
