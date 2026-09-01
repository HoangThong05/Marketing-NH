// Tiện ích dùng chung cho các endpoint có phân trang.

/**
 * PostgREST trả 416 kèm mã PGRST103 khi vị trí bắt đầu vượt quá số bản ghi,
 * chứ không trả về danh sách rỗng. Nếu để nguyên thì backend biến nó thành
 * lỗi 500.
 *
 * Tình huống gặp thật: đang ở trang cuối chỉ còn một dòng, xoá dòng đó đi,
 * rồi vòng tự tải lại vẫn xin đúng trang cũ — trang đó giờ không còn tồn tại.
 *
 * @param {unknown} error - đối tượng lỗi từ supabase-js
 */
export const laLoiVuotTrang = (error) => error?.code === 'PGRST103';

/**
 * Đếm tổng số bản ghi khớp bộ lọc, dùng khi đã lỡ xin trang vượt quá.
 * Chỉ chạy trong trường hợp hiếm này nên không ảnh hưởng tốc độ thường ngày.
 *
 * @param {Function} dungTruyVan - hàm dựng lại truy vấn đếm kèm đúng bộ lọc
 */
export async function demTong(dungTruyVan) {
  const { count, error } = await dungTruyVan();
  if (error) throw error;
  return count || 0;
}

/** Gói phản hồi phân trang cho một trang rỗng */
export function trangRong(page, limit, total) {
  return {
    success: true,
    data: [],
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}
