// Thanh phân trang dùng chung cho các bảng có nhiều dòng.
//
// Nhận toàn bộ trạng thái từ bên ngoài (page, total, limit) và chỉ báo ngược
// lại khi người dùng bấm — không tự giữ trạng thái nào, nên dùng được cho
// bất kỳ bảng nào bất kể dữ liệu đến từ đâu.

export default function PhanTrang({ page, totalPages, total, limit, onPage, onLimit }) {
  if (total === 0) return null;

  const tu = (page - 1) * limit + 1;
  const den = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="tabular-nums">
          {tu}&ndash;{den} trên {total}
        </span>

        <select
          value={limit}
          onChange={(e) => onLimit(Number(e.target.value))}
          aria-label="Số dòng mỗi trang"
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-ocb-green"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} dòng
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(1)}
          disabled={page <= 1}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="Trang đầu"
        >
          &laquo;
        </button>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Trước
        </button>

        <span className="px-2 text-sm tabular-nums text-slate-600">
          Trang <span className="font-semibold">{page}</span> / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Sau
        </button>
        <button
          type="button"
          onClick={() => onPage(totalPages)}
          disabled={page >= totalPages}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          title="Trang cuối"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}
