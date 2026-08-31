// Màn hình quản lý tài khoản nhân viên. Chỉ quản trị viên vào được.
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { userAPI, getUser, getErrorMessage } from '../services/api';
import { VAI_TRO_NHAN, VAI_TRO_BADGE } from '../constants';
import Spinner, { LoadingBlock } from '../components/Spinner';
import PasswordInput from '../components/PasswordInput';

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
/* Modal tạo tài khoản                                                 */
/* ------------------------------------------------------------------ */

function CreateUserModal({ open, onClose, onCreated }) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', ho_ten: '', password: '' },
  });

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const onSubmit = async (values) => {
    try {
      const { data } = await userAPI.create({
        username: values.username.trim().toLowerCase(),
        ho_ten: values.ho_ten.trim(),
        password: values.password,
      });
      toast.success('Đã tạo tài khoản.');
      onCreated(data.data);
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, 'Không thể tạo tài khoản.');
      // Trùng tên đăng nhập thì báo ngay dưới đúng ô đó
      if (error?.response?.status === 409) {
        setError('username', { type: 'manual', message });
      }
      toast.error(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-fade-in-up max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Thêm tài khoản</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
          <div>
            <label htmlFor="u_username" className="form-label">
              Tên đăng nhập <span className="text-red-500">*</span>
            </label>
            <input
              id="u_username"
              type="text"
              autoComplete="off"
              placeholder="nguyenvana"
              className={`input-field ${errors.username ? 'input-error' : ''}`}
              {...register('username', {
                required: 'Vui lòng nhập tên đăng nhập',
                pattern: {
                  value: /^[a-zA-Z0-9_-]{3,32}$/,
                  message: 'Từ 3-32 ký tự, chỉ gồm chữ, số, gạch dưới hoặc gạch ngang',
                },
              })}
            />
            {errors.username ? (
              <span className="error-text">{errors.username.message}</span>
            ) : (
              <span className="mt-1 block text-xs text-slate-400">
                Không dấu, không khoảng trắng. Đặt rồi thì không đổi được.
              </span>
            )}
          </div>

          <div>
            <label htmlFor="u_hoten" className="form-label">
              Họ và tên
            </label>
            <input
              id="u_hoten"
              type="text"
              placeholder="Nguyễn Văn A"
              className="input-field"
              {...register('ho_ten')}
            />
          </div>

          <div>
            <label htmlFor="u_password" className="form-label">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              id="u_password"
              autoComplete="new-password"
              className={errors.password ? 'input-error' : ''}
              {...register('password', {
                required: 'Vui lòng nhập mật khẩu',
                minLength: { value: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
              })}
            />
            {errors.password ? (
              <span className="error-text">{errors.password.message}</span>
            ) : (
              <span className="mt-1 block text-xs text-slate-400">
                Gửi mật khẩu này cho nhân viên, họ tự đổi lại sau khi đăng nhập.
              </span>
            )}
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
            Tài khoản tạo ở đây luôn là <strong>Nhân viên</strong>: xem danh
            sách, chăm sóc và sửa thông tin khách. Không xoá được khách, không
            vào được mục Tài khoản và Nhật ký.
          </p>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Huỷ
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Đang tạo...
                </>
              ) : (
                'Tạo tài khoản'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal đặt lại mật khẩu                                              */
/* ------------------------------------------------------------------ */

function ResetPasswordModal({ user, onClose }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { password: '' } });

  useEffect(() => {
    if (user) reset();
  }, [user, reset]);

  if (!user) return null;

  const onSubmit = async (values) => {
    try {
      await userAPI.resetPassword(user.id, values.password);
      toast.success(`Đã đặt lại mật khẩu cho "${user.username}".`);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể đặt lại mật khẩu.'));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-fade-in-up w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Đặt lại mật khẩu</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Tài khoản: <span className="font-medium">{user.username}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
          <div>
            <label htmlFor="r_password" className="form-label">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <PasswordInput
              id="r_password"
              autoComplete="new-password"
              className={errors.password ? 'input-error' : ''}
              {...register('password', {
                required: 'Vui lòng nhập mật khẩu mới',
                minLength: { value: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
              })}
            />
            {errors.password && (
              <span className="error-text">{errors.password.message}</span>
            )}
          </div>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Không cần biết mật khẩu cũ. Nhớ báo mật khẩu mới cho nhân viên và
            nhắc họ tự đổi lại sau khi đăng nhập.
          </p>

          <div className="flex gap-3">
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
                'Đặt lại'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Màn hình chính                                                      */
/* ------------------------------------------------------------------ */

export default function UserManagement() {
  const me = getUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await userAPI.getAll();
      setUsers(data.data || []);
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error(getErrorMessage(error, 'Không thể tải danh sách tài khoản.'));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /** Đổi vai trò hoặc bật/tắt hoạt động của một tài khoản */
  const capNhat = async (user, patch, moTa) => {
    setSavingId(user.id);
    try {
      const { data } = await userAPI.update(user.id, patch);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.data : u)));
      toast.success(moTa);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể cập nhật tài khoản.'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="space-y-6 p-4 sm:p-6">
      <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Tài khoản nhân viên
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {users.length} tài khoản ·{' '}
              {users.filter((u) => u.active).length} đang hoạt động
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreating(true)}
            className="btn-primary !py-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Thêm tài khoản
          </button>
        </div>

        {loading ? (
          <LoadingBlock label="Đang tải danh sách tài khoản..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Tên đăng nhập</th>
                  <th className="px-4 py-3 font-semibold">Họ và tên</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const laToi = u.id === me?.id;
                  const laAdmin = u.role === 'admin';
                  const dangLuu = savingId === u.id;

                  return (
                    <tr key={u.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {u.username}
                        {laToi && (
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            (bạn)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.ho_ten || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            VAI_TRO_BADGE[u.role] || 'bg-slate-100 text-slate-600 ring-slate-300'
                          }`}
                        >
                          {VAI_TRO_NHAN[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            u.active
                              ? 'bg-ocb-green-light text-ocb-green-dark ring-ocb-green/30'
                              : 'bg-slate-100 text-slate-500 ring-slate-300'
                          }`}
                        >
                          {u.active ? 'Hoạt động' : 'Đã khoá'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-500">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {dangLuu ? (
                          <Spinner size="sm" className="ml-auto text-ocb-green" />
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setResetting(u)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ocb-green transition hover:bg-ocb-green-light"
                            >
                              Đặt lại MK
                            </button>

                            <button
                              type="button"
                              disabled={laToi || laAdmin}
                              onClick={() =>
                                capNhat(
                                  u,
                                  { active: !u.active },
                                  u.active ? 'Đã khoá tài khoản.' : 'Đã mở khoá tài khoản.'
                                )
                              }
                              className={`ml-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                u.active
                                  ? 'text-red-600 hover:bg-red-50'
                                  : 'text-ocb-green hover:bg-ocb-green-light'
                              }`}
                              title={
                                laAdmin
                                  ? 'Không thể khoá tài khoản quản trị'
                                  : laToi
                                    ? 'Không thể tự khoá tài khoản của mình'
                                    : ''
                              }
                            >
                              {u.active ? 'Khoá' : 'Mở khoá'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="space-y-2 text-xs text-slate-500">
        <p>
          Quyền <strong>Admin</strong> là cấp cao nhất và chỉ thuộc về tài khoản
          gốc của hệ thống. Không nâng quyền cho tài khoản khác được, và cũng
          không ai khoá được tài khoản Admin — kể cả chính nó.
        </p>
        <p>
          Nhân viên nghỉ việc thì <strong>khoá tài khoản</strong> chứ không xoá —
          như vậy lịch sử liên hệ và nhật ký thao tác của họ vẫn còn nguyên để
          đối chiếu sau này. Khoá xong họ mất quyền ngay lập tức, không đợi hết
          phiên đăng nhập.
        </p>
      </div>

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(u) => setUsers((prev) => [...prev, u])}
      />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
    </main>
  );
}
