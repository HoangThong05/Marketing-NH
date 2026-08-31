/**
 * Vòng xoay loading dùng chung.
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {string} [props.className] - lớp Tailwind bổ sung (ví dụ đổi màu)
 */
export default function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

  return (
    <svg
      className={`animate-spin ${sizes[size] || sizes.md} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Khối loading chiếm trọn vùng chứa, kèm dòng chữ mô tả */
export function LoadingBlock({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner size="lg" className="text-ocb-green" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
