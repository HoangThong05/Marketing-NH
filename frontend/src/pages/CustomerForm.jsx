// Trang công khai: khách hàng tự điền thông tin đăng ký.
// Không cần đăng nhập.
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { customerAPI, getErrorMessage } from '../services/api';
import OcbLogo from '../components/OcbLogo';
import Spinner from '../components/Spinner';
import { chuanHoaSoDienThoai } from '../utils/dienThoai';
import {
  NGHE_NGHIEP_GOI_Y,
  NGHE_NGHIEP_KHAC,
  MUC_LUONG_LIST,
} from '../constants';

// Regex kiểm tra số điện thoại Việt Nam theo đầu số các nhà mạng
const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[0|6-9]|8[0-9]|9[0-9])[0-9]{7}$/;

export default function CustomerForm() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      so_dien_thoai: '',
      ten_khach_hang: '',
      dia_chi: '',
      nghe_nghiep_chon: '',
      nghe_nghiep_khac: '',
      muc_luong: '',
      ghi_chu: '',
    },
  });

  // Chọn "Khác" thì hiện thêm ô để khách tự gõ nghề nghiệp
  const laNgheKhac = watch('nghe_nghiep_chon') === NGHE_NGHIEP_KHAC;

  /** Gửi dữ liệu lên backend */
  const onSubmit = async (values) => {
    try {
      // Gộp hai ô nghề nghiệp thành một giá trị duy nhất gửi lên server
      const { nghe_nghiep_chon, nghe_nghiep_khac, ...phanConLai } = values;
      const nghe_nghiep =
        nghe_nghiep_chon === NGHE_NGHIEP_KHAC
          ? nghe_nghiep_khac.trim()
          : nghe_nghiep_chon;

      const payload = {
        ...phanConLai,
        ten_khach_hang: values.ten_khach_hang.trim(),
        nghe_nghiep,
      };

      await customerAPI.create(payload);

      toast.success('Đăng ký thông tin thành công. Cảm ơn quý khách!');
      reset(); // Xoá trắng form sau khi lưu thành công
    } catch (error) {
      toast.error(getErrorMessage(error, 'Không thể lưu thông tin.'));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocb-green-light via-slate-50 to-ocb-orange-light px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        {/* Tiêu đề trang */}
        <div className="mb-6 flex flex-col items-center text-center">
          <OcbLogo size="xl" />
          <h1 className="mt-4 text-2xl font-bold text-slate-800 sm:text-3xl">
            Đăng ký thông tin khách hàng
          </h1>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Quý khách vui lòng điền thông tin bên dưới. Nhân viên OCB sẽ liên hệ
            trong thời gian sớm nhất.
          </p>
        </div>

        {/* Thẻ chứa form */}
        <div className="animate-fade-in-up overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-slate-200">
          {/* Dải màu thương hiệu ở đầu thẻ */}
          <div className="h-1.5 bg-gradient-to-r from-ocb-green to-ocb-orange" />

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 p-6 sm:p-8"
            noValidate
          >
            {/* --- Số điện thoại --- */}
            <div>
              <label htmlFor="so_dien_thoai" className="form-label">
                Số điện thoại <span className="text-red-500">*</span>
              </label>
              <input
                id="so_dien_thoai"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Ví dụ: 0901234567"
                className={`input-field ${errors.so_dien_thoai ? 'input-error' : ''}`}
                aria-invalid={errors.so_dien_thoai ? 'true' : 'false'}
                {...register('so_dien_thoai', {
                  required: 'Vui lòng nhập số điện thoại',
                  // Chuẩn hoá trước khi validate: gõ "090 123 4567" vẫn hợp lệ
                  setValueAs: (v) => chuanHoaSoDienThoai(v),
                  pattern: {
                    value: PHONE_REGEX,
                    message: 'Số điện thoại không hợp lệ (ví dụ: 0901234567)',
                  },
                })}
              />
              {errors.so_dien_thoai && (
                <span className="error-text">{errors.so_dien_thoai.message}</span>
              )}
            </div>

            {/* --- Tên khách hàng --- */}
            <div>
              <label htmlFor="ten_khach_hang" className="form-label">
                Tên khách hàng <span className="text-red-500">*</span>
              </label>
              <input
                id="ten_khach_hang"
                type="text"
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                className={`input-field ${errors.ten_khach_hang ? 'input-error' : ''}`}
                aria-invalid={errors.ten_khach_hang ? 'true' : 'false'}
                {...register('ten_khach_hang', {
                  required: 'Vui lòng nhập tên khách hàng',
                  minLength: { value: 2, message: 'Tên phải có ít nhất 2 ký tự' },
                  maxLength: { value: 100, message: 'Tên không được quá 100 ký tự' },
                })}
              />
              {errors.ten_khach_hang && (
                <span className="error-text">{errors.ten_khach_hang.message}</span>
              )}
            </div>

            {/* --- Địa chỉ --- */}
            <div>
              <label htmlFor="dia_chi" className="form-label">
                Địa chỉ
              </label>
              <input
                id="dia_chi"
                type="text"
                autoComplete="street-address"
                placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                className={`input-field ${errors.dia_chi ? 'input-error' : ''}`}
                {...register('dia_chi', {
                  maxLength: {
                    value: 255,
                    message: 'Địa chỉ không được quá 255 ký tự',
                  },
                })}
              />
              {errors.dia_chi && (
                <span className="error-text">{errors.dia_chi.message}</span>
              )}
            </div>

            {/* --- Nghề nghiệp --- */}
            <div>
              <label htmlFor="nghe_nghiep_chon" className="form-label">
                Nghề nghiệp
              </label>
              <select
                id="nghe_nghiep_chon"
                className="input-field"
                {...register('nghe_nghiep_chon')}
              >
                <option value="">-- Chọn nghề nghiệp --</option>
                {NGHE_NGHIEP_GOI_Y.map((nn) => (
                  <option key={nn} value={nn}>
                    {nn}
                  </option>
                ))}
                <option value={NGHE_NGHIEP_KHAC}>Khác (tự nhập)</option>
              </select>

              {/* Ô tự nhập chỉ hiện khi chọn "Khác" */}
              {laNgheKhac && (
                <input
                  type="text"
                  placeholder="Nhập nghề nghiệp của quý khách"
                  className={`input-field mt-2 ${
                    errors.nghe_nghiep_khac ? 'input-error' : ''
                  }`}
                  aria-label="Nghề nghiệp khác"
                  {...register('nghe_nghiep_khac', {
                    validate: (v) =>
                      !laNgheKhac ||
                      v.trim().length >= 2 ||
                      'Vui lòng nhập nghề nghiệp',
                    maxLength: {
                      value: 100,
                      message: 'Nghề nghiệp không được quá 100 ký tự',
                    },
                  })}
                />
              )}
              {errors.nghe_nghiep_khac && (
                <span className="error-text">{errors.nghe_nghiep_khac.message}</span>
              )}
            </div>

            {/* --- Mức thu nhập --- */}
            <div>
              <label htmlFor="muc_luong" className="form-label">
                Mức thu nhập hàng tháng
              </label>
              <select id="muc_luong" className="input-field" {...register('muc_luong')}>
                <option value="">-- Chọn mức thu nhập --</option>
                {MUC_LUONG_LIST.map((ml) => (
                  <option key={ml} value={ml}>
                    {ml}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-400">
                Thông tin này giúp nhân viên tư vấn đúng sản phẩm phù hợp.
              </span>
            </div>

            {/* --- Ghi chú --- */}
            <div>
              <label htmlFor="ghi_chu" className="form-label">
                Ghi chú
              </label>
              <textarea
                id="ghi_chu"
                rows={3}
                placeholder="Nhu cầu, sản phẩm quan tâm, thời gian tiện liên hệ..."
                className={`input-field resize-none ${errors.ghi_chu ? 'input-error' : ''}`}
                {...register('ghi_chu', {
                  maxLength: {
                    value: 500,
                    message: 'Ghi chú không được quá 500 ký tự',
                  },
                })}
              />
              {errors.ghi_chu && (
                <span className="error-text">{errors.ghi_chu.message}</span>
              )}
            </div>

            {/* --- Nút gửi --- */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Đang lưu...
                </>
              ) : (
                'Gửi thông tin'
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              Thông tin của quý khách được bảo mật theo quy định của OCB.
            </p>
          </form>
        </div>

        {/* Lối vào trang quản trị */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-sm font-medium text-slate-500 transition hover:text-ocb-green"
          >
            Đăng nhập quản trị
          </Link>
        </div>
      </div>
    </div>
  );
}
