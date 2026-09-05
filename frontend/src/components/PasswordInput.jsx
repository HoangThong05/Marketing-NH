// Ô nhập mật khẩu có nút con mắt để ẩn/hiện nội dung.
//
// Dùng forwardRef để react-hook-form gắn được ref khi spread register()
// vào component này giống như spread vào một thẻ <input> bình thường.
import { forwardRef, useState } from 'react';

const PasswordInput = forwardRef(function PasswordInput(
  { className = '', ...props },
  ref
) {
  const [hien, setHien] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={hien ? 'text' : 'password'}
        // pr-11 chừa chỗ cho nút con mắt, tránh chữ chạy xuống dưới icon
        className={`input-field pr-11 ${className}`}
        {...props}
      />

      <button
        type="button"
        onClick={() => setHien((v) => !v)}
        aria-label={hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={hien}
        title={hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-vtb-blue/30"
      >
        {hien ? (
          // Con mắt bị gạch chéo: đang hiện, bấm để ẩn
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.2A9.5 9.5 0 0 1 12 4.9c5 0 9 4.1 9 7.1a9 9 0 0 1-2.4 3.9M6.2 6.7A11 11 0 0 0 3 12c0 3 4 7.1 9 7.1a9.6 9.6 0 0 0 3.7-.7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          // Con mắt bình thường: đang ẩn, bấm để hiện
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12s3.6-7.1 9-7.1S21 12 21 12s-3.6 7.1-9 7.1S3 12 3 12Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </button>
    </div>
  );
});

export default PasswordInput;
