/**
 * Logo OCB dựng bằng SVG theo màu thương hiệu.
 * Dùng SVG thay vì file ảnh để logo luôn nét ở mọi kích thước
 * và không phụ thuộc vào tài nguyên bên ngoài.
 *
 * @param {object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - kích thước logo
 * @param {boolean} [props.showText=true]    - có hiện dòng chữ bên cạnh không
 * @param {boolean} [props.light=false]      - dùng chữ màu trắng (đặt trên nền tối)
 */
export default function OcbLogo({ size = 'md', showText = true, light = false }) {
  const sizes = {
    sm: { box: 32, title: 'text-base', sub: 'text-[10px]' },
    md: { box: 40, title: 'text-lg', sub: 'text-[11px]' },
    lg: { box: 56, title: 'text-2xl', sub: 'text-xs' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={s.box}
        height={s.box}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo OCB"
        role="img"
        className="shrink-0"
      >
        {/* Nền xanh lá thương hiệu */}
        <rect width="48" height="48" rx="11" fill="#00813D" />
        {/* Vòng cung cam gợi hình chữ O */}
        <path
          d="M24 8a16 16 0 0 1 16 16"
          stroke="#F47920"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <text
          x="24"
          y="32"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="15"
          fontWeight="700"
          fontFamily="Inter, Segoe UI, sans-serif"
          letterSpacing="0.5"
        >
          OCB
        </text>
      </svg>

      {showText && (
        <div className="leading-tight">
          <div
            className={`font-bold ${s.title} ${
              light ? 'text-white' : 'text-ocb-green'
            }`}
          >
            OCB
          </div>
          <div
            className={`${s.sub} font-medium uppercase tracking-wide ${
              light ? 'text-white/70' : 'text-slate-500'
            }`}
          >
            Quản lý khách hàng
          </div>
        </div>
      )}
    </div>
  );
}
