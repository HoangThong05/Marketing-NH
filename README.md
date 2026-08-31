# Marketing NH — Quản lý khách hàng OCB

Web app quản lý khách hàng cho ngân hàng OCB.

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express (ESM)
- **Database:** Supabase (PostgreSQL)

## Cấu trúc

```
MarketingNH/
├── backend/
│   ├── middleware/authMiddleware.js   # Xác thực JWT
│   ├── routes/auth.js                 # Đăng nhập / tạo tài khoản admin
│   ├── routes/customers.js            # CRUD khách hàng
│   ├── supabase.js                    # Client Supabase dùng chung
│   ├── schema.sql                     # SQL tạo bảng users + index
│   └── index.js                       # Express server
└── frontend/
    └── src/
        ├── services/api.js            # Axios + interceptor gắn JWT
        ├── components/                # OcbLogo, Spinner, ProtectedRoute, EditCustomerModal
        ├── pages/                     # CustomerForm, Login, Admin
        └── App.jsx                    # React Router
```

## Cài đặt

### 1. Tạo bảng trong Supabase

Mở **Supabase → SQL Editor**, dán toàn bộ nội dung [backend/schema.sql](backend/schema.sql) và chạy.

### 2. Backend

```bash
cd backend
npm install
```

Mở `backend/.env` và điền:

| Biến | Lấy ở đâu |
|---|---|
| `SUPABASE_KEY` | Supabase → Project Settings → API → **`service_role`** key (KHÔNG phải `anon`) |
| `JWT_SECRET` | Chuỗi ngẫu nhiên bất kỳ, ví dụ sinh bằng `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

> **Vì sao là `service_role` chứ không phải `anon`?**
> Cả hai bảng đều bật Row Level Security và **không có policy nào**, nên `anon` key
> bị chặn hoàn toàn — kể cả khi key đó lọt ra ngoài. Chỉ `service_role` (bỏ qua RLS)
> đọc được, và key này chỉ nằm ở backend. Trình duyệt không bao giờ gọi thẳng
> Supabase: mọi request đi qua Express API và được bảo vệ bằng JWT riêng của app.
> **Tuyệt đối không đưa `service_role` key vào frontend hay commit lên GitHub.**

Chạy server:

```bash
npm run dev      # http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

## Tạo tài khoản admin (chỉ làm 1 lần)

Endpoint `/api/auth/register` **tự khoá lại sau khi đã có tài khoản đầu tiên**.
Chạy lệnh sau khi backend đang bật:

PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/auth/register -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"MatKhauCuaBan123"}'
```

Git Bash / macOS / Linux:

```bash
curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"username":"admin","password":"MatKhauCuaBan123"}'
```

Sau đó đăng nhập tại http://localhost:5173/login

## Các trang

| Đường dẫn | Quyền | Mô tả |
|---|---|---|
| `/` | Public | Form khách hàng tự điền thông tin |
| `/login` | Public | Đăng nhập nhân viên |
| `/admin` | Cần đăng nhập | Dashboard, biểu đồ, tìm kiếm, sửa/xoá, xuất Excel |

## API

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/auth/register` | Không (khoá sau lần đầu) |
| POST | `/api/auth/login` | Không |
| GET | `/api/customers` | **Có** |
| POST | `/api/customers` | Không (form public) |
| PUT | `/api/customers/:id` | **Có** |
| DELETE | `/api/customers/:id` | **Có** |
| GET | `/api/health` | Không |

## Deploy lên Vercel

Repo này deploy thành **2 project Vercel riêng** từ cùng một GitHub repo, phân biệt
bằng cài đặt **Root Directory**.

### Bước 1 — Deploy backend trước (vì frontend cần URL của nó)

Vercel → **Add New → Project** → chọn repo `Marketing-NH`:

| Cài đặt | Giá trị |
|---|---|
| Project Name | `marketing-nh-api` |
| Root Directory | `backend` |
| Framework Preset | Other |

Thêm **Environment Variables**:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://rfzrxowsabojzcirasiv.supabase.co` |
| `SUPABASE_KEY` | service_role key |
| `JWT_SECRET` | đúng chuỗi trong `backend/.env` |
| `CORS_ORIGIN` | tạm để `*`, sang bước 3 sẽ siết lại |

Deploy xong sẽ có URL dạng `https://marketing-nh-api.vercel.app`.
Kiểm tra: mở `https://marketing-nh-api.vercel.app/api/health` phải thấy JSON `success: true`.

### Bước 2 — Deploy frontend

Add New → Project → cũng chọn repo đó:

| Cài đặt | Giá trị |
|---|---|
| Project Name | `marketing-nh` |
| Root Directory | `frontend` |
| Framework Preset | Vite (Vercel tự nhận) |

Environment Variable:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://marketing-nh-api.vercel.app/api` |

> `VITE_API_URL` được nhúng vào bundle lúc **build**, không phải lúc chạy.
> Đổi biến này thì phải **Redeploy** frontend mới có tác dụng.

### Bước 3 — Siết CORS lại

Quay lại project backend, sửa `CORS_ORIGIN` thành URL frontend thật, rồi **Redeploy**:

```
https://marketing-nh.vercel.app,https://*.vercel.app,http://localhost:5173
```

Mục `https://*.vercel.app` để các bản preview của mỗi pull request vẫn gọi được API.
Nếu không cần preview thì bỏ đi cho chặt.

### Cách hoạt động trên Vercel

- [backend/api/index.js](backend/api/index.js) là serverless function, export lại app Express.
- [backend/vercel.json](backend/vercel.json) dồn mọi đường dẫn về function đó để Express tự phân tuyến.
- [backend/index.js](backend/index.js) chỉ gọi `app.listen()` khi **không** có biến `VERCEL`, nên chạy local vẫn bình thường.
- [frontend/vercel.json](frontend/vercel.json) trả `index.html` cho mọi đường dẫn, nếu thiếu thì F5 ở `/admin` sẽ bị 404.

## Lưu ý

- File `.env` đã được `.gitignore` bỏ qua — **không commit key lên GitHub**. Bản mẫu là `.env.example`.
- Token đăng nhập hết hạn sau 8 giờ.
- Cột `so_dien_thoai` là `UNIQUE`: gửi trùng số sẽ trả HTTP 409.
