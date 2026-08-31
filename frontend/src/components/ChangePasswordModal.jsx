// Modal đổi mật khẩu cho tài khoản đang đăng nhập.
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { authAPI, getErrorMessage } from '../services/api';
import Spinner from './Spinner';
import PasswordInput from './PasswordInput';

/**
 * @param {object} props
 * @param {boolean} props.open       - có mở modal hay không
 * @param {() => void} props.onClose - đóng modal
 * @param {() => void} props.onDone  - gọi sau khi đổi thành công (để đăng xuất)
 */
export default function ChangePasswordModal({ open, onClose, onDone }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      current_password: '',
      new_password: '',
      confirm_password: '',
    },
  });

  // Xoá trắng form mỗi lần mở lại, tránh còn sót mật khẩu lần trước
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  // Cho phép đóng bằng phím Esc
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = async (values) => {
    try {
      await authAPI.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });

      toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      onClose();
      onDone();
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể đổi mật khẩu.');

      // Backend trả 403 khi mật khẩu hiện tại sai — báo ngay dưới đúng ô đó
      if (error?.response?.status === 403) {
        setError('current_password', { type: 'manual', message });
      }
      toast.error(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="pwd-modal-title" className="text-lg font-bold text-slate-800">
            Đổi mật khẩu
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
          {/* --- Mật khẩu hiện tại --- */}
          <div>
            <label htmlFor="current_password" className="form-label">
              Mật khẩu hiện tại <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              id="current_password"
              autoComplete="current-password"
              className={errors.current_password ? 'input-error' : ''}
              {...register('current_password', {
                required: 'Vui lòng nhập mật khẩu hiện tại',
              })}
            />
            {errors.current_password && (
              <span className="error-text">{errors.current_password.message}</span>
            )}
          </div>

          {/* --- Mật khẩu mới --- */}
          <div>
            <label htmlFor="new_password" className="form-label">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              id="new_password"
              autoComplete="new-password"
              className={errors.new_password ? 'input-error' : ''}
              {...register('new_password', {
                required: 'Vui lòng nhập mật khẩu mới',
                minLength: {
                  value: 8,
                  message: 'Mật khẩu mới phải có ít nhất 8 ký tự',
                },
                validate: (v) =>
                  v !== watch('current_password') ||
                  'Mật khẩu mới phải khác mật khẩu hiện tại',
              })}
            />
            {errors.new_password ? (
              <span className="error-text">{errors.new_password.message}</span>
            ) : (
              <span className="mt-1 block text-xs text-slate-400">
                Ít nhất 8 ký tự. Nên có chữ hoa, số và ký tự đặc biệt.
              </span>
            )}
          </div>

          {/* --- Xác nhận mật khẩu mới --- */}
          <div>
            <label htmlFor="confirm_password" className="form-label">
              Nhập lại mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              id="confirm_password"
              autoComplete="new-password"
              className={errors.confirm_password ? 'input-error' : ''}
              {...register('confirm_password', {
                required: 'Vui lòng nhập lại mật khẩu mới',
                validate: (v) =>
                  v === watch('new_password') || 'Hai mật khẩu không khớp',
              })}
            />
            {errors.confirm_password && (
              <span className="error-text">{errors.confirm_password.message}</span>
            )}
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Sau khi đổi, bạn sẽ được đăng xuất và cần đăng nhập lại bằng mật khẩu mới.
          </p>

          <div className="flex gap-3 pt-1">
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
                'Đổi mật khẩu'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
