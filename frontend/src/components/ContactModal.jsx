// Modal chăm sóc khách hàng: ghi nhận một lần liên hệ và xem lại lịch sử.
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { customerAPI, getErrorMessage } from '../services/api';
import { TRANG_THAI_LIST, TRANG_THAI_BADGE } from '../constants';
import Spinner from './Spinner';

/** Định dạng ngày giờ đầy đủ theo kiểu Việt Nam */
const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
};

/**
 * Đổi chuỗi ISO thành giá trị cho input datetime-local (theo giờ máy người dùng).
 * Input này không nhận chuỗi ISO có múi giờ nên phải tự bù lệch.
 */
const toDatetimeLocal = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

/**
 * @param {object} props
 * @param {object|null} props.customer - khách hàng đang chăm sóc (null = đóng)
 * @param {() => void} props.onClose
 * @param {(updated: object) => void} props.onSaved - khách hàng sau khi đổi trạng thái
 */
export default function ContactModal({ customer, onClose, onSaved }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { trang_thai: 'Đã gọi', ket_qua: '', hen_goi_lai: '' },
  });

  const trangThai = watch('trang_thai');
  const canHenGioLai = trangThai === 'Hẹn gọi lại';

  /** Tải lịch sử liên hệ của khách hàng đang mở */
  const fetchHistory = useCallback(async (id) => {
    setLoadingHistory(true);
    try {
      const { data } = await customerAPI.getContacts(id);
      setHistory(data.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không tải được lịch sử liên hệ.'));
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (!customer) return;
    // Gợi ý sẵn trạng thái kế tiếp: khách "Mới" thì lần này là "Đã gọi"
    reset({
      trang_thai: customer.trang_thai === 'Mới' ? 'Đã gọi' : customer.trang_thai,
      ket_qua: '',
      hen_goi_lai: '',
    });
    setHistory([]);
    fetchHistory(customer.id);
  }, [customer, reset, fetchHistory]);

  // Cho phép đóng bằng phím Esc
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
      const payload = {
        trang_thai: values.trang_thai,
        ket_qua: values.ket_qua,
        // Chỉ gửi lịch hẹn khi trạng thái thực sự là "Hẹn gọi lại"
        hen_goi_lai:
          values.trang_thai === 'Hẹn gọi lại' && values.hen_goi_lai
            ? new Date(values.hen_goi_lai).toISOString()
            : null,
      };

      const { data } = await customerAPI.addContact(customer.id, payload);

      toast.success('Đã ghi nhận lần liên hệ.');
      onSaved(data.customer);

      // Ở lại trong modal, chỉ nạp lại lịch sử để thấy ngay bản ghi vừa thêm
      reset({ trang_thai: values.trang_thai, ket_qua: '', hen_goi_lai: '' });
      fetchHistory(customer.id);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không ghi nhận được lần liên hệ.'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in-up flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Đầu modal */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 id="contact-modal-title" className="text-lg font-bold text-slate-800">
              Chăm sóc khách hàng
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-500">
              {customer.ten_khach_hang} · {customer.so_dien_thoai}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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

        <div className="flex-1 overflow-y-auto">
          {/* --- Form ghi nhận lần liên hệ --- */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="ct_trang_thai" className="form-label">
                  Kết quả liên hệ <span className="text-red-500">*</span>
                </label>
                <select
                  id="ct_trang_thai"
                  className="input-field"
                  {...register('trang_thai', { required: true })}
                >
                  {TRANG_THAI_LIST.filter((t) => t !== 'Mới').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ô hẹn giờ chỉ hiện khi chọn "Hẹn gọi lại" */}
              {canHenGioLai && (
                <div>
                  <label htmlFor="ct_hen" className="form-label">
                    Hẹn gọi lại lúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ct_hen"
                    type="datetime-local"
                    min={toDatetimeLocal(new Date())}
                    className={`input-field ${errors.hen_goi_lai ? 'input-error' : ''}`}
                    {...register('hen_goi_lai', {
                      required: canHenGioLai ? 'Vui lòng chọn thời gian hẹn' : false,
                    })}
                  />
                  {errors.hen_goi_lai && (
                    <span className="error-text">{errors.hen_goi_lai.message}</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="ct_ket_qua" className="form-label">
                Nội dung trao đổi
              </label>
              <textarea
                id="ct_ket_qua"
                rows={3}
                placeholder="Khách quan tâm sản phẩm gì, vướng mắc ở đâu, cần chuẩn bị gì cho lần sau..."
                className="input-field resize-none"
                {...register('ket_qua', {
                  maxLength: { value: 1000, message: 'Không quá 1000 ký tự' },
                })}
              />
              {errors.ket_qua && (
                <span className="error-text">{errors.ket_qua.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Đang lưu...
                </>
              ) : (
                'Ghi nhận lần liên hệ'
              )}
            </button>
          </form>

          {/* --- Lịch sử --- */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-5">
            <h3 className="text-sm font-semibold text-slate-800">
              Lịch sử liên hệ
              {history.length > 0 && (
                <span className="ml-1.5 font-normal text-slate-500">
                  ({history.length} lần)
                </span>
              )}
            </h3>

            {loadingHistory ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Spinner size="sm" className="text-ocb-green" />
                Đang tải...
              </div>
            ) : history.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                Chưa có lần liên hệ nào được ghi nhận.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-white p-3.5 ring-1 ring-slate-200"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          TRANG_THAI_BADGE[item.trang_thai] ||
                          'bg-slate-100 text-slate-600 ring-slate-300'
                        }`}
                      >
                        {item.trang_thai}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatDateTime(item.created_at)}
                      </span>
                      <span className="text-xs text-slate-400">
                        · {item.username || 'không rõ'}
                      </span>
                    </div>

                    {item.ket_qua && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                        {item.ket_qua}
                      </p>
                    )}

                    {item.hen_goi_lai && (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Hẹn gọi lại: {formatDateTime(item.hen_goi_lai)}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
