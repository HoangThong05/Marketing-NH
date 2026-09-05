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

import {
  customerAPI,
  userAPI,
  clearAuth,
  getUser,
  isAdmin,
  getErrorMessage,
} from '../services/api';
import UserManagement from './UserManagement';
import ActivityLog from './ActivityLog';
import ViecHomNay from './ViecHomNay';
import SoDienThoai from '../components/SoDienThoai';
import BaoCaoNhanVien from './BaoCaoNhanVien';
import PhanTrang from '../components/PhanTrang';
import VietinBankLogo from '../components/VietinBankLogo';
import Spinner, { LoadingBlock } from '../components/Spinner';
import EditCustomerModal from '../components/EditCustomerModal';
import ProfileModal from '../components/ProfileModal';
import ContactModal from '../components/ContactModal';
import ImportModal from '../components/ImportModal';
import {
  PHAN_LOAI_LIST,
  PHAN_LOAI_BADGE,
  TRANG_THAI_LIST,
  TRANG_THAI_BADGE,
  MUC_LUONG_LIST,
  MUC_LUONG_BADGE,
  MUC_LUONG_MAU,
  TRANG_THAI_MAU,
  nenNangHang,
} from '../constants';

// Tiêu đề tab lúc không có việc gì quá hạn. Giữ khớp với thẻ <title>
// trong frontend/index.html.
const TIEU_DE_GOC = 'VietinBank - Quản lý khách hàng';

// Các mục trong sidebar. chiAdmin = chỉ quản trị viên mới thấy.
const MUC_MENU = [
  {
    key: 'viec',
    nhan: 'Việc hôm nay',
    icon: 'M9 2h6v2h4v18H5V4h4V2Zm0 4H7v14h10V6h-2v2H9V6Zm-.5 6.5 1.4-1.4 1.6 1.6 3.6-3.6 1.4 1.4-5 5-3-3Z',
  },
  {
    key: 'khach',
    nhan: 'Quản lý khách hàng',
    icon: 'M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z',
  },
  {
    key: 'baocao',
    nhan: 'Báo cáo nhân viên',
    chiAdmin: true,
    icon: 'M4 20h16v2H4v-2Zm2-2V9h3v9H6Zm5 0V4h3v14h-3Zm5 0v-6h3v6h-3Z',
  },
  {
    key: 'taikhoan',
    nhan: 'Tài khoản',
    chiAdmin: true,
    icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z',
  },
  {
    key: 'nhatky',
    nhan: 'Nhật ký thao tác',
    chiAdmin: true,
    icon: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v1.6H8V12Zm0 3.4h8V17H8v-1.6Z',
  },
];

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
/* Tiêu đề cột bấm được để sắp xếp                                     */
/* ------------------------------------------------------------------ */

function ThSort({ cot, sort, order, onSort, children }) {
  const dangSort = sort === cot;

  return (
    <th className="px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(cot)}
        aria-sort={dangSort ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-slate-800 ${
          dangSort ? 'text-slate-800' : ''
        }`}
      >
        {children}
        {/* Mũi tên chỉ hiện ở cột đang sắp xếp, cột khác để mờ gợi ý bấm được */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={dangSort ? 'opacity-100' : 'opacity-25'}
        >
          {dangSort && order === 'asc' ? (
            <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    </th>
  );
}


/* ------------------------------------------------------------------ */
/* Tooltip tuỳ chỉnh cho biểu đồ                                       */
/* ------------------------------------------------------------------ */

function ChartTooltip({ active, payload, bangMau }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: bangMau?.[item.name] || '#94a3b8' }}
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
  const [xemHoSo, setXemHoSo] = useState(false); // modal hồ sơ cá nhân
  // Tên hiển thị giữ trong state để đổi hồ sơ xong là sidebar đổi theo ngay
  const [tenHienThi, setTenHienThi] = useState(
    () => user?.ho_ten || user?.username || ''
  );
  const [contacting, setContacting] = useState(null); // khách đang chăm sóc
  const [filterTrangThai, setFilterTrangThai] = useState(''); // lọc trạng thái
  const [filterMucLuong, setFilterMucLuong] = useState(''); // lọc mức thu nhập
  const [chiHienGoiY, setChiHienGoiY] = useState(false); // chỉ khách nên nâng hạng
  const [nangHangId, setNangHangId] = useState(null); // id đang nâng hạng
  const [danhBa, setDanhBa] = useState([]); // danh sách nhân viên để gán
  const [filterPhuTrach, setFilterPhuTrach] = useState(''); // '' | 'me' | 'none'
  const [dangGanId, setDangGanId] = useState(null); // id đang đổi phụ trách
  const [xemThungRac, setXemThungRac] = useState(false); // đang xem thùng rác
  const [dangKhoiPhucId, setDangKhoiPhucId] = useState(null);
  const [chiHienDenHan, setChiHienDenHan] = useState(false); // chỉ khách đến hạn gọi
  const bangRef = useRef(null); // để cuộn xuống bảng khi lọc từ banner
  // Mặc định mở vào màn hình việc: đó là nơi bắt đầu ngày làm việc,
  // còn bảng danh sách là nơi tra cứu khi cần.
  const [view, setView] = useState('viec'); // viec | khach | taikhoan | nhatky

  // Phân trang, sắp xếp, lọc theo ngày — tất cả xử lý phía server
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');
  const [stats, setStats] = useState(null);

  // Từ khoá đã trễ nhịp. Gõ tới đâu gọi API tới đó thì mỗi ký tự là một
  // request; đợi 350ms sau khi ngừng gõ vẫn cho cảm giác tức thì.
  const [searchDebounced, setSearchDebounced] = useState('');

  const quanTri = isAdmin(); // tài khoản hiện tại có quyền quản trị không

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

  // Trễ nhịp ô tìm kiếm
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  // Đổi bộ lọc thì phải quay về trang 1, nếu không đang ở trang 5 mà lọc
  // còn 2 trang sẽ ra danh sách trống mà không hiểu vì sao.
  useEffect(() => {
    setPage(1);
  }, [
    searchDebounced,
    filterLoai,
    filterTrangThai,
    filterMucLuong,
    filterPhuTrach,
    xemThungRac,
    chiHienDenHan,
    chiHienGoiY,
    tuNgay,
    denNgay,
    limit,
  ]);

  /**
   * Tải danh sách khách hàng từ backend.
   * @param {boolean} silent - true thì không hiện spinner toàn trang,
   *   dùng cho lần tải lại ngầm khi người dùng quay lại tab.
   */
  /** Gói tham số lọc hiện tại, dùng chung cho danh sách và xuất Excel */
  const thamSoLoc = useMemo(
    () => ({
      search: searchDebounced || undefined,
      phan_loai: filterLoai || undefined,
      trang_thai: filterTrangThai || undefined,
      muc_luong: filterMucLuong || undefined,
      tu_ngay: tuNgay || undefined,
      den_ngay: denNgay || undefined,
      den_han: chiHienDenHan ? 1 : undefined,
      goi_y: chiHienGoiY ? 1 : undefined,
      phu_trach: filterPhuTrach || undefined,
      da_xoa: xemThungRac ? 1 : undefined,
    }),
    [
      searchDebounced,
      filterLoai,
      filterTrangThai,
      filterMucLuong,
      tuNgay,
      denNgay,
      chiHienDenHan,
      chiHienGoiY,
      filterPhuTrach,
      xemThungRac,
    ]
  );

  const fetchCustomers = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data } = await customerAPI.getAll({
          ...thamSoLoc,
          page,
          limit,
          sort,
          order,
        });
        setCustomers(data.data || []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      } catch (error) {
        // Lỗi 401 đã được interceptor xử lý (tự đăng xuất), ở đây chỉ báo lỗi khác
        if (error?.response?.status !== 401) {
          toast.error(getErrorMessage(error, 'Không thể tải danh sách khách hàng.'));
        }
      } finally {
        setLoading(false);
      }
    },
    [thamSoLoc, page, limit, sort, order]
  );

  /** Số liệu thống kê tính trên toàn bộ hệ thống, không theo bộ lọc */
  const fetchStats = useCallback(async () => {
    try {
      const { data } = await customerAPI.getStats();
      setStats(data.data);
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Không tải được thống kê:', error);
        // Đặt số liệu rỗng để thẻ thống kê thôi hiện "--" mãi.
        // Người dùng bấm Tải lại là thử lại được.
        setStats((cu) => cu ?? { total: 0, den_han: 0, phan_loai: {}, trang_thai: {} });
        toast.error('Không tải được số liệu thống kê. Bấm Tải lại để thử lại.');
      }
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Danh bạ nhân viên, dùng cho ô chọn người phụ trách và hiển thị tên.
  // Chỉ tải một lần: danh sách tài khoản rất ít khi thay đổi.
  useEffect(() => {
    userAPI
      .danhBa()
      .then(({ data }) => setDanhBa(data.data || []))
      .catch((error) => {
        if (error?.response?.status !== 401) {
          console.error('Không tải được danh bạ nhân viên:', error);
        }
      });
  }, []);

  /** Tra tên hiển thị của một nhân viên theo id */
  const tenNhanVien = useCallback(
    (id) => {
      if (!id) return null;
      const nv = danhBa.find((u) => u.id === id);
      return nv ? nv.ho_ten || nv.username : `#${id}`;
    },
    [danhBa]
  );

  /** Gán hoặc bỏ người phụ trách một khách hàng */
  const doiPhuTrach = async (customer, phuTrachId) => {
    setDangGanId(customer.id);
    try {
      const { data } = await customerAPI.setPhuTrach(customer.id, phuTrachId);
      handleSaved(data.data);
      toast.success(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể đổi người phụ trách.'));
    } finally {
      setDangGanId(null);
    }
  };

  // Quay lại tab thì tải lại ngầm ngay, để thấy thay đổi của người khác.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchCustomers(true);
        fetchStats();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchCustomers, fetchStats]);

  // Tự động lấy dữ liệu mới mỗi 60 giây, để khách vừa đăng ký qua form
  // công khai xuất hiện mà không phải bấm Tải lại.
  useEffect(() => {
    let nhipAn = 0;

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchCustomers(true);
        fetchStats();
        nhipAn = 0;
        return;
      }

      // Tab đang ẩn. Danh sách khách thì đúng là không cần lấy — không ai
      // nhìn. Nhưng số liệu thì vẫn phải, vì số việc quá hạn còn chạy ra
      // TIÊU ĐỀ TAB, mà tiêu đề tab chính là thứ người dùng nhìn khi đang
      // ở tab khác. Không cập nhật lúc ẩn thì con số đó đứng im đúng lúc
      // nó cần chạy nhất.
      //
      // Năm phút một lần là đủ: đây là lời nhắc "có việc quá hạn", không
      // phải đồng hồ đếm ngược.
      nhipAn += 1;
      if (nhipAn >= 5) {
        nhipAn = 0;
        fetchStats();
      }
    }, 60000);

    return () => clearInterval(id);
  }, [fetchCustomers, fetchStats]);

  /* --- Thống kê lấy từ server, tính trên toàn bộ hệ thống --- */
  const soDenHan = stats?.den_han ?? 0;

  // Số việc quá hạn hiện ngay trên tiêu đề tab: "(2) VietinBank - Quản lý khách hàng".
  //
  // Cố ý KHÔNG dùng Notification API của trình duyệt. Nó phải xin quyền, mà
  // người dùng lỡ bấm "Chặn" một lần là mất hẳn, không có cách nào xin lại
  // trong app. Tiêu đề tab thì không xin phép ai, không tắt được, và đọc
  // được ngay cả khi đang làm việc ở tab Excel bên cạnh.
  useEffect(() => {
    // Admin nhìn việc quá hạn của cả nhóm, nhân viên chỉ nhìn phần của mình
    const soViec = quanTri ? soDenHan : (stats?.cua_toi_den_han ?? 0);
    document.title = soViec > 0 ? `(${soViec}) ${TIEU_DE_GOC}` : TIEU_DE_GOC;
    return () => {
      document.title = TIEU_DE_GOC;
    };
  }, [quanTri, soDenHan, stats]);

  // Hẹn giờ làm mới ĐÚNG vào lúc lịch gần nhất tới hạn.
  //
  // Chỉ dựa vào vòng lặp 60 giây thì con số trên tiêu đề tab trễ tới gần một
  // phút so với giờ hẹn — với một cái để nhắc "đã tới giờ gọi" thì trễ chừng
  // đó là hỏng ý nghĩa. Cách này không thêm một lượt gọi API nào: vẫn đúng
  // một lần, chỉ là gọi đúng lúc thay vì gọi mò.
  useEffect(() => {
    const moc = quanTri ? stats?.hen_ke_tiep : stats?.cua_toi_hen_ke_tiep;
    if (!moc) return undefined;

    const cho = new Date(moc).getTime() - Date.now();
    // Đã qua rồi thì vòng chạy này đã đếm; còn xa quá một giờ thì để vòng lặp
    // 60 giây lo, không giữ một bộ đếm treo lơ lửng hàng tiếng đồng hồ.
    if (cho <= 0 || cho > 60 * 60 * 1000) return undefined;

    // Cộng thêm một giây cho chắc chắn đã qua mốc khi máy chủ so lại giờ
    const id = setTimeout(fetchStats, cho + 1000);
    return () => clearTimeout(id);
  }, [quanTri, stats, fetchStats]);

  /* --- Phễu chăm sóc: luôn đủ 5 bậc theo đúng thứ tự tiến trình --- */
  const dulieuPheu = useMemo(
    () =>
      TRANG_THAI_LIST.map((t) => ({
        name: t,
        value: stats?.trang_thai?.[t] ?? 0,
      })),
    [stats]
  );

  /* --- Cơ cấu thu nhập: đủ 4 bậc từ thấp đến cao --- */
  const dulieuThuNhap = useMemo(
    () =>
      MUC_LUONG_LIST.map((ml) => ({
        name: ml,
        value: stats?.muc_luong?.[ml] ?? 0,
      })),
    [stats]
  );

  // Server đã lọc và phân trang sẵn, ở đây chỉ hiển thị đúng những gì nhận về
  const filtered = customers;

  /** Có đang áp bộ lọc nào không */
  const coBoLoc = Boolean(
    search ||
      filterLoai ||
      filterTrangThai ||
      filterMucLuong ||
      tuNgay ||
      denNgay ||
      chiHienDenHan ||
      chiHienGoiY ||
      filterPhuTrach
  );

  /** Xoá sạch mọi bộ lọc */
  const xoaBoLoc = () => {
    setSearch('');
    setFilterLoai('');
    setFilterTrangThai('');
    setFilterMucLuong('');
    setTuNgay('');
    setDenNgay('');
    setChiHienDenHan(false);
    setChiHienGoiY(false);
    setFilterPhuTrach('');
  };

  /**
   * Bấm vào tiêu đề cột để sắp xếp.
   * Bấm lại cùng một cột thì đảo chiều tăng/giảm.
   */
  const doiSapXep = (cot) => {
    if (sort === cot) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(cot);
      // Ngày tháng thì mặc định mới nhất trước, chữ và số thì từ nhỏ đến lớn
      setOrder(cot === 'created_at' || cot === 'hen_goi_lai' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  /** Đưa một khách từ thùng rác trở lại danh sách */
  const khoiPhuc = async (customer) => {
    setDangKhoiPhucId(customer.id);
    try {
      await customerAPI.khoiPhuc(customer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setTotal((t) => Math.max(t - 1, 0));
      fetchStats();
      toast.success(`Đã khôi phục "${customer.ten_khach_hang}".`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không khôi phục được.'));
    } finally {
      setDangKhoiPhucId(null);
    }
  };

  /** Xoá hẳn khỏi database, mất luôn lịch sử liên hệ */
  const xoaVinhVien = async (customer) => {
    const xacNhan = window.confirm(
      `XOÁ VĨNH VIỄN "${customer.ten_khach_hang}" (${customer.so_dien_thoai})?\n\n` +
        'Toàn bộ lịch sử liên hệ của khách này sẽ mất hẳn.\n' +
        'KHÔNG khôi phục lại được.'
    );
    if (!xacNhan) return;

    setDangKhoiPhucId(customer.id);
    try {
      await customerAPI.xoaVinhVien(customer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setTotal((t) => Math.max(t - 1, 0));
      toast.success('Đã xoá vĩnh viễn.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không xoá được.'));
    } finally {
      setDangKhoiPhucId(null);
    }
  };

  /**
   * Nâng một khách từ "Thường" lên "Tiềm năng" ngay tại bảng.
   * Chỉ là lối tắt cho thao tác vốn phải mở modal Sửa — hệ thống không bao
   * giờ tự đổi phân loại, luôn phải có người bấm.
   */
  const nangLenTiemNang = async (customer) => {
    setNangHangId(customer.id);
    try {
      const { data } = await customerAPI.update(customer.id, {
        phan_loai: 'Tiềm năng',
      });
      handleSaved(data.data);
      toast.success(`Đã nâng "${customer.ten_khach_hang}" lên Tiềm năng.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể nâng hạng khách hàng.'));
    } finally {
      setNangHangId(null);
    }
  };

  /* --- Xoá khách hàng --- */
  const handleDelete = async (customer) => {
    const xacNhan = window.confirm(
      `Chuyển khách "${customer.ten_khach_hang}" (${customer.so_dien_thoai}) vào thùng rác?\n\n` +
        'Toàn bộ lịch sử liên hệ vẫn được giữ. Bạn khôi phục lại được bất cứ lúc nào.'
    );
    if (!xacNhan) return;

    setDeletingId(customer.id);
    try {
      await customerAPI.remove(customer.id);
      // Cập nhật ngay trên giao diện, không cần tải lại cả danh sách
      const conLai = customers.filter((c) => c.id !== customer.id);
      setCustomers(conLai);
      setTotal((t) => Math.max(t - 1, 0));
      fetchStats();

      // Xoá dòng cuối cùng của trang cuối thì trang đó không còn gì để hiện.
      // Lùi về trang trước, nếu không người dùng nhìn thấy bảng trống kèm
      // dòng chữ "Trang 3 / 2" mà không hiểu chuyện gì xảy ra.
      if (conLai.length === 0 && page > 1) {
        setPage((p) => p - 1);
      }

      toast.success('Đã chuyển vào thùng rác.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể xoá khách hàng.'));
    } finally {
      setDeletingId(null);
    }
  };

  /**
   * Cập nhật danh sách sau khi một thao tác sửa đổi thành công.
   *
   * Luôn nạp lại số liệu thống kê: đổi trạng thái, đổi phân loại hay đổi
   * thu nhập của một khách đều làm sai lệch 4 thẻ số và 2 biểu đồ. Trước
   * đây chỉ cập nhật dòng trong bảng nên biểu đồ đứng im cho tới khi tải
   * lại trang — người dùng thấy bảng và biểu đồ nói hai chuyện khác nhau.
   */
  const handleSaved = (updated) => {
    if (!updated) {
      fetchCustomers();
    } else {
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
    fetchStats();
  };

  /* --- Xuất file Excel theo đúng danh sách đang hiển thị --- */
  const [dangXuat, setDangXuat] = useState(false);
  const [dangNhapFile, setDangNhapFile] = useState(false); // modal nhập Excel

  const handleExportExcel = async () => {
    if (total === 0) {
      toast.error('Không có dữ liệu để xuất.');
      return;
    }

    setDangXuat(true);
    try {
      // Có phân trang rồi thì trình duyệt chỉ giữ đúng một trang.
      // Phải hỏi lại server toàn bộ dữ liệu khớp bộ lọc hiện tại.
      const { data: res } = await customerAPI.exportAll(thamSoLoc);
      const danhSach = res.data || [];

      if (!danhSach.length) {
        toast.error('Không có dữ liệu để xuất.');
        return;
      }

      const rows = danhSach.map((c, index) => ({
      STT: index + 1,
      'Số điện thoại': c.so_dien_thoai || '',
      'Tên khách hàng': c.ten_khach_hang || '',
      'Phụ trách': tenNhanVien(c.phu_trach_id) || '',
      'Nghề nghiệp': c.nghe_nghiep || '',
      'Mức thu nhập': c.muc_luong || '',
      'Địa chỉ': c.dia_chi || '',
      'Phân loại': c.phan_loai || '',
      'Trạng thái': c.trang_thai || 'Mới',
      'Hẹn gọi lại': c.hen_goi_lai ? formatDateTime(c.hen_goi_lai) : '',
      'Ghi chú': c.ghi_chu || '',
      'Ngày tạo': formatDate(c.created_at),
    }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Ép cột Số điện thoại về kiểu text và gắn định dạng '@'.
      // Không có bước này, mở file trong Excel rồi lưu lại sẽ biến
      // 0901234567 thành số 901234567 — mất số 0 đứng đầu, nhập lại không được.
      const phamVi = XLSX.utils.decode_range(worksheet['!ref']);
      for (let r = phamVi.s.r + 1; r <= phamVi.e.r; r += 1) {
        const o = worksheet[XLSX.utils.encode_cell({ r, c: 1 })];
        if (o) {
          o.t = 's';
          o.z = '@';
          o.v = String(o.v);
        }
      }
    // Đặt độ rộng cột cho dễ đọc
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 24 },
      { wch: 18 },
      { wch: 22 },
      { wch: 15 },
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
      XLSX.writeFile(workbook, `Danh-sach-khach-hang-VietinBank-${ngay}.xlsx`);

      toast.success(`Đã xuất ${rows.length} khách hàng ra Excel.`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không xuất được dữ liệu.'));
    } finally {
      setDangXuat(false);
    }
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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-vtb-blue transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-5 py-5">
          <VietinBankLogo size="md" />
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
          {MUC_MENU.filter((m) => !m.chiAdmin || quanTri).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => {
                setView(m.key);
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                view === m.key
                  ? 'bg-white/15 text-white'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={m.icon} fill="currentColor" />
              </svg>
              {m.nhan}
            </button>
          ))}
        </nav>

        {/* Thông tin tài khoản + đăng xuất */}
        <div className="border-t border-white/15 p-3">
          <button
            type="button"
            onClick={() => setXemHoSo(true)}
            className="mb-2 block w-full rounded-lg px-3 py-2 text-left transition hover:bg-white/10"
            title="Xem và sửa hồ sơ của bạn"
          >
            <p className="text-xs text-white/60">Đăng nhập với</p>
            <p className="truncate text-sm font-semibold text-white">
              {tenHienThi}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setXemHoSo(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
              <path
                d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Hồ sơ của tôi
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
            {MUC_MENU.find((m) => m.key === view)?.nhan || 'Bảng điều khiển'}
          </h1>

          {view === 'khach' && (
            <>
          <button
            type="button"
            onClick={() => {
              fetchCustomers();
              fetchStats();
            }}
            disabled={loading}
            className="btn-ghost !px-3 !py-2"
            title="Tải lại dữ liệu"
          >
            {loading ? (
              <Spinner size="sm" className="text-vtb-blue" />
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

          {/* Nhập hàng loạt là thao tác ghi đè diện rộng, chỉ admin được dùng */}
          {quanTri && (
            <button
              type="button"
              onClick={() => setDangNhapFile(true)}
              className="btn-ghost !px-3 !py-2"
              title="Nhập khách hàng từ file Excel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 15V3m0 0L8 7m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="hidden sm:inline">Nhập Excel</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={dangXuat}
            className="btn-primary !px-3 !py-2"
          >
            {dangXuat ? (
              <Spinner size="sm" className="text-white" />
            ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            )}
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
            </>
          )}
        </header>

        {view === 'viec' && <ViecHomNay />}
        {view === 'baocao' && quanTri && <BaoCaoNhanVien />}
        {view === 'taikhoan' && quanTri && <UserManagement />}
        {view === 'nhatky' && quanTri && <ActivityLog />}

        {view === 'khach' && (
        <main className="space-y-6 p-4 sm:p-6">
          {/* ---------- Nhắc lịch gọi lại ---------- */}
          {soDenHan > 0 && (
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
                  <span className="font-semibold">{soDenHan} khách</span> đã đến
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
            <StatCard
              label="Tổng khách hàng"
              value={stats?.total ?? 0}
              accent="#334155"
              loading={!stats}
            />
            <StatCard
              label="Chưa ai gọi"
              value={stats?.trang_thai?.['Mới'] ?? 0}
              accent={TRANG_THAI_MAU['Mới']}
              loading={!stats}
            />
            <StatCard
              label="Cần gọi lại"
              value={soDenHan}
              accent="#D97706"
              loading={!stats}
            />
            <StatCard
              label="Đã chốt"
              value={stats?.trang_thai?.['Chốt'] ?? 0}
              accent={TRANG_THAI_MAU['Chốt']}
              loading={!stats}
            />
          </section>

          {/* ---------- Hai biểu đồ ---------- */}
          <section className="grid gap-4 lg:grid-cols-2 sm:gap-6">
            {/* --- Phễu chăm sóc --- */}
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <h2 className="text-sm font-semibold text-slate-800">
                Phễu chăm sóc khách hàng
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Trên tổng số {stats?.total ?? 0} khách hàng trong hệ thống
              </p>

              {/* Nằm ngang vì tên trạng thái dài, để dọc sẽ bị cắt chữ */}
              <div className="mt-5 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dulieuPheu}
                    layout="vertical"
                    // Chừa đủ chỗ bên phải cho nhãn số. 56px đủ cho số 5
                    // chữ số; ít hơn thì tới mốc vài nghìn khách là nhãn bị cụt.
                    margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      // Đủ chỗ cho nhãn dài nhất ("Không liên lạc được").
                      // Hẹp hơn thì Recharts cắt cụt chữ chứ không xuống dòng.
                      width={128}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      content={<ChartTooltip bangMau={TRANG_THAI_MAU} />}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {dulieuPheu.map((e) => (
                        <Cell key={e.name} fill={TRANG_THAI_MAU[e.name]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        offset={8}
                        style={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Xanh dương: đang xử lý &middot; Xanh lá: đã chốt &middot; Đỏ: từ chối
              </p>
            </div>

            {/* --- Cơ cấu thu nhập --- */}
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <h2 className="text-sm font-semibold text-slate-800">
                Cơ cấu thu nhập khách hàng
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Theo mức thu nhập khách tự khai khi đăng ký
              </p>

              <div className="mt-5 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dulieuThuNhap}
                    layout="vertical"
                    // Chừa đủ chỗ bên phải cho nhãn số. 56px đủ cho số 5
                    // chữ số; ít hơn thì tới mốc vài nghìn khách là nhãn bị cụt.
                    margin={{ top: 4, right: 56, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 12, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      content={<ChartTooltip bangMau={MUC_LUONG_MAU} />}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      {dulieuThuNhap.map((e) => (
                        <Cell key={e.name} fill={MUC_LUONG_MAU[e.name]} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="right"
                        offset={8}
                        style={{ fill: '#334155', fontSize: 12, fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Màu đậm dần theo bậc thu nhập. Khách chưa khai không tính vào đây.
              </p>
            </div>
          </section>

          {/* ---------- Bộ lọc + bảng danh sách ---------- */}
          <section
            ref={bangRef}
            className="scroll-mt-20 rounded-xl bg-white shadow-sm ring-1 ring-slate-200"
          >
            {/* Hàng công cụ tìm kiếm / lọc */}
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
              {/* Bề rộng cố định, KHÔNG dùng flex-1: flex-1 sẽ nuốt hết chỗ
                  trống còn lại của hàng, nên hễ hai ô ngày xuống dòng là ô này
                  phình ra chiếm chỗ của chúng. 320px là vừa đủ câu gợi ý, cộng
                  36px thụt trái cho kính lúp và nút xoá của ô type="search". */}
              <div className="relative w-full sm:w-[320px] sm:shrink-0">
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
                  placeholder="Tìm theo tên hoặc số điện thoại"
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

              <select
                value={filterMucLuong}
                onChange={(e) => setFilterMucLuong(e.target.value)}
                aria-label="Lọc theo mức thu nhập"
                className="input-field sm:w-44"
              >
                <option value="">Tất cả thu nhập</option>
                {MUC_LUONG_LIST.map((ml) => (
                  <option key={ml} value={ml}>
                    {ml}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={tuNgay}
                  onChange={(e) => setTuNgay(e.target.value)}
                  aria-label="Từ ngày"
                  title="Ngày tạo từ"
                  className="input-field sm:w-40"
                />
                <span className="text-sm text-slate-400">&rarr;</span>
                <input
                  type="date"
                  value={denNgay}
                  onChange={(e) => setDenNgay(e.target.value)}
                  aria-label="Đến ngày"
                  title="Ngày tạo đến"
                  className="input-field sm:w-40"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setFilterPhuTrach((v) => (v === 'me' ? '' : 'me'))
                }
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filterPhuTrach === 'me'
                    ? 'bg-vtb-blue text-white'
                    : 'text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                Của tôi
                {stats?.cua_toi ? ` (${stats.cua_toi})` : ''}
              </button>

              <button
                type="button"
                onClick={() =>
                  setFilterPhuTrach((v) => (v === 'none' ? '' : 'none'))
                }
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filterPhuTrach === 'none'
                    ? 'bg-vtb-blue text-white'
                    : 'text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
                }`}
                title="Khách chưa ai nhận phụ trách"
              >
                Chưa giao
                {stats?.chua_giao ? ` (${stats.chua_giao})` : ''}
              </button>

              {quanTri && (
                <button
                  type="button"
                  onClick={() => {
                    setXemThungRac((v) => !v);
                    xoaBoLoc();
                  }}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    xemThungRac
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
                  }`}
                  title="Khách đã xoá, còn khôi phục được"
                >
                  {xemThungRac ? 'Đang xem thùng rác' : 'Thùng rác'}
                </button>
              )}

              <button
                type="button"
                onClick={() => setChiHienGoiY((v) => !v)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  chiHienGoiY
                    ? 'bg-vtb-blue text-white'
                    : 'text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'
                }`}
                title="Khách đang xếp Thường nhưng thu nhập đủ để cân nhắc nâng hạng"
              >
                Có gợi ý nâng hạng
              </button>

              {coBoLoc && (
                <button
                  type="button"
                  onClick={xoaBoLoc}
                  className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  Xoá bộ lọc
                </button>
              )}

              <span className="whitespace-nowrap text-sm text-slate-500">
                {total} khách hàng
              </span>
            </div>

            {/* Nội dung bảng */}
            {loading ? (
              <LoadingBlock />
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-slate-600">
                  {xemThungRac
                    ? 'Thùng rác trống.'
                    : coBoLoc
                      ? 'Không tìm thấy khách hàng phù hợp.'
                      : 'Chưa có khách hàng nào trong hệ thống.'}
                </p>
                {coBoLoc && (
                  <button
                    type="button"
                    onClick={xoaBoLoc}
                    className="mt-3 text-sm font-medium text-vtb-blue hover:underline"
                  >
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">#</th>
                      <ThSort cot="so_dien_thoai" sort={sort} order={order} onSort={doiSapXep}>
                        Số điện thoại
                      </ThSort>
                      <ThSort cot="ten_khach_hang" sort={sort} order={order} onSort={doiSapXep}>
                        Tên khách hàng
                      </ThSort>
                      <th className="px-4 py-3 font-semibold">Phụ trách</th>
                      <th className="px-4 py-3 font-semibold">Nghề nghiệp</th>
                      <ThSort cot="muc_luong" sort={sort} order={order} onSort={doiSapXep}>
                        Thu nhập
                      </ThSort>
                      <th className="px-4 py-3 font-semibold">Địa chỉ</th>
                      <ThSort cot="phan_loai" sort={sort} order={order} onSort={doiSapXep}>
                        Phân loại
                      </ThSort>
                      <ThSort cot="trang_thai" sort={sort} order={order} onSort={doiSapXep}>
                        Trạng thái
                      </ThSort>
                      <th className="px-4 py-3 font-semibold">Ghi chú</th>
                      <ThSort cot="created_at" sort={sort} order={order} onSort={doiSapXep}>
                        Ngày tạo
                      </ThSort>
                      <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((c, index) => (
                      <tr key={c.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3 tabular-nums text-slate-400">
                          {(page - 1) * limit + index + 1}
                        </td>
                        <td className="px-4 py-3">
                          <SoDienThoai
                            so={c.so_dien_thoai}
                            className="font-medium text-slate-800"
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-800">{c.ten_khach_hang}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {dangGanId === c.id ? (
                            <Spinner size="sm" className="text-vtb-blue" />
                          ) : quanTri ? (
                            /* Admin đổi được người phụ trách bất kỳ lúc nào */
                            <select
                              value={c.phu_trach_id || ''}
                              onChange={(e) =>
                                doiPhuTrach(c, e.target.value || null)
                              }
                              aria-label="Người phụ trách"
                              className="max-w-[150px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-vtb-blue"
                            >
                              <option value="">— Chưa giao —</option>
                              {danhBa.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.ho_ten || u.username}
                                </option>
                              ))}
                            </select>
                          ) : c.phu_trach_id === user?.id ? (
                            /* Khách của chính mình: hiện tên kèm nút trả lại */
                            <span className="text-slate-800">
                              Tôi
                              <button
                                type="button"
                                onClick={() => doiPhuTrach(c, null)}
                                className="ml-2 text-xs font-medium text-slate-500 underline decoration-dotted underline-offset-2 hover:text-vtb-red-dark"
                                title="Trả khách về nhóm chưa giao, không xoá dữ liệu"
                              >
                                Trả lại
                              </button>
                            </span>
                          ) : c.phu_trach_id ? (
                            <span className="text-slate-600">
                              {tenNhanVien(c.phu_trach_id)}
                            </span>
                          ) : (
                            /* Chưa ai nhận: nhân viên tự nhận được */
                            <button
                              type="button"
                              onClick={() => doiPhuTrach(c, user?.id)}
                              className="whitespace-nowrap rounded-lg bg-vtb-blue-light px-2.5 py-1 text-xs font-semibold text-vtb-blue-dark transition hover:bg-vtb-blue hover:text-white"
                              title="Nhận phụ trách khách hàng này"
                            >
                              Nhận khách
                            </button>
                          )}
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-slate-600" title={c.nghe_nghiep || ''}>
                          {c.nghe_nghiep || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {c.muc_luong ? (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                MUC_LUONG_BADGE[c.muc_luong] ||
                                'bg-slate-100 text-slate-600 ring-slate-300'
                              }`}
                            >
                              {c.muc_luong}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-slate-600" title={c.dia_chi || ''}>
                          {c.dia_chi || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              PHAN_LOAI_BADGE[c.phan_loai] || 'bg-slate-100 text-slate-600 ring-slate-300'
                            }`}
                          >
                            {c.phan_loai || 'Thường'}
                          </span>

                          {/* Gợi ý nâng hạng: chỉ nhắc, bấm mới đổi */}
                          {nenNangHang(c) && (
                            <button
                              type="button"
                              onClick={() => nangLenTiemNang(c)}
                              disabled={nangHangId === c.id}
                              title={`Thu nhập ${c.muc_luong} — bấm để nâng lên Tiềm năng`}
                              className="mt-1 block text-xs font-medium text-vtb-red-dark underline decoration-dotted underline-offset-2 transition hover:text-vtb-red disabled:opacity-50"
                            >
                              {nangHangId === c.id
                                ? 'Đang nâng...'
                                : '↑ Nên nâng lên Tiềm năng'}
                            </button>
                          )}
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
                          {xemThungRac ? (
                            dangKhoiPhucId === c.id ? (
                              <Spinner size="sm" className="ml-auto text-vtb-blue" />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => khoiPhuc(c)}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-vtb-blue transition hover:bg-vtb-blue-light"
                                >
                                  Khôi phục
                                </button>
                                <button
                                  type="button"
                                  onClick={() => xoaVinhVien(c)}
                                  className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                >
                                  Xoá vĩnh viễn
                                </button>
                              </>
                            )
                          ) : (
                          <>
                          <button
                            type="button"
                            onClick={() => setContacting(c)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-vtb-blue-dark transition hover:bg-vtb-blue-light"
                          >
                            Chăm sóc
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(c)}
                            className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-vtb-blue transition hover:bg-vtb-blue-light"
                          >
                            Sửa
                          </button>
                          {/* Chỉ quản trị viên mới được xoá khách hàng */}
                          {quanTri && (
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              disabled={deletingId === c.id}
                              className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === c.id ? 'Đang xoá...' : 'Xoá'}
                            </button>
                          )}
                          </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <PhanTrang
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPage={setPage}
              onLimit={setLimit}
            />
          </section>
        </main>
        )}
      </div>

      {/* ============ Modal chỉnh sửa ============ */}
      <EditCustomerModal
        customer={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      {/* ============ Modal nhập từ Excel ============ */}
      <ImportModal
        open={dangNhapFile}
        onClose={() => setDangNhapFile(false)}
        onDone={() => {
          fetchCustomers();
          fetchStats();
        }}
      />

      {/* ============ Modal chăm sóc khách hàng ============ */}
      <ContactModal
        customer={contacting}
        onClose={() => setContacting(null)}
        onSaved={handleSaved}
      />

      {/* ============ Modal hồ sơ cá nhân ============ */}
      <ProfileModal
        open={xemHoSo}
        onClose={() => setXemHoSo(false)}
        onSaved={(hoSo) => setTenHienThi(hoSo.ho_ten || hoSo.username)}
        onDoiMatKhauXong={handleLogout}
      />
    </div>
  );
}
