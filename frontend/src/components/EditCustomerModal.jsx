// Modal chỉnh sửa thông tin khách hàng.
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { customerAPI, getErrorMessage } from '../services/api';
import Spinner from './Spinner';
import { chuanHoaSoDienThoai } from '../utils/dienThoai';
import { NGHE_NGHIEP_GOI_Y, MUC_LUONG_LIST } from '../constants';

const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])[0-9]{7}$/;
const PHAN_LOAI_OPTIONS = ['Thường', 'Tiềm năng'];

/**
 * @param {object} props
 * @param {object|null} props.customer - khách hàng đang sửa (null = đóng modal)
 * @param {() => void} props.onClose   - đóng modal
 * @param {(updated: object) => void} props.onSaved - gọi lại khi lưu thành công
 */
export default function EditCustomerModal({ customer, onClose, onSaved }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm();

  // Nạp dữ liệu khách hàng vào form mỗi khi mở modal cho một người khác
  useEffect(() => {
    if (customer) {
      reset({
        so_dien_thoai: customer.so_dien_thoai || '',
        ten_khach_hang: customer.ten_khach_hang || '',
        dia_chi: customer.dia_chi || '',
        phan_loai: customer.phan_loai || 'Thường',
        nghe_nghiep: customer.nghe_nghiep || '',
        muc_luong: customer.muc_luong || '',
        ghi_chu: customer.ghi_chu || '',
      });
    }
  }, [customer, reset]);

  // Cho phép đóng modal bằng phím Esc
  useEffect(() => {
    if (!customer) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customer, onClose]);

  if (!customer) return null;

  const onSubmit = async (values) => {
    try {
      const { data } = await customerAPI.update(customer.id, {
        ...values,
        ten_khach_hang: values.ten_khach_hang.trim(),
      });

      toast.success('Cập nhật khách hàng thành công.');
      onSaved(data.data);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể cập nhật khách hàng.'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
      // Bấm ra ngoài để đóng, nhưng bấm bên trong thẻ thì không
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in-up max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Đầu modal */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 id="edit-modal-title" className="text-lg font-bold text-slate-800">
            Sửa thông tin khách hàng
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
          {/* --- Số điện thoại --- */}
          <div>
            <label htmlFor="edit_sdt" className="form-label">
              Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              id="edit_sdt"
              type="tel"
              className={`input-field ${errors.so_dien_thoai ? 'input-error' : ''}`}
              {...register('so_dien_thoai', {
                required: 'Vui lòng nhập số điện thoại',
                setValueAs: (v) => chuanHoaSoDienThoai(v),
                pattern: {
                  value: PHONE_REGEX,
                  message: 'Số điện thoại không hợp lệ',
                },
              })}
            />
            {errors.so_dien_thoai && (
              <span className="error-text">{errors.so_dien_thoai.message}</span>
            )}
          </div>

          {/* --- Tên khách hàng --- */}
          <div>
            <label htmlFor="edit_ten" className="form-label">
              Tên khách hàng <span className="text-red-500">*</span>
            </label>
            <input
              id="edit_ten"
              type="text"
              className={`input-field ${errors.ten_khach_hang ? 'input-error' : ''}`}
              {...register('ten_khach_hang', {
                required: 'Vui lòng nhập tên khách hàng',
                minLength: { value: 2, message: 'Tên phải có ít nhất 2 ký tự' },
              })}
            />
            {errors.ten_khach_hang && (
              <span className="error-text">{errors.ten_khach_hang.message}</span>
            )}
          </div>

          {/* --- Địa chỉ --- */}
          <div>
            <label htmlFor="edit_dia_chi" className="form-label">
              Địa chỉ
            </label>
            <input id="edit_dia_chi" type="text" className="input-field" {...register('dia_chi')} />
          </div>

          {/* --- Phân loại --- */}
          <div>
            <label htmlFor="edit_phan_loai" className="form-label">
              Phân loại
            </label>
            <select id="edit_phan_loai" className="input-field" {...register('phan_loai')}>
              {PHAN_LOAI_OPTIONS.map((loai) => (
                <option key={loai} value={loai}>
                  {loai}
                </option>
              ))}
            </select>
          </div>

          {/* --- Nghề nghiệp --- */}
          <div>
            <label htmlFor="edit_nghe_nghiep" className="form-label">
              Nghề nghiệp
            </label>
            {/* Dùng input + datalist: vừa gợi ý sẵn danh sách, vừa cho phép
                sửa thành nghề khách tự nhập ở form công khai */}
            <input
              id="edit_nghe_nghiep"
              type="text"
              list="ds-nghe-nghiep"
              placeholder="Chọn hoặc tự nhập"
              className="input-field"
              {...register('nghe_nghiep')}
            />
            <datalist id="ds-nghe-nghiep">
              {NGHE_NGHIEP_GOI_Y.map((nn) => (
                <option key={nn} value={nn} />
              ))}
            </datalist>
          </div>

          {/* --- Mức thu nhập --- */}
          <div>
            <label htmlFor="edit_muc_luong" className="form-label">
              Mức thu nhập
            </label>
            <select id="edit_muc_luong" className="input-field" {...register('muc_luong')}>
              <option value="">-- Chưa xác định --</option>
              {MUC_LUONG_LIST.map((ml) => (
                <option key={ml} value={ml}>
                  {ml}
                </option>
              ))}
            </select>
          </div>

          {/* --- Ghi chú --- */}
          <div>
            <label htmlFor="edit_ghi_chu" className="form-label">
              Ghi chú
            </label>
            <textarea
              id="edit_ghi_chu"
              rows={3}
              className="input-field resize-none"
              {...register('ghi_chu')}
            />
          </div>

          {/* --- Nút hành động --- */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Huỷ
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
