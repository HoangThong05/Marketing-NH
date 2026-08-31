/**
 * Logo OCB chính thức.
 * File ảnh đặt tại frontend/public/ocb-logo.jpg
 *
 * Ảnh là JPG nên nền trắng đặc, không trong suốt. Vì vậy logo luôn được đặt
 * trên một tấm nền trắng bo góc: trên nền tối (sidebar, trang login) thì để
 * logo không bị chìm, trên nền sáng thì để khối trắng của ảnh trông có chủ ý.
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - chiều cao logo
 * @param {string} [props.className]         - lớp Tailwind bổ sung
 */
export default function OcbLogo({ size = 'md', className = '' }) {
  // Logo có tỉ lệ ngang khoảng 3:1 nên chỉ cần khống chế chiều cao
  const heights = {
    sm: 'h-6',
    md: 'h-9',
    lg: 'h-14',
  };

  return (
    <div
      className={`inline-flex rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-black/5 ${className}`}
    >
      <img
        src="/ocb-logo.jpg"
        alt="OCB - Ngân hàng Phương Đông"
        className={`${heights[size] || heights.md} w-auto object-contain`}
      />
    </div>
  );
}
