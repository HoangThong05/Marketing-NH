// Màn hình nhật ký thao tác. Chỉ quản trị viên vào được.
//
// Lọc và phân trang đều do server làm — bản trước tải 200 dòng gần nhất rồi
// lọc trên trình duyệt, nên mọi thao tác cũ hơn 200 dòng đều không tra được.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { activityAPI, getErrorMessage } from '../services/api';
import {
  HANH_DONG_NHAN,
  HANH_DONG_BADGE,
  DOI_TUONG_NHAN,
} from '../constants';
import Spinner, { LoadingBlock } from '../components/Spinner';
import PhanTrang from '../components/PhanTrang';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [danhSachNguoi, setDanhSachNguoi] = useState([]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [filterNguoi, setFilterNguoi] = useState('');
  const [filterDoiTuong, setFilterDoiTuong] = useState('');
  const [filterHanhDong, setFilterHanhDong] = useState('');
  const [tuNgay, setTuNgay] = useState('');
  const [denNgay, setDenNgay] = useState('');

  const coBoLoc = Boolean(
    filterNguoi || filterDoiTuong || filterHanhDong || tuNgay || denNgay
  );

  const xoaBoLoc = () => {
    setFilterNguoi('');
    setFilterDoiTuong('');
    setFilterHanhDong('');
    setTuNgay('');
    setDenNgay('');
  };

  // Đổi bộ lọc thì quay về trang 1, nếu không đang ở trang 8 mà lọc còn
  // 2 trang sẽ ra danh sách trống không hiểu vì sao
  useEffect(() => {
    setPage(1);
  }, [filterNguoi, filterDoiTuong, filterHanhDong, tuNgay, denNgay, limit]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activityAPI.getAll({
        page,
        limit,
        username: filterNguoi || undefined,
        doi_tuong: filterDoiTuong || undefined,
        hanh_dong: filterHanhDong || undefined,
        tu_ngay: tuNgay || undefined,
        den_ngay: denNgay || undefined,
      });
      setLogs(data.data || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error(getErrorMessage(error, 'Không thể tải nhật ký thao tác.'));
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterNguoi, filterDoiTuong, filterHanhDong, tuNgay, denNgay]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Danh sách người thực hiện lấy riêng từ toàn bộ nhật ký, không suy ra
  // từ trang đang xem — nếu suy ra thì ô lọc chỉ có tên trong trang đó.
  useEffect(() => {
    activityAPI
      .nguoiThucHien()
      .then(({ data }) => setDanhSachNguoi(data.data || []))
      .catch(() => {});
  }, []);

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5">
          <div className="min-w-[180px] flex-1">
            <h2 className="text-sm font-semibold text-slate-800">Nhật ký thao tác</h2>
            <p className="mt-0.5 text-xs text-slate-500">{total} bản ghi</p>
          </div>

          <select
            value={filterNguoi}
            onChange={(e) => setFilterNguoi(e.target.value)}
            aria-label="Lọc theo người thực hiện"
            className="input-field sm:w-40"
          >
            <option value="">Tất cả người dùng</option>
            {danhSachNguoi.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={filterHanhDong}
            onChange={(e) => setFilterHanhDong(e.target.value)}
            aria-label="Lọc theo hành động"
            className="input-field sm:w-40"
          >
            <option value="">Tất cả hành động</option>
            {Object.entries(HANH_DONG_NHAN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filterDoiTuong}
            onChange={(e) => setFilterDoiTuong(e.target.value)}
            aria-label="Lọc theo đối tượng"
            className="input-field sm:w-40"
          >
            <option value="">Tất cả đối tượng</option>
            {Object.entries(DOI_TUONG_NHAN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={tuNgay}
              onChange={(e) => setTuNgay(e.target.value)}
              aria-label="Từ ngày"
              className="input-field sm:w-36"
            />
            <span className="text-sm text-slate-400">&rarr;</span>
            <input
              type="date"
              value={denNgay}
              onChange={(e) => setDenNgay(e.target.value)}
              aria-label="Đến ngày"
              className="input-field sm:w-36"
            />
          </div>

          {coBoLoc && (
            <button
              type="button"
              onClick={xoaBoLoc}
              className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Xoá bộ lọc
            </button>
          )}

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-ghost !px-3 !py-2"
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
            Tải lại
          </button>
        </div>

        {loading ? (
          <LoadingBlock label="Đang tải nhật ký..." />
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-slate-600">
              {coBoLoc
                ? 'Không có bản ghi nào khớp bộ lọc.'
                : 'Chưa có thao tác nào được ghi nhận.'}
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
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Thời gian</th>
                  <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                  <th className="px-4 py-3 font-semibold">Hành động</th>
                  <th className="px-4 py-3 font-semibold">Đối tượng</th>
                  <th className="px-4 py-3 font-semibold">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">
                      {formatDateTime(l.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                      {l.username || 'không rõ'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                          HANH_DONG_BADGE[l.hanh_dong] ||
                          'bg-slate-100 text-slate-600 ring-slate-300'
                        }`}
                      >
                        {HANH_DONG_NHAN[l.hanh_dong] || l.hanh_dong}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {DOI_TUONG_NHAN[l.doi_tuong] || l.doi_tuong}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{l.mo_ta || '—'}</td>
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

      <p className="text-xs text-slate-500">
        Nhật ký chỉ ghi thêm, không sửa và không xoá được — kể cả bằng giao diện
        quản trị. Toàn bộ lịch sử đều tra được qua bộ lọc và phân trang.
      </p>
    </main>
  );
}
