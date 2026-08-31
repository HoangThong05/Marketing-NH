/**
 * Logo OCB chính thức.
 * File ảnh đặt tại frontend/public/ocb-logo.jpg
 *
 * Ảnh là JPG nên nền trắng đặc, không trong suốt. Vì vậy logo luôn được đặt
 * trên một tấm nền trắng bo góc: trên nền tối (sidebar, trang login) thì để
 * logo không bị chìm, trên nền sáng thì để khối trắng của ảnh trông có chủ ý.
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md'] - cỡ logo
 * @param {string} [props.className]              - lớp Tailwind bổ sung
 */
export default function OcbLogo({ size = 'md', className = '' }) {
  // Logo có tỉ lệ ngang khoảng 3:1 nên chỉ cần khống chế chiều cao.
  // Cỡ xl thu nhỏ lại trên màn hình hẹp để không tràn ra ngoài.
  const sizes = {
    sm: { img: 'h-6', pad: 'px-3 py-2', radius: 'rounded-lg' },
    md: { img: 'h-9', pad: 'px-4 py-2.5', radius: 'rounded-xl' },
    lg: { img: 'h-14', pad: 'px-5 py-3', radius: 'rounded-xl' },
    xl: { img: 'h-16 sm:h-20', pad: 'px-6 py-4 sm:px-8 sm:py-5', radius: 'rounded-2xl' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div
      className={`inline-flex ${s.radius} ${s.pad} bg-white shadow-sm ring-1 ring-black/5 ${className}`}
    >
      <img
        src="/ocb-logo.jpg"
        alt="OCB - Ngân hàng Phương Đông"
        className={`${s.img} w-auto object-contain`}
      />
    </div>
  );
}
