// Trang đăng nhập dành cho nhân viên / quản trị viên.
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  authAPI,
  setToken,
  setUser,
  isTokenValid,
  getErrorMessage,
} from '../services/api';
import OcbLogo from '../components/OcbLogo';
import Spinner from '../components/Spinner';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Trang người dùng định vào trước khi bị chặn, mặc định là /admin
  const from = location.state?.from || '/admin';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { username: '', password: '' },
  });

  // Đã đăng nhập rồi thì không cần xem lại trang này
  useEffect(() => {
    if (isTokenValid()) {
      navigate(from, { replace: true });
    }
  }, [from, navigate]);

  const onSubmit = async (values) => {
    try {
      const { data } = await authAPI.login({
        username: values.username.trim(),
        password: values.password,
      });

      // Lưu token + thông tin user vào localStorage
      setToken(data.token);
      setUser(data.user);

      toast.success(`Xin chào, ${data.user?.username || 'bạn'}!`);
      navigate(from, { replace: true });
    } catch (error) {
      const message = getErrorMessage(error, 'Đăng nhập thất bại.');

      // Sai thông tin đăng nhập thì báo lỗi ngay dưới ô mật khẩu
      if (error?.response?.status === 401) {
        setError('password', { type: 'manual', message });
      }
      toast.error(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ocb-green to-ocb-green-dark px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo trên nền xanh */}
        <div className="mb-6 flex justify-center">
          <OcbLogo size="lg" />
        </div>

        <div className="animate-fade-in-up overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-ocb-orange to-ocb-green" />

          <div className="p-7 sm:p-8">
            <h1 className="text-center text-xl font-bold text-slate-800 sm:text-2xl">
              Đăng nhập hệ thống
            </h1>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              Dành cho nhân viên quản lý khách hàng
            </p>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-6 space-y-5"
              noValidate
            >
              {/* --- Tên đăng nhập --- */}
              <div>
                <label htmlFor="username" className="form-label">
                  Tên đăng nhập
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="admin"
                  className={`input-field ${errors.username ? 'input-error' : ''}`}
                  aria-invalid={errors.username ? 'true' : 'false'}
                  {...register('username', {
                    required: 'Vui lòng nhập tên đăng nhập',
                    minLength: {
                      value: 3,
                      message: 'Tên đăng nhập phải có ít nhất 3 ký tự',
                    },
                  })}
                />
                {errors.username && (
                  <span className="error-text">{errors.username.message}</span>
                )}
              </div>

              {/* --- Mật khẩu --- */}
              <div>
                <label htmlFor="password" className="form-label">
                  Mật khẩu
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`input-field ${errors.password ? 'input-error' : ''}`}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  {...register('password', {
                    required: 'Vui lòng nhập mật khẩu',
                    minLength: {
                      value: 6,
                      message: 'Mật khẩu phải có ít nhất 6 ký tự',
                    },
                  })}
                />
                {errors.password && (
                  <span className="error-text">{errors.password.message}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-3 text-base"
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm font-medium text-white/80 transition hover:text-white"
          >
            &larr; Về trang đăng ký khách hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
