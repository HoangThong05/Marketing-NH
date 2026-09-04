# Marketing NH — Quản lý khách hàng OCB

Web app quản lý khách hàng tiềm năng cho phòng marketing ngân hàng OCB: khách tự
điền thông tin qua form công khai, nhân viên nhận và chăm sóc, quản lý theo dõi
tiến độ cả nhóm.

- **Frontend:** React 18 + Vite 5 + Tailwind CSS 3
- **Backend:** Node.js + Express (ESM)
- **Database:** Supabase (PostgreSQL)
- **Deploy:** Vercel (2 project riêng từ cùng một repo)

---

## Tính năng

### Thu thập khách hàng

- Form công khai tại `/` — khách tự điền họ tên, số điện thoại, địa chỉ, nghề
  nghiệp, mức thu nhập, ghi chú
- Giới hạn 5 lượt gửi thành công mỗi giờ trên một địa chỉ IP
- Số điện thoại là `UNIQUE`, gửi trùng trả HTTP 409
- Nhập hàng loạt từ file Excel (chỉ admin), tối đa 500 dòng mỗi lần

### Chăm sóc khách hàng

- 6 trạng thái theo tiến trình: `Mới` → `Không liên lạc được` → `Đã gọi` →
  `Hẹn gọi lại` → `Chốt` / `Từ chối`
- Trạng thái **chỉ đổi được qua chức năng Chăm sóc**, để mỗi lần đổi đều kèm một
  dòng lịch sử ghi rõ ai đổi, lúc nào, nội dung trao đổi ra sao
- Lịch hẹn gọi lại kèm nhắc quá hạn
- Lịch sử liên hệ đầy đủ cho từng khách, chỉ ghi thêm không sửa

### Màn hình "Việc hôm nay"

Gom sẵn 5 nhóm việc thay vì bắt người dùng tự lọc bảng mỗi sáng:

| Nhóm | Nội dung |
|---|---|
| Quá hạn gọi lại | Đã qua giờ hẹn mà chưa liên hệ |
| Hẹn gọi lại hôm nay | Còn trong ngày |
| Khách chưa gọi lần nào | Đã có người phụ trách nhưng chưa ai liên hệ |
| Gọi rồi nhưng không gặp | Không bắt máy, cần gọi lại |
| Khách mới chưa ai nhận | Vừa đăng ký qua form, chưa giao cho ai |

Mỗi nhóm phân trang riêng. Tự làm mới mỗi 2 phút và ngay khi quay lại tab.

### Phân công

- Gán người phụ trách cho từng khách
- Nhân viên tự nhận khách chưa ai giữ, và tự bỏ khách của mình
- Nhân viên **không** gán được khách cho người khác

### Báo cáo & thống kê

- Phễu chăm sóc + cơ cấu thu nhập (biểu đồ cột ngang)
- Báo cáo theo nhân viên: được giao, tiến độ, chi tiết từng trạng thái, lượt gọi
  hôm nay và 7 ngày qua — xuất được ra Excel
- Số việc quá hạn hiện ngay trên **tiêu đề tab trình duyệt**, đổi đúng vào phút
  lịch hẹn tới hạn

### Quản trị

- Tài khoản nhân viên: tạo, khoá, đổi tên hiển thị, đặt lại mật khẩu
- Nhật ký thao tác đầy đủ, có lọc và phân trang
- Thùng rác: xoá mềm, khôi phục, xoá vĩnh viễn
- Hồ sơ cá nhân: nhân viên tự đổi tên hiển thị và mật khẩu

### Bảo mật

- JWT hết hạn sau 8 giờ, mỗi request đều kiểm tra lại tài khoản trong database
  nên khoá tài khoản có hiệu lực tức thì
- Chặn dò mật khẩu: sai 5 lần trong 15 phút từ một IP thì chặn, ghi một dòng
  vào nhật ký để admin biết
- Thời gian phản hồi khi đăng nhập sai là như nhau dù tên đăng nhập có tồn tại
  hay không, để không dò được tài khoản nào có thật
- Địa chỉ IP chỉ lưu dạng băm HMAC-SHA256, không lưu IP gốc

---

## Cấu trúc

```
MarketingNH/
├── backend/
│   ├── api/index.js                   # Điểm vào serverless của Vercel
│   ├── index.js                       # Express app + CORS + health check
│   ├── constants.js                   # Trạng thái, phân loại, mức thu nhập...
│   ├── schema.sql                     # Toàn bộ SQL tạo bảng (chạy được nhiều lần)
│   ├── supabase.js                    # Client Supabase dùng chung
│   ├── middleware/
│   │   └── authMiddleware.js          # Xác thực JWT + requireAdmin
│   ├── lib/
│   │   ├── activityLog.js             # Ghi nhật ký thao tác
│   │   ├── chanDangNhap.js            # Chặn dò mật khẩu
│   │   ├── dienThoai.js               # Chuẩn hoá số điện thoại
│   │   ├── ip.js                      # Lấy và băm IP
│   │   ├── mucLuong.js                # Xếp thu nhập tự do về 4 bậc
│   │   ├── phanTrang.js               # Xử lý xin trang vượt quá dữ liệu
│   │   └── tiengViet.js               # Tìm kiếm không phân biệt dấu
│   └── routes/
│       ├── auth.js                    # Đăng nhập, hồ sơ, đổi mật khẩu
│       ├── customers.js               # Khách hàng, chăm sóc, báo cáo, Excel
│       ├── users.js                   # Quản lý tài khoản
│       └── activity.js                # Nhật ký thao tác
└── frontend/
    └── src/
        ├── App.jsx                    # React Router
        ├── constants.js               # Giữ khớp với backend/constants.js
        ├── services/api.js            # Axios + interceptor gắn JWT
        ├── utils/                     # dienThoai, mucLuong (dùng chung với BE)
        ├── components/
        │   ├── ContactModal.jsx       # Ghi nhận một lần chăm sóc
        │   ├── EditCustomerModal.jsx
        │   ├── ImportModal.jsx        # Nhập Excel
        │   ├── ProfileModal.jsx       # Hồ sơ + đổi mật khẩu
        │   ├── SoDienThoai.jsx        # Số điện thoại bấm là chép
        │   └── ...                    # OcbLogo, Spinner, PhanTrang, PasswordInput
        └── pages/
            ├── CustomerForm.jsx       # Form công khai
            ├── Login.jsx
            ├── Admin.jsx              # Khung sidebar + màn Quản lý khách hàng
            ├── ViecHomNay.jsx
            ├── BaoCaoNhanVien.jsx
            ├── UserManagement.jsx
            └── ActivityLog.jsx
```

---

## Cài đặt

### 1. Tạo bảng trong Supabase

Mở **Supabase → SQL Editor**, dán toàn bộ [backend/schema.sql](backend/schema.sql)
và chạy. File này viết theo kiểu chạy lại bao nhiêu lần cũng được
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), nên khi cập nhật phiên
bản mới cứ chạy lại toàn bộ.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Điền vào `backend/.env`:

| Biến | Lấy ở đâu |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_KEY` | Cùng trang, mục **`service_role`** key (KHÔNG phải `anon`) |
| `JWT_SECRET` | Chuỗi ngẫu nhiên, sinh bằng lệnh bên dưới |
| `CORS_ORIGIN` | `http://localhost:5173` khi chạy máy |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> **Vì sao là `service_role` chứ không phải `anon`?**
> Mọi bảng đều bật Row Level Security và **không có policy nào**, nên `anon` key bị
> chặn hoàn toàn kể cả khi lọt ra ngoài. Chỉ `service_role` (bỏ qua RLS) đọc được,
> và key này chỉ nằm ở backend. Trình duyệt không bao giờ gọi thẳng Supabase: mọi
> request đi qua Express API và được bảo vệ bằng JWT riêng của app.
> **Tuyệt đối không đưa `service_role` key vào frontend hay commit lên GitHub.**

```bash
npm run dev      # http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Chạy máy thì frontend tự gọi `http://localhost:5000/api`. Muốn trỏ đi chỗ khác thì
đặt `VITE_API_URL` trong `frontend/.env`.

### 4. Tạo tài khoản admin (chỉ làm một lần)

`/api/auth/register` **tự khoá lại sau khi đã có tài khoản đầu tiên**, nên không ai
tự tạo thêm admin được. Chạy khi backend đang bật:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"MatKhauCuaBan123"}'
```

PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:5000/api/auth/register -Method Post `
  -ContentType 'application/json' `
  -Body '{"username":"admin","password":"MatKhauCuaBan123"}'
```

Đăng nhập tại http://localhost:5173/login

---

## Phân quyền

Chỉ có hai vai trò, và **`admin` chỉ thuộc về tài khoản gốc** — không tạo thêm
admin qua giao diện được.

| Việc | Nhân viên | Admin |
|---|---|---|
| Xem, sửa, chăm sóc khách hàng | ✅ | ✅ |
| Nhận khách chưa ai giữ / bỏ khách của mình | ✅ | ✅ |
| Gán khách cho người khác | ❌ | ✅ |
| Xoá khách, thùng rác, xoá vĩnh viễn | ❌ | ✅ |
| Nhập Excel | ❌ | ✅ |
| Báo cáo nhân viên | ❌ | ✅ |
| Quản lý tài khoản | ❌ | ✅ |
| Nhật ký thao tác | ❌ | ✅ |
| Đổi tên hiển thị & mật khẩu của mình | ✅ | ✅ |

Màn hình *Việc hôm nay* hiển thị theo vai trò: nhân viên chỉ thấy khách mình phụ
trách, admin thấy toàn hệ thống kèm tên người phụ trách trên từng dòng.

---

## Các trang

| Đường dẫn | Quyền | Mô tả |
|---|---|---|
| `/` | Công khai | Form khách hàng tự điền |
| `/login` | Công khai | Đăng nhập nhân viên |
| `/admin` | Cần đăng nhập | Toàn bộ khu quản trị, chuyển màn bằng sidebar |

---

## API

Tất cả dưới tiền tố `/api`. Cột **Quyền**: *Công khai* = không cần token,
*Đăng nhập* = cần JWT hợp lệ, *Admin* = cần thêm vai trò admin.

### Xác thực — `/api/auth`

| Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| POST | `/register` | Công khai | Tự khoá sau tài khoản đầu tiên |
| POST | `/login` | Công khai | Chặn sau 5 lần sai / 15 phút |
| GET | `/toi` | Đăng nhập | Hồ sơ của chính mình |
| PUT | `/toi` | Đăng nhập | Đổi tên hiển thị |
| PUT | `/password` | Đăng nhập | Đổi mật khẩu của mình |

### Khách hàng — `/api/customers`

| Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/` | Đăng nhập | Phân trang, lọc, sắp xếp, tìm không dấu |
| POST | `/` | Công khai | Form khách tự điền, có giới hạn tần suất |
| GET | `/stats` | Đăng nhập | Số liệu toàn hệ thống |
| GET | `/bao-cao-nhan-vien` | **Admin** | Tiến độ từng nhân viên |
| GET | `/export` | Đăng nhập | Lấy toàn bộ dữ liệu khớp bộ lọc để xuất Excel |
| POST | `/import` | **Admin** | Nhập hàng loạt, tối đa 500 dòng |
| PUT | `/:id` | Đăng nhập | Không đổi được `trang_thai` qua đây |
| DELETE | `/:id` | **Admin** | Xoá mềm, vào thùng rác |
| PUT | `/:id/khoi-phuc` | **Admin** | Lấy lại từ thùng rác |
| DELETE | `/:id/vinh-vien` | **Admin** | Xoá hẳn, mất luôn lịch sử liên hệ |
| PUT | `/:id/phu-trach` | Đăng nhập | Nhân viên chỉ tự nhận / tự bỏ |
| GET | `/:id/contacts` | Đăng nhập | Lịch sử liên hệ |
| POST | `/:id/contacts` | Đăng nhập | Ghi nhận chăm sóc + đổi trạng thái |

### Tài khoản — `/api/users`

| Method | Endpoint | Quyền |
|---|---|---|
| GET | `/danh-ba` | Đăng nhập |
| GET | `/` | **Admin** |
| POST | `/` | **Admin** |
| PUT | `/:id` | **Admin** |
| PUT | `/:id/password` | **Admin** |

### Nhật ký — `/api/activity`

| Method | Endpoint | Quyền |
|---|---|---|
| GET | `/` | **Admin** |
| GET | `/nguoi-thuc-hien` | **Admin** |

### Kiểm tra sống — `/api/health`

| Method | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/api/health` | Công khai | Không đụng database |
| GET | `/api/health/db` | Công khai | Có truy vấn thật, không trả về số liệu nào |

---

## Deploy lên Vercel

Repo này deploy thành **2 project Vercel riêng** từ cùng một GitHub repo, phân biệt
bằng cài đặt **Root Directory**.

### Bước 1 — Backend trước (vì frontend cần URL của nó)

Vercel → **Add New → Project** → chọn repo này:

| Cài đặt | Giá trị |
|---|---|
| Project Name | `marketing-nh-api` |
| Root Directory | `backend` |
| Framework Preset | Other |

**Environment Variables:**

| Key | Value |
|---|---|
| `SUPABASE_URL` | Project URL của bạn |
| `SUPABASE_KEY` | service_role key |
| `JWT_SECRET` | đúng chuỗi trong `backend/.env` |
| `CORS_ORIGIN` | tạm để `*`, sang bước 3 siết lại |

Kiểm tra: mở `https://<tên-project>.vercel.app/api/health` phải thấy `success: true`.

### Bước 2 — Frontend

| Cài đặt | Giá trị |
|---|---|
| Project Name | `marketing-nh` |
| Root Directory | `frontend` |
| Framework Preset | Vite (Vercel tự nhận) |

**Environment Variable:** `VITE_API_URL` = `https://<tên-project-api>.vercel.app/api`

> `VITE_API_URL` được nhúng vào bundle lúc **build**, không phải lúc chạy.
> Đổi biến này thì phải **Redeploy** frontend mới có tác dụng.

### Bước 3 — Siết CORS

Quay lại project backend, sửa `CORS_ORIGIN` thành URL thật rồi **Redeploy**:

```
https://<tên-project>.vercel.app,https://*.vercel.app,http://localhost:5173
```

Mục `https://*.vercel.app` để bản preview của mỗi pull request vẫn gọi được API.
Không cần preview thì bỏ đi cho chặt.

### Cách hoạt động trên Vercel

- [backend/api/index.js](backend/api/index.js) là serverless function, export lại app Express
- [backend/vercel.json](backend/vercel.json) dồn mọi đường dẫn về function đó để Express tự phân tuyến
- [backend/index.js](backend/index.js) chỉ gọi `app.listen()` khi **không** có biến `VERCEL`, nên chạy máy vẫn bình thường
- [frontend/vercel.json](frontend/vercel.json) trả `index.html` cho mọi đường dẫn — thiếu thì F5 ở `/admin` sẽ 404
- Backend đặt `regions: ["bom1"]` (Mumbai) cho gần Supabase `ap-south-1`. Đo thực tế:
  đổi từ `iad1` (Washington) sang `bom1` rút thời gian một vòng gọi database từ
  **170ms xuống 39ms**. Nếu Supabase của bạn ở vùng khác thì sửa lại cho khớp.

### Giữ Supabase không bị ngủ

Gói miễn phí của Supabase tạm dừng project sau 7 ngày không có truy vấn nào.
[.github/workflows/giu-supabase-song.yml](.github/workflows/giu-supabase-song.yml)
gọi `/api/health/db` mỗi ngày một lần để giữ project sống.

---

## Lưu ý vận hành

- File `.env` đã bị `.gitignore` bỏ qua — **không commit key lên GitHub**. Bản mẫu
  là `.env.example`.
- **Repo này để công khai**, nên không được commit bất kỳ dữ liệu khách hàng thật
  nào: không file Excel, không ảnh chụp màn hình có số điện thoại, không số thật
  trong comment hay test.
- Token đăng nhập hết hạn sau 8 giờ.
- Xuất Excel giới hạn 10.000 dòng, thống kê giới hạn 50.000 khách. Vượt mốc đó thì
  phải chuyển sang đếm bằng hàm SQL phía database.
- Tìm theo tên quét toàn bảng (regex bỏ dấu), chậm dần khi dữ liệu lớn. Tìm theo
  số điện thoại thì dùng index nên luôn nhanh.
- Chưa có sao lưu tự động — nên **xuất Excel định kỳ** để giữ một bản ngoài
  Supabase.
- Gói Hobby của Vercel dành cho mục đích phi thương mại.
