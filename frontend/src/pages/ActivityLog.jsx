// Màn hình nhật ký thao tác. Chỉ quản trị viên vào được.
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { activityAPI, getErrorMessage } from '../services/api';
import {
  HANH_DONG_NHAN,
  HANH_DONG_BADGE,
  DOI_TUONG_NHAN,
} from '../constants';
import Spinner, { LoadingBlock } from '../components/Spinner';

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
  const [filterDoiTuong, setFilterDoiTuong] = useState('');
  const [filterNguoi, setFilterNguoi] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await activityAPI.getAll({ limit: 200 });
      setLogs(data.data || []);
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error(getErrorMessage(error, 'Không thể tải nhật ký thao tác.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Danh sách người thực hiện có trong nhật ký, để đổ vào dropdown lọc
  const danhSachNguoi = useMemo(() => {
    const set = new Set(logs.map((l) => l.username).filter(Boolean));
    return [...set].sort();
  }, [logs]);

  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (filterDoiTuong && l.doi_tuong !== filterDoiTuong) return false;
        if (filterNguoi && l.username !== filterNguoi) return false;
        return true;
      }),
    [logs, filterDoiTuong, filterNguoi]
  );

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-800">Nhật ký thao tác</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {filtered.length} / {logs.length} bản ghi gần nhất
            </p>
          </div>

          <select
            value={filterNguoi}
            onChange={(e) => setFilterNguoi(e.target.value)}
            aria-label="Lọc theo người thực hiện"
            className="input-field sm:w-44"
          >
            <option value="">Tất cả người dùng</option>
            {danhSachNguoi.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={filterDoiTuong}
            onChange={(e) => setFilterDoiTuong(e.target.value)}
            aria-label="Lọc theo đối tượng"
            className="input-field sm:w-44"
          >
            <option value="">Tất cả đối tượng</option>
            {Object.entries(DOI_TUONG_NHAN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-ghost !px-3 !py-2"
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
            Tải lại
          </button>
        </div>

        {loading ? (
          <LoadingBlock label="Đang tải nhật ký..." />
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">
            {logs.length === 0
              ? 'Chưa có thao tác nào được ghi nhận.'
              : 'Không có bản ghi nào khớp bộ lọc.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
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
                {filtered.map((l) => (
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
      </section>

      <p className="text-xs text-slate-500">
        Nhật ký chỉ ghi thêm, không sửa và không xoá được — kể cả bằng giao diện
        quản trị. Hiển thị tối đa 200 bản ghi gần nhất.
      </p>
    </main>
  );
}
