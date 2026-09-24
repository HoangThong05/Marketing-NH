# Marketing NH — Quản lý khách hàng VietinBank

Công cụ quản lý khách hàng tiềm năng cho phòng marketing: khách tự điền thông tin
qua form công khai, nhân viên nhận và chăm sóc, quản lý theo dõi tiến độ cả nhóm.

**React 18 + Vite 5 + Tailwind 3** ở trình duyệt · **Node.js + Express** ở máy chủ ·
**PostgreSQL trên Supabase** · deploy trên **Vercel**

---

## Tính năng

- **Form công khai** khách tự điền, giới hạn 5 lượt/giờ mỗi IP, số điện thoại là khoá duy nhất
- **Chăm sóc** theo 6 trạng thái, mỗi lần đổi trạng thái đều kèm một dòng lịch sử — không sửa thẳng được
- **Việc hôm nay**: gom sẵn 5 nhóm việc (quá hạn, hẹn hôm nay, chưa gọi lần nào, gọi không gặp, chưa ai nhận)
- **Phân công**: gán người phụ trách; nhân viên tự nhận và tự bỏ khách của mình
- **Báo cáo theo nhân viên**: được giao, tiến độ, chi tiết trạng thái, lượt gọi hôm nay và 7 ngày
- **Nhập / xuất Excel**, thùng rác (xoá mềm, khôi phục), nhật ký thao tác đầy đủ
- **Nhắc lịch** bằng số việc quá hạn hiện ngay trên tiêu đề tab trình duyệt

### Bảo mật

- JWT hạn 8 giờ, mỗi request đọc lại tài khoản trong database nên khoá nhân viên là mất quyền ngay
- Chặn dò mật khẩu: sai 5 lần trong 15 phút từ một IP thì chặn, ghi vào nhật ký
- Đăng nhập sai luôn mất chừng ấy thời gian dù tên đăng nhập có thật hay không
- IP chỉ lưu dạng băm HMAC-SHA256

---

## Bắt đầu

Cần Node.js ≥ 18 và một project Supabase.

### 1. Tạo bảng

Mở **Supabase → SQL Editor**, dán toàn bộ [backend/schema.sql](backend/schema.sql) và chạy.
File viết theo kiểu chạy lại bao nhiêu lần cũng được, nên mỗi lần cập nhật cứ chạy lại tất cả.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev          # http://localhost:5000
```

| Biến | Lấy ở đâu |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_KEY` | Cùng trang, mục **`service_role`** (KHÔNG phải `anon`) |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CORS_ORIGIN` | `http://localhost:5173` khi chạy máy |

> **Vì sao `service_role`?** Mọi bảng đều bật Row Level Security và không có policy
> nào, nên khoá `anon` bị chặn hoàn toàn kể cả khi lọt ra ngoài. Trình duyệt không
> bao giờ gọi thẳng Supabase — mọi request đi qua Express và được kiểm bằng JWT
> riêng của app. **Không đưa khoá này ra frontend hay commit lên GitHub.**

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

Mặc định gọi `http://localhost:5000/api`. Muốn trỏ chỗ khác thì đặt `VITE_API_URL`.

### 4. Tạo tài khoản admin

`/api/auth/register` **tự khoá sau tài khoản đầu tiên**, nên không ai tự tạo thêm
admin được. Chạy khi backend đang bật:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"MatKhauCuaBan123"}'
```

---

## Cấu trúc

```
backend/
  index.js          Express app, CORS, health check
  api/index.js      Điểm vào serverless của Vercel
  schema.sql        Toàn bộ SQL tạo bảng
  constants.js      Trạng thái, phân loại, mức thu nhập (giữ khớp với frontend)
  middleware/       Xác thực JWT + requireAdmin
  lib/              Nhật ký, chặn dò mật khẩu, chuẩn hoá SĐT, tìm không dấu...
  routes/           auth · customers · users · activity

frontend/src/
  App.jsx           Định tuyến
  constants.js      Giữ khớp với backend/constants.js
  services/api.js   Axios + interceptor gắn JWT
  components/       Modal chăm sóc, sửa, nhập Excel, hồ sơ...
  pages/            CustomerForm · Login · Admin · ViecHomNay · BaoCaoNhanVien
                    UserManagement · ActivityLog
```

Mỗi file đều có ghi chú ở đầu nói rõ nó làm gì và vì sao làm như vậy.

---

## Phân quyền

Hai vai trò, và **`admin` chỉ thuộc về tài khoản gốc** — không tạo thêm admin qua
giao diện được.

| Việc | Nhân viên | Admin |
|---|---|---|
| Xem, sửa, chăm sóc khách hàng | ✅ | ✅ |
| Nhận khách chưa ai giữ / bỏ khách của mình | ✅ | ✅ |
| Đổi tên hiển thị & mật khẩu của mình | ✅ | ✅ |
| Gán khách cho người khác | ❌ | ✅ |
| Xoá khách, thùng rác | ❌ | ✅ |
| Nhập Excel | ❌ | ✅ |
| Báo cáo, quản lý tài khoản, nhật ký | ❌ | ✅ |

---

## Đường dẫn

| Địa chỉ | Quyền |
|---|---|
| `/` | Công khai — form khách tự điền |
| `/login` | Công khai |
| `/lam-viec/viec-hom-nay` | Cần đăng nhập (màn mặc định) |
| `/lam-viec/khach-hang` | Cần đăng nhập |
| `/lam-viec/bao-cao` · `/tai-khoan` · `/nhat-ky` | Admin |

Mỗi mục là một địa chỉ riêng nên nút Back và F5 hoạt động đúng, gửi link được.
Địa chỉ cũ `/admin` vẫn chuyển hướng sang `/lam-viec`.

## API

28 endpoint dưới tiền tố `/api`, chia 4 nhóm — xem [backend/routes/](backend/routes/):

| Nhóm | File | Ghi chú |
|---|---|---|
| `/api/auth` | [auth.js](backend/routes/auth.js) | Đăng nhập, hồ sơ, đổi mật khẩu |
| `/api/customers` | [customers.js](backend/routes/customers.js) | Khách hàng, chăm sóc, báo cáo, Excel |
| `/api/users` | [users.js](backend/routes/users.js) | Quản lý tài khoản — admin |
| `/api/activity` | [activity.js](backend/routes/activity.js) | Nhật ký thao tác — admin |

`GET /api/health` và `/api/health/db` không cần đăng nhập.

Chỉ `POST /api/customers` (form công khai) là không cần token; còn lại đều cần, và
các thao tác quản trị cần thêm vai trò admin.

---

## Deploy lên Vercel

Hai project riêng dựng từ **cùng một repo**, phân biệt bằng **Root Directory**.

| | Backend | Frontend |
|---|---|---|
| Root Directory | `backend` | `frontend` |
| Framework Preset | Other | Vite |
| Biến môi trường | `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, `CORS_ORIGIN` | `VITE_API_URL` |

Deploy backend trước để lấy URL, rồi mới deploy frontend. Xong quay lại sửa
`CORS_ORIGIN` của backend thành URL frontend thật và **Redeploy**:

```
https://<frontend>.vercel.app,https://*.vercel.app,http://localhost:5173
```

Vài điểm dễ vấp:

- `VITE_API_URL` nhúng vào bundle **lúc build**, đổi biến phải Redeploy mới ăn
- [frontend/vercel.json](frontend/vercel.json) trả `index.html` cho mọi đường dẫn —
  thiếu thì F5 ở `/lam-viec/bao-cao` sẽ 404
- Backend đặt `regions: ["bom1"]` (Mumbai) cho gần Supabase `ap-south-1`. Đo thực
  tế: đổi từ `iad1` sang `bom1` rút một vòng gọi database từ **170 ms xuống 39 ms**.
  Supabase của bạn ở vùng khác thì sửa lại cho khớp.
- Gói miễn phí của Supabase tạm dừng project sau 7 ngày không có truy vấn. Dữ liệu
  không mất, nhưng phải vào dashboard bấm khôi phục. Muốn chạy liên tục thì đặt một
  lịch (GitHub Actions, cron-job.org...) gọi `/api/health/db` mỗi ngày một lần.

---

## Lưu ý

- **Repo để công khai** — không commit dữ liệu khách hàng thật: không file Excel,
  không ảnh chụp màn hình có số điện thoại, không số thật trong comment hay test.
- `.env` đã bị `.gitignore` bỏ qua. Bản mẫu là `.env.example`.
- Giới hạn đã biết: xuất Excel 10.000 dòng, thống kê 50.000 khách, nhập Excel 500
  dòng mỗi lần. Vượt mốc đó phải chuyển sang đếm bằng hàm SQL.
- Tìm theo tên quét toàn bảng nên chậm dần khi dữ liệu lớn; tìm theo số điện thoại
  dùng index nên luôn nhanh.
- **Chưa có sao lưu tự động** — nên xuất Excel định kỳ để giữ một bản ngoài Supabase.
