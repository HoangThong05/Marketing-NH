// Số điện thoại bấm một cái là chép.
//
// Nhân viên phải gọi hàng trăm khách, mỗi lần đều bôi đen số rồi Ctrl+C —
// thao tác nhỏ nhưng lặp đúng bằng số khách, và bôi đen hụt một chữ số thì
// gọi nhầm người.
import { useEffect, useRef, useState } from 'react';

/**
 * Chép một chuỗi vào clipboard.
 *
 * navigator.clipboard chỉ chạy trên HTTPS (hoặc localhost). App chạy trên
 * Vercel nên luôn có HTTPS, nhưng vẫn giữ cách dự phòng cũ: chép hụt mà
 * không báo gì thì người dùng dán ra số của khách TRƯỚC ĐÓ mà không hề biết.
 */
async function chepVaoClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Rơi xuống cách dự phòng bên dưới
  }

  try {
    const o = document.createElement('textarea');
    o.value = text;
    o.setAttribute('readonly', '');
    o.style.position = 'fixed';
    o.style.top = '-1000px';
    o.style.opacity = '0';
    document.body.appendChild(o);
    o.select();
    const xong = document.execCommand('copy');
    document.body.removeChild(o);
    return xong;
  } catch {
    return false;
  }
}

/**
 * @param {string} so - số điện thoại
 * @param {string} [className] - lớp CSS cho phần chữ số
 */
export default function SoDienThoai({ so, className = '' }) {
  const [daChep, setDaChep] = useState(false);
  const hetGio = useRef(null);

  // Dọn bộ đếm khi rời màn hình, tránh gọi setState trên component đã gỡ
  useEffect(() => () => clearTimeout(hetGio.current), []);

  if (!so) return <span className="text-slate-400">—</span>;

  const bam = async (e) => {
    // Dòng khách hàng bọc ngoài có thể có onClick riêng (mở modal sửa),
    // chép số mà mở luôn cả modal thì rất khó chịu.
    e.stopPropagation();

    const xong = await chepVaoClipboard(so);
    if (!xong) return;

    setDaChep(true);
    clearTimeout(hetGio.current);
    hetGio.current = setTimeout(() => setDaChep(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={bam}
      title={daChep ? 'Đã chép' : 'Bấm để chép số'}
      className="group inline-flex items-center gap-1 rounded transition hover:text-ocb-green focus:outline-none focus-visible:ring-2 focus-visible:ring-ocb-green/40"
    >
      <span className={`tabular-nums ${className}`}>{so}</span>

      {/* Ô rộng cố định cho dấu tích. Để nó tự co giãn thì mỗi lần chép xong
          cả dòng lại nhích sang một chút, nhìn rất giật. */}
      <span className="inline-flex w-3 shrink-0 justify-center" aria-hidden="true">
        {daChep && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="m5 13 4 4L19 7"
              stroke="#00813D"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {/* Trình đọc màn hình cần được báo, không nhìn thấy dấu tích được */}
      <span className="sr-only" role="status">
        {daChep ? 'Đã chép số điện thoại' : ''}
      </span>
    </button>
  );
}

/**
 * Nút chép chỉ có biểu tượng, không kèm chữ số.
 *
 * Dùng ở chỗ bản thân con số đã là một liên kết khác — trong modal Chăm sóc
 * thì bấm vào số là GỌI, nên nút chép phải đứng riêng, không thể gộp làm một.
 *
 * @param {string} text - nội dung cần chép
 * @param {string} [nhan] - nhãn cho trình đọc màn hình
 */
export function NutChep({ text, nhan = 'Chép' }) {
  const [daChep, setDaChep] = useState(false);
  const hetGio = useRef(null);

  useEffect(() => () => clearTimeout(hetGio.current), []);

  if (!text) return null;

  const bam = async () => {
    if (!(await chepVaoClipboard(text))) return;
    setDaChep(true);
    clearTimeout(hetGio.current);
    hetGio.current = setTimeout(() => setDaChep(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={bam}
      title={daChep ? 'Đã chép' : nhan}
      aria-label={daChep ? 'Đã chép' : nhan}
      className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-ocb-green focus:outline-none focus-visible:ring-2 focus-visible:ring-ocb-green/40"
    >
      {daChep ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m5 13 4 4L19 7"
            stroke="#00813D"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="9"
            y="9"
            width="11"
            height="11"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M5 15V5a2 2 0 0 1 2-2h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
