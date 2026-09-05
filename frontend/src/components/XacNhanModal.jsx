// Hộp xác nhận của riêng app, thay cho window.confirm().
//
// window.confirm() trông thì tiện nhưng KHÔNG đáng tin trên điện thoại: khi
// một trang bật vài hộp thoại liên tiếp, trình duyệt hiện thêm ô "Ngăn trang
// này tạo thêm hộp thoại". Người dùng tick vào đó một lần là mọi lần gọi
// confirm() sau đều lặng lẽ trả về false — nút Xoá bấm mãi không thấy gì xảy
// ra, không báo lỗi, không có cách nào biết vì sao. Vài trình duyệt nhúng
// (Zalo, Facebook) còn chặn thẳng.
//
// Hộp thoại tự dựng thì luôn hiện, lại hiển thị được đúng ngôn ngữ và màu
// cảnh báo của app.
import { useEffect, useRef } from 'react';

import Spinner from './Spinner';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} props.tieuDe
 * @param {React.ReactNode} props.noiDung
 * @param {string} [props.nhanXacNhan='Xác nhận']
 * @param {boolean} [props.nguyHiem]  - tô đỏ nút xác nhận
 * @param {boolean} [props.dangChay]  - khoá nút và hiện vòng xoay
 * @param {() => void} props.onXacNhan
 * @param {() => void} props.onHuy
 */
export default function XacNhanModal({
  open,
  tieuDe,
  noiDung,
  nhanXacNhan = 'Xác nhận',
  nguyHiem = false,
  dangChay = false,
  onXacNhan,
  onHuy,
}) {
  const nutHuy = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !dangChay) onHuy();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, dangChay, onHuy]);

  // Đưa con trỏ vào nút HUỶ chứ không phải nút xác nhận: mở hộp thoại xoá ra
  // mà lỡ gõ Enter thì mất luôn dữ liệu.
  useEffect(() => {
    if (open) nutHuy.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xac-nhan-tieu-de"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !dangChay) onHuy();
      }}
    >
      <div className="animate-fade-in-up w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="px-6 pb-5 pt-6">
          <h2 id="xac-nhan-tieu-de" className="text-lg font-bold text-slate-800">
            {tieuDe}
          </h2>
          <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
            {noiDung}
          </div>
        </div>

        {/* Nút xếp dọc trên điện thoại cho dễ bấm, ngang trên máy tính.
            Huỷ đứng trước xác nhận, để ngón cái không rơi trúng nút xoá. */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            ref={nutHuy}
            type="button"
            onClick={onHuy}
            disabled={dangChay}
            className="btn-ghost !py-2.5 disabled:opacity-50 sm:!py-2"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onXacNhan}
            disabled={dangChay}
            className={`btn !py-2.5 text-white disabled:opacity-60 sm:!py-2 ${
              nguyHiem
                ? 'bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-600/30'
                : 'bg-vtb-blue hover:bg-vtb-blue-dark focus:ring-2 focus:ring-vtb-blue/30'
            }`}
          >
            {dangChay ? <Spinner size="sm" className="text-white" /> : nhanXacNhan}
          </button>
        </div>
      </div>
    </div>
  );
}
