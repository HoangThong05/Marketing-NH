// Modal hồ sơ cá nhân. Ai đăng nhập cũng dùng được, kể cả nhân viên.
//
// Gồm hai tab: thông tin cá nhân và đổi mật khẩu. Gộp chung vì cả hai đều là
// "việc với tài khoản của chính tôi" — tách thành hai mục riêng ở sidebar chỉ
// làm menu dài ra mà không rõ nghĩa hơn.
//
// Chỉ cho tự sửa họ tên hiển thị và mật khẩu. Tên đăng nhập, vai trò và trạng
// thái tài khoản đều cố định — chúng thuộc quyền của quản trị viên.
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { authAPI, getUser, setUser, getErrorMessage } from '../services/api';
import { VAI_TRO_NHAN, VAI_TRO_BADGE } from '../constants';
import Spinner from './Spinner';
import PasswordInput from './PasswordInput';

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

/* ------------------------------------------------------------------ */
/* Tab: thông tin cá nhân                                              */
/* ------------------------------------------------------------------ */

function TabThongTin({ hoSo, onClose, onSaved }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ defaultValues: { ho_ten: hoSo?.ho_ten || '' } });

  const onSubmit = async (values) => {
    try {
      const { data } = await authAPI.updateProfile({ ho_ten: values.ho_ten.trim() });

      // Cập nhật luôn bản lưu trong trình duyệt để lời chào và các chỗ hiển
      // thị tên đổi ngay, không phải đăng xuất rồi đăng nhập lại.
      setUser({ ...getUser(), ho_ten: data.data.ho_ten });

      toast.success('Đã cập nhật hồ sơ.');
      onSaved?.(data.data);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không cập nhật được hồ sơ.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
      {/* --- Thông tin cố định --- */}
      <dl className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Tên đăng nhập</dt>
          <dd className="font-medium text-slate-800">{hoSo?.username}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Vai trò</dt>
          <dd>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                VAI_TRO_BADGE[hoSo?.role] || 'bg-slate-100 text-slate-600 ring-slate-300'
              }`}
            >
              {VAI_TRO_NHAN[hoSo?.role] || hoSo?.role}
            </span>
          </dd>
        </div>
        {hoSo?.created_at && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Ngày tạo tài khoản</dt>
            <dd className="tabular-nums text-slate-700">{formatDate(hoSo.created_at)}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs text-slate-400">
        Tên đăng nhập và vai trò do quản trị viên quản lý, bạn không tự đổi được.
      </p>

      {/* --- Phần tự sửa được --- */}
      <div>
        <label htmlFor="pf_hoten" className="form-label">
          Họ và tên hiển thị
        </label>
        <input
          id="pf_hoten"
          type="text"
          placeholder="Nguyễn Văn A"
          className={`input-field ${errors.ho_ten ? 'input-error' : ''}`}
          {...register('ho_ten', {
            validate: (v) => {
              const t = (v || '').trim();
              if (!t) return true; // để trống được, sẽ hiện tên đăng nhập
              if (t.length < 2) return 'Họ tên phải có ít nhất 2 ký tự';
              if (t.length > 100) return 'Họ tên không được quá 100 ký tự';
              return true;
            },
          })}
        />
        {errors.ho_ten ? (
          <span className="error-text">{errors.ho_ten.message}</span>
        ) : (
          <span className="mt-1 block text-xs text-slate-400">
            Tên này hiện ở lời chào, cột Phụ trách và danh sách nhân viên. Để
            trống thì hệ thống hiện tên đăng nhập.
          </span>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="btn-ghost flex-1">
          Đóng
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="btn-primary flex-1"
        >
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
  );
}

/* ------------------------------------------------------------------ */
/* Tab: đổi mật khẩu                                                   */
/* ------------------------------------------------------------------ */

function TabMatKhau({ onClose, onDone }) {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
      <div>
        <label htmlFor="pf_current" className="form-label">
          Mật khẩu hiện tại <span className="text-red-500">*</span>
        </label>
        <PasswordInput
          id="pf_current"
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

      <div>
        <label htmlFor="pf_new" className="form-label">
          Mật khẩu mới <span className="text-red-500">*</span>
        </label>
        <PasswordInput
          id="pf_new"
          autoComplete="new-password"
          className={errors.new_password ? 'input-error' : ''}
          {...register('new_password', {
            required: 'Vui lòng nhập mật khẩu mới',
            minLength: { value: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự' },
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

      <div>
        <label htmlFor="pf_confirm" className="form-label">
          Nhập lại mật khẩu mới <span className="text-red-500">*</span>
        </label>
        <PasswordInput
          id="pf_confirm"
          autoComplete="new-password"
          className={errors.confirm_password ? 'input-error' : ''}
          {...register('confirm_password', {
            required: 'Vui lòng nhập lại mật khẩu mới',
            validate: (v) => v === watch('new_password') || 'Hai mật khẩu không khớp',
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
          Đóng
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
  );
}

/* ------------------------------------------------------------------ */
/* Modal chính                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(hoSo: object) => void} [props.onSaved]      - sau khi lưu thông tin
 * @param {() => void} props.onDoiMatKhauXong           - sau khi đổi mật khẩu (để đăng xuất)
 */
export default function ProfileModal({ open, onClose, onSaved, onDoiMatKhauXong }) {
  const [hoSo, setHoSo] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [tab, setTab] = useState('thongtin');

  // Lấy hồ sơ từ server mỗi lần mở, không đọc từ localStorage — dữ liệu ở
  // đó là ảnh chụp lúc đăng nhập, admin có thể đã đổi gì đó sau đấy.
  useEffect(() => {
    if (!open) return;
    setTab('thongtin');
    setDangTai(true);
    authAPI
      .getProfile()
      .then(({ data }) => setHoSo(data.data))
      .catch((error) => {
        if (error?.response?.status !== 401) {
          toast.error(getErrorMessage(error, 'Không tải được hồ sơ.'));
        }
        // Không tải được thì tạm dùng dữ liệu đã lưu, còn hơn để trống
        setHoSo(getUser());
      })
      .finally(() => setDangTai(false));
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const cacTab = [
    { key: 'thongtin', nhan: 'Thông tin' },
    { key: 'matkhau', nhan: 'Đổi mật khẩu' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between px-6 pt-4">
          <h2 id="profile-title" className="text-lg font-bold text-slate-800">
            Hồ sơ của tôi
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

        {/* Tab */}
        <div className="mt-3 flex gap-1 border-b border-slate-200 px-6">
          {cacTab.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-selected={tab === t.key}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? 'border-ocb-green text-ocb-green'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.nhan}
            </button>
          ))}
        </div>

        {dangTai ? (
          <div className="flex items-center gap-2 px-6 py-10 text-sm text-slate-500">
            <Spinner size="sm" className="text-ocb-green" />
            Đang tải hồ sơ...
          </div>
        ) : tab === 'thongtin' ? (
          // key theo id để form nạp lại đúng giá trị khi mở hồ sơ lần sau
          <TabThongTin
            key={hoSo?.id}
            hoSo={hoSo}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : (
          <TabMatKhau onClose={onClose} onDone={onDoiMatKhauXong} />
        )}
      </div>
    </div>
  );
}
